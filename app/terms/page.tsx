import type { Metadata } from 'next'
import Link from 'next/link'

import SiteFooter from '@/components/site/SiteFooter'
import { BUSINESS } from '@/shared/business'
import { getEntitlements } from '@/shared/entitlements'

import styles from './legal.module.scss'

export const metadata: Metadata = { title: '이용약관 — dearday' }

export default function TermsPage() {
  const name = `${BUSINESS.serviceName}(${BUSINESS.tradeName})`
  return (
    <>
      <main className={styles.page}>
        <Link href="/">← dearday</Link>
        <h1>이용약관</h1>
        <p className={styles.date}>시행일 {BUSINESS.effectiveDate}</p>

        <h2>제1조 (목적)</h2>
        <p>
          이 약관은 {BUSINESS.tradeName}(이하 &quot;회사&quot;)가 제공하는 모바일 초대장 서비스{' '}
          {BUSINESS.serviceName}
          (이하 &quot;서비스&quot;)의 이용 조건과 절차, 회사와 이용자의 권리 · 의무를 정합니다.
        </p>

        <h2>제2조 (용어)</h2>
        <ol>
          <li>&quot;회원&quot;은 카카오 계정으로 로그인해 초대장을 만드는 사람을 말합니다.</li>
          <li>
            &quot;하객&quot;은 회원이 공유한 초대장 링크로 초대장을 보고 참석 응답이나 방명록을
            남기는 사람을 말합니다.
          </li>
          <li>
            &quot;게시물&quot;은 회원과 하객이 서비스에 올린 글 · 사진 등 모든 정보를 말합니다.
          </li>
        </ol>

        <h2>제3조 (약관의 효력과 변경)</h2>
        <p>
          이 약관은 서비스 화면에 게시해 효력이 생깁니다. 회사는 관련 법령을 어기지 않는 범위에서
          약관을 바꿀 수 있으며, 바꾸는 경우 시행 7일 전(회원에게 불리한 변경은 30일 전)부터 서비스
          화면에 알립니다.
        </p>

        <h2>제4조 (서비스 내용)</h2>
        <ol>
          <li>
            회사는 초대장 만들기 · 편집 · 공유, 하객 참석 응답 받기, 방명록 기능을 제공합니다.
          </li>
          <li>현재 서비스는 무료입니다. 유료 기능을 추가할 때는 요금과 조건을 미리 알립니다.</li>
          <li>사진은 초대장당 {getEntitlements().photoLimit}장까지 올릴 수 있습니다.</li>
        </ol>

        <h2>제5조 (회원 가입과 탈퇴)</h2>
        <ol>
          <li>만 14세 이상인 사람은 카카오 계정으로 로그인해 회원이 될 수 있습니다.</li>
          <li>
            회원은 언제든지 &apos;내 초대장&apos; 화면에서 탈퇴할 수 있으며, 탈퇴하면 만든 초대장 ·
            사진 · 받은 응답 · 방명록이 바로 지워집니다.
          </li>
        </ol>

        <h2>제6조 (회원의 의무)</h2>
        <p>회원은 다음 행위를 해서는 안 됩니다.</p>
        <ul>
          <li>다른 사람의 개인정보 · 사진을 동의 없이 올리는 행위</li>
          <li>다른 사람의 저작권 · 초상권 등 권리를 침해하는 행위</li>
          <li>
            음란 · 폭력적이거나 불법인 내용을 올리는 행위, 광고 · 스팸 · 사기 목적으로 쓰는 행위
          </li>
          <li>서비스 운영을 방해하거나 다른 사람의 계정을 쓰는 행위</li>
        </ul>

        <h2>제7조 (게시물)</h2>
        <ol>
          <li>게시물의 권리와 책임은 올린 사람에게 있습니다.</li>
          <li>
            회사는 서비스 제공(화면 표시, 공유 미리보기 생성 등)에 필요한 범위에서만 게시물을
            이용합니다.
          </li>
          <li>
            제6조를 어긴 게시물이나 권리 침해 신고가 들어온 게시물은 회사가 미리 알리지 않고
            숨기거나 지울 수 있습니다.
          </li>
          <li>초대장 주인은 하객이 남긴 방명록 글을 숨길 수 있습니다.</li>
        </ol>

        <h2>제8조 (서비스의 변경 · 중단)</h2>
        <p>
          회사는 설비 점검 · 교체, 고장, 통신 장애 등 부득이한 사유가 있으면 서비스를 일시 중단할 수
          있습니다. 서비스를 종료할 때는 30일 전에 알리고, 회원이 자료를 확인할 수 있는 기간을
          둡니다.
        </p>

        <h2>제9조 (책임의 제한)</h2>
        <ol>
          <li>회사는 천재지변 등 불가항력으로 서비스를 제공하지 못한 경우 책임을 지지 않습니다.</li>
          <li>
            회사는 회원이 올린 게시물의 내용, 회원과 하객 사이의 일에 대해 책임을 지지 않습니다.
            다만 회사의 고의 · 중대한 과실이 있는 경우는 그렇지 않습니다.
          </li>
        </ol>

        <h2>제10조 (분쟁 해결)</h2>
        <p>
          이 약관은 대한민국 법률에 따릅니다. 서비스 이용으로 생긴 분쟁은 민사소송법에 따른 관할
          법원에서 해결합니다.
        </p>

        <p style={{ marginTop: 32 }}>{name}</p>
      </main>
      <SiteFooter />
    </>
  )
}
