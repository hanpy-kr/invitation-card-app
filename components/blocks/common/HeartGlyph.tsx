/** ♥ 글리프 모양(Noto Sans Symbols 2 외곽선). 이모지 하트는 쓰지 않는다. size는 높이 */
const PATH =
  'M346 0Q322 59 285.5 122.0Q249 185 199 252Q100 384 75 447Q51 507 51 559Q51 603 73.5 639.5Q96 676 133.5 697.5Q171 719 215 719Q262 719 302.5 695.0Q343 671 369 622Q396 671 437.0 695.0Q478 719 525 719Q568 719 605.5 697.5Q643 676 666.0 639.5Q689 603 689 559Q689 505 663 441Q637 378 539 249Q490 184 453.5 121.5Q417 59 393 0Z'

export default function HeartGlyph({
  color,
  className,
  style,
}: {
  color: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="51 0 638 719"
      className={className}
      style={{ aspectRatio: '638 / 719', ...style }}
    >
      <g transform="translate(0 719) scale(1 -1)">
        <path d={PATH} fill={color} />
      </g>
    </svg>
  )
}
