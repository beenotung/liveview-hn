import type { ServerMessage } from '../../../client/types'
import {
  getStoryList,
  getStoryListFromIds,
  getUserSubmissions,
  ProfileDTO,
  StoryDTO,
} from '../../hn-api'
import { Flush } from '../components/flush.js'
import { mapArray } from '../components/fragment.js'
import StoryOverview from '../components/story-overview.js'
import Style from '../components/style.js'
import type { Context, DynamicContext } from '../context'
import { o } from '../jsx/jsx.js'
import { Element, Node } from '../jsx/types.js'
import { nodeToVNode } from '../jsx/vnode.js'
import StoryDetail from './story-detail.js'
import { sessions, sessionToContext } from '../session.js'
import { Result, then } from '@beenotung/tslib/result.js'
import { getContextSearchParams, StaticPageRoute } from '../routes.js'
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
  getStoryList?: () => Result<StoryDTO[] | void>
  apiUrl: string
  url: string
  title: string
  description: string
}) {
  function updateStoryList(stories: StoryDTO[]) {
    sessions.forEach(session => {
      let url = session.url
      if (url && options.url) {
        let context = sessionToContext(session, url)
        let element = nodeToVNode(renderRoute(renderStories(stories)), context)
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

  function renderRoute(child: Node): Element {
    return [
      `#${options.id}.story-list`,
      {},
      [style, StoryOverview.style, StoryDetail.style, child],
    ]
  }

  function renderStories(stories: StoryDTO[]) {
    return (
      <ol>
        {mapArray(stories, story => (
          <>
            <Flush />
            <li>{renderListItem(story, options.url)}</li>
          </>
        ))}
      </ol>
    )
  }

  function renderListItem(story: StoryDTO, currentUrl: string) {
    return story.title ? (
      <StoryOverview id={story.id} story={story} />
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

  function resolve(
    context: Context,
  ): StaticPageRoute | Promise<StaticPageRoute> {
    let user_id = +options.apiUrl.replace(Submitted.apiPrefix, '')
    return then(
      user_id
        ? getUserSubmissions(user_id, updateProfile, updateStory)
        : getStoryList(options.apiUrl, updateStoryList, updateStory),
      async (stories): Promise<StaticPageRoute> => {
        if (!stories) {
          return {
            title: options.title,
            description: options.description,
            node: renderRoute(
              <p>Failed to load story list, please try again later.</p>,
            ),
          }
        }
        return {
          title: options.title,
          description: options.description,
          node: renderRoute(renderStories(stories)),
        }
      },
    )
  }

  // deepcode ignore JavascriptDeadCode: This is not dead code
  return { resolve, updateStoryList, updateStory }
}

function updateProfile(profile: ProfileDTO) {
  if (!profile.submitted) return
  let route = Submitted.getRoute(profile.id)
  then(
    getStoryListFromIds(profile.submitted, route.updateStory),
    route.updateStoryList,
  )
}

namespace Submitted {
  let pool = new Map<string, ReturnType<typeof genStoryList>>()

  export let apiPrefix = 'user.submitted:'

  export function toUrl(id: string) {
    return `/submitted?id=${id}`
  }

  export function getRoute(id: string) {
    let route = pool.get(id)
    if (!route) {
      route = genStoryList({
        id: 'submitted',
        apiUrl: apiPrefix + id,
        url: toUrl(id),
        title: title(`${id}'s submissions`),
        description: `Hacker News stories submitted by ${id}`,
      })
      pool.set(id, route)
    }
    return route
  }

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
    let rotue = getRoute(id)
    return rotue.resolve(context)
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
    id: 'show',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/showstories.json',
    url: '/show',
    title: title('Show HN Stories'),
    description:
      "Show HN is for something you've made that other people can play with. HN users can try it out, give you feedback, and ask questions in the thread.",
  }),
  JobStories: genStoryList({
    id: 'job',
    apiUrl: 'https://hacker-news.firebaseio.com/v0/jobstories.json',
    url: '/job',
    title: title('Jobs'),
    description: 'Jobs at YCombinator startups',
  }),
  Submitted,
}
