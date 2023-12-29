import classNames from 'classnames/bind'
import styles from './Section.module.scss'

const cx = classNames.bind(styles)

/**
 * classNames를 활용해서 여러개의 className을 props로 받아 추가할 수 있다.
 * 조금 더 생각해보면 className을 string[]으로도 받아서 사용할 수 있음을 알 수 있다.
 */
function Section({
  children,
  className,
  title,
}: {
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <section className={cx(['container', className])}>
      {title !== null ? <div className={cx('txt-title')}>{title}</div> : null}
      {children}
    </section>
  )
}

export default Section
