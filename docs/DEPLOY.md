# 배포 체크리스트 (AWS Amplify + Neon + Cloudflare R2 + 카카오)

순서대로 진행합니다. 키 · 비밀번호는 채팅에 붙이지 말고 각 콘솔에 직접 입력하세요.

## 1. Neon (DB)

1. Neon 프로젝트 만들기 — 리전 **AWS Asia Pacific (Singapore)**, Postgres 16 이상
2. Connection string에서 **Pooled connection** 주소를 복사 → Amplify 환경변수 `DATABASE_URL`
   (끝에 `?sslmode=require` 포함)
3. 테이블은 Amplify 빌드 때 `pnpm db:migrate`가 자동으로 만듦

## 2. Cloudflare R2 (사진)

1. 버킷 `dearday-media` 만들기
2. 공개 접근: 버킷 Settings → Custom Domain → `media.thedearday.com` 연결 → `R2_PUBLIC_BASE_URL`은 `https://media.thedearday.com`
   - 이 레코드는 Cloudflare가 자동으로 만들고 **프록시(주황 구름)가 켜진 상태가 정상**입니다. 아래 4번의 'DNS only'는 Amplify 레코드에만 해당
3. R2 → Manage API tokens → **Object Read & Write**, 이 버킷만 → Access Key ID / Secret → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
4. 계정 ID → `R2_ACCOUNT_ID`
5. 버킷 Settings → CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://thedearday.com", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```


## 3. 카카오 개발자 콘솔

1. 앱 만들기 → 앱 키: REST API 키 → `KAKAO_REST_API_KEY`, JavaScript 키 → `NEXT_PUBLIC_KAKAO_JS_KEY`
2. 플랫폼 → Web → 사이트 도메인: `https://thedearday.com`, `http://localhost:3000`
3. 카카오 로그인 → 활성화 ON, Redirect URI: `https://thedearday.com/api/auth/kakao/callback`
4. 동의항목 → 닉네임(필수)
5. 보안 → Client Secret → 코드 발급 → `KAKAO_CLIENT_SECRET` (**필수**)
   - 새로 만든 앱은 Client Secret이 기본으로 '사용함'이라, 이 값이 없으면 로그인 토큰 발급이 실패합니다(로그인 후 랜딩으로 돌아와 '로그인하지 못했어요')
6. 지도 · 로컬 API(주소 검색)가 앱에서 사용 설정돼 있는지 확인

## 4. AWS Amplify

1. 리전 **서울(ap-northeast-2)** → New app → GitHub `hanpy-kr/invitation-card-app`, 브랜치 `main`
2. 빌드 설정은 레포의 `amplify.yml` 사용 (프레임워크 Next.js - SSR, 플랫폼 WEB_COMPUTE)
3. 환경변수 (Hosting → Environment variables):

| 이름 | 값 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://thedearday.com` |
| `DATABASE_URL` | Neon pooled 주소 |
| `SESSION_SECRET` | 64자 랜덤 (`openssl rand -hex 32`) |
| `KAKAO_REST_API_KEY` | |
| `KAKAO_CLIENT_SECRET` | **필수** (카카오 콘솔 → 보안 → Client Secret) |
| `KAKAO_REDIRECT_URI` | `https://thedearday.com/api/auth/kakao/callback` |
| `NEXT_PUBLIC_KAKAO_JS_KEY` | |
| `R2_ACCOUNT_ID` · `R2_ACCESS_KEY_ID` · `R2_SECRET_ACCESS_KEY` | |
| `R2_BUCKET` | `dearday-media` |
| `R2_PUBLIC_BASE_URL` | `https://media.thedearday.com` |

`DEV_LOGIN`은 **넣지 않습니다**. (넣어도 amplify.yml이 런타임에 넘기지 않고, 코드도 localhost에서만 허용)

4. Hosting → Custom domains → Add domain → `thedearday.com`
   - **대표 주소는 루트 도메인 `thedearday.com`**, `www`는 루트로 보내는 리다이렉트용
   - 서브도메인 목록에서 루트(`thedearday.com`)와 `www` **둘 다** `main` 브랜치에 연결
   - Amplify가 기본으로 켜 두는 '`thedearday.com` → `www.thedearday.com` 리다이렉트' 옵션은 **끕니다** (방향이 반대 — 켜 두면 루트 ↔ www가 서로 넘기며 무한 리다이렉트)
   - `www.thedearday.com` → `https://thedearday.com` **301**은 `next.config.ts`에서 처리 (경로 · 쿼리 유지)
5. Cloudflare DNS에 Amplify가 알려 주는 레코드 추가 — **모두 프록시 끄고 'DNS only'(회색 구름)**
   - SSL 인증서 확인용 CNAME (`_xxxx.thedearday.com` → `_yyyy.acm-validations.aws`)
   - 루트 `thedearday.com` → Amplify가 준 `xxxx.cloudfront.net` (Cloudflare는 루트에도 CNAME 가능 — 자동 평탄화)
   - `www` → 같은 `xxxx.cloudfront.net`
   - 프록시를 켜면(주황 구름) 인증서 확인이 끝나지 않거나, Cloudflare와 CloudFront가 겹쳐 SSL 오류 · 리다이렉트 반복이 생깁니다
   - Amplify 화면에서 도메인 상태가 'Available'이 될 때까지 대기 (보통 수십 분)
6. 리다이렉트 확인: `curl -I https://www.thedearday.com/i/아무주소` → `301`, `location: https://thedearday.com/i/아무주소`
7. 배포 후 확인: `https://thedearday.com/api/health` →
   `{"ok":true,"db":true,"session":true,"storage":"r2","kakaoLogin":true,"kakaoClientSecret":true,"kakaoJs":true,"devLogin":false}`

## 5. 운영 스모크 테스트 (휴대폰으로)

1. 카카오로 시작하기 → 로그인 → 결혼식 만들기
2. 사진 3장 올리기 → 날짜 · 장소 검색 → 발행 → 카카오톡으로 보내기 (나에게 보내기)
3. 카톡 미리보기 카드에 제목 · 날짜 · 사진이 나오는지
4. 카톡에서 링크 열기 → 지도 · 길찾기 · 참석 응답 · 방명록
5. 대시보드 → 응답 보기에서 집계 확인

## 알려진 한계

- 서버 런타임용 비밀값이 `.env.production`으로 배포 산출물에 들어감 (AWS 문서 방식). 산출물 접근 권한을 AWS 계정 관리자로 한정할 것. 나중에 SSM Parameter Store + IAM 역할로 옮기는 것을 검토
- `pnpm db:migrate`가 빌드마다 실행됨. 이미 적용된 마이그레이션은 건너뜀. 테이블을 지우는 마이그레이션은 만들지 않는 것을 원칙으로
