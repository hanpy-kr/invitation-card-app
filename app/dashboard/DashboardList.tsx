'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { copyText } from '@/components/blocks/common/CopyButton'

import CardMenu from './CardMenu'
import styles from './DashboardList.module.scss'

export type CardItem = {
  id: string
  slug: string
  title: string
  eventType: string
  typeLabel: string
  published: boolean
  /** 2027. 12. 26 일요일 */
  dateLabel: string | null
  /** 12.26 */
  shortDate: string | null
  /** 오후 5시 30분 */
  timeLabel: string | null
  /** 날짜 타일용: 26 · DEC · 2027 */
  day: string | null
  monthShort: string | null
  year: string | null
  /** 표지 사진 주소(사진 표지일 때만) */
  cover: string | null
  /** D-403 (발행됨 + 행사 전일 때만) */
  dday: string | null
  plan: 'paid' | 'perk' | 'refunded' | null
  attendees: number
  responses: number
  /** 참석 응답 수 / 불참 응답 수 (막대용) */
  attendingResponses: number
  declined: number
  newResponses: number
  isOwner: boolean
  paid: boolean
  /** 관리자에게만 보이는 허브 확인 줄 */
  hubLine: string | null
}

type View = 'v' | 'h'
const KEY = 'dearday.dashView'

