import { ServerMessage } from '../../../client/index.js'
import { get } from '../../api.js'
import { toLocaleDateTimeString } from '../components/datetime.js'
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

type ProfileDTO = {
  about: string
  created: number
  delay: number
  id: string
  karma: number
  submitted?: number[]
}
let profilePlaceholder: ProfileDTO = {
  about: '',
  created: 0,
  delay: 0,
  id: '',
  karma: 0,
}

function getProfile(id: string): ProfileDTO {
  return get<ProfileDTO>(
    `https://hacker-news.firebaseio.com/v0/user/${id}.json`,
    profilePlaceholder,
    updateProfile,
  )
}

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
  let profile = getProfile(id)
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
                <a href="">
                  submissions
                  {profile.submitted ? ` (${profile.submitted.length})` : null}
                </a>
              </div>
              <div>
                <a href="">comments</a>
              </div>
              <div>
                <a href="">favorites</a>
              </div>
            </td>
          </tr>
        </tbody>
      </table>,
    ],
  ]
}

export default Profile
