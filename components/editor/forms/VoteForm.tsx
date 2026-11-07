'use client'

import { MAX_VOTE_OPTIONS, type VoteOption } from '@/shared/blocks'
import { kstInputToIso, toKstDateString, toKstTimeString } from '@/shared/date'
import { newQuestionId } from '@/shared/rsvp-questions'
import { VOTE_KIND_LABELS, type VoteKind } from '@/shared/vote'

import fieldStyles from '../fields.module.scss'
import {
  AddButton,
  FieldRow,
  ItemCard,
  list,
  Segmented,
  TextArea,
  TextField,
  Toggle,
} from '../fields'
import { patcher, type FormProps } from './types'

const KINDS = (Object.keys(VOTE_KIND_LABELS) as VoteKind[]).map((value) => ({
  value,
  label: VOTE_KIND_LABELS[value],
}))

const empty = (): VoteOption => ({ id: newQuestionId(), label: '', at: null, address: '' })

function OptionFields({
  kind,
  o,
  n,
  onChange,
}: {
  kind: VoteKind
  o: VoteOption
  n: number
  onChange: (patch: Partial<VoteOption>) => void
}) {
  if (kind === 'date') {
    const date = o.at ? toKstDateString(o.at) : ''
    const time = o.at ? toKstTimeString(o.at) : ''
    return (
      <>
        <FieldRow>
          <TextField
            label={`후보 ${n} 날짜`}
            type="date"
            value={date}
            onChange={(d) => onChange({ at: kstInputToIso(d, time || '19:00') })}
          />
          <TextField
            label={`후보 ${n} 시간`}
            type="time"
            value={time}
            onChange={(t) => onChange({ at: date ? kstInputToIso(date, t) : null })}
          />
        </FieldRow>
        <TextField
          label={`후보 ${n} 메모`}
          hint="선택"
          value={o.label}
          maxLength={40}
          placeholder="예) 금요일 저녁"
          onChange={(label) => onChange({ label })}
        />
      </>
    )
  }
  if (kind === 'place') {
    return (
      <>
        <TextField
          label={`후보 ${n} 장소 이름`}
          value={o.label}
          maxLength={40}
          onChange={(label) => onChange({ label })}
        />
        <TextField
          label={`후보 ${n} 주소`}
          value={o.address}
          maxLength={200}
          onChange={(address) => onChange({ address })}
        />
      </>
    )
  }
  return (
    <TextField
      label={`후보 ${n}`}
      value={o.label}
      maxLength={40}
      onChange={(label) => onChange({ label })}
    />
  )
}

export default function VoteForm({ config, update }: FormProps<'vote'>) {
  const set = patcher(update)
  const setOptions = (fn: (o: VoteOption[]) => VoteOption[]) =>
    update((c) => ({ ...c, options: fn(c.options) }))
  return (
    <>
      {config.status === 'closed' ? (
        <p className={fieldStyles.notice}>
          확정된 투표예요. 다시 받으려면 응답 보기 화면에서 [다시 열기]를 눌러 주세요.
        </p>
      ) : (
        <p className={fieldStyles.hint} style={{ marginBottom: 12 }}>
          하객은 이름으로 투표하고, 확정은 응답 보기 화면에서 해요. 확정하면 날짜 · 장소가 초대장에
          바로 반영되고 링크는 그대로예요.
        </p>
      )}
      <Segmented
        label="무엇을 정하나요"
        value={config.kind}
        options={KINDS}
        onChange={(kind) =>
          set({
            kind,
            title:
              config.title === `${VOTE_KIND_LABELS[config.kind]} 투표`
                ? `${VOTE_KIND_LABELS[kind]} 투표`
                : config.title,
          })
        }
      />
      <TextField
        label="제목"
        value={config.title}
        maxLength={30}
        onChange={(title) => set({ title })}
      />
      <TextArea
        label="안내 문구"
        value={config.message}
        maxLength={200}
        rows={2}
        onChange={(message) => set({ message })}
      />
      <Toggle
        label="여러 개 고를 수 있게"
        checked={config.multiple}
        onChange={(multiple) => set({ multiple })}
      />
      {config.options.map((o, i) => (
        <ItemCard
          key={o.id}
          title={`후보 ${i + 1}`}
          index={i}
          count={config.options.length}
          onMove={(a, b) => setOptions((xs) => list.move(xs, a, b))}
          onRemove={(x) => setOptions((xs) => list.remove(xs, x))}
        >
          <OptionFields
            kind={config.kind}
            o={o}
            n={i + 1}
            onChange={(patch) => setOptions((xs) => list.set(xs, i, patch))}
          />
        </ItemCard>
      ))}
      {config.options.length < MAX_VOTE_OPTIONS ? (
        <AddButton label="후보 추가" onClick={() => setOptions((xs) => [...xs, empty()])} />
      ) : null}
    </>
  )
}
