/**
 * 로컬 개발용 샘플 데이터: 개발 사용자 1명 + 결혼 · 돌잔치 · 회식 초대장 3건 (모두 발행 상태)
 * 실행: pnpm db:seed  — 같은 slug가 있으면 지우고 다시 만든다.
 *
 * 사진은 storage key `samples/wedding_XX.webp`를 가리킨다.
 * R2가 없으면 .local/uploads/samples/ 에 같은 이름으로 파일을 두면 로컬에서 보인다.
 * 카톡 미리보기용 JPEG 사본(wedding_XX.share.jpg, 긴 변 1200px)과 사진첩 썸네일(wedding_XX.thumb.webp, 480px)도
 * 같은 폴더 · 버킷에 함께 둘 것.
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq, inArray } from 'drizzle-orm'
import postgres from 'postgres'

import * as schema from '../lib/db/schema'
import { parseBlockConfig, type BlockType, type MediaRef } from '../shared/blocks'
import { requireEnv } from './env'

const DEV_KAKAO_ID = 'dev-1'

type SeedBlock = { type: BlockType; config: unknown; visible?: boolean }

type SeedInvitation = {
  slug: string
  eventType: (typeof schema.eventTypeEnum.enumValues)[number]
  title: string
  eventAt: string
  theme: string
  photos?: { key: string; w: number; h: number }[]
  blocks: (photos: MediaRef[]) => SeedBlock[]
}

const weddingPhotos = [
  { key: 'samples/wedding_01.webp', w: 1067, h: 1600 },
  { key: 'samples/wedding_02.webp', w: 1600, h: 1067 },
  { key: 'samples/wedding_03.webp', w: 1600, h: 1067 },
  { key: 'samples/wedding_04.webp', w: 1600, h: 1062 },
  { key: 'samples/wedding_05.webp', w: 1600, h: 1067 },
  { key: 'samples/wedding_06.webp', w: 1600, h: 1080 },
  { key: 'samples/wedding_07.webp', w: 1600, h: 1067 },
  { key: 'samples/wedding_08.webp', w: 1600, h: 1067 },
  { key: 'samples/wedding_10.webp', w: 1600, h: 1067 },
  { key: 'samples/wedding_11.webp', w: 1600, h: 1065 },
]

const seeds: SeedInvitation[] = [
  {
    slug: 'demowed1',
    eventType: 'wedding',
    title: '김민준 ♥ 이서연 결혼합니다',
    eventAt: '2026-11-21T12:30:00+09:00',
    theme: 'classic',
    photos: weddingPhotos,
    blocks: (photos) => [
      {
        type: 'cover',
        config: {
          layout: 'photo',
          image: photos[0],
          title: '김민준 · 이서연',
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
          hosts: ['김민준', '이서연'],
          hostSeparator: 'heart',
          showEventDate: true,
        },
      },
      { type: 'gallery', config: { title: '사진첩', images: photos.slice(1) } },
      {
        type: 'location',
        config: {
          placeName: '디어홀 웨딩',
          detail: '3층 그랜드홀',
          address: '서울특별시 중구 세종대로 110',
          lat: 37.5663,
          lng: 126.9779,
          subway: '1 · 2호선 시청역 5번 출구 도보 2분',
          bus: '시청앞 정류장 하차 (간선 402, 405 · 지선 7016)',
          parking: '건물 지하 주차장 2시간 무료',
        },
      },
      {
        type: 'rsvp',
        config: {
          message: '참석 여부를 미리 알려 주시면\n준비에 큰 도움이 됩니다.',
          askMeal: true,
          maxPartySize: 5,
          deadline: '2026-11-14',
        },
      },
      {
        type: 'account',
        config: {
          message: '참석이 어려우신 분들을 위해\n계좌번호를 함께 적어 두었습니다.',
          groups: [
            {
              label: '신랑 측',
              accounts: [
                {
                  relation: '신랑 김민준',
                  bank: '카카오뱅크',
                  number: '3333-00-0000001',
                  holder: '김민준',
                },
                {
                  relation: '신랑 아버지',
                  bank: 'KB국민',
                  number: '000000-00-000002',
                  holder: '김철수',
                },
              ],
            },
            {
              label: '신부 측',
              accounts: [
                {
                  relation: '신부 이서연',
                  bank: '토스뱅크',
                  number: '1000-0000-0003',
                  holder: '이서연',
                },
              ],
            },
          ],
        },
      },
      { type: 'guestbook', config: { message: '두 사람에게 축하 한마디를 남겨 주세요.' } },
    ],
  },
  {
    slug: 'demodol1',
    eventType: 'dol',
    title: '우리 하준이 첫 생일',
    eventAt: '2026-11-29T12:00:00+09:00',
    theme: 'blossom',
    blocks: () => [
      {
        type: 'cover',
        config: { layout: 'text', title: '하준이의 첫 번째 생일', subtitle: '돌잔치에 초대합니다' },
      },
      {
        type: 'greeting',
        config: {
          icon: 'post',
          title: '감사의 마음을 담아',
          message:
            '건강하게 자라 준 하준이가\n벌써 첫 생일을 맞았습니다.\n\n함께해 주신 분들께 감사드리며\n작은 자리에 모시고자 합니다.',
          hosts: ['아빠 박지훈', '엄마 최유진'],
          hostSeparator: 'dot',
          showEventDate: true,
        },
      },
      {
        type: 'location',
        config: {
          placeName: '디어 가든 레스토랑',
          detail: '2층 연회장',
          address: '서울특별시 마포구 월드컵북로 396',
          lat: 37.5793,
          lng: 126.8895,
          subway: '6호선 · 공항철도 디지털미디어시티역 9번 출구 도보 10분',
          parking: '건물 주차장 이용 (3시간 무료)',
        },
      },
      { type: 'rsvp', config: { askMeal: false, maxPartySize: 6 } },
    ],
  },
  {
    slug: 'demomeet',
    eventType: 'meetup',
    title: '디어고 12기 송년회',
    eventAt: '2026-12-19T19:00:00+09:00',
    theme: 'navy',
    blocks: () => [
      {
        type: 'cover',
        config: { layout: 'text', title: '12기 송년회', subtitle: '오랜만에 얼굴 봐요' },
      },
      {
        type: 'greeting',
        config: {
          icon: 'none',
          title: '한 해 마무리, 같이 해요',
          message:
            '올해도 고생 많았습니다.\n맛있는 저녁 먹으면서 근황 나눠요.\n\n회비는 1인 3만 원, 당일 현장에서 걷습니다.',
          hosts: ['총무 정우성'],
          hostSeparator: 'dot',
          showEventDate: true,
        },
      },
      {
        type: 'location',
        config: {
          placeName: '디어 다이닝',
          detail: '단체석 (예약자명: 12기)',
          address: '서울특별시 강남구 테헤란로 152',
          lat: 37.5001,
          lng: 127.0365,
          subway: '2호선 역삼역 1번 출구 도보 3분',
        },
      },
      { type: 'rsvp', config: { askMeal: false, maxPartySize: 2, deadline: '2026-12-12' } },
      {
        type: 'account',
        config: {
          title: '회비 안내',
          perPerson: 30000,
          groups: [
            {
              label: '회비 계좌',
              accounts: [
                {
                  relation: '총무 김하나',
                  bank: '카카오뱅크',
                  number: '3333-00-0000004',
                  holder: '김하나',
                },
              ],
            },
          ],
        },
      },
      {
        type: 'guestbook',
        config: { title: '한마디', message: '못 오는 친구도 한마디 남겨 주세요.' },
      },
    ],
  },
]

async function main() {
  const client = postgres(requireEnv('DATABASE_URL'), { max: 1, prepare: false })
  const db = drizzle(client, { schema })

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(schema.users)
      .values({ kakaoId: DEV_KAKAO_ID, nickname: '개발자' })
      .onConflictDoUpdate({ target: schema.users.kakaoId, set: { nickname: '개발자' } })
      .returning()

    await tx.delete(schema.invitations).where(
      inArray(
        schema.invitations.slug,
        seeds.map((s) => s.slug),
      ),
    )
    await tx.delete(schema.media).where(eq(schema.media.ownerId, user.id))

    for (const seed of seeds) {
      const [inv] = await tx
        .insert(schema.invitations)
        .values({
          ownerId: user.id,
          slug: seed.slug,
          eventType: seed.eventType,
          title: seed.title,
          eventAt: new Date(seed.eventAt),
          theme: seed.theme,
          status: 'published',
        })
        .returning()

      const mediaRows = seed.photos?.length
        ? await tx
            .insert(schema.media)
            .values(
              seed.photos.map((p) => ({
                ownerId: user.id,
                invitationId: inv.id,
                storageKey: p.key,
                width: p.w,
                height: p.h,
                sizeBytes: 0,
              })),
            )
            .returning()
        : []
      const refs: MediaRef[] = mediaRows.map((m) => ({
        id: m.id,
        key: m.storageKey,
        w: m.width,
        h: m.height,
        share: true, // samples/wedding_XX.share.jpg를 함께 둠
        thumb: true, // samples/wedding_XX.thumb.webp (긴 변 480px)도 함께 둠
      }))

      const blockRows = seed.blocks(refs).map((b, i) => ({
        invitationId: inv.id,
        type: b.type,
        position: i,
        visible: b.visible ?? true,
        config: parseBlockConfig(b.type, b.config),
      }))
      await tx.insert(schema.blocks).values(blockRows)

      if (refs[0]) {
        await tx
          .update(schema.invitations)
          .set({ coverMediaId: refs[0].id })
          .where(eq(schema.invitations.id, inv.id))
      }
      console.log(`  /i/${seed.slug}  ${seed.title}`)
    }
  })

  await client.end()
  console.log('seed 완료')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
