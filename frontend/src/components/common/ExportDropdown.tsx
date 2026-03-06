import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export type ReportType = 'summary' | 'instagram' | 'line' | 'ga4' | 'gbp'

const REPORT_LABELS: Record<ReportType, string> = {
  summary: '全体サマリー',
  instagram: 'Instagram',
  line: 'LINE',
  ga4: 'GA4',
  gbp: 'GBP',
}

const STORE_NAMES = ['渋谷店', '表参道店', '新宿店']

interface ExportDropdownProps {
  currentType: ReportType
  storeIndex?: number
}

export default function ExportDropdown({ currentType, storeIndex = 0 }: ExportDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const goToReport = (type: ReportType, store?: number) => {
    const params = new URLSearchParams()
    params.set('type', type)
    params.set('store', String(store ?? storeIndex))
    navigate(`/report?${params.toString()}`)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <button
          onClick={() => goToReport(currentType)}
          className="flex items-center gap-1.5 rounded-l-lg border border-border bg-card px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          <span className="hidden md:inline">レポート出力</span>
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center rounded-r-lg border border-l-0 border-border bg-card px-1.5 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span className="material-symbols-outlined text-[16px]">
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-150">
          {/* Current page report */}
          <button
            onClick={() => goToReport(currentType)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            <span className="material-symbols-outlined text-[16px] text-muted-foreground">description</span>
            {REPORT_LABELS[currentType]}レポート
          </button>

          {/* Summary report (if not already on summary) */}
          {currentType !== 'summary' && (
            <button
              onClick={() => goToReport('summary')}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <span className="material-symbols-outlined text-[16px] text-muted-foreground">summarize</span>
              全体サマリーレポート
            </button>
          )}

          <div className="my-1 border-t border-border" />

          {/* Store selector */}
          <div className="px-3 py-1.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              店舗を選択
            </p>
            <div className="space-y-0.5">
              {STORE_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => goToReport(currentType, i)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
                    i === storeIndex ? 'font-medium text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {i === storeIndex ? 'radio_button_checked' : 'radio_button_unchecked'}
                  </span>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="my-1 border-t border-border" />

          {/* All report types */}
          <div className="px-3 py-1.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              他のレポート
            </p>
            {(Object.keys(REPORT_LABELS) as ReportType[])
              .filter((t) => t !== currentType)
              .map((type) => (
                <button
                  key={type}
                  onClick={() => goToReport(type)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span className="material-symbols-outlined text-[14px]">article</span>
                  {REPORT_LABELS[type]}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
