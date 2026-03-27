import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatNumber, formatPercent } from '@/utils/format'
import type { ReportProps } from './ReportSummary'

const GBP_RED = '#EA4335'
const RATING_COLORS: Record<number, string> = { 5: '#34A853', 4: '#4285F4', 3: '#F9AB00', 2: '#EA4335', 1: '#D93025' }

function StarText({ rating }: { rating: number }) {
  return <span style={{ color: '#F9AB00' }}>{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span>
}

export default function ReportGBP({ selectedMonth, storeIndex, storeName, generatedDate, storeNames, isPdf }: ReportProps) {
  const { data: allData } = useDashboardData(selectedMonth, storeIndex)
  const data = allData.gbp
  const current = data.current
  const previous = data.previous
  const trend = data.trend
  const reviews = data.reviews
  const ratingDistribution = data.ratingDistribution

  const totalViews = current.views_maps + current.views_search
  const prevTotalViews = previous.views_maps + previous.views_search
  const totalActions = current.actions_website + current.actions_phone + current.actions_directions
  const prevTotalActions = previous.actions_website + previous.actions_phone + previous.actions_directions
  const convRate = totalViews > 0 ? (totalActions / totalViews) * 100 : 0
  const prevConvRate = prevTotalViews > 0 ? (prevTotalActions / prevTotalViews) * 100 : 0

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const totalRatings = ratingDistribution.reduce((s, r) => s + r.count, 0)
  // Reply rate: not available from current API - show as unavailable
  const replyRate: number | null = null

  const ratingChartData = ratingDistribution.slice().sort((a, b) => b.rating - a.rating).map((r) => ({
    name: `${r.rating}★`, count: r.count, rating: r.rating,
  }))

  const trendData = trend.map((item) => ({
    month: item.date.slice(5),
    maps: item.views_maps,
    search: item.views_search,
    phone: item.actions_phone,
    directions: item.actions_directions,
    website: item.actions_website,
  }))

  const impressionData = [
    { name: 'Google Maps', value: current.views_maps, color: '#4285F4' },
    { name: 'Google検索', value: current.views_search, color: '#EA4335' },
  ]

  // Recent reviews
  const topReviews = reviews.slice(0, isPdf ? 2 : 3)

  // Store comparison requires all-store data which is not available from single-store props
  const storeComparison: { name: string; views: number; actions: number; rating: number }[] = []

  const diff = (curr: number, prev: number) => {
    if (!prev) return ''
    const pct = ((curr - prev) / prev) * 100
    return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`
  }
  const diffColor = (curr: number, prev: number) => (!prev ? '#666' : curr >= prev ? '#34A853' : '#EA4335')

  return (
    <>
      {/* Header */}
      <div className={`flex items-center justify-between ${isPdf ? "pb-1.5 mb-1.5" : "pb-3 mb-4"}`} style={{ borderBottom: `2px solid ${GBP_RED}` }}>
        <div>
          <h1 className={`font-bold text-gray-900 ${isPdf ? "text-sm" : "text-xl"}`}>Googleビジネスプロフィール 分析レポート</h1>
          <p className={`text-gray-500 ${isPdf ? "text-[9px] mt-0" : "text-xs mt-0.5"}`}>
            対象期間: {selectedMonth} | 店舗: {storeName} | 生成日: {generatedDate}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-bold ${isPdf ? "text-[10px]" : "text-sm"}`} style={{ color: GBP_RED }}>SNS Analytics</p>
          <p className="text-[8px] text-gray-400">&copy; 2026 GNS inc.</p>
        </div>
      </div>

      {/* KPI Scorecard */}
      <div className={`grid grid-cols-6 ${isPdf ? "gap-1.5 mb-1.5" : "gap-2 mb-4"}`}>
        {[
          { label: '表示回数', value: formatNumber(totalViews), change: diff(totalViews, prevTotalViews), changeColor: diffColor(totalViews, prevTotalViews) },
          { label: 'アクション合計', value: formatNumber(totalActions), change: diff(totalActions, prevTotalActions), changeColor: diffColor(totalActions, prevTotalActions) },
          { label: 'CVR', value: formatPercent(convRate), change: diff(convRate, prevConvRate), changeColor: diffColor(convRate, prevConvRate) },
          { label: '平均評価', value: `${avgRating.toFixed(1)} ★`, change: avgRating >= 4.6 ? '良好' : '要改善', changeColor: avgRating >= 4.6 ? '#34A853' : '#F9AB00' },
          { label: '口コミ返信率', value: replyRate != null ? `${replyRate}%` : '-', change: replyRate != null ? (replyRate >= 73 ? '良好' : `目標73%`) : 'データなし', changeColor: replyRate != null && replyRate >= 73 ? '#34A853' : '#F9AB00' },
          { label: '口コミ件数', value: `${totalRatings}件`, change: '', changeColor: '#666' },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-lg border border-gray-200 text-center ${isPdf ? "p-1.5" : "p-2"}`} style={{ borderTop: `3px solid ${GBP_RED}` }}>
            <p className={`text-gray-500 truncate ${isPdf ? "text-[8px]" : "text-[9px]"}`}>{kpi.label}</p>
            <p className={`font-bold text-gray-900 ${isPdf ? "text-[11px] mt-0" : "text-sm mt-0.5"}`}>{kpi.value}</p>
            {kpi.change && <p className={`font-medium ${isPdf ? "text-[8px] mt-0" : "text-[9px] mt-0.5"}`} style={{ color: kpi.changeColor }}>{kpi.change}</p>}
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className={`grid grid-cols-2 ${isPdf ? "gap-1.5 flex-1" : "gap-4"}`} style={{ fontSize: isPdf ? 10 : 11 }}>
        {/* Left: Actions + Rating */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          {/* Action Breakdown */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-1" : "text-xs mb-2"}`}>アクション内訳</h3>
            <div className={`grid grid-cols-3 ${isPdf ? "gap-1.5" : "gap-2"} text-center`}>
              {[
                { label: 'ウェブサイト', value: current.actions_website, color: '#4285F4', pct: totalActions > 0 ? ((current.actions_website / totalActions) * 100).toFixed(1) : '0' },
                { label: '電話発信', value: current.actions_phone, color: '#34A853', pct: totalActions > 0 ? ((current.actions_phone / totalActions) * 100).toFixed(1) : '0' },
                { label: '経路検索', value: current.actions_directions, color: '#F9AB00', pct: totalActions > 0 ? ((current.actions_directions / totalActions) * 100).toFixed(1) : '0' },
              ].map((a, i) => (
                <div key={i} className={`rounded-lg border border-gray-100 ${isPdf ? "p-1.5" : "p-2"}`}>
                  <p className={`font-bold text-gray-900 ${isPdf ? "text-sm" : "text-lg"}`}>{formatNumber(a.value)}</p>
                  <p className={`text-gray-500 ${isPdf ? "text-[8px]" : "text-[9px]"}`}>{a.label}</p>
                  <p className={`font-medium ${isPdf ? "text-[8px]" : "text-[9px]"}`} style={{ color: a.color }}>{a.pct}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Impression Breakdown */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-1" : "text-xs mb-2"}`}>表示内訳</h3>
            <div className={`grid grid-cols-2 ${isPdf ? "gap-1.5" : "gap-2"}`}>
              <div style={{ height: isPdf ? 85 : 80 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={impressionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={isPdf ? 15 : 20} outerRadius={isPdf ? 28 : 35}
                      label={({ name }) => name} labelLine={false}>
                      {impressionData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center space-y-1">
                <div className="flex items-center gap-1 text-[9px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#4285F4' }} />
                  <span className="text-gray-600">Maps: {formatNumber(current.views_maps)} ({totalViews > 0 ? ((current.views_maps / totalViews) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="flex items-center gap-1 text-[9px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: '#EA4335' }} />
                  <span className="text-gray-600">検索: {formatNumber(current.views_search)} ({totalViews > 0 ? ((current.views_search / totalViews) * 100).toFixed(1) : 0}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rating Distribution */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`}>評価分布</h3>
            <div className={`flex ${isPdf ? "gap-2" : "gap-3"}`}>
              <div className="text-center">
                <p className={`font-bold text-gray-900 ${isPdf ? "text-lg" : "text-2xl"}`}>{avgRating.toFixed(1)}</p>
                <p className={isPdf ? "text-[8px]" : "text-[9px]"}><StarText rating={avgRating} /></p>
                <p className={`text-gray-400 ${isPdf ? "text-[7px]" : "text-[8px]"}`}>{totalRatings}件</p>
              </div>
              <div className="flex-1" style={{ height: isPdf ? 70 : 70 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingChartData} layout="vertical" margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} width={25} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={8}>
                      {ratingChartData.map((entry, i) => (
                        <Cell key={i} fill={RATING_COLORS[entry.rating] || '#999'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Actions Trend (PDF only) */}
          {isPdf && (
          <div className="rounded-lg border border-gray-200 p-2">
            <h3 className="text-[10px] font-bold text-gray-700 mb-0.5">アクション数推移</h3>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: '#666' }} axisLine={false} tickLine={false} />
                  <Legend wrapperStyle={{ fontSize: 7 }} />
                  <Line type="monotone" dataKey="website" name="Web" stroke="#4285F4" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="phone" name="電話" stroke="#EA4335" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="directions" name="経路" stroke="#34A853" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}
        </div>

        {/* Right: Trends + Reviews */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          {/* Search Trend */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`}>表示回数推移（Maps vs 検索）</h3>
            <div style={{ height: isPdf ? 100 : 100 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  {!isPdf && <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} />}
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Line type="monotone" dataKey="maps" name="Maps" stroke="#4285F4" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="search" name="検索" stroke="#EA4335" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Reviews */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`}>最近の口コミ</h3>
            <div className={isPdf ? "space-y-1" : "space-y-1.5"}>
              {topReviews.map((r, i) => (
                <div key={i} className={`rounded border border-gray-100 ${isPdf ? "p-1.5" : "p-2"}`} style={{ borderLeftWidth: 3, borderLeftColor: RATING_COLORS[r.rating] || '#999' }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px]"><StarText rating={r.rating} /> <span className="text-gray-500">{r.author}</span></span>
                    <span className="text-[8px] text-gray-400">{r.date}</span>
                  </div>
                  <p className="text-[9px] text-gray-700 line-clamp-2">{r.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Store Comparison */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`}>店舗間比較</h3>
            {storeComparison.length > 0 ? (
              <table className={`w-full ${isPdf ? "text-[8px]" : "text-[9px]"}`}>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={`text-left font-medium text-gray-500 ${isPdf ? "py-0.5" : "py-1"}`}>店舗</th>
                    <th className={`text-right font-medium text-gray-500 ${isPdf ? "py-0.5" : "py-1"}`}>表示</th>
                    <th className={`text-right font-medium text-gray-500 ${isPdf ? "py-0.5" : "py-1"}`}>アクション</th>
                    <th className={`text-right font-medium text-gray-500 ${isPdf ? "py-0.5" : "py-1"}`}>評価</th>
                  </tr>
                </thead>
                <tbody>
                  {storeComparison.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100" style={{ background: i === storeIndex ? '#FEF2F2' : undefined }}>
                      <td className={`font-medium text-gray-800 ${isPdf ? "py-0.5" : "py-1"}`}>{s.name}</td>
                      <td className={`text-right text-gray-600 ${isPdf ? "py-0.5" : "py-1"}`}>{formatNumber(s.views)}</td>
                      <td className={`text-right text-gray-600 ${isPdf ? "py-0.5" : "py-1"}`}>{formatNumber(s.actions)}</td>
                      <td className={`text-right text-gray-600 ${isPdf ? "py-0.5" : "py-1"}`}>{s.rating.toFixed(1)}★</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={`text-gray-400 text-center ${isPdf ? "text-[8px] py-1" : "text-[9px] py-2"}`}>店舗間比較データは現在利用できません</p>
            )}
          </div>

          {/* Action Items */}
          <div className={`rounded-lg border-2 ${isPdf ? "p-1.5" : "p-3"}`} style={{ borderColor: '#FECACA', background: '#FEF2F2' }}>
            <h3 className={`font-bold ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`} style={{ color: GBP_RED }}>インサイト & アクション</h3>
            <ul className={`text-gray-700 list-disc list-inside ${isPdf ? "space-y-0.5 text-[9px]" : "space-y-1 text-[10px]"}`}>
              <li>平均評価 {avgRating.toFixed(1)} {avgRating >= 4.6 ? '→ 業界平均4.6以上' : '→ 口コミ返信強化で改善を目指す'}</li>
              <li>返信率 {replyRate != null ? `${replyRate}%` : '-'} {replyRate != null ? (replyRate >= 73 ? '→ 良好' : '→ 目標73%まで返信率を向上') : '→ データ取得後に評価'}</li>
              <li>主要アクション: {current.actions_website >= current.actions_phone && current.actions_website >= current.actions_directions ? 'ウェブサイト閲覧' : current.actions_phone >= current.actions_directions ? '電話発信' : '経路検索'}</li>
            </ul>
          </div>

          {/* Review Response Status (PDF only) */}
          {isPdf && (
          <div className="rounded-lg border border-gray-200 p-2">
            <h3 className="text-[10px] font-bold text-gray-700 mb-1">口コミ対応状況</h3>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] text-gray-500">返信率</span>
              <span className="text-[11px] font-bold" style={{ color: replyRate != null && replyRate >= 73 ? '#34A853' : '#F9AB00' }}>{replyRate != null ? `${replyRate}%` : '-'}</span>
              <span className="text-[7px] px-1 py-0.5 rounded-full font-medium" style={{
                background: replyRate != null && replyRate >= 73 ? 'rgba(52,168,83,0.1)' : 'rgba(249,171,0,0.1)',
                color: replyRate != null && replyRate >= 73 ? '#34A853' : '#F9AB00',
              }}>
                {replyRate != null ? (replyRate >= 73 ? '良好' : '目標73%') : 'データなし'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-0.5 relative">
              <div className="h-2 rounded-full" style={{ width: `${replyRate != null ? Math.min(replyRate, 100) : 0}%`, background: replyRate != null && replyRate >= 73 ? '#34A853' : '#F9AB00' }} />
              <div className="absolute top-0 h-2 w-px bg-red-500" style={{ left: '73%' }} />
            </div>
            <div className="flex justify-between text-[7px] text-gray-400 mb-1.5">
              <span>0%</span>
              <span style={{ color: '#EA4335' }}>目標73%</span>
              <span>100%</span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center border-t border-gray-100 pt-1">
              <div>
                <p className="text-[10px] font-bold text-gray-900">{totalRatings}</p>
                <p className="text-[7px] text-gray-500">総口コミ数</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-900">{avgRating.toFixed(1)}</p>
                <p className="text-[7px] text-gray-500">平均評価</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-900">{ratingDistribution.find((r) => r.rating === 5)?.count ?? 0}</p>
                <p className="text-[7px] text-gray-500">5★件数</p>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`${isPdf ? "mt-auto px-4 pb-2 pt-1" : "absolute bottom-0 left-0 right-0 px-8 pb-4 pt-2"} border-t border-gray-200 flex justify-between text-[8px] text-gray-400`}>
        <span>Data Source: Google Business Profile API / Google My Business</span>
        <span>&copy; 2026 GNS inc. - SNS Analytics Dashboard</span>
      </div>
    </>
  )
}
