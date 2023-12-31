import React, { useEffect, useState } from 'react'

import classNames from 'classnames/bind'

import styles from './App.module.scss'
import FullScreenMessage from './components/shared/FullScreenMessage'
import Heading from '@components/sections/Heading'
import Video from '@components/sections/Video'

import { Wedding } from '@models/wedding'
import ImageGallery from './components/sections/ImageGallery'
import Intro from './components/sections/Intro'
import Invitation from './components/sections/Invitation'

const cx = classNames.bind(styles)

function App() {
  const [wedding, setWedding] = useState<Wedding | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // 의존성 삭제 시([]) 렌더링 후 최초 한번 호출
  useEffect(() => {
    setLoading(true)
    // 비동기를 보장 받는 3가지 방법 : callback promise async/await
    // 아래는 Promise
    fetch('http://localhost:8888/wedding')
      .then((response) => {
        // 404 만났을 때 catch는 에러 처리하지 않는다.
        // 따라서 성공적으로 데이터 못받았을 때는 명시적으로 error를 throw 해줘야한다.
        // 그래야 catch로 빠진다.
        if (response.ok === false) {
          throw new Error('청첩장 정보를 불러오지 못했습니다.')
        }

        return response.json() // json도 promise이다.
      })
      .then((data) => {
        setWedding(data)
      })
      .catch((e) => {
        console.log('에러발생', e)
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <FullScreenMessage type="loading" />
  }

  if (error) {
    return <FullScreenMessage type="error" />
  }

  if (wedding == null) {
    return null
  }

  const {
    date,
    galleryImages,
    groom,
    bride,
    location,
    message: { intro, invitation },
  } = wedding
  return (
    <div className={cx('container')}>
      <Heading date={date} />
      <Video />
      <Intro
        groomName={groom.name}
        brideName={bride.name}
        locationName={location.name}
        date={date}
        message={intro}
      />
      <Invitation message={invitation} />
      <ImageGallery images={galleryImages} />
      <div>{JSON.stringify(wedding)}</div>
    </div>
  )
}

export default App
