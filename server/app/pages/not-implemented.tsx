import JSX from '../jsx/jsx.js'
import { getContextUrl } from '../context.js'
import { attrs } from '../jsx/types.js'

export function NotImplemented(attrs: attrs) {
  let url = getContextUrl(attrs)
  return (
    <div class="not-implemented">
      <h2>501 Not Implemented</h2>
      <p>
        url: <code>{url}</code>
      </p>
    </div>
  )
}

export default NotImplemented
