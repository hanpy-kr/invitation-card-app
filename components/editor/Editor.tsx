'use client'

import Logo from '@/components/site/Logo'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { BLOCK_LABELS, BLOCK_TYPES, parseBlockConfig, type BlockType } from '@/shared/blocks'
import { collectMediaRefs } from '@/shared/media'
import { SINGLE_BLOCK_TYPES, type EditorBlock, type InvitationMeta } from '@/shared/invitation'
import { withEventDefaults } from '@/shared/templates'

import { api } from '../ui/api'
import { EditorEnvProvider, type EditorEnv } from './context'
import styles from './Editor.module.scss'
import BlockForm from './forms/BlockForm'
import MetaForm from './MetaForm'
import Preview from './Preview'
import PublishPanel from './PublishPanel'
import { useAutosave, type SaveState } from './useAutosave'

export type EditorProps = {
  id: string
  slug: string
  status: 'draft' | 'published'
  meta: InvitationMeta
  blocks: EditorBlock[]
  mediaBaseUrl: string
  kakaoJsKey: string
  siteUrl: string
  uploadEnabled: boolean
  geoSearchEnabled: boolean
  /** 편집자는 초대장을 지울 수 없음 */
  isOwner: boolean
  /** 사진 한도 (shared/entitlements.ts) */
  photoLimit: number
  /** 로그인 없이 만든 초대장 → 발행 대신 카카오 로그인 안내 */
  ownerAnonymous: boolean
  /** 결제 플랜에 따른 권한 (shared/entitlements.ts) */
  introEffects: boolean
  canHideMadeWith: boolean
  /** 프리미엄 안내 · 결제 버튼 (결제가 열려 있고 아직 프리미엄이 아닐 때만 값이 있음) */
  upsell: { price: number } | null
  /** 결제한 초대장이면 환불 가능 여부 */
  paid: { refundable: boolean } | null
}

const SAVE_LABEL: Record<SaveState, string> = {
  saved: '저장됨',
  dirty: '수정 중',
  saving: '저장 중…',
  error: '저장 실패',
}

