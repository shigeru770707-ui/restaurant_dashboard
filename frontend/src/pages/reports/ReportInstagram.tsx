import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatNumber, formatPercent } from '@/utils/format'
import type { ReportProps } from './ReportSummary'

const IG_PRIMARY = '#E1306C'
const IG_SECONDARY = '#833AB4'
const IG_TERTIARY = '#F77737'
const POST_TYPE_COLORS: Record<string, string> = { FEED: IG_PRIMARY, STORY: IG_SECONDARY, REELS: IG_TERTIARY }

export default function ReportInstagram({ selectedMonth, storeIndex, storeName, generatedDate, isPdf }: ReportProps) {
  const { data: allData } = useDashboardData(selectedMonth, storeIndex)
  const data = allData.instagram
  const current = data.current
  const previous = data.previous
  const trend = data.trend

  const followerDiff = current.followers_count - previous.followers_count
  const engRate = current.reach > 0 ? (current.impressions / current.reach) * 10 : 0
  const prevEngRate = previous.reach > 0 ? (previous.impressions / previous.reach) * 10 : 0

  const posts = data.posts.map((p) => {
    const eng = p.like_count + p.comments_count + (p.saved ?? 0) + (p.shares ?? 0)
    return { ...p, engRate: p.reach > 0 ? (eng / p.reach) * 100 : 0, engTotal: eng }
  }).sort((a, b) => b.engRate - a.engRate).slice(0, isPdf ? 3 : 5)

  const trendData = trend.map((item) => ({
    month: item.date.slice(5),
    followers: item.followers_count,
    reach: item.reach,
  }))

  // Post type stats
  const feedCount = data.posts.filter(p => p.media_product_type === 'FEED').length
  const storyCount = data.posts.filter(p => p.media_product_type === 'STORY').length
  const reelsCount = data.posts.filter(p => p.media_product_type === 'REELS').length
  const typeData = [
    { name: 'フィード', count: feedCount, type: 'FEED' },
    { name: 'ストーリー', count: storyCount, type: 'STORY' },
    { name: 'リール', count: reelsCount, type: 'REELS' },
  ]

  // Engagement by type
  const engByType = (['FEED', 'STORY', 'REELS'] as const).map((type) => {
    const typePosts = data.posts.filter(p => p.media_product_type === type)
    const avg = typePosts.length > 0
      ? typePosts.reduce((s, p) => {
          const eng = p.like_count + p.comments_count + (p.saved ?? 0) + (p.shares ?? 0)
          return s + (p.reach > 0 ? (eng / p.reach) * 100 : 0)
        }, 0) / typePosts.length
      : 0
    return { name: type === 'FEED' ? 'フィード' : type === 'STORY' ? 'ストーリー' : 'リール', avg: Math.round(avg * 10) / 10, type }
  })

  // Post frequency data (weekly) — for PDF only
  const frequencyData = (() => {
    const weekMap = new Map<string, { feed: number; story: number; reels: number }>()
    for (const p of data.posts) {
      const d = new Date(p.timestamp)
      const day = d.getDay()
      const dateDiff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(dateDiff)
      const weekKey = `${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}`
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, { feed: 0, story: 0, reels: 0 })
      const entry = weekMap.get(weekKey)!
      if (p.media_product_type === 'FEED') entry.feed++
      else if (p.media_product_type === 'STORY') entry.story++
      else if (p.media_product_type === 'REELS') entry.reels++
    }
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, counts]) => ({ week: `${week}~`, ...counts, total: counts.feed + counts.story + counts.reels }))
  })()

  // Heatmap data (day x hour) — for PDF only
  const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']
  const HOUR_LABELS = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21']
  const heatmapGrid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0))
  const heatmapEngGrid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0))
  for (const p of data.posts) {
    const d = new Date(p.timestamp)
    const dayIdx = (d.getDay() + 6) % 7
    const hour = d.getHours()
    if (hour >= 8 && hour <= 21) {
      const hourIdx = hour - 8
      heatmapGrid[dayIdx][hourIdx]++
      const isStory = p.media_product_type === 'STORY'
      const eng = isStory
        ? ((p as any).replies ?? 0) + ((p as any).taps_back ?? 0)
        : p.like_count + p.comments_count + (p.saved ?? 0) + (p.shares ?? 0)
      const rate = p.reach > 0 ? (eng / p.reach) * 100 : 0
      heatmapEngGrid[dayIdx][hourIdx] = Math.max(heatmapEngGrid[dayIdx][hourIdx], rate)
    }
  }
  // Find best time slot
  let bestDay = 0, bestHour = 0, bestEng = 0
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 14; h++) {
      if (heatmapEngGrid[d][h] > bestEng) { bestEng = heatmapEngGrid[d][h]; bestDay = d; bestHour = h }
    }
  }
  const maxHeatCount = Math.max(1, ...heatmapGrid.flat())

  const diff = (curr: number, prev: number) => {
    if (!prev) return ''
    const pct = ((curr - prev) / prev) * 100
    return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`
  }
  const diffColor = (curr: number, prev: number) => (!prev ? '#666' : curr >= prev ? '#34A853' : '#EA4335')

  return (
    <>
      {/* Header */}
      <div className={`flex items-center justify-between ${isPdf ? "pb-1.5 mb-1.5" : "pb-3 mb-4"}`} style={{ borderBottom: `2px solid ${IG_PRIMARY}` }}>
        <div>
          <h1 className={`${isPdf ? "text-base" : "text-xl"} font-bold text-gray-900`}>Instagram 分析レポート</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            対象期間: {selectedMonth} | 店舗: {storeName} | 生成日: {generatedDate}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold" style={{ color: IG_PRIMARY }}>SNS Analytics</p>
          <p className="text-[9px] text-gray-400">&copy; 2026 GNS inc.</p>
        </div>
      </div>

      {/* KPI Scorecard */}
      <div className={`grid ${isPdf ? "grid-cols-5 gap-1.5 mb-1.5" : "grid-cols-6 gap-2 mb-4"}`}>
        {[
          { label: 'フォロワー数', value: formatNumber(current.followers_count), change: diff(current.followers_count, previous.followers_count), changeColor: diffColor(current.followers_count, previous.followers_count) },
          { label: 'フォロワー増減', value: `${followerDiff >= 0 ? '+' : ''}${formatNumber(followerDiff)}`, change: '', changeColor: '#666' },
          { label: 'リーチ数', value: formatNumber(current.reach), change: diff(current.reach, previous.reach), changeColor: diffColor(current.reach, previous.reach) },
          { label: 'ENG率', value: formatPercent(engRate), change: diff(engRate, prevEngRate), changeColor: diffColor(engRate, prevEngRate) },
          ...(!isPdf ? [{ label: 'インプレッション', value: formatNumber(current.impressions), change: diff(current.impressions, previous.impressions), changeColor: diffColor(current.impressions, previous.impressions) }] : []),
          { label: 'プロフィール表示', value: formatNumber(current.profile_views), change: diff(current.profile_views, previous.profile_views), changeColor: diffColor(current.profile_views, previous.profile_views) },
        ].map((kpi, i) => (
          <div key={i} className={`rounded-lg border border-gray-200 text-center ${isPdf ? "p-1.5" : "p-2"}`} style={{ borderTop: `3px solid ${IG_PRIMARY}` }}>
            <p className={`${isPdf ? "text-[8px]" : "text-[9px]"} text-gray-500 truncate`}>{kpi.label}</p>
            <p className={`${isPdf ? "text-[13px]" : "text-sm"} font-bold text-gray-900 mt-0.5`}>{kpi.value}</p>
            {kpi.change && <p className={`${isPdf ? "text-[8px]" : "text-[9px]"} font-medium mt-0.5`} style={{ color: kpi.changeColor }}>{kpi.change}</p>}
          </div>
        ))}
      </div>

      {/* Main Grid: 2 columns */}
      <div className={`grid grid-cols-2 ${isPdf ? "gap-1.5 flex-1" : "gap-4"}`} style={{ fontSize: isPdf ? 10 : 11 }}>
        {/* Left: Top Posts */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-1.5" : "text-xs mb-2"}`}>人気投稿 {isPdf ? "TOP3" : "TOP5"}（ENG率順）</h3>
            <div className={isPdf ? "space-y-1.5" : "space-y-2"}>
              {posts.map((p, i) => {
                const maxEng = posts[0]?.engRate ?? 1
                const barWidth = Math.round((p.engRate / maxEng) * 100)
                const thumbSize = isPdf ? 40 : 48
                return (
                  <div key={p.id} className={`flex items-start gap-2 ${isPdf ? "pb-1.5" : "pb-2"} border-b border-gray-100 last:border-0`}>
                    <span
                      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white mt-0.5"
                      style={{ background: i === 0 ? '#F9AB00' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#999' }}
                    >
                      {i + 1}
                    </span>
                    {p.thumbnail_url ? (
                      <img
                        src={p.thumbnail_url}
                        alt=""
                        crossOrigin="anonymous"
                        className="flex-shrink-0 rounded object-cover"
                        style={{ width: thumbSize, height: thumbSize }}
                      />
                    ) : (
                      <div
                        className="flex-shrink-0 rounded bg-gray-100 flex items-center justify-center"
                        style={{ width: thumbSize, height: thumbSize, fontSize: isPdf ? 14 : 18 }}
                      >
                        {p.media_product_type === 'REELS' ? '🎬' : p.media_product_type === 'STORY' ? '📱' : '🖼'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span
                          className="px-1 py-0 rounded text-[8px] font-medium text-white flex-shrink-0"
                          style={{ background: POST_TYPE_COLORS[p.media_product_type] || IG_PRIMARY }}
                        >
                          {p.media_product_type === 'FEED' ? 'フィード' : p.media_product_type === 'STORY' ? 'ストーリー' : 'リール'}
                        </span>
                        <span className="text-[9px] text-gray-800 truncate">{p.caption}</span>
                      </div>
                      <div className="flex gap-3 text-[8px] text-gray-500 mb-1">
                        <span>リーチ {formatNumber(p.reach)}</span>
                        <span className="font-bold" style={{ color: p.engRate >= 5 ? '#34A853' : p.engRate >= 2.2 ? '#F9AB00' : '#EA4335' }}>
                          ENG {p.engRate.toFixed(1)}%
                        </span>
                        <span>保存 {p.saved ?? 0}</span>
                      </div>
                      <div className="w-full h-1 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${barWidth}%`,
                            background: p.engRate >= 5 ? '#34A853' : p.engRate >= 2.2 ? '#F9AB00' : '#EA4335',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-1.5 text-[8px] text-gray-400">※ ENG率 = (いいね+コメント+保存+シェア) / リーチ × 100</p>
          </div>

          {/* Post Type Breakdown */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-1.5" : "text-xs mb-2"}`}>{isPdf ? "投稿タイプ別（平均ENG率）" : "投稿タイプ別（件数 / 平均ENG率）"}</h3>
            <div className={isPdf ? "" : "grid grid-cols-2 gap-3"}>
              {!isPdf && (
              <div style={{ height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData} margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    <Bar dataKey="count" name="投稿数" radius={[3, 3, 0, 0]}>
                      {typeData.map((entry, i) => (
                        <Cell key={i} fill={POST_TYPE_COLORS[entry.type] || IG_PRIMARY} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
              <div style={{ height: isPdf ? 85 : 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engByType} margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    {!isPdf && <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} formatter={(v) => [`${v}%`, '平均ENG率']} />}
                    <Bar dataKey="avg" name="平均ENG率" radius={[3, 3, 0, 0]}>
                      {engByType.map((entry, i) => (
                        <Cell key={i} fill={POST_TYPE_COLORS[entry.type] || IG_PRIMARY} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Post Frequency (PDF only) */}
          {isPdf && (
            <div className="rounded-lg border border-gray-200 p-2">
              <h3 className="font-bold text-gray-700 text-[10px] mb-1">投稿頻度（週別）</h3>
              <div style={{ height: 80 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frequencyData} margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 7, fill: '#666' }} axisLine={false} tickLine={false} />
                    <YAxis hide allowDecimals={false} />
                    <Bar dataKey="feed" name="フィード" stackId="a" fill={POST_TYPE_COLORS.FEED} radius={0} />
                    <Bar dataKey="story" name="ストーリー" stackId="a" fill={POST_TYPE_COLORS.STORY} radius={0} />
                    <Bar dataKey="reels" name="リール" stackId="a" fill={POST_TYPE_COLORS.REELS} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-3 mt-0.5 justify-center">
                {[{ label: 'フィード', color: POST_TYPE_COLORS.FEED }, { label: 'ストーリー', color: POST_TYPE_COLORS.STORY }, { label: 'リール', color: POST_TYPE_COLORS.REELS }].map(l => (
                  <span key={l.label} className="flex items-center gap-0.5 text-[7px] text-gray-500">
                    <span className="inline-block w-2 h-2 rounded-sm" style={{ background: l.color }} />{l.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Charts */}
        <div className={isPdf ? "space-y-1.5" : "space-y-3"}>
          {/* Follower Trend */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-1.5" : "text-xs mb-2"}`}>フォロワー推移（過去6ヶ月）</h3>
            <div style={{ height: isPdf ? 100 : 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="igGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={IG_PRIMARY} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={IG_PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  {!isPdf && <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} />}
                  <Area type="monotone" dataKey="followers" name="フォロワー" stroke={IG_PRIMARY} fill="url(#igGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reach Trend */}
          <div className={`rounded-lg border border-gray-200 ${isPdf ? "p-2" : "p-3"}`}>
            <h3 className={`font-bold text-gray-700 ${isPdf ? "text-[10px] mb-1.5" : "text-xs mb-2"}`}>リーチ数推移（過去6ヶ月）</h3>
            <div style={{ height: isPdf ? 100 : 130 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 0, right: 5, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="igReachGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={IG_SECONDARY} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={IG_SECONDARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                  {!isPdf && <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} />}
                  <Area type="monotone" dataKey="reach" name="リーチ" stroke={IG_SECONDARY} fill="url(#igReachGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Items */}
          <div className={`rounded-lg border-2 ${isPdf ? "p-1.5" : "p-3"}`} style={{ borderColor: '#FCE7EF', background: '#FFF5F8' }}>
            <h3 className={`font-bold ${isPdf ? "text-[10px] mb-1" : "text-xs mb-2"}`} style={{ color: IG_PRIMARY }}>インサイト & アクション</h3>
            <ul className="space-y-1 text-[10px] text-gray-700 list-disc list-inside">
              <li>最もENG率の高い投稿タイプ: <strong>{engByType.sort((a, b) => b.avg - a.avg)[0]?.name}</strong></li>
              <li>{posts[0] ? `「${posts[0].caption.slice(0, 20)}...」が最高ENG率 → 類似コンテンツ強化` : 'ENG率の改善を検討'}</li>
              <li>月間投稿数: {data.posts.length}件（フィード{feedCount} / ストーリー{storyCount} / リール{reelsCount}）</li>
              <li>{engRate >= 2.2 ? '業界平均ENG率(2.2%)を上回っています' : '業界平均ENG率(2.2%)以下 → コンテンツ改善を検討'}</li>
            </ul>
          </div>

          {/* Posting Heatmap (PDF only) */}
          {isPdf && (
            <div className="rounded-lg border border-gray-200 p-2">
              <h3 className="font-bold text-gray-700 text-[10px] mb-1">投稿時間帯</h3>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: 16 }} />
                    {HOUR_LABELS.map(h => (
                      <th key={h} style={{ fontSize: 6, color: '#999', textAlign: 'center', padding: 0, fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAY_LABELS.map((day, dayIdx) => (
                    <tr key={day}>
                      <td style={{ fontSize: 7, color: '#666', textAlign: 'right', paddingRight: 2, fontWeight: 500 }}>{day}</td>
                      {HOUR_LABELS.map((_, hourIdx) => {
                        const count = heatmapGrid[dayIdx][hourIdx]
                        const intensity = count / maxHeatCount
                        return (
                          <td key={hourIdx} style={{ padding: 0.5 }}>
                            <div style={{
                              width: 12, height: 12,
                              borderRadius: 1,
                              background: count > 0 ? `rgba(225,48,108,${0.15 + intensity * 0.85})` : '#f3f4f6',
                            }} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {bestEng > 0 && (
                <p className="text-[8px] text-gray-600 mt-1">
                  最高ENG率の時間帯: <strong style={{ color: IG_PRIMARY }}>{DAY_LABELS[bestDay]}曜 {bestHour + 8}時台</strong>（{bestEng.toFixed(1)}%）
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`${isPdf ? "mt-auto pt-1.5" : "absolute bottom-0 left-0 right-0 pt-2"} px-8 pb-4 border-t border-gray-200 flex justify-between text-[8px] text-gray-400`}>
        <span>Data Source: Instagram Graph API / Instagram Insights</span>
        <span>&copy; 2026 GNS inc. - SNS Analytics Dashboard</span>
      </div>
    </>
  )
}
