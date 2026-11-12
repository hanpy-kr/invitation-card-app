'use client'

import Link from 'next/link'
import { useState } from 'react'

import { copyText } from '@/components/blocks/common/CopyButton'
import { loadKakaoSdk } from '@/shared/kakao-sdk'
import type { KakaoFeed } from '@/shared/share'

import Seal from '@/components/site/Seal'

import styles from './page.module.scss'

/** 하객 화면 맨 아래: 친구에게 공유 · 링크 복사 · 이 디자인으로 나도 만들기 */
export default function GuestFooter({
  slug,
  url,
  feed,
  kakaoJsKey,
  showMadeWith,
}: {
  slug: string
  url: string
  feed: KakaoFeed
  kakaoJsKey: string
  showMadeWith: boolean
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
        <p>이 초대장을 친구에게도 알려 주세요</p>
        <div className={styles.shareButtons}>
          {kakaoJsKey ? (
            <button type="button" className={styles.kakao} onClick={shareKakao}>
              친구에게 공유
            </button>
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
      {showMadeWith ? (
        <>
          <Link href={`/new?from=${slug}`} className={styles.makeOwn}>
            <strong>이 디자인으로 나도 만들기</strong>
            <span>로그인하고 1분이면 내 초대장이 생겨요 · 무료</span>
          </Link>
          <p className={styles.madeWith}>
            <Link href="/" className={styles.madeLink}>
              <Seal size={22} />
              <span>dearday로 만들었어요</span>
            </Link>
          </p>
        </>
      ) : null}
    </footer>
  )
}
