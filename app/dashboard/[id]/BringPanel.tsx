import type { ResponsesData } from '@/lib/dashboard'

import styles from './page.module.scss'

/** 주최자: 항목별 맡은 사람 + 엑셀 */
export default function BringPanel({
  invitationId,
  bring,
}: {
  invitationId: string
  bring: NonNullable<ResponsesData['bring']>
}) {
  const claimed = bring.items.reduce((n, it) => n + it.count, 0)
  return (
    <section className={styles.section} aria-label="나눠 맡기">
      <div className={styles.sectionHead}>
        <h2>
          {bring.title} · {claimed}건 {bring.visible ? '' : '(숨김)'}
        </h2>
        {claimed > 0 ? (
          <a href={`/api/invitations/${invitationId}/bring.csv`} download className={styles.csv}>
            엑셀로 받기
          </a>
        ) : null}
      </div>
      <ul className={styles.bring}>
        {bring.items.map((it) => (
          <li key={it.id} data-full={it.count >= it.need}>
            <div>
              <strong>{it.name}</strong>
              <span>
                {it.count}/{it.need}
                {it.count >= it.need ? ' · 마감' : ''}
              </span>
            </div>
            <p>{it.names.length > 0 ? it.names.join(', ') : '아직 없어요'}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
