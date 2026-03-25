export interface InstagramInsight {
  date: string
  followers_count: number
  reach: number
  impressions: number
  profile_views: number
  website_clicks: number
}

export interface InstagramPost {
  id: string
  caption: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_product_type: 'FEED' | 'STORY' | 'REELS'
  timestamp: string
  like_count: number
  comments_count: number
  reach: number
  impressions: number
  saved: number
  shares: number
  permalink: string
  thumbnail_url?: string
  // ストーリー固有指標
  replies?: number
  exits?: number
  taps_forward?: number
  taps_back?: number
}

export interface InstagramSummary {
  followers_count: number
  reach: number
  impressions: number
  engagement_rate: number
  profile_views: number
}
