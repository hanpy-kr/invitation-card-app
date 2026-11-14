import Link from 'next/link'

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
    <Link href="/dashboard" className={styles.primary}>
      내 초대장으로
    </Link>
  ) : (
    <>
      <a href="/api/auth/kakao/login?next=/new" className={styles.primary}>
        초대장 만들기
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
        <span className={styles.brand}>dearday</span>
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
        <h1>
          마음을 담은 초대장,
          <br />
          카톡 링크 하나로
        </h1>
        <p className={styles.lead}>
          결혼식부터 돌잔치, 송년회까지.
          <br />
          5분이면 만들고, 누가 오는지 바로 알 수 있어요.
        </p>

        {/* 엽서 3장 묶음 + 꿀색 띠지 (시안 E) */}
        <div className={styles.stack} aria-hidden="true">
          <img
            className={`${styles.card} ${styles.back1}`}
            src="/landing/yearend-snow.webp"
            alt=""
            width="176"
            height="220"
            loading="eager"
          />
          <img
            className={`${styles.card} ${styles.back2}`}
            src="/landing/birthday-balloon.webp"
            alt=""
            width="176"
            height="220"
            loading="eager"
          />
          <img
            className={`${styles.card} ${styles.front}`}
            src="/landing/wedding-peony.webp"
            alt=""
            width="176"
            height="220"
            loading="eager"
            fetchPriority="high"
          />
          <span className={styles.band}>
            <b>dearday</b>
            <small>마음을 담은 초대장</small>
          </span>
          <span className={styles.floor} />
        </div>

        {error ? (
          <p className={styles.alert} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Start loggedIn={loggedIn} />
        </div>
        <p className={styles.free}>
          {loggedIn
            ? `무료 · 사진 ${getEntitlements().photoLimit}장까지`
            : '카카오 계정으로 바로 시작해요 · 무료'}
        </p>
      </section>

      <section className={styles.why}>
        <ul>
          <li>
            <strong>5분이면 충분해요</strong>
            <small>행사만 고르면 인사말과 순서가 미리 채워져 있어요</small>
          </li>
          <li>
            <strong>누가 오는지 한눈에</strong>
            <small>참석 여부와 축하 글을 내 초대장에서 바로 확인해요</small>
          </li>
          <li>
            <strong>받는 분은 링크만 누르면 끝</strong>
            <small>앱 설치나 로그인 없이 카톡에서 바로 열려요</small>
          </li>
        </ul>
      </section>

      <SiteFooter className={styles.footer} />
    </div>
  )
}
