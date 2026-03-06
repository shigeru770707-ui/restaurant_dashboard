import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMonth } from '@/hooks/useMonth'
import { exportToPDF } from '@/utils/pdfExport'
import type { ReportType } from '@/components/common/ExportDropdown'
import ReportSummary from './reports/ReportSummary'
import ReportInstagram from './reports/ReportInstagram'
import ReportLine from './reports/ReportLine'
import ReportGA4 from './reports/ReportGA4'
import ReportGBP from './reports/ReportGBP'

const STORE_NAMES = ['渋谷店', '表参道店', '新宿店']

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  summary: '全体サマリー',
  instagram: 'Instagram 詳細',
  line: 'LINE 詳細',
  ga4: 'GA4 詳細',
  gbp: 'GBP 詳細',
}

export default function Report() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedMonth } = useMonth()
  const reportRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)

  const reportType = (searchParams.get('type') || 'summary') as ReportType
  const selectedStore = Math.min(
    parseInt(searchParams.get('store') || '0', 10),
    STORE_NAMES.length - 1,
  )

  const updateParams = (type: ReportType, store: number) => {
    setSearchParams({ type, store: String(store) })
  }

  const handleExport = async () => {
    if (!reportRef.current) return
    setExporting(true)
    try {
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const typeLabel = REPORT_TYPE_LABELS[reportType].replace(/\s/g, '')
      await exportToPDF(reportRef.current, `${typeLabel}_${STORE_NAMES[selectedStore]}_${dateStr}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const today = new Date()
  const generatedDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`

  const reportProps = {
    selectedMonth,
    storeIndex: selectedStore,
    storeName: STORE_NAMES[selectedStore],
    generatedDate,
    storeNames: STORE_NAMES,
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Controls */}
      <div className="mx-auto max-w-[1200px] mb-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
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
            {STORE_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
          {exporting ? 'PDF生成中...' : 'PDF出力'}
        </button>
      </div>

      {/* Report Content - A4 Landscape */}
      <div
        ref={reportRef}
        className="mx-auto bg-white shadow-xl"
        style={{ width: 1122, minHeight: 793, padding: 32, fontFamily: 'system-ui, -apple-system, sans-serif' }}
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
