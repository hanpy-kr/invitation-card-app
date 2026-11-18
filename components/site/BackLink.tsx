import Link from 'next/link'

/** 화면 위 뒤로 가기: 화살표 아이콘만 (글자는 화면 읽기 프로그램용 aria-label로) */
export default function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        marginLeft: -12,
        color: 'var(--text)',
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  )
}
