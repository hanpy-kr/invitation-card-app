import styles from './Eyebrow.module.scss'

/** 페이지 제목 위 영문 소제목 (MY INVITATIONS 등). 장식이라 스크린리더에서는 건너뜀 */
export default function Eyebrow({ children }: { children: string }) {
  return (
    <p className={styles.eyebrow} aria-hidden="true">
      {children}
    </p>
  )
}
