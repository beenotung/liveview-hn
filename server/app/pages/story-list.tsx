import { ServerMessage } from '../../../client/index.js'
import {
  get,
  getProfile,
  getStoryById,
  getWithMapFn,
  StoryDTO,
  UpdatesDTO,
} from '../../api.js'
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
  defaultValue?: any
  apiMapFn?: (data: any) => number[]
  urlFilter: (url: string) => boolean
}) {
  function getSubmitted(context: Context): number[] {
    if (context.type === 'static') {
      throw new Error(
        "<StoryList/> for submitted list doesn't support static context, it requires routerMatch for item id",
      )
    }
    let params = new URLSearchParams(context.routerMatch!.search)
    let id = params.get('id')!
    if (!id) {
      return <p>Error: Missing id in query</p>
    }
    let profile = getProfile(id, profile =>
      updateStoryList(profile.submitted?.slice(0, 30) || [], context),
    )
    return profile.submitted?.slice(0, 30) || []
  }

  function getStoryList(context: Context): number[] {
    if (options.apiUrl === 'user.submitted') {
      return getSubmitted(context)
    }

    let ids = options.apiMapFn
      ? getWithMapFn<any, number[]>(
          options.apiUrl,
          options.defaultValue || ([] as number[]),
          options.apiMapFn,
          ids => updateStoryList(ids.slice(0, 30), context),
        )
      : get<number[]>(options.apiUrl, [], ids =>
          updateStoryList(ids.slice(0, 30), context),
        )
    return ids.slice(0, 30)
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
    let element = renderListItem(story)
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
        <ol>
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

  function renderListItem(story: StoryDTO) {
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

  function StoryOverviewById(attrs: { id: number }) {
    let context = getContext(attrs)
    let story = getStoryById(attrs.id, story => updateStory(story, context))
    return renderListItem(story)
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
    apiMapFn: (data: UpdatesDTO) => data.items,
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
  Submitted: genStoryList({
    id: 'submitted',
    apiUrl: 'user.submitted',
    urlFilter: (url: string) => url === '/submitted',
  }),
}
