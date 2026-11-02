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
  - 샘플 사진 key는 `samples/wedding_XX.webp`. R2 연결 전에는 `.local/uploads/samples/`(gitignore)에 두면 로컬에서 보임 ⏸ R2에 업로드 필요
- [x] `shared/blocks.ts`: 블록 6종 타입 + zod 스키마
- [x] 레거시 → 블록 이식 + 버그 수정
  - [x] cover ← Heading. 요일을 날짜로 계산 (하드코딩 `SATURDAY` 제거)
  - [x] greeting ← Intro · Invitation, Text 컴포넌트 재사용
  - [x] gallery ← ImageGallery + ImageViewer. 누른 사진부터 열기(`initialSlide`), ESC 닫기, 배경 스크롤 잠금, `border-radius: 8px`
  - [x] Section: 제목 없으면 제목 영역 렌더링 안 함 (`title !== null` 버그)
  - [x] FullScreenMessage: 에러 아이콘 JSX 속성 카멜케이스, 크기 지정, `Error` 이름 변경
  - 날짜는 서버(UTC)에서도 한국 시간으로 나오게 `shared/date.ts`(Intl, Asia/Seoul)로 계산. Video 블록은 런칭 이후 범위라 이식 보류
- [x] 공개 초대장 `/i/[slug]`: 쿼리 1회, 블록 순서대로 렌더링, `generateMetadata`로 OG title · description · image
  - 쿼리 1회 확인(`DB_LOG=1`로 SQL 로그), 검색 노출 막음(noindex), 사진 없으면 `/og/[eventType]` 기본 이미지(빌드 때 생성)
  - 사진 뷰어(Swiper)는 사진을 눌렀을 때만 로드 → 첫 로딩 JS 133kB → 108kB
  - rsvp · guestbook 블록은 D3까지 화면에 안 그림
- [x] 카카오 로그인 (login → callback → 세션 쿠키 → logout). ⏸ 키 없으면 `DEV_LOGIN`으로 우회
  - HMAC 서명 httpOnly 쿠키(30일), state 쿠키로 CSRF 방지, 돌아갈 경로는 사이트 내부만 허용. 미들웨어 없이 페이지에서 `requireSession`
  - `DEV_LOGIN=1`은 사이트 주소가 localhost일 때만 동작 (운영에서 켜져 있어도 무시)
  - 로컬에서 위조 쿠키 · state 불일치 · 취소 · 로그아웃 확인. 실제 카카오 왕복은 ⏸ 키 받은 뒤 확인
  - 대시보드는 로그인 확인용 최소 화면(내 초대장 목록 · 로그아웃)만. 나머지는 D2
- 완료 기준: seed 초대장이 `/i/<slug>`에서 모바일로 보이고, HTML에 og 태그가 들어 있음 ✅ 10/31 확인

## D2 · 11/1(일) — 만들기

- [x] 대시보드: 내 초대장 목록, 새로 만들기 → 행사 종류 선택 → 템플릿 블록 자동 생성
  - API: `POST /api/invitations`, `PUT /api/invitations/[id]`(메타 + 블록 전체 저장), `DELETE`, `POST .../publish`
  - 소유자 확인은 UPDATE/DELETE의 WHERE에 owner_id를 같이 걸어 한 쿼리로. 다른 Origin 요청 차단
  - slug는 만들 때 발급(헷갈리는 글자 제외 8자), 발행 전에는 공개 주소가 404
- [x] 편집기: 블록 추가 · 삭제 · 순서 변경 · 숨김, 블록별 입력 폼, 미리보기(데스크톱 오른쪽 / 모바일 탭), 자동 저장
  - 0.8초 뒤 자동 저장(메타 + 블록 전체), 저장 중 바뀐 내용은 끝난 뒤 한 번 더 저장, 저장 안 된 채 나가면 경고
  - 표지 · 참석 여부 · 방명록은 한 개씩만. 순서 변경은 ↑↓ 버튼(모바일에서 드래그보다 확실)
  - 브라우저 테스트로 생성 → 수정 → 새로고침 후 유지 확인
- [x] 사진 업로드: presign API → 브라우저 리사이즈 → R2 PUT → media 저장. 10장 한도. ⏸ R2 키 없으면 로컬 파일 저장으로 우회
  - 흐름: `POST /api/uploads/presign` → 브라우저가 R2에 직접 PUT → `POST /api/uploads/complete`(실제 크기 확인 후 media 등록)
  - R2 키가 없으면(localhost 한정) `/api/uploads/local`로 받아 `.local/uploads/`에 저장, `/uploads/<key>`로 보여 줌. 샘플 사진도 여기로 옮김
  - 6MB JPG → 1600px webp 65~345KB 확인. webp 인코딩 못 하는 브라우저는 jpg로
  - 한도 10장은 서버에서 media 행 수로 확인. 블록에서 빠진 사진은 2분 지나면 저장할 때 · 다음 업로드 때 지움
  - ⏸ R2 실제 업로드는 키 받은 뒤 확인. 버킷 CORS에 사이트 주소의 PUT 허용 필요
