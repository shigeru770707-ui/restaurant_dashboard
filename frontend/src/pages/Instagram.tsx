import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts'
import Header from '@/components/layout/Header'
import { InstagramIcon } from '@/components/common/BrandIcons'
import PageSizeSelector from '@/components/common/PageSizeSelector'
import KpiCard from '@/components/common/KpiCard'
import TrendBadge from '@/components/common/TrendBadge'
import StoreSelector from '@/components/common/StoreSelector'
import { useMonth } from '@/hooks/useMonth'
import { usePeriod } from '@/hooks/usePeriod'
import { useStore } from '@/hooks/useStore'
import { useApiSettings } from '@/hooks/useApiSettings'
import { useDashboardData } from '@/hooks/useDashboardData'
import { filterByDateRange } from '@/utils/mockData'
import { formatNumber, formatPercent } from '@/utils/format'

const IG_PRIMARY = '#E1306C'
const IG_SECONDARY = '#833AB4'
const IG_TERTIARY = '#F77737'
const BENCHMARK_ENG_RATE = 2.2 // 飲食業界平均エンゲージメント率

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

const POST_TYPE_COLORS: Record<string, string> = {
  FEED: IG_PRIMARY,
  STORY: IG_SECONDARY,
  REELS: IG_TERTIARY,
}

function postTypeLabel(type: string): string {
  switch (type) {
    case 'FEED': return 'フィード'
    case 'STORY': return 'ストーリー'
    case 'REELS': return 'リール'
    default: return type
  }
}

function mediaTypeLabel(type: string): string {
  switch (type) {
    case 'IMAGE': return '画像'
    case 'VIDEO': return '動画'
    case 'CAROUSEL_ALBUM': return 'カルーセル'
    default: return type
  }
}

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']
const HOUR_LABELS = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21']

