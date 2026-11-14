'use client'

import classNames from 'classnames/bind'
import { useEffect, useRef, useState } from 'react'

import type { MusicConfig } from '@/shared/blocks'
import { mediaSrc } from '@/shared/media'

import type { BlockContext } from '../types'
import styles from './Music.module.scss'

const cx = classNames.bind(styles)

/**
 * 배경음악. 자동 재생하지 않고, 화면 구석의 재생 버튼을 눌렀을 때만 파일을 받아 재생한다.
 * (Audio 객체를 누르기 전에는 만들지 않아 파일 요청도 없음)
 */
export default function Music({ config, ctx }: { config: MusicConfig; ctx: BlockContext }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)
  const key = config.audio?.key

  useEffect(
    () => () => {
      audioRef.current?.pause()
      audioRef.current = null
    },
    [key],
  )

  if (!config.audio) return null

  const toggle = async () => {
    if (!audioRef.current) {
      const a = new Audio(mediaSrc(ctx.mediaBaseUrl, config.audio!.key))
      a.loop = true
      a.preload = 'none'
      a.onpause = () => setPlaying(false)
      a.onplay = () => setPlaying(true)
      a.onerror = () => setFailed(true)
      audioRef.current = a
    }
    const a = audioRef.current
    if (!a.paused) {
      a.pause()
      return
    }
    try {
      setFailed(false)
      await a.play()
    } catch (err) {
      // 재생이 시작되기 전에 바로 멈춘 경우(AbortError)는 실패가 아님
      if ((err as DOMException)?.name !== 'AbortError') setFailed(true)
    }
  }

  return (
    <div
      data-music-fab={ctx.preview ? undefined : ''}
      className={cx('wrap', { inline: ctx.preview })}
    >
      <button
        type="button"
        className={cx('btn', { on: playing })}
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? '배경음악 멈추기' : '배경음악 재생'}
      >
        <span aria-hidden>{playing ? '❚❚' : '♪'}</span>
      </button>
      {config.title ? <span className={cx('title')}>{config.title}</span> : null}
      {failed ? <span className={cx('title')}>음악을 재생하지 못했어요</span> : null}
    </div>
  )
}
