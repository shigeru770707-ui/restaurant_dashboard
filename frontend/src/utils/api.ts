/**
 * API client for fetching data from the backend.
 * All endpoints are proxied via Nginx: /api/* -> backend:8000
 * Falls back to mock data on error.
 */

import type { InstagramInsight, InstagramPost } from '@/types/instagram'
import type { LineFollowerInsight, LineMessageInsight } from '@/types/line'
import type { GA4Metric, GA4TrafficSource, GA4Page } from '@/types/ga4'
import type { GBPMetric } from '@/types/gbp'

const BASE = '/api'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

// ---------- stores ----------

export interface Store {
  id: number
  name: string
  store_key: string
}

export async function fetchStores(): Promise<Store[]> {
  return fetchJson<Store[]>(`${BASE}/stores`)
}

// ---------- Instagram ----------

export async function fetchInstagramMetrics(
  storeId: number,
  startDate: string,
  endDate: string,
): Promise<InstagramInsight[]> {
  const params = new URLSearchParams({ store_id: String(storeId), start_date: startDate, end_date: endDate })
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/metrics/instagram_metrics?${params}`,
  )
  return raw.map((r) => ({
    date: String(r.date ?? '').slice(0, 7), // YYYY-MM
    followers_count: Number(r.followers_count ?? 0),
    reach: Number(r.reach ?? 0),
    impressions: Number(r.views ?? 0),
    profile_views: Number(r.profile_views ?? 0),
    website_clicks: Number(r.website_clicks ?? 0),
  }))
}

export async function fetchInstagramPosts(
  storeId: number,
  limit = 30,
): Promise<InstagramPost[]> {
  const params = new URLSearchParams({ store_id: String(storeId), limit: String(limit) })
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/instagram/posts?${params}`,
  )
  return raw.map((r) => ({
    id: String(r.post_id ?? r.id ?? ''),
    caption: String(r.caption ?? ''),
    media_type: (r.media_type as InstagramPost['media_type']) ?? 'IMAGE',
    media_product_type: (r.media_product_type as InstagramPost['media_product_type']) ?? 'FEED',
    timestamp: String(r.timestamp ?? ''),
    like_count: Number(r.likes ?? r.like_count ?? 0),
    comments_count: Number(r.comments ?? r.comments_count ?? 0),
    reach: Number(r.reach ?? 0),
    impressions: Number(r.impressions ?? 0),
    saved: Number(r.saved ?? 0),
    shares: Number(r.shares ?? 0),
    permalink: String(r.permalink ?? '#'),
    thumbnail_url: String(r.thumbnail_url ?? r.media_url ?? ''),
  }))
}

// ---------- LINE ----------

export async function fetchLineMetrics(
  storeId: number,
  startDate: string,
  endDate: string,
): Promise<LineFollowerInsight[]> {
  const params = new URLSearchParams({ store_id: String(storeId), start_date: startDate, end_date: endDate })
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/metrics/line_metrics?${params}`,
  )
  return raw.map((r) => ({
    date: String(r.date ?? '').slice(0, 7),
    followers: Number(r.followers ?? 0),
    targeted_reaches: Number(r.targeted_reaches ?? 0),
    blocks: Number(r.blocks ?? 0),
  }))
}

export async function fetchLineMessages(
  storeId: number,
  startDate: string,
  endDate: string,
): Promise<LineMessageInsight[]> {
  const params = new URLSearchParams({ store_id: String(storeId), start_date: startDate, end_date: endDate })
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/line/messages?${params}`,
  )
  return raw.map((r) => {
    const dateStr = String(r.date ?? '')
    const d = new Date(dateStr)
    return {
      date: dateStr.slice(0, 10),
      delivered: Number(r.delivered ?? 0),
      unique_impressions: Number(r.unique_impressions ?? 0),
      unique_clicks: Number(r.unique_clicks ?? 0),
      hour: d.getHours() || 12,
      day_of_week: (d.getDay() + 6) % 7, // Monday=0
    }
  })
}

// ---------- GA4 ----------

export async function fetchGA4Metrics(
  storeId: number,
  startDate: string,
  endDate: string,
): Promise<GA4Metric[]> {
  const params = new URLSearchParams({ store_id: String(storeId), start_date: startDate, end_date: endDate })
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/metrics/ga4_metrics?${params}`,
  )
  return raw.map((r) => ({
    date: String(r.date ?? '').slice(0, 7),
    sessions: Number(r.sessions ?? 0),
    active_users: Number(r.active_users ?? 0),
    new_users: Number(r.new_users ?? 0),
    page_views: Number(r.page_views ?? 0),
    bounce_rate: Number(r.bounce_rate ?? 0),
    avg_session_duration: Number(r.avg_session_duration ?? 0),
    conversions: Number(r.conversions ?? 0),
  }))
}

export async function fetchGA4TrafficSources(
  storeId: number,
  startDate: string,
  endDate: string,
): Promise<GA4TrafficSource[]> {
  const params = new URLSearchParams({ store_id: String(storeId), start_date: startDate, end_date: endDate })
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/ga4/traffic-sources?${params}`,
  )
  return raw.map((r) => ({
    channel: String(r.source ?? r.channel ?? ''),
    sessions: Number(r.sessions ?? 0),
    users: Number(r.users ?? 0),
  }))
}

