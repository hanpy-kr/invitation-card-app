'use client'

import classNames from 'classnames/bind'
import { useCallback, useState } from 'react'

import Section from '../common/Section'
import styles from './Gallery.module.scss'
import ImageViewer from './ImageViewer'

const cx = classNames.bind(styles)

type Props = {
  title: string
  images: { src: string; w: number; h: number }[]
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
                  src={img.src}
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
        <ImageViewer images={images} initialIndex={selectedIdx} onClose={handleClose} />
      ) : null}
    </>
  )
}
