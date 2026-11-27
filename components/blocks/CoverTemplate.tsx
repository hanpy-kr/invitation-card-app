import { useId } from 'react'
import ReactDOM from 'react-dom'

import type { CoverTemplateKey } from '@/shared/blocks'
import { coverTemplateText, fitSize, type CoverTemplateText } from '@/shared/cover-templates'

import HeartGlyph from './common/HeartGlyph'
import styles from './CoverTemplate.module.scss'

/** 디자인 1px → 화면 길이 (--u는 .cover가 정한다) */
const U = (n: number) => `calc(${n} * var(--u))`

const FONTS = {
  cinzel500: '/fonts/cinzel/v1/cinzel-500.woff2',
  cinzel600: '/fonts/cinzel/v1/cinzel-600.woff2',
  bodoni: '/fonts/bodoni-moda/v1/bodoni-moda-cover-400.woff2',
  pinyon: '/fonts/pinyon-script/v1/pinyon-script-400.woff2',
}
const NEEDS: Record<CoverTemplateKey, (keyof typeof FONTS)[]> = {
  a: ['cinzel500', 'bodoni'],
  b: ['cinzel500'],
  c: ['cinzel600', 'bodoni', 'pinyon'],
  x: ['cinzel500', 'cinzel600', 'bodoni', 'pinyon'],
}

