import { Fragment } from 'react'

/** URL과 전화번호를 링크로 바꿔 보여 주는 텍스트. 줄바꿈 유지, HTML은 해석하지 않는다. */
const PATTERN =
  /(https?:\/\/[^\s<>"']+[^\s<>"'.,)!?]|(?:\+82[- ]?)?0\d{1,2}[- ]?\d{3,4}[- ]?\d{4})/g

export function linkify(line: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(PATTERN)) {
    const text = m[0]
    const at = m.index ?? 0
    // 더 긴 숫자(계좌번호 등)의 일부는 전화번호로 보지 않음 (lookbehind는 구형 iOS에서 문법 오류라 직접 확인)
    const isPhone = !text.startsWith('http')
    if (isPhone && (/\d/.test(line[at - 1] ?? '') || /\d/.test(line[at + text.length] ?? '')))
      continue
    if (at > last) out.push(line.slice(last, at))
    const href = text.startsWith('http') ? text : `tel:${text.replace(/[^\d+]/g, '')}`
    out.push(
      <a
        key={at}
        href={href}
        {...(text.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {text}
      </a>,
    )
    last = at + text.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

export default function LinkedText({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  const lines = children.split('\n')
  return (
    <div className={className}>
      {lines.map((line, idx) => (
        <Fragment key={idx}>
          {linkify(line)}
          {idx === lines.length - 1 ? null : <br />}
        </Fragment>
      ))}
    </div>
  )
}
