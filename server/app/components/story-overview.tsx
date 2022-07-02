import { YEAR } from '@beenotung/tslib/time.js'
import { StoryDTO } from '../../api.js'
import Style from './style.js'
import { o } from '../jsx/jsx.js'
import DateTimeText, { toLocaleDateTimeString } from './datetime.js'
import { Link } from './router.js'
import type { Context } from '../context'

let style = Style(/* css */ `
.story-overview h2 {
  font-size: 1.3rem;
  margin-top: 0.3rem;
  margin-bottom: 0.25rem;
}
.story-overview .story-type {
  text-transform: capitalize;
}
.story-overview .story-type::before {
  content: "[";
}
.story-overview .story-type::after {
  content: "] ";
}
.story-overview .story-url {
  font-size: 0.9rem;
}
.story-overview .story-meta {
  font-size: 0.8rem;
}
.story-overview .story-score::after {
  content: " points "
}
.story-overview .story-by {
  font-size: 1rem;
}
.story-overview .story-by::before {
  font-size: 0.8rem;
  content: "by "
}
.story-overview .story-comments::after {
  content: " comments"
}
.story-overview .story-source {
  font-size: 0.8rem;
}
`)

function StoryOverview(attrs: { story: StoryDTO }, context: Context) {
  let story = attrs.story
  let time = story.time * 1000
  return [
    `div#item-${story.id}`,
    {},
    [
      <div class="story-overview">
        <h2>
          {story.type !== 'story' ? (
            <span class="story-type">{story.type}</span>
          ) : null}
          {story.title}
        </h2>
        {story.url ? (
          <Link class="story-url" href={story.url}>
            {story.url}
          </Link>
        ) : null}
        <div class="story-meta">
          <span class="story-score">{story.score}</span>
          <span class="story-by">
            <Link href={'/user?id=' + story.by}>{story.by}</Link>
          </span>
          {time ? (
            <>
              {' | '}
              <time
                class="story-time"
                datetime={new Date(time).toISOString()}
                title={toLocaleDateTimeString(time, context)}
              >
                <DateTimeText time={time} relativeTimeThreshold={YEAR} />
              </time>
            </>
          ) : null}
          {' | '}
          <Link class="story-comments" href={'/item?id=' + story.id}>
            {story.descendants}
          </Link>
          {' | '}
          <a
            class="story-source"
            href={'https://news.ycombinator.com/item?id=' + story.id}
          >
            HN
          </a>
        </div>
      </div>,
    ],
  ]
}

export default Object.assign(StoryOverview, { style })
