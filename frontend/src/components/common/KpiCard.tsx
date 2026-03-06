import TrendBadge from './TrendBadge'
import { formatNumber, formatPercent } from '@/utils/format'

interface KpiCardProps {
  title: string
  value: number | string
  unit?: string
  previousValue?: number
  color?: string
  isLoading?: boolean
}

export default function KpiCard({
  title,
  value,
  unit,
  previousValue,
  color = '#6366f1',
  isLoading = false,
}: KpiCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0

  const formattedValue = typeof value === 'string'
    ? value
    : unit === '%'
      ? formatPercent(value)
      : formatNumber(value)

  const showAlert = previousValue != null && previousValue > 0
    ? Math.abs(((numericValue - previousValue) / previousValue) * 100) > 20
    : false

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="h-3.5 w-20 animate-pulse rounded bg-muted mb-3" />
        <div className="h-9 w-28 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-card p-3 sm:p-4 md:p-6 transition-transform transition-shadow duration-200 active:scale-[0.98] md:hover:-translate-y-0.5 md:hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${
        showAlert
          ? 'ring-2 ring-amber-400/50 border-amber-300 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_0_0_1px_rgba(251,191,36,0.1)]'
          : 'border-border shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]'
      }`}
    >
      {/* Top color accent bar */}
      <div
        className="absolute top-0 left-0 h-[3px] w-full transition-all duration-200 group-hover:h-[4px]"
        style={{ background: color }}
      />

      {/* Alert pulse indicator */}
      {showAlert && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
      )}

      {/* Title */}
      <p className="truncate text-[11px] md:text-[13px] font-medium tracking-wide text-muted-foreground uppercase mb-1 sm:mb-2" title={title}>
        {title}
      </p>

      {/* Main value */}
      <p className="text-2xl md:text-[34px] font-extrabold text-foreground leading-tight tracking-tight">
        {formattedValue}
        {unit && unit !== '%' && (
          <span className="ml-1.5 text-base font-medium text-muted-foreground">{unit}</span>
        )}
      </p>

      {/* Trend badge */}
      {previousValue != null && previousValue > 0 && (
        <div className="mt-2 sm:mt-3 flex items-center gap-1.5">
          <TrendBadge currentValue={numericValue} previousValue={previousValue} />
          <span className="hidden sm:inline text-xs text-muted-foreground">vs 前月</span>
        </div>
      )}
    </div>
  )
}
