import { useState } from 'react'
import {
  LineChart,
  Line,
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
} from 'recharts'
import Header from '@/components/layout/Header'
import { GBPIcon } from '@/components/common/BrandIcons'
import KpiCard from '@/components/common/KpiCard'
import PageSizeSelector from '@/components/common/PageSizeSelector'
import StoreSelector from '@/components/common/StoreSelector'
import { useMonth } from '@/hooks/useMonth'
import { useStore } from '@/hooks/useStore'
import { useApiSettings } from '@/hooks/useApiSettings'
import { useDashboardData } from '@/hooks/useDashboardData'
import { formatNumber, formatPercent } from '@/utils/format'

const TOOLTIP_STYLE = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  color: 'var(--foreground)',
  fontSize: '13px',
}

const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'
const GRID_COLOR = 'var(--border)'
const TICK_COLOR = 'var(--muted-foreground)'

const AVG_RATING_BENCHMARK = 4.6
const REPLY_RATE_BENCHMARK = 73
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']
const RATING_COLORS: Record<number, string> = {
  5: '#34A853',
  4: '#4285F4',
  3: '#F9AB00',
  2: '#EA4335',
  1: '#D93025',
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={i < rating ? '' : 'opacity-30'}
          style={{ color: i < rating ? '#F9AB00' : 'currentColor' }}
        >
          ★
        </span>
      ))}
    </span>
  )
}

function ratingBorderColor(rating: number): string {
  if (rating >= 5) return '#34A853'
  if (rating >= 4) return '#4285F4'
  if (rating >= 3) return '#F9AB00'
  return '#EA4335'
}

