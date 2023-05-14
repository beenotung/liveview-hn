import { SECOND } from '@beenotung/tslib/time.js'
import { find } from 'better-sqlite3-proxy'
import debug from 'debug'
import { Cache, proxy } from '../db/proxy.js'
import { fetchQueue } from './fetch-queue.js'
import './clean-cache.js'

let log = debug('hn:fetch-cache')
log.enabled = true

const Timeout_Interval = 5 * SECOND
const Expire_Interval = 30 * SECOND

function newCache(row: { url: string; exp: number; data: any }) {
  let id = proxy.cache.push(row)
  return proxy.cache[id]
}

export class FetchTask<T> {
  cache: Cache | null
  data?: T
  promise: Promise<T | void>
  constructor(public url: string, updateFn: (data: T) => void) {
    let cache = find(proxy.cache, { url })

    if (cache) {
      this.cache = cache
      let text = cache.data
      if (text) {
        let data = JSON.parse(text)
        this.data = data
        this.promise = Promise.resolve(data)
        return
      }
      this.promise = this.download(updateFn)
      return
    }

    let id = proxy.cache.push({
      url,
      exp: 0,
      data: null,
    })
    cache = proxy.cache[id]
    this.cache = cache
    this.promise = this.download(updateFn)
  }
  download(updateFn: (data: T) => void) {
    let exp = Date.now() + Timeout_Interval
    if (this.cache) {
      this.cache.exp = exp
    } else {
      this.cache = newCache({ url: this.url, exp, data: null })
    }
    return fetchQueue.getText(this.url).then(text => {
      let data = JSON.parse(text) as T
      this.data = data
      let exp = Date.now() + Expire_Interval
      if (this.cache) {
        this.cache.exp = exp
        this.cache.data = text
      } else {
        this.cache = newCache({ url: this.url, exp, data: text })
      }

      updateFn(data)
      return data
    })
  }
  check(updateFn: (data: T) => void) {
    if (this.cache && this.cache.exp >= Date.now()) return
    this.download(updateFn)
  }
  destroy() {
    this.cache = null
  }
}

let tasks = new Map<string, FetchTask<any>>()

export function expireFetchTask(url: string) {
  let task = tasks.get(url)
  if (task) {
    task.destroy()
  }
}

function fetchUrl<T>(url: string, updateFn: (data: T) => void): FetchTask<T> {
  // log('fetchUrl', url)

  let task = tasks.get(url)
  if (task) {
    task.check(updateFn)
  } else {
    task = new FetchTask(url, updateFn)
    tasks.set(url, task)
  }

  return task
}

function prefetch<T>(url: string) {
  let task = fetchUrl<T>(url, noop)
  return task.data || task.promise
}

function noop() {
  // placeholder
}

export let fetchCache = { fetchUrl, prefetch }
