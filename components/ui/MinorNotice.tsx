import styles from './MinorNotice.module.scss'

/** 결제 버튼 가까이에 두는 미성년자 고지 (그로블 요청). 결제 버튼이 있는 화면마다 한 줄 */
export const MINOR_NOTICE = '만 19세 미만은 법정대리인의 동의가 필요합니다'

export default function MinorNotice({ tone = 'default' }: { tone?: 'default' | 'onDark' }) {
  return (
    <p className={styles.minor} data-tone={tone} data-testid="minor-notice">
      {MINOR_NOTICE}
    </p>
  )
}
