import { DBInstance, newDB, toSafeMode } from 'better-sqlite3-schema'
import { join } from 'path'

export let dbFile = join('data', 'sqlite3.db')

export let db: DBInstance = newDB({
  path: dbFile,
  migrate: false,
  fileMustExist: true,
  WAL: true,
})

toSafeMode(db)
