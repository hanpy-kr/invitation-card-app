import type { EffectKind } from './blocks'

/** 세기 3단 */
export const EFFECT_COUNT = { low: 12, mid: 24, high: 36 } as const
export type EffectDensity = keyof typeof EFFECT_COUNT

/** 깊이 3겹: 크기 · 낙하 시간 배율(클수록 느림, 먼 조각이 더 느리게) · 투명도 */
const DEPTH = [
  { size: 0.55, speed: 1.5, opacity: 0.55 },
  { size: 0.8, speed: 1.2, opacity: 0.8 },
  { size: 1, speed: 1, opacity: 0.95 },
] as const

const COLORS: Record<Exclude<EffectKind, 'none'>, readonly string[]> = {
  petal: ['#c65a3d', '#d8735a', '#b94a33', '#e39a80'],
  snow: ['#ffffff'],
  party: ['#e8a0a0', '#e9c27c', '#9cc5c0', '#c4aedb'],
  bubble: ['rgba(120,145,180,.55)'],
  leaf: ['#8fa08a', '#a3b39b', '#7d8f7a', '#b5c2ad'],
  ginkgo: ['#d9a93a', '#e3b84a', '#c99a2e', '#ecc965'],
}
const BALLOON = ['#f0b9a5', '#f6dcc3', '#e9a99a', '#f3cdb8']
const SPARKLE = '#e6c77e'

/** 기본 조각 크기(px, 깊이 1 기준) */
const BASE_SIZE: Record<Exclude<EffectKind, 'none'>, number> = {
  petal: 16,
  snow: 9,
  party: 11,
  bubble: 26,
  leaf: 20,
  ginkgo: 20,
}

export type Piece = {
  /** 가로 위치(%) */
  x: number
  size: number
  /** 한 번 떨어지는 데 걸리는 시간(초) */
  dur: number
  /** 음수 지연: 처음부터 화면 곳곳에 흩어져 있게 */
  delay: number
  /** 떨어지면서 옆으로 흐르는 거리(px) */
  sway: number
  /** 끝 회전(deg) */
  rot: number
  opacity: number
  color: string
  /** 변형: 눈의 반짝이, 파티의 풍선 */
  alt: boolean
  /** 위로 올라가는 조각(풍선 · 비눗방울) */
  up: boolean
}

/** 시드 고정 난수 (mulberry32): 서버와 브라우저가 같은 값을 만들어 하이드레이션이 어긋나지 않음 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SEEDS: Record<Exclude<EffectKind, 'none'>, number> = {
  petal: 1101,
  snow: 2202,
  party: 3303,
  bubble: 4404,
  leaf: 5505,
  ginkgo: 6606,
}

export function makePieces(kind: Exclude<EffectKind, 'none'>, density: EffectDensity): Piece[] {
  const rand = rng(SEEDS[kind])
  const n = EFFECT_COUNT[density]
  const colors = COLORS[kind]
  return Array.from({ length: n }, (_, i) => {
    const d = DEPTH[i % 3]
    const alt = kind === 'snow' ? i % 5 === 2 : kind === 'party' ? i % 4 === 1 : false
    const base = BASE_SIZE[kind] * (kind === 'party' && alt ? 2.2 : 1)
    const dur = (7 + rand() * 6) * d.speed
    const up = kind === 'bubble' || (kind === 'party' && alt)
    return {
      x: Math.round(rand() * 1000) / 10,
      size: Math.round(base * d.size * (0.75 + rand() * 0.5) * 10) / 10,
      dur: Math.round(dur * 10) / 10,
      delay: -Math.round(rand() * dur * 10) / 10,
      sway: Math.round((rand() - 0.5) * 120),
      rot: Math.round((rand() - 0.5) * 720),
      opacity: d.opacity,
      color:
        kind === 'snow' && alt
          ? SPARKLE
          : kind === 'party' && alt
            ? BALLOON[Math.floor(rand() * BALLOON.length)]
            : colors[Math.floor(rand() * colors.length)],
      alt,
      up,
    }
  })
}
