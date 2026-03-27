import { useState, useEffect } from 'react'
import {
  fetchStores,
  fetchInstagramMetrics,
  fetchInstagramPosts,
  fetchLineMetrics,
  fetchLineMessages,
  fetchGA4Metrics,
  getDateRangeForMonth,
  aggregateMonthly,
  type Store,
} from '@/utils/api'
import type { InstagramInsight } from '@/types/instagram'
import type { LineFollowerInsight, LineMessageInsight } from '@/types/line'
import type { GA4Metric } from '@/types/ga4'

// Store colors
export const STORE_COLORS = ['#C06A30', '#2E8B6A', '#5B78A8', '#B8534B', '#8B6CAD', '#6A9B50']

export interface StoreData {
  store: Store
  color: string
  ig: {
    current: InstagramInsight
    previous: InstagramInsight
    trend: InstagramInsight[]
    postCount: number
    engRate: number
  }
  ga4: {
    current: GA4Metric
    previous: GA4Metric
    trend: GA4Metric[]
  }
}

export interface MultiStoreResult {
  stores: StoreData[]
  line: {
    current: LineFollowerInsight
    previous: LineFollowerInsight
    messages: LineMessageInsight[]
    trend: LineFollowerInsight[]
  }
  loading: boolean
}

export function useMultiStoreData(selectedMonth: string): MultiStoreResult {
  const [result, setResult] = useState<MultiStoreResult>({
    stores: [],
    line: {
      current: { date: selectedMonth, followers: 0, targeted_reaches: 0, blocks: 0 },
      previous: { date: selectedMonth, followers: 0, targeted_reaches: 0, blocks: 0 },
      messages: [],
      trend: [],
    },
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const storeList = await fetchStores()
        if (cancelled || storeList.length === 0) {
          setResult(prev => ({ ...prev, loading: false }))
          return
        }

        const { start6, end, currentStart, currentEnd, previousStart, previousEnd } = getDateRangeForMonth(selectedMonth)
        const prevMonth = previousStart.slice(0, 7)

        // LINE OAは全社共通アカウント。最初の店舗IDで取得する。
        // 全店舗が同一LINE OAを共有しているため、どの店舗IDでも同じデータが返る。
        // 将来的にはstoresテーブルのline_oa_account_idを参照すべきだが、
        // 現状のアーキテクチャでは店舗IDをキーにAPIを呼ぶ設計のためこの形で取得する。
        const [lineMetricsRaw, lineMessagesRaw] = await Promise.all([
          fetchLineMetrics(storeList[0].id, start6, end),
          fetchLineMessages(storeList[0].id, currentStart, currentEnd),
        ])
        const lineMonthly = aggregateMonthly(lineMetricsRaw, 'date', [], ['followers', 'blocks', 'targeted_reaches'])
        const lineCurrent = lineMonthly.find(m => m.date === selectedMonth)
        const linePrevious = lineMonthly.find(m => m.date === prevMonth)
        const emptyLine: LineFollowerInsight = { date: selectedMonth, followers: 0, targeted_reaches: 0, blocks: 0 }

        // Fetch per-store data in parallel
        const storeDataPromises = storeList.map(async (store, idx) => {
          const [igMetrics, igPosts, ga4Metrics] = await Promise.all([
            fetchInstagramMetrics(store.id, start6, end),
            fetchInstagramPosts(store.id, 50),
            fetchGA4Metrics(store.id, start6, end),
          ])

          const igMonthly = aggregateMonthly(igMetrics, 'date', [], ['followers_count'])
          const ga4Monthly = aggregateMonthly(ga4Metrics, 'date', ['bounce_rate', 'avg_session_duration'])

          const igCurrent = igMonthly.find(m => m.date === selectedMonth)
          const igPrev = igMonthly.find(m => m.date === prevMonth)
          const ga4Current = ga4Monthly.find(m => m.date === selectedMonth)
          const ga4Prev = ga4Monthly.find(m => m.date === prevMonth)

          const emptyIg: InstagramInsight = { date: selectedMonth, followers_count: 0, reach: 0, impressions: 0, profile_views: 0, website_clicks: 0 }
          const emptyGa4: GA4Metric = { date: selectedMonth, sessions: 0, active_users: 0, new_users: 0, page_views: 0, bounce_rate: 0, avg_session_duration: 0, conversions: 0 }

          // Calculate engagement rate from posts in selected month
          const monthPosts = igPosts.filter(p => p.timestamp.slice(0, 7) === selectedMonth)
          const totalEng = monthPosts.reduce((sum, p) => {
            const isStory = p.media_product_type === 'STORY'
            return sum + (isStory ? (p.replies ?? 0) + (p.taps_back ?? 0) : p.like_count + p.comments_count + p.saved + p.shares)
          }, 0)
          const currentReach = (igCurrent ?? emptyIg).reach
          const engRate = currentReach > 0 ? (totalEng / currentReach) * 100 : 0

          return {
            store,
            color: STORE_COLORS[idx % STORE_COLORS.length],
            ig: {
              current: igCurrent ?? emptyIg,
              previous: igPrev ?? emptyIg,
              trend: igMonthly,
              postCount: monthPosts.length,
              engRate: Math.round(engRate * 100) / 100,
            },
            ga4: {
              current: ga4Current ?? emptyGa4,
              previous: ga4Prev ?? emptyGa4,
              trend: ga4Monthly,
            },
          } as StoreData
        })

        const storesData = await Promise.all(storeDataPromises)
        if (cancelled) return

        setResult({
          stores: storesData,
          line: {
            current: lineCurrent ?? emptyLine,
            previous: linePrevious ?? emptyLine,
            messages: lineMessagesRaw,
            trend: lineMonthly,
          },
          loading: false,
        })
      } catch (err) {
        console.warn('Multi-store fetch failed:', err)
        if (!cancelled) setResult(prev => ({ ...prev, loading: false }))
      }
    }

    load()
    return () => { cancelled = true }
  }, [selectedMonth])

  return result
}
