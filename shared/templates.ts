import { parseBlockConfig, type BlockInput, type BlockType, type EventType } from './blocks'
import type { ThemeKey } from './themes'

/** 새 초대장을 만들 때 행사 종류별로 깔아 주는 기본 블록 · 문구 · 테마 */
type Template = { title: string; theme: ThemeKey; blocks: { type: BlockType; config: unknown }[] }

const TEMPLATES: Record<EventType, Template> = {
  wedding: {
    title: '저희 결혼합니다',
    theme: 'classic',
    blocks: [
      {
        type: 'cover',
        config: { layout: 'photo', title: '신랑 · 신부', subtitle: '우리 결혼합니다' },
      },
      {
        type: 'greeting',
        config: {
          icon: 'flower',
          title: '초대합니다',
          message:
            '서로 다른 길을 걸어온 두 사람이\n이제 같은 길을 함께 걸어가려 합니다.\n\n귀한 걸음 하시어\n저희의 시작을 축복해 주세요.',
          hosts: ['신랑', '신부'],
          hostSeparator: 'heart',
        },
      },
      { type: 'gallery', config: { title: '사진첩' } },
      { type: 'location', config: {} },
      {
        type: 'rsvp',
        config: {
          message: '참석 여부를 미리 알려 주시면\n준비에 큰 도움이 됩니다.',
          askMeal: true,
        },
      },
      { type: 'guestbook', config: { message: '두 사람에게 축하 한마디를 남겨 주세요.' } },
    ],
  },
  dol: {
    title: '첫 생일에 초대합니다',
    theme: 'blossom',
    blocks: [
      {
        type: 'cover',
        config: { layout: 'photo', title: '아기 이름의 첫 생일', subtitle: '돌잔치에 초대합니다' },
      },
      {
        type: 'greeting',
        config: {
          icon: 'post',
          title: '감사의 마음을 담아',
          message:
            '건강하게 자라 준 아이가\n벌써 첫 생일을 맞았습니다.\n\n함께해 주신 분들께 감사드리며\n작은 자리에 모시고자 합니다.',
          hosts: ['아빠 이름', '엄마 이름'],
        },
      },
      { type: 'gallery', config: { title: '성장 앨범' } },
      { type: 'location', config: {} },
      { type: 'rsvp', config: { maxPartySize: 6 } },
    ],
  },
  meetup: {
    title: '모임에 초대합니다',
    theme: 'navy',
    blocks: [
      {
        type: 'cover',
        config: { layout: 'text', title: '모임 이름', subtitle: '오랜만에 얼굴 봐요' },
      },
      {
        type: 'greeting',
        config: {
          icon: 'none',
          title: '함께해요',
          message: '맛있는 음식 먹으면서 근황 나눠요.\n\n회비 · 준비물 등 안내를 적어 주세요.',
          hosts: ['주최자 이름'],
        },
      },
      { type: 'location', config: {} },
      { type: 'rsvp', config: { maxPartySize: 2 } },
      {
        type: 'guestbook',
        config: { title: '한마디', message: '못 오는 분도 한마디 남겨 주세요.' },
      },
    ],
  },
  etc: {
    title: '초대합니다',
    theme: 'mint',
    blocks: [
      { type: 'cover', config: { layout: 'text', title: '행사 이름', subtitle: '초대합니다' } },
      {
        type: 'greeting',
        config: { icon: 'none', title: '안내', message: '행사 안내를 적어 주세요.' },
      },
      { type: 'location', config: {} },
      { type: 'rsvp', config: {} },
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
