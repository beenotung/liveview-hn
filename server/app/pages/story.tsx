import { getStoryById, StoryDTO } from '../../api.js'
import { mapArray } from '../components/fragment.js'
import { getContext } from '../context.js'
import JSX from '../jsx/jsx.js'
import { Element } from '../jsx/types.js'
import StoryOverview from './story-overview.js'

function updateStory(story: StoryDTO) {}

function Story(props: {}): Element {
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
  let story = getStoryById(id, updateStory)
  let kids = story.kids.map(id => getStoryById(id, updateStory))
  return (
    <div class="story">
      {StoryOverview.style}
      <StoryOverview story={story} tagName="div" />
      {mapArray(kids, story => StoryItem(story))}
    </div>
  )
}

function StoryItem(item: StoryDTO): Element {
  return [
    `div.story-item[data-id="${item.id}"]`,
    {},
    [
      <>
        {item.url ? (
          <a class="story-url" href={item.url}>
            {item.url}
          </a>
        ) : null}
        <div class="story-meta">
          <span class="story-by">{item.by}</span>
          {' | '}
          <a class="story-comments" href={'/item?id=' + item.id}>
            {item.descendants}
          </a>
        </div>
      </>,
    ],
  ]
}

export default Story
