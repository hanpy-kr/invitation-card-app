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
}
