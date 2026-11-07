import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { requireSession } from '@/lib/auth/session'
import { adminStats, isAdmin } from '@/lib/stats'
import { EVENT_TYPE_LABELS, EVENT_TYPE_ORDER, type EventType } from '@/shared/blocks'

import styles from './page.module.scss'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '운영 지표 — dearday', robots: { index: false } }

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–')

/** 운영 지표: 환경변수 ADMIN_KAKAO_IDS에 있는 카카오 회원만 (비어 있으면 아무도 못 봄 → 404) */
export default async function AdminStatsPage() {
  const session = await requireSession('/admin/stats')
  if (!(await isAdmin(session.userId))) notFound()
  const { published, funnel, sources } = await adminStats()

  const weeks = funnel.map((f) => f.week)
  const types = EVENT_TYPE_ORDER.filter((t) => published.some((p) => p.event_type === t))
  const pub = (week: string, t: EventType) =>
    published.find((p) => p.week === week && p.event_type === t)?.n ?? 0

  return (
    <main className={styles.page}>
      <h1>운영 지표</h1>
      <p className={styles.note}>최근 8주 · 한국 시간 월요일 시작 · 열람은 기기당 하루 1회</p>

      <h2>주간 발행 수 (행사 종류별)</h2>
      <div className={styles.scroll}>
        <table>
          <thead>
            <tr>
              <th>주</th>
              {types.map((t) => (
                <th key={t}>{EVENT_TYPE_LABELS[t]}</th>
              ))}
              <th>합계</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w}>
                <td>{w.slice(5)}</td>
                {types.map((t) => (
                  <td key={t}>{pub(w, t)}</td>
                ))}
                <td>{types.reduce((n, t) => n + pub(w, t), 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>열람 → 응답 · 하객 → 주최자</h2>
      <div className={styles.scroll}>
        <table>
          <thead>
            <tr>
              <th>주</th>
              <th>열람</th>
              <th>응답</th>
              <th>응답 전환</th>
              <th>나도 만들기</th>
              <th>그중 발행</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map((f) => (
              <tr key={f.week}>
                <td>{f.week.slice(5)}</td>
                <td>{f.views}</td>
                <td>{f.responses}</td>
                <td>{pct(f.responses, f.views)}</td>
                <td>{f.from_guest}</td>
                <td>{f.from_guest_published}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>나도 만들기가 많이 나온 초대장</h2>
      {sources.length === 0 ? (
        <p className={styles.note}>아직 없어요.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>원본</th>
              <th>만든 수</th>
              <th>발행</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.slug}>
                <td>/i/{s.slug}</td>
                <td>{s.n}</td>
                <td>{s.published}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
