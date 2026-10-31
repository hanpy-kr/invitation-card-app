export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 12 }}>dearday</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 32 }}>
        모바일 초대장을 만들어 카톡으로 보내세요.
      </p>
      <a
        href="/api/auth/kakao/login?next=/dashboard"
        style={{
          display: 'inline-block',
          padding: '14px 24px',
          borderRadius: 12,
          background: '#FEE500',
          color: '#191919',
          textDecoration: 'none',
          fontWeight: 'bold',
        }}
      >
        카카오로 시작하기
      </a>
    </main>
  )
}
