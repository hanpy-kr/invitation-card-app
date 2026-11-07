'use client'

import {
  MAX_ACCOUNT_GROUPS,
  MAX_ACCOUNTS_PER_GROUP,
  type AccountGroup,
  type AccountItem,
} from '@/shared/blocks'
import { BANK_NAMES, isKakaoPayUrl } from '@/shared/money'

import fieldStyles from '../fields.module.scss'
import { AddButton, FieldRow, ItemCard, list, PublicNotice, TextArea, TextField } from '../fields'
import { patcher, type FormProps } from './types'

const emptyAccount: AccountItem = { relation: '', bank: '', number: '', holder: '', kakaopay: '' }

function AccountFields({
  item,
  label,
  onChange,
}: {
  item: AccountItem
  label: string
  onChange: (patch: Partial<AccountItem>) => void
}) {
  const kakaoError = item.kakaopay !== '' && !isKakaoPayUrl(item.kakaopay)
  return (
    <>
      <TextField
        label="관계 · 이름"
        value={item.relation}
        maxLength={30}
        placeholder="예) 신랑 아버지 김철수, 총무"
        onChange={(relation) => onChange({ relation })}
      />
      <FieldRow>
        <label className={fieldStyles.field}>
          <span>은행</span>
          <input
            className={fieldStyles.input}
            list="dearday-banks"
            value={item.bank}
            maxLength={20}
            placeholder="예) 카카오뱅크"
            aria-label={`${label} 은행`}
            onChange={(e) => onChange({ bank: e.target.value })}
          />
        </label>
        <TextField
          label="예금주"
          value={item.holder}
          maxLength={20}
          onChange={(holder) => onChange({ holder })}
        />
      </FieldRow>
      <label className={fieldStyles.field}>
        <span>계좌번호</span>
        <input
          className={fieldStyles.input}
          inputMode="numeric"
          value={item.number}
          maxLength={30}
          placeholder="숫자와 - 만"
          aria-label={`${label} 계좌번호`}
          onChange={(e) => onChange({ number: e.target.value.replace(/[^0-9\- ]/g, '') })}
        />
      </label>
      <TextField
        label="카카오페이 송금 링크"
        hint="선택 · 카카오페이 앱 > 송금 > 송금코드 > 링크 복사"
        value={item.kakaopay}
        maxLength={200}
        placeholder="https://qr.kakaopay.com/..."
        onChange={(kakaopay) => onChange({ kakaopay: kakaopay.trim() })}
      />
      {kakaoError ? (
        <small style={{ display: 'block', color: '#d64545', marginTop: -10, marginBottom: 14 }}>
          https://qr.kakaopay.com/ 으로 시작하는 링크만 버튼으로 보여요.
        </small>
      ) : null}
    </>
  )
}

export default function AccountForm({ config, update }: FormProps<'account'>) {
  const set = patcher(update)
  const setGroups = (fn: (g: AccountGroup[]) => AccountGroup[]) =>
    update((c) => ({ ...c, groups: fn(c.groups) }))

  return (
    <>
      <PublicNotice>링크를 받은 누구나 이 계좌번호를 볼 수 있어요.</PublicNotice>
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <TextArea
        label="안내 문구"
        value={config.message}
        maxLength={300}
        rows={3}
        onChange={(message) => set({ message })}
      />
      <label className={fieldStyles.field}>
        <span>
          1인 회비{' '}
          <em className={fieldStyles.hint}>선택 · 넣으면 크게 보이고 토스 금액에 채워져요</em>
        </span>
        <input
          className={fieldStyles.input}
          inputMode="numeric"
          value={config.perPerson ? config.perPerson.toLocaleString('ko-KR') : ''}
          placeholder="예) 30,000"
          aria-label="1인 회비(원)"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, '').slice(0, 8))
            set({ perPerson: n > 0 ? Math.min(n, 10_000_000) : null })
          }}
        />
      </label>

      <datalist id="dearday-banks">
        {BANK_NAMES.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      {config.groups.map((g, gi) => (
        <ItemCard
          key={gi}
          title={`그룹 ${gi + 1}`}
          index={gi}
          count={config.groups.length}
          onMove={(a, b) => setGroups((gs) => list.move(gs, a, b))}
          onRemove={(i) => setGroups((gs) => list.remove(gs, i))}
        >
          <TextField
            label="그룹 이름"
            value={g.label}
            maxLength={20}
            placeholder="예) 신랑 측, 회비"
            onChange={(label) => setGroups((gs) => list.set(gs, gi, { label }))}
          />
          {g.accounts.map((a, ai) => (
            <ItemCard
              key={ai}
              title={`그룹 ${gi + 1} 계좌 ${ai + 1}`}
              index={ai}
              count={g.accounts.length}
              onMove={(x, y) =>
                setGroups((gs) => list.set(gs, gi, { accounts: list.move(gs[gi].accounts, x, y) }))
              }
              onRemove={(i) =>
                setGroups((gs) => list.set(gs, gi, { accounts: list.remove(gs[gi].accounts, i) }))
              }
            >
              <AccountFields
                item={a}
                label={`그룹 ${gi + 1} 계좌 ${ai + 1}`}
                onChange={(patch) =>
                  setGroups((gs) =>
                    list.set(gs, gi, { accounts: list.set(gs[gi].accounts, ai, patch) }),
                  )
                }
              />
            </ItemCard>
          ))}
          {g.accounts.length < MAX_ACCOUNTS_PER_GROUP ? (
            <AddButton
              label="계좌 추가"
              onClick={() =>
                setGroups((gs) =>
                  list.set(gs, gi, { accounts: [...gs[gi].accounts, { ...emptyAccount }] }),
                )
              }
            />
          ) : null}
        </ItemCard>
      ))}
      {config.groups.length < MAX_ACCOUNT_GROUPS ? (
        <AddButton
          label="그룹 추가"
          onClick={() => setGroups((gs) => [...gs, { label: '', accounts: [{ ...emptyAccount }] }])}
        />
      ) : null}
    </>
  )
}
