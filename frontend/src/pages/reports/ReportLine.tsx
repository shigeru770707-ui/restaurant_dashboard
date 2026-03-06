import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatNumber, formatPercent } from '@/utils/format'
import type { ReportProps } from './ReportSummary'

const LINE_GREEN = '#00B900'
const DEMO_COLORS = ['#00B900', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']

export default function ReportLine({ selectedMonth, storeIndex, storeName, generatedDate }: ReportProps) {
  const { data: allData } = useDashboardData(selectedMonth, storeIndex)
  const data = allData.line
  const current = data.current
  const previous = data.previous
  const trend = data.trend
  const messages = data.messages
  const demographic = data.demographic

  const followerDiff = current.followers - previous.followers
  const blockRate = current.followers > 0 ? (current.blocks / current.followers) * 100 : 0
  const totalDelivered = messages.reduce((acc, m) => acc + m.delivered, 0)
  const totalImpressions = messages.reduce((acc, m) => acc + m.unique_impressions, 0)
  const totalClicks = messages.reduce((acc, m) => acc + m.unique_clicks, 0)
  const openRate = totalDelivered > 0 ? (totalImpressions / totalDelivered) * 100 : 0
  const clickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  const trendData = trend.map((item) => ({
    month: item.date.slice(5),
    followers: item.followers,
    blocks: item.blocks,
  }))

  // Message performance data
  const msgData = messages.map((m) => ({
    label: m.date.slice(5, 10),
    openRate: m.delivered > 0 ? Math.round((m.unique_impressions / m.delivered) * 10000) / 100 : 0,
    clickRate: m.unique_impressions > 0 ? Math.round((m.unique_clicks / m.unique_impressions) * 10000) / 100 : 0,
  }))

  // Top 5 messages by open rate
  const topMessages = messages.map((m) => ({
    ...m,
    openRate: m.delivered > 0 ? (m.unique_impressions / m.delivered) * 100 : 0,
    clickRate: m.unique_impressions > 0 ? (m.unique_clicks / m.unique_impressions) * 100 : 0,
  })).sort((a, b) => b.openRate - a.openRate).slice(0, 5)

  const diff = (curr: number, prev: number) => {
    if (!prev) return ''
    const pct = ((curr - prev) / prev) * 100
    return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`
  }
  const diffColor = (curr: number, prev: number) => (!prev ? '#666' : curr >= prev ? '#34A853' : '#EA4335')

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: `2px solid ${LINE_GREEN}` }}>
        <div>
          <h1 className="text-xl font-bold text-gray-900">LINE公式アカウント 分析レポート</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            対象期間: {selectedMonth} | 店舗: {storeName} | 生成日: {generatedDate}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: LINE_GREEN }}>SNS Analytics</p>
          <p className="text-[9px] text-gray-400">&copy; 2026 GNS inc.</p>
        </div>
      </div>

      {/* KPI Scorecard */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {[
          { label: '友だち数', value: formatNumber(current.followers), change: diff(current.followers, previous.followers), changeColor: diffColor(current.followers, previous.followers) },
          { label: '友だち増減', value: `${followerDiff >= 0 ? '+' : ''}${formatNumber(followerDiff)}`, change: '', changeColor: '#666' },
          { label: '平均開封率', value: formatPercent(openRate), change: '', changeColor: '#666' },
          { label: '平均クリック率', value: formatPercent(clickRate), change: '', changeColor: '#666' },
          { label: 'ブロック率', value: formatPercent(blockRate), change: blockRate > 20 ? '要注意' : '良好', changeColor: blockRate > 20 ? '#EA4335' : '#34A853' },
          { label: '配信回数', value: `${messages.length}回`, change: '', changeColor: '#666' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-2 text-center" style={{ borderTop: `3px solid ${LINE_GREEN}` }}>
            <p className="text-[9px] text-gray-500 truncate">{kpi.label}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{kpi.value}</p>
            {kpi.change && <p className="text-[9px] font-medium mt-0.5" style={{ color: kpi.changeColor }}>{kpi.change}</p>}
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-2 gap-4" style={{ fontSize: 11 }}>
        {/* Left: Messages + Demographics */}
        <div className="space-y-3">
          {/* Top Messages */}
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">配信パフォーマンス TOP5（開封率順）</h3>
            <table className="w-full text-[9px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 font-medium text-gray-500">#</th>
                  <th className="text-left py-1 font-medium text-gray-500">配信日</th>
                  <th className="text-right py-1 font-medium text-gray-500">配信数</th>
                  <th className="text-right py-1 font-medium text-gray-500">開封率</th>
                  <th className="text-right py-1 font-medium text-gray-500">クリック率</th>
                </tr>
              </thead>
              <tbody>
                {topMessages.map((m, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white inline-flex"
                        style={{ background: i === 0 ? '#F9AB00' : i === 1 ? '#C0C0C0' : '#999' }}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-1 text-gray-800">{m.date.slice(5)} {String(m.hour).padStart(2, '0')}:00</td>
                    <td className="py-1 text-right text-gray-600">{formatNumber(m.delivered)}</td>
                    <td className="py-1 text-right font-bold" style={{ color: m.openRate >= 60 ? '#34A853' : '#F9AB00' }}>
                      {m.openRate.toFixed(1)}%
                    </td>
                    <td className="py-1 text-right text-gray-600">{m.clickRate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Demographics */}
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">友だち属性分析</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Gender Pie */}
              <div>
                <p className="text-[9px] text-gray-500 mb-1">性別構成</p>
                <div style={{ height: 90 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={demographic.genders} dataKey="percentage" nameKey="label" cx="50%" cy="50%" outerRadius={35}
                        label={({ label, percentage }) => `${label} ${percentage}%`} labelLine={false}>
                        {demographic.genders.map((_, i) => (
                          <Cell key={i} fill={DEMO_COLORS[i % DEMO_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Age Bar */}
              <div>
                <p className="text-[9px] text-gray-500 mb-1">年齢層</p>
                <div style={{ height: 90 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={demographic.ages.map(a => ({ name: a.label, value: a.percentage }))} layout="vertical" margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 8, fill: '#666' }} axisLine={false} tickLine={false} width={30} />
                      <Bar dataKey="value" fill={LINE_GREEN} radius={[0, 3, 3, 0]} barSize={10}
                        label={{ position: 'right', fontSize: 7, fill: '#666', formatter: (v: number) => `${v}%` }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Charts */}
        <div className="space-y-3">
          {/* Friends Trend */}
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">友だち数推移（過去6ヶ月）</h3>
            <div style={{ height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lineGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={LINE_GREEN} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={LINE_GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="followers" name="友だち数" stroke={LINE_GREEN} fill="url(#lineGrad2)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Open Rate Trend */}
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">開封率トレンド（配信別）</h3>
            <div style={{ height: 110 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={msgData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#666' }} unit="%" axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} formatter={(v) => [`${Number(v).toFixed(1)}%`, '開封率']} />
                  <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="6 3" strokeWidth={1.5} />
                  <Bar dataKey="openRate" name="開封率" fill={LINE_GREEN} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Items */}
          <div className="rounded-lg border-2 p-3" style={{ borderColor: '#BBF7D0', background: '#F0FDF4' }}>
            <h3 className="text-xs font-bold mb-2" style={{ color: LINE_GREEN }}>インサイト & アクション</h3>
            <ul className="space-y-1 text-[10px] text-gray-700 list-disc list-inside">
              <li>開封率 {openRate.toFixed(1)}% {openRate >= 60 ? '→ 業界平均60%を上回っています' : '→ 業界平均60%を下回り、改善余地あり'}</li>
              <li>ブロック率 {blockRate.toFixed(1)}% {blockRate > 20 ? '→ 配信頻度の見直しを推奨' : '→ 許容範囲内'}</li>
              <li>{topMessages[0] ? `最高開封率: ${topMessages[0].date.slice(5)} ${topMessages[0].hour}時配信 (${topMessages[0].openRate.toFixed(1)}%)` : '配信データなし'}</li>
              <li>月間配信回数: {messages.length}回 / 合計配信数: {formatNumber(totalDelivered)}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between text-[8px] text-gray-400">
        <span>Data Source: LINE Official Account Manager API</span>
        <span>&copy; 2026 GNS inc. - SNS Analytics Dashboard</span>
      </div>
    </>
  )
}
