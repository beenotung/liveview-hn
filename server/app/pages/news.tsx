import { get } from '../../api.js'
import { mapArray } from '../components/fragment.js'
import Style from '../components/style.js'
import JSX from '../jsx/jsx.js'

function getNews() {
  let ids = get<number[]>(
    'https://hacker-news.firebaseio.com/v0/topstories.json',
    [],
    updateNews,
  )
  ids = ids.slice(0, 30)
  let stories = getStoryByIds(ids)
  return stories
}

type Story = {
  by: string
  descendants: number
  id: number
  kids: number[]
  score: number
  time: number
  title: string
  type: string
  url?: string
}

function getStoryByIds(ids: number[]) {
  let stories = ids.map(id =>
    get<Story>(
      `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
      {
        by: '',
        descendants: 0,
        id,
        kids: [],
        score: 0,
        time: 0,
        title: '',
        type: 'loading',
      },
      updateStory,
    ),
  )
  return stories
}

function updateNews(ids: number[]) {
  getStoryByIds(ids)
  // TODO update UI
}
function updateStory(story: Story) {
  // TODO update UI
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
#news h2 {
  font-size: 1.3rem;
  margin-top: 0.3rem;
  margin-bottom: 0.25rem;
}
#news .story-type {
  text-transform: capitalize;
}
#news .story-type::before {
  content: "[";
}
#news .story-type::after {
  content: "] ";
}
#news .story-url {
  font-size: 0.9rem;
}
#news .story-meta {
  font-size: 0.8rem;
}
#news .story-score::after {
  content: " points "
}
#news .story-by {
  font-size: 1rem;
}
#news .story-by::before {
  font-size: 0.8rem;
  content: "by "
}
#news .story-comments::after {
  content: " comments"
}
`)}
      <h1>News</h1>
      <ol>
        {mapArray(stories, (story: Story) => {
          return (
            <li>
              <h2>
                {story.type !== 'story' ? (
                  <span class="story-type">{story.type}</span>
                ) : null}
                {story.title}
              </h2>
              {story.url ? (
                <a class="story-url" href={story.url}>
                  {story.url}
                </a>
              ) : null}
              <div class="story-meta">
                <span class="story-score">{story.score}</span>
                <span class="story-by">{story.by}</span>
                {' | '}
                <span class="story-comments">{story.descendants}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default News
