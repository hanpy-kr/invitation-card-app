# dearday — 개발 지침

이 파일은 관리(기획) 세션이 관리합니다. 개발 세션은 이 파일을 직접 고치지 말고,
바꿀 필요가 있으면 `docs/PLAN.md`의 "질문" 섹션에 적어 주세요.

## 서비스 한 줄

dearday(디어데이) — 누구나 만들어 카톡 링크로 보내는 모바일 모임 초대장 웹 서비스.
첫 템플릿은 결혼 · 돌잔치 · 회식/동창회. 런칭 목표 2026-11-02(월) 밤.

- 만드는 사람: 카카오 로그인 → 행사 종류 선택 → 블록 편집 → 발행 → 카톡 공유 → 대시보드(응답 집계)
- 받는 사람(하객): 로그인 없이 `/i/[slug]` 열람 → 참석 응답 · 방명록 작성 · 지도 앱으로 길 찾기
- 기획서(결정 근거): https://claude.ai/artifact/H4VzAD1pvjyQs21UuUUtXv — 이 파일과 충돌하면 이 파일이 우선

## 고정 결정 (바꾸려면 사용자 확인 필요)

| 영역 | 결정 | 이유 / 주의 |
| --- | --- | --- |
| 프레임워크 | Next.js **15** (App Router) + TypeScript strict | AWS Amplify Hosting은 Next.js 12~15만 지원. 16으로 올리지 말 것 |
| API | `app/api/**/route.ts` Route Handlers, `export const runtime = 'nodejs'` | Amplify는 Edge runtime · Edge middleware · streaming · on-demand ISR · `unstable_after` 미지원 → 쓰지 말 것 |
| DB | Postgres + Drizzle ORM. 운영은 Neon(싱가포르 리전) | 서울 리전 없음 → 왕복 지연 큼. 페이지당 쿼리 1~2회로 제한 |
| 파일 | Cloudflare R2 (S3 호환, `@aws-sdk/client-s3` + presigner) | 브라우저가 presigned PUT으로 직접 업로드. 서버는 파일을 나르지 않음 |
| 인증 | 카카오 OAuth(authorization code)를 서버에서 처리 → 서명된 httpOnly 세션 쿠키 | 토큰을 localStorage에 두지 않음 |
| 지도·공유 | 카카오 JS SDK (지도, `Kakao.Share`)는 클라이언트 컴포넌트에서만 로드 |  |
| 스타일 | SCSS Modules + CSS 변수(테마). Tailwind 쓰지 않음 | 기존 레거시 스타일을 그대로 이식 |
| 패키지 | pnpm, Node 20 |  |
| 결제 | 이번 런칭 범위 아님 (런칭 다음 주) |  |

## 폴더 구조

```
app/
  page.tsx                      랜딩
  dashboard/                    내 초대장 목록 · 응답 집계 (로그인 필요)
  edit/[id]/                    편집기 (로그인 필요)
  i/[slug]/page.tsx             공개 초대장: 서버 렌더링 + generateMetadata(OG)
  terms/, privacy/              이용약관 · 개인정보처리방침
  api/auth/kakao/{login,callback,logout}/route.ts
  api/invitations/...           초대장 · 블록 CRUD (소유자만)
  api/uploads/presign/route.ts  R2 업로드 주소 발급
  api/i/[slug]/{rsvp,guestbook}/route.ts   하객 쓰기 API (로그인 없음)
components/blocks/              블록 UI. 순수 표시용 — DB · 서버 · next/headers import 금지
                                (나중에 앱인토스 미니앱으로 그대로 옮기기 위함)
components/editor/              편집기 UI
lib/db/{schema.ts,client.ts}    드라이버 선택은 client.ts 한 곳에만
lib/auth/, lib/r2.ts
shared/blocks.ts                블록 타입 + zod 스키마 (웹 · API 공용)
```

## 데이터 모델

