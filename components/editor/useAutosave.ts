'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../ui/api'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const DELAY_MS = 800

/**
 * 문서가 바뀌면 0.8초 뒤 저장. 저장 중에 또 바뀌면 끝난 뒤 한 번 더 저장한다.
 * flush()는 대기 중인 저장을 바로 실행하고 끝날 때까지 기다린다 (발행 전에 사용).
 */
export function useAutosave<T>(url: string, doc: T) {
  const [state, setState] = useState<SaveState>('saved')
  const [error, setError] = useState('')
  const latest = useRef(doc)
  const savedJson = useRef(JSON.stringify(doc))
  const inflight = useRef<Promise<unknown> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    latest.current = doc
  }, [doc])

  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current)
    for (;;) {
      if (inflight.current) {
        await inflight.current.catch(() => {})
        continue
      }
      const current = latest.current
      const json = JSON.stringify(current)
      if (json === savedJson.current) {
        setState('saved')
        return true
      }
      setState('saving')
      const run = api('/' + url.replace(/^\//, ''), { method: 'PUT', body: current })
      inflight.current = run
      try {
        await run
        savedJson.current = json
        setError('')
      } catch (err) {
        setError((err as Error).message)
        setState('error')
        return false
      } finally {
        inflight.current = null
      }
    }
  }, [url])

  useEffect(() => {
    if (JSON.stringify(doc) === savedJson.current) return
    setState((s) => (s === 'saving' ? s : 'dirty'))
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), DELAY_MS)
  }, [doc, flush])

  useEffect(() => () => clearTimeout(timer.current), [])

  // 저장 안 된 변경이 있으면 나가기 전에 경고
  useEffect(() => {
    if (state === 'saved') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [state])

  return { state, error, flush }
}
