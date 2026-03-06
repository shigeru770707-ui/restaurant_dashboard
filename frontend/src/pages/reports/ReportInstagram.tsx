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

export default function ReportInstagram({ selectedMonth, storeIndex, storeName, generatedDate }: ReportProps) {
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
  }).sort((a, b) => b.engRate - a.engRate).slice(0, 5)

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

  const diff = (curr: number, prev: number) => {
    if (!prev) return ''
    const pct = ((curr - prev) / prev) * 100
    return pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`
  }
  const diffColor = (curr: number, prev: number) => (!prev ? '#666' : curr >= prev ? '#34A853' : '#EA4335')

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: `2px solid ${IG_PRIMARY}` }}>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Instagram 分析レポート</h1>
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
      <div className="grid grid-cols-6 gap-2 mb-4">
        {[
          { label: 'フォロワー数', value: formatNumber(current.followers_count), change: diff(current.followers_count, previous.followers_count), changeColor: diffColor(current.followers_count, previous.followers_count) },
          { label: 'フォロワー増減', value: `${followerDiff >= 0 ? '+' : ''}${formatNumber(followerDiff)}`, change: '', changeColor: '#666' },
          { label: 'リーチ数', value: formatNumber(current.reach), change: diff(current.reach, previous.reach), changeColor: diffColor(current.reach, previous.reach) },
          { label: 'ENG率', value: formatPercent(engRate), change: diff(engRate, prevEngRate), changeColor: diffColor(engRate, prevEngRate) },
          { label: 'インプレッション', value: formatNumber(current.impressions), change: diff(current.impressions, previous.impressions), changeColor: diffColor(current.impressions, previous.impressions) },
          { label: 'プロフィール表示', value: formatNumber(current.profile_views), change: diff(current.profile_views, previous.profile_views), changeColor: diffColor(current.profile_views, previous.profile_views) },
        ].map((kpi, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-2 text-center" style={{ borderTop: `3px solid ${IG_PRIMARY}` }}>
            <p className="text-[9px] text-gray-500 truncate">{kpi.label}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{kpi.value}</p>
            {kpi.change && <p className="text-[9px] font-medium mt-0.5" style={{ color: kpi.changeColor }}>{kpi.change}</p>}
          </div>
        ))}
      </div>

      {/* Main Grid: 2 columns */}
      <div className="grid grid-cols-2 gap-4" style={{ fontSize: 11 }}>
        {/* Left: Top Posts */}
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">人気投稿 TOP5（ENG率順）</h3>
            <table className="w-full text-[9px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1 font-medium text-gray-500 w-5">#</th>
                  <th className="text-left py-1 font-medium text-gray-500">タイプ</th>
                  <th className="text-left py-1 font-medium text-gray-500">キャプション</th>
                  <th className="text-right py-1 font-medium text-gray-500">リーチ</th>
                  <th className="text-right py-1 font-medium text-gray-500">ENG率</th>
                  <th className="text-right py-1 font-medium text-gray-500">保存</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p, i) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-1">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white inline-flex"
                        style={{ background: i === 0 ? '#F9AB00' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#999' }}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-1">
                      <span className="px-1 py-0 rounded text-[7px] font-medium text-white" style={{ background: POST_TYPE_COLORS[p.media_product_type] || IG_PRIMARY }}>
                        {p.media_product_type === 'FEED' ? 'フィード' : p.media_product_type === 'STORY' ? 'ストーリー' : 'リール'}
                      </span>
                    </td>
                    <td className="py-1 text-gray-800 max-w-[200px] truncate">{p.caption}</td>
                    <td className="py-1 text-right text-gray-600">{formatNumber(p.reach)}</td>
                    <td className="py-1 text-right font-bold" style={{ color: p.engRate >= 5 ? '#34A853' : p.engRate >= 2.2 ? '#F9AB00' : '#EA4335' }}>
                      {p.engRate.toFixed(1)}%
                    </td>
                    <td className="py-1 text-right text-gray-600">{p.saved ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[8px] text-gray-400">※ ENG率 = (いいね+コメント+保存+シェア) / リーチ × 100</p>
          </div>

          {/* Post Type Breakdown */}
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">投稿タイプ別（件数 / 平均ENG率）</h3>
            <div className="grid grid-cols-2 gap-3">
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
              <div style={{ height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engByType} margin={{ left: 0, right: 5, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#666' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} formatter={(v) => [`${v}%`, '平均ENG率']} />
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
        </div>

        {/* Right: Charts */}
        <div className="space-y-3">
          {/* Follower Trend */}
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">フォロワー推移（過去6ヶ月）</h3>
            <div style={{ height: 130 }}>
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
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="followers" name="フォロワー" stroke={IG_PRIMARY} fill="url(#igGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reach Trend */}
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-xs font-bold text-gray-700 mb-2">リーチ数推移（過去6ヶ月）</h3>
            <div style={{ height: 130 }}>
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
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6, border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="reach" name="リーチ" stroke={IG_SECONDARY} fill="url(#igReachGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Action Items */}
          <div className="rounded-lg border-2 p-3" style={{ borderColor: '#FCE7EF', background: '#FFF5F8' }}>
            <h3 className="text-xs font-bold mb-2" style={{ color: IG_PRIMARY }}>インサイト & アクション</h3>
            <ul className="space-y-1 text-[10px] text-gray-700 list-disc list-inside">
              <li>最もENG率の高い投稿タイプ: <strong>{engByType.sort((a, b) => b.avg - a.avg)[0]?.name}</strong></li>
              <li>{posts[0] ? `「${posts[0].caption.slice(0, 20)}...」が最高ENG率 → 類似コンテンツ強化` : 'ENG率の改善を検討'}</li>
              <li>月間投稿数: {data.posts.length}件（フィード{feedCount} / ストーリー{storyCount} / リール{reelsCount}）</li>
              <li>{engRate >= 2.2 ? '業界平均ENG率(2.2%)を上回っています' : '業界平均ENG率(2.2%)以下 → コンテンツ改善を検討'}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between text-[8px] text-gray-400">
        <span>Data Source: Instagram Graph API / Instagram Insights</span>
        <span>&copy; 2026 GNS inc. - SNS Analytics Dashboard</span>
      </div>
    </>
  )
}
