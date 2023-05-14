import type { ServerMessage } from '../../../client/types'
import { getProfile, ProfileDTO } from '../../hn-api.js'
import { title } from '../../config.js'
import { toLocaleDateTimeString } from '../components/datetime.js'
import { Link } from '../components/router.js'
import Style from '../components/style.js'
import type { Context, DynamicContext } from '../context'
import { o } from '../jsx/jsx.js'
import { Element, Node } from '../jsx/types.js'
import { nodeToVNode } from '../jsx/vnode.js'
import { getContextSearchParams, StaticPageRoute } from '../routes.js'
import { sessions, sessionToContext } from '../session.js'
import { Result, then } from '@beenotung/tslib/result.js'

let style = Style(/* css */ `
#profile td {
	vertical-align: top;
}
`)

function updateProfile(profile: ProfileDTO) {
  let url = '/user?id=' + profile.id
  sessions.forEach(session => {
    if (session.url !== url) {
      return
    }
    let context = sessionToContext(session, url)
    let element = nodeToVNode(
      renderProfile(profile.id, profile, context),
      context,
    )
    let message: ServerMessage = ['update', element]
    session.ws.send(message)
  })
}

function renderRoute(child: Node): Element {
  return ['#profile', {}, [style, child]]
}

function renderProfile(
  id: string,
  profile: ProfileDTO,
  context: Context,
): Element {
  return renderRoute(
    <table>
      <tbody>
        <tr>
          <td>user:</td>
          <td>{id}</td>
        </tr>
        <tr>
          <td>created:</td>
          <td>
            {profile.created
              ? toLocaleDateTimeString(profile.created * 1000, context)
              : 'loading'}
          </td>
        </tr>
        <tr>
          <td>karma:</td>
          <td>{profile.karma}</td>
        </tr>
        <tr>
          <td>about:</td>
          <td>
            <div>
              <Link href={'/submitted?id=' + id}>
                submissions
                {profile.submitted ? ` (${profile.submitted.length})` : null}
              </Link>
            </div>
            <div>
              <a href={`https://news.ycombinator.com/favorites?id=` + id}>
                HN Profile
              </a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>,
  )
}

function resolve(context: DynamicContext): Result<StaticPageRoute> {
  let params = getContextSearchParams(context)
  const id = params.get('id')
  if (!id) {
    return {
      title: title('Bad Request: Missing user id'),
      description: 'Unknown User Profile Page',
      node: <p>Error: Missing id in request query</p>,
    }
  }
  return then(getProfile(id, updateProfile), profile => {
    let description = `User profile page of ${id}.`
    if (!profile) {
      return {
        title: title(`${id}'s Profile`),
        description,
        node: renderRoute(
          <p>
            Failed to load profile of user (${id}), please try again later.
          </p>,
        ),
      }
    }
    if (profile.created) {
      let since: string = toLocaleDateTimeString(
        profile.created * 1000,
        context,
      )
      description += ` Created since ${since}.`
    }
    let submissions = profile.submitted?.length || 0
    if (submissions) {
      description += ` ${submissions} submissions.`
    }
    if (profile.karma) {
      description += ` ${profile.karma} karma.`
    }
    return {
      title: title(`${id}'s Profile`),
      description,
      node: renderProfile(id, profile, context),
    }
  })
}

export default { resolve }
