import 'server-only'

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

/**
 * DB 드라이버 선택은 이 파일 한 곳에서만 한다.
 * 운영(Neon)은 풀러 주소를 쓰므로 prepared statement를 끈다.
 */
type Db = PostgresJsDatabase<typeof schema>

const globalForDb = globalThis as unknown as { dearDb?: Db }

function createDb(): Db {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL이 설정되지 않았습니다.')
  const client = postgres(url, {
    prepare: false,
    max: process.env.NODE_ENV === 'production' ? 3 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  })
  return drizzle(client, { schema, logger: process.env.DB_LOG === '1' })
}

export function getDb(): Db {
  if (!globalForDb.dearDb) globalForDb.dearDb = createDb()
  return globalForDb.dearDb
}

export { schema }
