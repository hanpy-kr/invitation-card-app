import classNames from 'classnames/bind'
import styles from './ImageGallery.module.scss'

import Section from '../shared/Section'

const cx = classNames.bind(styles)

function ImageGallery({ images }: { images: string[] }) {
  return (
    <Section title="사진첩">
      <ul className={cx('wrap-images')}>
        {images.map((src, index) => (
          <li key={index} className={cx('wrap-image')}>
            <img src={src} alt="사진첩 이미지" />
          </li>
        ))}
      </ul>
    </Section>
  )
}

export default ImageGallery
