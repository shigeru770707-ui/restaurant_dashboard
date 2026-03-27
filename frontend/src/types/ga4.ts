export interface GA4Metric {
  date: string
  sessions: number
  active_users: number
  new_users: number
  page_views: number
  bounce_rate: number
  avg_session_duration: number
  conversions: number
}

export interface GA4TrafficSource {
  channel: string
  sessions: number
  users: number
}

export interface GA4Page {
  page_path: string
  page_title: string
  page_views: number
  avg_time_on_page: number
}

interface GA4Summary {
  sessions: number
  conversions: number
  cvr: number
}

export interface GA4Demographic {
  devices: { label: string; percentage: number }[]
  ages: { label: string; percentage: number }[]
  regions: { label: string; percentage: number }[]
}

export interface GA4HourlySession {
  day_of_week: number
  hour: number
  sessions: number
}

export interface GA4CustomEvent {
  event_name: string
  event_count: number
  unique_users: number
}

export interface GA4StoreInfo {
  id: number
  name: string
  store_key: string
  ga4_path_prefix: string
}

export interface GA4OverviewData {
  totals: GA4Metric
  store_breakdown: (GA4Metric & { store_id: number; store_name: string })[]
  daily_trend: { date: string; sessions: number; active_users: number; page_views: number; conversions: number }[]
  custom_events: GA4CustomEvent[]
}

export interface GA4StoreDetailData {
  store_id: number
  period: { start: string; end: string }
  totals: GA4Metric
  daily_trend: { date: string; sessions: number; active_users: number; page_views: number; conversions: number }[]
  traffic_sources: GA4TrafficSource[]
  top_pages: GA4Page[]
  custom_events: GA4CustomEvent[]
}

export interface GA4CompareStore {
  store_id: number
  store_name: string
  totals: {
    sessions: number
    active_users: number
    new_users: number
    page_views: number
    bounce_rate: number
    conversions: number
  }
  daily: { date: string; sessions: number; active_users: number; page_views: number; conversions: number }[]
}

export interface GA4CompareData {
  period: { start: string; end: string }
  stores: GA4CompareStore[]
}
