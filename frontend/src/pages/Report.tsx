import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useMonth } from '@/hooks/useMonth'
import { fetchStores } from '@/utils/api'
import type { Store } from '@/utils/api'
import type { ReportType } from '@/components/common/ExportDropdown'
import ReportSummary from './reports/ReportSummary'
import ReportInstagram from './reports/ReportInstagram'
import ReportLine from './reports/ReportLine'
import ReportGA4 from './reports/ReportGA4'
import ReportGBP from './reports/ReportGBP'

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  summary: '全体サマリー',
  instagram: 'Instagram 詳細',
  line: 'LINE 詳細',
  ga4: 'GA4 詳細',
  gbp: 'GBP 詳細',
}

export default function Report() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { selectedMonth } = useMonth()
  const reportRef = useRef<HTMLDivElement>(null)
  const [isPdf, setIsPdf] = useState(false)
  const [stores, setStores] = useState<Store[]>([])

  useEffect(() => {
    fetchStores().then(setStores).catch(() => setStores([]))
  }, [])

  const storeNames = stores.map((s) => s.name)

  const reportType = (searchParams.get('type') || 'summary') as ReportType
  const storeParam = parseInt(searchParams.get('store') || '0', 10)
  // storeParam is treated as an index into the stores array
  const selectedStore = stores.length > 0 ? Math.min(storeParam, stores.length - 1) : 0
  const selectedStoreId = stores.length > 0 ? stores[selectedStore].id : 0

  const updateParams = (type: ReportType, store: number) => {
    setSearchParams({ type, store: String(store) }, { replace: true })
  }

  const handleExport = () => {
    setIsPdf(true)
    // isPdf適用後のレンダリングを待ってからprint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = reportRef.current
        if (!el) return

        // isPdf再レンダリング後のコンテンツ高さを計測
        const contentHeight = el.scrollHeight
        const a4Height = 793 // 210mm @96dpi
        // 常にzoomで1ページに収める（フッター溢れ防止）
        if (contentHeight > a4Height * 0.95) {
          el.style.zoom = String((a4Height * 0.95) / contentHeight)
        }

        const originalTitle = document.title
        const now = new Date()
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
        const typeLabel = REPORT_TYPE_LABELS[reportType].replace(/\s/g, '')
        document.title = `${typeLabel}_${storeNames[selectedStore] ?? ''}_${dateStr}`
        window.print()
        document.title = originalTitle
        el.style.zoom = ''
        setIsPdf(false)
      })
    })
  }

  const today = new Date()
  const generatedDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`

  const reportProps = {
    selectedMonth,
    storeIndex: selectedStore,
    storeId: selectedStoreId,
    storeName: storeNames[selectedStore] ?? '',
    generatedDate,
    storeNames,
    isPdf,
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Controls */}
      <div className="mx-auto max-w-[1200px] mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-sm text-gray-600 shadow-sm hover:bg-gray-50"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            戻る
          </button>
          <select
            value={reportType}
            onChange={(e) => updateParams(e.target.value as ReportType, selectedStore)}
            className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm border border-gray-200"
          >
            {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={selectedStore}
            onChange={(e) => updateParams(reportType, Number(e.target.value))}
            className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm border border-gray-200"
          >
            {storeNames.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          PDF出力
        </button>
      </div>

      {/* Report Content - A4 Landscape */}
      <div
        ref={reportRef}
        className="report-content mx-auto bg-white shadow-xl flex flex-col"
        style={{ width: 1122, minHeight: 793, padding: 32, position: 'relative', fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {reportType === 'summary' && <ReportSummary {...reportProps} />}
        {reportType === 'instagram' && <ReportInstagram {...reportProps} />}
        {reportType === 'line' && <ReportLine {...reportProps} />}
        {reportType === 'ga4' && <ReportGA4 {...reportProps} />}
        {reportType === 'gbp' && <ReportGBP {...reportProps} />}
      </div>
    </div>
  )
}
