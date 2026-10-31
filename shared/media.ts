/** storage key → 공개 주소. base가 비어 있으면 로컬 개발용 /uploads 경로 */
export function mediaSrc(baseUrl: string, key: string): string {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : '/uploads'
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
}
