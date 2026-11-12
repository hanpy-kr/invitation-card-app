import type { EffectKind, EventType, IntroKind } from './blocks'

/**
 * 디자인 표지 목록. 새 표지는 아래 배열에 한 줄을 더하고,
 * public/covers/ 에 이미지 2개를 넣으면 끝:
 *   {key}-800.webp · {key}-1200.webp  (4:5 비율, 장당 160KB 이하)
 * 카톡 공유 카드용 JPEG(카카오는 webp를 못 읽음)는 빌드할 때 scripts/cover-share.mjs 가 자동으로 만든다.
 * key는 저장된 초대장이 가리키므로 한 번 정하면 바꾸지 말 것
 * (이름을 꼭 바꿔야 하면 LEGACY_KEYS 에 옛 key → 새 key를 적는다. 목록에서 그냥 빼면 그 초대장은 '글자만'으로 보임).
 */
export type CoverTone = 'dark' | 'light'

export type CoverDef = {
  key: string
  name: string
  /** 어울리는 행사 (앞에 오는 행사일수록 먼저 추천) */
  events: readonly EventType[]
  /** 그림 위 글자 톤: dark = 밝은 그림 위 어두운 글자, light = 어두운 그림 위 흰 글자 */
  tone: CoverTone
  /** 날짜 · 포인트 색 (그림 색에서 고름) */
  accent: string
  /** 그림 양옆 장식을 피해 글자를 둘 수 있는 가운데 폭을 정하는 좌우 여백(%). 기본 24 — 가운데가 좁은 그림은 크게 */
  padX: number
  /** 이 표지에 어울리는 떨어지는 효과 · 첫 화면 봉투 (새 초대장이 이 값으로 시작) */
  effect: EffectKind
  intro: IntroKind
  /** 본문 종이 색: 그림 아래 가장자리 색에서 뽑아 표지와 본문이 한 장처럼 이어지게 함 (면 · 선은 거기서 파생) */
  paper: string
  surface: string
  line: string
  /** 본문 보조 글자 · 포인트 색 (종이 위 대비 4.5:1 이상으로 보정한 값) */
  sub: string
  point: string
  /** 어두운 종이일 때만: 글자 · 보조 글자 · 포인트 · 버튼 색을 따로 정함 (없으면 기본 종이 편지 색) */
  dark?: { ink: string; sub: string; point: string; btn: string; btnText: string; btnLine: string }
  src: string
}

const PAPER: Record<string, string> = {
  'birthday-balloon': '#f5e0cf',
  'dol-cloud': '#ece2d8',
  'housewarming-eucalyptus': '#d0cfbc',
  'meetup-ginkgo': '#e3dcd2',
  'prewedding-cheers': '#ebe0cf',
  'thanks-wildflower': '#e2dace',
  'wedding-peony': '#e6dfd6',
  'wedding-poppy': '#e1dad1',
  'wedding-rose': '#e3dace',
  'yearend-snow': '#19273e',
}

function lum(h: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

/** 글자 색이 종이 위에서 대비 min:1 이상이 되도록 어두운 쪽으로 보정 (이미 넘으면 그대로) */
function ensureContrast(color: string, paper: string, min = 4.6): string {
  let c = color
  for (let t = 0; t <= 1; t += 0.05) {
    c = mix(color, '#2b2620', t)
    const a = lum(c)
    const b = lum(paper)
    if ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= min) return c
  }
  return c
}

/** 두 색을 t(0~1) 비율로 섞음 */
function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

const cover = (
  key: string,
  name: string,
  events: readonly EventType[],
  tone: CoverTone,
  accent: string,
  padX = 24,
  rec: { effect: EffectKind; intro: IntroKind } = { effect: 'none', intro: 'none' },
): CoverDef => {
  const paper = PAPER[key] ?? '#f3ede2'
  const isDark = tone === 'light'
  return {
    key,
    name,
    events,
    tone,
    accent,
    padX,
    effect: rec.effect,
    intro: rec.intro,
    paper,
    surface: isDark ? mix(paper, '#ffffff', 0.08) : mix(paper, '#ffffff', 0.5),
    line: isDark ? mix(paper, '#ffffff', 0.2) : mix(paper, '#4a4239', 0.16),
    sub: isDark ? '#c9c2b4' : ensureContrast('#6b6156', paper),
    point: isDark ? '#d4b77a' : ensureContrast('#8a6a43', paper),
    dark: isDark
      ? {
          ink: '#f1ebdf',
          sub: '#c9c2b4',
          point: '#d4b77a',
          btn: '#d4b77a',
          btnText: '#19273e',
          btnLine: '#5a6784',
        }
      : undefined,
    src: `/covers/${key}`,
  }
}

