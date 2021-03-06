import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db.js'

export type Cache = {
  id?: number
  url: string
  exp: number
  data: string
}

export type RequestLog = {
  id?: number
  method_id: number
  url_id: number
  user_agent_id: number | null
  timestamp: number
}

export type Method = {
  id?: number
  method: string
}

export type Url = {
  id?: number
  url: string
}

export type UserAgent = {
  id?: number
  user_agent: string
}

export type DBProxy = {
  cache: Cache[]
  request_log: RequestLog[]
  method: Method[]
  url: Url[]
  user_agent: UserAgent[]
}

export let proxy = proxySchema<DBProxy>(db, {
  cache: [],
  request_log: [],
  method: [],
  url: [],
  user_agent: [],
})
