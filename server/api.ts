import { MINUTE, SECOND } from '@beenotung/tslib/time.js'
import { find } from 'better-sqlite3-proxy'
import { proxy } from '../db/proxy.js'
import { then } from '@beenotung/tslib/result.js'
import { db } from '../db/db.js'

const Timeout_Interval = 5 * SECOND
const Expire_Interval = 30 * SECOND

let fetchQueue = Promise.resolve<any>(0)

function safeFetch(url: string) {
  fetchQueue = fetchQueue
    .catch(err => err)
    .then(() => fetch(url))
    .then(res => res.json())
  return fetchQueue
}

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
    safeFetch(url)
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

export function preload<T>(
  url: string,
  onError: (err: any) => void,
): T | Promise<T | void> {
  let cache = find(proxy.cache, { url })
  if (cache && cache.exp < Date.now() + Expire_Interval) {
    return JSON.parse(cache.data)
  }
  return safeFetch(url)
    .then(json => {
      const cache = find(proxy.cache, { url })
      const exp = Date.now() + Expire_Interval
      const data = JSON.stringify(json)
      if (cache) {
        proxy.cache[cache.id!] = { url, exp, data }
      } else {
        proxy.cache.push({ url, exp, data })
      }
      return json as T
    })
    .catch(onError)
}

export function preloadStoryById(
  id: number,
  mode?: 'recursive',
): void | Promise<unknown> {
  let url = `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  return then<StoryDTO | void, void | Promise<unknown>>(
    preload(url, err => {
      console.error('Failed to preload story by id:', id, err)
    }),
    (story): void | Promise<unknown> =>
      (mode === 'recursive' &&
        story &&
        !story.deleted &&
        story.kids &&
        Promise.all(story.kids.map(id => preloadStoryById(id, mode)))) ||
      void 0,
  )
}

export function preloadProfile(id: string) {
  let url = `https://hacker-news.firebaseio.com/v0/user/${id}.json`
  return preload<ProfileDTO>(url, err => {
    console.error('Failed to preload profile by id:', id, err)
  })
}

export function preloadSubmitted(id: string) {
  return then(
    preloadProfile(id),
    (profile): void | Promise<unknown> =>
      profile &&
      profile.submitted &&
      Promise.all(
        profile.submitted.slice(0, 30).map(id => preloadStoryById(id)),
      ),
  )
}

export function preloadStoryList(
  url: string,
  apiMapFn?: (data: any) => number[],
) {
  then(
    preload<number[]>(url, err => {
      console.error('Failed to preload story list, url:', url, err)
    }),
    (ids): void | Promise<unknown> =>
      ids &&
      Promise.all(
        (apiMapFn ? apiMapFn(ids) : ids).map(id => preloadStoryById(id)),
      ),
  )
}

let delete_expired_cache = db.prepare(/* sql */ `
delete from cache
where id in (
  select id from cache where exp < ? limit ?
)
`)

function clearExpiredCache() {
  console.log('[clearExpiredCache] start')
  let batch = 200
  function loop() {
    console.log('[clearExpiredCache] loop')
    let result = delete_expired_cache.run(Date.now(), batch)
    if (result.changes == batch) {
      setTimeout(loop, SECOND * 5)
    } else {
      setTimeout(clearExpiredCache, MINUTE * 20)
    }
  }
  setTimeout(loop)
}
clearExpiredCache()
