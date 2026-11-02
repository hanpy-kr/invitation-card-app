import type { Metadata } from 'next'
import Link from 'next/link'

import SiteFooter from '@/components/site/SiteFooter'
import { BUSINESS, pending } from '@/shared/business'

import styles from '../terms/legal.module.scss'

export const metadata: Metadata = { title: '개인정보처리방침 — dearday' }

export default function PrivacyPage() {
  return (
    <>
      <main className={styles.page}>
        <Link href="/">← dearday</Link>
        <h1>개인정보처리방침</h1>
        <p className={styles.date}>시행일 {BUSINESS.effectiveDate}</p>

        <p>
          {BUSINESS.tradeName}(이하 &quot;회사&quot;)는 {BUSINESS.serviceName} 서비스를 운영하면서
          개인정보 보호법에 따라 이용자의 개인정보를 보호합니다. 회사는 서비스에 꼭 필요한 정보만
          받으며, 하객에게는 전화번호 · 주소 등 연락처를 받지 않습니다.
        </p>

        <h2>1. 수집하는 개인정보와 이용 목적 · 보유 기간</h2>
        <table>
          <thead>
            <tr>
              <th>대상</th>
              <th>항목</th>
              <th>목적</th>
              <th>보유 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>회원(초대장 만드는 사람)</td>
              <td>카카오 회원번호, 닉네임</td>
              <td>로그인, 내 초대장 관리</td>
              <td>탈퇴할 때까지</td>
            </tr>
            <tr>
              <td>회원</td>
              <td>초대장에 직접 적은 이름 · 행사 정보 · 사진</td>
              <td>초대장 표시 · 공유</td>
              <td>초대장을 지우거나 탈퇴할 때까지</td>
            </tr>
            <tr>
              <td>하객</td>
              <td>이름, 참석 여부, 인원, 식사 여부</td>
              <td>초대장 주인에게 참석 응답 전달</td>
              <td>초대장을 지우거나 주인이 탈퇴할 때까지 (주인이 개별 삭제 가능)</td>
            </tr>
            <tr>
              <td>하객</td>
              <td>방명록 이름 · 메시지, 비밀번호(복원할 수 없게 암호화)</td>
              <td>방명록 표시, 작성자 본인 삭제 확인</td>
              <td>작성자 · 초대장 주인이 지우거나 초대장이 지워질 때까지</td>
            </tr>
            <tr>
              <td>모든 이용자</td>
              <td>접속 IP를 변환한 값(원래 IP는 저장하지 않음), 로그인 쿠키</td>
              <td>도배 · 부정 이용 방지, 로그인 유지</td>
              <td>IP 변환값은 최대 1일, 로그인 쿠키는 30일 또는 로그아웃까지</td>
            </tr>
          </tbody>
        </table>
        <p>
          하객이 응답한 기기에는 응답을 고칠 수 있도록 확인용 값이 브라우저에 저장됩니다. 브라우저
          설정에서 지울 수 있습니다.
        </p>

        <h2>2. 개인정보 처리 위탁과 국외 이전</h2>
        <p>회사는 서비스 운영을 위해 아래 업체에 개인정보 처리를 맡깁니다.</p>
        <table>
          <thead>
            <tr>
              <th>받는 자</th>
              <th>맡기는 일</th>
              <th>보관 위치</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Amazon Web Services, Inc.</td>
              <td>서비스 서버 운영 (AWS Amplify Hosting)</td>
              <td>대한민국 (서울 리전)</td>
            </tr>
            <tr>
              <td>Neon, Inc.</td>
              <td>데이터베이스 보관 (위 1번의 모든 항목)</td>
              <td>싱가포르 (AWS 아시아 · 태평양 싱가포르 리전)</td>
            </tr>
            <tr>
              <td>Cloudflare, Inc.</td>
              <td>사진 파일 보관 (Cloudflare R2) · 전송</td>
              <td>
                아시아 · 태평양 지역 (R2 저장 위치). 전송 시 Cloudflare 전 세계 네트워크를 거칠 수
                있음
              </td>
            </tr>
            <tr>
              <td>주식회사 카카오</td>
              <td>카카오 로그인, 지도 표시 · 주소 검색, 카카오톡 공유</td>
              <td>대한민국</td>
            </tr>
          </tbody>
        </table>
        <p>
          국외 이전은 Neon(싱가포르, 데이터베이스)과 Cloudflare(아시아 · 태평양 지역, 사진 파일)로
          서비스 이용 시 정보통신망을 통해 수시로 이루어지며, 이전 항목과 보유 기간은 1번과
          같습니다. 국외 이전을 원하지 않으면 서비스 이용을 멈추고 탈퇴할 수 있으나, 이 경우
          서비스를 이용할 수 없습니다.
        </p>

        <h2>3. 파기</h2>
        <p>
          보유 기간이 끝나거나 탈퇴 · 삭제를 요청하면 지체 없이 지웁니다. 데이터베이스의 정보는
          복구할 수 없게 지우고, 사진 파일은 저장소에서 지웁니다.
        </p>

        <h2>4. 이용자의 권리</h2>
        <ul>
          <li>
            회원은 언제든 초대장 · 응답 · 방명록을 확인 · 수정 · 삭제하고, &apos;내 초대장&apos;
            화면에서 탈퇴할 수 있습니다.
          </li>
          <li>
            하객은 방명록 비밀번호로 자기 글을 지울 수 있고, 참석 응답 삭제는 초대장 주인이나 아래
            연락처로 요청할 수 있습니다.
          </li>
          <li>
            개인정보 열람 · 정정 · 삭제 · 처리정지 요청은 아래 연락처로 할 수 있으며, 회사는 지체
            없이 처리합니다.
          </li>
        </ul>

        <h2>5. 만 14세 미만</h2>
        <p>회원 가입은 만 14세 이상만 할 수 있습니다.</p>

        <h2>6. 안전성 확보 조치</h2>
        <p>
          모든 통신은 암호화(HTTPS)하며, 방명록 비밀번호는 복원할 수 없는 방식으로 저장합니다. 접근
          권한은 운영에 필요한 사람으로 제한합니다.
        </p>

        <h2>7. 개인정보 보호책임자</h2>
        <p>
          {BUSINESS.tradeName} 대표 {pending(BUSINESS.representative)} · 이메일{' '}
          {pending(BUSINESS.email)}
        </p>
        <p>
          개인정보 침해 신고 · 상담: 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118),
          개인정보분쟁조정위원회 (www.kopico.go.kr, 1833-6972)
        </p>

        <h2>8. 변경</h2>
        <p>이 방침을 바꾸면 시행 7일 전부터 서비스 화면에 알립니다.</p>
      </main>
      <SiteFooter />
    </>
  )
}
