import { useState, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import Header from '@/components/layout/Header'
import { GA4Icon } from '@/components/common/BrandIcons'
import KpiCard from '@/components/common/KpiCard'
import { useMonth } from '@/hooks/useMonth'
import { formatNumber, formatPercent } from '@/utils/format'
import PageSizeSelector from '@/components/common/PageSizeSelector'
import {
  fetchGA4Overview,
  fetchGA4Compare,
  fetchGA4Stores,
  fetchGA4StoreDetail,
  getDateRangeForMonth,
} from '@/utils/api'
import type {
  GA4OverviewData,
  GA4CompareData,
  GA4StoreInfo,
  GA4StoreDetailData,
} from '@/types/ga4'

// ─── Design Tokens ───
const GA4_BLUE = '#4285F4'
const STORE_COLORS = ['#C06A30', '#2E8B6A', '#5B78A8', '#B8534B', '#8B6CAD', '#6A9B50']
const PIE_COLORS = ['#C06A30', '#2E8B6A', '#5B78A8', '#B8534B', '#8B6CAD', '#6A9B50', '#D4915A', '#7A8F9E']
const EVENT_COLORS: Record<string, string> = {
  'WEB予約': '#5B78A8',
  note: '#6A9B50',
  'インスタ': '#8B6CAD',
  FB: '#2E8B6A',
  'エックス': '#B8534B',
  click_to_call: '#C06A30',
}

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  color: 'var(--foreground)',
  fontSize: '13px',
}

const CARD_SHADOW = '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)'
const GRID_COLOR = 'var(--border)'
const TICK_COLOR = 'var(--muted-foreground)'
const BOUNCE_BENCHMARK = 56

// ─── Stagger animation styles ───
const staggerStyle = (index: number) => ({
  opacity: 0,
  animation: `ga4FadeIn 400ms cubic-bezier(0.23, 1, 0.32, 1) ${index * 60}ms forwards`,
})

// ─── Inject keyframes once ───
if (typeof document !== 'undefined' && !document.getElementById('ga4-keyframes')) {
  const style = document.createElement('style')
  style.id = 'ga4-keyframes'
  style.textContent = `
    @keyframes ga4FadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes ga4BarGrow {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }
  `
  document.head.appendChild(style)
}

