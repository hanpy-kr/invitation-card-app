'use client'

import Link from 'next/link'
import { useState } from 'react'

import { copyText } from '@/components/blocks/common/CopyButton'
import { loadKakaoSdk } from '@/shared/kakao-sdk'
import type { KakaoFeed } from '@/shared/share'

import styles from './page.module.scss'

/** 하객 화면 맨 아래: 친구에게 공유 · 링크 복사 · 워드마크(나도 만들기) */
export default function GuestFooter({
  slug,
  url,
  feed,
  kakaoJsKey,
  showMadeWith,
  makeOwnNote,
}: {
  slug: string
  url: string
  feed: KakaoFeed
  kakaoJsKey: string
  showMadeWith: boolean
  /** 나도 만들기 아래 한 줄(시즌 문구). 없으면 안 보임 */
  makeOwnNote?: string | null
}) {
  const [msg, setMsg] = useState('')

  async function shareKakao() {
    setMsg('')
    try {
      // 카카오 SDK는 누를 때 불러온다 (첫 화면 JS에서 제외)
      const Kakao = await loadKakaoSdk(kakaoJsKey)
      Kakao.Share.sendDefault(feed)
    } catch {
      setMsg('카카오톡 공유를 열지 못했어요. 링크를 복사해서 보내 주세요.')
    }
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.shareCard}>
        <div className={styles.shareButtons}>
          {kakaoJsKey ? (
            <>
              <button type="button" className={styles.kakao} onClick={shareKakao}>
                <span className={styles.lblOld}>친구에게 공유</span>
                <span className={styles.lblNew}>카카오톡 공유</span>
              </button>
              <span className={styles.dot} aria-hidden>
                ·
              </span>
            </>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              if (await copyText(url)) setMsg('링크를 복사했어요.')
            }}
          >
            링크 복사
          </button>
        </div>
        {msg ? (
          <p className={styles.shareMsg} role="status">
            {msg}
          </p>
        ) : null}
      </div>
      {/* 맨 아래: 자간 넓힌 워드마크 + 나도 만들기 + 저작권 줄 (참고: 청첩장 사이트 하단 서명) */}
      {showMadeWith ? (
        <div className={styles.brand}>
          <Link href="/" className={styles.wordmark} aria-label="dearday 홈">
            DEARDAY
          </Link>
          <p className={styles.copyright}>Copyright © 2026. dearday. All rights reserved.</p>
          <Link href={`/new?from=${slug}`} className={styles.makeOwn}>
            이 디자인으로 나도 만들기
          </Link>
          {makeOwnNote ? <p className={styles.makeOwnNote}>{makeOwnNote}</p> : null}
        </div>
      ) : null}
    </footer>
  )
}
