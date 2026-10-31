import { Fragment } from 'react'

/** 줄바꿈(\n)을 <br />로 바꿔 보여 주는 텍스트. HTML은 해석하지 않는다. */
export default function Text({ children, className }: { children: string; className?: string }) {
  const lines = children.split('\n')
  return (
    <div className={className}>
      {lines.map((line, idx) => (
        <Fragment key={idx}>
          {line}
          {idx === lines.length - 1 ? null : <br />}
        </Fragment>
      ))}
    </div>
  )
}
