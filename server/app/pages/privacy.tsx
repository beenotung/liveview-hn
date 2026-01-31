import { Link } from '../components/router.js'
import { o } from '../jsx/jsx.js'
import { Routes } from '../routes.js'

let Privacy = (
  <div id="privacy">
    <h1>Privacy</h1>
    <h2>Data We Collect</h2>
    <ul>
      <li>
        <strong>User Agent</strong> - Browser/device info from HTTP headers (see{' '}
        <Link href="/user-agents">Visitors</Link> page)
      </li>
      <li>
        <strong>Geolocation</strong> - Approximate location derived from IP
        address (country, city level)
      </li>
      <li>
        <strong>Page visits</strong> - URLs visited and timestamps
      </li>
    </ul>
    <h2>What We Don't Store</h2>
    <ul>
      <li>Raw IP addresses are not stored in our database</li>
      <li>No cookies for tracking</li>
      <li>No personal identification</li>
    </ul>
    <h2>Do Not Track</h2>
    <p>
      We respect the DNT (Do Not Track) header. If enabled in your browser, we
      skip collecting user agent and geolocation data.
    </p>
    <h2>Purpose</h2>
    <p>
      Data is used for anonymous analytics to understand visitor patterns. No
      data is sold or shared with third parties.
    </p>
  </div>
)

let routes = {
  '/privacy': {
    title: 'Privacy | Hacker News',
    description: 'Privacy policy and data collection practices',
    node: Privacy,
  },
} satisfies Routes

export default { routes }
