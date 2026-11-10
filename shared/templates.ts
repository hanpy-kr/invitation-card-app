import { defaultCoverKey } from './covers'
import {
  defaultShowAttendees,
  parseBlockConfig,
  type BlockInput,
  type BlockType,
  type EventType,
} from './blocks'
import type { ThemeKey } from './themes'

/**
 * 새 초대장을 만들 때 행사 종류별로 깔아 주는 기본 블록 · 문구 · 테마.
 * 대괄호로 감싼 문구([신랑 이름] 등)는 바꿔야 하는 자리 — 발행 전에 남아 있으면 안내한다.
 */
type Template = { title: string; theme: ThemeKey; blocks: { type: BlockType; config: unknown }[] }

/** 돌잡이 예측: 후보 6개를 미리 채운 자유 투표(하나만 고르기). 주최자가 후보를 고치거나 뺄 수 있다 */
const DOLJABI_VOTE = {
  title: '돌잡이 예측',
  message: '우리 아이는 무엇을 잡을까요? 미리 맞혀 보세요!',
  kind: 'text',
  multiple: false,
  options: [
    { id: 'thread', label: '실 · 건강하게 오래오래' },
    { id: 'money', label: '돈 · 부자가 될 거예요' },
    { id: 'pencil', label: '연필 · 공부 잘하는 학자' },
    { id: 'gavel', label: '판사봉 · 정의로운 법조인' },
    { id: 'mike', label: '마이크 · 끼 많은 방송인' },
    { id: 'steth', label: '청진기 · 따뜻한 의사' },
  ],
}

