import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { requireEnv } from './env'

async function main() {
  const client = postgres(requireEnv('DATABASE_URL'), {
    max: 1,
    prepare: false,
    onnotice: () => {},
  })
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  await client.end()
  console.log('마이그레이션 완료')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
