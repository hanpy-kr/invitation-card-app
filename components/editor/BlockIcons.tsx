/** 블록 줄 도구 아이콘: 가는 선 (stroke 1.4). 눌림 영역 44px은 버튼 쪽 CSS가 맡음 */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

export const IconGrip = () => (
  <svg {...base} strokeWidth={0} fill="currentColor">
    <circle cx="9.5" cy="6.5" r="1.3" />
    <circle cx="14.5" cy="6.5" r="1.3" />
    <circle cx="9.5" cy="12" r="1.3" />
    <circle cx="14.5" cy="12" r="1.3" />
    <circle cx="9.5" cy="17.5" r="1.3" />
    <circle cx="14.5" cy="17.5" r="1.3" />
  </svg>
)
export const IconUp = () => (
  <svg {...base}>
    <path d="M6.5 14.5L12 9l5.5 5.500" />
  </svg>
)
export const IconDown = () => (
  <svg {...base}>
    <path d="M6.5 9.5L12 15l5.500-5.500" />
  </svg>
)
export const IconEye = () => (
  <svg {...base}>
    <path d="M3 12s3.500-6 9-6 9 6 9 6-3.500 6-9 6-9-6-9-6z" />
    <circle cx="12" cy="12" r="2.500" />
  </svg>
)
export const IconEyeOff = () => (
  <svg {...base}>
    <path d="M3 12s3.500-6 9-6c1.500 0 2.800.4 4 1M21 12s-3.500 6-9 6c-1.500 0-2.800-.4-4-1" />
    <path d="M4 4l16 16" />
  </svg>
)
export const IconClose = () => (
  <svg {...base}>
    <path d="M6.500 6.500l11 11M17.500 6.500l-11 11" />
  </svg>
)
export const IconHelp = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8.500" />
    <path d="M9.800 9.600a2.300 2.300 0 014.400.800c0 1.500-2.200 1.800-2.200 3.200M12 16.500v.2" />
  </svg>
)
export const IconBack = () => (
  <svg {...base}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
