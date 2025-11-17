import { MINUTE } from '@beenotung/tslib/time.js'
import debug from 'debug'
import { db } from '../db/db.js'
import { proxy } from '../db/proxy.js'
import { expireFetchTask } from './fetch-cache.js'

let log = debug('hn:clean-cache')
// log.enabled = true

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

const busy_interval = 1000
const idle_interval = 15 * MINUTE
const max_used_time = 1000 / 200
const initial_limit = 200
const max_limit = 2 ** 60

let limit = initial_limit

let cleanStep = db.transaction(() => {
  let rows = select_expired_cache.all({
    now: Date.now(),
    limit,
  }) as ExpiredCacheRow[]
  for (let row of rows) {
    expireFetchTask(row.url)
    delete proxy.cache[row.id]
  }
  return rows.length
})

function loop() {
  let startTime = Date.now()
  let batch = cleanStep()
  if (batch === 0) {
    limit = initial_limit
    setTimeout(loop, idle_interval)
    return
  }
  let usedTime = Date.now() - startTime
  if (usedTime > max_used_time) {
    limit = Math.floor(limit / 2) + 1
  } else if (usedTime < max_used_time / 2) {
    limit = limit * 2
  } else {
    limit = Math.floor(limit * 1.5)
  }
  if (limit > max_limit) {
    limit = max_limit
  }
  log('cleanStep loop:', { usedTime, limit, batch })
  setTimeout(loop, busy_interval)
}

setTimeout(loop)
