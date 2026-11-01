/** storage key → 공개 주소. base가 비어 있으면 로컬 개발용 /uploads 경로 */
export function mediaSrc(baseUrl: string, key: string): string {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : '/uploads'
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
}

type MediaRefLike = { id: string; key: string; w: number; h: number }

/** 블록들이 쓰는 사진 (표지 + 사진첩) */
export function collectMediaRefs(blocks: { type: string; config: unknown }[]): MediaRefLike[] {
  const refs: MediaRefLike[] = []
  for (const b of blocks) {
    if (b.type === 'cover') {
      const image = (b.config as { image?: MediaRefLike | null }).image
      if (image) refs.push(image)
    } else if (b.type === 'gallery') {
      refs.push(...((b.config as { images?: MediaRefLike[] }).images ?? []))
    }
  }
  return refs
}
