import { getStoryById, preloadStoryById, StoryDTO } from '../../api.js'
import DateTimeText, { toLocaleDateTimeString } from '../components/datetime.js'
import { mapArray } from '../components/fragment.js'
import type { Context, DynamicContext } from '../context'
import { o } from '../jsx/jsx.js'
import { Element } from '../jsx/types.js'
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

function StoryDetail(_attrs: {}, context: Context): Element {
  if (context.type === 'static') {
    throw new Error(
      "<StoryDetail/> Component doesn't support static context, it requires routerMatch for item id",
    )
  }
  let params = getContextSearchParams(context)
  let id = +params.get('id')!
  if (!id) {
    return <p>Error: Missing id in query</p>
  }
  let currentUrl = context.url
  let story = getStoryById(id, story => updateStoryDetail(story, currentUrl))
  return renderStoryDetail(story, currentUrl)
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
        <>
          <StoryOverview story={story} />
          {mapArray(story.kids || [], (id, i, ids) => (
            <>
              <Flush />
              <StoryItemById
                id={id}
                indent={0}
                nextId={ids[i + 1]}
                parentIds={new Set([story.id])}
                rootId={story.id}
                currentUrl={currentUrl}
              />
            </>
          ))}
        </>
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
  let item = getStoryById(attrs.id, story =>
    updateStoryItem({
      story,
      context,
      ...attrs,
    }),
  )
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
    if (story.title) {
      return story
    }
    if (story.parent) {
      id = story.parent
      continue
    }
    return { id, title: '#' + id }
  }
}

type StoryItemAttrs = {
  item: StoryDTO
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
  return [
    `div#item-${item.id}`,
    {
      style: `margin-left: ${attrs.indent * 40}px`,
    },
    [
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
          {item.parent ? (
            <>
              {' | '}
              <Link
                href={
                  attrs.parentIds.has(item.parent)
                    ? '#' + item.parent
                    : '/item?id=' + item.parent
                }
              >
                {attrs.topLevel ? 'on: ' + rootStory.title : 'parent'}
              </Link>
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
  ]
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
  let preload = preloadStoryById(id)
  let currentUrl = context.url
  let story = getStoryById(id, story => updateStoryDetail(story, currentUrl))
  let route: StaticPageRoute = {
    title: title(story.title || `Story Detail of id ${id}`),
    description: story.text
      ? story.text
      : story.url
      ? story.title + ': ' + story.url
      : `Story detail of Hacker News (id: ${id})`,
    node: renderStoryDetail(story, currentUrl),
  }
  return then(preload, () => route)
}
export default {
  resolve,
  style,
  StoryItem,
}
