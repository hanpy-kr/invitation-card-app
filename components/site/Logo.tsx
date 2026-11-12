import Seal from './Seal'

const box = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 44,
  color: 'var(--text)',
  textDecoration: 'none',
} as const

/**
 * 도장 + dearday(18px) + 디어데이(10px, 자간 0.3em).
 * 스타일을 CSS 모듈 대신 인라인으로 둔 이유: 응답 화면에서 CSS 모듈로 두면
 * router.refresh()가 전체 새로고침으로 바뀌어 입금 체크 직후 숫자가 늦게 갱신됨(e2e로 확인, 원인 미확인).
 */
export default function Logo({
  href = '/',
  label = true,
}: {
  href?: string | null
  label?: boolean
}) {
  const body = (
    <>
      <Seal />
      {label ? (
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <span
            style={{
              fontFamily: 'var(--font-display), serif',
              fontSize: 18,
              letterSpacing: '0.04em',
            }}
          >
            dearday
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display), serif',
              fontSize: 10,
              letterSpacing: '0.3em',
              color: 'var(--muted)',
            }}
          >
            디어데이
          </span>
        </span>
      ) : null}
    </>
  )
  return href ? (
    <a href={href} style={box} aria-label="dearday 디어데이">
      {body}
    </a>
  ) : (
    <span style={box}>{body}</span>
  )
}
