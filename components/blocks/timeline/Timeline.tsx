import classNames from 'classnames/bind'

import type { TimelineConfig } from '@/shared/blocks'

import Section from '../common/Section'
import Text from '../common/Text'
import styles from './Timeline.module.scss'

const cx = classNames.bind(styles)

/** 진행 순서: 왼쪽 시간 · 가는 세로선 · 점, 오른쪽 제목 · 설명. 비어 있으면 그리지 않음 */
export default function Timeline({ config }: { config: TimelineConfig }) {
  const items = config.items.filter((it) => it.time || it.title || it.body)
  if (items.length === 0) return null
  return (
    <Section eyebrow="TIMELINE" title={config.title} className={cx('container')}>
      <ol className={cx('list')}>
        {items.map((it, i) => (
          <li key={i} className={cx('row')}>
            <span className={cx('time')}>{it.time}</span>
            <span className={cx('rail')} aria-hidden="true" />
            <div className={cx('body')}>
              {it.title ? <strong className={cx('title')}>{it.title}</strong> : null}
              {it.body ? <Text className={cx('desc')}>{it.body}</Text> : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  )
}
