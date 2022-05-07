import JSX from './jsx/jsx.js'
import type { index } from '../../template/index.html'
import { loadTemplate } from '../template.js'
import express from 'express'
import type { ExpressContext, WsContext } from './context.js'
import type { Element } from './jsx/types'
import { nodeToHTML, writeNode } from './jsx/html.js'
import { sendHTMLHeader } from './express.js'
import { Redirect, Switch } from './components/router.js'
import { OnWsMessage } from '../ws/wss.js'
import { dispatchUpdate } from './jsx/dispatch.js'
import { EarlyTerminate } from './helpers.js'
import { getWSSession } from './session.js'
import { capitalize } from './string.js'
import NotMatch from './pages/not-match.js'
import Home from './pages/home.js'
import About, { License } from './pages/about.js'
import Thermostat from './pages/thermostat.js'
import Editor from './pages/editor.js'
import AutoCompleteDemo from './pages/auto-complete-demo.js'
import DemoForm from './pages/demo-form.js'
import DemoCookieSession from './pages/demo-cookie-session.js'
import Chatroom from './pages/chatroom.js'
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
import News from './pages/news.js'
import NotImplemented from './pages/not-implemented.js'
import Story from './pages/story.js'

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
        <a href="/">
          <img
            src="https://news.ycombinator.com/y18.gif"
            style="border:1px white solid;"
            width="18"
            height="18"
          />
        </a>
        <span class="pagetop">
          {' '}
          <b class="hnname">
            <a href="/news">Hacker News</a>
          </b>{' '}
          <a href="/newest">new</a>
          {' | '}
          <a href="/front">past</a>
          {' | '}
          <a href="/newcomments">comments</a>
          {' | '}
          <a href="/ask">ask</a>
          {' | '}
          <a href="/show">show</a>
          {' | '}
          <a href="/jobs">jobs</a>
          {' | '}
          <a href="https://news.ycombinator.com/submit">submit</a>
        </span>
      </header>
      {scripts}
      <Flush />
      <main>
        {Switch(
          {
            '/': <News />,
            '/news': <News />,
            '/item': <Story />,
            '/newest': <NotImplemented />,
            '/font': <NotImplemented />,
            '/newcomments': <NotImplemented />,
            '/ask': <NotImplemented />,
            '/show': <NotImplemented />,
            '/jobs': <NotImplemented />,
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
  let locale: string | undefined
  let timeZone: string | undefined
  if (event[0] === 'mount') {
    eventType = 'mount'
    url = event[1]
    locale = event[2]
    timeZone = event[3]
  } else if (event[0][0] === '/') {
    eventType = 'route'
    url = event[0]
    args = event.slice(1)
  } else {
    console.log('unknown type of ws message:', event)
    return
  }
  let context: WsContext = {
    type: 'ws',
    ws,
    wss,
    url,
    args,
    event: eventType,
  }
  let session = getWSSession(ws)
  session.url = url
  if (locale) {
    session.locales = locale
  }
  if (timeZone) {
    session.timeZone = timeZone
  }
  dispatchUpdate(AppAST, context)
}
