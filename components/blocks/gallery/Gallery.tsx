'use client'

import classNames from 'classnames/bind'
import { lazy, Suspense, useCallback, useState } from 'react'

import Section from '../common/Section'
import styles from './Gallery.module.scss'

const cx = classNames.bind(styles)

// Swiper는 사진을 눌렀을 때만 내려받는다 (첫 로딩 JS 줄이기)
const ImageViewer = lazy(() => import('./ImageViewer'))

type Props = {
  title: string
  /** src: 크게 보기용 원본, thumbSrc: 바둑판용 썸네일 */
  images: { src: string; thumbSrc: string; w: number; h: number }[]
}

export default function Gallery({ title, images }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const handleClose = useCallback(() => setSelectedIdx(-1), [])

  if (images.length === 0) return null

  return (
    <>
      <Section title={title}>
        <ul className={cx('wrap-images')}>
          {images.map((img, idx) => (
            <li key={idx}>
              <button
                type="button"
                className={cx('wrap-image')}
                onClick={() => setSelectedIdx(idx)}
                aria-label={`사진 ${idx + 1} 크게 보기`}
              >
                <img
                  src={img.thumbSrc}
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
      </Section>
      {selectedIdx > -1 ? (
        <Suspense fallback={null}>
          <ImageViewer images={images} initialIndex={selectedIdx} onClose={handleClose} />
        </Suspense>
      ) : null}
    </>
  )
}