- [x] location 블록: 카카오맵, 주소 검색(카카오 로컬 API를 서버 경유로), 카카오맵 · 네이버지도 · 티맵 길찾기 링크, 지하철 · 버스 · 주차 안내
  - 지도는 위치 확인용 고정 지도(끌기 · 확대 끔 — 스크롤 방해 방지). JS 키가 없거나 SDK 로딩이 실패하면 지도 없이 링크만
  - 주소 검색 `GET /api/geo/search?q=` (로그인 필요, 장소 이름 → 없으면 주소 검색). 키 없으면 편집기에서 직접 입력 안내
  - 길찾기: 카카오맵(좌표 있으면 길찾기, 없으면 검색) · 네이버지도(주소 검색) · 티맵(앱 스킴, 좌표 있을 때만) + 주소 복사
  - ⏸ 카카오 키 받은 뒤 실제 지도 · 검색 확인. 카카오 콘솔에 사이트 도메인 등록 필요. 티맵 링크는 D3 실기기 QA에서 확인
- [x] 발행: draft → published, slug 발급, 링크 복사, 카카오 공유(`Kakao.Share.sendDefault` feed 템플릿)
  - 발행 전에 저장을 끝까지 기다린 뒤 발행. 발행 시트에 빠뜨리기 쉬운 항목(날짜 · 표지 사진 · 주소) 안내, 발행 취소 가능
  - 카카오 공유 카드와 OG 태그가 같은 제목 · 설명 · 이미지를 쓰도록 `shared/share.ts`로 통일
  - 카카오 JS SDK 2.8.4(2026-10-19, 공식 다운로드 페이지 기준). SRI 해시는 다운로드 페이지에서 복사해 넣어야 함(이 환경에선 못 가져옴)
  - JS 키 없으면 카카오 버튼 숨김 → 링크 복사 · 다른 앱으로 공유(Web Share)
  - ⏸ 실제 카톡 공유는 키 + 도메인 등록 후 확인
- 완료 기준: 로그인 → 생성 → 사진 3장 업로드 → 발행 → 공개 링크에서 확인 ✅ 11/1 확인 — `pnpm e2e:d2` 21개 항목 통과(운영 빌드, 카카오 SDK · 주소 검색은 가짜로 끼워 호출 내용까지 확인)

## D3 · 11/2(월) — 하객 기능 · 런칭

- [x] rsvp 블록 + API: 이름, 참석/불참, 인원(1~10), 식사 여부(설정 시), 마감일 이후 차단, rate limit
  - `POST /api/i/[slug]/rsvp`. 불참이면 인원 0 · 식사 null로 저장, 식사를 안 묻는 초대장은 식사 값 무시, 최대 인원은 블록 설정 기준
  - 같은 기기에서 다시 보내면 이전 응답을 고침(서명된 수정 토큰을 기기에 저장). 다른 기기 · 동명이인은 새 응답
  - rate limit: DB 테이블 `rate_limits`(IP+slug 해시, 원래 IP 저장 안 함) — 참석 10회/10분, 방명록 쓰기 5회/10분, 삭제 시도 10회/10분
  - ⏸ 배포 후 확인: Amplify 앞단에서 `x-forwarded-for` 첫 값이 실제 하객 IP인지 (조작 가능하면 마지막 값으로 바꿔야 함)
- [x] 대시보드 응답 집계: 참석 · 불참 · 총 인원 · 식사 인원, 응답 목록
  - 목록 카드에 참석 인원 · 응답 수, `/dashboard/[id]`에 참석 인원 · 참석 응답 · 불참, 식사(함 · 안 함 · 미정) 인원, 응답 목록(잘못 들어온 응답 지우기)
- [x] guestbook 블록 + API: 이름 · 메시지 · 비밀번호, 본인 삭제, 주최자 숨김
  - 블록 · 하객 API 완료: 목록(20개씩 더 보기) · 쓰기 · 비밀번호(bcrypt) 확인 후 본인 삭제. 주최자는 `/dashboard/[id]`에서 숨김 · 다시 보이기
