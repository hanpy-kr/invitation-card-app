import type { Metadata } from 'next'
import Logo from '@/components/site/Logo'
import Link from 'next/link'

import SiteFooter from '@/components/site/SiteFooter'
import { BUSINESS } from '@/shared/business'
import { getEntitlements } from '@/shared/entitlements'

import styles from './help.module.scss'

export const metadata: Metadata = {
  title: '도움말 — dearday',
  description: 'dearday 초대장 만들기 · 공유 · 응답 확인 자주 묻는 질문',
}

/** 카카오톡 채널 문의 주소. ⏸ 채널 개설 후 넣기 (비어 있으면 이메일만 보임) */
const KAKAO_CHANNEL_URL = ''

type Faq = { q: string; a: React.ReactNode }

const SECTIONS: { title: string; items: Faq[] }[] = [
  {
    title: '만들기',
    items: [
      {
        q: '초대장은 어떻게 만드나요?',
        a: (
          <>
            카카오로 로그인한 뒤 행사 종류를 고르면 기본 구성이 채워진 초대장이 생겨요. 블록을 눌러
            글과 사진을 바꾸고, 필요 없는 블록은 숨기거나 지우면 돼요. 고친 내용은 자동으로
            저장돼요.
          </>
        ),
      },
      {
        q: '돈이 드나요?',
        a: <>지금은 모든 기능을 무료로 쓸 수 있어요.</>,
      },
      {
        q: '받은 초대장처럼 만들고 싶어요.',
        a: (
          <>
            받은 초대장 맨 아래 <b>[이 디자인으로 나도 만들기]</b>를 누르면 같은 행사 종류 · 색 ·
            블록 구성으로 새 초대장이 생겨요. 원래 초대장의 글 · 사진 · 계좌 · 연락처는 가져오지
            않으니 내 내용으로 채워 주세요.
          </>
        ),
      },
    ],
  },
  {
    title: '사진',
    items: [
      {
        q: '사진은 몇 장까지 올릴 수 있나요?',
        a: (
          <>
            초대장 하나에 {getEntitlements().photoLimit}장까지예요(표지 · 사진첩 · 카톡 카드 사진
            합계). 올릴 때 휴대폰에서 알맞은 크기로 줄여서 올려요.
          </>
        ),
      },
    ],
  },
  {
    title: '공유',
    items: [
      {
        q: '카카오톡으로 어떻게 보내나요?',
        a: (
          <>
            편집 화면 오른쪽 위 <b>[발행하기]</b>를 누른 뒤 <b>[카카오톡으로 보내기]</b>를 누르세요.
            링크를 복사해서 문자나 다른 메신저로 보내도 돼요.
          </>
        ),
      },
      {
        q: '카톡 미리보기(카드)의 제목이나 사진을 바꾸고 싶어요.',
        a: (
          <>
            발행 창의 <b>카톡 미리보기 → [카드 바꾸기]</b>에서 제목 · 설명 · 사진을 따로 정할 수
            있어요. 이미 보낸 메시지의 미리보기는 카카오톡이 잠시 기억해 두기 때문에 바로 바뀌지
            않을 수 있어요. 새로 보내는 메시지부터 바뀐 카드가 보여요.
          </>
        ),
      },
      {
        q: '발행한 뒤에 고쳐도 되나요?',
        a: <>네. 고친 내용은 이미 보낸 링크에도 바로 반영돼요.</>,
      },
    ],
  },
  {
    title: '응답 확인',
    items: [
      {
        q: '누가 온다고 했는지 어디서 보나요?',
        a: (
          <>
            <b>내 초대장 → 응답 보기</b>에서 참석 인원 · 불참 · 질문별 답을 볼 수 있어요.
            <b> [엑셀로 받기]</b>를 누르면 응답 전체를 엑셀 파일(CSV)로 받을 수 있어요.
          </>
        ),
      },
      {
        q: '메뉴처럼 하객에게 더 묻고 싶은 게 있어요.',
        a: (
          <>
            참석 여부 블록의 <b>[질문 추가]</b>로 최대 5개까지 물어볼 수 있어요(선택 · 짧은 글 ·
            숫자). 전화번호 · 주소 같은 연락처는 묻지 말아 주세요.
          </>
        ),
      },
    ],
  },
  {
    title: '계좌 · 회비',
    items: [
      {
        q: '축의금이나 회비를 dearday가 받아 주나요?',
        a: (
          <>
            아니요. dearday는 돈을 받거나 보관하지 않아요. 계좌 블록은 주최자가 적은 계좌번호를 보여
            주고, 하객이 복사하거나 토스 · 카카오페이 앱으로 바로 보낼 수 있게 연결만 해요.
            계좌번호는 링크를 받은 누구나 볼 수 있으니 넣기 전에 확인해 주세요.
          </>
        ),
      },
      {
        q: '[토스로 보내기]를 눌렀는데 아무 일도 없어요.',
        a: (
          <>
            휴대폰에 토스 앱이 없거나 앱을 열 수 없는 환경일 수 있어요. 누를 때 계좌번호가 함께
            복사되니, 쓰시는 은행 앱에 붙여 넣어 보내 주세요.
          </>
        ),
      },
    ],
  },
  {
    title: '삭제 · 개인정보',
    items: [
      {
        q: '초대장을 지우고 싶어요.',
        a: (
          <>
            편집 화면 맨 아래 <b>[초대장 지우기]</b>를 누르면 초대장과 사진, 받은 응답 · 방명록이
            모두 지워지고 되돌릴 수 없어요. 링크만 잠시 닫고 싶다면 발행 창의 <b>[발행 취소]</b>를
            쓰세요.
          </>
        ),
      },
      {
        q: '하객에게서 어떤 정보를 받나요?',
        a: (
          <>
            이름 · 참석 여부 · 인원 · 식사 여부와 주최자가 만든 질문의 답만 받고, 초대장 주인만 볼
            수 있어요. 하객은 로그인하지 않아요. 자세한 내용은{' '}
            <Link href="/privacy">개인정보처리방침</Link>을 봐 주세요.
          </>
        ),
      },
      {
        q: '내 응답(방명록 글)을 지우고 싶어요.',
        a: (
          <>
            방명록 글은 쓸 때 정한 비밀번호로 직접 지울 수 있어요. 참석 응답은 같은 휴대폰에서 다시
            열면 고칠 수 있고, 지우려면 초대장 주인이나 아래 문의처로 알려 주세요.
          </>
        ),
      },
    ],
  },
]

export default function HelpPage() {
  return (
    <>
      <main className={styles.page}>
        <div style={{ marginBottom: 12 }}>
          <Logo />
        </div>
        <Link href="/" className={styles.back}>
          ← dearday
        </Link>
        <h1>도움말</h1>
        <p className={styles.lead}>
          자주 묻는 질문을 모았어요. 해결이 안 되면 아래로 문의해 주세요.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} className={styles.section}>
            <h2>{s.title}</h2>
            {s.items.map((f) => (
              <details key={f.q} className={styles.faq}>
                <summary>{f.q}</summary>
                <div className={styles.answer}>{f.a}</div>
              </details>
            ))}
          </section>
        ))}

        <section className={styles.contact} id="contact">
          <h2>문의하기</h2>
          <a href={`mailto:${BUSINESS.email}?subject=${encodeURIComponent('[dearday 문의]')}`}>
            이메일 {BUSINESS.email}
          </a>
          {KAKAO_CHANNEL_URL ? (
            <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer">
              카카오톡 채널로 문의
            </a>
          ) : null}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