export default function DashboardList({ items }: { items: CardItem[] }) {
  const [view, setView] = useState<View>('v')

  // 저장된 보기 방식 적용(서버 렌더는 세로형). 저장소를 못 쓰면 세로형 그대로
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY)
      if (v === 'h' || v === 'v') setView(v)
    } catch {
      // 무시
    }
  }, [])

  function pick(v: View) {
    setView(v)
    try {
      window.localStorage.setItem(KEY, v)
    } catch {
      // 무시
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <span>초대장 {items.length}개</span>
        <div className={styles.toggle} role="group" aria-label="보기 방식">
          <button
            type="button"
            aria-pressed={view === 'v'}
            aria-label="세로형 보기"
            data-testid="view-v"
            onClick={() => pick('v')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="3.5" width="14" height="17" rx="2.2" />
              <path d="M5 11h14" />
            </svg>
          </button>
          <button
            type="button"
            aria-pressed={view === 'h'}
            aria-label="가로형 보기"
            data-testid="view-h"
            onClick={() => pick('h')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="5" rx="1.6" />
              <rect x="3.5" y="14" width="17" height="5" rx="1.6" />
            </svg>
          </button>
        </div>
      </div>
      <ul className={view === 'v' ? styles.listV : styles.listH} data-view={view}>
        {items.map((it) => (
          <li key={it.id}>{view === 'v' ? <CardV it={it} /> : <CardH it={it} />}</li>
        ))}
      </ul>
    </>
  )
}

function planText(p: CardItem['plan']) {
  return p === 'paid' ? '★ 프리미엄 · 결제' : p === 'perk' ? '프리미엄 · 무료 혜택' : p === 'refunded' ? '환불됨' : ''
}

/** 표지 사진이 없을 때: 큰 음각 날짜 숫자 */
function DateTile({ it, small }: { it: CardItem; small?: boolean }) {
  return (
    <div className={small ? styles.tileSmall : styles.tileBig} aria-hidden="true">
      {it.day ? (
        <>
          <b>{it.day}</b>
          <i>
            {it.monthShort}
            {!small && it.year ? ` · ${it.year}` : ''}
          </i>
        </>
      ) : (
        <>
          <span className={styles.tbdLine} />
          <i>TBD</i>
        </>
      )}
    </div>
  )
}

function ShareButton({ slug, title }: { slug: string; title: string }) {
  const [done, setDone] = useState(false)
  async function share() {
    const url = `${window.location.origin}/i/${slug}`
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    if (await copyText(url)) {
      setDone(true)
      setTimeout(() => setDone(false), 1800)
    }
  }
  return (
    <button type="button" onClick={share}>
      {done ? '링크 복사됨' : '공유'}
    </button>
  )
}

function Menu({ it, inline }: { it: CardItem; inline?: boolean }) {
  return (
    <CardMenu
      id={it.id}
      slug={it.slug}
      title={it.title}
      dateLabel={it.dateLabel}
      eventType={it.eventType}
      published={it.published}
      isOwner={it.isOwner}
      paid={it.paid}
      inline={inline}
    />
  )
}

function CardV({ it }: { it: CardItem }) {
  const has = it.published || it.responses > 0
  const answered = it.attendingResponses + it.declined
  const pct = answered > 0 ? Math.round((it.attendingResponses / answered) * 100) : 0
  return (
    <article className={styles.v}>
      <Link href={`/edit/${it.id}`} className={styles.vLink}>
        <div className={styles.hero}>
          {it.cover ? (
            <img src={it.cover} alt="" loading="lazy" decoding="async" />
          ) : (
            <DateTile it={it} />
          )}
          <span className={styles.fade} />
          {it.cover && it.day ? (
            <span className={styles.dateChip} aria-hidden="true">
              <b>{it.day}</b>
              <i>{it.monthShort}</i>
            </span>
          ) : null}
          <span
            className={styles.state}
            role="img"
            aria-label={it.published ? '발행됨' : '작성 중'}
            data-published={it.published}
          >
            {it.published ? 'PUBLISHED' : 'DRAFT'}
          </span>
          {it.dday ? <span className={styles.dday}>{it.dday}</span> : null}
        </div>
        <div className={styles.vBody}>
          <div className={styles.vTitle}>{it.title}</div>
          <div className={styles.meta}>
            {it.typeLabel}
            {it.dateLabel ? ` · ${it.dateLabel}` : ' · 날짜 미정'}
            {it.timeLabel ? ` · ${it.timeLabel}` : ''}
          </div>
          {it.plan ? (
            <span
              className={`${styles.plan} ${it.plan === 'paid' ? styles.planPaid : styles.planPerk}`}
              data-testid="plan-badge"
            >
              {it.plan === 'paid' ? '프리미엄 · 결제' : planText(it.plan)}
            </span>
          ) : null}
        </div>
      </Link>
      <div className={styles.vFoot}>
        {has ? (
          <div className={styles.stats}>
            <span>
              <b>{it.attendees}</b>참석
            </span>
            <span className={styles.res}>응답 {it.responses}</span>
            {it.newResponses > 0 ? (
              <Link href={`/dashboard/${it.id}`} className={styles.newCount}>
                새 응답 {it.newResponses}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className={styles.empty}>발행하면 참석 · 응답이 여기에 모여요</div>
        )}
        {has && answered > 0 ? (
          <div
            className={styles.bar}
            role="img"
            aria-label={`참석 ${it.attendingResponses}건, 불참 ${it.declined}건`}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <Menu it={it} />
      {!it.isOwner ? <div className={styles.note}>함께 편집 중인 초대장</div> : null}
      {it.hubLine ? (
        <div className={styles.note} data-testid="admin-hub">
          {it.hubLine}
        </div>
      ) : null}
      <nav className={styles.bar3} aria-label="초대장 작업">
        <Link href={`/edit/${it.id}`}>편집</Link>
        <Link href={`/dashboard/${it.id}`}>응답 보기</Link>
        {it.published ? <ShareButton slug={it.slug} title={it.title} /> : null}
      </nav>
    </article>
  )
}

function CardH({ it }: { it: CardItem }) {
  const has = it.published || it.responses > 0
  return (
    <article className={styles.h}>
      <Link href={`/edit/${it.id}`} className={styles.hLink}>
        <div className={styles.thumb}>
          {it.cover ? (
            <img src={it.cover} alt="" loading="lazy" decoding="async" />
          ) : (
            <DateTile it={it} small />
          )}
          {it.newResponses > 0 ? (
            <span className={styles.dot} aria-label={`새 응답 ${it.newResponses}`}>
              {it.newResponses}
            </span>
          ) : null}
        </div>
        <div className={styles.hMid}>
          <div className={styles.hState}>
            <i data-published={it.published} aria-hidden="true" />
            {it.published ? '발행됨' : '작성 중'}
            {it.plan === 'paid' ? (
              <span className={styles.star} data-testid="plan-badge" aria-label="프리미엄 · 결제">
                ★
              </span>
            ) : null}
          </div>
          <div className={styles.hTitle}>{it.title}</div>
          <div className={styles.hMeta}>
            {it.typeLabel} · {it.shortDate ?? '날짜 미정'}
            {it.dday ? <span className={styles.ddayS}>{it.dday}</span> : null}
          </div>
        </div>
        {has ? (
          <div className={styles.hStats}>
            <div>
              <b>{it.attendees}</b>
              <span>참석</span>
            </div>
            <div className={styles.dim}>
              <b>{it.responses}</b>
              <span>응답</span>
            </div>
          </div>
        ) : (
          <div className={styles.hWait}>발행 전</div>
        )}
      </Link>
      <Menu it={it} inline />
      {it.hubLine ? (
        <div className={styles.note} data-testid="admin-hub">
          {it.hubLine}
        </div>
      ) : null}
    </article>
  )
}
