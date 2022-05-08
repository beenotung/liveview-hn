import { getStoryById, StoryDTO } from '../../api.js'
import DateTimeText, { toLocaleDateTimeString } from '../components/datetime.js'
import { mapArray } from '../components/fragment.js'
import { Context, getContext } from '../context.js'
import JSX from '../jsx/jsx.js'
import { Element } from '../jsx/types.js'
import StoryOverview from '../components/story-overview.js'
import { YEAR } from '@beenotung/tslib/time.js'
import { Flush } from '../components/flush.js'
import Style from '../components/style.js'
import { nodeToVNode } from '../jsx/vnode.js'
import { Raw } from '../components/raw.js'

function updateStoryDetail(story: StoryDTO, context: Context) {
  if (context.type !== 'ws' || context.url !== '/0') return
  let element = nodeToVNode(renderStoryDetail(story), context)
  context.ws.send(['update', element])
}

function updateStoryItem(options: {
  story: StoryDTO
  indent: number
  context: Context
  nextId: number | undefined
  parentIds: Set<number>
}) {
  let context = options.context
  if (context.type !== 'ws' || context.url !== '/0') return
  let element = nodeToVNode(
    <StoryItem item={options.story} {...options} />,
    context,
  )
  context.ws.send(['update', element])
}

function StoryDetail(props: {}): Element {
  let context = getContext(props)
  if (context.type === 'static') {
    throw new Error(
      "Story Component doesn't support static context, it requires routerMatch for item id",
    )
  }
  let params = new URLSearchParams(context.routerMatch!.search)
  let id = +params.get('id')!
  if (!id) {
    return <p>Error: Missing id in query</p>
  }
  let story = getStoryById(id, story => updateStoryDetail(story, context))
  return renderStoryDetail(story)
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

function renderStoryDetail(story: StoryDTO): Element {
  return [
    `div#story-detail`,
    {},
    [
      StoryOverview.style,
      style,
      story.text ? (
        <StoryItem
          item={story}
          indent={0}
          nextId={undefined}
          parentIds={new Set([story.id])}
          topLevel
        />
      ) : (
        <>
          <StoryOverview story={story} tagName="div" />
          {mapArray(story.kids || [], (id, i, ids) => (
            <>
              <Flush />
              <StoryItemById
                id={id}
                indent={0}
                nextId={ids[i + 1]}
                parentIds={new Set([story.id])}
              />
            </>
          ))}
        </>
      ),
    ],
  ]
}

function StoryItemById(attrs: {
  id: number
  indent: number
  nextId: number | undefined
  parentIds: Set<number>
}): Element {
  let context = getContext(attrs)
  let item = getStoryById(attrs.id, story =>
    updateStoryItem({
      story,
      context,
      ...attrs,
    }),
  )
  return <StoryItem item={item} {...attrs} />
}

function getTitle(id: number): string | null {
  for (;;) {
    let story = getStoryById(id, () => {})
    if (story.title) {
      return story.title
    }
    if (story.parent) {
      id = story.parent
      continue
    }
    return null
  }
}

function StoryItem(attrs: {
  item: StoryDTO
  indent: number
  nextId: number | undefined
  parentIds: Set<number>
  topLevel?: boolean
  skipChildren?: boolean
}): Element {
  let context = getContext(attrs)
  let item = attrs.item
  let time = item.time * 1000
  attrs.parentIds.add(item.id)
  return [
    `div#${item.id}.story-item`,
    {
      style: `margin-left: ${attrs.indent * 40}px`,
    },
    [
      <>
        <div class="story-meta">
          {item.by ? <span class="story-by">{item.by}</span> : null}
          {time ? (
            <>
              <a href={'/item?id=' + item.id}>
                <time
                  class="story-time"
                  datetime={new Date(time).toISOString()}
                  title={toLocaleDateTimeString(time, context)}
                >
                  <DateTimeText time={time} relativeTimeThreshold={YEAR} />
                </time>
              </a>
            </>
          ) : null}
          {item.parent ? (
            <>
              {' | '}
              <a
                href={
                  attrs.parentIds.has(item.parent)
                    ? '#' + item.parent
                    : '/item?id=' + item.parent
                }
              >
                {attrs.topLevel ? 'on: ' + getTitle(item.parent) : 'parent'}
              </a>
            </>
          ) : null}
          {attrs.nextId ? (
            <>
              {' | '}
              <a href={'#' + attrs.nextId}>next</a>
            </>
          ) : null}
          <div class="story-text">{Raw(item.text)}</div>
          {attrs.skipChildren
            ? null
            : mapArray(item.kids || [], (id, i, ids) => (
                <StoryItemById
                  id={id}
                  indent={attrs.indent + 1}
                  nextId={ids[i + 1]}
                  parentIds={attrs.parentIds}
                />
              ))}
        </div>
      </>,
    ],
  ]
}

export default Object.assign(StoryDetail, { style, StoryItem })
