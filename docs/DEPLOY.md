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
   - 이 레코드는 Cloudflare가 자동으로 만들고 **프록시(주황 구름)가 켜진 상태가 정상**입니다. 'DNS only'는 아래 '4. AWS Amplify' 5단계의 Amplify 레코드에만 해당
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
| `ADMIN_KAKAO_IDS` | (2차, 선택) `/admin/stats`를 볼 카카오 회원번호, 쉼표로 구분. 비워 두면 아무도 못 봄 |
| `KAKAO_TOKEN_KEY` | (2차, 선택) 새 응답 카톡 알림용 카카오 토큰 암호화 키. `openssl rand -hex 32` (hex 64자). 비워 두면 알림 기능이 숨겨짐. **한 번 정하면 바꾸지 말 것** — 바꾸면 저장된 토큰을 못 읽어 알림이 멈추고, 이용자가 다시 켜야 함 |
| `NEXT_PUBLIC_TOSS_CLIENT_KEY` | (결제, 선택) 토스페이먼츠 **결제위젯 클라이언트 키**(`test_gck_…` 테스트 / `live_gck_…` 운영). 비어 있으면 결제 버튼이 숨겨짐 |
| `TOSS_SECRET_KEY` | (결제, 선택) 토스페이먼츠 **결제위젯 시크릿 키**(`test_gsk_…` / `live_gsk_…`). **서버에서만** 씀. 채팅 · 코드에 붙이지 말 것 |
| `PAYMENTS_LIVE` | (결제, 선택) 결제를 **시작하는 시각**, ISO 8601 (예 `2026-12-01T00:00:00+09:00`). 비어 있으면 결제 꺼짐 = 모든 초대장이 지금처럼 무료(프리미엄 기능 전부 열림). 그 시각 **이전에 만든 초대장은 소급하지 않음**(봉투 · 효과 · 사진 10장 그대로). 시각이 지나고 위 두 키가 있어야 결제 버튼이 보임 |

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

## 6. 일회성: 예전 사진에 카톡 미리보기용 JPEG 사본 · 사진첩 썸네일 만들기

11/2 업데이트 전에 올라간 사진에는 `*.share.jpg` 사본과 `*.thumb.webp` 썸네일이 없습니다. 썸네일이 없으면 사진첩 바둑판에 원본을 씁니다(동작은 하지만 무거움). 사본이 없으면 공유 카드는 원본이 JPG면 원본,
webp면 행사 종류별 기본 이미지로 대신 나갑니다. 사진이 나오게 하려면 한 번 실행하세요 (여러 번 돌려도 안전).

```bash
# 레포 클론한 내 컴퓨터에서. 운영 값은 콘솔에서 복사해 이 터미널에만 넣기 (채팅에 붙이지 말 것)
export DATABASE_URL='Neon 주소' R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=dearday-media
pnpm install
pnpm backfill:share            # 미리 보기: 몇 장을 만들지 출력만
pnpm backfill:share --apply    # 사본 만들고 초대장 설정에 표시
```

