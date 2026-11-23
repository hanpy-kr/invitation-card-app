'use client'

import { useState, type ReactNode } from 'react'

import styles from './ShareGuard.module.scss'

/** 이 브라우저 화면 수명 동안 이미 기록한 초대장 (같은 화면에서 확인 창이 또 뜨지 않게) */
const recordedIds = new Set<string>()

/**
 * 공유(링크 복사 · 카톡 · QR 저장) 직전 처리.
 * - 처음 공유하면 서버에 기록한다(POST /api/invitations/{id}/shared, 한 번만).
 * - guard가 true(결제한 초대장이고 아직 전액 환불 가능)면 기록 전에 확인 창을 먼저 띄운다.
 * 클립보드 · 공유 시트는 눌렀을 때의 동작 안에서만 열리므로, 기록 요청은 기다리지 않고 바로 이어서 실행한다.
 */
export function useShareGuard(id: string, guard: boolean): {
  run: (action: () => void | Promise<void>) => void
  dialog: ReactNode
} {
  const [pending, setPending] = useState<null | (() => void | Promise<void>)>(null)

  function record() {
    if (recordedIds.has(id)) return
    recordedIds.add(id)
    void fetch(`/api/invitations/${id}/shared`, { method: 'POST', keepalive: true }).catch(() => {
      recordedIds.delete(id)
    })
  }

  function run(action: () => void | Promise<void>) {
    if (guard && !recordedIds.has(id)) {
      setPending(() => action)
      return
    }
    record()
    void action()
  }

  const dialog = pending ? (
    <div className={styles.back} role="presentation">
      <div
        className={styles.box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`share-guard-${id}`}
        data-testid="share-guard"
      >
        <h2 id={`share-guard-${id}`}>공유하면 환불이 제한돼요. 공유할까요?</h2>
        <p>링크를 복사하거나 보내면 디지털 콘텐츠 제공이 시작된 것으로 봐요.</p>
        <div className={styles.actions}>
          <button type="button" onClick={() => setPending(null)}>
            취소
          </button>
          <button
            type="button"
            data-primary
            onClick={() => {
              const action = pending
              setPending(null)
              record()
              void action()
            }}
          >
            공유하기
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { run, dialog }
}