export const COVERS: readonly CoverDef[] = [
  cover('wedding-poppy', '양귀비', ['wedding'], 'dark', '#a8715f', 24, {
    effect: 'petal',
    intro: 'seal',
  }),
  cover('wedding-rose', '장미', ['wedding'], 'dark', '#a76a64', 26, {
    effect: 'petal',
    intro: 'seal',
  }),
  cover('wedding-peony', '모란', ['wedding'], 'dark', '#b5706f', 25, {
    effect: 'petal',
    intro: 'seal',
  }),
  cover('thanks-wildflower', '들꽃', ['thanks'], 'dark', '#9b6f78', 25, {
    effect: 'leaf',
    intro: 'seal',
  }),
  cover('dol-cloud', '구름', ['dol'], 'dark', '#a5788a', 22, { effect: 'bubble', intro: 'book' }),
  cover('yearend-snow', '눈꽃', ['yearend'], 'light', '#d4af6a', 22, {
    effect: 'snow',
    intro: 'door',
  }),
  cover('prewedding-cheers', '건배', ['prewedding'], 'dark', '#a37b3c', 26, {
    effect: 'party',
    intro: 'door',
  }),
  cover('meetup-ginkgo', '은행잎', ['meetup'], 'dark', '#9a8a76', 26, {
    effect: 'ginkgo',
    intro: 'door',
  }),
  cover('birthday-balloon', '풍선', ['birthday'], 'dark', '#bf6a4c', 28, {
    effect: 'party',
    intro: 'book',
  }),
  cover('housewarming-eucalyptus', '유칼립투스', ['housewarming'], 'dark', '#55724f', 22, {
    effect: 'leaf',
    intro: 'book',
  }),
]

/** 처음 만든 표지 key(11/9)의 새 이름 */
const LEGACY_KEYS: Record<string, string> = {
  rose: 'wedding-rose',
  poppy: 'wedding-poppy',
}

export const COVER_WIDTHS = [800, 1200] as const
/** 그림 비율 (가로:세로 = 4:5) */
export const COVER_RATIO = { w: 4, h: 5 } as const

export function findCover(key: string | null | undefined): CoverDef | undefined {
  if (!key) return undefined
  const k = LEGACY_KEYS[key] ?? key
  return COVERS.find((c) => c.key === k)
}

const fitRank = (c: CoverDef, eventType: string) => {
  const i = (c.events as readonly string[]).indexOf(eventType)
  return i === -1 ? 99 : i
}

/** 이 행사에 어울리는 표지를 앞으로 (나머지도 뒤에 그대로 있음, 같은 순위끼리는 목록 순서) */
export function coversForEvent(eventType: string): CoverDef[] {
  return [...COVERS].sort((a, b) => fitRank(a, eventType) - fitRank(b, eventType))
}

export function coverFits(c: CoverDef, eventType: string): boolean {
  return fitRank(c, eventType) !== 99
}

/** 새 초대장이 처음 쓰는 표지: 행사에 어울리는 첫 표지, 없으면 null(글자만) */
export function defaultCoverKey(eventType: string): string | null {
  const first = coversForEvent(eventType)[0]
  return first && coverFits(first, eventType) ? first.key : null
}

export function coverSrc(c: CoverDef, width: (typeof COVER_WIDTHS)[number]): string {
  return `${c.src}-${width}.webp`
}

export function coverSrcSet(c: CoverDef): string {
  return COVER_WIDTHS.map((w) => `${coverSrc(c, w)} ${w}w`).join(', ')
}

/** 카톡 공유 카드 · og:image용 JPEG (상대 경로, 빌드 때 자동 생성) */
export function coverShareSrc(c: CoverDef): string {
  return `/covers/share/${c.key}.jpg`
}

/** 초대장의 첫 보이는 표지 블록이 디자인 표지면 그 표지 (본문 종이 색을 맞추는 데 씀) */
export function designCoverOf(
  blocks: readonly { type: string; visible: boolean; config: unknown }[],
): CoverDef | undefined {
  const b = blocks.find((x) => x.type === 'cover' && x.visible)
  const c = b?.config as { layout?: string; designKey?: string | null } | undefined
  return c?.layout === 'design' ? findCover(c.designKey) : undefined
}

/** 새 초대장 템플릿이 쓰는 표지 시작값: 그 행사 첫 표지의 추천 효과 · 봉투 */
export function coverStart(eventType: string): { effect: EffectKind; intro: IntroKind } {
  const key = defaultCoverKey(eventType)
  const c = key ? findCover(key) : undefined
  return { effect: c?.effect ?? 'none', intro: c?.intro ?? 'none' }
}