- 결과 마지막 줄 `완료: 사본 N장 생성, 블록 M개 갱신, 실패 0장` 확인
- 카톡에 이미 공유한 링크는 카카오가 미리보기를 캐시해 둡니다. 바로 바꾸려면 카카오 개발자 사이트 [도구] > [카카오톡 URL 메타정보 관리](https://developers.kakao.com/tool/debugger/sharing)에서 초대장 주소 입력 → [메타 정보 조회] → [캐시 초기화]

## 7. 손글씨 폰트 캐시 헤더

폰트 조각(`/fonts/nanum-geumeunbohwa/v1/*.woff2`)은 1년 캐시로 내보냅니다.
Amplify는 정적 파일에 `next.config.ts`의 `headers()`를 적용하지 않으므로(11/3 운영에서 `max-age=5, stale-while-revalidate`로 나옴 확인),
**운영 헤더는 레포 루트의 `customHttp.yml`이 정합니다.** `next.config.ts`의 `headers()`는 로컬(`next start`)용으로 남겨 둠.

```yaml
# customHttp.yml (레포 루트)
customHeaders:
  - pattern: '**/*.woff2'
    headers:
      - key: Cache-Control
        value: public, max-age=31536000, immutable
```

배포 후 확인:

```bash
curl -sI https://thedearday.com/fonts/nanum-geumeunbohwa/v1/119.woff2 | grep -iE '^HTTP|cache-control|content-type'
# 기대값
# HTTP/2 200
# cache-control: public, max-age=31536000, immutable
# content-type: font/woff2
```

- 그대로 `max-age=5`로 나오면: Amplify 콘솔 → Hosting → Custom headers에 다른 설정이 들어가 있는지 확인(콘솔 설정이 있으면 그걸 쓰는 경우가 있음). 콘솔에 같은 내용을 넣거나 비우고 재배포
- CloudFront에 예전 응답이 남아 있을 수 있으니, 바로 확인하려면 `?v=check` 같은 쿼리를 붙여 한 번 더 확인
- 초대장 HTML에 미리 받기 태그가 들어갔는지: `curl -s https://thedearday.com/i/<slug> | grep -o 'rel="preload" href="/fonts/[^"]*"'`
- 폰트를 다시 자르거나 바꾸면 `scripts/subset-font.py`의 `VERSION`을 올려(v2) 주소를 바꿀 것. 같은 주소로 내용만 바꾸면 하객 휴대폰에 1년간 옛 파일이 남습니다
- 헤더를 바꿀 때는 `customHttp.yml`과 `next.config.ts`의 `headers()`를 같이 고칠 것

## 알려진 한계

- 서버 런타임용 비밀값이 `.env.production`으로 배포 산출물에 들어감 (AWS 문서 방식). 산출물 접근 권한을 AWS 계정 관리자로 한정할 것. 나중에 SSM Parameter Store + IAM 역할로 옮기는 것을 검토
- `pnpm db:migrate`가 빌드마다 실행됨. 이미 적용된 마이그레이션은 건너뜀. 테이블을 지우는 마이그레이션은 만들지 않는 것을 원칙으로

## 새 응답 카톡 알림 켜기 (⏸ 사용자 작업)

코드는 들어 있지만 아래를 마치기 전에는 대시보드에 알림 버튼이 보이지 않습니다.

1. 카카오 개발자 콘솔 → 내 애플리케이션 → 카카오 로그인 → 동의항목 → **카카오톡 메시지 전송(`talk_message`)** 을 '선택 동의'로 설정
2. Amplify 환경변수 `KAKAO_TOKEN_KEY` 추가 (`openssl rand -hex 32`) → **재배포**
3. 대시보드에서 [알림 켜기] → 카카오 동의 → 새 응답이 오면 내 카카오톡(나와의 채팅)으로 알림

## 8. 결제(토스페이먼츠) 켜기 — 사용자용 순서

결제는 코드가 배포돼 있어도 `PAYMENTS_LIVE`가 비어 있으면 **일반 회원에게는 결제 버튼 · `/pricing` 결제 안내가 보이지 않고 모든 기능이 무료**입니다.
아래 순서대로, **앞 단계가 끝나기 전에 다음 단계로 가지 마세요.**

> ⚠️ **`PAYMENTS_LIVE`에는 과거 시각을 절대 넣지 마세요.** 이 시각 이후에 만든 초대장만 '무료/프리미엄'이 갈리고, 그 전에 만든 초대장은 기존 약속대로 프리미엄 권한(legacy)을 유지합니다. 과거 시각을 넣으면 "지금까지 무료로 만든 초대장"이 한꺼번에 무료 플랜으로 바뀌어 사진 한도 · 효과가 사라집니다. 항상 **재배포가 끝난 뒤에 도착할 미래 시각**(예: 재배포 하루 뒤 자정)을 넣으세요.

1. **토스 키 2개 넣기 (테스트 키)** — 토스페이먼츠 개발자센터 → API 키. Amplify 환경변수에 `NEXT_PUBLIC_TOSS_CLIENT_KEY`(`test_gck_…`) · `TOSS_SECRET_KEY`(`test_gsk_…`)를 넣습니다. 이때 `PAYMENTS_LIVE`는 **비워 둡니다.** (시크릿 키는 서버에서만 쓰입니다)
2. **재배포** — 환경변수는 빌드 시점에 들어가므로 바꿀 때마다 재배포가 필요합니다.
3. **웹훅 등록** — 토스 개발자센터 → 웹훅 → 새 웹훅: 주소 `https://thedearday.com/api/webhooks/toss`, 이벤트 `PAYMENT_STATUS_CHANGED`. 토스 대시보드에서 결제를 직접 취소하면 dearday의 결제 내역 · 프리미엄도 자동으로 취소로 바뀝니다(서버가 토스 조회 API로 다시 확인한 뒤에만 반영). 테스트 키 / 운영 키 각각 등록해야 합니다.
4. **관리자 결제 미리 보기** — `ADMIN_KAKAO_IDS`(내 카카오 회원번호)가 들어 있으면, `PAYMENTS_LIVE`가 꺼져 있어도 **나(관리자)에게만** 편집기에 프리미엄 안내 · 결제 버튼이 보입니다. 새 초대장 → 결제(토스 테스트 결제, 실제 청구 없음) → 대시보드 결제 내역 · 영수증 → 환불(발행 전 · 7일 이내)까지 한 바퀴 확인하세요. 다른 회원에게는 여전히 아무것도 보이지 않습니다.
5. **통신판매업 신고번호** — 신고를 마치고 번호를 받으면 `shared/business.ts`의 `mailOrderNumber`에 입력해 푸터에 표시합니다(개발 세션에 요청해도 됩니다). 토스 심사에는 `/pricing`(가격 · 환불 규정), 약관, 사업자 정보, 신고번호가 사이트에 보여야 합니다.
6. **약관 · 개인정보처리방침 개정 공지** — 개정안은 `/terms/payments`, `/privacy/payments`에 있습니다. 시행일을 정하고 **시행 7일 전(이용자에게 불리한 변경이면 30일 전)부터 공지**합니다. 시행일이 되면 개발 세션에 시행 반영을 요청하세요(지금 시행 중인 문서는 그때까지 그대로).
7. **운영 키로 교체** — 심사 통과 후 `NEXT_PUBLIC_TOSS_CLIENT_KEY`(`live_gck_…`) · `TOSS_SECRET_KEY`(`live_gsk_…`)로 바꾸고, 토스 웹훅도 운영 키 쪽에 등록합니다.
8. **`PAYMENTS_LIVE`에 미래 시각 넣고 재배포** — 시행일(약관 개정 시행일과 같거나 이후)의 시각을 `2026-12-01T00:00:00+09:00` 형식으로 넣습니다. 그 시각이 되면 결제 버튼이 일반 회원에게도 열리고, 그 시각 이후에 만든 초대장부터 무료/프리미엄이 갈립니다. 재배포는 그 시각 **전에** 끝내세요.
9. **되돌리기** — `PAYMENTS_LIVE`를 비우고 재배포하면 결제 버튼이 사라지고 모든 초대장이 다시 프리미엄 권한(무료)이 됩니다. 이미 결제된 주문은 그대로 남고, 환불은 대시보드 결제 내역에서(또는 토스 대시보드에서 직접 — 웹훅이 반영) 할 수 있습니다.

운영 중에 결제한 초대장을 지우려 하면 확인창이 "결제 후 7일 안이고 발행 전이면 먼저 환불할 수 있어요"를 안내하고 [환불하기]로 대시보드 결제 내역에 보냅니다.

## 9. 그로블 켜는 순서 (임시 결제 수단, 사용자용)

토스 심사가 끝나기 전에 그로블(통신판매중개)로 먼저 결제를 받는 방법입니다. 코드는 `PAYMENT_PROVIDER`로 전환하며, 토스 설정(8장)은 그대로 두어도 됩니다. 값을 `groble`로 바꾸면 결제 시작이 그로블 결제 링크로 가고, 결제 결과는 **웹훅으로만** 확인합니다(구매자 이름 · 전화 · 이메일은 저장하지 않음).

> ⚠️ 8장의 경고와 같습니다. **`PAYMENTS_LIVE`는 과거 시각 금지** — 재배포가 끝난 뒤에 도착할 미래 시각을 넣으세요. 그 전까지는 아래 5단계의 관리자 미리 보기로만 결제됩니다.

1. **그로블에서 상품 2개 만들기** — 둘 다 서비스형:
   - 결혼 · 돌 · 감사장용 **14,900원**, 모임용 **3,900원**
   - 진입(랜딩) 페이지 `https://thedearday.com/pricing`
   - 결제 후 이동 페이지 `https://thedearday.com/pay/return`
2. **웹훅 등록** — 그로블 판매자 설정에 주소 `https://thedearday.com/api/webhooks/groble`, 이벤트 `payment.completed` · `payment.refunded` · `payment.cancel_requested`. 이때 나오는 **웹훅 시크릿**을 복사해 둡니다.
3. **Amplify 환경변수** — `GROBLE_LINK_14900`, `GROBLE_LINK_3900`(각 상품의 결제창 링크, `https://`로 시작), `GROBLE_WEBHOOK_SECRET`. (선택) `GROBLE_ORDER_URL`: 대시보드 [그로블에서 환불 신청]이 보내는 그로블 주문조회 주소(비우면 https://www.groble.im — 실제 주소와 다르면 꼭 넣으세요).
4. **`PAYMENT_PROVIDER=groble`** 넣고 **재배포**. 링크 2개와 시크릿 중 하나라도 비어 있으면 결제가 열리지 않습니다(관리자 미리 보기도 안 열림).
5. **관리자 3,900원 실결제 · 환불 확인** — `ADMIN_KAKAO_IDS`에 내 회원번호가 있으면 `PAYMENTS_LIVE`가 비어 있어도 나만 결제 버튼이 보입니다. 모임 초대장(3,900원)을 만들어 결제 → 그로블 결제창 → 이동 페이지에서 "결제를 확인하고 있어요" 뒤 편집기로 돌아오는지, 대시보드 결제 내역이 '결제 완료'인지 확인. 이어서 그로블 주문조회에서 환불 신청 → 처리되면 '환불됨'(요청 직후에는 '환불 요청됨')으로 바뀌고 프리미엄이 풀리는지 확인합니다. 결제가 완료로 안 바뀌면 `orders.fail_reason`(금액 불일치 등)을 보세요.
6. 문제가 없으면 8장의 6~8단계(약관 · 방침 공지 → `PAYMENTS_LIVE` 미래 시각 → 재배포)로 일반 회원에게 엽니다.
7. 토스로 돌아가기: `PAYMENT_PROVIDER`를 비우거나 `toss`로 하고 재배포. 이미 그로블로 결제된 주문은 그대로 남고, 환불은 그로블 주문조회에서 합니다.

환불 규정은 그로블 표준 규정(서비스 제공 전 7일 내 전액 / 제공 후 실제 제공분 공제)과 어긋나지 않게 맞춰 두었습니다. dearday에서는 그로블 주문을 직접 취소할 수 없어서, 그로블 환불은 그로블 쪽에서 신청하고 웹훅(`payment.refunded`)이 도착하면 dearday에 반영됩니다.
