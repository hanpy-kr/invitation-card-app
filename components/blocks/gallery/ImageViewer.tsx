'use client'

import classNames from 'classnames/bind'
import { useEffect, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'

import 'swiper/css'

import { IconClose } from '../common/icons'
import styles from './ImageViewer.module.scss'

const cx = classNames.bind(styles)

type Props = {
  images: { src: string; w: number; h: number }[]
  /** 처음 보여 줄 사진 (누른 사진) */
  initialIndex: number
  onClose: () => void
}

/** 전체 화면 사진 보기. 열려 있는 동안 배경 스크롤을 잠그고 ESC로 닫는다. */
export default function ImageViewer({ images, initialIndex, onClose }: Props) {
  const [current, setCurrent] = useState(initialIndex)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    // iOS Safari는 overflow:hidden만으로 안 잠기므로 body를 고정했다가 원래 위치로 되돌린다
    const { body } = document
    const scrollY = window.scrollY
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    return () => {
      Object.assign(body.style, prev)
      window.scrollTo(0, scrollY)
    }
  }, [])

  return (
    <div className={cx('dimmed')} role="dialog" aria-modal="true" aria-label="사진 크게 보기">
      <button type="button" className={cx('btn-close')} onClick={onClose} aria-label="닫기">
        <IconClose />
      </button>
      <div className={cx('txt-count')}>
        {current + 1} / {images.length}
      </div>
      <Swiper
        spaceBetween={20}
        slidesPerView={1}
        loop={images.length > 1}
        initialSlide={initialIndex}
        onSlideChange={(s) => setCurrent(s.realIndex)}
      >
        {images.map((img, idx) => (
          <SwiperSlide key={idx}>
            <img src={img.src} width={img.w} height={img.h} alt={`사진 ${idx + 1}`} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}
