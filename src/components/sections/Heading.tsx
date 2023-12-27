import { parseISO, format, getDay } from 'date-fns'
/**
 * date-fns
 * string을 data 타입으로 변경 >parseISO
 * format(weddingDate, 'yy.MM.dd') 으로 2023.12.31 로 데이터 변경된다.
 * getDay > 데이터의 요일을 숫자로 뽑아준다. 0이 Sunday이다.
 */

import classNames from 'classnames/bind'
import styles from './Heading.module.scss'

import Section from '@shared/Section'

const cx = classNames.bind(styles)

/**
 * 변수로 한번만 만들면 된다.
 * 그러나 컴포넌트 안에 있으면 리렌더 될때마다 계속 만든다.
 * 따라서 상수는 컴포넌트 밖에서 만들자.
 */
const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/**
 * props로 className을 넘겼지만, 스타일은 여기서 지정가능하다.
 * 즉 Section의 기본 padding style을 가지면서, 여기서는 배경색을 추가로 주는 추가로 다중 스타일 지정이 가능하다.
 *
 * yarn add date-fns
 */
function Heading({ date }: { date: string }) {
  const weddingDate = parseISO(date)

  console.log(DAYS[getDay(weddingDate)])

  return (
    <Section className={cx('container')}>
      <div className={cx('txt-date')}>{format(weddingDate, 'yy.MM.dd')}</div>
      <div className={cx('txt-day')}>SATURDAY</div>
    </Section>
  )
}

export default Heading
