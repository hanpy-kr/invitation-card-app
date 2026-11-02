import styles from './Skeleton.module.scss'

/** 화면을 옮길 때 바로 보여 주는 가벼운 자리 표시 (서버 컴포넌트, JS 없음) */
function Bar({ w = '100%', h = 16, r }: { w?: number | string; h?: number; r?: number }) {
  return <div className={styles.bar} style={{ width: w, height: h, borderRadius: r }} />
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-label="불러오는 중" aria-busy="true">
      {children}
    </div>
  )
}

/** 내 초대장 목록 */
export function DashboardSkeleton() {
  return (
    <Status>
      <main className={styles.page}>
        <div className={styles.row} style={{ justifyContent: 'space-between', marginBottom: 24 }}>
          <Bar w={160} h={24} />
          <Bar w={56} h={20} />
        </div>
        <Bar h={50} r={12} />
        <div className={styles.stack} style={{ marginTop: 20 }}>
          {[0, 1, 2].map((i) => (
            <Bar key={i} h={120} r={12} />
          ))}
        </div>
      </main>
    </Status>
  )
}

/** 응답 집계 */
export function ResponsesSkeleton() {
  return (
    <Status>
      <main className={`${styles.page} ${styles.wide}`}>
        <Bar w={80} h={14} />
        <div style={{ height: 14 }} />
        <Bar w="70%" h={24} />
        <div style={{ height: 8 }} />
        <Bar w="45%" h={14} />
        <div className={styles.row} style={{ margin: '20px 0 28px' }}>
          {[0, 1, 2].map((i) => (
            <Bar key={i} h={76} r={12} />
          ))}
        </div>
        <div className={styles.stack}>
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} h={40} />
          ))}
        </div>
      </main>
    </Status>
  )
}

/** 편집기 */
export function EditorSkeleton() {
  return (
    <Status>
      <div className={styles.editor}>
        <div className={styles.top}>
          <Bar w={28} h={28} />
          <Bar w="40%" h={18} />
          <div style={{ marginLeft: 'auto' }}>
            <Bar w={84} h={38} />
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.card}>
            <div className={styles.stack}>
              <Bar w={90} h={18} />
              <Bar h={44} />
              <div className={styles.row}>
                <Bar h={44} />
                <Bar h={44} />
              </div>
              <Bar h={44} />
            </div>
          </div>
          <div className={styles.stack} style={{ marginTop: 24 }}>
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} h={56} r={14} />
            ))}
          </div>
        </div>
      </div>
    </Status>
  )
}
