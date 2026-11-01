/**
 * 카톡 미리보기 · og:image용 JPEG 사본의 key. 카카오 스크랩은 JPG/PNG만 지원해서(webp 안 됨)
 * 사진을 올릴 때 브라우저가 이 이름으로 작은 JPEG를 함께 올린다. 예) inv/x/y.webp → inv/x/y.share.jpg
 */
export function shareKey(key: string): string {
  return key.replace(/\.[a-z0-9]+$/i, '') + '.share.jpg'
}

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
