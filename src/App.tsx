import React from 'react'

import classNames from 'classnames/bind'

import styles from './App.module.scss'

const cx = classNames.bind(styles)

function App() {
  return (
    <div className={cx('container')}>
      <div>App</div>
    </div>
  )
}

export default App
