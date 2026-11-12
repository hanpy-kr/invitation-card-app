import Link from 'next/link'

import Logo from '@/components/site/Logo'
import SiteFooter from '@/components/site/SiteFooter'
import { getSession } from '@/lib/auth/session'
import { getEntitlements } from '@/shared/entitlements'
import { SAMPLE_SLUG } from '@/shared/site'

import styles from './page.module.scss'

export const dynamic = 'force-dynamic'

const LOGIN_ERRORS: Record<string, string> = {
  cancelled: '카카오 로그인을 취소했어요.',
  expired: '로그인 시간이 지났어요. 다시 시도해 주세요.',
  failed: '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  'anon-limit': '오늘은 로그인 없이 더 만들 수 없어요. 카카오로 로그인해 주세요.',
}

function Start({ loggedIn }: { loggedIn: boolean }) {
  return loggedIn ? (
    <Link href="/dashboard" className={styles.kakao}>
      내 초대장으로
    </Link>
  ) : (
    <>
      <a href="/api/auth/kakao/login?next=/new" className={styles.kakao}>
        카카오로 시작하기
      </a>
      <Link href={`/i/${SAMPLE_SLUG}`} className={styles.sample}>
        예시 초대장 보기
      </Link>
      {/* 로그인 없이 먼저 만들어 보기 → 발행할 때 카카오 로그인 */}
      <form action="/api/auth/anonymous" method="post" className={styles.anon}>
        <button type="submit">로그인 없이 먼저 만들어 보기</button>
      </form>
    </>
  )
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>
}) {
  const [{ login }, session] = await Promise.all([searchParams, getSession()])
  const error = login ? LOGIN_ERRORS[login] : undefined
  const loggedIn = Boolean(session)

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Logo href={null} />
        {loggedIn ? (
          <Link href="/dashboard" className={styles.login}>
            내 초대장
          </Link>
        ) : (
          <a href="/api/auth/kakao/login?next=/dashboard" className={styles.login}>
            로그인
          </a>
        )}
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>MOBILE INVITATION</p>
        <h1>
          마음을 담은 초대장,
          <br />
          카톡 링크 하나로
        </h1>
        <p className={styles.lead}>
          결혼식 · 돌잔치 · 송년회 · 모임까지.
          <br />
          5분이면 만들고, 응답은 한곳에서 받아요.
        </p>

        <div className={styles.fan} aria-hidden="true">
          <div className={`${styles.card} ${styles.left}`}>
            <img src="/landing/yearend-snow.webp" alt="" width="150" height="187" loading="eager" />
          </div>
          <div className={`${styles.card} ${styles.right}`}>
            <img
              src="/landing/birthday-balloon.webp"
              alt=""
              width="150"
              height="187"
              loading="eager"
            />
          </div>
          <div className={`${styles.card} ${styles.center}`}>
            <img
              src="/landing/wedding-poppy.webp"
              alt=""
              width="190"
              height="237"
              loading="eager"
              fetchPriority="high"
            />
            <span className={styles.over}>
              <small>2026. 11. 21</small>
              <b>민준 · 서연</b>
            </span>
          </div>
        </div>

        {error ? (
          <p className={styles.alert} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Start loggedIn={loggedIn} />
        </div>
        <p className={styles.free}>무료 · 사진 {getEntitlements().photoLimit}장까지</p>
      </section>

      <section className={styles.why}>
        <p className={styles.eyebrow}>WHY DEARDAY</p>
        <ul>
          <li>
            <strong>5분이면 완성</strong>
            <small>행사를 고르면 문구와 구성이 채워져요</small>
          </li>
          <li>
            <strong>응답이 한곳에</strong>
            <small>참석 · 투표 · 방명록을 대시보드에서 모아 봐요</small>
          </li>
          <li>
            <strong>받는 분은 로그인 없이</strong>
            <small>카톡 링크만 누르면 바로 열려요</small>
          </li>
        </ul>
      </section>

      <SiteFooter />
    </div>
  )
}
