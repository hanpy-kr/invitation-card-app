'use client'

import { useEffect, useState } from 'react'

import styles from './LargeTextToggle.module.scss'

const KEY = 'dearday:large-text'

/** 큰 글씨 보기: 본문 · 계좌 · 안내 · 진행 순서 글자만 1.2배 (CSS 변수 --read 하나로). 선택은 이 기기에 기억 */
export default function LargeTextToggle() {
  const [large, setLarge] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === '1') setLarge(true)
    } catch {}
  }, [])

  useEffect(() => {
    const col = document.querySelector<HTMLElement>('[data-guest-column]')
    col?.style.setProperty('--read', large ? '1.2' : '1')
  }, [large])

  function toggle() {
    const next = !large
    setLarge(next)
    try {
      localStorage.setItem(KEY, next ? '1' : '0')
    } catch {}
  }

  return (
    <button
      type="button"
      className={styles.btn}
      aria-pressed={large}
      aria-label={large ? '글씨 원래 크기로' : '큰 글씨로 보기'}
      onClick={toggle}
    >
      {large ? '가−' : '가+'}
    </button>
  )
}
