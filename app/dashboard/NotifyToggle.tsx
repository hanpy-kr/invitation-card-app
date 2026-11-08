'use client'

import { useState } from 'react'

import { api } from '@/components/ui/api'

import styles from './page.module.scss'

/** 새 응답이 오면 내 카카오톡으로 알림. 켜기는 카카오 동의 화면을 거침 */
export default function NotifyToggle({ on }: { on: boolean }) {
  const [enabled, setEnabled] = useState(on)
  const [busy, setBusy] = useState(false)

  async function turnOff() {
    setBusy(true)
    try {
      await api('/api/account/notify', { body: { enabled: false } })
      setEnabled(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.notify}>
      <p>
        {enabled
          ? '응답이 도착하면 내 카카오톡으로 알려 드려요.'
          : '응답이 도착하면 내 카카오톡(나와의 채팅)으로 알림을 받을 수 있어요.'}
      </p>
      {enabled ? (
        <button type="button" onClick={turnOff} disabled={busy}>
          알림 끄기
        </button>
      ) : (
        <a href="/api/auth/kakao/login?next=/dashboard&notify=1">알림 켜기</a>
      )}
    </div>
  )
}
