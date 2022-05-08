import { ServerMessage } from '../../../client/index.js'
import { get, getStoryById, StoryDTO } from '../../api.js'
import { Flush } from '../components/flush.js'
import { mapArray } from '../components/fragment.js'
import Style from '../components/style.js'
import { Context, getContext, WsContext } from '../context.js'
import JSX from '../jsx/jsx.js'
import { nodeToVNode } from '../jsx/vnode.js'
import StoryOverview from '../components/story-overview.js'

function getNews(context: Context) {
  let ids = get<number[]>(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
    [],
    ids => updateNews(ids, context),
  )
  ids = ids.slice(0, 30)
  return ids
}

function updateNews(ids: number[], context: Context) {
  if (context.type !== 'ws') return
  let url = context.url
  if (url !== '/' && url !== '/news') return
  let stories = ids.map(id =>
    getStoryById(id, story => updateStory(story, context)),
  )
  let elements = stories.map(story =>
    nodeToVNode(<StoryOverview story={story} tagName="li" />, context),
  )
  let message: ServerMessage = ['update-in', '#news .story-list', [elements]]
  context.ws.send(message)
}

function updateStory(story: StoryDTO, context: Context) {
  if (context.type !== 'ws') return
  let url = context.url
  if (url !== '/' && url !== '/news') return
  let element = <StoryOverview story={story} tagName="li" />
  let message: ServerMessage = ['update', nodeToVNode(element, context)]
  context.ws.send(message)
}

function News(attrs: {}) {
  let context = getContext(attrs)
  let ids = getNews(context)
  return (
    <div id="news">
      {Style(/* css */ `
#news ol {
  line-height: 1.25rem;
  font-size: 1rem;
}
`)}
      {StoryOverview.style}
      <h1>News</h1>
      <ol class="story-list">
        {mapArray(ids, id => (
          <>
            <Flush />
            <StoryOverviewById id={id} />
          </>
        ))}
      </ol>
    </div>
  )
}

function StoryOverviewById(attrs: { id: number }) {
  let context = getContext(attrs)
  let story = getStoryById(attrs.id, story => updateStory(story, context))
  return <StoryOverview story={story} tagName="li" />
}

export default News
