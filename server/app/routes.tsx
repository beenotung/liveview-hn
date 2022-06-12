import { capitalize } from '@beenotung/tslib/string.js'
import { Router } from 'url-router.ts'
import { config } from '../config.js'
import { Redirect } from './components/router.js'
import type {
  DynamicContext,
  ExpressContext,
  RouterContext,
  WsContext,
} from './context.js'
import JSX from './jsx/jsx.js'
import type { Node } from './jsx/types'
import UserAgents from './pages/user-agents.js'
import NotMatch from './pages/not-match.js'
import StoryList from './pages/story-list.js'
import StoryDetail from './pages/story-detail.js'
import Profile from './pages/profile.js'
import NotImplemented from './pages/not-implemented.js'

let titles: Record<string, string> = {}

export function getTitle(url: string): string {
  let title = titles[url] || capitalize(url.split('/')[1] || 'Home Page')
  return title
}

const StreamingByDefault = true

export type PageRoute = PageRouteOptions & (StaticPageRoute | DynamicPageRoute)

export type PageRouteOptions = {
  // streaming is enabled by default
  // HTTP headers cannot be set when streaming
  // If you need to set cookies or apply redirection, you may use an express middleware before the generic app route
  streaming?: boolean
} & Partial<MenuRoute>

export type StaticPageRoute = {
  title: string
  node: Node
  description: string
  status?: number
}
export type DynamicPageRoute = {
  resolve: (context: DynamicContext) => StaticPageRoute
}

export type MenuRoute = {
  url: string
  menuText: string
  menuUrl: string // optional, default to be same as PageRoute.url
}

export type PageRouteMatch = PageRouteOptions & StaticPageRoute

export function title(page: string) {
  return page + ' | ' + config.site_name
}

// jsx node can be used directly, e.g. `Home`
// invoke functional component with square bracket, e.g. `[Editor]`
// or invoke functional component with x-html tag, e.g. `<Editor/>

// TODO direct support alternative urls instead of having to repeat the entry
let routeDict: Record<string, PageRoute> = {
  '/': {
    title: config.site_name,
    description: config.site_description,
    node: <StoryList.TopStories />,
  },
  '/news': {
    title: title('Top Stories'),
    description: 'Trending stories on Hacker News',
    node: <StoryList.TopStories />,
  },
  '/item': {
    title: title('Story Detail'),
    description: 'Story detail of Hacker News',
    node: <StoryDetail />,
  },
  '/user': {
    resolve: Profile.resolve,
  },
  '/submitted': {
    title: title("User's submissions"),
    description: 'Hacker News stories submitted by user',
    node: <StoryList.Submitted />,
  },
  '/newest': {
    title: title('Recent Stories'),
    description: 'Recent stories on Hacker News',
    node: <StoryList.NewStories />,
  },
  '/front': {
    title: title('Front Page Stories'),
    description: 'Hacker News stories that were listed in the front page',
    node: <StoryList.BestStories />,
  },
  '/newcomments': {
    title: title('New Comments'),
    description: 'Latest Comments on recent Hacker News stories',
    node: <StoryList.Comments />,
  },
  '/ask': {
    title: title('Ask HN'),
    description:
      'User submitted questions asking for discussion among Hacker News community',
    node: <StoryList.AskStories />,
  },
  '/show': {
    title: title('Show HN Stories'),
    description:
      "Show HN is for something you've made that other people can play with. HN users can try it out, give you feedback, and ask questions in the thread.",
    node: <StoryList.ShowStories />,
  },
  '/jobs': {
    title: title('Jobs'),
    description: 'Jobs at YCombinator startups',
    node: <StoryList.JobStories />,
  },
  '/guidelines': {
    title: title('Guidelines'),
    description: `Anything that good hackers would find interesting. That includes more than hacking and startups. In a sentence: anything that gratifies one's intellectual curiosity.`,
    node: NotImplemented,
    status: 501,
  },
  '/faq': {
    title: title('FAQ'),
    description: 'Hacker News FAQ',
    node: NotImplemented,
    status: 501,
  },
  '/lists': {
    title: title('Lists'),
    description:
      'Varies list of Hacker News stories ordered by different criteria',
    node: NotImplemented,
    status: 501,
  },
  '/user-agents': {
    title: 'User Agents of Visitors',
    description: "User agents of this site's visitors",
    menuText: 'User Agents',
    node: UserAgents,
  },
}

export let redirectDict: Record<string, string> = {
  '/server/app/app.tsx': '/about/markdown',
}

export const pageRouter = new Router<PageRoute>()

export const menuRoutes: MenuRoute[] = []

Object.entries(routeDict).forEach(([url, route]) => {
  pageRouter.add(url, { url, ...route })
  if (route.menuText) {
    menuRoutes.push({
      url,
      menuText: route.menuText,
      menuUrl: route.menuUrl || url,
    })
  }
})

Object.entries(redirectDict).forEach(([url, href]) =>
  pageRouter.add(url, {
    url,
    title: title('Redirection Page'),
    description: 'Redirect to ' + url,
    node: <Redirect href={href} />,
  }),
)

export function matchRoute(context: DynamicContext): PageRouteMatch {
  let match = pageRouter.route(context.url)
  let route: PageRoute = match
    ? match.value
    : {
        title: title('Page Not Found'),
        description: 'This page is not found. Probably due to outdated menu.',
        node: NotMatch,
        status: 404,
      }
  if (route.streaming === undefined) {
    route.streaming = StreamingByDefault
  }
  context.routerMatch = match
  if ('resolve' in route) {
    return Object.assign(route, route.resolve(context))
  }
  return route
}

export function getContextSearchParams(context: DynamicContext) {
  return new URLSearchParams(
    context.routerMatch?.search || context.url.split('?').pop(),
  )
}
