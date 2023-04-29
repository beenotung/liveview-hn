import type { ServerMessage } from '../../../client/types'
import {
  get,
  getProfile,
  getStoryById,
  getWithMapFn,
  preloadStoryList,
  preloadSubmitted,
  StoryDTO,
  UpdatesDTO,
} from '../../api.js'
import { Flush } from '../components/flush.js'
import { mapArray } from '../components/fragment.js'
import StoryOverview from '../components/story-overview.js'
import Style from '../components/style.js'
import type { Context, DynamicContext } from '../context'
import { o } from '../jsx/jsx.js'
import { Element } from '../jsx/types.js'
import { nodeToVNode } from '../jsx/vnode.js'
import StoryDetail from './story-detail.js'
import { sessions, sessionToContext } from '../session.js'
import { then } from '@beenotung/tslib/result.js'
import {
  DynamicPageRoute,
  getContextSearchParams,
  StaticPageRoute,
} from '../routes.js'
import { config, title } from '../../config.js'

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
  title: string
  description: string
  preload?: () => unknown | Promise<unknown>
}): DynamicPageRoute {
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

  function StoryList(_attrs: {}, context: Context): Element {
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

  function resolve(
    context: Context,
  ): StaticPageRoute | Promise<StaticPageRoute> {
    let preload = options.preload
      ? options.preload()
      : preloadStoryList(options.apiUrl, options.apiMapFn)
    let route: StaticPageRoute = {
      title: options.title,
      description: options.description,
      node: <StoryList />,
    }
    return then(preload, () => route)
  }

  // deepcode ignore JavascriptDeadCode: This is not dead code
  return { resolve }
}

namespace Submitted {
  let pool = new Map<string, ReturnType<typeof genStoryList>>()

  export function resolve(
    context: DynamicContext,
  ): StaticPageRoute | Promise<StaticPageRoute> {
    let params = getContextSearchParams(context)
    const id = params.get('id')
    if (!id) {
      return {
        title: title('Bad Request: Missing user id'),
        description: 'Unknown user submission list',
        node: <p>Error: Missing id in request query</p>,
      }
    }
    let StoryList = pool.get(id)
    if (!StoryList) {
      let url = `/submitted?id=${id}`
      StoryList = genStoryList({
        id: 'submitted',
        apiUrl: 'user.submitted',
        url,
        title: title(`${id}'s submissions`),
        description: `Hacker News stories submitted by ${id}`,
        preload: () => preloadSubmitted(id),
      })
      pool.set(id, StoryList)
    }
    return StoryList.resolve(context)
  }
}

export default {
  HomeStories: genStoryList({
    id: 'news',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    url: '/',
    title: config.site_name,
    description: config.site_description,
  }),
  TopStories: genStoryList({
    id: 'news',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    url: '/news',
    title: title('Top Stories'),
    description: 'Trending stories on Hacker News',
  }),
  NewStories: genStoryList({
    id: 'newest',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/newstories.json',
    url: '/newest',
    title: title('Recent Stories'),
    description: 'Recent stories on Hacker News',
  }),
  BestStories: genStoryList({
    id: 'front',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/beststories.json',
    url: '/front',
    title: title('Front Page Stories'),
    description: 'Hacker News stories that were listed in the front page',
  }),
  Comments: genStoryList({
    id: 'newcomments',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/updates.json',
    apiMapFn: (data: UpdatesDTO) => data.items,
    url: '/newcomments',
    title: title('New Comments'),
    description: 'Latest Comments on recent Hacker News stories',
  }),
  AskStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/askstories.json',
    url: '/ask',
    title: title('Ask HN'),
    description:
      'User submitted questions asking for discussion among Hacker News community',
  }),
  ShowStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/showstories.json',
    url: '/show',
    title: title('Show HN Stories'),
    description:
      "Show HN is for something you've made that other people can play with. HN users can try it out, give you feedback, and ask questions in the thread.",
  }),
  JobStories: genStoryList({
    id: 'ask',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/jobstories.json',
    url: '/job',
    title: title('Jobs'),
    description: 'Jobs at YCombinator startups',
  }),
  Submitted,
}
