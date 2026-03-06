import { useState, useRef, useEffect } from 'react'
import { usePeriod, type PeriodType } from '@/hooks/usePeriod'

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${y}年${parseInt(m)}月`
}

function formatDateShort(date: string): string {
  const [, m, d] = date.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function getMonthStart(month: string): string {
  return `${month}-01`
}

function getDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function getMonthsAgo(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPrevMonth(): string {
  return shiftMonth(getCurrentMonth(), -1)
}

interface Preset {
  label: string
  action: () => void
}

export default function PeriodPicker() {
  const {
    periodType,
    setPeriodType,
    selectedMonth,
    setSelectedMonth,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
  } = usePeriod()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const triggerLabel =
    periodType === 'month'
      ? formatMonthLabel(selectedMonth)
      : `${formatDateShort(startDate)} 〜 ${formatDateShort(endDate)}`

  const presets: Preset[] = [
    {
      label: '今月',
      action: () => {
        setPeriodType('month')
        setSelectedMonth(getCurrentMonth())
        setOpen(false)
      },
    },
    {
      label: '先月',
      action: () => {
        setPeriodType('month')
        setSelectedMonth(getPrevMonth())
        setOpen(false)
      },
    },
    {
      label: '過去7日',
      action: () => {
        setPeriodType('dateRange')
        setStartDate(getDaysAgo(7))
        setEndDate(getToday())
        setOpen(false)
      },
    },
    {
      label: '過去30日',
      action: () => {
        setPeriodType('dateRange')
        setStartDate(getDaysAgo(30))
        setEndDate(getToday())
        setOpen(false)
      },
    },
    {
      label: '過去3ヶ月',
      action: () => {
        setPeriodType('dateRange')
        setStartDate(getMonthsAgo(3))
        setEndDate(getToday())
        setOpen(false)
      },
    },
  ]

  const switchMode = (mode: PeriodType) => {
    setPeriodType(mode)
    if (mode === 'dateRange') {
      // Initialize date range from current month
      setStartDate(getMonthStart(selectedMonth))
      const [y, m] = selectedMonth.split('-').map(Number)
      const lastDay = new Date(y, m, 0).getDate()
      setEndDate(`${selectedMonth}-${String(lastDay).padStart(2, '0')}`)
    }
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-sm text-foreground transition-colors hover:bg-muted min-h-[44px] md:min-h-0"
      >
        <span className="material-symbols-outlined text-[16px] md:text-[18px] text-muted-foreground">
          calendar_today
        </span>
        <span className="whitespace-nowrap">{triggerLabel}</span>
        <span className="material-symbols-outlined text-[16px] text-muted-foreground">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[280px] rounded-xl border border-border bg-card p-4 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Mode toggle */}
          <div className="flex rounded-lg bg-muted p-0.5 mb-4">
            <button
              onClick={() => switchMode('month')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                periodType === 'month'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              月指定
            </button>
            <button
              onClick={() => switchMode('dateRange')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                periodType === 'dateRange'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              期間指定
            </button>
          </div>

          {/* Month picker */}
          {periodType === 'month' && (
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="text-sm font-semibold text-foreground">
                {formatMonthLabel(selectedMonth)}
              </span>
              <button
                onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          )}

          {/* Date range picker */}
          {periodType === 'dateRange' && (
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  開始日
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  終了日
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border mb-3" />

          {/* Presets */}
          <div>
            <p className="text-[11px] font-medium text-muted-foreground mb-2">クイック選択</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={preset.action}
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
