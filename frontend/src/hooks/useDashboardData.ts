/**
 * Hook to fetch dashboard data from the API with mock data fallback.
 * Replaces direct `getMockDataForMonth()` calls in page components.
 */

import { useState, useEffect, useRef } from 'react'
import {
  fetchStores,
  fetchInstagramMetrics,
  fetchInstagramPosts,
  fetchLineMetrics,
  fetchLineMessages,
  fetchGA4Metrics,
  fetchGA4TrafficSources,
  fetchGA4Pages,
  fetchGBPMetrics,
  getDateRangeForMonth,
  aggregateMonthly,
  type Store,
} from '@/utils/api'
import { getMockDataForMonth } from '@/utils/mockData'

type DashboardData = ReturnType<typeof getMockDataForMonth>

interface UseDashboardDataResult {
  data: DashboardData
  loading: boolean
  error: string | null
  stores: Store[]
}

/**
 * Fetch data for a given month and store index.
 * Falls back to mock data if the API is unavailable.
 */
export function useDashboardData(
  selectedMonth: string,
  storeIndex = 0,
): UseDashboardDataResult {
  const [data, setData] = useState<DashboardData>(() =>
    getMockDataForMonth(selectedMonth, storeIndex),
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
          // No stores in DB - use mock data
          setData(getMockDataForMonth(selectedMonth, storeIndex))
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
          ga4MetricsRaw,
          ga4Sources,
          ga4Pages,
          gbpMetricsRaw,
        ] = await Promise.all([
          fetchInstagramMetrics(storeId, start6, end),
          fetchInstagramPosts(storeId, 50),
          fetchLineMetrics(storeId, start6, end),
          fetchLineMessages(storeId, currentStart, currentEnd),
          fetchGA4Metrics(storeId, start6, end),
          fetchGA4TrafficSources(storeId, currentStart, currentEnd),
          fetchGA4Pages(storeId, currentStart, currentEnd),
          fetchGBPMetrics(storeId, start6, end),
        ])

        if (cancelled) return

        // Aggregate daily data into monthly for trend display
        const igMonthly = aggregateMonthly(igMetricsRaw, 'date', [])
        const lineMonthly = aggregateMonthly(lineMetricsRaw, 'date', [])
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

        // If we have no data from the API at all, fall back to mock
        const hasData = igMonthly.length > 0 || lineMonthly.length > 0 ||
          ga4Monthly.length > 0 || gbpMonthly.length > 0
        if (!hasData) {
          setData(getMockDataForMonth(selectedMonth, storeIndex))
          setLoading(false)
          return
        }

        // Use mock data as defaults for missing pieces
        const mockData = getMockDataForMonth(selectedMonth, storeIndex)

        const result: DashboardData = {
          instagram: {
            current: igCurrent ?? mockData.instagram.current,
            previous: igPrevious ?? mockData.instagram.previous,
            trend: igMonthly.length > 0 ? igMonthly : mockData.instagram.trend,
            posts: igPosts.length > 0 ? igPosts : mockData.instagram.posts,
          },
          line: {
            current: lineCurrent ?? mockData.line.current,
            previous: linePrevious ?? mockData.line.previous,
            trend: lineMonthly.length > 0 ? lineMonthly : mockData.line.trend,
            messages: lineMessagesRaw.length > 0 ? lineMessagesRaw : mockData.line.messages,
            demographic: mockData.line.demographic, // API doesn't provide demographics
          },
          ga4: {
            current: ga4Current ?? mockData.ga4.current,
            previous: ga4Previous ?? mockData.ga4.previous,
            trend: ga4Monthly.length > 0 ? ga4Monthly : mockData.ga4.trend,
            trafficSources: ga4Sources.length > 0 ? ga4Sources : mockData.ga4.trafficSources,
            pages: ga4Pages.length > 0 ? ga4Pages : mockData.ga4.pages,
            demographic: mockData.ga4.demographic, // API doesn't provide demographics
            hourlySessions: mockData.ga4.hourlySessions, // API doesn't provide hourly data
          },
          gbp: {
            current: gbpCurrent ?? mockData.gbp.current,
            previous: gbpPrevious ?? mockData.gbp.previous,
            trend: gbpMonthly.length > 0 ? gbpMonthly : mockData.gbp.trend,
            reviews: mockData.gbp.reviews, // API doesn't provide reviews yet
            ratingDistribution: mockData.gbp.ratingDistribution,
            hourlyActions: mockData.gbp.hourlyActions,
          },
        }

        setData(result)
      } catch (err) {
        if (cancelled) return
        console.warn('API fetch failed, using mock data:', err)
        setError(err instanceof Error ? err.message : 'API error')
        setData(getMockDataForMonth(selectedMonth, storeIndex))
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
