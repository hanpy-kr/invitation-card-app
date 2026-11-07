import type { EventType } from '@/shared/blocks'

/** 블록이 표시에 필요로 하는 초대장 정보. 직렬화 가능한 값만 둔다(클라이언트 컴포넌트로 넘기기 위해). */
export type BlockContext = {
  slug: string
  eventType: EventType
  title: string
  /** ISO 문자열 */
  eventAt: string | null
  /** 사진 공개 주소 앞부분. 비어 있으면 /uploads */
  mediaBaseUrl: string
  /** 카카오 JS 키 (지도). 비어 있으면 지도 없이 길찾기 링크만 */
  kakaoJsKey: string
  /** 날짜 투표 중 (표지 날짜 자리에 '날짜 투표 중', 날짜를 쓰는 블록은 숨김) */
  dateVoting?: boolean
  /** 편집기 미리보기 (하객 쓰기 기능은 보내지 않음) */
  preview?: boolean
}
