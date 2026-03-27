import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import Header from '@/components/layout/Header'
import TrendBadge from '@/components/common/TrendBadge'
import { useMonth } from '@/hooks/useMonth'
import { useMultiStoreData, STORE_COLORS, type StoreData } from '@/hooks/useMultiStoreData'
import { formatNumber, formatPercent } from '@/utils/format'

const CARD_SHADOW = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)'

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  color: 'var(--foreground)',
  fontSize: '13px',
}
const GRID_COLOR = 'var(--border)'
const TICK_COLOR = 'var(--muted-foreground)'

// ─── Helpers ───

function getHeatmapClass(value: number, values: number[], inverted = false): string {
  const sorted = [...values].sort((a, b) => a - b)
  const rank = sorted.indexOf(value)
  if (inverted) {
    if (rank <= 0) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
    if (rank >= values.length - 1) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  }
  if (rank >= values.length - 1) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  if (rank <= 0) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
}

function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(' ')
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function getAlerts(stores: StoreData[]) {
  const alerts: { icon: string; storeName: string; message: string; type: 'warning' | 'success' }[] = []
  for (const s of stores) {
    if (s.ga4.current.bounce_rate > 50) {
      alerts.push({ icon: 'warning', storeName: s.store.name, message: `直帰率が${formatPercent(s.ga4.current.bounce_rate)}と高水準です`, type: 'warning' })
    }
    const followers = s.ig.current.followers_count
    if (followers > 0 && s.ig.current.reach / followers > 3) {
      alerts.push({ icon: 'trending_up', storeName: s.store.name, message: `リーチ/フォロワー比が${(s.ig.current.reach / followers).toFixed(1)}倍 — 高拡散`, type: 'success' })
    }
    if (s.ig.postCount < 5) {
      alerts.push({ icon: 'edit_note', storeName: s.store.name, message: `今月の投稿数が${s.ig.postCount}件と少なめです`, type: 'warning' })
    }
  }
  return alerts.slice(0, 4)
}

// ─── Main Component ───

