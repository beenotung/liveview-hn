import debug from 'debug'
import { db } from '../db/db.js'
import { proxy } from '../db/proxy.js'
import { expireFetchTask } from './fetch-cache.js'

let log = debug('hn:clean-cache')
log.enabled = true

type ExpiredCacheRow = {
  id: number
  url: string
}

let select_expired_cache = db.prepare(/* sql */ `
select id, url
from cache
where exp < :now
limit :limit
`)

let interval = 1000
let maxUsedTime = 1000 / 200
let limit = 200

let cleanStep = db.transaction(() => {
  log('cleanStep', { limit })
  let rows = select_expired_cache.all({
    now: Date.now(),
    limit,
  }) as ExpiredCacheRow[]
  for (let row of rows) {
    expireFetchTask(row.url)
    delete proxy.cache[row.id]
  }
})

function loop() {
  let startTime = Date.now()
  cleanStep()
  let usedTime = Date.now() - startTime
  if (usedTime > maxUsedTime) {
    limit = Math.floor(limit / 2) + 1
  } else if (usedTime < maxUsedTime / 2) {
    limit = limit * 2
  } else {
    limit = Math.floor(limit * 1.5)
  }
  setTimeout(loop, interval)
}

setTimeout(loop)