/** 이 안이 쓰는 서체만 HTML에서 바로 받기 시작 (첫 화면에서 글자가 늦게 바뀌는 것을 줄임) */
function preloadFonts(template: CoverTemplateKey) {
  for (const f of NEEDS[template]) {
    ReactDOM.preload(FONTS[f], { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' })
  }
}

type Props = {
  template: CoverTemplateKey
  text: CoverTemplateText
  /** 화면 읽기용 제목(보이지 않음) */
  title?: string
  /** 줄여 보여 주는 썸네일 */
  thumb?: boolean
}

export default function CoverTemplate({ template, text, title, thumb }: Props) {
  preloadFonts(template)
  return (
    <section
      className={`${styles.cover} ${thumb ? styles.thumb : ''}`}
      data-cover-template={template}
    >
      {title ? <h1 className={styles.sr}>{title}</h1> : null}
      {template === 'a' ? (
        <A t={text} />
      ) : template === 'b' ? (
        <B t={text} />
      ) : template === 'x' ? (
        <X t={text} />
      ) : (
        <C t={text} />
      )}
    </section>
  )
}

/** config + 예식 일시로 바로 그리는 편의 래퍼 */
export function coverTemplateOf(
  template: CoverTemplateKey,
  config: Parameters<typeof coverTemplateText>[0],
  eventAt: string | null,
  opts: { title?: string; dateVoting?: boolean } = {},
) {
  return (
    <CoverTemplate
      template={template}
      text={coverTemplateText(config, eventAt, opts.dateVoting)}
      title={opts.title}
    />
  )
}

// ───────── 1안: 작약 부조 두 송이 · 큰 날짜 · 이름 ─────────
function A({ t }: { t: CoverTemplateText }) {
  const d = t.date
  const nameSize = fitSize(
    t.groom.length > t.bride.length ? t.groom : t.bride,
    390 - 34 - 24,
    18,
    1.06,
    11,
  )
  const big = { fontSize: U(66), lineHeight: 0.92, color: '#2a231d', textShadow: '0 1px 0 rgba(255,255,255,0.7)' }
  return (
    <>
      <img
        src="/covers/templates/peony-tl.webp"
        alt=""
        width={430}
        height={620}
        className={styles.peony}
        style={{ left: U(-10), top: U(40), width: U(190) }}
        fetchPriority="high"
        decoding="async"
      />
      <img
        src="/covers/templates/peony-br.webp"
        alt=""
        width={430}
        height={660}
        className={styles.peony}
        style={{ right: U(-10), bottom: U(-10), width: U(200) }}
        decoding="async"
      />
      <div className={styles.stage}>
        <div
          className={styles.abs}
          style={{
            right: U(30),
            top: U(64),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: U(12),
          }}
        >
          <div
            className={styles.ink}
            style={{ fontWeight: 500, fontSize: U(10.5), letterSpacing: '0.34em' }}
          >
            THE WEDDING OF
          </div>
          <div
            style={{
              width: 1,
              height: U(120),
              background: '#2a231d',
              opacity: 0.55,
              marginRight: U(6),
            }}
          />
        </div>
        {d ? (
          <div
            className={`${styles.abs} ${styles.bodoni}`}
            style={{ left: U(150), top: U(300), width: U(200) }}
          >
            <div style={big}>{d.day} .</div>
            <div style={{ ...big, paddingLeft: U(26) }}>{d.monthShort}</div>
            <div style={{ ...big, textAlign: 'right', paddingRight: U(8) }}>. {d.yy}</div>
          </div>
        ) : null}
        <div className={styles.abs} style={{ left: U(34), top: U(568) }}>
          {t.hasNames ? (
            <>
              <div
                className={`${styles.ink} ${styles.nowrap}`}
                style={{ fontWeight: 500, fontSize: U(nameSize), letterSpacing: '0.2em' }}
              >
                {t.groom}
              </div>
              <div style={{ margin: `${U(8)} 0 ${U(8)} ${U(2)}` }}>
                <HeartGlyph
                  color="#35291f"
                  className={styles.heartInk}
                  style={{ height: U(15) }}
                />
              </div>
              <div
                className={`${styles.ink} ${styles.nowrap}`}
                style={{ fontWeight: 500, fontSize: U(nameSize), letterSpacing: '0.2em' }}
              >
                {t.bride}
              </div>
            </>
          ) : null}
          {d ? (
            <div
              className={`${styles.ink} ${styles.nowrap}`}
              style={{
                marginTop: t.hasNames ? U(18) : 0,
                fontWeight: 500,
                fontSize: U(12),
                letterSpacing: '0.26em',
              }}
            >
              {d.weekday} · {d.time}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

// ───────── 2안(무료): 금박 이름 · 작약 한 송이 ─────────
function B({ t }: { t: CoverTemplateText }) {
  const d = t.date
  const longest = Math.max(t.groom.length, t.bride.length + 1)
  const fs = fitSize('x'.repeat(longest), 390 - 38 - 30, 38, 0.9, 16)
  const venueSize = fitSize(t.venue, 390 - 38 - 30, 16, 0.98, 10)
  const addrSize = fitSize(t.address, 390 - 38 - 30, 11, 0.9, 9)
  return (
    <>
      <img
        src="/covers/templates/peony-tr.webp"
        alt=""
        width={430}
        height={620}
        className={styles.peony}
        style={{ right: U(-10), top: U(-6), width: U(230) }}
        fetchPriority="high"
        decoding="async"
      />
      <div className={styles.stage}>
        <div className={styles.abs} style={{ left: U(38), right: U(30), top: U(340) }}>
          <p
            className={`${styles.line} ${styles.foil}`}
            style={{ fontWeight: 500, fontSize: U(10.5), letterSpacing: '0.3em' }}
          >
            THE WEDDING OF
          </p>
          {t.hasNames ? (
            <p
              className={`${styles.line} ${styles.foil} ${styles.nowrap}`}
              style={{
                marginTop: U(14),
                fontWeight: 500,
                fontSize: U(fs),
                lineHeight: 1.12,
                letterSpacing: '0.06em',
              }}
            >
              {t.groom}
              <br />
              <HeartGlyph
                color="#a8915f"
                className={styles.heartFoil}
                style={{ height: U(fs * 0.632), marginRight: '0.28em' }}
              />
              {t.bride}
            </p>
          ) : null}
          {d ? (
            <>
              <p
                className={`${styles.line} ${styles.foil}`}
                style={{
                  marginTop: U(30),
                  fontWeight: 500,
                  fontSize: U(22),
                  letterSpacing: '0.12em',
                }}
              >
                {d.year}. {d.month2}. {d.day2}
              </p>
              <p
                className={`${styles.line} ${styles.foil}`}
                style={{
                  marginTop: U(6),
                  fontWeight: 500,
                  fontSize: U(12),
                  letterSpacing: '0.22em',
                }}
              >
                {d.weekday} · {d.time}
              </p>
            </>
          ) : null}
          {t.venue ? (
            <p
              className={`${styles.line} ${styles.foil} ${styles.nowrap}`}
              style={{
                marginTop: U(30),
                fontWeight: 500,
                fontSize: U(venueSize),
                letterSpacing: '0.08em',
              }}
            >
              {t.venue}
            </p>
          ) : null}
          {t.address ? (
            <p
              className={`${styles.line} ${styles.foil} ${styles.nowrap}`}
              style={{
                marginTop: t.venue ? U(6) : U(30),
                fontWeight: 500,
                fontSize: U(addrSize),
                letterSpacing: '0.18em',
              }}
            >
              {t.address}
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
}

// ───────── 3안: 종이색 이중 테두리 음각 · 필기체 이니셜 ─────────
function Deboss({ id, depth, blur }: { id: string; depth: number; blur: number }) {
  return (
    <filter
      id={id}
      x="-8%"
      y="-8%"
      width="116%"
      height="116%"
      colorInterpolationFilters="sRGB"
    >
      <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="b" />
      <feDiffuseLighting
        in="b"
        surfaceScale={-depth}
        diffuseConstant="1.2"
        lightingColor="#ffffff"
        result="d"
      >
        <feDistantLight azimuth="225" elevation="56" />
      </feDiffuseLighting>
      <feBlend in="SourceGraphic" in2="d" mode="multiply" result="m" />
      <feComposite in="m" in2="SourceAlpha" operator="in" result="face" />
      <feOffset in="SourceAlpha" dx="1.3" dy="1.7" result="sa" />
      <feComposite in="SourceAlpha" in2="sa" operator="out" result="ie" />
      <feGaussianBlur in="ie" stdDeviation="1.1" result="ieb" />
      <feComposite in="ieb" in2="SourceAlpha" operator="in" result="iec" />
      <feFlood floodColor="#4a3c2c" floodOpacity="0.26" />
      <feComposite in2="iec" operator="in" result="inner" />
      <feOffset in="SourceAlpha" dx="0.8" dy="1.1" result="ro" />
      <feComposite in="ro" in2="SourceAlpha" operator="out" result="rim" />
      <feGaussianBlur in="rim" stdDeviation="0.45" result="rimb" />
      <feFlood floodColor="#ffffff" floodOpacity="0.95" />
      <feComposite in2="rimb" operator="in" result="rimw" />
      <feMerge>
        <feMergeNode in="rimw" />
        <feMergeNode in="face" />
        <feMergeNode in="inner" />
      </feMerge>
    </filter>
  )
}

function C({ t }: { t: CoverTemplateText }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const fFrame = `dbf${uid}`
  const fLetter = `dbl${uid}`
  const d = t.date
  const fs = fitSize(t.groom.length > t.bride.length ? t.groom : t.bride, 300, 42, 0.78, 18)
  return (
    <div className={styles.stage}>
      <svg
        aria-hidden="true"
        className={styles.deboss}
        viewBox="0 0 390 844"
        // 글자마다 따로 필터를 걸어야 겹친 윤곽선이 보인다
      >
        <defs>
          <Deboss id={fFrame} depth={1.2} blur={0.8} />
          <Deboss id={fLetter} depth={1.8} blur={1.3} />
        </defs>
        <g filter={`url(#${fFrame})`} fill="none" stroke="#e9e5dd" strokeWidth="3">
          <rect x="22" y="22" width="346" height="800" rx="2" />
        </g>
        <g filter={`url(#${fFrame})`} fill="none" stroke="#e9e5dd" strokeWidth="1.6">
          <rect x="32" y="32" width="326" height="780" rx="1" />
        </g>
        {t.hasNames ? (
          <>
            <text
              x="58"
              y="214"
              filter={`url(#${fLetter})`}
              fill="#e9e5dd"
              style={{ fontFamily: "'Cover Pinyon', cursive", fontSize: 190 }}
            >
              {t.initialG}
            </text>
            <text
              x="196"
              y="700"
              filter={`url(#${fLetter})`}
              fill="#e9e5dd"
              style={{ fontFamily: "'Cover Pinyon', cursive", fontSize: 190 }}
            >
              {t.initialB}
            </text>
          </>
        ) : null}
      </svg>
      <div className={styles.abs} style={{ left: 0, right: 0, top: U(262), textAlign: 'center' }}>
        <div
          className={styles.ink}
          style={{ fontWeight: 600, fontSize: U(10), letterSpacing: '0.36em' }}
        >
          THE WEDDING OF
        </div>
        {t.hasNames ? (
          <>
            <div
              className={`${styles.ink} ${styles.bodoni} ${styles.nowrap}`}
              style={{
                marginTop: U(22),
                fontSize: U(fs),
                lineHeight: 0.98,
                letterSpacing: '-0.01em',
              }}
            >
              {t.groom}
            </div>
            <div style={{ margin: `${U(14)} 0 ${U(12)}` }}>
              <HeartGlyph
                color="#35291f"
                className={styles.heartInk}
                style={{
                  height: U(20),
                  margin: '0 auto',
                  filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.75))',
                }}
              />
            </div>
            <div
              className={`${styles.ink} ${styles.bodoni} ${styles.nowrap}`}
              style={{ fontSize: U(fs), lineHeight: 0.98, letterSpacing: '-0.01em' }}
            >
              {t.bride}
            </div>
          </>
        ) : null}
        {d ? (
          <>
            <div
              className={`${styles.ink} ${styles.pinyon}`}
              style={{ marginTop: U(26), fontSize: U(34), lineHeight: 1.1 }}
            >
              {d.monthLong} {d.day} {d.weekdayTitle}
            </div>
            <div
              className={styles.ink}
              style={{ marginTop: U(14), fontWeight: 600, fontSize: U(10), letterSpacing: '0.32em' }}
            >
              {d.year} · {d.time}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ───────── 크리스마스 금박 표지 (글자만): MERRY / CHRISTMAS · 큰 음각 날짜 · 한글 제목 · with love · 음각 별 9개(3개는 금박) ─────────
/** 4갈래 별(✦) 경로 — 반지름 1 기준 */
const STAR = 'M0 -1C.12 -.35 .35 -.12 1 0C.35 .12 .12 .35 0 1C-.12 .35 -.35 .12 -1 0C-.35 -.12 -.12 -.35 0 -1Z'
/** x · y · 반지름(디자인 px) · 금박 여부. 글자 줄을 피해 가장자리에 흩뿌림 */
const STARS: readonly [number, number, number, boolean][] = [
  [64, 146, 9, false],
  [330, 112, 6, true],
  [196, 70, 5, false],
  [38, 468, 6, false],
  [352, 512, 10, true],
  [92, 742, 8, false],
  [304, 700, 6, false],
  [200, 790, 5, true],
  [350, 330, 5, false],
]

function X({ t }: { t: CoverTemplateText }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const fBig = `dbx${uid}`
  const fStar = `dbs${uid}`
  const d = t.date
  const titleSize = fitSize(t.title, 520, 26, 1.0, 15)
  const time = d ? d.time.replace(':', ' : ') : ''
  return (
    <div className={styles.stage}>
      <svg aria-hidden="true" className={styles.deboss} viewBox="0 0 390 844">
        <defs>
          <Deboss id={fBig} depth={1.8} blur={1.3} />
          <Deboss id={fStar} depth={1.2} blur={0.8} />
        </defs>
        {STARS.filter(([, , , gold]) => !gold).map(([x, y, r]) => (
          <path
            key={`${x}-${y}`}
            d={STAR}
            transform={`translate(${x} ${y}) scale(${r})`}
            filter={`url(#${fStar})`}
            fill="#e9e5dd"
          />
        ))}
        {STARS.filter(([, , , gold]) => gold).map(([x, y, r]) => (
          <path
            key={`${x}-${y}`}
            d={STAR}
            transform={`translate(${x} ${y}) scale(${r})`}
            fill="#a8915f"
            style={{ filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.9)) drop-shadow(0 -1px 0 rgba(90,68,30,0.28))' }}
          />
        ))}
        {d ? (
          <text
            x="195"
            y="418"
            textAnchor="middle"
            filter={`url(#${fBig})`}
            fill="#e9e5dd"
            style={{ fontFamily: "'Cover Bodoni', serif", fontSize: 150 }}
          >
            {d.day2}
          </text>
        ) : (
          <text
            x="195"
            y="388"
            textAnchor="middle"
            filter={`url(#${fBig})`}
            fill="#e9e5dd"
            style={{ fontFamily: "'Cover Bodoni', serif", fontSize: 46, letterSpacing: 3 }}
          >
            DECEMBER
          </text>
        )}
      </svg>
      <div className={styles.abs} style={{ left: 0, right: 0, top: U(176), textAlign: 'center' }}>
        <p
          className={`${styles.line} ${styles.foil}`}
          style={{ fontWeight: 500, fontSize: U(26), letterSpacing: '0.34em', paddingLeft: '0.34em' }}
        >
          MERRY
        </p>
        <p
          className={`${styles.line} ${styles.foil}`}
          style={{
            marginTop: U(6),
            fontWeight: 500,
            fontSize: U(38),
            letterSpacing: '0.16em',
            paddingLeft: '0.16em',
          }}
        >
          CHRISTMAS
        </p>
      </div>
      {d ? (
        <div
          className={`${styles.abs} ${styles.ink}`}
          style={{
            left: 0,
            right: 0,
            top: U(452),
            textAlign: 'center',
            fontWeight: 600,
            fontSize: U(12),
            letterSpacing: '0.34em',
            paddingLeft: '0.34em',
          }}
        >
          {d.monthShort} · {d.weekday}
        </div>
      ) : null}
      <div className={styles.abs} style={{ left: U(45), right: U(45), top: U(d ? 510 : 450), textAlign: 'center' }}>
        {t.title ? (
          <p
            className={`${styles.line} ${styles.ink} ${styles.ko}`}
            style={{ fontSize: U(titleSize), lineHeight: 1.45, wordBreak: 'keep-all' }}
          >
            {t.title}
          </p>
        ) : null}
        <p
          className={`${styles.line} ${styles.ink} ${styles.pinyon}`}
          style={{ marginTop: U(t.title ? 22 : 0), fontSize: U(34), lineHeight: 1.1 }}
        >
          with love
        </p>
        {d ? (
          <p
            className={`${styles.line} ${styles.ink}`}
            style={{
              marginTop: U(18),
              fontWeight: 600,
              fontSize: U(11),
              letterSpacing: '0.34em',
              paddingLeft: '0.34em',
            }}
          >
            {time}
          </p>
        ) : null}
      </div>
    </div>
  )
}
