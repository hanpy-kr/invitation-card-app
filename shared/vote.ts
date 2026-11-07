/**
 * 투표 도우미 — zod 없이 (하객 번들 · 서버 공용).
 */
import { formatEventDateTime } from './date'

export type VoteKind = 'date' | 'place' | 'text'
export type VoteOptionLike = { id: string; label: string; at: string | null; address: string }
type VoteBlockLike = { type: string; visible: boolean; config: unknown }
type VoteConfigLike = { kind: VoteKind; status: 'open' | 'closed'; options: VoteOptionLike[] }

export const VOTE_KIND_LABELS: Record<VoteKind, string> = {
  date: '날짜',
  place: '장소',
  text: '자유 글',
}

/** 후보로 쓸 수 있는지 (날짜는 일시, 장소 · 자유는 글이 있어야) */
export function isUsableOption(kind: VoteKind, o: VoteOptionLike): boolean {
  return kind === 'date' ? Boolean(o.at) : o.label.trim() !== ''
}

export function usableOptions(config: { kind: VoteKind; options: VoteOptionLike[] }) {
  return config.options.filter((o) => isUsableOption(config.kind, o))
}

/** 후보 제목 (날짜 투표는 일시, 메모는 따로) */
export function optionTitle(kind: VoteKind, o: VoteOptionLike): string {
  if (kind === 'date' && o.at) return formatEventDateTime(o.at)
  return o.label
}

export function optionSub(kind: VoteKind, o: VoteOptionLike): string {
  if (kind === 'date') return o.label
  if (kind === 'place') return o.address
  return ''
}

function voteBlock(blocks: VoteBlockLike[]): VoteConfigLike | null {
  const b = blocks.find((x) => x.type === 'vote' && x.visible)
  return b ? (b.config as VoteConfigLike) : null
}

/** 날짜 투표 중이면 표지 · 공유 카드에서 날짜 대신 '날짜 투표 중' */
export function isDateVoting(blocks: VoteBlockLike[]): boolean {
  const v = voteBlock(blocks)
  return Boolean(v && v.kind === 'date' && v.status === 'open' && usableOptions(v).length > 0)
}

export type VoteResult = { id: string; count: number; names: string[] }
export type VoteResults = { results: VoteResult[]; voters: number }
