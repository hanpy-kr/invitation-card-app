import { parseBlockConfig, type BlockInput, type BlockType, type EventType } from './blocks'
import type { ThemeKey } from './themes'

/**
 * 새 초대장을 만들 때 행사 종류별로 깔아 주는 기본 블록 · 문구 · 테마.
 * 대괄호로 감싼 문구([신랑 이름] 등)는 바꿔야 하는 자리 — 발행 전에 남아 있으면 안내한다.
 */
type Template = { title: string; theme: ThemeKey; blocks: { type: BlockType; config: unknown }[] }

const TEMPLATES: Record<EventType, Template> = {
  wedding: {
    title: '[신랑 이름] ♥ [신부 이름] 결혼합니다',
    theme: 'classic',
    blocks: [
      {
        type: 'cover',
        config: {
          layout: 'photo',
          title: '[신랑 이름] · [신부 이름]',
          subtitle: '우리 결혼합니다',
        },
      },
      {
        type: 'greeting',
        config: {
          icon: 'flower',
          title: '초대합니다',
          message:
            '서로 다른 길을 걸어온 두 사람이\n이제 같은 길을 함께 걸어가려 합니다.\n\n바쁘시더라도 귀한 걸음 하시어\n저희의 시작을 축복해 주세요.',
          hosts: ['[신랑 이름]', '[신부 이름]'],
          hostSeparator: 'heart',
        },
      },
      { type: 'gallery', config: { title: '우리의 순간' } },
      { type: 'location', config: { title: '오시는 길' } },
      {
        type: 'rsvp',
        config: {
          title: '참석 의사 전달',
          message: '참석 여부를 미리 알려 주시면\n정성껏 준비하겠습니다.',
          askMeal: true,
          maxPartySize: 5,
        },
      },
      {
        type: 'account',
        config: {
          title: '마음 전하실 곳',
          message: '참석이 어려우신 분들을 위해\n계좌번호를 함께 적어 두었습니다.',
          groups: [
            { label: '신랑 측', accounts: [{ relation: '신랑' }] },
            { label: '신부 측', accounts: [{ relation: '신부' }] },
          ],
        },
      },
      {
        type: 'guestbook',
        config: { title: '축하 메시지', message: '두 사람에게 축하 한마디를 남겨 주세요.' },
      },
    ],
  },
  dol: {
    title: '[아기 이름]의 첫 생일에 초대합니다',
    theme: 'blossom',
    blocks: [
      {
        type: 'cover',
        config: {
          layout: 'photo',
          title: '[아기 이름]의 첫 번째 생일',
          subtitle: '돌잔치에 초대합니다',
        },
      },
      {
        type: 'greeting',
        config: {
          icon: 'post',
          title: '감사의 마음을 담아',
          message:
            '많은 분들의 사랑 덕분에\n저희 아이가 건강하게 첫 생일을 맞았습니다.\n\n고마운 마음을 전하고 싶어\n작은 자리를 마련했습니다.',
          hosts: ['아빠 [이름]', '엄마 [이름]'],
          hostSeparator: 'dot',
        },
      },
      { type: 'gallery', config: { title: '자라는 모습' } },
      { type: 'location', config: { title: '오시는 길' } },
      {
        type: 'rsvp',
        config: { message: '식사 준비를 위해\n참석 인원을 알려 주세요.', maxPartySize: 6 },
      },
      {
        type: 'account',
        config: {
          title: '마음 전하실 곳',
          groups: [{ label: '아기 부모', accounts: [{ relation: '아빠' }, { relation: '엄마' }] }],
        },
      },
    ],
  },
  meetup: {
    title: '[모임 이름]에 초대합니다',
    theme: 'navy',
    blocks: [
      {
        type: 'cover',
        config: { layout: 'text', title: '[모임 이름]', subtitle: '오랜만에 얼굴 봐요' },
      },
      {
        type: 'greeting',
        config: {
          icon: 'none',
          title: '함께해요',
          message: '맛있는 음식 먹으면서 근황 나눠요.\n\n회비: [금액]\n준비물: 반가운 얼굴',
          hosts: ['[주최자 이름]'],
          showEventDate: true,
        },
      },
      { type: 'location', config: { title: '모이는 곳' } },
      {
        type: 'rsvp',
        config: {
          title: '참석 여부',
          message: '자리 예약을 위해 미리 알려 주세요.',
          maxPartySize: 2,
        },
      },
      {
        type: 'account',
        config: {
          title: '회비 안내',
          message: '당일 정산이 편하도록 미리 보내 주세요.',
          groups: [{ label: '회비 계좌', accounts: [{ relation: '총무' }] }],
        },
      },
      {
        type: 'guestbook',
        config: { title: '한마디', message: '못 오는 분도 한마디 남겨 주세요.' },
      },
    ],
  },
  etc: {
    title: '[행사 이름]에 초대합니다',
    theme: 'mint',
    blocks: [
      { type: 'cover', config: { layout: 'text', title: '[행사 이름]', subtitle: '초대합니다' } },
      {
        type: 'greeting',
        config: { icon: 'none', title: '안내', message: '[행사 소개와 안내를 적어 주세요]' },
      },
      { type: 'location', config: { title: '오시는 길' } },
      { type: 'rsvp', config: { title: '참석 여부' } },
    ],
  },
}

export function buildTemplate(eventType: EventType): {
  title: string
  theme: ThemeKey
  blocks: BlockInput[]
} {
  const t = TEMPLATES[eventType]
  return {
    title: t.title,
    theme: t.theme,
    blocks: t.blocks.map(
      (b) => ({ type: b.type, config: parseBlockConfig(b.type, b.config) }) as BlockInput,
    ),
  }
}

/** 바꾸지 않은 자리 표시 문구([…])가 있는지 */
export function hasPlaceholder(text: string): boolean {
  return /\[[^\]\n]{1,20}\]/.test(text)
}