// ======================================
// 全体概要タブ
// ======================================
function GA4Overview({
  overview,
  previousOverview,
  compare,
  onSelectStore,
}: {
  overview: GA4OverviewData | null
  previousOverview?: GA4OverviewData | null
  compare: GA4CompareData | null
  ga4Stores: GA4StoreInfo[]
  onSelectStore: (storeId: number) => void
}) {
  const [compareMetric, setCompareMetric] = useState<string>('sessions')

  if (!overview) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-3 border-[#4285F4] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">データを読み込み中...</span>
      </div>
    )
  }

  const metricLabels: Record<string, string> = {
    sessions: 'セッション',
    active_users: 'ユーザー',
    page_views: 'PV',
    conversions: 'CV',
  }

  const storeBreakdown = overview.store_breakdown || []
  const maxVal = Math.max(...storeBreakdown.map((s) => Number((s as Record<string, unknown>)[compareMetric] ?? 0)), 1)

  // 店舗別トレンド比較データ
  const compareTrendData = useMemo(() => {
    if (!compare?.stores?.length) return []
    const dateMap = new Map<string, Record<string, unknown>>()
    for (const store of compare.stores) {
      for (const d of store.daily) {
        const dateStr = String(d.date).slice(0, 10)
        if (!dateMap.has(dateStr)) dateMap.set(dateStr, { date: dateStr })
        dateMap.get(dateStr)![`store_${store.store_id}`] = d.sessions
      }
    }
    return Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [compare])

  return (
    <>
      {/* 全店舗KPI */}
      <section className="mb-6" style={staggerStyle(0)}>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          全店舗 合計KPI
        </h3>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-1.5 lg:gap-2 lg:grid-cols-5">
          <KpiCard title="セッション数" value={overview.totals?.sessions ?? 0} previousValue={previousOverview?.totals?.sessions} color={GA4_BLUE} />
          <KpiCard title="アクティブユーザー" value={overview.totals?.active_users ?? 0} previousValue={previousOverview?.totals?.active_users} color={GA4_BLUE} />
          <KpiCard title="新規ユーザー" value={overview.totals?.new_users ?? 0} previousValue={previousOverview?.totals?.new_users} color={GA4_BLUE} />
          <KpiCard title="コンバージョン" value={overview.totals?.conversions ?? 0} previousValue={previousOverview?.totals?.conversions} color="#34A853" />
          <KpiCard title="平均直帰率" value={formatPercent(overview.totals?.bounce_rate ?? 0)} color="#EA4335" />
        </div>
      </section>

      {/* 店舗別比較 横棒グラフ */}
      <section className="mb-6" style={staggerStyle(1)}>
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              店舗別比較
            </h3>
            <select
              value={compareMetric}
              onChange={(e) => setCompareMetric(e.target.value)}
              className="text-xs rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground transition-colors duration-150 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {Object.entries(metricLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {storeBreakdown.map((store, i) => {
              const val = Number((store as Record<string, unknown>)[compareMetric] ?? 0)
              const pct = (val / maxVal) * 100
              return (
                <button
                  key={store.store_id}
                  onClick={() => onSelectStore(store.store_id)}
                  className="w-full flex items-center gap-3 group transition-transform duration-150 active:scale-[0.995]"
                >
                  <span className="w-[120px] md:w-[160px] text-left text-xs md:text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors duration-150">
                    {store.store_name}
                  </span>
                  <div className="flex-1 h-8 bg-muted/60 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-3 origin-left"
                      style={{
                        width: `${Math.max(pct, 4)}%`,
                        background: STORE_COLORS[i % STORE_COLORS.length],
                        animation: `ga4BarGrow 600ms cubic-bezier(0.23, 1, 0.32, 1) ${i * 80}ms both`,
                      }}
                    >
                      <span className="text-[11px] font-bold text-white whitespace-nowrap drop-shadow-sm">
                        {formatNumber(val)}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* 店舗別トレンド比較 */}
      {compareTrendData.length > 0 && compare?.stores && (
        <section className="mb-6" style={staggerStyle(2)}>
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              店舗別セッション推移
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => String(v)} />
                  <Legend />
                  {compare.stores.map((store, i) => (
                    <Line key={store.store_id} type="monotone" dataKey={`store_${store.store_id}`}
                      name={store.store_name} stroke={STORE_COLORS[i % STORE_COLORS.length]}
                      strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* 店舗別KPIテーブル */}
      <section className="mb-6" style={staggerStyle(3)}>
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            店舗別KPIテーブル
          </h3>
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2.5 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">店舗</th>
                    <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">セッション</th>
                    <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">ユーザー</th>
                    <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">PV</th>
                    <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">CV</th>
                    <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">直帰率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {storeBreakdown.map((store, i) => (
                    <tr key={store.store_id}
                      className="hover:bg-muted/50 transition-colors duration-150 cursor-pointer active:bg-muted/70"
                      onClick={() => onSelectStore(store.store_id)}>
                      <td className="py-2.5 pr-4 text-foreground font-medium">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STORE_COLORS[i % STORE_COLORS.length] }} />
                          {store.store_name}
                        </span>
                      </td>
                      <td className="py-2.5 text-right text-foreground tabular-nums">{formatNumber(store.sessions)}</td>
                      <td className="py-2.5 text-right text-foreground tabular-nums">{formatNumber(store.active_users)}</td>
                      <td className="py-2.5 text-right text-foreground tabular-nums hidden sm:table-cell">{formatNumber(store.page_views)}</td>
                      <td className="py-2.5 text-right text-foreground tabular-nums">{formatNumber(store.conversions)}</td>
                      <td className="py-2.5 text-right text-foreground tabular-nums hidden sm:table-cell">{formatPercent(store.bounce_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-card to-transparent md:hidden" />
          </div>
        </div>
      </section>

      {/* カスタムイベント集計 */}
      {overview.custom_events && overview.custom_events.length > 0 && (
        <section style={staggerStyle(4)}>
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              カスタムイベント（全店舗合計）
            </h3>
            <div className="space-y-3">
              {overview.custom_events.map((evt, i) => {
                const maxEvt = Math.max(...overview.custom_events.map((e) => e.event_count), 1)
                const pct = (evt.event_count / maxEvt) * 100
                const color = EVENT_COLORS[evt.event_name] ?? GA4_BLUE
                return (
                  <div key={evt.event_name} className="flex items-center gap-3">
                    <span className="w-[72px] text-xs font-medium text-foreground truncate">{evt.event_name}</span>
                    <div className="flex-1 h-7 bg-muted/60 rounded-lg overflow-hidden">
                      <div className="h-full rounded-lg flex items-center justify-between px-2.5 origin-left"
                        style={{
                          width: `${Math.max(pct, 5)}%`,
                          background: color,
                          animation: `ga4BarGrow 500ms cubic-bezier(0.23, 1, 0.32, 1) ${i * 60 + 200}ms both`,
                        }}>
                        <span className="text-[10px] font-bold text-white drop-shadow-sm">{formatNumber(evt.event_count)}</span>
                      </div>
                    </div>
                    <span className="w-[48px] text-right text-[10px] text-muted-foreground tabular-nums">{evt.unique_users}人</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

// ======================================
// 店舗別詳細タブ（新API直接取得）
// ======================================
function GA4StoreDetail({ store }: { store: GA4StoreInfo }) {
  const { selectedMonth } = useMonth()
  const [detail, setDetail] = useState<GA4StoreDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageRankSize, setPageRankSize] = useState(5)
  const [trafficExpanded, setTrafficExpanded] = useState(false)

  useEffect(() => {
    setLoading(true)
    const { currentStart, currentEnd } = getDateRangeForMonth(selectedMonth)
    fetchGA4StoreDetail(store.id, currentStart, currentEnd)
      .then(setDetail)
      .catch((err) => console.warn('GA4 store detail fetch failed:', err))
      .finally(() => setLoading(false))
  }, [store.id, selectedMonth])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-3 border-[#4285F4] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">{store.name} のデータを読み込み中...</span>
      </div>
    )
  }

  if (!detail || !detail.totals || Object.keys(detail.totals).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <span className="material-symbols-outlined text-3xl text-muted-foreground/40">analytics</span>
        <span className="text-sm text-muted-foreground">{store.name} のデータがありません</span>
      </div>
    )
  }

  const totals = detail.totals
  const dailyTrend = (detail.daily_trend || []).map((d) => ({
    date: String(d.date).slice(5, 10),
    sessions: d.sessions,
    active_users: d.active_users,
    page_views: d.page_views,
    conversions: d.conversions,
  }))

  const trafficSources = detail.traffic_sources || []
  const pieData = trafficSources.map((s) => ({
    name: (s as Record<string, unknown>).source ?? (s as Record<string, unknown>).channel ?? '',
    value: s.sessions,
  }))

  const pages = detail.top_pages || []
  const displayedPages = pages.slice(0, pageRankSize)
  const customEvents = detail.custom_events || []

  return (
    <>
      {/* KPI Cards */}
      <section className="mb-6" style={staggerStyle(0)}>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          集客指標
        </h3>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-1.5 lg:gap-2 lg:grid-cols-5">
          <KpiCard title="セッション数" value={totals.sessions} color={GA4_BLUE} />
          <KpiCard title="アクティブユーザー" value={totals.active_users} color={GA4_BLUE} />
          <KpiCard title="新規ユーザー" value={totals.new_users} color={GA4_BLUE} />
          <KpiCard title="コンバージョン" value={totals.conversions} color="#34A853" />
          <KpiCard title="平均直帰率" value={formatPercent(totals.bounce_rate)} color="#EA4335" />
        </div>
      </section>

      {/* カスタムイベント集計 */}
      {customEvents.length > 0 && (
        <section className="mb-6" style={staggerStyle(1)}>
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              カスタムイベント
            </h3>
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              <div className="space-y-2.5">
                {customEvents.map((evt, i) => {
                  const maxEvt = Math.max(...customEvents.map((e) => e.event_count), 1)
                  const pct = (evt.event_count / maxEvt) * 100
                  const color = EVENT_COLORS[evt.event_name] ?? GA4_BLUE
                  return (
                    <div key={evt.event_name} className="flex items-center gap-3">
                      <span className="w-[72px] text-xs font-medium text-foreground truncate">{evt.event_name}</span>
                      <div className="flex-1 h-7 bg-muted/60 rounded-lg overflow-hidden">
                        <div className="h-full rounded-lg flex items-center px-2.5 origin-left"
                          style={{
                            width: `${Math.max(pct, 5)}%`,
                            background: color,
                            animation: `ga4BarGrow 500ms cubic-bezier(0.23, 1, 0.32, 1) ${i * 60}ms both`,
                          }}>
                          <span className="text-[10px] font-bold text-white drop-shadow-sm">{formatNumber(evt.event_count)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">イベント</th>
                      <th className="pb-2 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">件数</th>
                      <th className="pb-2 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">UU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customEvents.map((evt) => (
                      <tr key={evt.event_name} className="hover:bg-muted/50 transition-colors duration-150">
                        <td className="py-2 text-foreground font-medium">{evt.event_name}</td>
                        <td className="py-2 text-right tabular-nums">{formatNumber(evt.event_count)}</td>
                        <td className="py-2 text-right text-muted-foreground tabular-nums">{formatNumber(evt.unique_users)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* セッション推移 */}
      {dailyTrend.length > 0 && (
        <section className="mb-6" style={staggerStyle(2)}>
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              セッション数・ユーザー数推移
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="sessions" name="セッション" stroke="#F9AB00" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="active_users" name="ユーザー" stroke="#4285F4" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* 流入チャネル */}
      {trafficSources.length > 0 && (
        <section className="mb-6" style={staggerStyle(3)}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            流入チャネル
          </h3>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground">流入チャネル別割合</h3>
              <div className="h-[220px] md:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="70%"
                      label={(entry) => {
                        const e = entry as Record<string, unknown>
                        const total = pieData.reduce((s, d) => s + (d.value as number), 0)
                        if (total > 0 && ((e.value as number) / total) < 0.03) return ''
                        return String(e.name ?? '')
                      }}
                      labelLine={(props) => {
                        const total = pieData.reduce((s, d) => s + (d.value as number), 0)
                        if (total > 0 && ((props as Record<string, unknown>).value as number) / total < 0.03) return <line stroke="none" />
                        return <line {...(props as React.SVGProps<SVGLineElement>)} stroke="var(--muted-foreground)" />
                      }}>
                      {pieData.map((_entry, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
              <h3 className="mb-4 text-sm font-semibold text-muted-foreground">流入元テーブル</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2.5 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">チャネル</th>
                      <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">セッション</th>
                      <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">ユーザー</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(trafficExpanded ? trafficSources : trafficSources.slice(0, 5)).map((source, i) => (
                      <tr key={i} className="hover:bg-muted/50 transition-colors duration-150">
                        <td className="py-2.5 pr-4 text-foreground font-medium flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {String((source as Record<string, unknown>).source ?? (source as Record<string, unknown>).channel ?? '')}
                        </td>
                        <td className="py-2.5 text-right text-foreground tabular-nums">{formatNumber(source.sessions)}</td>
                        <td className="py-2.5 text-right text-foreground tabular-nums">{formatNumber(source.users)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trafficSources.length > 5 && (
                  <button onClick={() => setTrafficExpanded(!trafficExpanded)}
                    className="w-full mt-2 pt-2 border-t border-border flex items-center justify-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors duration-150">
                    <span className="material-symbols-outlined text-sm" style={{ transform: trafficExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)' }}>
                      expand_more
                    </span>
                    {trafficExpanded ? '折りたたむ' : `すべて表示（${trafficSources.length}件）`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 人気ページランキング */}
      {pages.length > 0 && (
        <section style={staggerStyle(4)}>
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                人気ページランキング
              </h3>
              <PageSizeSelector total={pages.length} pageSize={pageRankSize} onChangePageSize={setPageRankSize} />
            </div>
            <div className="relative">
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2.5 w-8 text-center text-xs uppercase tracking-wider text-muted-foreground font-medium">#</th>
                      <th className="pb-2.5 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">パス</th>
                      <th className="pb-2.5 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">タイトル</th>
                      <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">PV</th>
                      <th className="pb-2.5 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">滞在(秒)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedPages.map((page, i) => {
                      const rankColors = ['#F9AB00', '#4285F4', '#34A853']
                      const bgColors = ['rgba(249,171,0,0.12)', 'rgba(66,133,244,0.12)', 'rgba(52,168,83,0.12)']
                      return (
                        <tr key={i} className="hover:bg-muted/50 transition-colors duration-150">
                          <td className="py-2.5 text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                              style={{
                                background: i < 3 ? bgColors[i] : 'var(--muted)',
                                color: i < 3 ? rankColors[i] : 'var(--muted-foreground)',
                              }}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 hidden md:table-cell">
                            <code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">{page.page_path}</code>
                          </td>
                          <td className="py-2.5 pr-4 text-foreground whitespace-nowrap">{page.page_title || page.page_path}</td>
                          <td className="py-2.5 text-right text-foreground tabular-nums">{formatNumber(page.page_views)}</td>
                          <td className="py-2.5 text-right text-muted-foreground tabular-nums hidden sm:table-cell">{page.avg_time_on_page.toFixed(1)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {pageRankSize < pages.length && (
                <div className="flex justify-center pt-3 border-t border-border mt-2">
                  <button onClick={() => setPageRankSize(pages.length)}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors duration-150">
                    すべて表示（{pages.length}件）
                  </button>
                </div>
              )}
              <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-card to-transparent md:hidden" />
            </div>
          </div>
        </section>
      )}
    </>
  )
}

// ======================================
// メインページ（タブ切替）
// ======================================
export default function GA4() {
  const { selectedMonth } = useMonth()
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview')
  const [selectedStoreIdx, setSelectedStoreIdx] = useState(0)
  const [ga4Stores, setGa4Stores] = useState<GA4StoreInfo[]>([])
  const [overview, setOverview] = useState<GA4OverviewData | null>(null)
  const [previousOverview, setPreviousOverview] = useState<GA4OverviewData | null>(null)
  const [compare, setCompare] = useState<GA4CompareData | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(false)

  // 店舗一覧取得
  useEffect(() => {
    fetchGA4Stores().then(setGa4Stores).catch(() => {})
  }, [])

  // 概要データ取得
  useEffect(() => {
    if (viewMode !== 'overview') return
    setLoadingOverview(true)
    const { currentStart, currentEnd, previousStart, previousEnd } = getDateRangeForMonth(selectedMonth)
    Promise.all([
      fetchGA4Overview(currentStart, currentEnd),
      fetchGA4Compare(currentStart, currentEnd),
      fetchGA4Overview(previousStart, previousEnd).catch(() => null),
    ])
      .then(([ov, cmp, prevOv]) => {
        setOverview(ov)
        setCompare(cmp)
        setPreviousOverview(prevOv)
      })
      .catch((err) => console.warn('GA4 overview fetch failed:', err))
      .finally(() => setLoadingOverview(false))
  }, [viewMode, selectedMonth])

  // 店舗選択時の遷移
  const handleSelectStore = (storeId: number) => {
    const idx = ga4Stores.findIndex((s) => s.id === storeId)
    if (idx >= 0) {
      setSelectedStoreIdx(idx)
      setViewMode('detail')
    }
  }

  const selectedStore = ga4Stores[selectedStoreIdx] ?? null

  return (
    <div className="animate-in fade-in duration-400">
      <Header title="Google Analytics 4 分析" brandIcon={<GA4Icon size={22} />} color="#4285F4" lightBg="#EBF2FF" reportType="ga4" />

      {/* サブタブ + 店舗セレクタ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="inline-flex rounded-lg bg-muted p-0.5">
          {(['overview', 'detail'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 ${
                viewMode === mode
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              style={{
                transition: 'background 200ms cubic-bezier(0.23, 1, 0.32, 1), color 200ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            >
              {mode === 'overview' ? '全体概要' : '店舗別詳細'}
            </button>
          ))}
        </div>

        {viewMode === 'detail' && ga4Stores.length > 0 && (
          <select
            value={selectedStoreIdx}
            onChange={(e) => setSelectedStoreIdx(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {ga4Stores.map((store, i) => (
              <option key={store.id} value={i}>{store.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* コンテンツ */}
      {viewMode === 'overview' ? (
        loadingOverview ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-[#4285F4] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">データを読み込み中...</span>
          </div>
        ) : (
          <GA4Overview overview={overview} previousOverview={previousOverview} compare={compare} ga4Stores={ga4Stores} onSelectStore={handleSelectStore} />
        )
      ) : selectedStore ? (
        <GA4StoreDetail key={selectedStore.id} store={selectedStore} />
      ) : (
        <div className="text-center py-12 text-muted-foreground">店舗を選択してください</div>
      )}
    </div>
  )
}
