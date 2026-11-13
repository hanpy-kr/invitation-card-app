import classNames from 'classnames/bind'

import type { EffectKind } from '@/shared/blocks'
import { makePieces, type EffectDensity } from '@/shared/effects'

import styles from './CoverEffect.module.scss'

const cx = classNames.bind(styles)

/** 표지 위에 떨어지는 조각 층. 서버에서 그려 두고 CSS(transform · opacity)로만 움직임 */
export default function CoverEffect({
  kind,
  density,
  once,
  lightPaper = false,
}: {
  kind: Exclude<EffectKind, 'none'>
  density: EffectDensity
  once: boolean
  /** 밝은 종이 위: 흰 조각이 묻히지 않게 옅은 푸른 회색 그림자·테두리를 더함 */
  lightPaper?: boolean
}) {
  const pieces = makePieces(kind, density)
  return (
    <div className={cx('fx', kind, { once, light: lightPaper })} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={cx('p', { alt: p.alt, up: p.up })}
          style={
            {
              left: `${p.x}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              '--c': p.color,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
              '--sway': `${p.sway}px`,
              '--rot': `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
