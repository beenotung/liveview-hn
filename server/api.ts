import { MINUTE, SECOND } from '@beenotung/tslib/time.js'
import { find } from 'better-sqlite3-proxy'
import { proxy } from '../db/proxy.js'
import { then } from '@beenotung/tslib/result.js'
import { db } from '../db/db.js'
import debug from 'debug'
import { fetchCache } from './fetch-cache.js'

let log = debug('hn:api')
log.enabled = true

const Expire_Interval = 30 * SECOND

let get = fetchCache.fetchUrl
let prefetch = fetchCache.prefetch

export function getWithMapFn<T, R>(
  url: string,
  mapFn: (data: T) => R,
  updateFn: (data: R) => void,
): R {
  return mapFn(get<T>(url, data => updateFn(mapFn(data))))
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

export function getStoryById(id: number, updateFn: (data: StoryDTO) => void) {
  let task = get<StoryDTO>(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
    updateFn,
  )
  let story = task.data
  if (story && story.deleted) {
    story.text = story.text || '[deleted]'
    story.title = story.title || '[deleted]'
  }
  return task
}

export type ProfileDTO = {
  about: string
  created: number
  delay: number
  id: string
  karma: number
  submitted?: number[]
}

export function getProfile(id: string, updateFn: (data: ProfileDTO) => void) {
  return get<ProfileDTO>(
    `https://hacker-news.firebaseio.com/v0/user/${id}.json`,
    updateFn,
  )
}

export type UpdatesDTO = {
  items: number[]
}

export async function preloadStoryById(id: number, mode?: 'recursive') {
  let url = `https://hacker-news.firebaseio.com/v0/item/${id}.json`
  let story = await prefetch<StoryDTO>(url)
  if (!story || story.deleted || !story.kids || mode !== 'recursive') return
  for (let id of story.kids) {
    await preloadStoryById(id, mode)
  }
}

export async function preloadSubmitted(id: string) {
  let url = `https://hacker-news.firebaseio.com/v0/user/${id}.json`
  let profile = await prefetch<ProfileDTO>(url)
  if (!profile || !profile.submitted) return
  for (let id of profile.submitted.slice(0, 30)) {
    await preloadStoryById(id)
  }
}

export async function preloadStoryList(
  url: string,
  apiMapFn?: (data: any) => number[],
) {
  let ids = await prefetch<number[]>(url)
  if (!ids) return
  if (apiMapFn) {
    ids = apiMapFn(ids)
  }
  for (let id of ids) {
    await preloadStoryById(id)
  }
}