export default function GBP() {
  const { selectedMonth } = useMonth()
  const { gbpStoreIndex, setGbpStoreIndex } = useStore()
  const { settings } = useApiSettings()
  const [reviewPageSize, setReviewPageSize] = useState(5)
  const { data: allData } = useDashboardData(selectedMonth, gbpStoreIndex)
  const data = allData.gbp

  const current = data.current
  const previous = data.previous
  const trend = data.trend
  const reviews = data.reviews
  const ratingDistribution = data.ratingDistribution
  const hourlyActions = data.hourlyActions

  const totalViews = current.views_maps + current.views_search
  const prevTotalViews = previous.views_maps + previous.views_search

  const totalQueries = current.queries_direct + current.queries_indirect
  const prevTotalQueries = previous.queries_direct + previous.queries_indirect

  const totalActions = current.actions_website + current.actions_phone + current.actions_directions
  const prevTotalActions = previous.actions_website + previous.actions_phone + previous.actions_directions

  const convRate = totalViews > 0 ? (totalActions / totalViews) * 100 : 0
  const prevConvRate = prevTotalViews > 0 ? (prevTotalActions / prevTotalViews) * 100 : 0

  const trendData = trend.map((item) => ({
    month: item.date.slice(5),
    direct: item.queries_direct,
    indirect: item.queries_indirect,
    maps: item.views_maps,
    search: item.views_search,
    phone: item.actions_phone,
    directions: item.actions_directions,
    website: item.actions_website,
  }))

  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0
  const displayedReviews = reviews.slice(0, reviewPageSize)

  // Mock reply rate (73% = benchmark)
  const replyRate = 68

  // Heatmap
  const maxActions = Math.max(...hourlyActions.map((h) => h.actions))
  const hours = Array.from({ length: 15 }, (_, i) => i + 8) // 8-22

  // Rating distribution chart data
  const ratingChartData = ratingDistribution
    .slice()
    .sort((a, b) => b.rating - a.rating)
    .map((r) => ({
      name: `${r.rating}★`,
      count: r.count,
      rating: r.rating,
    }))
  const totalRatingCount = ratingDistribution.reduce((s, r) => s + r.count, 0)

  // Impression breakdown
  const impressionData = [
    { name: 'Google Maps', value: current.views_maps, color: '#4285F4' },
    { name: 'Google検索', value: current.views_search, color: '#EA4335' },
  ]

  return (
    <div className="animate-in fade-in duration-400">
      <Header title="Googleビジネスプロフィール 分析" brandIcon={<GBPIcon size={22} />} color="#EA4335" lightBg="#FDECE9" reportType="gbp" storeIndex={gbpStoreIndex} />

      {settings.gbp.length > 1 && (
        <div className="mb-4 md:mb-6">
          <StoreSelector
            stores={settings.gbp}
            selectedIndex={gbpStoreIndex}
            onSelect={setGbpStoreIndex}
            color="#EA4335"
          />
        </div>
      )}

      {/* Exposure KPI Cards */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          露出・集客指標
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-5">
          <KpiCard title="表示回数合計" value={totalViews} previousValue={prevTotalViews} color="#4285F4" />
          <KpiCard title="検索回数合計" value={totalQueries} previousValue={prevTotalQueries} color="#34A853" />
          <KpiCard title="アクション合計" value={totalActions} previousValue={prevTotalActions} color="#F9AB00" />
          <KpiCard title="コンバージョン率" value={formatPercent(convRate)} previousValue={prevConvRate} color="#EA4335" />
          <KpiCard title="口コミ返信率" value={formatPercent(replyRate)} previousValue={REPLY_RATE_BENCHMARK} color={replyRate >= REPLY_RATE_BENCHMARK ? '#34A853' : '#F9AB00'} />
        </div>
      </section>

      {/* Action Summary Cards */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          アクション内訳
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:gap-5">
          <div className="rounded-xl border border-border bg-card p-4 text-center" style={{ boxShadow: CARD_SHADOW }}>
            <span className="material-symbols-outlined text-2xl md:text-3xl mb-2 block" style={{ color: '#4285F4' }}>language</span>
            <div className="text-xl md:text-2xl font-bold text-foreground">{formatNumber(current.actions_website)}</div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">ウェブサイト閲覧</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalActions > 0 ? ((current.actions_website / totalActions) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center" style={{ boxShadow: CARD_SHADOW }}>
            <span className="material-symbols-outlined text-2xl md:text-3xl mb-2 block" style={{ color: '#34A853' }}>call</span>
            <div className="text-xl md:text-2xl font-bold text-foreground">{formatNumber(current.actions_phone)}</div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">電話発信</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalActions > 0 ? ((current.actions_phone / totalActions) * 100).toFixed(1) : 0}%
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center" style={{ boxShadow: CARD_SHADOW }}>
            <span className="material-symbols-outlined text-2xl md:text-3xl mb-2 block" style={{ color: '#F9AB00' }}>directions</span>
            <div className="text-xl md:text-2xl font-bold text-foreground">{formatNumber(current.actions_directions)}</div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">経路検索</div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalActions > 0 ? ((current.actions_directions / totalActions) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
      </section>

      {/* Impression Breakdown + Search Views Chart */}
      <section className="mb-6 md:mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Impression Breakdown Pie */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              表示内訳（Maps vs 検索）
            </h3>
            <div className="h-[220px] md:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={impressionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    label={(entry) => {
                      const e = entry as { name: string; value: number }
                      const pct = totalViews > 0 ? ((e.value / totalViews) * 100).toFixed(1) : '0'
                      return `${e.name} ${pct}%`
                    }}
                    labelLine={true}
                  >
                    {impressionData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Search Views Stacked Bar Chart */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              検索表示回数（直接 vs 間接）
            </h3>
            <div className="h-[220px] md:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="direct" name="直接検索" stackId="queries" fill="#4285F4" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="indirect" name="間接検索" stackId="queries" fill="#34A853" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Chart Row: Maps vs Search + Actions Trend */}
      <section className="mb-6 md:mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Maps vs Search 表示比較
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="maps" name="Maps" stroke="#4285F4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="search" name="Search" stroke="#EA4335" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              アクション数推移（電話・経路・Web）
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="phone" name="電話" stroke="#34A853" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="directions" name="経路案内" stroke="#F9AB00" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="website" name="ウェブサイト" stroke="#4285F4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Action Time Heatmap */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            アクション時間帯ヒートマップ
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] md:text-xs border-separate" style={{ borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th className="w-8 text-right pr-1 text-muted-foreground font-medium" />
                  {hours.map((h) => (
                    <th key={h} className="text-center text-muted-foreground font-medium px-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((dayLabel, dow) => (
                  <tr key={dow}>
                    <td className="text-right pr-1 text-muted-foreground font-medium">{dayLabel}</td>
                    {hours.map((h) => {
                      const cell = hourlyActions.find((s) => s.day_of_week === dow && s.hour === h)
                      const val = cell?.actions ?? 0
                      const opacity = maxActions > 0 ? Math.max(0.08, val / maxActions) : 0
                      return (
                        <td
                          key={h}
                          className="text-center rounded cursor-default"
                          style={{
                            background: `rgba(234, 67, 53, ${opacity})`,
                            color: opacity > 0.5 ? '#fff' : 'var(--foreground)',
                            padding: '4px 0',
                            minWidth: 28,
                          }}
                          title={`${dayLabel} ${h}:00 - ${val}アクション`}
                        >
                          {val}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-muted-foreground">
            <span>少</span>
            <div className="flex gap-0.5">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((o) => (
                <div key={o} className="w-4 h-3 rounded-sm" style={{ background: `rgba(234, 67, 53, ${o})` }} />
              ))}
            </div>
            <span>多</span>
          </div>
        </div>
      </section>

      {/* Review Analysis Row */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          口コミ分析
        </h3>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Rating Distribution */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground">評価分布</h3>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">{avgRating.toFixed(1)}</span>
                <div className="flex flex-col items-start">
                  <StarRating rating={Math.round(avgRating)} />
                  <span className="text-[10px] text-muted-foreground">{totalRatingCount}件</span>
                </div>
                {avgRating >= AVG_RATING_BENCHMARK ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 font-medium ml-1">
                    業界平均{AVG_RATING_BENCHMARK}以上
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400 font-medium ml-1">
                    業界平均{AVG_RATING_BENCHMARK}未満
                  </span>
                )}
              </div>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ratingChartData} layout="vertical">
                  <XAxis type="number" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}件 (${totalRatingCount > 0 ? ((value as number) / totalRatingCount * 100).toFixed(1) : 0}%)`, '']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {ratingChartData.map((entry, i) => (
                      <Cell key={i} fill={RATING_COLORS[entry.rating] || '#999'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reply Rate & Benchmark */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">口コミ対応状況</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">返信率</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold" style={{ color: replyRate >= REPLY_RATE_BENCHMARK ? '#34A853' : '#F9AB00' }}>
                    {replyRate}%
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                    background: replyRate >= REPLY_RATE_BENCHMARK ? 'rgba(52,168,83,0.1)' : 'rgba(249,171,0,0.1)',
                    color: replyRate >= REPLY_RATE_BENCHMARK ? '#34A853' : '#F9AB00',
                  }}>
                    {replyRate >= REPLY_RATE_BENCHMARK ? '良好' : `目標 ${REPLY_RATE_BENCHMARK}%`}
                  </span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(replyRate, 100)}%`,
                    background: replyRate >= REPLY_RATE_BENCHMARK ? '#34A853' : '#F9AB00',
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#EA4335' }} />
                  業界平均 {REPLY_RATE_BENCHMARK}%
                </span>
                <span>100%</span>
              </div>

              <div className="border-t border-border pt-4 mt-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-foreground">{totalRatingCount}</div>
                    <div className="text-[10px] text-muted-foreground">総口コミ数</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">{avgRating.toFixed(1)}</div>
                    <div className="text-[10px] text-muted-foreground">平均評価</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">{ratingDistribution.find((r) => r.rating === 5)?.count ?? 0}</div>
                    <div className="text-[10px] text-muted-foreground">5★件数</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section>
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">最近の口コミ</h3>
            <div className="flex items-center gap-3">
              <PageSizeSelector
                total={reviews.length}
                pageSize={reviewPageSize}
                onChangePageSize={setReviewPageSize}
              />
            </div>
          </div>

          <div className="space-y-3">
            {displayedReviews.map((review, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-4"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: ratingBorderColor(review.rating),
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-muted-foreground">
                      {review.author}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{review.date}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{review.text}</p>
              </div>
            ))}

            {reviewPageSize < reviews.length && (
              <div className="flex justify-center pt-3">
                <button
                  onClick={() => setReviewPageSize(reviews.length)}
                  className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  すべて表示（{reviews.length}件）
                </button>
              </div>
            )}

            {reviews.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                口コミデータがありません。
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
