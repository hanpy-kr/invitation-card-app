import { config } from 'dotenv'

config({ path: ['.env.local', '.env'], quiet: true })

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`)
  return value
}
