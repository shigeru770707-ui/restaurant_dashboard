/**
 * Hook to fetch dashboard data from the API.
 * All platforms use real API data only (no mock fallback).
 */

import { useState, useEffect, useRef } from 'react'
import {
  fetchStores,
  fetchInstagramMetrics,
  fetchInstagramPosts,
  fetchLineMetrics,
  fetchLineMessages,
  fetchLineDemographics,
  fetchGA4Metrics,
  fetchGA4TrafficSources,
  fetchGA4Pages,
  fetchGBPMetrics,
  getDateRangeForMonth,
  aggregateMonthly,
  type Store,
} from '@/utils/api'
import type { InstagramInsight, InstagramPost } from '@/types/instagram'
import type { GA4Metric, GA4TrafficSource, GA4Page } from '@/types/ga4'
import type { GBPMetric } from '@/types/gbp'
import type { LineFollowerInsight, LineMessageInsight } from '@/types/line'

interface DashboardData {
  instagram: {
    current: InstagramInsight
    previous: InstagramInsight
    trend: InstagramInsight[]
    posts: InstagramPost[]
  }
  line: {
    current: LineFollowerInsight
    previous: LineFollowerInsight
    trend: LineFollowerInsight[]
    messages: LineMessageInsight[]
    demographic: { genders: { label: string; percentage: number }[]; ages: { label: string; percentage: number }[]; areas: { label: string; percentage: number }[] }
  }
  ga4: {
    current: GA4Metric
    previous: GA4Metric
    trend: GA4Metric[]
    trafficSources: GA4TrafficSource[]
    pages: GA4Page[]
    demographic: { genders: { label: string; percentage: number }[]; ages: { label: string; percentage: number }[]; areas: { label: string; percentage: number }[] }
    hourlySessions: { hour: number; sessions: number }[]
  }
  gbp: {
    current: GBPMetric
    previous: GBPMetric
    trend: GBPMetric[]
    reviews: { author: string; rating: number; text: string; date: string; hasReply: boolean }[]
    ratingDistribution: { rating: number; count: number }[]
    hourlyActions: { hour: number; actions: number }[]
  }
}

interface UseDashboardDataResult {
  data: DashboardData
  loading: boolean
  error: string | null
  stores: Store[]
}

/** Build initial empty data (no mock fallback for any platform). */
function getInitialData(month: string, _storeIndex: number): DashboardData {
  const emptyLine = { date: month, followers: 0, targeted_reaches: 0, blocks: 0 }
  const emptyIg = { date: month, followers_count: 0, reach: 0, impressions: 0, profile_views: 0, website_clicks: 0 }
  const emptyGa4 = { date: month, sessions: 0, active_users: 0, new_users: 0, page_views: 0, bounce_rate: 0, avg_session_duration: 0, conversions: 0 }
  const emptyGbp = { date: month, queries_direct: 0, queries_indirect: 0, views_maps: 0, views_search: 0, actions_website: 0, actions_phone: 0, actions_directions: 0 }
  return {
    instagram: { current: emptyIg, previous: emptyIg, trend: [], posts: [] },
    line: { current: emptyLine, previous: emptyLine, trend: [], messages: [], demographic: { genders: [], ages: [], areas: [] } },
    ga4: { current: emptyGa4, previous: emptyGa4, trend: [], trafficSources: [], pages: [], demographic: { genders: [], ages: [], areas: [] }, hourlySessions: [] },
    gbp: { current: emptyGbp, previous: emptyGbp, trend: [], reviews: [], ratingDistribution: [], hourlyActions: [] },
  }
}

/**
 * Fetch data for a given month and store index.
 * LINE uses real API data only (no mock fallback).
 */
