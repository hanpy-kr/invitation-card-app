/**
 * 초대 명단 체크 도우미 (대시보드 전용 · zod 없이). 이름만 다룬다 — 연락처는 받지 않음.
 */
export const MAX_INVITEES = 300
export const INVITEE_NAME_MAX = 20

/** 같은 이름 판정: 공백(모든 종류) 제거 + 유니코드 정규화 + 영문 소문자 */
export function normalizeName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '').toLowerCase()
}

export type ParsedInvitees =
  { ok: true; names: string[]; duplicates: number } | { ok: false; error: string }

/** 줄바꿈 · 쉼표(,，、) · 세미콜론으로 나눈 이름 목록. 같은 이름(공백 차이 포함)은 하나로, 앞에 나온 표기를 씀 */
export function parseInvitees(text: string): ParsedInvitees {
  const seen = new Set<string>()
  const names: string[] = []
  let duplicates = 0
  for (const raw of text.split(/[\n\r,，、;；]+/)) {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) continue
    if (name.length > INVITEE_NAME_MAX)
      return { ok: false, error: `이름은 ${INVITEE_NAME_MAX}자까지예요. (${name.slice(0, 8)}…)` }
    const key = normalizeName(name)
    if (seen.has(key)) {
      duplicates++
      continue
    }
    seen.add(key)
    names.push(name)
  }
  if (names.length > MAX_INVITEES)
    return { ok: false, error: `명단은 최대 ${MAX_INVITEES}명까지예요. (지금 ${names.length}명)` }
  return { ok: true, names, duplicates }
}

export type InviteeRsvp = { name: string; attending: boolean }
export type InviteeMatch = {
  responded: { name: string; attending: boolean }[]
  pending: string[]
  /** 명단에 없는 이름으로 온 응답 수 */
  extra: number
}

/** 명단 이름과 응답 이름 맞추기. 같은 사람이 여러 번 응답하면 가장 마지막(목록 앞쪽) 응답 기준 */
export function matchInvitees(names: string[], rsvps: InviteeRsvp[]): InviteeMatch {
  const byKey = new Map<string, InviteeRsvp>()
  for (const r of rsvps) {
    const k = normalizeName(r.name)
    if (!byKey.has(k)) byKey.set(k, r)
  }
  const listed = new Set(names.map(normalizeName))
  const responded: InviteeMatch['responded'] = []
  const pending: string[] = []
  for (const n of names) {
    const r = byKey.get(normalizeName(n))
    if (r) responded.push({ name: n, attending: r.attending })
    else pending.push(n)
  }
  const extra = [...byKey.keys()].filter((k) => !listed.has(k)).length
  return { responded, pending, extra }
}

/** 단톡방에 붙일 문구 — 이름은 넣지 않는다 (누가 안 했는지 모두에게 드러나지 않게) */
export function reminderText(input: {
  title: string
  url: string
  deadline: string | null
}): string {
  const lines = [
    `[${input.title || '초대장'}] 아직 참석 여부를 못 받은 분이 계세요 🙏`,
    input.deadline
      ? `${input.deadline}까지 아래 링크에서 알려 주세요.`
      : '편하실 때 아래 링크에서 알려 주세요.',
    input.url,
  ]
  return lines.join('\n')
}
