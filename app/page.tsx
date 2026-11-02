import Link from 'next/link'

import SiteFooter from '@/components/site/SiteFooter'
import { getSession } from '@/lib/auth/session'
import { preloadDisplayFont } from '@/lib/fonts/display-font'

import styles from './page.module.scss'

export const dynamic = 'force-dynamic'

const LOGIN_ERRORS: Record<string, string> = {
  cancelled: '카카오 로그인을 취소했어요.',
  expired: '로그인 시간이 지났어요. 다시 시도해 주세요.',
  failed: '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
}

const TYPES = [
  { emoji: '💍', name: '결혼식', sub: '모바일 청첩장' },
  { emoji: '🎂', name: '돌잔치', sub: '첫 생일 초대장' },
  { emoji: '🍻', name: '회식 · 동창회', sub: '송년회 · 모임' },
  { emoji: '✉️', name: '그 밖의 모임', sub: '어떤 행사든' },
]

function Start({ loggedIn }: { loggedIn: boolean }) {
  return loggedIn ? (
    <Link href="/dashboard" className={styles.kakao}>
      내 초대장으로
    </Link>
  ) : (
    <a href="/api/auth/kakao/login?next=/new" className={styles.kakao}>
      카카오로 시작하기
    </a>
  )
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>
}) {
  const [{ login }, session] = await Promise.all([searchParams, getSession()])
  const error = login ? LOGIN_ERRORS[login] : undefined
  // 로고 'dearday'는 손글씨 폰트 — 해당 조각만 미리 받기
  preloadDisplayFont('dearday')

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.logo}>dearday</div>
        <h1>
          초대장, 링크 하나로
          <br />
          카톡에 보내세요
        </h1>
        <p>
          결혼식 · 돌잔치 · 모임 초대장을 5분 만에.
          <br />
          참석 여부와 축하 메시지도 한곳에서 받아요.
        </p>
        {error ? (
          <p className={styles.alert} role="alert">
            {error}
          </p>
        ) : null}
        <Start loggedIn={Boolean(session)} />
        <p className={styles.free}>무료 · 사진 10장까지</p>
      </header>

      <section className={styles.section}>
        <h2>어떤 자리든</h2>
        <ul className={styles.types}>
          {TYPES.map((t) => (
            <li key={t.name}>
              <span aria-hidden>{t.emoji}</span>
              <strong>{t.name}</strong>
              <small>{t.sub}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>이렇게 만들어요</h2>
        <ol className={styles.steps}>
          <li>
            <div>
              <strong>행사 종류 고르기</strong>
              <small>기본 문구와 구성이 채워져요</small>
            </div>
          </li>
          <li>
            <div>
              <strong>사진 · 날짜 · 장소 넣기</strong>
              <small>고치면서 바로 미리보기로 확인</small>
            </div>
          </li>
          <li>
            <div>
              <strong>발행하고 카톡으로 보내기</strong>
              <small>받는 사람은 로그인 없이 바로 열어요</small>
            </div>
          </li>
        </ol>
      </section>

      <section className={styles.section}>
        <h2>받는 사람도 편하게</h2>
        <ul className={styles.features}>
          <li>
            <strong>참석 여부 모아 보기</strong>
            <small>참석 인원 · 식사 인원이 자동으로 합산돼요</small>
          </li>
          <li>
            <strong>지도와 길찾기</strong>
            <small>카카오맵 · 네이버지도 · 티맵으로 바로 연결</small>
          </li>
          <li>
            <strong>사진첩과 방명록</strong>
            <small>사진을 넘겨 보고, 축하 한마디를 남겨요</small>
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${styles.bottom}`}>
        <Start loggedIn={Boolean(session)} />
      </section>

      <SiteFooter />
    </div>
  )
}
