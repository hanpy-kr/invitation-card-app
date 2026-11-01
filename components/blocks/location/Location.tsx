import classNames from 'classnames/bind'

import type { LocationConfig } from '@/shared/blocks'
import { kakaoMapUrl, naverMapUrl, tmapUrl } from '@/shared/maps'

import Section from '../common/Section'
import Text from '../common/Text'
import CopyButton from './CopyButton'
import KakaoMap from './KakaoMap'
import styles from './Location.module.scss'

const cx = classNames.bind(styles)

export default function Location({
  config,
  kakaoJsKey,
}: {
  config: LocationConfig
  kakaoJsKey: string
}) {
  if (!config.placeName && !config.address) return null
  const place = {
    name: config.placeName,
    address: config.address,
    lat: config.lat,
    lng: config.lng,
  }
  const tmap = tmapUrl(place)
  const ways = [
    { label: '지하철', text: config.subway },
    { label: '버스', text: config.bus },
    { label: '주차', text: config.parking },
  ].filter((w) => w.text)

  return (
    <Section title={config.title} className={cx('container')}>
      <div className={cx('wrap-place')}>
        {config.placeName ? <div className={cx('txt-name')}>{config.placeName}</div> : null}
        {config.detail ? <div className={cx('txt-detail')}>{config.detail}</div> : null}
        {config.address ? (
          <div className={cx('txt-address')}>
            {config.address}
            <CopyButton text={config.address} label="주소 복사" className={cx('btn-copy')} />
          </div>
        ) : null}
      </div>
      {kakaoJsKey && config.lat != null && config.lng != null ? (
        <KakaoMap appKey={kakaoJsKey} lat={config.lat} lng={config.lng} className={cx('map')} />
      ) : null}
      <div className={cx('wrap-links', { three: tmap })}>
        <a href={kakaoMapUrl(place)} target="_blank" rel="noopener noreferrer">
          카카오맵
        </a>
        <a href={naverMapUrl(place)} target="_blank" rel="noopener noreferrer">
          네이버지도
        </a>
        {tmap ? <a href={tmap}>티맵</a> : null}
      </div>
      {ways.length > 0 ? (
        <ul className={cx('list-ways')}>
          {ways.map((w) => (
            <li key={w.label}>
              <div className={cx('txt-label')}>{w.label}</div>
              <Text>{w.text}</Text>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  )
}