export async function fetchGA4Pages(
  storeId: number,
  startDate: string,
  endDate: string,
): Promise<GA4Page[]> {
  const params = new URLSearchParams({ store_id: String(storeId), start_date: startDate, end_date: endDate })
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/ga4/pages?${params}`,
  )
  return raw.map((r) => ({
    page_path: String(r.page_path ?? '/'),
    page_title: String(r.page_title ?? ''),
    page_views: Number(r.page_views ?? 0),
    avg_time_on_page: Number(r.avg_time_on_page ?? 0),
  }))
}

// ---------- GBP ----------

export async function fetchGBPMetrics(
  storeId: number,
  startDate: string,
  endDate: string,
): Promise<GBPMetric[]> {
  const params = new URLSearchParams({ store_id: String(storeId), start_date: startDate, end_date: endDate })
  const raw = await fetchJson<Record<string, unknown>[]>(
    `${BASE}/metrics/gbp_metrics?${params}`,
  )
  return raw.map((r) => ({
    date: String(r.date ?? '').slice(0, 7),
    queries_direct: Number(r.queries_direct ?? 0),
    queries_indirect: Number(r.queries_indirect ?? 0),
    views_maps: Number(r.views_maps ?? 0),
    views_search: Number(r.views_search ?? 0),
    actions_website: Number(r.actions_website ?? 0),
    actions_phone: Number(r.actions_phone ?? 0),
    actions_directions: Number(r.actions_directions ?? 0),
  }))
}

// ---------- Recommendations ----------

export async function fetchRecommendations(
  storeId: number,
  startDate: string,
  endDate: string,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ store_id: String(storeId), start_date: startDate, end_date: endDate })
  return fetchJson<Record<string, unknown>>(`${BASE}/recommendations?${params}`)
}

// ---------- Helpers ----------

/**
 * Compute date range for a given month (YYYY-MM) plus 5 previous months.
 * Returns { start6: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } covering 6 months.
 */
export function getDateRangeForMonth(month: string): {
  start6: string
  end: string
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
} {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const end = `${month}-${String(lastDay).padStart(2, '0')}`
  const currentStart = `${month}-01`
  const currentEnd = end

  // Previous month
  const prevDate = new Date(y, m - 2, 1)
  const prevY = prevDate.getFullYear()
  const prevM = prevDate.getMonth() + 1
  const prevLastDay = new Date(prevY, prevM, 0).getDate()
  const previousStart = `${prevY}-${String(prevM).padStart(2, '0')}-01`
  const previousEnd = `${prevY}-${String(prevM).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`

  // 6 months ago
  const start6Date = new Date(y, m - 6, 1)
  const s6Y = start6Date.getFullYear()
  const s6M = start6Date.getMonth() + 1
  const start6 = `${s6Y}-${String(s6M).padStart(2, '0')}-01`

  return { start6, end, currentStart, currentEnd, previousStart, previousEnd }
}

/**
 * Aggregate daily metrics into monthly summaries.
 * Groups by YYYY-MM and sums/averages numeric fields.
 */
export function aggregateMonthly<T extends Record<string, unknown>>(
  records: T[],
  dateField = 'date',
  avgFields: string[] = [],
): T[] {
  const groups = new Map<string, T[]>()
  for (const r of records) {
    const dateVal = String((r as Record<string, unknown>)[dateField] ?? '')
    const monthKey = dateVal.slice(0, 7)
    if (!groups.has(monthKey)) groups.set(monthKey, [])
    groups.get(monthKey)!.push(r)
  }

  const result: T[] = []
  for (const [monthKey, items] of groups) {
    const merged: Record<string, unknown> = { [dateField]: monthKey }
    for (const key of Object.keys(items[0])) {
      if (key === dateField) continue
      const vals = items.map((i) => Number((i as Record<string, unknown>)[key]))
      if (vals.some(isNaN)) {
        merged[key] = (items[items.length - 1] as Record<string, unknown>)[key]
      } else if (avgFields.includes(key)) {
        merged[key] = vals.reduce((a, b) => a + b, 0) / vals.length
      } else {
        merged[key] = vals.reduce((a, b) => a + b, 0)
      }
    }
    result.push(merged as T)
  }
  return result.sort((a, b) => {
    const da = String((a as Record<string, unknown>)[dateField] ?? '')
    const db = String((b as Record<string, unknown>)[dateField] ?? '')
    return da.localeCompare(db)
  })
}
