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
  /** src: 크게 보기용 원본, thumbSrc: 바둑판용 썸네일 */
  images: { src: string; thumbSrc: string; w: number; h: number }[]
}

export default function Gallery({ title, layout = 'grid', images }: Props) {
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

  return (
    <>
      <Section eyebrow="GALLERY" title={title}>
        <ul
          ref={layout === 'slide' ? stripRef : undefined}
          onScroll={layout === 'slide' ? onScroll : undefined}
          className={cx('wrap-images', layout)}
        >
          {images.map((img, idx) => (
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
