import { useState } from 'react'
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
import { getMockDataForMonth } from '@/utils/mockData'
import { formatNumber, formatPercent } from '@/utils/format'
import PageSizeSelector from '@/components/common/PageSizeSelector'

const GA4_BLUE = '#4285F4'

const PIE_COLORS = ['#F9AB00', '#4285F4', '#34A853', '#EA4335', '#AB47BC']
const DEVICE_COLORS = ['#4285F4', '#34A853', '#F9AB00']
const REGION_COLORS = ['#EA4335', '#4285F4', '#34A853', '#F9AB00', '#AB47BC']

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

const BOUNCE_BENCHMARK = 56
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export default function GA4() {
  const { selectedMonth } = useMonth()
  const [pageRankSize, setPageRankSize] = useState(5)
  const data = getMockDataForMonth(selectedMonth).ga4

  const current = data.current
  const previous = data.previous
  const trend = data.trend
  const trafficSources = data.trafficSources
  const pages = data.pages
  const demographic = data.demographic
  const hourlySessions = data.hourlySessions

  const avgBounceRate = current.bounce_rate
  const displayedPages = pages.slice(0, pageRankSize)

  const trendChartData = trend.map((item) => ({
    month: item.date.slice(5),
    sessions: item.sessions,
    active_users: item.active_users,
    new_users: item.new_users,
    bounce_rate: parseFloat(item.bounce_rate.toFixed(1)),
    conversions: item.conversions,
  }))

  const pieData = trafficSources.map((s) => ({
    name: s.channel,
    value: s.sessions,
  }))

  // Heatmap: find max for opacity calculation
  const maxSessions = Math.max(...hourlySessions.map((h) => h.sessions))
  const hours = Array.from({ length: 15 }, (_, i) => i + 8) // 8-22

  // Age chart data
  const ageData = demographic.ages.map((a) => ({
    name: a.label,
    value: a.percentage,
  }))

  return (
    <div className="animate-in fade-in duration-400">
      <Header title="Google Analytics 4 分析" brandIcon={<GA4Icon size={22} />} color="#4285F4" lightBg="#EBF2FF" reportType="ga4" />

      {/* Acquisition KPI Cards */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          集客指標
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-5 lg:grid-cols-5">
          <KpiCard title="セッション数" value={current.sessions} previousValue={previous.sessions} color={GA4_BLUE} />
          <KpiCard title="アクティブユーザー" value={current.active_users} previousValue={previous.active_users} color={GA4_BLUE} />
          <KpiCard title="新規ユーザー" value={current.new_users} previousValue={previous.new_users} color={GA4_BLUE} />
          <KpiCard title="コンバージョン" value={current.conversions} previousValue={previous.conversions} color="#34A853" />
          <KpiCard title="平均直帰率" value={formatPercent(avgBounceRate)} previousValue={previous.bounce_rate} color="#EA4335" />
        </div>
      </section>

      {/* Sessions / Users Trend Line Chart */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            セッション数・ユーザー数推移（過去6ヶ月）
          </h3>
          <div className="h-[220px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Line type="monotone" dataKey="sessions" name="セッション" stroke="#F9AB00" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="active_users" name="アクティブユーザー" stroke="#4285F4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="new_users" name="新規ユーザー" stroke="#34A853" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Traffic Source Row */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          流入チャネル
        </h3>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">流入チャネル別割合</h3>
            <div className="h-[220px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="70%"
                    label={(entry) => (entry as { name: string }).name}
                    labelLine={true}
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
                    <th className="pb-2 md:pb-3 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">チャネル</th>
                    <th className="pb-2 md:pb-3 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">セッション</th>
                    <th className="pb-2 md:pb-3 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">ユーザー</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trafficSources.map((source, i) => (
                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2 md:py-3 pr-4 text-foreground font-medium flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        {source.channel}
                      </td>
                      <td className="py-2 md:py-3 text-right text-foreground">{formatNumber(source.sessions)}</td>
                      <td className="py-2 md:py-3 text-right text-foreground">{formatNumber(source.users)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* User Attribute Analysis */}
      <section className="mb-6 md:mb-8">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          ユーザー属性分析
        </h3>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Device */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">デバイス別</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demographic.devices.map((d) => ({ name: d.label, value: d.percentage }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    label={(entry) => `${(entry as { name: string }).name} ${(entry as { value: number }).value}%`}
                    labelLine={true}
                  >
                    {demographic.devices.map((_d, i) => (
                      <Cell key={i} fill={DEVICE_COLORS[i % DEVICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}%`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Age */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">年齢層別</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
                  <XAxis type="number" unit="%" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: TICK_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}%`, '']} />
                  <Bar dataKey="value" fill={GA4_BLUE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Region */}
          <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
            <h3 className="mb-4 text-sm font-semibold text-muted-foreground">地域別</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demographic.regions.map((r) => ({ name: r.label, value: r.percentage }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="40%"
                    outerRadius="70%"
                    label={(entry) => `${(entry as { name: string }).name} ${(entry as { value: number }).value}%`}
                    labelLine={true}
                  >
                    {demographic.regions.map((_r, i) => (
                      <Cell key={i} fill={REGION_COLORS[i % REGION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}%`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Session Time Heatmap */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            セッション時間帯ヒートマップ
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
                      const cell = hourlySessions.find((s) => s.day_of_week === dow && s.hour === h)
                      const val = cell?.sessions ?? 0
                      const opacity = maxSessions > 0 ? Math.max(0.08, val / maxSessions) : 0
                      return (
                        <td
                          key={h}
                          className="text-center rounded cursor-default"
                          style={{
                            background: `rgba(66, 133, 244, ${opacity})`,
                            color: opacity > 0.5 ? '#fff' : 'var(--foreground)',
                            padding: '4px 0',
                            minWidth: 28,
                          }}
                          title={`${dayLabel} ${h}:00 - ${val}セッション`}
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
                <div key={o} className="w-4 h-3 rounded-sm" style={{ background: `rgba(66, 133, 244, ${o})` }} />
              ))}
            </div>
            <span>多</span>
          </div>
        </div>
      </section>

      {/* Page Ranking Table */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              人気ページランキング
            </h3>
            <PageSizeSelector
              total={pages.length}
              pageSize={pageRankSize}
              onChangePageSize={setPageRankSize}
            />
          </div>
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 md:pb-3 w-8 text-center text-xs uppercase tracking-wider text-muted-foreground font-medium">#</th>
                    <th className="pb-2 md:pb-3 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">ページパス</th>
                    <th className="pb-2 md:pb-3 text-left text-xs uppercase tracking-wider text-muted-foreground font-medium">ページタイトル</th>
                    <th className="pb-2 md:pb-3 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium">PV</th>
                    <th className="pb-2 md:pb-3 text-right text-xs uppercase tracking-wider text-muted-foreground font-medium hidden sm:table-cell">滞在時間(秒)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedPages.map((page, i) => (
                    <tr key={i} className="hover:bg-muted/50 transition-colors">
                      <td className="py-2 md:py-3 text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                          style={{
                            background:
                              i === 0 ? 'rgba(249,171,0,0.15)'
                                : i === 1 ? 'rgba(66,133,244,0.15)'
                                : i === 2 ? 'rgba(52,168,83,0.15)'
                                : 'var(--muted)',
                            color:
                              i === 0 ? '#F9AB00'
                                : i === 1 ? '#4285F4'
                                : i === 2 ? '#34A853'
                                : 'var(--muted-foreground)',
                          }}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2 md:py-3 pr-4 hidden md:table-cell">
                        <code className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
                          {page.page_path}
                        </code>
                      </td>
                      <td className="py-2 md:py-3 pr-4 text-foreground whitespace-nowrap">{page.page_title}</td>
                      <td className="py-2 md:py-3 text-right text-foreground">{formatNumber(page.page_views)}</td>
                      <td className="py-2 md:py-3 text-right text-muted-foreground hidden sm:table-cell">{page.avg_time_on_page.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              {pageRankSize < pages.length && (
                <div className="flex justify-center pt-3 border-t border-border mt-2">
                  <button
                    onClick={() => setPageRankSize(pages.length)}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    すべて表示（{pages.length}件）
                  </button>
                </div>
              )}
            <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-card to-transparent md:hidden" />
          </div>
        </div>
      </section>

      {/* Bounce Rate Trend with Benchmark */}
      <section className="mb-6 md:mb-8">
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              直帰率トレンド（過去6ヶ月）
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-medium">
              業界平均 {BOUNCE_BENCHMARK}%
            </span>
          </div>
          <div className="h-[220px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData}>
                <defs>
                  <linearGradient id="bounceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EA4335" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#EA4335" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} unit="%" domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => [`${value}%`, '直帰率']}
                />
                <ReferenceLine y={BOUNCE_BENCHMARK} stroke="#EA4335" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: `業界平均 ${BOUNCE_BENCHMARK}%`, position: 'insideTopRight', fill: '#EA4335', fontSize: 11 }} />
                <Area type="monotone" dataKey="bounce_rate" name="直帰率" stroke="#EA4335" fill="url(#bounceGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Conversion Trend */}
      <section>
        <div className="rounded-xl border border-border bg-card p-4 md:p-6" style={{ boxShadow: CARD_SHADOW }}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            コンバージョン数推移（過去6ヶ月）
          </h3>
          <div className="h-[220px] md:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: TICK_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="conversions" name="コンバージョン" fill="#34A853" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  )
}
