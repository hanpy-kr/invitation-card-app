'use client'

import {
  newQuestionId,
  QUESTION_KIND_LABELS,
  QUESTION_LIMITS,
  QUESTION_TARGET_LABELS,
  type QuestionKind,
  type QuestionTarget,
  type RsvpQuestion,
} from '@/shared/rsvp-questions'

import fieldStyles from '../fields.module.scss'
import {
  AddButton,
  FieldRow,
  ItemCard,
  list,
  Segmented,
  Select,
  TextArea,
  TextField,
  Toggle,
} from '../fields'
import { patcher, type FormProps } from './types'

const KINDS = (Object.keys(QUESTION_KIND_LABELS) as QuestionKind[]).map((value) => ({
  value,
  label: QUESTION_KIND_LABELS[value],
}))
const TARGETS = (Object.keys(QUESTION_TARGET_LABELS) as QuestionTarget[]).map((value) => ({
  value,
  label: QUESTION_TARGET_LABELS[value],
}))

function QuestionFields({
  q,
  n,
  onChange,
}: {
  q: RsvpQuestion
  n: number
  onChange: (patch: Partial<RsvpQuestion>) => void
}) {
  const options = q.options.length > 0 ? q.options : ['']
  return (
    <>
      <TextField
        label={`질문 ${n}`}
        value={q.label}
        maxLength={40}
        placeholder="예) 메뉴를 골라 주세요"
        onChange={(label) => onChange({ label })}
      />
      <Segmented
        label={`질문 ${n} 종류`}
        value={q.kind}
        options={KINDS}
        onChange={(kind) => onChange({ kind })}
      />
      {q.kind === 'choice' ? (
        <div className={fieldStyles.field}>
          <span>
            보기 <em className={fieldStyles.hint}>최대 {QUESTION_LIMITS.options}개</em>
          </span>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input
                className={fieldStyles.input}
                value={o}
                maxLength={30}
                aria-label={`질문 ${n} 보기 ${i + 1}`}
                placeholder={i === 0 ? '예) 고기' : ''}
                onChange={(e) =>
                  onChange({ options: options.map((x, j) => (j === i ? e.target.value : x)) })
                }
              />
              {options.length > 1 ? (
                <button
                  type="button"
                  aria-label={`질문 ${n} 보기 ${i + 1} 빼기`}
                  style={{ border: 0, background: 'none', color: 'var(--muted)', padding: '0 8px' }}
                  onClick={() => onChange({ options: list.remove(options, i) })}
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
          {options.length < QUESTION_LIMITS.options ? (
            <button
              type="button"
              style={{
                alignSelf: 'flex-start',
                border: 0,
                background: 'none',
                color: 'var(--accent)',
                padding: '4px 0',
              }}
              onClick={() => onChange({ options: [...options, ''] })}
            >
              + 보기 추가
            </button>
          ) : null}
        </div>
      ) : null}
      <Segmented
        label={`질문 ${n} 대상`}
        value={q.target}
        options={TARGETS}
        onChange={(target) => onChange({ target })}
      />
      <Toggle
        label={`질문 ${n} 꼭 답하게 하기`}
        checked={q.required}
        onChange={(required) => onChange({ required })}
      />
    </>
  )
}

export default function RsvpForm({ config, update }: FormProps<'rsvp'>) {
  const set = patcher(update)
  const setQuestions = (fn: (qs: RsvpQuestion[]) => RsvpQuestion[]) =>
    update((c) => ({ ...c, questions: fn(c.questions) }))
  return (
    <>
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
        rows={3}
        onChange={(message) => set({ message })}
      />
      <FieldRow>
        <Select
          label="한 응답당 최대 인원"
          value={config.maxPartySize}
          options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: `${i + 1}명` }))}
          onChange={(maxPartySize) => set({ maxPartySize })}
        />
        <TextField
          label="응답 마감일"
          type="date"
          value={config.deadline ?? ''}
          onChange={(v) => set({ deadline: v || null })}
        />
      </FieldRow>
      <Toggle
        label="식사 여부도 묻기"
        checked={config.askMeal}
        onChange={(askMeal) => set({ askMeal })}
      />

      <div className={fieldStyles.field}>
        <span>
          추가 질문{' '}
          <em className={fieldStyles.hint}>
            최대 {QUESTION_LIMITS.count}개 · 전화번호 · 주소 같은 연락처는 묻지 말아 주세요
          </em>
        </span>
      </div>
      {config.questions.map((q, i) => (
        <ItemCard
          key={q.id}
          title={`질문 ${i + 1}`}
          index={i}
          count={config.questions.length}
          onMove={(a, b) => setQuestions((qs) => list.move(qs, a, b))}
          onRemove={(x) => setQuestions((qs) => list.remove(qs, x))}
        >
          <QuestionFields
            q={q}
            n={i + 1}
            onChange={(patch) => setQuestions((qs) => list.set(qs, i, patch))}
          />
        </ItemCard>
      ))}
      {config.questions.length < QUESTION_LIMITS.count ? (
        <AddButton
          label="질문 추가"
          onClick={() =>
            setQuestions((qs) => [
              ...qs,
              {
                id: newQuestionId(),
                kind: 'choice',
                label: '',
                options: ['', ''],
                required: false,
                target: 'attending',
              },
            ])
          }
        />
      ) : null}
    </>
  )
}
