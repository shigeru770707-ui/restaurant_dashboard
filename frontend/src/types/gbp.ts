export interface GBPMetric {
  date: string
  queries_direct: number
  queries_indirect: number
  views_maps: number
  views_search: number
  actions_website: number
  actions_phone: number
  actions_directions: number
}

export interface GBPReview {
  date: string
  rating: number
  text: string
  author: string
}

export interface GBPSummary {
  search_views: number
  actions: number
  average_rating: number
  total_reviews: number
}

export interface GBPRatingDistribution {
  rating: number
  count: number
}

export interface GBPHourlyAction {
  day_of_week: number
  hour: number
  actions: number
}