const TEMPLATES: Record<EventType, Template> = {
  wedding: {
    title: '[신랑 이름] ♥ [신부 이름] 결혼합니다',
    theme: 'classic',
    blocks: [
      {
        type: 'cover',
        config: {
          layout: 'design',
          designKey: defaultCoverKey('wedding'),
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
      { type: 'calendar', config: { title: '예식 일시' } },
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
        type: 'contact',
        config: {
          people: [
            { relation: '신랑', name: '' },
            { relation: '신부', name: '' },
          ],
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
        type: 'notice',
        config: {
          title: '안내',
          items: [
            { title: '식사', body: '예식 후 연회장에서 식사가 준비되어 있습니다.' },
            { title: '주차', body: '[주차 안내를 적어 주세요]' },
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
          layout: 'design',
          designKey: defaultCoverKey('dol'),
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
      { type: 'calendar', config: { title: '돌잔치 날' } },
      { type: 'location', config: { title: '오시는 길' } },
      {
        type: 'rsvp',
        config: { message: '식사 준비를 위해\n참석 인원을 알려 주세요.', maxPartySize: 6 },
      },
      { type: 'vote', config: DOLJABI_VOTE },
      {
        type: 'contact',
        config: { people: [{ relation: '아빠' }, { relation: '엄마' }] },
      },
      {
        type: 'account',
        config: {
          title: '마음 전하실 곳',
          groups: [{ label: '아기 부모', accounts: [{ relation: '아빠' }, { relation: '엄마' }] }],
        },
      },
      {
        type: 'notice',
        config: {
          title: '안내',
          items: [{ title: '주차', body: '[주차 안내를 적어 주세요]' }],
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
        config: {
          layout: 'design',
          designKey: defaultCoverKey('meetup'),
          title: '[모임 이름]',
          subtitle: '오랜만에 얼굴 봐요',
        },
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
  yearend: {
    title: '[모임 이름] 송년회',
    theme: 'navy',
    blocks: [
      {
        type: 'cover',
        config: {
          layout: 'design',
          designKey: defaultCoverKey('yearend'),
          title: '[모임 이름] 송년회',
          subtitle: '올해도 수고 많았어요',
        },
      },
      {
        type: 'greeting',
        config: {
          icon: 'none',
          title: '한 해 마무리, 같이 해요',
          message: '올 한 해 정말 고생 많았어요.\n맛있는 거 먹으면서 웃으며 마무리해요.',
          hosts: ['[주최자 이름]'],
        },
      },
      { type: 'location', config: { title: '1차', time: '오후 7시' } },
      { type: 'location', config: { title: '2차', time: '오후 9시부터' } },
      {
        type: 'rsvp',
        config: {
          title: '참석 여부',
          message: '자리 예약을 위해 미리 알려 주세요.',
          maxPartySize: 2,
          questions: [
            {
              id: 'menu01',
              kind: 'choice',
              label: '메뉴를 골라 주세요',
              options: ['고기', '해산물', '채식'],
              required: true,
              target: 'attending',
            },
            {
              id: 'second1',
              kind: 'choice',
              label: '2차도 가요?',
              options: ['갈게요', '1차만'],
              target: 'attending',
            },
          ],
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
        type: 'notice',
        config: {
          title: '안내',
          items: [
            { title: '회비', body: '[1인 회비와 2차 정산 방법을 적어 주세요]' },
            { title: '드레스 코드', body: '편하게 오세요!' },
          ],
        },
      },
    ],
  },
  prewedding: {
    title: '[신랑 이름] · [신부 이름] 청첩장 모임',
    theme: 'classic',
    blocks: [
      {
        type: 'cover',
        config: {
          layout: 'design',
          designKey: defaultCoverKey('prewedding'),
          title: '[신랑 이름] · [신부 이름]',
          subtitle: '청첩장 드리러 갈게요',
        },
      },
      {
        type: 'greeting',
        config: {
          icon: 'post',
          title: '저희 결혼해요',
          message: '결혼 소식을 직접 전하고 싶어\n작은 자리를 마련했어요.\n\n맛있는 저녁 함께해요.',
          hosts: ['[신랑 이름]', '[신부 이름]'],
          hostSeparator: 'heart',
        },
      },
      { type: 'location', config: { title: '모이는 곳' } },
      {
        type: 'rsvp',
        config: {
          title: '참석 여부',
          message: '자리 예약을 위해 알려 주세요.',
          maxPartySize: 2,
        },
      },
    ],
  },
  thanks: {
    title: '[이름] 감사 인사',
    theme: 'ivory',
    blocks: [
      {
        type: 'cover',
        config: {
          layout: 'design',
          designKey: defaultCoverKey('thanks'),
          title: '감사합니다',
          subtitle: '함께해 주신 마음 잊지 않겠습니다',
        },
      },
      {
        type: 'greeting',
        config: {
          icon: 'post',
          title: '감사드립니다',
          message:
            '바쁘신 중에도 귀한 걸음 해 주시고\n따뜻한 마음을 보내 주셔서\n진심으로 감사드립니다.\n\n보내 주신 사랑 오래 간직하며\n행복하게 살겠습니다.',
          hosts: ['[이름]', '[이름]'],
          hostSeparator: 'heart',
        },
      },
      { type: 'gallery', config: { title: '함께한 순간' } },
    ],
  },
  birthday: {
    title: '[이름]의 생일 파티',
    theme: 'blossom',
    blocks: [
      {
        type: 'cover',
        config: {
          layout: 'design',
          designKey: defaultCoverKey('birthday'),
          title: '[이름]의 생일 파티',
          subtitle: '같이 축하해 줘요',
        },
      },
      {
        type: 'greeting',
        config: {
          icon: 'none',
          title: '놀러 와요',
          message: '맛있는 거 먹고 신나게 놀아요!',
          hosts: ['[이름]'],
        },
      },
      { type: 'location', config: { title: '파티 장소' } },
      {
        type: 'rsvp',
        config: { title: '올 수 있어요?', maxPartySize: 3 },
      },
      {
        type: 'notice',
        config: {
          title: '안내',
          items: [{ title: '준비물', body: '반가운 얼굴 하나면 충분해요.' }],
        },
      },
    ],
  },
  housewarming: {
    title: '[이름]네 집들이',
    theme: 'mint',
    blocks: [
      {
        type: 'cover',
        config: {
          layout: 'design',
          designKey: defaultCoverKey('housewarming'),
          title: '[이름]네 집들이',
          subtitle: '새 집에 놀러 오세요',
        },
      },
      {
        type: 'greeting',
        config: {
          icon: 'none',
          title: '이사했어요',
          message: '새 보금자리에 초대합니다.\n편하게 놀다 가세요!',
          hosts: ['[이름]'],
        },
      },
      { type: 'location', config: { title: '우리 집', detail: '[동 · 호수]' } },
      {
        type: 'rsvp',
        config: { title: '올 수 있어요?', maxPartySize: 3 },
      },
      {
        type: 'notice',
        config: {
          title: '안내',
          items: [
            { title: '주차', body: '[주차 가능 여부를 적어 주세요]' },
            { title: '선물', body: '빈손으로 오셔도 괜찮아요!' },
          ],
        },
      },
    ],
  },
}

/** 행사 종류에 따라 달라지는 블록 기본값 (명단 공개 등). 편집기에서 블록을 새로 넣을 때도 씀 */
export function withEventDefaults(eventType: EventType, type: BlockType, config: unknown): unknown {
  if (type === 'rsvp') {
    const c = (config ?? {}) as { showAttendees?: boolean }
    return { ...c, showAttendees: c.showAttendees ?? defaultShowAttendees(eventType) }
  }
  return config
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
      (b) =>
        ({
          type: b.type,
          config: parseBlockConfig(b.type, withEventDefaults(eventType, b.type, b.config)),
        }) as BlockInput,
    ),
  }
}

/**
 * '나도 만들기': 원본의 행사 종류 · 테마 · 블록 순서만 따르고, 내용은 전부 템플릿 기본 문구로 채운다.
 * 원본 주최자의 글 · 사진 · 계좌 · 연락처는 이 함수에 넘어오지도 않는다(블록 종류 목록만 받음).
 */
export function buildFromLayout(
  eventType: EventType,
  layout: { type: BlockType; visible: boolean }[],
): { title: string; blocks: (BlockInput & { visible: boolean })[] } {
  const t = buildTemplate(eventType)
  const pool = [...t.blocks]
  const blocks = layout.map((b) => {
    const i = pool.findIndex((x) => x.type === b.type)
    const config =
      i >= 0
        ? pool.splice(i, 1)[0].config
        : parseBlockConfig(b.type, withEventDefaults(eventType, b.type, {}))
    return { type: b.type, config, visible: b.visible } as BlockInput & { visible: boolean }
  })
  return { title: t.title, blocks }
}

/** 바꾸지 않은 자리 표시 문구([…])가 있는지 */
export function hasPlaceholder(text: string): boolean {
  return /\[[^\]\n]{1,20}\]/.test(text)
}
