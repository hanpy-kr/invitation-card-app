/**
 * 카톡 미리보기 · og:image용 JPEG 사본의 key. 카카오 스크랩은 JPG/PNG만 지원해서(webp 안 됨)
 * 사진을 올릴 때 브라우저가 이 이름으로 작은 JPEG를 함께 올린다. 예) inv/x/y.webp → inv/x/y.share.jpg
 */
export function shareKey(key: string): string {
  return key.replace(/\.[a-z0-9]+$/i, '') + '.share.jpg'
}

/** 사진첩 바둑판용 작은 webp(긴 변 480px). 예) inv/x/y.webp → inv/x/y.thumb.webp */
export function thumbKey(key: string): string {
  return key.replace(/\.[a-z0-9]+$/i, '') + '.thumb.webp'
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

/** 블록들이 쓰는 배경음악 파일 (사진 수에는 세지 않음) */
export function collectAudioRefs(blocks: { type: string; config: unknown }[]): MediaRefLike[] {
  const refs: MediaRefLike[] = []
  for (const b of blocks) {
    if (b.type === 'music') {
      const audio = (b.config as { audio?: MediaRefLike | null }).audio
      if (audio) refs.push(audio)
    }
  }
  return refs
}