- `users` id, kakao_id(unique), nickname, created_at
- `invitations` id, owner_id, slug(unique, 8자 랜덤), event_type(wedding|dol|meetup|etc), title, event_at, theme, cover_media_id, status(draft|published), created_at, updated_at
- `blocks` id, invitation_id, type, position, config(jsonb), visible
- `media` id, owner_id, invitation_id, storage_key, width, height, size_bytes
- `rsvps` id, invitation_id, name, attending(bool), party_size, meal(bool|null), answers(jsonb), created_at
- `guestbook_entries` id, invitation_id, name, message, password_hash, hidden, created_at

런칭 블록 6종: `cover`, `greeting`, `gallery`, `location`, `rsvp`, `guestbook`.
블록 config는 `shared/blocks.ts`의 zod 스키마로 저장 전에 반드시 검증.

## 코드 규칙

- 공개 초대장 `/i/[slug]`는 invitation + blocks를 **쿼리 1회**(join)로 읽음. 발행 직후 수정이 바로 보여야 하므로 동적 렌더링.
- 모든 API 입력은 zod로 검증. 소유자 API는 세션의 user id와 owner_id 일치 확인.
- 하객 쓰기 API(RSVP · 방명록): 길이 제한(이름 20자, 메시지 300자), IP+slug 기준 간단한 rate limit, 방명록 비밀번호는 bcrypt 해시.
- 하객에게 전화번호 · 주소 등 연락처를 받지 않음 (이름 · 참석 여부 · 인원 · 식사 여부만).
- 사진은 브라우저에서 긴 변 1600px · webp(q≈0.8)로 줄인 뒤 업로드. 무료 한도 10장/초대장.
- UI 문구는 한국어. 모바일 우선(375px 기준), 데스크톱은 가운데 480px 컬럼.
- 비밀값은 환경변수로만. `.env.example`은 최신 유지, `.env*`는 절대 커밋 금지.
- 영상 · 사진 · 폰트 원본 등 큰 바이너리를 레포에 커밋하지 않음 (폰트는 woff2만, 샘플 사진은 R2).

## 환경변수

```
NEXT_PUBLIC_SITE_URL=
DATABASE_URL=
SESSION_SECRET=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=          # 필수. 새 카카오 앱은 클라이언트 시크릿이 기본 사용 상태
KAKAO_REDIRECT_URI=
NEXT_PUBLIC_KAKAO_JS_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=dearday-media
R2_PUBLIC_BASE_URL=
DEV_LOGIN=                    # 로컬 전용. 1이면 카카오 없이 개발용 로그인 허용. 운영에서 비워둘 것
```

Amplify 주의: 콘솔에 넣은 환경변수는 기본적으로 빌드 시점에만 보임. SSR 런타임(Route Handler)에서 쓰려면
`amplify.yml` 빌드 단계에서 필요한 값을 `.env.production`에 써 넣어야 함 (적용 완료). 환경변수를 바꾸면 반드시 재배포.

운영 환경 (2026-11-01 구성 완료): 사이트 `https://thedearday.com` (www → 루트 301), 사진 `https://media.thedearday.com` (R2, 프록시 켜짐),
Amplify 서울 리전, Neon 싱가포르, 카카오 앱 등록 완료. 배포 상태 확인은 `/api/health`.

## 작업 방식

- 순서는 `docs/PLAN.md`를 따름. 작업 단위로 작게 커밋 · 푸시하고, 같은 커밋에서 PLAN.md 체크박스를 갱신.
- 완료 기준: `pnpm lint && pnpm typecheck && pnpm build` 통과 + 해당 화면을 Playwright 모바일 뷰포트(390×844)로 열어 스크린샷 확인.
- 사용자 계정 · 키가 필요해 막히면: 로컬 Postgres · `DEV_LOGIN` · 가짜 업로드 등으로 우회하고 PLAN.md에 ⏸ 표시 후 다음 작업으로.
- 되돌릴 수 없는 작업(강제 푸시, DB 삭제, 운영 배포 설정 변경)은 PLAN.md에 사용자 승인이 기록된 것만 실행.
