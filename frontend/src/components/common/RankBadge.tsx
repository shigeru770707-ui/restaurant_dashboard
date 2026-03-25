interface RankBadgeProps {
  rank: number
  size?: 'sm' | 'md' | 'lg'
  accentColor?: string
}

const MEDAL_STYLES: Record<number, { bg: string; text: string; shadow: string }> = {
  1: { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', text: '#78350f', shadow: '0 2px 8px rgba(255,215,0,0.4)' },
  2: { bg: 'linear-gradient(135deg, #C0C0C0, #A0A0A0)', text: '#374151', shadow: '0 2px 8px rgba(192,192,192,0.3)' },
  3: { bg: 'linear-gradient(135deg, #CD7F32, #A0522D)', text: '#fff', shadow: '0 2px 8px rgba(205,127,50,0.3)' },
}

const SIZE_MAP = {
  sm: 'size-6 text-[10px]',
  md: 'size-7 text-xs',
  lg: 'size-9 text-sm',
}

export default function RankBadge({ rank, size = 'md', accentColor = '#E1306C' }: RankBadgeProps) {
  const medal = MEDAL_STYLES[rank]
  const sizeClass = SIZE_MAP[size]

  if (medal) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizeClass}`}
        style={{
          background: medal.bg,
          color: medal.text,
          boxShadow: medal.shadow,
        }}
      >
        {rank}
      </div>
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizeClass}`}
      style={{
        background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
        color: accentColor,
        border: `1px solid color-mix(in srgb, ${accentColor} 25%, transparent)`,
      }}
    >
      {rank}
    </div>
  )
}
