export type LineMessageType = 'text' | 'image' | 'rich' | 'coupon' | 'video' | 'card'

export interface LineFollowerInsight {
  date: string
  followers: number
  targeted_reaches: number
  blocks: number
}

export interface LineMessageInsight {
  date: string
  delivered: number
  unique_impressions: number
  unique_clicks: number
  hour: number
  day_of_week: number
  title?: string
  body_preview?: string
  message_type?: LineMessageType
}

export interface LineDemographic {
  genders: { label: string; percentage: number }[]
  ages: { label: string; percentage: number }[]
  areas: { label: string; percentage: number }[]
}

export interface LineSummary {
  followers: number
  open_rate: number
  block_rate: number
}
