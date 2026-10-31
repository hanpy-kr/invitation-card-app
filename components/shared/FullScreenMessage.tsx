import classNames from 'classnames/bind'

import styles from './FullScreenMessage.module.scss'

const cx = classNames.bind(styles)

type Props = {
  type: 'loading' | 'error'
  /** 에러일 때 보여 줄 문구 */
  message?: string
  children?: React.ReactNode
}

/** 화면 전체를 덮는 로딩 · 에러 안내 */
export default function FullScreenMessage({ type, message, children }: Props) {
  return (
    <div className={cx('container')} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'loading' ? (
        <IconHeart />
      ) : (
        <>
          <IconError />
          <p>{message ?? '에러가 발생했어요. 잠시 후 다시 시도해 주세요.'}</p>
        </>
      )}
      {children}
    </div>
  )
}

function IconHeart() {
  return (
    <svg
      className={cx('ico-heart')}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="불러오는 중"
    >
      <path d="M365.4,59.628c60.56,0,109.6,49.03,109.6,109.47c0,109.47-109.6,171.8-219.06,281.271C146.47,340.898,37,278.568,37,169.099c0-60.44,49.04-109.47,109.47-109.47c54.73,0,82.1,27.37,109.47,82.1C283.3,86.999,310.67,59.628,365.4,59.628z" />
    </svg>
  )
}

/** 레거시 `Error`는 전역 Error를 가려서 이름 변경. JSX 속성은 카멜케이스로, 크기는 scss에서 지정 */
function IconError() {
  return (
    <svg
      className={cx('ico-error')}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M4 8v-2a2 2 0 0 1 2 -2h2" />
      <path d="M4 16v2a2 2 0 0 0 2 2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M16 20h2a2 2 0 0 0 2 -2v-2" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M9.5 15.05a3.5 3.5 0 0 1 5 0" />
    </svg>
  )
}
