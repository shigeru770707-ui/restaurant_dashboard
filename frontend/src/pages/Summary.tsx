import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Link } from 'react-router-dom'
import Header from '@/components/layout/Header'
import KpiCard from '@/components/common/KpiCard'
import { useMonth } from '@/hooks/useMonth'
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

const GRID_COLOR = 'var(--border)'
const TICK_COLOR = 'var(--muted-foreground)'

export default function Summary() {
  const { selectedMonth } = useMonth()
  const { data } = useDashboardData(selectedMonth)

  const ig = data.instagram
  const ln = data.line
  const ga = data.ga4
  const gb = data.gbp

  const totalReach = ig.current.reach + gb.current.views_maps + gb.current.views_search
  const prevTotalReach = ig.previous.reach + gb.previous.views_maps + gb.previous.views_search

  const igEngRate = ig.current.reach > 0 ? (ig.current.impressions / ig.current.reach) * 10 : 0
  const prevIgEngRate = ig.previous.reach > 0 ? (ig.previous.impressions / ig.previous.reach) * 10 : 0

  const gbpAvgRating = gb.reviews.length > 0
    ? gb.reviews.reduce((s, r) => s + r.rating, 0) / gb.reviews.length
    : 0
  const gbpTotalRatings = gb.ratingDistribution.reduce((s, r) => s + r.count, 0)
  const gbpReplyRate = 68

  const topPosts = ig.posts
    .map((p) => {
      const eng = p.like_count + p.comments_count + (p.saved ?? 0) + (p.shares ?? 0)
      return { ...p, engRate: p.reach > 0 ? (eng / p.reach) * 100 : 0 }
    })
    .sort((a, b) => b.engRate - a.engRate)
    .slice(0, 3)

  const alerts = getAlerts(data)

  const trendData = ig.trend.map((item, i) => ({
    month: item.date.slice(5),
    igReach: item.reach,
    lineFollowers: ln.trend[i]?.followers ?? 0,
    ga4Sessions: ga.trend[i]?.sessions ?? 0,
    gbpViews: (gb.trend[i]?.views_maps ?? 0) + (gb.trend[i]?.views_search ?? 0),
  }))

  return (
    <div className="animate-in fade-in duration-400">
      <Header title="全体サマリー" icon="chart_data" color="#6366F1" lightBg="#EEF2FF" reportType="summary" />

      {/* KPI Cards */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          主要指標
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-4">
          <KpiCard
            title="総リーチ"
            value={totalReach}
            previousValue={prevTotalReach}
            color="#6366F1"
          />
          <KpiCard
            title="総エンゲージメント率"
            value={formatPercent(igEngRate)}
            previousValue={prevIgEngRate}
            color="#6366F1"
          />
          <KpiCard
            title="Web CV数"
            value={ga.current.conversions}
            previousValue={ga.previous.conversions}
            color="#6366F1"
          />
          <KpiCard
            title="ブランド検索数"
            value={gb.current.queries_direct}
            previousValue={gb.previous.queries_direct}
            color="#6366F1"
          />
        </div>
      </section>

      {/* Media Score Cards */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          メディア別スコア
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-4">
          <MediaScoreCard
            title="Instagram"
            icon="photo_camera"
            color="#E1306C"
            href="/instagram"
            metrics={[
              { label: 'フォロワー', value: formatNumber(ig.current.followers_count) },
              { label: 'リーチ', value: formatNumber(ig.current.reach) },
              { label: 'エンゲージメント率', value: formatPercent(igEngRate) },
            ]}
          />
          <MediaScoreCard
            title="LINE"
            icon="chat"
            color="#00B900"
            href="/line"
            metrics={[
              { label: '友だち数', value: formatNumber(ln.current.followers) },
              { label: '開封率', value: formatPercent(70.5) },
              { label: 'ブロック率', value: formatPercent(ln.current.blocks / ln.current.followers * 100) },
            ]}
          />
          <MediaScoreCard
            title="GA4"
            icon="monitoring"
            color="#4285F4"
            href="/ga4"
            metrics={[
              { label: 'セッション数', value: formatNumber(ga.current.sessions) },
              { label: 'CV数', value: formatNumber(ga.current.conversions) },
              { label: 'CVR', value: formatPercent(ga.current.conversions / ga.current.sessions * 100) },
            ]}
          />
          <MediaScoreCard
            title="GBP"
            icon="location_on"
            color="#EA4335"
            href="/gbp"
            metrics={[
              { label: '検索表示', value: formatNumber(gb.current.views_search + gb.current.views_maps) },
              { label: 'アクション数', value: formatNumber(gb.current.actions_website + gb.current.actions_phone + gb.current.actions_directions) },
              { label: '平均評価', value: '4.5 ★' },
            ]}
          />
        </div>
      </section>

      {/* Trend Chart */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            成長トレンド（過去6ヶ月）
          </h3>
          <div className="h-[220px] md:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="igReach" name="Instagram リーチ" stroke="#E1306C" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="lineFollowers" name="LINE 友だち" stroke="#00B900" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="ga4Sessions" name="GA4 セッション" stroke="#4285F4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="gbpViews" name="GBP 表示" stroke="#EA4335" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Top Posts Section */}
      {topPosts.length > 0 && (
        <section className="mb-6 md:mb-8">
          <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                注目投稿
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base" style={{ color: '#E1306C' }}>
                  photo_camera
                </span>
                <span className="text-xs text-muted-foreground">Instagram 今月のTOP3</span>
              </div>
            </div>

            {/* Desktop: 3-column grid */}
            <div className="hidden sm:grid sm:grid-cols-3 gap-4">
              {topPosts.map((p, i) => {
                const rankColors = ['#F9AB00', '#C0C0C0', '#CD7F32']
                const typeColors: Record<string, string> = { FEED: '#E1306C', STORY: '#833AB4', REELS: '#F77737' }
                const typeLabels: Record<string, string> = { FEED: 'フィード', STORY: 'ストーリー', REELS: 'リール' }
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                  >
                    <div className="relative aspect-square bg-muted">
                      {p.thumbnail_url ? (
                        <img
                          src={p.thumbnail_url}
                          alt={p.caption.slice(0, 20)}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="size-full flex items-center justify-center text-4xl text-muted-foreground">
                          {p.media_product_type === 'REELS' ? '🎬' : '🖼'}
                        </div>
                      )}
                      <div
                        className="absolute top-2 left-2 size-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md"
                        style={{ background: rankColors[i] }}
                      >
                        {i + 1}
                      </div>
                      <div
                        className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                        style={{ background: typeColors[p.media_product_type] || '#E1306C' }}
                      >
                        {typeLabels[p.media_product_type] || p.media_product_type}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-foreground line-clamp-2 leading-snug mb-2">{p.caption}</p>
                      <div className="grid grid-cols-3 gap-1 text-center">
                        <div>
                          <p className="text-xs font-bold" style={{ color: p.engRate >= 5 ? '#22c55e' : p.engRate >= 2.2 ? '#f59e0b' : '#E1306C' }}>
                            {p.engRate.toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">ENG率</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{formatNumber(p.reach)}</p>
                          <p className="text-[10px] text-muted-foreground">リーチ</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{p.saved ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">保存</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Mobile: vertical list */}
            <div className="sm:hidden space-y-3">
              {topPosts.map((p, i) => {
                const rankColors = ['#F9AB00', '#C0C0C0', '#CD7F32']
                const typeColors: Record<string, string> = { FEED: '#E1306C', STORY: '#833AB4', REELS: '#F77737' }
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    <div
                      className="shrink-0 size-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: rankColors[i] }}
                    >
                      {i + 1}
                    </div>
                    <div className="shrink-0 size-16 rounded-lg overflow-hidden bg-muted">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <div className="size-full flex items-center justify-center text-2xl text-muted-foreground">🖼</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span
                          className="text-[10px] font-medium px-1 py-0.5 rounded"
                          style={{
                            background: `${typeColors[p.media_product_type] || '#E1306C'}20`,
                            color: typeColors[p.media_product_type] || '#E1306C',
                          }}
                        >
                          {p.media_product_type}
                        </span>
                      </div>
                      <p className="text-sm text-foreground truncate">{p.caption}</p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-bold" style={{ color: p.engRate >= 5 ? '#22c55e' : '#f59e0b' }}>
                          ENG {p.engRate.toFixed(1)}%
                        </span>
                        <span>リーチ {formatNumber(p.reach)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* GBP Reviews Section */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              口コミサマリー
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base" style={{ color: '#EA4335' }}>
                reviews
              </span>
              <span className="text-xs text-muted-foreground">Google ビジネスプロフィール</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Rating Summary */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-center">
                  <p className="text-3xl font-bold text-foreground">{gbpAvgRating.toFixed(1)}</p>
                  <div className="text-sm" style={{ color: '#F9AB00' }}>
                    {'★'.repeat(Math.round(gbpAvgRating))}{'☆'.repeat(5 - Math.round(gbpAvgRating))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{gbpTotalRatings}件の評価</p>
                </div>
                <div className="flex-1 space-y-1">
                  {gb.ratingDistribution.slice().sort((a, b) => b.rating - a.rating).map((r) => {
                    const maxCount = Math.max(...gb.ratingDistribution.map(d => d.count))
                    const barWidth = maxCount > 0 ? (r.count / maxCount) * 100 : 0
                    const ratingColors: Record<number, string> = { 5: '#34A853', 4: '#4285F4', 3: '#F9AB00', 2: '#EA4335', 1: '#D93025' }
                    return (
                      <div key={r.rating} className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-5 text-right">{r.rating}★</span>
                        <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all"
                            style={{ width: `${barWidth}%`, background: ratingColors[r.rating] || '#999' }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-6 text-right">{r.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-sm font-bold" style={{ color: gbpReplyRate >= 73 ? '#34A853' : '#F9AB00' }}>{gbpReplyRate}%</p>
                  <p className="text-[10px] text-muted-foreground">返信率</p>
                </div>
                <div className="flex-1 rounded-lg bg-muted/50 p-2 text-center">
                  <p className="text-sm font-bold" style={{ color: gbpAvgRating >= 4.6 ? '#34A853' : '#F9AB00' }}>
                    {gbpAvgRating >= 4.6 ? '良好' : '要改善'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">業界平均4.6比</p>
                </div>
              </div>
            </div>

            {/* Right: Recent Review Cards */}
            <div className="space-y-2">
              {gb.reviews.slice(0, 3).map((review, i) => {
                const borderColors: Record<number, string> = { 5: '#34A853', 4: '#4285F4', 3: '#F9AB00', 2: '#EA4335', 1: '#D93025' }
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-border p-3"
                    style={{ borderLeft: `3px solid ${borderColors[review.rating] || '#999'}` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#F9AB00' }}>
                          {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                        </span>
                        <span className="text-xs font-medium text-foreground">{review.author}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{review.date.slice(0, 10)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{review.text}</p>
                  </div>
                )
              })}
              {gb.reviews.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">口コミデータがありません</p>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border flex justify-end">
            <a href="/gbp" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              GBP詳細を見る
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>
        </div>
      </section>

      {/* Alert Section */}
      {alerts.length > 0 && (
        <section>
          <div className="rounded-xl border border-border bg-card p-4 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              アラート（前月比 ±20%超）
            </h3>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                    alert.positive
                      ? 'bg-success-bg text-success'
                      : 'bg-danger-bg text-danger'
                  }`}
                >
                  <span>{alert.positive ? '▲' : '▼'}</span>
                  <span className="font-medium">{alert.label}</span>
                  <span className="ml-auto font-semibold">{alert.change}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function MediaScoreCard({
  title,
  icon,
  color,
  href,
  metrics,
}: {
  title: string
  icon: string
  color: string
  href: string
  metrics: { label: string; value: string }[]
}) {
  return (
    <Link
      to={href}
      className="block rounded-xl border border-border bg-card p-3 sm:p-5 relative overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] cursor-pointer no-underline"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="absolute top-0 left-0 w-full h-[3px]" style={{ background: color }} />
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-lg" style={{ color }}>{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="material-symbols-outlined text-sm text-muted-foreground ml-auto">arrow_forward</span>
      </div>
      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex justify-between items-baseline">
            <span className="text-xs text-muted-foreground">{m.label}</span>
            <span className="text-sm font-bold text-foreground">{m.value}</span>
          </div>
        ))}
      </div>
    </Link>
  )
}

function getAlerts(data: { instagram: { current: { reach: number; followers_count: number; impressions: number }; previous: { reach: number; followers_count: number; impressions: number } }; line: { current: { followers: number }; previous: { followers: number } }; ga4: { current: { sessions: number; conversions: number }; previous: { sessions: number; conversions: number } }; gbp: { current: { views_maps: number; views_search: number; actions_website: number; actions_phone: number }; previous: { views_maps: number; views_search: number; actions_website: number; actions_phone: number } } }) {
  const alerts: { label: string; change: string; positive: boolean }[] = []

  const check = (label: string, current: number, previous: number) => {
    if (!previous) return
    const pct = ((current - previous) / previous) * 100
    if (Math.abs(pct) > 20) {
      alerts.push({
        label,
        change: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
        positive: pct > 0,
      })
    }
  }

  check('Instagram リーチ', data.instagram.current.reach, data.instagram.previous.reach)
  check('Instagram フォロワー', data.instagram.current.followers_count, data.instagram.previous.followers_count)
  check('LINE 友だち', data.line.current.followers, data.line.previous.followers)
  check('GA4 セッション', data.ga4.current.sessions, data.ga4.previous.sessions)
  check('GA4 CV数', data.ga4.current.conversions, data.ga4.previous.conversions)
  check('GBP 表示回数', data.gbp.current.views_maps + data.gbp.current.views_search, data.gbp.previous.views_maps + data.gbp.previous.views_search)
  check('GBP アクション', data.gbp.current.actions_website + data.gbp.current.actions_phone, data.gbp.previous.actions_website + data.gbp.previous.actions_phone)

  return alerts
}
