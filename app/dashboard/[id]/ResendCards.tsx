'use client'

import { useState } from 'react'

import { loadKakaoSdk } from '@/shared/kakao-sdk'
import { resendFeed, type KakaoFeed, type ShareInput } from '@/shared/share'

import styles from './page.module.scss'

/** 다시 보내기: 문구만 다른 카카오 공유 카드 (서버가 보내는 게 아니라 주최자가 단톡방에 공유) */
export default function ResendCards({
  input,
  url,
  imageUrl,
  deadline,
  kakaoJsKey,
  acceptsRsvp,
}: {
  input: ShareInput
  url: string
  imageUrl: string
  deadline: string | null
  kakaoJsKey: string
  acceptsRsvp: boolean
}) {
  const [msg, setMsg] = useState('')
  const cards: { kind: 'reminder' | 'dayBefore'; label: string; feed: KakaoFeed }[] = []
  if (acceptsRsvp)
    cards.push({
      kind: 'reminder',
      label: '응답 안 한 분께 다시 보내기',
      feed: resendFeed('reminder', input, { url, imageUrl, deadline }),
    })
  if (input.eventAt)
    cards.push({
      kind: 'dayBefore',
      label: '전날 안내 보내기',
      feed: resendFeed('dayBefore', input, { url, imageUrl, deadline }),
    })
  if (cards.length === 0) return null

  async function send(feed: KakaoFeed) {
    setMsg('')
    try {
      const Kakao = await loadKakaoSdk(kakaoJsKey)
      Kakao.Share.sendDefault(feed)
    } catch {
      setMsg('카카오톡 공유를 열지 못했어요.')
    }
  }

  return (
    <section className={styles.section}>
      <h2>다시 보내기</h2>
      <p className={styles.hint}>
        단톡방에 다시 올릴 카카오톡 카드예요. 누가 응답 안 했는지는 따로 보내지 않아요.
      </p>
      <ul className={styles.resend}>
        {cards.map((c) => (
          <li key={c.kind}>
            <div>
              <strong>{c.feed.content.title}</strong>
              <small>{c.feed.content.description}</small>
            </div>
            <button
              type="button"
              disabled={!kakaoJsKey}
              aria-label={c.label}
              onClick={() => void send(c.feed)}
            >
              {c.label}
            </button>
          </li>
        ))}
      </ul>
      {msg ? <p className={styles.hint}>{msg}</p> : null}
    </section>
  )
}
