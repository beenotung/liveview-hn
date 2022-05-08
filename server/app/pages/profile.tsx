import { ServerMessage } from '../../../client/index.js'
import { get, getProfile, ProfileDTO } from '../../api.js'
import { toLocaleDateTimeString } from '../components/datetime.js'
import { Link } from '../components/router.js'
import Style from '../components/style.js'
import { Context, getContext, WsContext } from '../context.js'
import JSX from '../jsx/jsx.js'
import { Element } from '../jsx/types.js'
import { nodeToVNode } from '../jsx/vnode.js'
import { sessions } from '../session.js'

let style = Style(/* css */ `
#profile td {
	vertical-align: top;
}
`)

function updateProfile(profile: ProfileDTO) {
  sessions.forEach(session => {
    if (session.url !== '/user?id=' + profile.id) {
      return
    }
    let context: WsContext = {
      type: 'ws',
      session,
      ws: session.ws,
      url: session.url,
    }
    let element = nodeToVNode(
      renderProfile(profile.id, profile, context),
      context,
    )
    let message: ServerMessage = ['update', element]
    session.ws.send(message)
  })
}

function Profile(attrs: {}) {
  let context = getContext(attrs)
  if (context.type === 'static') {
    throw new Error(
      "<Profile/> Component doesn't support static context, it requires routerMatch for item id",
    )
  }
  let params = new URLSearchParams(context.routerMatch!.search)
  let id = params.get('id')!
  if (!id) {
    return <p>Error: Missing id in query</p>
  }
  let profile = getProfile(id, updateProfile)
  return renderProfile(id, profile, context)
}

function renderProfile(
  id: string,
  profile: ProfileDTO,
  context: Context,
): Element {
  return [
    '#profile',
    {},
    [
      style,
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
    ],
  ]
}

export default Profile
