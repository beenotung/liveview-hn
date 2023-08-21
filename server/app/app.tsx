import { o } from './jsx/jsx.js'
import { scanTemplateDir } from '../template.js'
import { NextFunction, Request, Response, Router } from 'express'
import type { Context, ExpressContext, WsContext } from './context'
import type { Component, Element, Node } from './jsx/types'
import {
  escapeHTMLAttributeValue,
  escapeHTMLTextContent,
  unquote,
  writeNode,
} from './jsx/html.js'
import { sendHTMLHeader } from './express.js'
import { Link } from './components/router.js'
import { OnWsMessage } from '../ws/wss.js'
import { dispatchUpdate } from './jsx/dispatch.js'
import { EarlyTerminate } from './helpers.js'
import { getWSSession } from './session.js'
import { Flush } from './components/flush.js'
import { config } from '../config.js'
import Style from './components/style.js'
import Stats from './stats.js'
import { MuteConsole } from './components/script.js'
import { readFileSync } from 'fs'
import { join } from 'path'
import { matchRoute, PageRouteMatch, redirectDict } from './routes.js'
import type { ClientMountMessage, ClientRouteMessage } from '../../client/types'
import { then } from '@beenotung/tslib/result.js'
import { renderIndexTemplate } from '../../template/index.js'
import type { HTMLStream } from './jsx/stream'
import { getWsCookies } from './cookie.js'

if (config.development) {
  scanTemplateDir('template')
}
function renderTemplate(
  stream: HTMLStream,
  context: Context,
  options: { title: string; description: string; app: Node },
) {
  const app = options.app
  renderIndexTemplate(stream, {
    title: escapeHTMLTextContent(options.title),
    description: unquote(escapeHTMLAttributeValue(options.description)),
    app:
      typeof app == 'string' ? app : stream => writeNode(stream, app, context),
  })
}

let scripts = config.development ? (
  <script src="/js/index.js" type="module" defer></script>
) : (
  <>
    {MuteConsole}
    <script src="/js/bundle.min.js" type="module" defer></script>
  </>
)

let style = Style(readFileSync(join('template', 'style.css')).toString())

function Menu(_attrs: {}, context: Context) {
  let url = context.type === 'static' ? '?' : context.url
  const link = (href: string, text: string): Component<{ href: string }> => [
    Link,
    url === href ? { href, class: 'topsel' } : { href },
    [text],
  ]
  return (
    <span class="pagetop">
      {' '}
      <b class="hnname">{link('/news', 'Hacker News')}</b>{' '}
      {link('/newest', 'new')}
      {' | '}
      {link('/front', 'past')}
      {' | '}
      {link('/newcomments', 'comments')}
      {' | '}
      {link('/ask', 'ask')}
      {' | '}
      {link('/show', 'show')}
      {' | '}
      {link('/jobs', 'jobs')}
      {' | '}
      <a href="https://news.ycombinator.com/submit" target="_blank">
        submit
      </a>
    </span>
  )
}

let header = (
  <header>
    <Link href="/">
      <img
        src="https://news.ycombinator.com/y18.gif"
        style="border:1px white solid;"
        width="18"
        height="18"
      />
    </Link>
    <Menu />
  </header>
)

export function App(route: PageRouteMatch): Element {
  // you can write the AST direct for more compact wire-format
  return [
    'div.app',
    {},
    [
      // or you can write in JSX for better developer-experience (if you're coming from React)
      <>
        {style}
        {header}
        {scripts}
        <Flush />
        <main>{route.node}</main>
        <Flush />
        <footer>
          <span class="yclinks">
            <Link href="/user-agents">Visitors</Link>
            {' | '}
            <Link href="/guidelines">Guidelines</Link>
            {' | '}
            <Link href="/faq">FAQ</Link>
            {' | '}
            <Link href="/lists">Lists</Link>
            {' | '}
            <a href="https://github.com/HackerNews/API">API</a>
            {' | '}
            <a href="https://github.com/beenotung/liveview-hn">Repo</a>
            {' | '}
            Powered by{' '}
            <a href="https://github.com/beenotung/ts-liveview">ts-liveview</a>
          </span>
          <div>
            <Stats />
          </div>
        </footer>
      </>,
    ],
  ]
}

// prefer flat router over nested router for less overhead
export function attachRoutes(app: Router) {
  // ajax/middleware routes
  // DemoUpload.attachRoutes(app)

  // redirect routes
  Object.entries(redirectDict).forEach(([from, to]) =>
    app.use(from, (_req, res) => res.redirect(to)),
  )

  // liveview routes
  app.use(handleLiveView)
}

function handleLiveView(req: Request, res: Response, next: NextFunction) {
  sendHTMLHeader(res)

  let context: ExpressContext = {
    type: 'express',
    req,
    res,
    next,
    url: req.url,
  }

  then(matchRoute(context), route => {
    if (route.status) {
      res.status(route.status)
    }

    route.description = route.description.replace(/"/g, "'")

    if (route.streaming === false) {
      responseHTML(res, context, route)
    } else {
      streamHTML(res, context, route)
    }
  })
}

function responseHTML(
  res: Response,
  context: ExpressContext,
  route: PageRouteMatch,
) {
  let html = ''
  let stream = {
    write(chunk: string) {
      html += chunk
    },
    flush() {},
  }

  try {
    renderTemplate(stream, context, {
      title: route.title || config.site_name,
      description: route.description || config.site_description,
      app: App(route),
    })
  } catch (error) {
    if (error === EarlyTerminate) {
      return
    }
    console.error('Failed to render App:', error)
    if (!res.headersSent) {
      res.status(500)
    }
    html +=
      error instanceof Error
        ? 'Internal Error: ' + escapeHTMLTextContent(error.message)
        : 'Unknown Error: ' + escapeHTMLTextContent(String(error))
  }

  // deepcode ignore XSS: the dynamic content is html-escaped
  res.end(html)
}

function streamHTML(
  res: Response,
  context: ExpressContext,
  route: PageRouteMatch,
) {
  try {
    renderTemplate(res, context, {
      title: route.title || config.site_name,
      description: route.description || config.site_description,
      app: App(route),
    })
    res.end()
  } catch (error) {
    if (error === EarlyTerminate) {
      return
    }
    console.error('Failed to render App:', error)
    if (!res.headersSent) {
      res.status(500)
    }
    // deepcode ignore XSS: the dynamic content is html-escaped
    res.end(
      error instanceof Error
        ? 'Internal Error: ' + escapeHTMLTextContent(error.message)
        : 'Unknown Error: ' + escapeHTMLTextContent(String(error)),
    )
  }
}

export let onWsMessage: OnWsMessage = (event, ws, _wss) => {
  console.log('ws message:', event)
  // TODO handle case where event[0] is not url
  let eventType: string | undefined
  let url: string
  let args: unknown[] | undefined
  let session = getWSSession(ws)
  if (event[0] === 'mount') {
    event = event as ClientMountMessage
    eventType = 'mount'
    url = event[1]
    session.language = event[2]
    let timeZone = event[3]
    if (timeZone && timeZone !== 'null') {
      session.timeZone = timeZone
    }
    session.timezoneOffset = event[4]
    let cookie = event[5]
    if (cookie) {
      getWsCookies(ws.ws).unsignedCookies = Object.fromEntries(
        new URLSearchParams(
          cookie
            .split(';')
            .map(s => s.trim())
            .join('&'),
        ),
      )
    }
  } else if (event[0][0] === '/') {
    event = event as ClientRouteMessage
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
  then(matchRoute(context), route => {
    let node = App(route)
    dispatchUpdate(context, node, route.title)
  })
}
