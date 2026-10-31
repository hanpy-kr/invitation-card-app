# dearday 런칭 PLAN

- 런칭 목표: **2026-11-02(월) 밤**, 예비일 11-03(화)
- 레포: `hanpy-kr/invitation-card-app` (이력 초기화 후 재사용, 레포 이름은 그대로)
- 표기: `[ ]` 할 일 · `[x]` 완료 · ⏸ 사용자 키 · 계정 대기

## 0. 레포 초기화 — 가장 먼저

사용자 승인: 2026-10-31, 기존 이력 전체 삭제 후 새로 시작 (서비스 미오픈, db.json은 더미 데이터).

- [x] 현재 `main` 클론 → 재사용할 파일을 레포 밖 임시 폴더에 복사
  - `src/components/shared/` (Text, FullScreenMessage, Section + scss)
  - `src/components/sections/` (Heading, Intro, Invitation, ImageGallery, Video + scss)
  - `src/components/imageViewer/` (index.tsx, swiper.css, scss)
  - `src/scss/` (reset, font, global, utils)
  - `src/assets/fonts/NanumGeumEunBoHwa.woff2` (woff2만. ttf · woff는 버림)
- [x] orphan 브랜치에서 Next.js 15 새 프로젝트 생성 (pnpm, TS strict, ESLint + Prettier, App Router)
- [x] `.gitignore`: `.env*`(단 `.env.example` 제외), `node_modules`, `.next`, 미디어 원본
- [x] `CLAUDE.md`, `docs/PLAN.md`(이 파일) 포함해 첫 커밋 → `main`에 강제 푸시
- [x] 클론 크기 확인 (수 MB 이내여야 함) — 첫 커밋 기준 424KB

## D1 · 10/31(토) — 기반

- [x] Drizzle 스키마 + 마이그레이션 (CLAUDE.md 데이터 모델), 로컬 Postgres(docker), seed 스크립트(결혼 · 돌잔치 · 회식 샘플 3건)
  - `docker compose up -d` → `pnpm db:migrate` → `pnpm db:seed` → `/i/demowed1`, `/i/demodol1`, `/i/demomeet`
  - 샘플 사진 key는 `samples/wedding_XX.webp`. R2 연결 전에는 `public/uploads/samples/`(gitignore)에 두면 로컬에서 보임 ⏸ R2에 업로드 필요
- [x] `shared/blocks.ts`: 블록 6종 타입 + zod 스키마
- [x] 레거시 → 블록 이식 + 버그 수정
  - [x] cover ← Heading. 요일을 날짜로 계산 (하드코딩 `SATURDAY` 제거)
  - [x] greeting ← Intro · Invitation, Text 컴포넌트 재사용
  - [x] gallery ← ImageGallery + ImageViewer. 누른 사진부터 열기(`initialSlide`), ESC 닫기, 배경 스크롤 잠금, `border-radius: 8px`
  - [x] Section: 제목 없으면 제목 영역 렌더링 안 함 (`title !== null` 버그)
  - [x] FullScreenMessage: 에러 아이콘 JSX 속성 카멜케이스, 크기 지정, `Error` 이름 변경
  - 날짜는 서버(UTC)에서도 한국 시간으로 나오게 `shared/date.ts`(Intl, Asia/Seoul)로 계산. Video 블록은 런칭 이후 범위라 이식 보류
- [ ] 공개 초대장 `/i/[slug]`: 쿼리 1회, 블록 순서대로 렌더링, `generateMetadata`로 OG title · description · image
- [ ] 카카오 로그인 (login → callback → 세션 쿠키 → logout). ⏸ 키 없으면 `DEV_LOGIN`으로 우회
- 완료 기준: seed 초대장이 `/i/<slug>`에서 모바일로 보이고, HTML에 og 태그가 들어 있음

## D2 · 11/1(일) — 만들기

- [ ] 대시보드: 내 초대장 목록, 새로 만들기 → 행사 종류 선택 → 템플릿 블록 자동 생성
- [ ] 편집기: 블록 추가 · 삭제 · 순서 변경 · 숨김, 블록별 입력 폼, 미리보기(데스크톱 오른쪽 / 모바일 탭), 자동 저장
- [ ] 사진 업로드: presign API → 브라우저 리사이즈 → R2 PUT → media 저장. 10장 한도. ⏸ R2 키 없으면 로컬 파일 저장으로 우회
- [ ] location 블록: 카카오맵, 주소 검색(카카오 로컬 API를 서버 경유로), 카카오맵 · 네이버지도 · 티맵 길찾기 링크, 지하철 · 버스 · 주차 안내
- [ ] 발행: draft → published, slug 발급, 링크 복사, 카카오 공유(`Kakao.Share.sendDefault` feed 템플릿)
- 완료 기준: 로그인 → 생성 → 사진 3장 업로드 → 발행 → 공개 링크에서 확인

## D3 · 11/2(월) — 하객 기능 · 런칭

- [ ] rsvp 블록 + API: 이름, 참석/불참, 인원(1~10), 식사 여부(설정 시), 마감일 이후 차단, rate limit
- [ ] 대시보드 응답 집계: 참석 · 불참 · 총 인원 · 식사 인원, 응답 목록
- [ ] guestbook 블록 + API: 이름 · 메시지 · 비밀번호, 본인 삭제, 주최자 숨김
- [ ] 템플릿 3종 다듬기: 결혼 · 돌잔치 · 회식/동창회 (기본 블록 구성, 기본 문구, 테마 색)
- [ ] 랜딩, 이용약관 · 개인정보처리방침(운영자 상호 '한피', 나머지 사업자 정보는 사용자에게 받기), 푸터
- [ ] Amplify 배포: `amplify.yml`, 런타임 환경변수 처리, 도메인 연결 ⏸
- [ ] 실기기 QA: iOS Safari, 카카오톡 인앱 브라우저, 안드로이드 Chrome. 카톡 공유 미리보기 카드 확인
- 완료 기준: 운영 도메인에서 만들기 → 공유 → 하객 응답 → 대시보드 집계까지 전체 흐름 동작

## 밀리면 뺄 순서 (런칭 다음 날 추가)

1. 방명록
2. 템플릿 2종 (결혼만 남김)
3. 갤러리 슬라이드 방식

## ⏸ 사용자 대기 항목

- [x] 개발 세션에 이 레포 쓰기 권한 연결
- [ ] 도메인 (dearday.kr 또는 dearday.app)
- [ ] 카카오 개발자 앱: REST · JS 키, 카카오 로그인 활성화, 플랫폼 도메인 · Redirect URI 등록
- [ ] Neon 프로젝트(Singapore) → `DATABASE_URL`
- [ ] R2 버킷 `dearday-media`, 공개 도메인, API 토큰
- [ ] Amplify 앱(서울 리전) ↔ 이 레포 연결
- [ ] 약관용 사업자 정보 (대표자명, 사업자등록번호, 연락처 이메일)

키 · 비밀번호는 채팅에 붙이지 말고 Amplify 환경변수 / 로컬 `.env.local`에 직접 입력.

## 질문 (개발 세션 → 관리 세션)

- (없음)

## 런칭 이후 (이번 범위 아님)

유료 옵션 · 토스페이먼츠 결제, video · account(계좌) 블록, RSVP 엑셀 다운로드, 앱인토스 미니앱.
