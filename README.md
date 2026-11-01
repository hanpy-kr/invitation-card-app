# dearday

누구나 만들어 카톡 링크로 보내는 모바일 모임 초대장 웹 서비스.

- 개발 지침: [CLAUDE.md](./CLAUDE.md)
- 작업 순서: [docs/PLAN.md](./docs/PLAN.md)

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local     # SESSION_SECRET(32자 이상) 채우고, 로컬은 DEV_LOGIN=1
docker compose up -d           # 로컬 Postgres
pnpm db:migrate && pnpm db:seed
pnpm dev                       # http://localhost:3000/i/demowed1
```

- 카카오 키 없이도 `DEV_LOGIN=1`이면 "카카오로 시작하기"가 개발용 계정으로 로그인됩니다 (localhost에서만).
- R2 키가 없으면 사진은 `.local/uploads/<key>`에 저장하고 `/uploads/<key>`로 보여 줍니다(localhost에서만). 샘플 사진은 `.local/uploads/samples/wedding_XX.webp`.
- SQL 로그: `DB_LOG=1 pnpm dev`
- 모바일 스크린샷(390×844): `pnpm shot /i/demowed1` → `screenshots/` (로그인 화면은 `SHOT_LOGIN=1`)

## 확인

```bash
pnpm lint && pnpm typecheck && pnpm build
```
