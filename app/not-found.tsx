import FullScreenMessage from '@/components/shared/FullScreenMessage'

export default function NotFound() {
  return (
    <FullScreenMessage
      type="error"
      message="찾으시는 페이지가 없어요. 주소를 다시 확인해 주세요."
    />
  )
}
