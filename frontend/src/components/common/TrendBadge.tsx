interface TrendBadgeProps {
  currentValue: number
  previousValue: number
}

export default function TrendBadge({ currentValue, previousValue }: TrendBadgeProps) {
  if (!previousValue) return null

  const change = ((currentValue - previousValue) / previousValue) * 100
  const absChange = Math.abs(change)

  let containerClass: string
  let arrowIcon: React.ReactNode

  if (absChange <= 5) {
    containerClass = 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]'
    arrowIcon = (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
        <path d="M3 7h8M8.5 4.5L11 7l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  } else if (change > 0) {
    containerClass = 'bg-[var(--color-success-bg)] text-[var(--color-success)] font-semibold'
    arrowIcon = (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
        <path d="M7 11V3m0 0L3.5 6.5M7 3l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  } else {
    containerClass = 'bg-[var(--color-danger-bg)] text-[var(--color-danger)] font-semibold'
    arrowIcon = (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
        <path d="M7 3v8m0 0l3.5-3.5M7 11L3.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 md:px-2.5 md:py-1 text-[11px] md:text-[13px] leading-none ${containerClass}`}>
      {arrowIcon}
      {absChange.toFixed(1)}%
    </span>
  )
}
