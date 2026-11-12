'use client'

import classNames from 'classnames/bind'
import { useCallback, useEffect, useState } from 'react'

import type { IntroKind } from '@/shared/blocks'

import styles from './CoverShell.module.scss'

const cx = classNames.bind(styles)

/** 봉투가 열려 표지 화면으로 바뀌는 시각(ms) */
const REVEAL: Record<Exclude<IntroKind, 'none'>, number> = { seal: 1750, door: 2000, book: 1950 }

const HINT: Record<Exclude<IntroKind, 'none'>, string> = {
  seal: '도장을 눌러 열어 보세요',
  door: '리본을 눌러 열어 보세요',
  book: '책 표지를 눌러 열어 보세요',
}

const LABEL: Record<Exclude<IntroKind, 'none'>, string> = {
  seal: '도장 봉투 열기',
  door: '리본 카드 열기',
  book: '책 표지 넘기기',
}

type State = 'closed' | 'opening' | 'open'

/**
 * 표지 영역 껍데기. 봉투(첫 화면)와 '다시 보기'만 클라이언트에서 다루고,
 * 표지 · 효과 · 본문은 서버에서 그린 children 그대로 둔다.
 * 처음엔 닫힌 상태로 그려 두었다가(서버 렌더링), 같은 기기에서 다시 열었거나 ?go= 링크이거나
 * 움직임 줄이기 설정이면 바로 표지를 보여 준다.
 */
export default function CoverShell({
  kind,
  slug,
  preview,
  title,
  sealText,
  imageSrc,
  className,
  style,
  children,
}: {
  kind: Exclude<IntroKind, 'none'>
  slug: string
  preview: boolean
  title: string
  sealText: string
  imageSrc: string
  className: string
  style: React.CSSProperties
  children: React.ReactNode
}) {
  const [state, setState] = useState<State>('closed')
  const [run, setRun] = useState(0)
  const storageKey = `dearday:intro:${slug}`

  useEffect(() => {
    if (preview) return
    let skip = false
    try {
      skip =
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        new URLSearchParams(window.location.search).has('go') ||
        window.localStorage.getItem(storageKey) === '1'
    } catch {
      // 저장소를 못 쓰는 환경(사생활 보호 모드 등)에서는 항상 봉투부터 보여 줌
    }
    if (skip) setState('open')
  }, [preview, storageKey])

  // 닫혀 있는 동안 화면이 아래로 스크롤되지 않게
  useEffect(() => {
    if (preview || state === 'open') return
    const el = document.documentElement
    const prev = el.style.overflow
    el.style.overflow = 'hidden'
    return () => {
      el.style.overflow = prev
    }
  }, [preview, state])

  const open = useCallback(() => {
    setState('opening')
    window.setTimeout(() => {
      setState('open')
      if (!preview) {
        try {
          window.localStorage.setItem(storageKey, '1')
        } catch {
          // 기억하지 못해도 다음에 봉투를 한 번 더 볼 뿐
        }
      }
    }, REVEAL[kind])
  }, [kind, preview, storageKey])

  const replay = () => {
    setRun((n) => n + 1)
    setState('closed')
  }

  // 도장 글자: 직접 적은 것, 없으면 제목에서 처음 나오는 글자(기호 [ 등은 건너뜀)
  const glyph = (sealText || title.match(/[\p{L}\p{N}]/u)?.[0] || 'd').slice(0, 3)

  return (
    <section className={className} style={style} data-intro={state === 'open' ? 'done' : 'pending'}>
      {children}
      {state !== 'open' ? (
        <div className={cx('intro')} data-kind={kind} data-state={state} key={run}>
          <div className={cx('stage')}>
            {kind === 'seal' ? (
              <button
                type="button"
                className={cx('env')}
                aria-label={LABEL[kind]}
                disabled={state === 'opening'}
                onClick={open}
              >
                <span className={cx('back')} />
                <span className={cx('letter')}>
                  <i />
                  <i />
                  <i />
                </span>
                <span className={cx('pocket', 'pl')} />
                <span className={cx('pocket', 'pr')} />
                <span className={cx('pocket', 'pb')} />
                <span className={cx('flap')} />
                <span className={cx('stamp')}>
                  <span className={cx('ring')} />
                  <b>{glyph}</b>
                </span>
              </button>
            ) : null}
            {kind === 'door' ? (
              <button
                type="button"
                className={cx('card')}
                aria-label={LABEL[kind]}
                disabled={state === 'opening'}
                onClick={open}
              >
                <img src={imageSrc} alt="" width="280" height="350" />
                <span className={cx('door', 'dl')} />
                <span className={cx('door', 'dr')} />
                <span className={cx('ribbon')}>
                  <span className={cx('knot')}>{glyph}</span>
                </span>
              </button>
            ) : null}
            {kind === 'book' ? (
              <button
                type="button"
                className={cx('book')}
                aria-label={LABEL[kind]}
                disabled={state === 'opening'}
                onClick={open}
              >
                <img src={imageSrc} alt="" width="272" height="340" />
                <span className={cx('flip')}>
                  <span className={cx('front')}>
                    <span className={cx('emblem')}>{glyph}</span>
                    <span className={cx('bt')}>{title}</span>
                  </span>
                  <span className={cx('rear')} />
                </span>
              </button>
            ) : null}
            <p className={cx('hint')}>{HINT[kind]}</p>
          </div>
        </div>
      ) : (
        <button type="button" className={cx('replay')} aria-label="다시 보기" onClick={replay}>
          ↻
        </button>
      )}
    </section>
  )
}
