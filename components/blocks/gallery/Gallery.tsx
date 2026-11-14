'use client'

import classNames from 'classnames/bind'
import { lazy, Suspense, useCallback, useRef, useState } from 'react'

import Section from '../common/Section'
import styles from './Gallery.module.scss'

const cx = classNames.bind(styles)

// Swiper는 사진을 눌렀을 때만 내려받는다 (첫 로딩 JS 줄이기)
const ImageViewer = lazy(() => import('./ImageViewer'))

type Props = {
  title: string
  layout?: 'grid' | 'ratio' | 'slide'
  /** 처음엔 4장(2×2)만, '더보기'로 나머지 */
  collapse?: boolean
  /** src: 크게 보기용 원본, thumbSrc: 바둑판용 썸네일 */
  images: { src: string; thumbSrc: string; w: number; h: number }[]
}

export default function Gallery({ title, layout = 'grid', collapse = false, images }: Props) {
  const [open, setOpen] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [slideIdx, setSlideIdx] = useState(0)
  const stripRef = useRef<HTMLUListElement>(null)
  const handleClose = useCallback(() => setSelectedIdx(-1), [])

  if (images.length === 0) return null

  const onScroll = () => {
    const el = stripRef.current
    if (!el) return
    setSlideIdx(Math.round(el.scrollLeft / el.clientWidth))
  }

  // 접기: 넘겨 보기가 아닐 때만, 2열 바둑판으로 4장
  const folded = collapse && layout !== 'slide'
  const shown = folded && !open ? images.slice(0, 4) : images

  return (
    <>
      {/* 예전 기본 제목 '사진첩'은 새 기본 제목 '갤러리'로 보여 줌 (직접 고친 제목은 그대로) */}
      <Section eyebrow="GALLERY" title={title === '사진첩' ? '갤러리' : title}>
        <ul
          ref={layout === 'slide' ? stripRef : undefined}
          onScroll={layout === 'slide' ? onScroll : undefined}
          className={cx('wrap-images', layout, { two: folded })}
        >
          {shown.map((img, idx) => (
            <li key={idx}>
              <button
                type="button"
                className={cx('wrap-image')}
                onClick={() => setSelectedIdx(idx)}
                aria-label={`사진 ${idx + 1} 크게 보기`}
              >
                <img
                  // 넘겨 보기는 칸이 커서 원본(1600px)을 쓰고, 바둑판 · 원본 비율은 썸네일
                  src={layout === 'slide' ? img.src : img.thumbSrc}
                  width={img.w}
                  height={img.h}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </li>
          ))}
        </ul>
        {folded && !open && images.length > 4 ? (
          <button type="button" className={cx('more')} onClick={() => setOpen(true)}>
            더보기
          </button>
        ) : null}
        {layout === 'slide' && images.length > 1 ? (
          <p className={cx('counter')} aria-live="polite">
            {slideIdx + 1} / {images.length}
          </p>
        ) : null}
      </Section>
      {selectedIdx > -1 ? (
        <Suspense fallback={null}>
          <ImageViewer images={images} initialIndex={selectedIdx} onClose={handleClose} />
        </Suspense>
      ) : null}
    </>
  )
}
