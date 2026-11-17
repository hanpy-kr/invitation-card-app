import { Fragment } from 'react'

/**
 * 줄바꿈(\n)을 <br />로 바꿔 보여 주는 텍스트. HTML은 해석하지 않는다.
 * paragraphs: 빈 줄로 나뉜 문단 사이를 var(--para-gap)만큼 띄움 (없으면 빈 줄 하나 = 글자 크기 2배)
 */
export default function Text({
  children,
  className,
  paragraphs,
}: {
  children: string
  className?: string
  paragraphs?: boolean
}) {
  if (paragraphs) {
    const paras = children.split(/\n{2,}/)
    return (
      <div className={className}>
        {paras.map((p, i) => (
          <span key={i} style={{ display: 'block', marginTop: i ? 'var(--para-gap, 2em)' : 0 }}>
            <Lines text={p} />
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className={className}>
      <Lines text={children} />
    </div>
  )
}

function Lines({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, idx) => (
        <Fragment key={idx}>
          {line}
          {idx === lines.length - 1 ? null : <br />}
        </Fragment>
      ))}
    </>
  )
}
