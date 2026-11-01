import 'server-only'

import { randomInt } from 'node:crypto'

// 헷갈리는 글자(0 o 1 l i) 제외
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function randomSlug(length = 8): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}