export function useDashboardData(
  selectedMonth: string,
  storeIndex = 0,
): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData>(() =>
    getInitialData(selectedMonth, storeIndex),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        // First, fetch stores to resolve store_id
        const storeList = await fetchStores()
        if (cancelled) return
        setStores(storeList)

        if (storeList.length === 0) {
          // No stores in DB - use initial data (LINE empty, others mock)
          setData(getInitialData(selectedMonth, storeIndex))
          setLoading(false)
          return
        }

        const store = storeList[Math.min(storeIndex, storeList.length - 1)]
        const storeId = store.id
        const { start6, end, currentStart, currentEnd, previousStart, previousEnd } =
          getDateRangeForMonth(selectedMonth)

        // Fetch all data in parallel
        const [
          igMetricsRaw,
          igPosts,
          lineMetricsRaw,
          lineMessagesRaw,
          lineDemoData,
          ga4MetricsRaw,
          ga4Sources,
          ga4Pages,
          gbpMetricsRaw,
        ] = await Promise.all([
          fetchInstagramMetrics(storeId, start6, end),
          fetchInstagramPosts(storeId, 100), // 投稿取得上限。月間投稿数が多い場合は増やす
          fetchLineMetrics(storeId, start6, end),
          fetchLineMessages(storeId, currentStart, currentEnd),
          fetchLineDemographics(storeId),
          fetchGA4Metrics(storeId, start6, end),
          fetchGA4TrafficSources(storeId, currentStart, currentEnd),
          fetchGA4Pages(storeId, currentStart, currentEnd),
          fetchGBPMetrics(storeId, start6, end),
        ])

        if (cancelled) return

        // Aggregate daily data into monthly for trend display
        // Note: snapshot/cumulative fields (followers, blocks, followers_count) must use
        // the last value of the month, not a sum. Pass them as lastFields.
        // NOTE: reach は日次リーチのSUM。月間ユニークリーチとは異なる（過大評価の可能性）。
        // Instagram APIで月間ユニークリーチを別途取得する必要があるため現状維持。
        const igMonthly = aggregateMonthly(igMetricsRaw, 'date', [], ['followers_count'])
        const lineMonthly = aggregateMonthly(lineMetricsRaw, 'date', [], ['followers', 'blocks', 'targeted_reaches'])
        const ga4Monthly = aggregateMonthly(ga4MetricsRaw, 'date', ['bounce_rate', 'avg_session_duration'])
        const gbpMonthly = aggregateMonthly(gbpMetricsRaw, 'date', [])

        // Find current and previous month data
        const igCurrent = igMonthly.find((m) => m.date === selectedMonth)
        const igPrevMonth = previousStart.slice(0, 7)
        const igPrevious = igMonthly.find((m) => m.date === igPrevMonth)

        const lineCurrent = lineMonthly.find((m) => m.date === selectedMonth)
        const linePrevious = lineMonthly.find((m) => m.date === igPrevMonth)

        const ga4Current = ga4Monthly.find((m) => m.date === selectedMonth)
        const ga4Previous = ga4Monthly.find((m) => m.date === igPrevMonth)

        const gbpCurrent = gbpMonthly.find((m) => m.date === selectedMonth)
        const gbpPrevious = gbpMonthly.find((m) => m.date === igPrevMonth)

        // If we have no data from the API at all, use initial defaults
        const hasData = igMonthly.length > 0 || lineMonthly.length > 0 ||
          ga4Monthly.length > 0 || gbpMonthly.length > 0
        if (!hasData) {
          setData(getInitialData(selectedMonth, storeIndex))
          setLoading(false)
          return
        }

        // Empty defaults (no mock fallback)
        const emptyLineInsight = { date: selectedMonth, followers: 0, targeted_reaches: 0, blocks: 0 }
        const emptyIgInsight = { date: selectedMonth, followers_count: 0, reach: 0, impressions: 0, profile_views: 0, website_clicks: 0 }
        const emptyGa4Metric = { date: selectedMonth, sessions: 0, active_users: 0, new_users: 0, page_views: 0, bounce_rate: 0, avg_session_duration: 0, conversions: 0 }
        const emptyGbpMetric = { date: selectedMonth, queries_direct: 0, queries_indirect: 0, views_maps: 0, views_search: 0, actions_website: 0, actions_phone: 0, actions_directions: 0 }

        const result: DashboardData = {
          instagram: {
            current: igCurrent ?? emptyIgInsight,
            previous: igPrevious ?? emptyIgInsight,
            trend: igMonthly,
            posts: igPosts,
          },
          line: {
            current: lineCurrent ?? emptyLineInsight,
            previous: linePrevious ?? emptyLineInsight,
            trend: lineMonthly.length > 0 ? lineMonthly : [],
            messages: lineMessagesRaw,
            demographic: lineDemoData ? {
              genders: lineDemoData.genders
                .filter((g) => g.label !== 'unknown')
                .map((g) => ({
                  label: g.label === 'male' ? '男性' : g.label === 'female' ? '女性' : 'その他',
                  percentage: g.percentage,
                })),
              ages: lineDemoData.ages
                .filter((a) => a.label !== 'unknown' && /^from\d+to\d+$/.test(a.label))
                .map((a) => ({
                  label: a.label.replace(/^from(\d+)to(\d+)$/, '$1-$2歳'),
                  percentage: a.percentage,
                })),
              areas: lineDemoData.areas
                .filter((a) => a.label !== 'unknown')
                .slice(0, 8)
                .map((a) => ({
                  label: a.label,
                  percentage: a.percentage,
                })),
            } : { genders: [], ages: [], areas: [] },
          },
          ga4: {
            current: ga4Current ?? emptyGa4Metric,
            previous: ga4Previous ?? emptyGa4Metric,
            trend: ga4Monthly,
            trafficSources: ga4Sources,
            pages: ga4Pages,
            demographic: { genders: [], ages: [], areas: [] },
            hourlySessions: [],
          },
          gbp: {
            current: gbpCurrent ?? emptyGbpMetric,
            previous: gbpPrevious ?? emptyGbpMetric,
            trend: gbpMonthly,
            reviews: [],
            ratingDistribution: [],
            hourlyActions: [],
          },
        }

        setData(result)
      } catch (err) {
        if (cancelled) return
        console.warn('API fetch failed:', err)
        setError(err instanceof Error ? err.message : 'API error')
        setData(getInitialData(selectedMonth, storeIndex))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selectedMonth, storeIndex])

  return { data, loading, error, stores }
}
