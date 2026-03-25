import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatNumber, formatPercent } from '@/utils/format'
import type { ReportProps } from './ReportSummary'

const GA4_BLUE = '#4285F4'
const PIE_COLORS = ['#F9AB00', '#4285F4', '#34A853', '#EA4335', '#AB47BC']
const DEVICE_COLORS = ['#4285F4', '#34A853', '#F9AB00']
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export default function ReportGA4({ selectedMonth, storeIndex, storeName, generatedDate, isPdf }: ReportProps) {
  const { data: allData } = useDashboardData(selectedMonth, storeIndex)
  const data = allData.ga4
  const current = data.current
  const previous = data.previous
  const trend = data.trend
  const trafficSources = data.trafficSources
  const pages = data.pages
  const demographic = data.demographic
  const hourlySessions = data.hourlySessions

  const cvr = current.sessions > 0 ? (current.conversions / current.sessions) * 100 : 0
  const prevCvr = previous.sessions > 0 ? (previous.conversions / previous.sessions) * 100 : 0

  const trendData = trend.map((item) => ({
    month: item.date.slice(5),
    sessions: item.sessions,
    conversions: item.conversions,
    bounce_rate: parseFloat(item.bounce_rate.toFixed(1)),
  }))

  const pieData = trafficSources.map((s) => ({ name: s.channel, value: s.sessions }))
  const topPages = pages.slice(0, isPdf ? 3 : 5)

  // Heatmap
  const hours = Array.from({ length: 15 }, (_, i) => i + 8)
  const maxSessions = Math.max(...hourlySessions.map((h) => h.sessions))

  const diff = (curr: number, prev: number) => {
    if (!prev) return ''
    const pct = ((curr - prev) / prev) * 100
    return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`
  }
  const diffColor = (curr: number, prev: number) => (!prev ? '#666' : curr >= prev ? '#34A853' : '#EA4335')

  return (
    <>
      {/* Header */}
      <div className={`flex items-center justify-between ${isPdf ? "pb-1.5 mb-1.5" : "pb-3 mb-4"}`} style={{ borderBottom: `2px solid ${GA4_BLUE}` }}>
        <div>
          <h1 className={`font-bold text-gray-900 ${isPdf ? "text-sm" : "text-xl"}`}>Google Analytics 4 分析レポート</h1>
          <p className={`text-gray-500 ${isPdf ? "text-[9px] mt-0" : "text-xs mt-0.5"}`}>
            対象期間: {selectedMonth} | 店舗: {storeName} | 生成日: {generatedDate}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-bold ${isPdf ? "text-[10px]" : "text-sm"}`} style={{ color: GA4_BLUE }}>SNS Analytics</p>
          <p className="text-[8px] text-gray-400">&copy; 2026 GNS inc.</p>
        </div>
      </div>

      {/* KPI Scorecard */}
      <div className={`grid grid-cols-6 ${isPdf ? "gap-1.5 mb-1.5" : "gap-2 mb-4"}`}>
        {[
          { label: 'セッション数', value: formatNumber(current.sessions), change: diff(current.sessions, previous.sessions), changeColor: diffColor(current.sessions, previous.sessions) },
          { label: 'アクティブユーザー', value: formatNumber(current.active_users), change: diff(current.active_users, previous.active_users), changeColor: diffColor(current.active_users, previous.active_users) },
          { label: '新規ユーザー', value: formatNumber(current.new_users), change: diff(current.new_users, previous.new_users), changeColor: diffColor(current.new_users, previous.new_users) },
          { label: 'コンバージョン', value: formatNumber(current.conversions), change: diff(current.conversions, previous.conversions), changeColor: diffColor(current.conversions, previous.conversions) },
          { label: 'CVR', value: formatPercent(cvr), change: diff(cvr, prevCvr), changeColor: diffColor(cvr, prevCvr) },
          { label: '直帰率', value: formatPercent(current.bounce_rate), change: diff(current.bounce_rate, previous.bounce_rate), changeColor: current.bounce_rate <= previous.bounce_rate ? '#34A853' : '#EA4335' },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-lg border border-gray-200 text-center ${isPdf ? "p-1.5" : "p-2"}`} style={{ borderTop: `3px solid ${GA4_BLUE}` }}>
            <p className={`text-gray-500 truncate ${isPdf ? "text-[8px]" : "text-[9px]"}`}>{kpi.label}</p>
            <p className={`font-bold text-gray-900 ${isPdf ? "text-[11px] mt-0" : "text-sm mt-0.5"}`}>{kpi.value}</p>
            {kpi.change && <p className={`font-medium ${isPdf ? "text-[8px] mt-0" : "text-[9px] mt-0.5"}`} style={{ color: kpi.changeColor }}>{kpi.change}</p>}
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className={`grid grid-cols-2 ${isPdf ? "gap-1.5 flex-1" : "gap-4"}`} style={{ fontSize: isPdf ? 10 : 11 }}>
        {/* Left: Traffic + Pages */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          {/* Traffic Sources */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-1" : "text-xs mb-2"}`}>流入チャネル</h3>
            <div className={`grid grid-cols-2 ${isPdf ? "gap-1.5" : "gap-2"}`}>
              <div style={{ height: isPdf ? 90 : 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData.slice(0, isPdf ? 8 : 15)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isPdf ? 30 : 40}
                      label={isPdf ? false : ({ name }: { name: string }) => name} labelLine={false}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <table className="w-full text-[9px]">
                  <tbody>
                    {trafficSources.slice(0, isPdf ? 8 : 15).map((s, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-0.5 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate max-w-[80px] inline-block">{s.channel}</span>
                        </td>
                        <td className="py-0.5 text-right text-gray-600 whitespace-nowrap">{formatNumber(s.sessions)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Page Ranking */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`}>人気ページ {isPdf ? "TOP3" : "TOP5"}</h3>
            <table className={`w-full ${isPdf ? "text-[8px]" : "text-[9px]"}`}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={`text-left font-medium text-gray-500 w-5 ${isPdf ? "py-0.5" : "py-1"}`}>#</th>
                  <th className={`text-left font-medium text-gray-500 ${isPdf ? "py-0.5" : "py-1"}`}>ページ</th>
                  <th className={`text-right font-medium text-gray-500 ${isPdf ? "py-0.5" : "py-1"}`}>PV</th>
                  <th className={`text-right font-medium text-gray-500 ${isPdf ? "py-0.5" : "py-1"}`}>滞在(秒)</th>
                </tr>
              </thead>
              <tbody>
                {topPages.map((page, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white inline-flex"
                        style={{ background: i === 0 ? '#F9AB00' : i === 1 ? '#4285F4' : i === 2 ? '#34A853' : '#999' }}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-1 text-gray-800 max-w-[200px] truncate">{page.page_title}</td>
                    <td className="py-1 text-right text-gray-600">{formatNumber(page.page_views)}</td>
                    <td className="py-1 text-right text-gray-600">{page.avg_time_on_page.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Conversion Trend (PDF only) */}
          {isPdf && (
          <div className="rounded-lg border border-gray-200 p-2">
            <h3 className="text-[10px] font-bold text-gray-700 mb-0.5">コンバージョン数推移</h3>
            <div style={{ height: 80 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 8, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: '#666' }} axisLine={false} tickLine={false} />
                  <Bar dataKey="conversions" name="CV" fill={GA4_BLUE} radius={[2, 2, 0, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          )}

          {/* Demographics */}
          {!isPdf && (
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">ユーザー属性</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[9px] text-gray-500 mb-1">デバイス</p>
                <div style={{ height: 70 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={demographic.devices.map(d => ({ name: d.label, value: d.percentage }))} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={15} outerRadius={30} label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                        {demographic.devices.map((_, i) => (
                          <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-500 mb-1">年齢層</p>
                <div style={{ height: 70 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demographic.ages.map(a => ({ name: a.label, value: a.percentage }))} layout="vertical" margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 7, fill: '#666' }} axisLine={false} tickLine={false} width={28} />
                      <Bar dataKey="value" fill={GA4_BLUE} radius={[0, 3, 3, 0]} barSize={8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Right: Trends + Heatmap */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          {/* Session Trend */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`}>セッション数推移（過去6ヶ月）</h3>
            <div style={{ height: isPdf ? 100 : 100 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ga4Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GA4_BLUE} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={GA4_BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  {!isPdf && <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} />}
                  <Area type="monotone" dataKey="sessions" name="セッション" stroke={GA4_BLUE} fill="url(#ga4Grad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bounce Rate Trend */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`}>直帰率トレンド（過去6ヶ月）</h3>
            <div style={{ height: isPdf ? 100 : 100 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#666' }} unit="%" axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  {!isPdf && <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} formatter={(v) => [`${v}%`, '直帰率']} />}
                  <ReferenceLine y={56} stroke="#EA4335" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="bounce_rate" name="直帰率" stroke="#EA4335" fill="rgba(234,67,53,0.08)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Session Heatmap */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`}>セッション時間帯ヒートマップ</h3>
            <table className={`w-full border-separate ${isPdf ? "text-[7px]" : "text-[7px]"}`} style={{ borderSpacing: isPdf ? 0.5 : 1 }}>
              <thead>
                <tr>
                  <th className="w-5" />
                  {hours.filter((_, i) => i % 2 === 0).map((h) => (
                    <th key={h} className="text-center text-gray-400 font-normal" colSpan={2}>{h}時</th>
                  ))}
                  {hours.length % 2 === 1 && <th />}
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((dayLabel, dow) => (
                  <tr key={dow}>
                    <td className="text-right pr-0.5 text-gray-500 font-medium">{dayLabel}</td>
                    {hours.map((h) => {
                      const cell = hourlySessions.find((s) => s.day_of_week === dow && s.hour === h)
                      const val = cell?.sessions ?? 0
                      const opacity = maxSessions > 0 ? Math.max(0.05, val / maxSessions) : 0
                      return (
                        <td key={h} className="text-center rounded-sm"
                          style={{ background: `rgba(66, 133, 244, ${opacity})`, padding: isPdf ? '1.5px 0' : '2px 0', minWidth: isPdf ? 14 : 16 }} />
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Items */}
          <div className={`rounded-lg border-2 ${isPdf ? "p-1.5" : "p-3"}`} style={{ borderColor: '#BFDBFE', background: '#EFF6FF' }}>
            <h3 className={`font-bold ${isPdf ? "text-[10px] mb-0.5" : "text-xs mb-2"}`} style={{ color: GA4_BLUE }}>インサイト & アクション</h3>
            <ul className={`text-gray-700 list-disc list-inside ${isPdf ? "space-y-0.5 text-[9px]" : "space-y-1 text-[10px]"}`}>
              <li>CVR {cvr.toFixed(2)}% {cvr >= 2 ? '→ 良好な水準' : '→ LP改善でCV数向上を目指す'}</li>
              <li>直帰率 {current.bounce_rate.toFixed(1)}% {current.bounce_rate <= 56 ? '→ 業界平均56%以下' : '→ 業界平均56%超、UI改善推奨'}</li>
              <li>上位流入元: {trafficSources[0]?.channel} ({formatNumber(trafficSources[0]?.sessions ?? 0)}セッション)</li>
              <li>人気ページ1位: {topPages[0]?.page_title} ({formatNumber(topPages[0]?.page_views ?? 0)} PV)</li>
            </ul>
          </div>

          {/* Region TOP3 (PDF only) */}
          {isPdf && (
          <div className="rounded-lg border border-gray-200 p-2">
            <h3 className="text-[10px] font-bold text-gray-700 mb-0.5">地域別アクセス TOP3</h3>
            <table className="w-full text-[8px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left font-medium text-gray-500 py-0.5">#</th>
                  <th className="text-left font-medium text-gray-500 py-0.5">地域</th>
                  <th className="text-right font-medium text-gray-500 py-0.5">割合</th>
                </tr>
              </thead>
              <tbody>
                {demographic.regions.slice(0, 3).map((r, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-0.5">
                      <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white inline-flex"
                        style={{ background: i === 0 ? '#EA4335' : i === 1 ? '#4285F4' : '#34A853' }}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-0.5 text-gray-800">{r.label}</td>
                    <td className="py-0.5 text-right text-gray-600">{r.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`${isPdf ? "mt-auto px-4 pb-2 pt-1" : "absolute bottom-0 left-0 right-0 px-8 pb-4 pt-2"} border-t border-gray-200 flex justify-between text-[8px] text-gray-400`}>
        <span>Data Source: Google Analytics 4 Data API</span>
        <span>&copy; 2026 GNS inc. - SNS Analytics Dashboard</span>
      </div>
    </>
  )
}