export default function Instagram() {
  const [postPageSize, setPostPageSize] = useState(5)
  const [postTypeFilter, setPostTypeFilter] = useState<string>('ALL')
  const [rankingMetric, setRankingMetric] = useState<'engRate' | 'like_count' | 'reach'>('engRate')
  const { selectedMonth } = useMonth()
  const { periodType, effectiveStart, effectiveEnd } = usePeriod()
  const { igStoreIndex, setIgStoreIndex } = useStore()
  const { settings } = useApiSettings()
  const { data: allData } = useDashboardData(selectedMonth, igStoreIndex)
  const data = allData.instagram

  const current = data.current
  const previous = data.previous
  const trend = data.trend

  // Filter posts by the effective date range
  const allPosts = data.posts
  const posts = periodType === 'dateRange'
    ? filterByDateRange(allPosts, effectiveStart, effectiveEnd, 'timestamp')
    : allPosts

  // Post type counts
  const feedCount = posts.filter(p => p.media_product_type === 'FEED').length
  const storyCount = posts.filter(p => p.media_product_type === 'STORY').length
  const reelsCount = posts.filter(p => p.media_product_type === 'REELS').length

  // Filter by post type
  const filteredPosts = postTypeFilter === 'ALL'
    ? posts
    : posts.filter(p => p.media_product_type === postTypeFilter)

  const followerDiff = current.followers_count - previous.followers_count
  const oldestTrend = trend[0]
  const yoyFollowers = oldestTrend ? current.followers_count - oldestTrend.followers_count : 0

  const trendChartData = trend.map((item) => ({
    month: item.date.slice(5),
    followers: item.followers_count,
    reach: item.reach,
    impressions: item.impressions,
  }))

  const postsWithEng = filteredPosts
    .map((p) => {
      const engTotal = p.like_count + p.comments_count + p.saved + p.shares
      const engRate = p.reach > 0 ? (engTotal / p.reach) * 100 : 0
      return { ...p, engTotal, engRate: Math.round(engRate * 100) / 100 }
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const displayedPosts = postsWithEng.slice(0, postPageSize)

  const topPostIds = postsWithEng
    .slice()
    .sort((a, b) => b.engRate - a.engRate)
    .slice(0, 1)
    .map((p) => p.id)

  const rankedPosts = useMemo(() => {
    return postsWithEng
      .slice()
      .sort((a, b) => {
        if (rankingMetric === 'engRate') return b.engRate - a.engRate
        if (rankingMetric === 'like_count') return b.like_count - a.like_count
        return b.reach - a.reach
      })
      .slice(0, 5)
  }, [postsWithEng, rankingMetric])

  const engBarData = postsWithEng
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((p) => ({
      label: p.timestamp.slice(5, 10),
      engRate: p.engRate,
      type: p.media_product_type,
    }))

  // Average engagement rate
  const avgEngRate = postsWithEng.length > 0
    ? Math.round((postsWithEng.reduce((s, p) => s + p.engRate, 0) / postsWithEng.length) * 100) / 100
    : 0

  // Heatmap data: day of week x hour
  const heatmapData = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0))
    const engGrid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0))
    for (const p of posts) {
      const d = new Date(p.timestamp)
      const dayIdx = (d.getDay() + 6) % 7 // Monday=0
      const hour = d.getHours()
      if (hour >= 8 && hour <= 21) {
        const hourIdx = hour - 8
        grid[dayIdx][hourIdx]++
        const eng = p.like_count + p.comments_count + p.saved + p.shares
        const rate = p.reach > 0 ? (eng / p.reach) * 100 : 0
        engGrid[dayIdx][hourIdx] = Math.max(engGrid[dayIdx][hourIdx], rate)
      }
    }
    return { grid, engGrid }
  }, [posts])

  // Post frequency chart data (weekly)
  const frequencyData = useMemo(() => {
    const weekMap = new Map<string, { feed: number; story: number; reels: number }>()
    for (const p of posts) {
      const d = new Date(p.timestamp)
      // Get Monday of the week
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diff)
      const weekKey = `${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}`
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { feed: 0, story: 0, reels: 0 })
      }
      const entry = weekMap.get(weekKey)!
      if (p.media_product_type === 'FEED') entry.feed++
      else if (p.media_product_type === 'STORY') entry.story++
      else if (p.media_product_type === 'REELS') entry.reels++
    }
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, counts]) => ({
        week: `${week}~`,
        ...counts,
        total: counts.feed + counts.story + counts.reels,
      }))
  }, [posts])

  return (
    <div className="animate-in fade-in duration-400">
      <Header title="Instagram 分析" brandIcon={<InstagramIcon size={22} />} color="#E1306C" lightBg="#FCE7EF" reportType="instagram" storeIndex={igStoreIndex} />

      {settings.instagram.length > 1 && (
        <div className="mb-4 md:mb-6">
          <StoreSelector
            stores={settings.instagram}
            selectedIndex={igStoreIndex}
            onSelect={setIgStoreIndex}
            color="#E1306C"
          />
        </div>
      )}

      {/* Growth Section */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          成長指標
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-4">
          <KpiCard
            title="フォロワー数"
            value={current.followers_count}
            previousValue={previous.followers_count}
            color={IG_PRIMARY}
          />
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div
              className="absolute top-0 left-0 h-[3px] w-full"
              style={{ background: IG_PRIMARY }}
            />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              フォロワー増減（前月比）
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {followerDiff >= 0 ? '+' : ''}
              {formatNumber(followerDiff)}
            </p>
            <div className="mt-2">
              <TrendBadge
                currentValue={current.followers_count}
                previousValue={previous.followers_count}
              />
            </div>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div
              className="absolute top-0 left-0 h-[3px] w-full"
              style={{ background: IG_SECONDARY }}
            />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              フォロワー増減（6ヶ月比）
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {yoyFollowers >= 0 ? '+' : ''}
              {formatNumber(yoyFollowers)}
            </p>
            {oldestTrend && (
              <div className="mt-2">
                <TrendBadge
                  currentValue={current.followers_count}
                  previousValue={oldestTrend.followers_count}
                />
              </div>
            )}
          </div>
          <KpiCard
            title="リーチ数"
            value={current.reach}
            previousValue={previous.reach}
            color={IG_PRIMARY}
          />
        </div>
      </section>

      {/* Post Count & Engagement Overview */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          投稿サマリー
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-5">
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: IG_PRIMARY }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              期間内投稿数
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {posts.length}<span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: POST_TYPE_COLORS.FEED }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              フィード
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {feedCount}<span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: POST_TYPE_COLORS.STORY }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              ストーリー
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {storyCount}<span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: POST_TYPE_COLORS.REELS }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              リール
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {reelsCount}<span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: avgEngRate >= BENCHMARK_ENG_RATE ? '#22c55e' : IG_TERTIARY }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              平均ENG率
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {formatPercent(avgEngRate)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              業界平均: {BENCHMARK_ENG_RATE}%
              {avgEngRate >= BENCHMARK_ENG_RATE ? (
                <span className="text-success ml-1">上回っています</span>
              ) : (
                <span className="text-warning ml-1">下回っています</span>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Post Ranking with Thumbnails */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              投稿ランキング TOP5
            </h3>
            <div className="flex gap-1">
              {([
                { key: 'engRate' as const, label: 'ENG率' },
                { key: 'like_count' as const, label: 'いいね' },
                { key: 'reach' as const, label: 'リーチ' },
              ]).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setRankingMetric(opt.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    rankingMetric === opt.key
                      ? 'text-white'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  style={rankingMetric === opt.key ? { backgroundColor: IG_PRIMARY } : undefined}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {rankedPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">投稿データなし</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
              {/* 1位フィーチャー */}
              {rankedPosts[0] && (() => {
                const post = rankedPosts[0]
                const metricValue = rankingMetric === 'engRate' ? `${post.engRate.toFixed(1)}%`
                  : rankingMetric === 'like_count' ? formatNumber(post.like_count)
                  : formatNumber(post.reach)
                const metricLabel = rankingMetric === 'engRate' ? 'ENG率'
                  : rankingMetric === 'like_count' ? 'いいね'
                  : 'リーチ'
                return (
                  <div className="group relative rounded-xl border border-border overflow-hidden">
                    <div className="flex flex-row lg:flex-col">
                      {/* サムネイル */}
                      <div className="relative w-24 h-24 sm:w-32 sm:h-32 lg:w-full lg:h-auto lg:aspect-[16/10] shrink-0 bg-muted overflow-hidden">
                        {post.thumbnail_url ? (
                          <img
                            src={post.thumbnail_url}
                            alt={post.caption}
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center text-muted-foreground">
                            <span className="material-symbols-outlined text-4xl">image</span>
                          </div>
                        )}
                        {/* ランクバッジ */}
                        <div
                          className="absolute top-2 left-2 flex size-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-md"
                          style={{ background: 'linear-gradient(135deg, #E1306C 0%, #833AB4 100%)' }}
                        >
                          1
                        </div>
                        {/* 投稿タイプバッジ */}
                        <div
                          className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm"
                          style={{ background: POST_TYPE_COLORS[post.media_product_type] || IG_PRIMARY }}
                        >
                          {postTypeLabel(post.media_product_type)}
                        </div>
                        {/* メトリクスオーバーレイ（デスクトップ） */}
                        <div className="absolute inset-x-0 bottom-0 hidden lg:flex bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                          <div className="flex items-center gap-3 text-white text-xs">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">favorite</span>
                              {formatNumber(post.like_count)}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">chat_bubble</span>
                              {formatNumber(post.comments_count)}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">bookmark</span>
                              {formatNumber(post.saved)}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">share</span>
                              {formatNumber(post.shares)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* テキスト部分 */}
                      <div className="flex-1 p-3 sm:p-4">
                        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug mb-2">
                          {post.caption}
                        </p>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl font-bold" style={{ color: IG_PRIMARY }}>
                            {metricValue}
                          </span>
                          <span className="text-xs text-muted-foreground">{metricLabel}</span>
                          {rankingMetric === 'engRate' && (
                            <span className="text-[10px] text-muted-foreground">
                              (業界平均 {BENCHMARK_ENG_RATE}% の {(post.engRate / BENCHMARK_ENG_RATE).toFixed(1)}倍)
                            </span>
                          )}
                        </div>
                        {/* ENG率バー */}
                        {rankingMetric === 'engRate' && (
                          <div className="relative h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                            <div
                              className="absolute left-0 top-0 h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (post.engRate / 20) * 100)}%`,
                                background: 'linear-gradient(90deg, #E1306C, #833AB4)',
                              }}
                            />
                            <div
                              className="absolute top-0 h-full w-0.5 bg-amber-400"
                              style={{ left: `${(BENCHMARK_ENG_RATE / 20) * 100}%` }}
                            />
                          </div>
                        )}
                        {/* モバイル用メトリクス */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground lg:hidden">
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-sm">favorite</span>
                            {formatNumber(post.like_count)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-sm">chat_bubble</span>
                            {formatNumber(post.comments_count)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-sm">bookmark</span>
                            {formatNumber(post.saved)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] text-muted-foreground">
                            {post.timestamp.slice(0, 10)} {post.timestamp.slice(11, 16)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            リーチ {formatNumber(post.reach)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 2〜5位リスト */}
              <div className="flex flex-col gap-2">
                {rankedPosts.slice(1).map((post, i) => {
                  const rank = i + 2
                  const metricValue = rankingMetric === 'engRate' ? `${post.engRate.toFixed(1)}%`
                    : rankingMetric === 'like_count' ? formatNumber(post.like_count)
                    : formatNumber(post.reach)
                  return (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-2 transition-colors hover:bg-muted/50"
                    >
                      {/* ランクバッジ */}
                      <div
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: `rgba(225,48,108,0.12)`,
                          color: IG_PRIMARY,
                          border: `1px solid rgba(225,48,108,0.3)`,
                        }}
                      >
                        {rank}
                      </div>
                      {/* サムネイル */}
                      <div className="size-[72px] shrink-0 rounded-lg bg-muted overflow-hidden">
                        {post.thumbnail_url ? (
                          <img
                            src={post.thumbnail_url}
                            alt={post.caption}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center text-muted-foreground">
                            <span className="material-symbols-outlined text-2xl">image</span>
                          </div>
                        )}
                      </div>
                      {/* テキスト */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                            style={{ background: POST_TYPE_COLORS[post.media_product_type] || IG_PRIMARY }}
                          >
                            {postTypeLabel(post.media_product_type)}
                          </span>
                          <p className="text-[12px] text-foreground truncate font-medium">
                            {post.caption}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span className="font-bold" style={{ color: IG_PRIMARY }}>
                            {rankingMetric === 'engRate' ? 'ENG' : rankingMetric === 'like_count' ? '❤' : 'リーチ'} {metricValue}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">favorite</span>
                            {formatNumber(post.like_count)}
                          </span>
                          <span className="hidden sm:inline-flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">visibility</span>
                            {formatNumber(post.reach)}
                          </span>
                          <span className="text-muted-foreground/60">{post.timestamp.slice(5, 10)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Visibility Section */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          露出指標
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-4">
          <KpiCard
            title="インプレッション"
            value={current.impressions}
            previousValue={previous.impressions}
            color={IG_SECONDARY}
          />
          <KpiCard
            title="プロフィール表示"
            value={current.profile_views}
            previousValue={previous.profile_views}
            color={IG_SECONDARY}
          />
          <KpiCard
            title="ウェブサイトクリック"
            value={current.website_clicks}
            previousValue={previous.website_clicks}
            color={IG_PRIMARY}
          />
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div
              className="absolute top-0 left-0 h-[3px] w-full"
              style={{ background: IG_PRIMARY }}
            />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              CTR（クリック / リーチ）
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {current.reach > 0
                ? formatPercent((current.website_clicks / current.reach) * 100)
                : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Engagement Section */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          エンゲージメント指標
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-4">
          {(() => {
            const totalLikes = posts.reduce((s, p) => s + p.like_count, 0)
            const totalComments = posts.reduce((s, p) => s + p.comments_count, 0)
            const totalSaved = posts.reduce((s, p) => s + p.saved, 0)
            const totalShares = posts.reduce((s, p) => s + p.shares, 0)
            return (
              <>
                <KpiCard title="いいね数合計" value={totalLikes} color={IG_PRIMARY} />
                <KpiCard title="コメント数合計" value={totalComments} color={IG_SECONDARY} />
                <KpiCard title="保存数合計" value={totalSaved} color={IG_PRIMARY} />
                <KpiCard title="シェア数合計" value={totalShares} color={IG_SECONDARY} />
              </>
            )
          })()}
        </div>
      </section>

      {/* Charts Row */}
      <section className="mb-6 md:mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              フォロワー数推移（過去6ヶ月）
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendChartData}>
                  <defs>
                    <linearGradient id="igFollowerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={IG_PRIMARY} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={IG_PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="followers" name="フォロワー数" stroke={IG_PRIMARY} fill="url(#igFollowerGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              リーチ・インプレッション推移（過去6ヶ月）
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Line type="monotone" dataKey="reach" name="リーチ" stroke={IG_PRIMARY} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="impressions" name="インプレッション" stroke={IG_SECONDARY} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Post Frequency & Heatmap Row */}
      <section className="mb-6 md:mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Post Frequency Chart */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              投稿頻度（週別・タイプ別）
            </h3>
            <div className="h-[220px] md:h-[280px]">
              {frequencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frequencyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="feed" name="フィード" stackId="a" fill={POST_TYPE_COLORS.FEED} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="story" name="ストーリー" stackId="a" fill={POST_TYPE_COLORS.STORY} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="reels" name="リール" stackId="a" fill={POST_TYPE_COLORS.REELS} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">データなし</p>
              )}
            </div>
          </div>

          {/* Posting Time Heatmap */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              投稿時間帯ヒートマップ
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-1 text-muted-foreground font-medium w-8"></th>
                    {HOUR_LABELS.map((h) => (
                      <th key={h} className="p-1 text-muted-foreground font-medium text-center w-8">{h}時</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAY_LABELS.map((day, dayIdx) => (
                    <tr key={day}>
                      <td className="p-1 text-muted-foreground font-medium text-right pr-2">{day}</td>
                      {HOUR_LABELS.map((_, hourIdx) => {
                        const count = heatmapData.grid[dayIdx][hourIdx]
                        const engRate = heatmapData.engGrid[dayIdx][hourIdx]
                        const maxCount = Math.max(1, ...heatmapData.grid.flat())
                        const intensity = count / maxCount
                        return (
                          <td
                            key={hourIdx}
                            className="p-0.5"
                            title={`${day}曜 ${8 + hourIdx}時: ${count}件投稿 (ENG率: ${engRate.toFixed(1)}%)`}
                          >
                            <div
                              className="w-full aspect-square rounded-sm transition-colors"
                              style={{
                                backgroundColor: count > 0
                                  ? `rgba(225, 48, 108, ${0.15 + intensity * 0.75})`
                                  : 'var(--muted)',
                                minWidth: '20px',
                                minHeight: '20px',
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-muted-foreground">
                <span>少</span>
                <div className="flex gap-0.5">
                  {[0.15, 0.35, 0.55, 0.75, 0.9].map((opacity, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: `rgba(225, 48, 108, ${opacity})` }}
                    />
                  ))}
                </div>
                <span>多</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Performance Table */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                投稿別パフォーマンス
              </h3>
              <span className="text-xs text-muted-foreground">
                {postsWithEng.length}件
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Post Type Filter */}
              <div className="flex gap-1">
                {(['ALL', 'FEED', 'STORY', 'REELS'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => { setPostTypeFilter(type); setPostPageSize(5) }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      postTypeFilter === type
                        ? 'text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    style={postTypeFilter === type ? {
                      backgroundColor: type === 'ALL' ? IG_PRIMARY : POST_TYPE_COLORS[type] || IG_PRIMARY,
                    } : undefined}
                  >
                    {type === 'ALL' ? 'すべて' : postTypeLabel(type)}
                  </button>
                ))}
              </div>
              <PageSizeSelector
                total={postsWithEng.length}
                pageSize={postPageSize}
                onChangePageSize={setPostPageSize}
              />
            </div>
          </div>
          {postsWithEng.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              選択された期間に投稿がありません。
            </p>
          ) : (
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-[13px]">
                <thead>
                  <tr>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium">投稿日時</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium hidden md:table-cell">投稿タイプ</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium hidden lg:table-cell">メディア</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium">キャプション</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium">リーチ</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium">いいね</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium hidden sm:table-cell">コメント</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium hidden sm:table-cell">保存</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium hidden md:table-cell">シェア</th>
                    <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-medium">ENG率</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPosts.map((post) => {
                    const isTop = topPostIds.includes(post.id)
                    return (
                      <tr
                        key={post.id}
                        className={`transition-colors hover:bg-muted/50 ${
                          isTop ? 'bg-instagram-light/50' : ''
                        }`}
                      >
                        <td className="p-2 md:p-3 border-b border-border text-muted-foreground whitespace-nowrap">
                          {post.timestamp.slice(5, 10)} {post.timestamp.slice(11, 16)}
                        </td>
                        <td className="p-2 md:p-3 border-b border-border hidden md:table-cell">
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-xs text-white font-medium"
                            style={{ backgroundColor: POST_TYPE_COLORS[post.media_product_type] || IG_PRIMARY }}
                          >
                            {postTypeLabel(post.media_product_type)}
                          </span>
                        </td>
                        <td className="p-2 md:p-3 border-b border-border hidden lg:table-cell">
                          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {mediaTypeLabel(post.media_type)}
                          </span>
                        </td>
                        <td className="p-2 md:p-3 border-b border-border text-foreground max-w-[120px] md:max-w-[200px] truncate">
                          {isTop && (
                            <span
                              className="inline-block mr-1 rounded-full px-1.5 py-0 text-[10px] font-bold"
                              style={{ background: '#FCE7EF', color: IG_PRIMARY }}
                            >
                              TOP
                            </span>
                          )}
                          {post.caption}
                        </td>
                        <td className="p-2 md:p-3 border-b border-border text-foreground">
                          {formatNumber(post.reach)}
                        </td>
                        <td className="p-2 md:p-3 border-b border-border text-foreground">
                          {formatNumber(post.like_count)}
                        </td>
                        <td className="p-2 md:p-3 border-b border-border text-foreground hidden sm:table-cell">
                          {formatNumber(post.comments_count)}
                        </td>
                        <td className="p-2 md:p-3 border-b border-border text-foreground hidden sm:table-cell">
                          {formatNumber(post.saved)}
                        </td>
                        <td className="p-2 md:p-3 border-b border-border text-foreground hidden md:table-cell">
                          {formatNumber(post.shares)}
                        </td>
                        <td className="p-2 md:p-3 border-b border-border">
                          <span
                            className={`font-semibold ${
                              post.engRate >= 5
                                ? 'text-success'
                                : post.engRate >= BENCHMARK_ENG_RATE
                                ? 'text-warning'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {formatPercent(post.engRate)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
              {postPageSize < postsWithEng.length && (
                <div className="flex justify-center pt-3 border-t border-border mt-2">
                  <button
                    onClick={() => setPostPageSize(postsWithEng.length)}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    すべて表示（{postsWithEng.length}件）
                  </button>
                </div>
              )}
            <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-card to-transparent md:hidden" />
          </div>
          )}
        </div>
      </section>

      {/* Engagement Rate Bar Chart with Benchmark */}
      <section>
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              エンゲージメント率トレンド（投稿別）
            </h3>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-8 h-[2px] bg-amber-500" style={{ borderTop: '2px dashed #f59e0b' }}></span>
              業界平均 {BENCHMARK_ENG_RATE}%
            </span>
          </div>
          <div className="h-[220px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={engBarData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} unit="%" axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [
                    `${Number(value).toFixed(2)}%`,
                    'ENG率',
                  ]}
                />
                <ReferenceLine
                  y={BENCHMARK_ENG_RATE}
                  stroke="#f59e0b"
                  strokeDasharray="6 3"
                  strokeWidth={2}
                  label={{
                    value: `業界平均 ${BENCHMARK_ENG_RATE}%`,
                    position: 'right',
                    fill: '#f59e0b',
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="engRate" name="エンゲージメント率" radius={[4, 4, 0, 0]}>
                  {engBarData.map((entry, index) => (
                    <Cell key={index} fill={POST_TYPE_COLORS[entry.type] || IG_PRIMARY} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  )
}
