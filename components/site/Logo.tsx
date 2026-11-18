const box = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  textDecoration: 'none',
} as const

const word = {
  fontFamily: 'var(--font-display), serif',
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: '#b0aaa0',
  textShadow: '0 1px 0 rgba(255,255,255,0.95), 0 -1px 0 rgba(60,54,46,0.42)',
} as const

/**
 * 음각 워드마크 dearday (Noto Serif KR 700, 22px). 도장은 쓰지 않는다.
 * 스타일을 CSS 모듈 대신 인라인으로 둔 이유: 응답 화면에서 CSS 모듈로 두면
 * router.refresh()가 전체 새로고침으로 바뀌어 입금 체크 직후 숫자가 늦게 갱신됨(e2e로 확인, 원인 미확인).
 * `label`은 옛 호출부 호환용(편집기에서 href={null}).
 */
export default function Logo({
  href = '/',
}: {
  href?: string | null
  label?: boolean
}) {
  const body = <span style={word}>dearday</span>
  return href ? (
    <a href={href} style={box} aria-label="dearday 디어데이">
      {body}
    </a>
  ) : (
    <span style={box}>{body}</span>
  )
}