export default function Summary() {
  const { selectedMonth } = useMonth()
  const { stores, line, loading } = useMultiStoreData(selectedMonth)
  const [rankingTab, setRankingTab] = useState<'ig' | 'ga4'>('ig')
  const [trendMetric, setTrendMetric] = useState<'reach' | 'sessions' | 'followers'>('reach')

  if (loading) {
    return (
      <div className="animate-in fade-in duration-400">
        <Header title="全体サマリー" icon="chart_data" color="#CC5500" lightBg="#FFF0E5" reportType="summary" />
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">データを取得中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (stores.length === 0) {
    return (
      <div className="animate-in fade-in duration-400">
        <Header title="全体サマリー" icon="chart_data" color="#CC5500" lightBg="#FFF0E5" reportType="summary" />
        <div className="flex items-center justify-center h-64">
          <p className="text-sm text-muted-foreground">店舗データがありません</p>
        </div>
      </div>
    )
  }

  const alerts = getAlerts(stores)

  // ── Heatmap data ──
  const heatmapMetrics = [
    { label: 'IGフォロワー', key: 'igFollowers' as const, inverted: false },
    { label: 'IGリーチ', key: 'igReach' as const, inverted: false },
    { label: 'IGエンゲ率', key: 'igEngRate' as const, inverted: false },
    { label: 'IG投稿数', key: 'igPosts' as const, inverted: false },
    { label: 'GA4セッション', key: 'ga4Sessions' as const, inverted: false },
    { label: 'GA4直帰率', key: 'ga4Bounce' as const, inverted: true },
  ] as const

  type HeatmapKey = typeof heatmapMetrics[number]['key']
  const storeValues: Record<HeatmapKey, number[]> = {
    igFollowers: stores.map(s => s.ig.current.followers_count),
    igReach: stores.map(s => s.ig.current.reach),
    igEngRate: stores.map(s => s.ig.engRate),
    igPosts: stores.map(s => s.ig.postCount),
    ga4Sessions: stores.map(s => s.ga4.current.sessions),
    ga4Bounce: stores.map(s => s.ga4.current.bounce_rate),
  }
  const getStoreValue = (s: StoreData, key: HeatmapKey): number => {
    switch (key) {
      case 'igFollowers': return s.ig.current.followers_count
      case 'igReach': return s.ig.current.reach
      case 'igEngRate': return s.ig.engRate
      case 'igPosts': return s.ig.postCount
      case 'ga4Sessions': return s.ga4.current.sessions
      case 'ga4Bounce': return s.ga4.current.bounce_rate
    }
  }
  const formatHeatmapValue = (value: number, key: HeatmapKey): string => {
    if (key === 'igEngRate' || key === 'ga4Bounce') return formatPercent(value)
    return formatNumber(value)
  }

  // ── Ranking data ──
  const igRanked = [...stores].sort((a, b) => b.ig.current.reach - a.ig.current.reach)
  const ga4Ranked = [...stores].sort((a, b) => b.ga4.current.sessions - a.ga4.current.sessions)
  const rankedStores = rankingTab === 'ig' ? igRanked : ga4Ranked
  const getRankValue = (s: StoreData) => rankingTab === 'ig' ? s.ig.current.reach : s.ga4.current.sessions
  const maxRankValue = Math.max(...rankedStores.map(getRankValue), 1)

  // ── Trend chart data ──
  const allMonths = [...new Set(stores.flatMap(s => {
    if (trendMetric === 'sessions') return s.ga4.trend.map(t => t.date)
    return s.ig.trend.map(t => t.date)
  }))].sort()

  const trendData = allMonths.map(month => {
    const point: Record<string, string | number> = { month: month.slice(5) }
    stores.forEach(s => {
      if (trendMetric === 'reach') {
        const item = s.ig.trend.find(t => t.date === month)
        point[s.store.name] = item?.reach ?? 0
      } else if (trendMetric === 'sessions') {
        const item = s.ga4.trend.find(t => t.date === month)
        point[s.store.name] = item?.sessions ?? 0
      } else {
        const item = s.ig.trend.find(t => t.date === month)
        point[s.store.name] = item?.followers_count ?? 0
      }
    })
    return point
  })

  // ── LINE metrics ──
  const lineFollowers = line.current.followers
  const lineBlocks = line.current.blocks
  // 近似値: blocks / (followers + blocks) で算出。友だち解除（ブロック以外）は含まない。
  // LINE APIではブロック数のみ取得可能なため、この近似式が現実的な上限。
  const lineBlockRate = (lineFollowers + lineBlocks) > 0 ? (lineBlocks / (lineFollowers + lineBlocks)) * 100 : 0
  const totalDelivered = line.messages.reduce((s, m) => s + m.delivered, 0)
  const totalImpressions = line.messages.reduce((s, m) => s + m.unique_impressions, 0)
  const totalClicks = line.messages.reduce((s, m) => s + m.unique_clicks, 0)
  const lineOpenRate = totalDelivered > 0 ? (totalImpressions / totalDelivered) * 100 : 0
  const lineCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0

  return (
    <div className="animate-in fade-in duration-400">
      <Header title="全体サマリー" icon="chart_data" color="#CC5500" lightBg="#FFF0E5" reportType="summary" />

      {/* ❷ Heatmap Overview */}
      <section className="mb-6">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          ヒートマップ概況
        </h3>
        <div
          className="rounded-xl border border-border bg-card overflow-x-auto"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">店舗</th>
                {heatmapMetrics.map(m => (
                  <th key={m.key} className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr key={s.store.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="font-medium text-foreground">{s.store.name}</span>
                    </div>
                  </td>
                  {heatmapMetrics.map(m => {
                    const val = getStoreValue(s, m.key)
                    return (
                      <td key={m.key} className="px-3 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums ${getHeatmapClass(val, storeValues[m.key], m.inverted)}`}>
                          {formatHeatmapValue(val, m.key)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ❸ Store Cards */}
      <section className="mb-6">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          店舗別パフォーマンス
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {stores.map((s, idx) => (
            <div
              key={s.store.id}
              className="rounded-xl border border-border bg-card p-4 md:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
              style={{
                boxShadow: CARD_SHADOW,
                borderTop: `3px solid ${s.color}`,
                animation: `fadeInUp 0.4s ease-out ${idx * 0.08}s both`,
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="font-semibold text-foreground">{s.store.name}</span>
              </div>
              <div className="space-y-3">
                {/* IG Reach */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">IGリーチ</p>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground tabular-nums">{formatNumber(s.ig.current.reach)}</span>
                      <TrendBadge currentValue={s.ig.current.reach} previousValue={s.ig.previous.reach} />
                    </div>
                  </div>
                  <Sparkline data={s.ig.trend.map(t => t.reach)} color={s.color} />
                </div>
                {/* GA4 Sessions */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">GA4セッション</p>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground tabular-nums">{formatNumber(s.ga4.current.sessions)}</span>
                      <TrendBadge currentValue={s.ga4.current.sessions} previousValue={s.ga4.previous.sessions} />
                    </div>
                  </div>
                  <Sparkline data={s.ga4.trend.map(t => t.sessions)} color={s.color} />
                </div>
                {/* IG Engagement Rate */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">IGエンゲ率</p>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground tabular-nums">{formatPercent(s.ig.engRate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ❹ Ranking */}
      <section className="mb-6">
        <div
          className="rounded-xl border border-border bg-card p-4 md:p-6"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              指標別ランキング
            </h3>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setRankingTab('ig')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${rankingTab === 'ig' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Instagram
              </button>
              <button
                onClick={() => setRankingTab('ga4')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${rankingTab === 'ga4' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                GA4
              </button>
              <button
                disabled
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground/40 cursor-not-allowed"
              >
                GBP
              </button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {rankingTab === 'ig' ? 'IGリーチ' : 'GA4セッション'}
          </p>
          <div className="space-y-3">
            {rankedStores.map((s, i) => {
              const value = getRankValue(s)
              return (
                <div key={s.store.id} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm font-bold text-muted-foreground">
                    {i === 0 ? '\u{1F451}' : i + 1}
                  </span>
                  <span className="w-24 sm:w-32 text-sm truncate text-foreground">{s.store.name}</span>
                  <div className="flex-1 h-6 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(value / maxRankValue) * 100}%`, background: s.color }}
                    />
                  </div>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums text-foreground">{formatNumber(value)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ❺ Growth Trend */}
      <section className="mb-6">
        <div
          className="rounded-xl border border-border bg-card p-4 md:p-6"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              成長トレンド（過去6ヶ月）
            </h3>
            <select
              value={trendMetric}
              onChange={e => setTrendMetric(e.target.value as typeof trendMetric)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="reach">リーチ</option>
              <option value="sessions">セッション</option>
              <option value="followers">フォロワー</option>
            </select>
          </div>
          <div className="h-[220px] md:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                {stores.map((s) => (
                  <Line
                    key={s.store.id}
                    type="monotone"
                    dataKey={s.store.name}
                    stroke={s.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ❻ LINE Performance */}
      <section className="mb-6">
        <div
          className="rounded-xl border border-border bg-card p-4 md:p-6"
          style={{ boxShadow: CARD_SHADOW, borderLeft: '4px solid #00B900' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-lg" style={{ color: '#00B900' }}>chat</span>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              LINE配信パフォーマンス
            </h3>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
              全社共通
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left: Mini KPI cards */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: '有効友だち', value: formatNumber(lineFollowers), color: '#00B900' },
                { label: 'ブロック率', value: formatPercent(lineBlockRate), color: lineBlockRate > 20 ? '#EA4335' : '#00B900' },
                { label: '開封率', value: formatPercent(lineOpenRate), color: lineOpenRate > 50 ? '#00B900' : '#F9AB00' },
                { label: 'CTR', value: formatPercent(lineCtr), color: lineCtr > 5 ? '#00B900' : '#F9AB00' },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-lg bg-muted/40 p-3 text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Right: Recent delivery table */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">直近の配信</p>
              {line.messages.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-muted-foreground font-semibold">配信日</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-semibold">タイトル</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">配信数</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">開封率</th>
                        <th className="text-right py-2 px-2 text-muted-foreground font-semibold">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {line.messages.slice(0, 3).map((msg, i) => {
                        const openRate = msg.delivered > 0 ? (msg.unique_impressions / msg.delivered) * 100 : 0
                        const ctr = msg.unique_impressions > 0 ? (msg.unique_clicks / msg.unique_impressions) * 100 : 0
                        return (
                          <tr key={i} className="border-b border-border last:border-b-0">
                            <td className="py-2 px-2 text-foreground whitespace-nowrap">{msg.date}</td>
                            <td className="py-2 px-2 text-foreground truncate max-w-[120px]">{msg.title || msg.body_preview || '-'}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-foreground">{formatNumber(msg.delivered)}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-foreground">{formatPercent(openRate)}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-foreground">{formatPercent(ctr)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">配信データがありません</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ❼ Alerts & Insights */}
      {alerts.length > 0 && (
        <section>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            アラート・洞察
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-xl border p-4 ${
                  alert.type === 'warning'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                    : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                }`}
                style={{ boxShadow: CARD_SHADOW, animation: `fadeInUp 0.4s ease-out ${i * 0.06}s both` }}
              >
                <span
                  className="material-symbols-outlined text-lg mt-0.5"
                  style={{ color: alert.type === 'warning' ? '#F9AB00' : '#34A853' }}
                >
                  {alert.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{alert.storeName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