- [x] 템플릿 3종 다듬기: 결혼 · 돌잔치 · 회식/동창회 (기본 블록 구성, 기본 문구, 테마 색)
  - 바꿔야 할 자리는 `[신랑 이름]`처럼 대괄호로 표시, 그대로 발행하려 하면 발행 시트에서 안내
- [x] 랜딩, 이용약관 · 개인정보처리방침(운영자 상호 '한피', 나머지 사업자 정보는 사용자에게 받기), 푸터
  - 사업자 정보는 `shared/business.ts` 한 곳. 대표자 · 사업자등록번호 · 이메일 11/2 반영
  - 개인정보처리방침에 국외 이전(Neon 싱가포르 · Cloudflare) 명시. 하객 입력 폼에 처리방침 링크
  - 회원 탈퇴 추가(대시보드 하단): 초대장 · 응답 · 방명록 · 사진까지 삭제 — 개인정보 보호법상 탈퇴 수단 필요
- [x] Amplify 배포: `amplify.yml`, 런타임 환경변수 처리, 도메인 연결 — 11/1 운영 구성 완료, `/api/health` ok · www → 루트 리다이렉트 확인
  - 준비 완료: `amplify.yml`(Node 20 · pnpm, 런타임 환경변수를 `.env.production`에 기록 — DEV_LOGIN 제외, 빌드 때 `db:migrate`), `/api/health`(설정 확인용), `docs/DEPLOY.md`(Neon · R2 CORS · 카카오 콘솔 · Amplify 순서)
  - 남은 것 ⏸: Amplify 앱 연결 · 환경변수 입력 · 도메인 연결 → `/api/health`가 `ok:true`인지 확인
- [ ] 실기기 QA: iOS Safari, 카카오톡 인앱 브라우저, 안드로이드 Chrome. 카톡 공유 미리보기 카드 확인 ⏸ 운영 배포 후 (점검 순서는 `docs/DEPLOY.md` 5번)
- 완료 기준: 운영 도메인에서 만들기 → 공유 → 하객 응답 → 대시보드 집계까지 전체 흐름 동작
  - 로컬 ✅ 11/1 — `pnpm e2e:d3` 16개 항목 통과(자리 표시 문구 안내 → 발행 → 하객 3명 응답 · 고치기 → 방명록 · 비밀번호 확인 → 집계 → 주최자 숨김 → 마감 차단), `pnpm e2e:d2` 회귀 통과
  - 공개 초대장 첫 로딩 JS 113kB (하객 폼에서 zod를 빼서 140kB → 113kB)
  - 운영 도메인 ⏸ 배포 후

## 리뷰 반영 (관리 세션 11/1)

- [x] [버그] 대시보드 목록 응답 수가 항상 0 — 상관 서브쿼리의 `${inv.id}`가 `"id"`로만 렌더링돼 `rsvps.id`와 비교됨. `LEFT JOIN rsvps … GROUP BY`로 수정, 같은 파일의 소유자 확인 `exists(...)`도 drizzle 서브쿼리(`inArray`)로 교체. `e2e:d3`에 목록 카드 숫자 확인 추가
- [x] [속도] 손글씨 폰트 2.5MB → Google Fonts 한국어 빈도 슬라이스로 88조각(조각당 14~20KB) + unicode-range. 하객 페이지 폰트 다운로드 2,459KB → 123~158KB. 원본은 `assets/fonts/`, 생성은 `scripts/subset-font.py`
- [x] [확인] og:image가 webp → 카카오 스크랩은 JPG/JPEG/PNG만 지원(카카오 데브톡 점검 목록)이라 수정. 업로드 때 브라우저가 공유용 JPEG 사본(`*.share.jpg`, 긴 변 1200px)도 올리고 og:image · 카카오 공유는 이 사본을 씀. 사진 지울 때 사본도 삭제
  - ⏸ 운영 R2에 샘플 사진을 올릴 경우 `samples/wedding_XX.share.jpg`도 함께
- [x] [다듬기] 사진첩 '넘겨 보기 (준비 중)' 선택지 숨김 (스키마 값은 유지)

## 운영 반영 (11/2)

- [x] 공유 카드: 사본(`*.share.jpg`)이 없는 예전 사진 대응 — 사진 참조에 `share: true` 표시(새 업로드는 자동). 표지 → 사진첩 순으로 사본 있는 사진, 없으면 JPG/PNG 원본, webp뿐이면 행사별 기본 이미지
- [x] 일회성 `pnpm backfill:share [--apply]`: 예전 사진 사본 생성 + 표시 (R2 또는 로컬, 여러 번 실행해도 안전). 로컬에서 미리 보기 → 실행 → 재실행 · og:image 전후 확인
  - ⏸ 운영 실행은 사용자 컴퓨터에서 (`docs/DEPLOY.md` 6번). 이미 공유한 링크는 카카오 [카카오톡 URL 메타정보 관리]에서 캐시 초기화 필요

