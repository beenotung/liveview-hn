import JSX from './jsx/jsx.js'
import type { index } from '../../template/index.html'
import { loadTemplate } from '../template.js'
import express from 'express'
import type { ExpressContext, WsContext } from './context.js'
import type { Element } from './jsx/types'
import { nodeToHTML, writeNode } from './jsx/html.js'
import { sendHTMLHeader } from './express.js'
import { Link, Redirect, Switch } from './components/router.js'
import { OnWsMessage } from '../ws/wss.js'
import { dispatchUpdate } from './jsx/dispatch.js'
import { EarlyTerminate } from './helpers.js'
import { getWSSession } from './session.js'
import { capitalize } from './string.js'
import NotMatch from './pages/not-match.js'
import About, { License } from './pages/about.js'
import DemoCookieSession from './pages/demo-cookie-session.js'
import { Menu } from './components/menu.js'
import type { ClientMessage } from '../../client/index'
import escapeHtml from 'escape-html'
import { Flush } from './components/flush.js'
import { config } from '../config.js'
import Style from './components/style.js'
import Stats from './stats.js'
import { MuteConsole } from './components/script.js'
import { readFileSync } from 'fs'
import { join } from 'path'
import NotImplemented from './pages/not-implemented.js'
import StoryDetail from './pages/story-detail.js'
import StoryList from './pages/story-list.js'
import Profile from './pages/profile.js'

let template = loadTemplate<index>('index')

let scripts = config.development ? (
  <script src="/js/index.js" type="module" defer></script>
) : (
  <>
    <MuteConsole />
    <script src="/js/bundle.min.js" type="module" defer></script>
  </>
)

let AppAST: Element = [
  'div.app',
  {},
  [
    <>
      {Style(readFileSync(join('template', 'style.css')).toString())}
      <header>
        <Link href="/">
          <img
            src="https://news.ycombinator.com/y18.gif"
            style="border:1px white solid;"
            width="18"
            height="18"
          />
        </Link>
        <span class="pagetop">
          {' '}
          <b class="hnname">
            <Link href="/news">Hacker News</Link>
          </b>{' '}
          <Link href="/newest">new</Link>
          {' | '}
          <Link href="/front">past</Link>
          {' | '}
          <Link href="/newcomments">comments</Link>
          {' | '}
          <Link href="/ask">ask</Link>
          {' | '}
          <Link href="/show">show</Link>
          {' | '}
          <Link href="/jobs">jobs</Link>
          {' | '}
          <a href="https://news.ycombinator.com/submit">submit</a>
        </span>
      </header>
      {scripts}
      <Flush />
      <main>
        {Switch(
          {
            '/': <StoryList.TopStories />,
            '/news': <StoryList.TopStories />,
            '/item': <StoryDetail />,
            '/user': <Profile />,
            '/submitted': <StoryList.Submitted />,
            '/newest': <StoryList.NewStories />,
            '/front': <StoryList.BestStories />,
            '/newcomments': <StoryList.Comments />,
            '/ask': <StoryList.AskStories />,
            '/show': <StoryList.ShowStories />,
            '/jobs': <StoryList.JobStories />,
            '/guidelines': <NotImplemented />,
            '/faq': <NotImplemented />,
            '/lists': <NotImplemented />,
          },
          <NotMatch />,
        )}
      </main>
      <Flush />
      <footer>
        <span class="yclinks">
          <a href="/guidelines">Guidelines</a>
          {' | '}
          <a href="/faq">FAQ</a>
          {' | '}
          <a href="/lists">Lists</a>
          {' | '}
          <a href="https://github.com/HackerNews/API">API</a>
          {' | '}
          <a href="https://github.com/beenotung/liveview-hn">Repo</a>
          {' | '}
          Powered by{' '}
          <a href="https://github.com/beenotung/ts-liveview">ts-liveview</a>
        </span>
      </footer>
    </>,
  ],
]

export let appRouter = express.Router()

// non-streaming routes
appRouter.use('/cookie-session/token', (req, res, next) => {
  try {
    let context: ExpressContext = {
      type: 'express',
      req,
      res,
      next,
      url: req.url,
    }
    let html = nodeToHTML(<DemoCookieSession.Token />, context)
    res.end(html)
  } catch (error) {
    if (error === EarlyTerminate) {
      return
    }
    res.status(500).end(String(error))
  }
})

// html-streaming routes
appRouter.use((req, res, next) => {
  sendHTMLHeader(res)

  let page = capitalize(req.url.split('/')[1] || 'Home Page')
  let description = 'Demo website of ts-liveview'
  let appPlaceholder = '<!-- app -->'
  let html = template({
    title: `${page} - LiveView Demo`,
    description,
    app: appPlaceholder,
  })
  let idx = html.indexOf(appPlaceholder)

  let beforeApp = html.slice(0, idx)
  res.write(beforeApp)
  res.flush()

  let afterApp = html.slice(idx + appPlaceholder.length)

  let context: ExpressContext = {
    type: 'express',
    req,
    res,
    next,
    url: req.url,
  }
  try {
    // send the html chunks in streaming
    writeNode(res, AppAST, context)
  } catch (error) {
    if (error === EarlyTerminate) {
      return
    }
    console.error('Failed to render App:', error)
    res.status(500)
    if (error instanceof Error) {
      res.write('Internal Error: ' + escapeHtml(error.message))
    } else {
      res.write('Unknown Error: ' + escapeHtml(String(error)))
    }
  }

  res.write(afterApp)

  if ('skip streaming test') {
    res.end()
    return
  }
  testStreaming(res)
})

function testStreaming(res: express.Response) {
  let i = 0
  let timer = setInterval(() => {
    i++
    res.write(i + '\n')
    res.flush()
    if (i > 5) {
      clearInterval(timer)
      res.end()
    }
  }, 1000)
}

export let onWsMessage: OnWsMessage<ClientMessage> = (event, ws, wss) => {
  console.log('ws message:', event)
  // TODO handle case where event[0] is not url
  let eventType: string | undefined
  let url: string
  let args: any[] | undefined
  let session = getWSSession(ws)
  if (event[0] === 'mount') {
    eventType = 'mount'
    url = event[1]
    session.locales = event[2]
    session.timeZone = event[3]
    session.timezoneOffset = event[4]
  } else if (event[0][0] === '/') {
    eventType = 'route'
    url = event[0]
    args = event.slice(1)
  } else {
    console.log('unknown type of ws message:', event)
    return
  }
  session.url = url
  let context: WsContext = {
    type: 'ws',
    ws,
    url,
    args,
    event: eventType,
    session,
  }
  dispatchUpdate(AppAST, context)
}
