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
import { sessions, sessionToContext } from '../session.js'
import { getContextSearchParams } from '../routes.js'

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
  url: string
}) {
  function getSubmitted(context: Context): number[] {
    if (context.type === 'static') {
      throw new Error(
        "<StoryList/> for submitted list doesn't support static context, it requires routerMatch for item id",
      )
    }
    let params = getContextSearchParams(context)
    let id = params.get('id')!
    if (!id) {
      return <p>Error: Missing id in query</p>
    }
    let profile = getProfile(id, profile =>
      updateStoryList(profile.submitted?.slice(0, 30) || []),
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
          ids => updateStoryList(ids.slice(0, 30)),
        )
      : get<number[]>(options.apiUrl, [], ids =>
          updateStoryList(ids.slice(0, 30)),
        )
    return ids.slice(0, 30)
  }

  function updateStoryList(ids: number[]) {
    sessions.forEach(session => {
      let url = session.url
      if (url && options.url) {
        let context = sessionToContext(session, url)
        let element = nodeToVNode(renderStoryList(ids), context)
        let message: ServerMessage = ['update', element]
        session.ws.send(message)
      }
    })
  }

  function updateStory(story: StoryDTO) {
    sessions.forEach(session => {
      let url = session.url
      if (url && options.url) {
        let context = sessionToContext(session, url)
        let element = renderListItem(story, url)
        let message: ServerMessage = ['update', nodeToVNode(element, context)]
        session.ws.send(message)
      }
    })
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
              <li>
                <StoryOverviewById id={id} />
              </li>
            </>
          ))}
        </ol>,
      ],
    ]
  }

  function renderListItem(story: StoryDTO, currentUrl: string) {
    return story.title ? (
      <StoryOverview story={story} />
    ) : (
      <StoryDetail.StoryItem
        item={story}
        indent={0}
        nextId={undefined}
        parentIds={new Set()}
        topLevel
        skipChildren
        currentUrl={currentUrl}
      />
    )
  }

  function StoryOverviewById(attrs: { id: number }) {
    let story = getStoryById(attrs.id, story => updateStory(story))
    return renderListItem(story, options.url)
  }

  return StoryList
}

export default {
  HomeStories: genStoryList({
    id: 'news',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    url: '/',
  }),
  TopStories: genStoryList({
    id: 'news',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    url: '/news',
  }),
  NewStories: genStoryList({
    id: 'newest',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/newstories.json',
    url: '/newest',
  }),
  BestStories: genStoryList({
    id: 'front',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/beststories.json',
    url: '/front',
  }),
  Comments: genStoryList({
    id: 'newcomments',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/updates.json',
    apiMapFn: (data: UpdatesDTO) => data.items,
    url: '/newcomments',
  }),
  AskStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/askstories.json',
    url: '/ask',
  }),
  ShowStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/showstories.json',
    url: '/show',
  }),
  JobStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/jobstories.json',
    url: '/job',
  }),
  Submitted: genStoryList({
    id: 'submitted',
    apiUrl: 'user.submitted',
    url: '/submitted',
  }),
}
