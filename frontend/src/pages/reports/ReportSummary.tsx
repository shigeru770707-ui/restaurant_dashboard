import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useDashboardData } from '@/hooks/useDashboardData'
import { getMockDataForMonth } from '@/utils/mockData'
import { formatNumber, formatPercent } from '@/utils/format'

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']
const RATING_COLORS: Record<number, string> = { 5: '#34A853', 4: '#4285F4', 3: '#F9AB00', 2: '#EA4335', 1: '#D93025' }

function StarText({ rating }: { rating: number }) {
  return <span style={{ color: '#F9AB00' }}>{'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}</span>
}

export interface ReportProps {
  selectedMonth: string
  storeIndex: number
  storeName: string
  generatedDate: string
  storeNames: string[]
  isPdf?: boolean
}

export default function ReportSummary({ selectedMonth, storeIndex, storeName, generatedDate, storeNames, isPdf }: ReportProps) {
  const { data } = useDashboardData(selectedMonth, storeIndex)
  const ig = data.instagram
  const ln = data.line
  const ga = data.ga4
  const gb = data.gbp

  const igEngRate = ig.current.reach > 0 ? (ig.current.impressions / ig.current.reach) * 10 : 0
  const prevIgEngRate = ig.previous.reach > 0 ? (ig.previous.impressions / ig.previous.reach) * 10 : 0
  const lineOpenRate = 70.5
  const blockRate = ln.current.followers > 0 ? (ln.current.blocks / ln.current.followers) * 100 : 0
  const gbpTotalActions = gb.current.actions_website + gb.current.actions_phone + gb.current.actions_directions
  const gbpAvgRating = gb.reviews.length > 0 ? gb.reviews.reduce((s, r) => s + r.rating, 0) / gb.reviews.length : 0
  const gbpReplyRate = 68

  const posts = ig.posts.map((p) => {
    const eng = p.like_count + p.comments_count + (p.saved ?? 0) + (p.shares ?? 0)
    return { ...p, engRate: p.reach > 0 ? (eng / p.reach) * 100 : 0, engTotal: eng }
  }).sort((a, b) => b.engRate - a.engRate).slice(0, 3)

  const hours = Array.from({ length: 15 }, (_, i) => i + 8)
  const maxSessions = Math.max(...ga.hourlySessions.map((h) => h.sessions))
  const genderAge = ln.demographic.ages.map((a) => ({ name: a.label, value: a.percentage }))

  const ratingData = gb.ratingDistribution.slice().sort((a, b) => b.rating - a.rating).map((r) => ({
    name: `${r.rating}★`, count: r.count, rating: r.rating,
  }))
  const totalRatings = gb.ratingDistribution.reduce((s, r) => s + r.count, 0)

  const storeComparison = storeNames.map((name, i) => {
    const sd = getMockDataForMonth(selectedMonth, i)
    const sActions = sd.gbp.current.actions_website + sd.gbp.current.actions_phone + sd.gbp.current.actions_directions
    const sAvg = sd.gbp.reviews.length > 0 ? sd.gbp.reviews.reduce((s, r) => s + r.rating, 0) / sd.gbp.reviews.length : 0
    return {
      name, igFollowers: sd.instagram.current.followers_count, igReach: sd.instagram.current.reach,
      lineFollowers: sd.line.current.followers, ga4Sessions: sd.ga4.current.sessions, gbpRating: sAvg, gbpActions: sActions,
    }
  })

  // Sparkline trend data
  const sparkData = ig.trend.map((item, i) => ({
    month: item.date.slice(5),
    ig: item.reach,
    line: ln.trend[i]?.followers ?? 0,
    ga4: ga.trend[i]?.sessions ?? 0,
    gbp: (gb.trend[i]?.views_maps ?? 0) + (gb.trend[i]?.views_search ?? 0),
  }))

  // LINE message stats
  const lineMessages = ln.messages
  const lineTotalDelivered = lineMessages.reduce((s, m) => s + m.delivered, 0)
  const lineTotalImpressions = lineMessages.reduce((s, m) => s + m.unique_impressions, 0)
  const lineTotalClicks = lineMessages.reduce((s, m) => s + m.unique_clicks, 0)
  const lineAvgOpenRate = lineTotalDelivered > 0 ? (lineTotalImpressions / lineTotalDelivered) * 100 : 0
  const lineAvgClickRate = lineTotalImpressions > 0 ? (lineTotalClicks / lineTotalImpressions) * 100 : 0

  // Traffic sources (top 5)
  const trafficSources = ga.trafficSources.slice().sort((a, b) => b.sessions - a.sessions).slice(0, 5)
  const maxTrafficSessions = Math.max(...trafficSources.map(t => t.sessions))

  // Top pages
  const topPages = ga.pages.slice().sort((a, b) => b.page_views - a.page_views).slice(0, 5)

  // CVR for action items
  const cvr = ga.current.sessions > 0 ? (ga.current.conversions / ga.current.sessions) * 100 : 0

  const diff = (curr: number, prev: number) => {
    if (!prev) return ''
    const pct = ((curr - prev) / prev) * 100
    return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`
  }
  const diffColor = (curr: number, prev: number) => {
    if (!prev) return '#666'
    return curr >= prev ? '#34A853' : '#EA4335'
  }

  return (
    <>
      {/* Header */}
      <div className={`flex items-center justify-between border-b-2 border-indigo-600 ${isPdf ? "pb-1.5 mb-1.5" : "pb-3 mb-4"}`}>
        <div>
          <h1 className={`${isPdf ? "text-base" : "text-xl"} font-bold text-gray-900`}>マーケティングレポート</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            対象期間: {selectedMonth} | 店舗: {storeName} | 生成日: {generatedDate}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-indigo-600">SNS Analytics</p>
          <p className="text-[9px] text-gray-400">&copy; 2026 GNS inc.</p>
        </div>
      </div>

      {/* Scorecard */}
      <div className={`grid grid-cols-8 ${isPdf ? "gap-1" : "gap-2"} ${isPdf ? "mb-1.5" : "mb-4"}`}>
        {[
          { label: 'IGフォロワー', value: formatNumber(ig.current.followers_count), change: diff(ig.current.followers_count, ig.previous.followers_count), changeColor: diffColor(ig.current.followers_count, ig.previous.followers_count), accent: '#E1306C' },
          { label: 'IG ENG率', value: formatPercent(igEngRate), change: diff(igEngRate, prevIgEngRate), changeColor: diffColor(igEngRate, prevIgEngRate), accent: '#E1306C' },
          { label: 'LINE友だち', value: formatNumber(ln.current.followers), change: diff(ln.current.followers, ln.previous.followers), changeColor: diffColor(ln.current.followers, ln.previous.followers), accent: '#00B900' },
          { label: 'LINE開封率', value: formatPercent(lineOpenRate), change: '', accent: '#00B900' },
          { label: 'GA4セッション', value: formatNumber(ga.current.sessions), change: diff(ga.current.sessions, ga.previous.sessions), changeColor: diffColor(ga.current.sessions, ga.previous.sessions), accent: '#4285F4' },
          { label: 'GA4 CV数', value: formatNumber(ga.current.conversions), change: diff(ga.current.conversions, ga.previous.conversions), changeColor: diffColor(ga.current.conversions, ga.previous.conversions), accent: '#4285F4' },
          { label: 'GBP評価', value: `${gbpAvgRating.toFixed(1)}★`, change: '', accent: '#EA4335' },
          { label: 'GBPアクション', value: formatNumber(gbpTotalActions), change: '', accent: '#EA4335' },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-lg border border-gray-200 text-center ${isPdf ? "p-1.5" : "p-2"}`} style={{ borderTop: `3px solid ${kpi.accent}` }}>
            <p className={`${isPdf ? "text-[8px]" : "text-[9px]"} text-gray-500 truncate`}>{kpi.label}</p>
            <p className={`${isPdf ? "text-[13px]" : "text-sm"} font-bold text-gray-900 mt-0.5`}>{kpi.value}</p>
            {kpi.change && <p className={`${isPdf ? "text-[8px]" : "text-[9px]"} font-medium mt-0.5`} style={{ color: kpi.changeColor }}>{kpi.change}</p>}
          </div>
        ))}
      </div>

      {/* Mini Trend Sparklines */}
      <div className={`grid grid-cols-4 ${isPdf ? "gap-1.5 mb-1.5" : "gap-2 mb-3"}`}>
        {[
          { label: 'IG リーチ推移', dataKey: 'ig', color: '#E1306C' },
          { label: 'LINE 友だち推移', dataKey: 'line', color: '#00B900' },
          { label: 'GA4 セッション推移', dataKey: 'ga4', color: '#4285F4' },
          { label: 'GBP 表示回数推移', dataKey: 'gbp', color: '#EA4335' },
        ].map((spark) => (
          <div key={spark.dataKey} className={`rounded-lg border border-gray-200 ${isPdf ? "px-1.5 py-1" : "px-2 py-1.5"}`}>
            <p className="text-[8px] text-gray-500 mb-0.5">{spark.label}</p>
            <div style={{ height: isPdf ? 24 : 32 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkData} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${spark.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={spark.color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={spark.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey={spark.dataKey} stroke={spark.color} fill={`url(#spark-${spark.dataKey})`} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className={`flex justify-between ${isPdf ? "text-[8px]" : "text-[7px]"} text-gray-400 mt-0.5`}>
              <span>{sparkData[0]?.month}</span>
              <span>{sparkData[sparkData.length - 1]?.month}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className={`grid grid-cols-3 ${isPdf ? "gap-1.5 flex-1" : "gap-3"}`} style={{ fontSize: isPdf ? 10 : 11 }}>
        {/* Column 1: Fan Base */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`${isPdf ? "text-[11px]" : "text-xs"} font-bold text-gray-700 ${isPdf ? "mb-1" : "mb-2"} flex items-center gap-1`}>
              <span style={{ color: '#6366F1' }}>WHO</span> - ファン層分析
            </h3>
            <div className="mb-2">
              <p className="text-[9px] text-gray-500 mb-1">性別構成（LINE友だち）</p>
              <div className="flex gap-1 h-4 rounded overflow-hidden">
                {ln.demographic.genders.map((g, i) => (
                  <div key={i} className="flex items-center justify-center text-[8px] text-white font-medium"
                    style={{ width: `${g.percentage}%`, background: i === 0 ? '#E1306C' : i === 1 ? '#4285F4' : '#999' }}>
                    {g.label} {g.percentage}%
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-2">
              <p className="text-[9px] text-gray-500 mb-1">年齢層</p>
              <div style={{ height: isPdf ? 85 : 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={genderAge} layout="vertical" margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} width={35} />
                    <Bar dataKey="value" fill="#6366F1" radius={[0, 3, 3, 0]} barSize={12} label={{ position: 'right', fontSize: 8, fill: '#666', formatter: (v: number) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-gray-500 mb-1">地域 (GA4)</p>
              <div className="space-y-0.5">
                {(isPdf ? ga.demographic.regions.slice(0, 3) : ga.demographic.regions).map((r, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="w-16 text-[9px] text-gray-600 truncate">{r.label}</div>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full rounded" style={{ width: `${r.percentage}%`, background: '#6366F1', opacity: 1 - i * 0.15 }} />
                    </div>
                    <div className="w-8 text-[8px] text-gray-500 text-right">{r.percentage}%</div>
                  </div>
                ))}
              </div>
            </div>
            {!isPdf && <div className="mt-2 flex items-center gap-2 text-[9px] text-gray-500">
              <span>デバイス:</span>
              {ga.demographic.devices.map((d, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-gray-100 text-[8px]">{d.label} {d.percentage}%</span>
              ))}
            </div>}
          </div>

          {/* WHERE - Traffic Sources + Pages */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`${isPdf ? "text-[11px]" : "text-xs"} font-bold text-gray-700 ${isPdf ? "mb-1" : "mb-2"} flex items-center gap-1`}>
              <span style={{ color: '#4285F4' }}>WHERE</span> - 流入経路 & 人気ページ
            </h3>
            <p className="text-[9px] text-gray-500 mb-1">流入経路 TOP5（GA4）</p>
            <div className="space-y-1 mb-2">
              {(isPdf ? trafficSources.slice(0, 3) : trafficSources).map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className="w-20 text-[9px] text-gray-600 truncate">{t.channel}</div>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${maxTrafficSessions > 0 ? (t.sessions / maxTrafficSessions) * 100 : 0}%`, background: '#4285F4', opacity: 1 - i * 0.15 }} />
                  </div>
                  <div className="w-10 text-[8px] text-gray-500 text-right">{formatNumber(t.sessions)}</div>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-gray-500 mb-1">人気ページ TOP5</p>
            <table className="w-full text-[8px]">
              <tbody>
                {(isPdf ? topPages.slice(0, 3) : topPages).map((p, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-0.5 text-gray-600 truncate" style={{ maxWidth: 80 }}>{p.page_title}</td>
                    <td className="py-0.5 text-right text-gray-500">{formatNumber(p.page_views)}<span className="text-gray-400"> PV</span></td>
                    <td className="py-0.5 text-right text-gray-500 pl-2">{p.avg_time_on_page.toFixed(0)}<span className="text-gray-400">秒</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column 2: Popular Content + Timing */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`${isPdf ? "text-[11px]" : "text-xs"} font-bold text-gray-700 ${isPdf ? "mb-1" : "mb-2"} flex items-center gap-1`}>
              <span style={{ color: '#E1306C' }}>WHAT</span> - 人気コンテンツ TOP3
            </h3>
            <div className="space-y-1.5">
              {posts.map((p, i) => (
                <div key={p.id} className="flex items-start gap-2 py-1 border-b border-gray-100 last:border-0">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white mt-0.5" style={{ background: i === 0 ? '#F9AB00' : i === 1 ? '#C0C0C0' : '#CD7F32' }}>
                    {i + 1}
                  </span>
                  {p.thumbnail_url ? (
                    <img
                      src={p.thumbnail_url}
                      alt=""
                      crossOrigin="anonymous"
                      className="flex-shrink-0 rounded object-cover mt-0.5"
                      style={{ width: 36, height: 36 }}
                    />
                  ) : (
                    <div
                      className="flex-shrink-0 rounded bg-gray-100 flex items-center justify-center mt-0.5"
                      style={{ width: 36, height: 36, fontSize: 16 }}
                    >
                      {p.media_product_type === 'REELS' ? '🎬' : '🖼'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-800 truncate leading-tight">{p.caption}</p>
                    <div className="flex flex-wrap gap-1.5 mt-0.5 text-[8px] text-gray-500">
                      <span className="px-1 py-0 rounded text-[7px] font-medium" style={{
                        background: p.media_product_type === 'REELS' ? '#833AB415' : p.media_product_type === 'STORY' ? '#00B90015' : '#4285F415',
                        color: p.media_product_type === 'REELS' ? '#833AB4' : p.media_product_type === 'STORY' ? '#00B900' : '#4285F4',
                      }}>
                        {p.media_product_type}
                      </span>
                      <span>ENG {p.engRate.toFixed(1)}%</span>
                      <span>リーチ {formatNumber(p.reach)}</span>
                      <span>保存 {p.saved ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[8px] text-gray-400">※ 保存数が多い投稿 = 来店意欲の高い指標</div>
          </div>

          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`${isPdf ? "text-[11px]" : "text-xs"} font-bold text-gray-700 ${isPdf ? "mb-1" : "mb-2"} flex items-center gap-1`}>
              <span style={{ color: '#4285F4' }}>WHEN</span> - アクセス集中時間帯
            </h3>
            <table className={`w-full ${isPdf ? "text-[8px]" : "text-[7px]"} border-separate`} style={{ borderSpacing: 1 }}>
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
                      const cell = ga.hourlySessions.find((s) => s.day_of_week === dow && s.hour === h)
                      const val = cell?.sessions ?? 0
                      const opacity = maxSessions > 0 ? Math.max(0.05, val / maxSessions) : 0
                      return (
                        <td key={h} className="text-center rounded-sm"
                          style={{ background: `rgba(99, 102, 241, ${opacity})`, padding: '2px 0', minWidth: 16 }} />
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between mt-1 text-[8px] text-gray-400">
              <div className="flex items-center gap-1">
                <span>少</span>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
                  <div key={o} className="w-3 h-2 rounded-sm" style={{ background: `rgba(99, 102, 241, ${o})` }} />
                ))}
                <span>多</span>
              </div>
              <span>推奨: 平日11-13時, 週末17-20時</span>
            </div>
          </div>

          {/* LINE Message Performance */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`${isPdf ? "text-[11px]" : "text-xs"} font-bold text-gray-700 ${isPdf ? "mb-1" : "mb-2"} flex items-center gap-1`}>
              <span style={{ color: '#00B900' }}>PUSH</span> - LINE配信実績
            </h3>
            <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
              <div className="rounded bg-gray-50 py-1.5">
                <p className="text-sm font-bold text-gray-900">{lineMessages.length}</p>
                <p className="text-[8px] text-gray-500">配信回数</p>
              </div>
              <div className="rounded bg-gray-50 py-1.5">
                <p className="text-sm font-bold" style={{ color: lineAvgOpenRate >= 60 ? '#34A853' : '#F9AB00' }}>{lineAvgOpenRate.toFixed(1)}%</p>
                <p className="text-[8px] text-gray-500">開封率</p>
              </div>
              <div className="rounded bg-gray-50 py-1.5">
                <p className="text-sm font-bold" style={{ color: lineAvgClickRate >= 8 ? '#34A853' : '#F9AB00' }}>{lineAvgClickRate.toFixed(1)}%</p>
                <p className="text-[8px] text-gray-500">クリック率</p>
              </div>
            </div>
            <table className="w-full text-[8px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-0.5 font-medium text-gray-500">配信日</th>
                  <th className="text-right py-0.5 font-medium text-gray-500">配信数</th>
                  <th className="text-right py-0.5 font-medium text-gray-500">開封</th>
                  <th className="text-right py-0.5 font-medium text-gray-500">クリック</th>
                </tr>
              </thead>
              <tbody>
                {(isPdf ? lineMessages.slice(0, 3) : lineMessages.slice(0, 4)).map((m, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-0.5 text-gray-600">{m.date.slice(5)}</td>
                    <td className="py-0.5 text-right text-gray-600">{formatNumber(m.delivered)}</td>
                    <td className="py-0.5 text-right text-gray-600">{formatNumber(m.unique_impressions)}</td>
                    <td className="py-0.5 text-right text-gray-600">{formatNumber(m.unique_clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column 3: Reviews + Store Comparison */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`${isPdf ? "text-[11px]" : "text-xs"} font-bold text-gray-700 ${isPdf ? "mb-1" : "mb-2"} flex items-center gap-1`}>
              <span style={{ color: '#EA4335' }}>HOW</span> - ブランド評価
            </h3>
            <div className={`flex gap-3 ${isPdf ? "mb-1.5" : "mb-2"}`}>
              <div className="text-center">
                <p className={`${isPdf ? "text-xl" : "text-2xl"} font-bold text-gray-900`}>{gbpAvgRating.toFixed(1)}</p>
                <p className="text-[9px]"><StarText rating={gbpAvgRating} /></p>
                <p className="text-[8px] text-gray-400">{totalRatings}件</p>
              </div>
              <div className="flex-1" style={{ height: isPdf ? 75 : 80 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingData} layout="vertical" margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} width={25} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={10}>
                      {ratingData.map((entry, i) => (
                        <Cell key={i} fill={RATING_COLORS[entry.rating] || '#999'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-[9px]">
              <div className="rounded bg-gray-50 py-1.5">
                <p className="font-bold text-gray-900" style={{ color: gbpReplyRate >= 73 ? '#34A853' : '#F9AB00' }}>{gbpReplyRate}%</p>
                <p className="text-gray-500">返信率 (目標73%)</p>
              </div>
              <div className="rounded bg-gray-50 py-1.5">
                <p className="font-bold text-gray-900" style={{ color: gbpAvgRating >= 4.6 ? '#34A853' : '#F9AB00' }}>{gbpAvgRating >= 4.6 ? '良好' : '要改善'}</p>
                <p className="text-gray-500">業界平均4.6比</p>
              </div>
            </div>
            {/* Recent Reviews */}
            {gb.reviews.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[9px] text-gray-500 mb-1.5">最新の声</p>
                <div className="space-y-1.5">
                  {(isPdf ? gb.reviews.slice(0, 2) : gb.reviews.slice(0, 3)).map((review, i) => {
                    const borderColors: Record<number, string> = { 5: '#34A853', 4: '#4285F4', 3: '#F9AB00', 2: '#EA4335', 1: '#D93025' }
                    return (
                      <div
                        key={i}
                        className="rounded bg-gray-50 p-1.5"
                        style={{ borderLeft: `2px solid ${borderColors[review.rating] || '#999'}` }}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[8px]"><StarText rating={review.rating} /></span>
                          <span className={`${isPdf ? "text-[8px]" : "text-[7px]"} text-gray-400`}>{review.author} / {review.date.slice(0, 10)}</span>
                        </div>
                        <p className="text-[8px] text-gray-600 leading-tight" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{review.text}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`${isPdf ? "text-[11px]" : "text-xs"} font-bold text-gray-700 ${isPdf ? "mb-1" : "mb-2"} flex items-center gap-1`}>
              <span style={{ color: '#6366F1' }}>ACTION</span> - 店舗間比較
            </h3>
            <table className="w-full text-[9px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 font-medium text-gray-500">店舗</th>
                  <th className="text-right py-1 font-medium text-gray-500">IG</th>
                  <th className="text-right py-1 font-medium text-gray-500">LINE</th>
                  <th className="text-right py-1 font-medium text-gray-500">GA4</th>
                  <th className="text-right py-1 font-medium text-gray-500">★</th>
                </tr>
              </thead>
              <tbody>
                {storeComparison.map((s, i) => (
                  <tr key={i} className="border-b border-gray-100" style={{ background: i === storeIndex ? '#EEF2FF' : undefined }}>
                    <td className="py-1 font-medium text-gray-800">{s.name}</td>
                    <td className="py-1 text-right text-gray-600">{formatNumber(s.igFollowers)}</td>
                    <td className="py-1 text-right text-gray-600">{formatNumber(s.lineFollowers)}</td>
                    <td className="py-1 text-right text-gray-600">{formatNumber(s.ga4Sessions)}</td>
                    <td className="py-1 text-right text-gray-600">{s.gbpRating.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`rounded-lg border-2 border-indigo-200 bg-indigo-50 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`${isPdf ? "text-[10px]" : "text-xs"} font-bold text-indigo-700 ${isPdf ? "mb-1" : "mb-1.5"}`}>今月のアクション</h3>
            <ol className="space-y-0.5 text-[9px] text-gray-700 list-decimal list-inside">
              {[
                posts[0] ? `「${posts[0].caption.slice(0, 15)}...」が高ENG → 類似コンテンツを強化` : 'ENG率の高い投稿タイプを分析',
                blockRate > 10 ? 'LINE配信頻度の見直し（ブロック率要注意）' : 'LINE友だち獲得施策の継続',
                gbpAvgRating < 4.6 ? '口コミ返信を強化し評価改善を目指す' : '高評価維持 - スタッフへの共有・称賛',
                ga.current.bounce_rate > 50 ? `直帰率${ga.current.bounce_rate.toFixed(0)}% → LP改善でCV導線を最適化` : `CVR ${cvr.toFixed(1)}%を維持 → 予約ページのA/Bテスト検討`,
                trafficSources[0] ? `主要流入「${trafficSources[0].channel}」→ ${trafficSources[0].channel.includes('Social') ? 'SNS連携を更に強化' : 'SEO施策の継続と拡充'}` : '流入チャネルの多角化を検討',
              ].slice(0, isPdf ? 4 : 5).map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={isPdf ? "px-8 pb-2 pt-1.5 border-t border-gray-200 flex justify-between text-[8px] text-gray-400" : "absolute bottom-0 left-0 right-0 px-8 pb-4 pt-2 border-t border-gray-200 flex justify-between text-[8px] text-gray-400"}>
        <span>Data Sources: Instagram Insights / LINE Official Account / Google Analytics 4 / Google Business Profile</span>
        <span>&copy; 2026 GNS inc. - SNS Analytics Dashboard</span>
      </div>
    </>
  )
}