export default function Editor(props: EditorProps) {
  const router = useRouter()
  const [meta, setMeta] = useState(props.meta)
  const [blocks, setBlocks] = useState(props.blocks)
  const [status, setStatus] = useState(props.status)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [showPublish, setShowPublish] = useState(false)

  const doc = useMemo(() => ({ meta, blocks }), [meta, blocks])
  const save = useAutosave(`/api/invitations/${props.id}`, doc)

  const env: EditorEnv = useMemo(
    () => ({
      invitationId: props.id,
      mediaBaseUrl: props.mediaBaseUrl,
      kakaoJsKey: props.kakaoJsKey,
      uploadEnabled: props.uploadEnabled,
      geoSearchEnabled: props.geoSearchEnabled,
      photoLimit: props.photoLimit,
      introEffects: props.introEffects,
      photoCount: new Set(
        [...collectMediaRefs(blocks), ...(meta.share.image ? [meta.share.image] : [])].map(
          (r) => r.id,
        ),
      ).size,
    }),
    [props, blocks, meta.share.image],
  )

  const updateBlock = useCallback(
    (id: string) => (fn: (c: EditorBlock['config']) => EditorBlock['config']) =>
      setBlocks((list) =>
        list.map((b) => (b.id === id ? ({ ...b, config: fn(b.config) } as EditorBlock) : b)),
      ),
    [],
  )

  const move = (idx: number, dir: -1 | 1) =>
    setBlocks((list) => {
      const target = idx + dir
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })

  const toggleVisible = (id: string) =>
    setBlocks((list) => list.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)))

  const remove = (block: EditorBlock) => {
    if (!window.confirm(`'${BLOCK_LABELS[block.type]}' 블록을 지울까요?`)) return
    setBlocks((list) => list.filter((b) => b.id !== block.id))
  }

  const add = (type: BlockType) => {
    const block = {
      id: crypto.randomUUID(),
      type,
      visible: true,
      config: parseBlockConfig(type, withEventDefaults(meta.eventType, type, {})),
    } as EditorBlock
    setBlocks((list) => [...list, block])
    setOpenId(block.id)
  }

  const existing = new Set(blocks.map((b) => b.type))
  const addable = BLOCK_TYPES.filter((t) => !(SINGLE_BLOCK_TYPES.includes(t) && existing.has(t)))

  const [confirmDelete, setConfirmDelete] = useState(false)

  function askRemove() {
    // 결제한 초대장은 환불 안내가 들어간 확인창, 아니면 기본 확인창
    if (props.paid) setConfirmDelete(true)
    else if (window.confirm('초대장을 지울까요? 받은 응답과 사진도 함께 지워지고 되돌릴 수 없어요.'))
      void removeInvitation()
  }

  async function removeInvitation() {
    try {
      await api(`/api/invitations/${props.id}`, { method: 'DELETE' })
      router.replace('/dashboard')
    } catch (err) {
      window.alert((err as Error).message)
    }
  }

  return (
    <EditorEnvProvider value={env}>
      <div className={styles.root}>
        <header className={styles.topbar}>
          <Link href="/dashboard" className={styles.back} aria-label="내 초대장으로">
            ←
          </Link>
          <Logo href={null} label={false} />
          <div className={styles.topTitle}>
            <strong>{meta.title || '제목 없음'}</strong>
            <span className={styles.saveState} data-state={save.state} role="status">
              {SAVE_LABEL[save.state]}
              {save.state === 'error' ? (
                <button type="button" onClick={() => void save.flush()}>
                  다시 시도
                </button>
              ) : null}
            </span>
          </div>
          <Link href="/help" className={styles.helpLink} target="_blank" aria-label="도움말">
            ?
          </Link>
          <button type="button" className={styles.publishBtn} onClick={() => setShowPublish(true)}>
            {status === 'published' ? '공유하기' : '발행하기'}
          </button>
        </header>
        {save.state === 'error' && save.error ? (
          <p className={styles.saveError}>{save.error}</p>
        ) : null}

        <nav className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'edit'}
            onClick={() => setTab('edit')}
          >
            편집
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            onClick={() => {
              setTab('preview')
              window.scrollTo(0, 0)
            }}
          >
            미리보기
          </button>
        </nav>

        <div className={styles.layout}>
          <div className={styles.editPane} data-active={tab === 'edit'}>
            <MetaForm meta={meta} onChange={setMeta} />

            <h2 className={styles.sectionTitle}>블록</h2>
            <p className={styles.sectionHint}>순서대로 초대장에 보여요. 눌러서 내용을 고치세요.</p>
            <ol className={styles.blockList}>
              {blocks.map((block, idx) => {
                const open = openId === block.id
                return (
                  <li key={block.id} className={styles.blockCard} data-hidden={!block.visible}>
                    <div className={styles.blockHead}>
                      <button
                        type="button"
                        className={styles.blockName}
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : block.id)}
                      >
                        <span>{BLOCK_LABELS[block.type]}</span>
                        {block.type === 'location' &&
                        block.config.title &&
                        block.config.title !== BLOCK_LABELS.location ? (
                          // 1차 · 2차 구분용. 접근성 이름은 블록 종류로 유지
                          <small aria-hidden className={styles.blockSub}>
                            {block.config.title}
                          </small>
                        ) : null}
                        {!block.visible ? <em>숨김</em> : null}
                        <i aria-hidden>{open ? '▴' : '▾'}</i>
                      </button>
                      <div className={styles.blockTools}>
                        <button
                          type="button"
                          aria-label="위로"
                          disabled={idx === 0}
                          onClick={() => move(idx, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label="아래로"
                          disabled={idx === blocks.length - 1}
                          onClick={() => move(idx, 1)}
                        >
                          ↓
                        </button>
                        <button type="button" onClick={() => toggleVisible(block.id)}>
                          {block.visible ? '숨기기' : '보이기'}
                        </button>
                        <button
                          type="button"
                          aria-label="블록 지우기"
                          onClick={() => remove(block)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {open ? (
                      <div className={styles.blockBody}>
                        <BlockForm
                          block={block}
                          update={updateBlock(block.id)}
                          eventType={meta.eventType}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ol>

            {addable.length > 0 ? (
              <div className={styles.addBox}>
                <span>블록 추가</span>
                <div>
                  {addable.map((t) => (
                    <button key={t} type="button" onClick={() => add(t)}>
                      + {BLOCK_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {props.isOwner ? (
              <div className={styles.danger}>
                <button type="button" onClick={askRemove}>
                  초대장 지우기
                </button>
              </div>
            ) : null}
            {confirmDelete && props.paid ? (
              <div className={styles.dialogBack} role="presentation">
                <div className={styles.dialog} role="alertdialog" aria-labelledby="del-title">
                  <h2 id="del-title">결제한 초대장을 지울까요?</h2>
                  <p>받은 응답과 사진도 함께 지워지고 되돌릴 수 없어요.</p>
                  {props.paid.refundable ? (
                    <p className={styles.refundHint}>
                      결제 후 7일 안이고 발행 전이면 먼저 환불할 수 있어요.{' '}
                      <Link href="/dashboard#orders">환불하기</Link>
                    </p>
                  ) : (
                    <p className={styles.refundHint}>
                      지금은 환불 조건(결제 후 7일 이내 · 발행 전)이 아니라서, 지우면 결제 금액은 돌려받지
                      못해요.
                    </p>
                  )}
                  <div className={styles.dialogActions}>
                    <button type="button" onClick={() => setConfirmDelete(false)}>
                      취소
                    </button>
                    <button type="button" data-danger onClick={() => void removeInvitation()}>
                      그래도 지우기
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <aside
            className={styles.previewPane}
            data-active={tab === 'preview'}
            aria-label="미리보기"
          >
            <div className={styles.phone}>
              <Preview
                meta={meta}
                blocks={blocks}
                slug={props.slug}
                mediaBaseUrl={props.mediaBaseUrl}
                kakaoJsKey={props.kakaoJsKey}
                introEffects={props.introEffects}
              />
            </div>
          </aside>
        </div>

        {showPublish ? (
          <PublishPanel
            id={props.id}
            slug={props.slug}
            status={status}
            meta={meta}
            blocks={blocks}
            siteUrl={props.siteUrl}
            mediaBaseUrl={props.mediaBaseUrl}
            kakaoJsKey={props.kakaoJsKey}
            flush={save.flush}
            onStatus={setStatus}
            anonymous={props.ownerAnonymous}
            onShare={(fn) => setMeta((m) => ({ ...m, share: fn(m.share) }))}
            canHideMadeWith={props.canHideMadeWith}
            upsell={props.upsell}
            onClose={() => setShowPublish(false)}
          />
        ) : null}
      </div>
    </EditorEnvProvider>
  )
}
