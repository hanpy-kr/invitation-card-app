'use client'

import { useEffect, useState } from 'react'

import styles from '../common/guestForm.module.scss'
import { useNearViewport } from '../common/useNearViewport'

/** 참석자 명단 (이름만). 화면 근처에 오면 API로 불러온다. version이 바뀌면 다시 불러옴 */
export default function Attendees({ slug, version }: { slug: string; version: number }) {
  const [ref, near] = useNearViewport<HTMLDivElement>('300px')
  const [names, setNames] = useState<string[] | null>(null)

  useEffect(() => {
    if (!near) return
    let cancelled = false
    fetch(`/api/i/${slug}/attendees`)
      .then((r) => (r.ok ? r.json() : { names: [] }))
      .then((d: { names: string[] }) => !cancelled && setNames(d.names))
      .catch(() => !cancelled && setNames([]))
    return () => {
      cancelled = true
    }
  }, [near, slug, version])

  return (
    <div ref={ref} className={styles.attendees} aria-live="polite">
      <strong>참석 예정 {names ? `${names.length}명` : ''}</strong>
      {names === null ? (
        <p>불러오는 중…</p>
      ) : names.length === 0 ? (
        <p>아직 참석 응답이 없어요. 첫 번째로 알려 주세요!</p>
      ) : (
        <ul>
          {names.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
