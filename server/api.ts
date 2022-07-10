import { SECOND } from '@beenotung/tslib/time.js'
import { find } from 'better-sqlite3-proxy'
import fetch from 'node-fetch'
import { proxy } from '../db/proxy.js'
import { then } from '@beenotung/tslib/result.js'

const Timeout_Interval = 5 * SECOND
const Expire_Interval = 30 * SECOND

export function get<T>(
  url: string,
  defaultValue: T,
  updateFn: (data: T) => void,
): T {
  let value = defaultValue
  let cache = find(proxy.cache, { url })
  let now = Date.now()
  let id: number

  if (cache) {
    value = JSON.parse(cache.data)
    id = cache.id!
  } else {
    id = proxy.cache.push({
      url,
      exp: now + Timeout_Interval,
      data: JSON.stringify(defaultValue),
    })
  }

  if (!cache || cache.exp < now) {
    fetch(url)
      .then(res => res.json())
      .then(json => {
        let cache = proxy.cache[id]
        cache.data = JSON.stringify(json)
        cache.exp = Date.now() + Expire_Interval
        updateFn(json as T)
      })
      .catch(e => {
        console.error('Failed to GET:', url, 'Reason:', e)
      })
  }
  return value
}

export function getWithMapFn<T, R>(
  url: string,
  defaultValue: T,
  mapFn: (data: T) => R,
  updateFn: (data: R) => void,
): R {
  return mapFn(get<T>(url, defaultValue, data => updateFn(mapFn(data))))
}

export type StoryDTO = {
  by: string
  descendants: number
  id: number
  kids?: number[]
  score: number
  time: number
  title: string
  type: string
  url?: string
  text: string
  parent?: number
  deleted?: boolean
}

export function preloadStoryById(id: number): void | Promise<any> {
  let url = `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  let cache = find(proxy.cache, { url })
  let story: StoryDTO | Promise<StoryDTO>
  if (cache && cache.exp < Date.now() + Expire_Interval) {
    story = JSON.parse(cache.data)
  } else {
    console.log('preload story by id:', id)
    story = fetch(url)
      .then(res => res.json())
      .then(json => {
        let cache = find(proxy.cache, { url })
        let exp = Date.now() + Expire_Interval
        let data = JSON.stringify(json)
        if (cache) {
          proxy.cache[cache.id!] = { url, exp, data }
        } else {
          proxy.cache.push({ url, exp, data })
        }
        return json as StoryDTO
      })
    story.catch(err => {
      console.error('Failed to preload story by id:', err)
    })
  }
  return then<StoryDTO, void | Promise<any>>(story, story => {
    if (story.deleted || !story.kids) {
      return
    }
    return Promise.all(story.kids.map(preloadStoryById))
  })
}

export function getStoryById(
  id: number,
  updateFn: (data: StoryDTO) => void,
): StoryDTO {
  let story = get<StoryDTO>(
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
      text: '',
    },
    updateFn,
  )
  if (story.deleted) {
    story.text = story.text || '[deleted]'
    story.title = story.title || '[deleted]'
  }
  return story
}

export type ProfileDTO = {
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

export function getProfile(
  id: string,
  updateFn: (data: ProfileDTO) => void,
): ProfileDTO {
  return get<ProfileDTO>(
    `https://hacker-news.firebaseio.com/v0/user/${id}.json`,
    profilePlaceholder,
    updateFn,
  )
}

export type UpdatesDTO = {
  items: number[]
}
