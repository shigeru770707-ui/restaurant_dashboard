import { useState, useMemo, useCallback, Fragment } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line as RLine,
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
import { LineIcon } from '@/components/common/BrandIcons'
import KpiCard from '@/components/common/KpiCard'
import TrendBadge from '@/components/common/TrendBadge'
import PageSizeSelector from '@/components/common/PageSizeSelector'
import type { LineMessageType } from '@/types/line'
import { useMonth } from '@/hooks/useMonth'
import { usePeriod } from '@/hooks/usePeriod'
import { useDashboardData } from '@/hooks/useDashboardData'
import { filterByDateRange } from '@/utils/mockData'
import { formatNumber, formatPercent } from '@/utils/format'

const LINE_GREEN = '#00B900'
const LINE_DARK = '#00820A'
const CLICK_BLUE = '#3B82F6'
const BLOCK_RED = '#EF4444'
const BENCHMARK_OPEN_RATE = 60.0 // 飲食業界LINE平均開封率
const BLOCK_WARNING_THRESHOLD = 20.0 // ブロック率警告閾値

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

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']
const HOUR_LABELS = ['8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21']

const DEMO_COLORS = ['#00B900', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6']
const GENDER_COLORS = ['#3B82F6', '#EC4899', '#9CA3AF'] // male, female, other
const AREA_COLORS = ['#00B900', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444', '#64748B']

const MSG_TYPE_CONFIG: Record<LineMessageType, { label: string; color: string; icon: string }> = {
  text: { label: 'テキスト', color: '#6B7280', icon: 'chat_bubble' },
  image: { label: '画像', color: '#3B82F6', icon: 'image' },
  rich: { label: 'リッチ', color: '#22C55E', icon: 'dashboard' },
  coupon: { label: 'クーポン', color: '#F59E0B', icon: 'confirmation_number' },
  video: { label: '動画', color: '#8B5CF6', icon: 'play_circle' },
  card: { label: 'カード', color: '#06B6D4', icon: 'web_stories' },
}

export default function Line() {
  const { selectedMonth } = useMonth()
  const { periodType, effectiveStart, effectiveEnd } = usePeriod()
  const { data: allData, loading } = useDashboardData(selectedMonth)
  const data = allData.line

  const current = data.current
  const previous = data.previous
  const trend = data.trend
  const demographic = data.demographic

  // APIからデータが取得できていない場合（全てゼロ or 空配列）
  const hasFollowerData = trend.length > 0 || current.followers > 0
  const hasMessageData = data.messages.length > 0
  const hasAnyData = hasFollowerData || hasMessageData

  // Filter messages by the effective date range
  const allMessages = data.messages
  const messages = periodType === 'dateRange'
    ? filterByDateRange(allMessages, effectiveStart, effectiveEnd)
    : allMessages

  const followerDiff = current.followers - previous.followers
  const oldestTrend = trend[0]
  const halfYearFollowerDiff = oldestTrend ? current.followers - oldestTrend.followers : 0
  const blockRate = current.followers > 0 ? (current.blocks / current.followers) * 100 : 0
  const prevBlockRate = previous.followers > 0 ? (previous.blocks / previous.followers) * 100 : 0
  const isBlockWarning = blockRate > BLOCK_WARNING_THRESHOLD

  const totalDelivered = messages.reduce((acc, m) => acc + m.delivered, 0)
  const totalImpressions = messages.reduce((acc, m) => acc + m.unique_impressions, 0)
  const totalClicks = messages.reduce((acc, m) => acc + m.unique_clicks, 0)
  const openRate = totalDelivered > 0 ? (totalImpressions / totalDelivered) * 100 : 0
  const clickRate = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
  const avgOpenRate = messages.length > 0
    ? messages.reduce((acc, m) => acc + (m.delivered > 0 ? (m.unique_impressions / m.delivered) * 100 : 0), 0) / messages.length
    : 0
  const avgClickRate = messages.length > 0
    ? messages.reduce((acc, m) => acc + (m.unique_impressions > 0 ? (m.unique_clicks / m.unique_impressions) * 100 : 0), 0) / messages.length
    : 0

  // Top message (highest open rate)
  const topMsgIdx = messages.length > 0
    ? messages.reduce((best, m, i) => {
        const rate = m.delivered > 0 ? m.unique_impressions / m.delivered : 0
        const bestRate = messages[best].delivered > 0 ? messages[best].unique_impressions / messages[best].delivered : 0
        return rate > bestRate ? i : best
      }, 0)
    : -1

  const [msgPageSize, setMsgPageSize] = useState(10)
  const [expandedMsgIdx, setExpandedMsgIdx] = useState<number | null>(null)
  const toggleExpand = useCallback((idx: number) => {
    setExpandedMsgIdx((prev) => (prev === idx ? null : idx))
  }, [])
  const displayedMessages = messages.slice(0, msgPageSize)

  const chartData = trend.map((item) => ({
    month: item.date.slice(5),
    followers: item.followers,
    blocks: item.blocks,
  }))

  // Open rate & Click rate bar data per message
  const rateBarData = messages.map((m) => ({
    label: m.date.slice(5, 10),
    openRate: m.delivered > 0 ? Math.round((m.unique_impressions / m.delivered) * 10000) / 100 : 0,
    clickRate: m.unique_impressions > 0 ? Math.round((m.unique_clicks / m.unique_impressions) * 10000) / 100 : 0,
  }))

  // Heatmap data: day of week x hour for open rates
  const heatmapData = useMemo(() => {
    const countGrid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0))
    const rateGrid: number[][] = Array.from({ length: 7 }, () => Array(14).fill(0))
    for (const m of messages) {
      const dayIdx = m.day_of_week
      const hour = m.hour
      if (hour >= 8 && hour <= 21 && dayIdx >= 0 && dayIdx < 7) {
        const hourIdx = hour - 8
        countGrid[dayIdx][hourIdx]++
        const rate = m.delivered > 0 ? (m.unique_impressions / m.delivered) * 100 : 0
        rateGrid[dayIdx][hourIdx] = Math.max(rateGrid[dayIdx][hourIdx], rate)
      }
    }
    return { countGrid, rateGrid }
  }, [messages])

  // Weekly frequency data
  const frequencyData = useMemo(() => {
    const weekMap = new Map<string, number>()
    for (const m of messages) {
      const d = new Date(m.date)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diff)
      const weekKey = `${String(monday.getMonth() + 1).padStart(2, '0')}/${String(monday.getDate()).padStart(2, '0')}`
      weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1)
    }
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week: `${week}~`, count }))
  }, [messages])

  // Sort age data ascending by the starting age number
  const sortedAges = useMemo(() => {
    return [...demographic.ages].sort((a, b) => {
      const aNum = parseInt(a.label.replace(/[^\d]/g, ''), 10) || 0
      const bNum = parseInt(b.label.replace(/[^\d]/g, ''), 10) || 0
      return aNum - bNum
    })
  }, [demographic.ages])

  // Index of the highest percentage age group (for highlight)
  const topAgeIdx = useMemo(() => {
    let maxIdx = 0
    for (let i = 1; i < sortedAges.length; i++) {
      if (sortedAges[i].percentage > sortedAges[maxIdx].percentage) maxIdx = i
    }
    return maxIdx
  }, [sortedAges])

  return (
    <div className="animate-in fade-in duration-400">
      <Header title="LINE公式アカウント 分析" brandIcon={<LineIcon size={22} />} color="#00B900" lightBg="#E6F9E6" reportType="line" />

      {!loading && !hasAnyData && (
        <div className="mb-6 rounded-xl border border-border bg-card p-6 text-center">
          <span className="material-symbols-rounded text-4xl text-muted-foreground mb-2 block">link_off</span>
          <p className="text-sm font-medium text-foreground mb-1">LINEデータがありません</p>
          <p className="text-xs text-muted-foreground mb-4">
            LINE Messaging API の Channel Access Token を設定して接続テストを実行すると、友だち数・配信データが自動取得されます。
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: LINE_GREEN }}
          >
            <span className="material-symbols-rounded text-base">settings</span>
            API設定へ
          </Link>
        </div>
      )}

      {/* Friends KPI Cards */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          友だち指標
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-5">
          <KpiCard
            title="友だち数"
            value={current.followers}
            previousValue={previous.followers}
            color={LINE_GREEN}
          />
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: LINE_GREEN }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              友だち増減（前月比）
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {followerDiff >= 0 ? '+' : ''}{formatNumber(followerDiff)}
            </p>
            <div className="mt-2">
              <TrendBadge currentValue={current.followers} previousValue={previous.followers} />
            </div>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: LINE_DARK }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              友だち増減（6ヶ月比）
            </p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {halfYearFollowerDiff >= 0 ? '+' : ''}{formatNumber(halfYearFollowerDiff)}
            </p>
            {oldestTrend && (
              <div className="mt-2">
                <TrendBadge currentValue={current.followers} previousValue={oldestTrend.followers} />
              </div>
            )}
          </div>
          {/* Block Rate with Warning */}
          <div
            className={`relative overflow-hidden rounded-xl border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${
              isBlockWarning ? 'border-red-300' : 'border-border'
            }`}
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: isBlockWarning ? BLOCK_RED : '#F59E0B' }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">
              ブロック率
              {isBlockWarning && (
                <span className="ml-1.5 inline-block rounded-full bg-red-100 px-1.5 py-0 text-[10px] font-bold text-red-600">
                  要注意
                </span>
              )}
            </p>
            <p className={`text-2xl md:text-[34px] font-bold leading-tight ${
              isBlockWarning ? 'text-red-600' : 'text-foreground'
            }`}>
              {formatPercent(blockRate)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              許容範囲: 20%以下
              {blockRate <= 10 && <span className="text-success ml-1">優秀</span>}
              {blockRate > 10 && blockRate <= 20 && <span className="text-success ml-1">良好</span>}
              {blockRate > 20 && blockRate <= 30 && <span className="text-warning ml-1">要改善</span>}
              {blockRate > 30 && <span className="text-red-600 ml-1">要対策</span>}
            </p>
          </div>
          <KpiCard
            title="ターゲットリーチ"
            value={current.targeted_reaches}
            previousValue={previous.targeted_reaches}
            color={LINE_GREEN}
          />
        </div>
      </section>

      {/* Delivery Summary Section */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          配信サマリー
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-5">
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: LINE_GREEN }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">期間内配信回数</p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {messages.length}<span className="text-sm font-normal text-muted-foreground ml-1">回</span>
            </p>
          </div>
          <KpiCard title="配信数合計" value={totalDelivered} color={LINE_GREEN} />
          <KpiCard title="開封数合計" value={totalImpressions} color={LINE_GREEN} />
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: avgOpenRate >= BENCHMARK_OPEN_RATE ? '#22c55e' : '#F59E0B' }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">平均開封率</p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {formatPercent(avgOpenRate)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              業界平均: {BENCHMARK_OPEN_RATE}%
              {avgOpenRate >= BENCHMARK_OPEN_RATE ? (
                <span className="text-success ml-1">上回っています</span>
              ) : (
                <span className="text-warning ml-1">下回っています</span>
              )}
            </p>
          </div>
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
            style={{ boxShadow: CARD_SHADOW }}
          >
            <div className="absolute top-0 left-0 h-[3px] w-full" style={{ background: CLICK_BLUE }} />
            <p className="text-[11px] md:text-[13px] font-medium text-muted-foreground mb-1">平均クリック率</p>
            <p className="text-2xl md:text-[34px] font-bold text-foreground leading-tight">
              {formatPercent(avgClickRate)}
            </p>
          </div>
        </div>
      </section>

      {/* Chart Row */}
      <section className="mb-6 md:mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              友だち数推移（過去6ヶ月）
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={LINE_GREEN} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={LINE_GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="followers" name="友だち数" stroke={LINE_GREEN} fill="url(#lineGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              ブロック数推移（過去6ヶ月）
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="blocks" name="ブロック数" fill={BLOCK_RED} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Frequency & Heatmap Row */}
      <section className="mb-6 md:mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Delivery Frequency Chart */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              配信頻度（週別）
            </h3>
            <div className="h-[220px] md:h-[280px]">
              {frequencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frequencyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <ReferenceLine
                      y={1}
                      stroke={LINE_GREEN}
                      strokeDasharray="6 3"
                      strokeWidth={2}
                      label={{ value: '推奨: 週1回', position: 'right', fill: LINE_GREEN, fontSize: 11 }}
                    />
                    <Bar dataKey="count" name="配信回数" fill={LINE_GREEN} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">データなし</p>
              )}
            </div>
          </div>

          {/* Delivery Time Heatmap */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              配信時間帯ヒートマップ
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
                        const count = heatmapData.countGrid[dayIdx][hourIdx]
                        const rate = heatmapData.rateGrid[dayIdx][hourIdx]
                        const maxCount = Math.max(1, ...heatmapData.countGrid.flat())
                        const intensity = count / maxCount
                        return (
                          <td
                            key={hourIdx}
                            className="p-0.5"
                            title={`${day}曜 ${8 + hourIdx}時: ${count}件配信 (開封率: ${rate.toFixed(1)}%)`}
                          >
                            <div
                              className="w-full aspect-square rounded-sm transition-colors"
                              style={{
                                backgroundColor: count > 0
                                  ? `rgba(0, 185, 0, ${0.15 + intensity * 0.75})`
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
                      style={{ backgroundColor: `rgba(0, 185, 0, ${opacity})` }}
                    />
                  ))}
                </div>
                <span>多</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Message Performance Table */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                配信別パフォーマンス
              </h3>
              <span className="text-xs text-muted-foreground">{messages.length}件</span>
            </div>
            <PageSizeSelector
              total={messages.length}
              pageSize={msgPageSize}
              onChangePageSize={setMsgPageSize}
            />
          </div>
          {messages.length > 0 ? (
            <div className="relative">
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">種別</th>
                      <th className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap hidden sm:table-cell">タイトル</th>
                      {['配信日時', '配信数', '開封数', 'クリック数', '開封率', 'クリック率'].map((h) => (
                        <th key={h} className="text-left p-2 md:p-3 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedMessages.map((m, i) => {
                      const rowOpenRate = m.delivered > 0 ? (m.unique_impressions / m.delivered) * 100 : 0
                      const rowClickRate = m.unique_impressions > 0 ? (m.unique_clicks / m.unique_impressions) * 100 : 0
                      const isTop = i === topMsgIdx || (messages.indexOf(m) === topMsgIdx)
                      const isExpanded = expandedMsgIdx === i
                      const typeConfig = MSG_TYPE_CONFIG[m.message_type ?? 'text']
                      return (
                        <Fragment key={i}>
                        <tr
                          className={`hover:bg-muted/50 transition-colors cursor-pointer ${isTop ? 'bg-green-50/50' : ''} ${isExpanded ? 'bg-muted/30' : ''}`}
                          onClick={() => toggleExpand(i)}
                        >
                          {/* 種別バッジ */}
                          <td className="p-2 md:p-3 border-b border-border whitespace-nowrap">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                              style={{ backgroundColor: typeConfig.color }}
                            >
                              <span className="material-symbols-rounded text-[14px] leading-none sm:hidden">{typeConfig.icon}</span>
                              <span className="hidden sm:inline">{typeConfig.label}</span>
                            </span>
                          </td>
                          {/* タイトル（モバイル非表示） */}
                          <td className="p-2 md:p-3 border-b border-border text-foreground hidden sm:table-cell max-w-[200px]">
                            <span className="line-clamp-1">{m.title ?? '-'}</span>
                          </td>
                          <td className="p-2 md:p-3 border-b border-border text-foreground whitespace-nowrap">
                            {isTop && (
                              <span className="inline-block mr-1 rounded-full px-1.5 py-0 text-[10px] font-bold" style={{ background: '#E6F9E6', color: LINE_GREEN }}>
                                TOP
                              </span>
                            )}
                            {m.date.slice(5)} {String(m.hour).padStart(2, '0')}:00
                          </td>
                          <td className="p-2 md:p-3 border-b border-border text-foreground">{formatNumber(m.delivered)}</td>
                          <td className="p-2 md:p-3 border-b border-border text-foreground">{formatNumber(m.unique_impressions)}</td>
                          <td className="p-2 md:p-3 border-b border-border text-foreground">{formatNumber(m.unique_clicks)}</td>
                          <td className="p-2 md:p-3 border-b border-border">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                              rowOpenRate >= BENCHMARK_OPEN_RATE ? 'bg-line-light text-line-green' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {formatPercent(rowOpenRate)}
                            </span>
                          </td>
                          <td className="p-2 md:p-3 border-b border-border">
                            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold bg-summary-light text-summary">
                              {formatPercent(rowClickRate)}
                            </span>
                          </td>
                        </tr>
                        {/* 展開行 */}
                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={8} className="p-3 md:p-4 border-b border-border">
                              <div className="flex flex-col gap-2 text-sm">
                                {/* モバイルではタイトルも表示 */}
                                {m.title && (
                                  <div>
                                    <span className="text-xs font-semibold text-muted-foreground mr-2">タイトル:</span>
                                    <span className="text-foreground font-medium">{m.title}</span>
                                  </div>
                                )}
                                {m.body_preview && (
                                  <div>
                                    <span className="text-xs font-semibold text-muted-foreground mr-2">本文:</span>
                                    <span className="text-foreground">{m.body_preview}</span>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                                  <span className="inline-flex items-center gap-1">
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                                      style={{ backgroundColor: typeConfig.color }}
                                    >
                                      {typeConfig.label}
                                    </span>
                                  </span>
                                  <span>配信日: {m.date}</span>
                                  <span>時刻: {String(m.hour).padStart(2, '0')}:00</span>
                                  <span>曜日: {DAY_LABELS[m.day_of_week]}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30">
                      <td colSpan={3} className="p-2 md:p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">合計 / 平均</td>
                      <td className="p-2 md:p-3 text-sm font-bold text-foreground">{formatNumber(totalDelivered)}</td>
                      <td className="p-2 md:p-3 text-sm font-bold text-foreground">{formatNumber(totalImpressions)}</td>
                      <td className="p-2 md:p-3 text-sm font-bold text-foreground">{formatNumber(totalClicks)}</td>
                      <td className="p-2 md:p-3">
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold bg-line-light text-line-green">
                          {formatPercent(openRate)}
                        </span>
                      </td>
                      <td className="p-2 md:p-3">
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold bg-summary-light text-summary">
                          {formatPercent(clickRate)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {msgPageSize < messages.length && (
                <div className="flex justify-center pt-3 border-t border-border mt-2">
                  <button
                    onClick={() => setMsgPageSize(messages.length)}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    すべて表示（{messages.length}件）
                  </button>
                </div>
              )}
              <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-card to-transparent md:hidden" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">メッセージ配信データがありません。</p>
          )}
        </div>
      </section>

      {/* Open Rate & Click Rate Trend Charts */}
      <section className="mb-6 md:mb-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Open Rate Trend */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                開封率トレンド（配信別）
              </h3>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-8 h-[2px]" style={{ borderTop: '2px dashed #f59e0b' }}></span>
                業界平均 {BENCHMARK_OPEN_RATE}%
              </span>
            </div>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rateBarData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} unit="%" axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, '開封率']}
                  />
                  <ReferenceLine
                    y={BENCHMARK_OPEN_RATE}
                    stroke="#f59e0b"
                    strokeDasharray="6 3"
                    strokeWidth={2}
                  />
                  <Bar dataKey="openRate" name="開封率" fill={LINE_GREEN} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Click Rate Trend */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              クリック率トレンド（配信別）
            </h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rateBarData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${Number(value).toFixed(1)}%`, 'クリック率']}
                  />
                  <Bar dataKey="clickRate" name="クリック率" fill={CLICK_BLUE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Demographics Section */}
      <section>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          友だち属性分析
        </h3>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Gender - Donut Chart */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h4 className="mb-3 text-xs font-semibold text-muted-foreground">性別分布</h4>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demographic.genders}
                    dataKey="percentage"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                    label={false}
                  >
                    {demographic.genders.map((_, i) => (
                      <Cell key={i} fill={GENDER_COLORS[i] ?? DEMO_COLORS[i % DEMO_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}%`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend below chart */}
            <div className="flex justify-center gap-6 mt-2">
              {demographic.genders.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: GENDER_COLORS[i] ?? DEMO_COLORS[i % DEMO_COLORS.length] }} />
                  <span className="text-sm font-semibold text-foreground">{g.label}</span>
                  <span className="text-sm font-bold" style={{ color: GENDER_COLORS[i] ?? DEMO_COLORS[i % DEMO_COLORS.length] }}>{g.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Age - Horizontal Bar (sorted ascending by age) */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h4 className="mb-3 text-xs font-semibold text-muted-foreground">年齢分布</h4>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedAges} layout="vertical" margin={{ left: 8, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                  <XAxis type="number" unit="%" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}%`, '割合']} />
                  <Bar dataKey="percentage" name="割合" fill={LINE_GREEN} radius={[0, 4, 4, 0]}>
                    {sortedAges.map((_, i) => (
                      <Cell key={i} fill={i === topAgeIdx ? LINE_GREEN : '#86EFAC'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Area - Horizontal Bar Chart */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h4 className="mb-3 text-xs font-semibold text-muted-foreground">地域分布</h4>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographic.areas} layout="vertical" margin={{ left: 8, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                  <XAxis type="number" unit="%" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="label" tick={{ fill: TICK_COLOR, fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}%`, '割合']} />
                  <Bar dataKey="percentage" name="割合" radius={[0, 4, 4, 0]}>
                    {demographic.areas.map((_, i) => (
                      <Cell key={i} fill={AREA_COLORS[i] ?? '#86EFAC'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
