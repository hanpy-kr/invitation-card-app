'use client'

import classNames from 'classnames/bind'
import { useState } from 'react'

import type { VideoConfig } from '@/shared/blocks'
import { parseYoutubeId, youtubeEmbedUrl, youtubeThumbUrl } from '@/shared/video'

import Section from '../common/Section'
import styles from './Video.module.scss'

const cx = classNames.bind(styles)

/**
 * 유튜브 영상. 처음엔 썸네일 이미지만 보여 주고, 눌렀을 때 비로소 youtube-nocookie iframe을 붙인다
 * (누르기 전에는 유튜브 스크립트 · 쿠키 요청이 전혀 없음).
 */
export default function Video({ config }: { config: VideoConfig }) {
  const [playing, setPlaying] = useState(false)
  const id = parseYoutubeId(config.url)
  if (!id) return null

  return (
    <Section eyebrow="VIDEO" title={config.title}>
      <div className={cx('frame')}>
        {playing ? (
          <iframe
            src={youtubeEmbedUrl(id)}
            title={config.caption || config.title || '영상'}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className={cx('thumb')} onClick={() => setPlaying(true)}>
            <img src={youtubeThumbUrl(id)} alt="" loading="lazy" decoding="async" />
            <span className={cx('play')} aria-hidden>
              ▶
            </span>
            <span className={cx('sr')}>영상 재생</span>
          </button>
        )}
      </div>
      {config.caption ? <p className={cx('caption')}>{config.caption}</p> : null}
    </Section>
  )
}
