/** 글자 폭 추정 (글자 크기 1 = 한글 한 글자). 표시 글꼴마다 조금씩 달라서 약간 넉넉하게 잡는다 */
export function textUnits(text: string): number {
  let u = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (ch === ' ') u += 0.32
    else if (c > 0xffff)
      u += 1.1 // 이모지
    else if (/[·•,.:;'"!?~\-]/.test(ch)) u += 0.42
    else if (/[A-Z0-9]/.test(ch)) u += 0.7
    else if (/[a-z]/.test(ch)) u += 0.58
    else u += 1 // 한글 · 한자 · 하트 등
  }
  return u * 1.04
}

export type FitRange = { max: number; min: number; floor: number }

/**
 * 제목이 길면 글자 크기를 자동으로 줄인다 (단위: 그림 가로폭의 cqw).
 *  1) 한 줄에 들어가는 크기가 min 이상이면 그 크기 (max까지)
 *  2) 그래도 안 들어가면 min 크기로 두 줄로 넘김
 *  3) 두 줄로도 넘치면 floor까지 더 줄여 두 줄에 맞추고, 그 아래로는 줄이지 않고 줄 수가 늘어남
 */
export function fitCqw(text: string, areaCqw: number, r: FitRange): number {
  const u = textUnits(text)
  if (u === 0) return r.max
  const oneLine = areaCqw / u
  if (oneLine >= r.min) return Math.min(r.max, oneLine)
  const twoLines = (areaCqw * 2) / u
  return Math.max(r.floor, Math.min(r.min, twoLines))
}
