/** 유튜브 주소에서 영상 id를 뽑는다. 알아볼 수 없으면 null */
export function parseYoutubeId(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  const ID = /^[A-Za-z0-9_-]{11}$/
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const [, kind, rest] = url.pathname.split('/')
      if (['shorts', 'embed', 'live', 'v'].includes(kind)) id = rest ?? null
    }
  }
  return id && ID.test(id) ? id : null
}

export const youtubeThumbUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
export const youtubeEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`
