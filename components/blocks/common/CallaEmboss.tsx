/**
 * 표지 맨 위 칼라 꽃다발(리본 없음). 종이가 도드라진 엠보싱으로 보이게 SVG 조명 필터를 쓴다.
 * 꽃 5송이 + 잎 2장 + 아래로 모이는 줄기. 필터 id는 표지가 페이지에 하나뿐이라 고정.
 */
export default function CallaEmboss({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 300" aria-hidden="true" focusable="false">
      <defs>
        <filter
          id="dd-calla"
          x="-15%"
          y="-10%"
          width="130%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.3" result="b" />
          <feDiffuseLighting
            in="b"
            surfaceScale="1.7"
            diffuseConstant="1.2"
            lightingColor="#ffffff"
            result="d"
          >
            <feDistantLight azimuth="225" elevation="58" />
          </feDiffuseLighting>
          <feComposite in="d" in2="SourceAlpha" operator="in" result="di" />
          <feBlend in="SourceGraphic" in2="di" mode="multiply" result="m" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="sh" />
          <feOffset in="sh" dx="1" dy="1.6" result="sho" />
          <feFlood floodColor="#5a4a38" floodOpacity="0.13" />
          <feComposite in2="sho" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="m" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#dd-calla)" fill="#fbfaf7">
        <path d="M64.3 137.8 C64.3 183.8 71.5 200 71.5 298 L74.5 298 C74.5 200 67.3 183.8 67.3 137.8 Z" />
        <path d="M68.7 102.1 C68.7 148.1 75.5 200 75.5 298 L78.5 298 C78.5 200 71.7 148.1 71.7 102.1 Z" />
        <path d="M88.6 88.7 C88.6 134.7 79.5 200 79.5 298 L82.5 298 C82.5 200 91.6 134.7 91.6 88.7 Z" />
        <path d="M95.9 148.9 C95.9 194.9 83.5 200 83.5 298 L86.5 298 C86.5 200 98.9 194.9 98.9 148.9 Z" />
        <path d="M106.1 111.3 C106.1 157.3 87.5 200 87.5 298 L90.5 298 C90.5 200 109.1 157.3 109.1 111.3 Z" />
        <path d="M76 214 C58 206 46 190 44 168 C56 178 68 194 79 210 Z" />
        <path d="M86 200 C102 190 112 172 116 150 C104 160 94 176 84 196 Z" />
        <path
          transform="translate(56 64) rotate(-14) scale(1.05)"
          d="M-14 0 C-12 -10 2 -14 12 -12 C16 -11 21 -13 24 -18 C24 -9 19 -2 12 2 C10 14 7 28 3 44 C2 47 -1 47 -2 44 C-4 28 -8 14 -14 0 Z"
        />
        <path
          transform="translate(92 44) rotate(6) scale(1.15)"
          d="M-14 0 C-12 -10 2 -14 12 -12 C16 -11 21 -13 24 -18 C24 -9 19 -2 12 2 C10 14 7 28 3 44 C2 47 -1 47 -2 44 C-4 28 -8 14 -14 0 Z"
        />
        <path
          transform="translate(122 78) rotate(24) scale(0.95)"
          d="M-14 0 C-12 -10 2 -14 12 -12 C16 -11 21 -13 24 -18 C24 -9 19 -2 12 2 C10 14 7 28 3 44 C2 47 -1 47 -2 44 C-4 28 -8 14 -14 0 Z"
        />
        <path
          transform="translate(46 112) rotate(-28) scale(0.85)"
          d="M-14 0 C-12 -10 2 -14 12 -12 C16 -11 21 -13 24 -18 C24 -9 19 -2 12 2 C10 14 7 28 3 44 C2 47 -1 47 -2 44 C-4 28 -8 14 -14 0 Z"
        />
        <path
          transform="translate(104 118) rotate(14) scale(0.85)"
          d="M-14 0 C-12 -10 2 -14 12 -12 C16 -11 21 -13 24 -18 C24 -9 19 -2 12 2 C10 14 7 28 3 44 C2 47 -1 47 -2 44 C-4 28 -8 14 -14 0 Z"
        />
      </g>
      <g fill="#000" fillOpacity="0.045">
        <path
          transform="translate(56 64) rotate(-14) scale(1.05)"
          d="M-11 -1 C-7 -8 4 -10 11 -7 C6 -1 -3 2 -11 -1 Z"
        />
        <path
          transform="translate(92 44) rotate(6) scale(1.15)"
          d="M-11 -1 C-7 -8 4 -10 11 -7 C6 -1 -3 2 -11 -1 Z"
        />
        <path
          transform="translate(122 78) rotate(24) scale(0.95)"
          d="M-11 -1 C-7 -8 4 -10 11 -7 C6 -1 -3 2 -11 -1 Z"
        />
        <path
          transform="translate(46 112) rotate(-28) scale(0.85)"
          d="M-11 -1 C-7 -8 4 -10 11 -7 C6 -1 -3 2 -11 -1 Z"
        />
        <path
          transform="translate(104 118) rotate(14) scale(0.85)"
          d="M-11 -1 C-7 -8 4 -10 11 -7 C6 -1 -3 2 -11 -1 Z"
        />
      </g>
      <g fill="none" stroke="#5a4a38" strokeOpacity="0.16" strokeWidth="1.1" strokeLinecap="round">
        <path transform="translate(56 64) rotate(-14) scale(1.05)" d="M0 -2 C0 4 1 12 1.5 18" />
        <path transform="translate(92 44) rotate(6) scale(1.15)" d="M0 -2 C0 4 1 12 1.5 18" />
        <path transform="translate(122 78) rotate(24) scale(0.95)" d="M0 -2 C0 4 1 12 1.5 18" />
        <path transform="translate(46 112) rotate(-28) scale(0.85)" d="M0 -2 C0 4 1 12 1.5 18" />
        <path transform="translate(104 118) rotate(14) scale(0.85)" d="M0 -2 C0 4 1 12 1.5 18" />
      </g>
    </svg>
  )
}
