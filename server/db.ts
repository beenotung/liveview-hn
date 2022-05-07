import { proxySchema } from 'better-sqlite3-proxy'
import { toSafeMode, newDB } from 'better-sqlite3-schema'
import { join } from 'path'

let migrations: string[] = []

migrations.push(/* sql */ `
-- Up
create table if not exists cache (
  id integer primary key
, url text not null unique
, exp integer not null
, data text not null
);
-- Down
drop table if exists cache;
`)

export let db = newDB({
  path: join('data', 'sqlite3.db'),
  migrate: {
    table: 'migrations',
    force: false,
    migrations,
  },
})

toSafeMode(db)

export type Cache = {
  id?: number
  url: string
  exp: number
  data: string
}

export type DBProxy = {
  cache: Cache[]
}

export let proxy = proxySchema<DBProxy>(db, {
  cache: [],
})
