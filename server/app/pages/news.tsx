import { ServerMessage } from '../../../client/index.js'
import { get, getStoryListByIds, StoryDTO } from '../../api.js'
import { mapArray } from '../components/fragment.js'
import Style from '../components/style.js'
import JSX from '../jsx/jsx.js'
import type { Element } from '../jsx/types'
import { nodeToVNode } from '../jsx/vnode.js'
import { sessions } from '../session.js'
import StoryOverview from './story-overview.js'

function sendUpdate(message: ServerMessage) {
  sessions.forEach(session => {
    let url = session.url
    if (url === '/' || url === '/news') {
      session.ws.send(message)
    }
  })
}

function getNews() {
  let ids = get<number[]>(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
    [],
    updateNews,
  )
  ids = ids.slice(0, 30)
  let stories = getStoryListByIds(ids, updateStory)
  return stories
}

const StaticContext = {
  type: 'static' as const,
}

function updateNews(ids: number[]) {
  let stories = getStoryListByIds(ids, updateStory)
  let elements = stories.map(story =>
    nodeToVNode(StoryItem(story), StaticContext),
  )
  let message: ServerMessage = ['update-in', '#news .story-list', [elements]]
  sendUpdate(message)
}

function updateStory(story: StoryDTO) {
  let element = StoryItem(story)
  let message: ServerMessage = ['update', nodeToVNode(element, StaticContext)]
  sendUpdate(message)
}

function News() {
  let stories = getNews()
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
      <ol class="story-list">{mapArray(stories, StoryItem)}</ol>
    </div>
  )
}

function StoryItem(story: StoryDTO): Element {
  return <StoryOverview story={story} tagName="li" />
}

export default News
