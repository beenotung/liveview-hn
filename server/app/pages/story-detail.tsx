import { getStoryById, StoryDTO } from '../../hn-api.js'
import DateTimeText, { toLocaleDateTimeString } from '../components/datetime.js'
import { mapArray } from '../components/fragment.js'
import type { Context, DynamicContext } from '../context'
import { o } from '../jsx/jsx.js'
import { Element, NodeList } from '../jsx/types.js'
import StoryOverview from '../components/story-overview.js'
import { YEAR } from '@beenotung/tslib/time.js'
import { Flush } from '../components/flush.js'
import Style from '../components/style.js'
import { nodeToVNode } from '../jsx/vnode.js'
import { Raw } from '../components/raw.js'
import { Link } from '../components/router.js'
import { sessions, sessionToContext } from '../session.js'
import type { ServerMessage } from '../../../client/types'
import { getContextSearchParams, StaticPageRoute } from '../routes.js'
import { then } from '@beenotung/tslib/result.js'
import { title } from '../../config.js'

function updateStoryDetail(story: StoryDTO, currentUrl: string) {
  sessions.forEach(session => {
    if (session.url === currentUrl) {
      let context = sessionToContext(session, currentUrl)
      let element = nodeToVNode(renderStoryDetail(story, currentUrl), context)
      session.ws.send(['update', element])
    }
  })
}

function updateStoryItem(options: {
  story: StoryDTO
  indent: number
  context: Context
  nextId: number | undefined
  parentIds: Set<number>
}) {
  let context = options.context
  if (context.type === 'static') return
  let currentUrl = context.url
  sessions.forEach(session => {
    if (session.url === currentUrl) {
      let context = sessionToContext(session, currentUrl)
      let element = nodeToVNode(
        <StoryItem item={options.story} {...options} currentUrl={currentUrl} />,
        context,
      )
      let message: ServerMessage = ['update', element]
      session.ws.send(message)
    }
  })
}

let style = Style(/* css */ `
.story-item {
  font-size: 1rem;
  outline: 1px solid #333;
  padding-inline-start: 0.5rem;
}
.story-item .story-by::after {
  content: " | ";
}
`)

function renderStoryDetailError(id: number): Element {
  return [
    `div#story-detail`,
    {},
    [
      <>
        <p>
          Failed to load story detail at the moment, please try again later.
        </p>
        <div aria-hidden="true">
          [Debug Info]
          <p>
            Loading url:{' '}
            <a
              href={`https://hacker-news.firebaseio.com/v0/item/${id}.json`}
              target="_blank"
              rel="nofollow"
            ></a>
          </p>
          <p>
            Source url:{' '}
            <a
              href={`https://news.ycombinator.com/item?id=${id}`}
              target="_blank"
              rel="nofollow"
            ></a>
          </p>
        </div>
      </>,
    ],
  ]
}

function renderStoryDetail(story: StoryDTO, currentUrl: string): Element {
  return [
    `div#story-detail`,
    {},
    [
      StoryOverview.style,
      style,
      story.deleted ? (
        <p>[deleted]</p>
      ) : story.title ? (
        renderStoryDetailWithTitle(story, currentUrl)
      ) : story.text ? (
        <StoryItem
          item={story}
          indent={0}
          nextId={undefined}
          parentIds={new Set([story.id])}
          topLevel
          currentUrl={currentUrl}
        />
      ) : (
        <p>{JSON.stringify(story)}</p>
      ),
    ],
  ]
}

function renderStoryDetailWithTitle(story: StoryDTO, currentUrl: string) {
  let nodes = [<StoryOverview id={story.id} story={story} />]
  story.kids?.forEach((id, i, ids) => {
    nodes.push(
      <Flush />,
      <StoryItemById
        id={id}
        indent={0}
        nextId={ids[i + 1]}
        parentIds={new Set([story.id])}
        rootId={story.id}
        currentUrl={currentUrl}
      />,
    )
  })
  return [nodes]
}

function StoryItemById(
  attrs: {
    id: number
    indent: number
    nextId: number | undefined
    parentIds: Set<number>
    rootId?: number
    currentUrl: string
  },
  context: Context,
): Element {
  let { id } = attrs
  let item = getStoryById(id, story =>
    updateStoryItem({
      story,
      context,
      ...attrs,
    }),
  )
  if (!item)
    return renderStoryItem({
      id,
      indent: attrs.indent,
      children: [
        `Failed to load story #${id} at the moment, please try again later`,
      ],
    })
  if (item instanceof Promise)
    return renderStoryItem({
      id,
      indent: attrs.indent,
      children: [`loading story #${id}`],
    })
  return <StoryItem item={item} {...attrs} />
}

