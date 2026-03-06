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

export interface GA4Summary {
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