## 성능 개선 (11/2)

측정: `pnpm perf /i/<slug> 5` — 모바일 390×844 · Fast 4G · CPU 4배 느리게, 스크롤 없이 첫 화면, 5회 중앙값

- [x] 손글씨 폰트 미리 받기: 서버가 손글씨로 그릴 글자(표지 · 인사말 · 섹션 제목)를 모아 필요한 조각만 `<link rel="preload" as="font">`. 랜딩 로고도. preload한 조각 = 실제 쓰인 조각 일치 확인. `/fonts/*` 1년 immutable 캐시, 폴더 버전 `v1`
- [x] 사진첩 썸네일: 업로드 때 브라우저가 긴 변 480px webp(`*.thumb.webp`, 장당 약 10KB)도 올림, 바둑판은 썸네일 · 크게 보기는 원본. `thumb: true` 표시 없는 예전 사진은 원본. `pnpm backfill:share`가 썸네일도 만듦
- [x] 지도 · 방명록 목록은 화면에 가까워질 때 불러오기 (`useNearViewport`, IntersectionObserver rootMargin 300px). 첫 화면에서 카카오 지도 SDK · 방명록 API 요청 0건, 스크롤하면 그때 1번 — `e2e:d2`로 확인
- [x] dashboard · dashboard/[id] · edit/[id] loading.tsx — 각 화면 모양을 닮은 가벼운 자리 표시(CSS만, JS 없음). 느린 회선에서 링크를 누른 뒤 120~200ms 안에 표시 확인

## 밀리면 뺄 순서 (런칭 다음 날 추가)

1. 방명록
2. 템플릿 2종 (결혼만 남김)
3. 갤러리 슬라이드 방식

## ⏸ 사용자 대기 항목

- [x] 개발 세션에 이 레포 쓰기 권한 연결
- [x] 도메인: `thedearday.com` (www → 루트 301 리다이렉트는 `next.config.ts`)
- [x] 카카오 개발자 앱: REST · JS 키, 카카오 로그인 활성화, 플랫폼 도메인 · Redirect URI 등록 (11/1 완료)
  - Client Secret: 새 앱은 기본 사용 → `KAKAO_CLIENT_SECRET` 필수
  - 플랫폼 > Web 사이트 도메인에 운영 도메인과 `http://localhost:3000` 둘 다 (지도 · 공유 SDK가 도메인 검사)
  - 동의 항목: 닉네임(프로필) 필수
  - 카카오 JS SDK 2.8.4의 SRI 해시를 다운로드 페이지에서 복사해 주면 넣겠음 (선택)
- [x] Neon 프로젝트(Singapore) → `DATABASE_URL`
- [x] R2 버킷 `dearday-media`(아시아 · 태평양), 공개 도메인 `media.thedearday.com`, API 토큰
  - 버킷 CORS: 사이트 주소(운영 · localhost:3000)에서 `PUT`, 헤더 `Content-Type` 허용
- [x] Amplify 앱(서울 리전) ↔ 이 레포 연결
  - 커스텀 도메인: 루트 `thedearday.com`이 대표, `www`는 루트로 301. Cloudflare의 Amplify 레코드는 프록시 끄고 DNS only
- [x] 약관용 사업자 정보 (대표자명, 사업자등록번호, 연락처 이메일) — 11/2 반영 (`shared/business.ts`: 푸터 · 개인정보처리방침 보호책임자)

키 · 비밀번호는 채팅에 붙이지 말고 Amplify 환경변수 / 로컬 `.env.local`에 직접 입력.

## 질문 (개발 세션 → 관리 세션)

- 이용약관 · 개인정보처리방침은 개발 세션이 쓴 초안(`/terms`, `/privacy`). 위탁 업체 · 보관 위치는 실제 구성(Amplify 서울 · Neon 싱가포르 · R2 아시아태평양 · 카카오)에 맞춤(11/2). 법률 검토는 아직
- ~~CLAUDE.md의 `KAKAO_CLIENT_SECRET` 설명 수정~~ → 11/2 프로젝트 문서 `dearday/CLAUDE.md`로 레포 CLAUDE.md 교체(사용자 허용, 이번 한 번)
- 유료 기능을 붙일 때는 통신판매업 신고번호 · 사업장 주소도 푸터에 필요

## 런칭 이후 (이번 범위 아님)

유료 옵션 · 토스페이먼츠 결제, video · account(계좌) 블록, RSVP 엑셀 다운로드, 앱인토스 미니앱.