function updateRootStory(attrs: StoryItemAttrs) {
  sessions.forEach(session => {
    let { currentUrl } = attrs
    if (session.url === currentUrl) {
      let context = sessionToContext(session, currentUrl)
      let element = nodeToVNode(<StoryItem {...attrs} />, context)
      let message: ServerMessage = ['update', element]
      session.ws.send(message)
    }
  })
}

function getRootStory(
  id: number,
  attrs: StoryItemAttrs,
): { id: number; title: string } {
  for (;;) {
    let story = getStoryById(id, story => updateRootStory(attrs))
    if (story && !(story instanceof Promise)) {
      if (story.title) {
        return story
      }
      if (story.parent) {
        id = story.parent
        continue
      }
    }
    return { id, title: '#' + id }
  }
}

function renderStoryItem(attrs: {
  id: number
  indent: number
  children: NodeList
}): Element {
  return [`div#item-${attrs.id}`, { style: `margin-left: 3ch` }, attrs.children]
}

type StoryItemAttrs = {
  item: // | { id: number; type: 'error' }
  // | { id: number; type: 'loading' }
  // |
  StoryDTO
  indent: number
  nextId: number | undefined
  parentIds: Set<number>
  topLevel?: boolean
  skipChildren?: boolean
  rootId?: number
  currentUrl: string
}
function StoryItem(attrs: StoryItemAttrs, context: Context): Element {
  let item = attrs.item
  let time = item.time * 1000
  attrs.parentIds.add(item.id)
  let rootStory = getRootStory(attrs.rootId || item.id, attrs)
  return renderStoryItem({
    id: item.id,
    indent: attrs.indent,
    children: [
      <div class="story-item">
        <div class="story-meta">
          {item.by ? (
            <span class="story-by">
              <Link href={'/user?id=' + item.by}>{item.by}</Link>
            </span>
          ) : null}
          {time ? (
            <>
              <Link href={'/item?id=' + item.id}>
                <time
                  class="story-time"
                  datetime={new Date(time).toISOString()}
                  title={toLocaleDateTimeString(time, context)}
                >
                  <DateTimeText time={time} relativeTimeThreshold={YEAR} />
                </time>
              </Link>
            </>
          ) : null}
          {attrs.indent >= 2 && item.parent ? (
            <>
              {' | '}
              {!attrs.parentIds.has(item.parent) ? (
                <Link href={'/item?id=' + rootStory.id}>root</Link>
              ) : (
                <a href={'#' + rootStory.id}>root</a>
              )}
            </>
          ) : null}
          {item.parent ? (
            <>
              {' | '}
              {attrs.topLevel || !attrs.parentIds.has(item.parent) ? (
                <Link href={'/item?id=' + item.parent}>
                  {attrs.topLevel ? 'on: ' + rootStory.title : 'parent'}
                </Link>
              ) : (
                <a href={'#' + item.parent}>parent</a>
              )}
            </>
          ) : null}
          {attrs.nextId ? (
            <>
              {' | '}
              <a href={'#' + attrs.nextId}>next</a>
            </>
          ) : null}
        </div>
        {item.text ? <div class="story-text">{Raw(item.text)}</div> : null}

        <div>
          {item.by ? (
            <a
              href={`https://news.ycombinator.com/reply?id=${item.id}&goto=item?id=${rootStory.id}#${item.id}`}
              target="_blank"
            >
              reply
            </a>
          ) : item.type === 'loading' ? (
            'loading #' + item.id
          ) : (
            JSON.stringify(item)
          )}
        </div>
        {attrs.skipChildren
          ? null
          : mapArray(item.kids || [], (id, i, ids) => (
              <StoryItemById
                id={id}
                indent={attrs.indent + 1}
                nextId={ids[i + 1]}
                parentIds={attrs.parentIds}
                currentUrl={attrs.currentUrl}
              />
            ))}
      </div>,
    ],
  })
}

function resolve(
  context: DynamicContext,
): StaticPageRoute | Promise<StaticPageRoute> {
  let params = getContextSearchParams(context)
  let id = +params.get('id')!
  if (!id) {
    return {
      title: title('Bad Request: Missing story id'),
      description: 'Unknown story detail page',
      node: <p>Error: Missing id in query</p>,
    }
  }
  let currentUrl = context.url
  return then(
    getStoryById(id, story => updateStoryDetail(story, currentUrl)),
    (story): StaticPageRoute => {
      if (!story) {
        return {
          title: title(`Story Detail of id ${id}`),
          description: `Story detail of Hacker News (id: ${id})`,
          node: renderStoryDetailError(id),
        }
      }
      return {
        title: title(story.title || `Story Detail of id ${id}`),
        description: story.text
          ? story.text
          : story.url
          ? story.title + ': ' + story.url
          : `Story detail of Hacker News (id: ${id})`,
        node: renderStoryDetail(story, currentUrl),
      }
    },
  )
}
export default {
  resolve,
  style,
  StoryItem,
}
