import type { Metadata } from 'next'
import Logo from '@/components/site/Logo'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireSession } from '@/lib/auth/session'
import { getResponses, markSeen } from '@/lib/dashboard'
import { listEditors } from '@/lib/editors'
import { loadHostTools } from '@/lib/host-tools'
import { EVENT_TYPE_LABELS } from '@/shared/blocks'
import { formatLongDate } from '@/shared/date'
import { getMediaBaseUrl } from '@/lib/media'
import { siteUrl } from '@/lib/site'
import { formatWon } from '@/shared/money'
import { absolute, acceptsRsvp, shareImagePath } from '@/shared/share'

import styles from './page.module.scss'
import { GuestbookList, RsvpList } from './Responses'
import AlbumPanel from './AlbumPanel'
import BringPanel from './BringPanel'
import InviteePanel from './InviteePanel'
import SettlementPanel from './SettlementPanel'
import EditorsPanel from './EditorsPanel'
import ResendCards from './ResendCards'
import VotePanel from './VotePanel'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '응답 확인 — dearday', robots: { index: false } }

export default async function ResponsesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession(`/dashboard/${id}`)
  const data = await getResponses(id, session.userId)
  if (!data) notFound()
  const [prevSeen, editors, tools] = await Promise.all([
    markSeen(data.id, session.userId),
    data.isOwner ? listEditors(data.id) : Promise.resolve(null),
    loadHostTools(data.id),
  ])
  const s = data.summary

  return (
    <main className={styles.page}>
      <div style={{ marginBottom: 12 }}>
        <Logo />
      </div>
      <Link href="/dashboard" className={styles.back}>
        ← 내 초대장
      </Link>
      <h1 className={styles.title}>{data.title || EVENT_TYPE_LABELS[data.eventType]}</h1>
      <p className={styles.sub}>
        {data.eventAt ? formatLongDate(data.eventAt) : '날짜 미정'}
        <Link href={`/edit/${data.id}`}>편집</Link>
        {data.status === 'published' ? (
          <Link href={`/i/${data.slug}`} target="_blank">
            초대장 보기
          </Link>
        ) : null}
      </p>

      <dl className={styles.stats}>
        <div className={styles.main}>
          <dt>참석 인원</dt>
          <dd>
            {s.attendees}
            <small>명</small>
          </dd>
        </div>
        <div>
          <dt>참석 응답</dt>
          <dd>
            {s.attendingResponses}
            <small>건</small>
          </dd>
        </div>
        <div>
          <dt>불참</dt>
          <dd>
            {s.declined}
            <small>건</small>
          </dd>
        </div>
      </dl>
      {data.askMeal ? (
        <p className={styles.meal}>
          식사 {s.mealYes}명 · 안 함 {s.mealNo}명 · 미정 {s.mealUndecided}명
        </p>
      ) : (
        <div style={{ height: 20 }} />
      )}

      <p className={styles.meal}>
        열람 {data.views}회
        {data.views > 0
          ? ` · 응답률 ${Math.min(100, Math.round((data.rsvps.length / data.views) * 100))}%`
          : ''}
        <small className={styles.hint}> (같은 기기는 하루 한 번만 셈)</small>
      </p>

      {data.dues ? (
        <div className={styles.dues}>
          <div>
            <span>예상 회비</span>
            <strong>{formatWon(data.dues.expected)}</strong>
            <small>
              참석 {s.attendees}명 × {formatWon(data.dues.perPerson)}
            </small>
          </div>
          <div>
            <span>입금 확인</span>
            <strong>{data.dues.paidPeople}명</strong>
            <small>
              {formatWon(data.dues.paidAmount)} · 응답 {data.dues.paidResponses}건
            </small>
          </div>
        </div>
      ) : null}

      {data.status === 'published' ? (
        <ResendCards
          input={data.shareInput}
          url={`${siteUrl()}/i/${data.slug}`}
          imageUrl={absolute(siteUrl(), shareImagePath(data.shareInput, getMediaBaseUrl()))}
          deadline={data.rsvpDeadline}
          kakaoJsKey={process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? ''}
          acceptsRsvp={acceptsRsvp(data.shareInput.blocks)}
        />
      ) : null}

      {data.hasAlbum ? (
        <AlbumPanel invitationId={data.id} mediaBaseUrl={getMediaBaseUrl()} title={data.title} />
      ) : null}

      {data.vote ? (
        <VotePanel
          invitationId={data.id}
          config={data.vote.config}
          options={data.vote.options}
          results={data.vote.results}
          voters={data.vote.voters}
        />
      ) : null}

      {data.bring ? <BringPanel invitationId={data.id} bring={data.bring} /> : null}

      {data.choiceStats.map((q) => (
        <div key={q.id} className={styles.choice}>
          <h3>{q.label}</h3>
          <ul>
            {q.rows.map((r) => (
              <li key={r.label}>
                <span>{r.label}</span>
                <strong>{r.count}건</strong>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>참석 응답 {data.rsvps.length}건</h2>
          {data.rsvps.length > 0 ? (
            <a href={`/api/invitations/${data.id}/rsvps.csv`} download className={styles.csv}>
              엑셀로 받기
            </a>
          ) : null}
        </div>
        <RsvpList
          invitationId={data.id}
          initial={data.rsvps}
          askMeal={data.askMeal}
          questions={data.questions}
          dues={Boolean(data.dues)}
          seenAt={prevSeen?.toISOString() ?? null}
        />
      </section>

      <InviteePanel
        invitationId={data.id}
        initialNames={tools.invitees}
        rsvps={data.rsvps.map((r) => ({ name: r.name, attending: r.attending }))}
        url={data.status === 'published' ? `${siteUrl()}/i/${data.slug}` : null}
        title={data.title}
        deadline={data.rsvpDeadline ? formatLongDate(data.rsvpDeadline) : null}
      />

      {data.dues ? (
        <SettlementPanel
          invitationId={data.id}
          title={data.title}
          perPerson={data.dues.perPerson}
          paidPeople={data.dues.paidPeople}
          attendees={s.attendees}
          initialExpenses={tools.expenses}
          initialShow={tools.showGuests}
        />
      ) : null}

      {editors ? <EditorsPanel invitationId={data.id} editors={editors} /> : null}

      <section className={styles.section}>
        <h2>방명록 {data.guestbook.length}개</h2>
        <GuestbookList invitationId={data.id} initial={data.guestbook} />
      </section>
    </main>
  )
}
