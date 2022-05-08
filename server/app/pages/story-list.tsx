import { ServerMessage } from '../../../client/index.js'
import { get, getStoryById, StoryDTO } from '../../api.js'
import { Flush } from '../components/flush.js'
import { mapArray } from '../components/fragment.js'
import StoryOverview from '../components/story-overview.js'
import Style from '../components/style.js'
import { Context, getContext } from '../context.js'
import JSX from '../jsx/jsx.js'
import { Element } from '../jsx/types.js'
import { nodeToVNode } from '../jsx/vnode.js'
import StoryDetail from './story-detail.js'

let style = Style(/* css */ `
.story-list ol {
  line-height: 1.25rem;
  font-size: 1rem;
}
.story-list .story-item {
	margin-bottom: 1.25rem;
}
`)

export function genStoryList(options: {
  id: string
  apiUrl: string
  urlFilter: (url: string) => boolean
}) {
  function getStoryList(context: Context) {
    let ids = get<number[] | { items: number[] }>(options.apiUrl, [], ids => {
      if (!Array.isArray(ids)) {
        ids = ids.items
      }
      ids = ids.slice(0, 30)
      updateStoryList(ids, context)
    })
    if (!Array.isArray(ids)) {
      ids = ids.items
    }
    ids = ids.slice(0, 30)
    return ids
  }

  function updateStoryList(ids: number[], context: Context) {
    if (context.type !== 'ws') return
    if (!options.urlFilter(context.url)) return
    let element = nodeToVNode(renderStoryList(ids), context)
    let message: ServerMessage = ['update', element]
    context.ws.send(message)
  }

  function updateStory(story: StoryDTO, context: Context) {
    if (context.type !== 'ws') return
    if (!options.urlFilter(context.url)) return
    let element = <StoryOverview story={story} tagName="li" />
    let message: ServerMessage = ['update', nodeToVNode(element, context)]
    context.ws.send(message)
  }

  function StoryList(attrs: {}): Element {
    let context = getContext(attrs)
    let ids = getStoryList(context)
    return renderStoryList(ids)
  }

  function renderStoryList(ids: number[]): Element {
    return [
      `#${options.id}.story-list`,
      {},
      [
        style,
        StoryOverview.style,
        StoryDetail.style,
        <ol class="story-list">
          {mapArray(ids, id => (
            <>
              <Flush />
              <StoryOverviewById id={id} />
            </>
          ))}
        </ol>,
      ],
    ]
  }

  function StoryOverviewById(attrs: { id: number }) {
    let context = getContext(attrs)
    let story = getStoryById(attrs.id, story => updateStory(story, context))
    return story.title ? (
      <StoryOverview story={story} tagName="li" />
    ) : (
      <StoryDetail.StoryItem
        item={story}
        indent={0}
        nextId={undefined}
        parentIds={new Set()}
        topLevel
        skipChildren
      />
    )
  }

  return StoryList
}

export default {
  TopStories: genStoryList({
    id: 'news',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    urlFilter: (url: string) => url === '/' || url === '/news',
  }),
  NewStories: genStoryList({
    id: 'newest',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/newstories.json',
    urlFilter: (url: string) => url === '/newest',
  }),
  BestStories: genStoryList({
    id: 'front',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/beststories.json',
    urlFilter: (url: string) => url === '/front',
  }),
  Comments: genStoryList({
    id: 'newcomments',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/updates.json',
    urlFilter: (url: string) => url === '/newcomments',
  }),
  AskStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/askstories.json',
    urlFilter: (url: string) => url === '/ask',
  }),
  ShowStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/showstories.json',
    urlFilter: (url: string) => url === '/show',
  }),
  JobStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/jobstories.json',
    urlFilter: (url: string) => url === '/job',
  }),
}
