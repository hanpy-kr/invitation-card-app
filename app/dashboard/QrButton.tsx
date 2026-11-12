'use client'

import { useState } from 'react'

import { SEAL } from '@/shared/brand'

import styles from './QrButton.module.scss'

const INK = '#2b2620'

/** 글자를 가로 폭에 맞춰 줄바꿈 (한글은 글자 단위) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) {
      lines.push(line)
      line = ch.trim() ? ch : ''
    } else line += ch
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

async function makeMatrix(url: string): Promise<boolean[][]> {
  // QR 인코더는 [QR 저장]을 눌렀을 때만 내려받음 (하객 화면 번들에는 들어가지 않음)
  const { default: qrcode } = await import('qrcode-generator')
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}

/** 정사각 영역(x, y, size)에 QR을 그림. 조용한 여백 4칸 포함, 칸 경계는 정수로 맞춰 흐려지지 않게 */
function drawQr(ctx: CanvasRenderingContext2D, m: boolean[][], x: number, y: number, size: number) {
  const n = m.length
  const cell = size / (n + 8)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = INK
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue
      const x0 = Math.round(x + (c + 4) * cell)
      const y0 = Math.round(y + (r + 4) * cell)
      ctx.fillRect(x0, y0, Math.round(x + (c + 5) * cell) - x0, Math.round(y + (r + 5) * cell) - y0)
    }
}

function download(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      a.remove()
      URL.revokeObjectURL(a.href)
    }, 1000)
  }, 'image/png')
}

function drawSeal(ctx: CanvasRenderingContext2D, cx: number, cy: number, d: number) {
  const k = d / 30
  ctx.save()
  ctx.translate(cx - d / 2, cy - d / 2)
  ctx.scale(k, k)
  ctx.fillStyle = SEAL.gold
  ctx.beginPath()
  ctx.arc(15, 15, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = SEAL.paper
  ctx.lineWidth = SEAL.ring.width
  ctx.setLineDash([1.5, 1.5])
  ctx.beginPath()
  ctx.arc(15, 15, SEAL.ring.r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = SEAL.letter
  ctx.fill(new Path2D(SEAL.d))
  ctx.restore()
}

/** 대시보드 카드의 [QR 저장]: QR만(1024px) · 인쇄용 카드, 둘 다 브라우저에서 캔버스로 그려 내려받음 */
export default function QrButton({
  slug,
  title,
  dateLabel,
}: {
  slug: string
  title: string
  dateLabel: string | null
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const url = () => `${window.location.origin}/i/${slug}`
  const safe = (title || 'dearday').replace(/[\\/:*?"<>|]/g, '')

  async function saveQr() {
    setBusy(true)
    try {
      const m = await makeMatrix(url())
      const c = document.createElement('canvas')
      c.width = c.height = 1024
      drawQr(c.getContext('2d')!, m, 0, 0, 1024)
      download(c, `${safe}-QR.png`)
    } finally {
      setBusy(false)
    }
  }

  async function saveCard() {
    setBusy(true)
    try {
      const m = await makeMatrix(url())
      const W = 1080
      const H = 1500
      const c = document.createElement('canvas')
      c.width = W
      c.height = H
      const ctx = c.getContext('2d')!
      // 제목 · 날짜 글씨는 고운바탕. 쓰는 글자의 조각만 불러온 뒤 그림
      const serif = '"Gowun Batang", serif'
      try {
        await Promise.all([
          document.fonts.load(`40px ${serif}`, title + (dateLabel ?? '') + 'INVITATION'),
          document.fonts.load(`40px ${serif}`, 'dearday'),
        ])
      } catch {
        // 글꼴을 못 받으면 기본 명조 계열로 그려짐
      }
      ctx.fillStyle = '#f3ede2'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = '#d9ccb8'
      ctx.lineWidth = 2
      ctx.strokeRect(48, 48, W - 96, H - 96)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#8a6a43'
      ctx.font = `28px ${serif}`
      ctx.letterSpacing = '12px'
      ctx.fillText('INVITATION', W / 2 + 6, 210)
      ctx.letterSpacing = '0px'
      // 제목
      ctx.fillStyle = '#4a4239'
      ctx.font = `64px ${serif}`
      const lines = wrap(ctx, title || '초대장', W - 260)
      lines.forEach((l, i) => ctx.fillText(l, W / 2, 330 + i * 88))
      let y = 330 + lines.length * 88
      if (dateLabel) {
        ctx.fillStyle = '#6b6156'
        ctx.font = `36px ${serif}`
        ctx.fillText(dateLabel, W / 2, y + 20)
        y += 60
      }
      // QR 면
      const qs = 640
      const qy = Math.max(y + 50, 600)
      ctx.fillStyle = '#d9ccb8'
      ctx.fillRect((W - qs) / 2 - 2, qy - 2, qs + 4, qs + 4)
      drawQr(ctx, m, (W - qs) / 2, qy, qs)
      ctx.fillStyle = '#6b6156'
      ctx.font = `30px ${serif}`
      ctx.fillText('카메라로 비추면 초대장이 열려요', W / 2, qy + qs + 64)
      // 맨 아래 도장 + dearday
      drawSeal(ctx, W / 2 - 74, H - 96, 44)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#8a6a43'
      ctx.font = `34px ${serif}`
      ctx.fillText('dearday', W / 2 - 38, H - 84)
      download(c, `${safe}-인쇄용.png`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        QR 저장
      </button>
      {open ? (
        <div className={styles.panel} role="group" aria-label="QR 저장">
          <button type="button" disabled={busy} onClick={saveQr}>
            QR만 (1024px)
          </button>
          <button type="button" disabled={busy} onClick={saveCard}>
            인쇄용 카드
          </button>
        </div>
      ) : null}
    </>
  )
}
