import { SECOND } from '@beenotung/tslib/time.js'
import { find } from 'better-sqlite3-proxy'
import fetch from 'node-fetch'
import { proxy } from '../db/proxy.js'

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
      exp: now + 5 * SECOND,
      data: JSON.stringify(defaultValue),
    })
  }

  if (!cache || cache.exp < now) {
    fetch(url)
      .then(res => res.json())
      .then(json => {
        let cache = proxy.cache[id]
        cache.data = JSON.stringify(json)
        cache.exp = Date.now() + 30 * SECOND
        updateFn(json as T)
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
