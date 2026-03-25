import type { InstagramInsight, InstagramPost } from '@/types/instagram'
import type { GA4Metric, GA4TrafficSource, GA4Page, GA4Demographic, GA4HourlySession } from '@/types/ga4'
import type { GBPMetric, GBPReview, GBPRatingDistribution, GBPHourlyAction } from '@/types/gbp'

function generateDates(months: number): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return dates
}

/** Seeded pseudo-random for consistent mock data per month */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function monthSeed(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return y * 100 + m
}

const months6 = generateDates(6)

export const mockInstagramInsights: InstagramInsight[] = months6.map((date, i) => ({
  date,
  followers_count: 12500 + i * 320 + Math.floor(Math.random() * 100),
  reach: 45000 + i * 3000 + Math.floor(Math.random() * 5000),
  impressions: 82000 + i * 4000 + Math.floor(Math.random() * 8000),
  profile_views: 3200 + i * 200 + Math.floor(Math.random() * 300),
  website_clicks: 450 + i * 30 + Math.floor(Math.random() * 50),
}))

const POST_TEMPLATES = [
  { caption: '新メニュー登場！特製パスタ🍝', media_type: 'IMAGE' as const, media_product_type: 'FEED' as const, imgSeed: 'pasta' },
  { caption: 'シェフの一日に密着📹', media_type: 'VIDEO' as const, media_product_type: 'REELS' as const, imgSeed: 'chef' },
  { caption: '週末限定ディナーコース🌟', media_type: 'CAROUSEL_ALBUM' as const, media_product_type: 'FEED' as const, imgSeed: 'dinner' },
  { caption: 'スタッフ紹介〜ホール担当です！', media_type: 'IMAGE' as const, media_product_type: 'FEED' as const, imgSeed: 'restaurant-staff' },
  { caption: '季節の特別デザート❤️', media_type: 'IMAGE' as const, media_product_type: 'STORY' as const, imgSeed: 'dessert' },
  { caption: 'ランチタイム営業中🍽️', media_type: 'IMAGE' as const, media_product_type: 'FEED' as const, imgSeed: 'lunch' },
  { caption: '厳選素材の仕入れレポート🥩', media_type: 'VIDEO' as const, media_product_type: 'REELS' as const, imgSeed: 'meat' },
  { caption: 'お客様の笑顔が最高の報酬😊', media_type: 'CAROUSEL_ALBUM' as const, media_product_type: 'FEED' as const, imgSeed: 'cafe' },
]

/** Generate Instagram posts for a specific month */
function generatePostsForMonth(month: string): InstagramPost[] {
  const rand = seededRandom(monthSeed(month))
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const count = 5 + Math.floor(rand() * 3) // 5-7 posts per month

  return Array.from({ length: count }, (_, i) => {
    const tmpl = POST_TEMPLATES[i % POST_TEMPLATES.length]
    const day = Math.max(1, Math.min(daysInMonth, Math.floor(rand() * daysInMonth) + 1))
    const likes = 100 + Math.floor(rand() * 500)
    const reach = 3000 + Math.floor(rand() * 15000)
    const hour = Math.floor(rand() * 14) + 8 // 8:00-22:00
    const minute = Math.floor(rand() * 60)
    return {
      id: `${month}-${i + 1}`,
      caption: tmpl.caption,
      media_type: tmpl.media_type,
      media_product_type: tmpl.media_product_type,
      timestamp: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
      like_count: likes,
      comments_count: Math.floor(rand() * 80),
      reach,
      impressions: reach + Math.floor(rand() * 5000),
      saved: Math.floor(rand() * 200),
      shares: Math.floor(rand() * 120),
      permalink: '#',
      thumbnail_url: '',
    }
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export const mockInstagramPosts: InstagramPost[] = generatePostsForMonth(
  months6[months6.length - 1],
)

export const mockGA4Metrics: GA4Metric[] = months6.map((date, i) => ({
  date,
  sessions: 15000 + i * 1200 + Math.floor(Math.random() * 2000),
  active_users: 8500 + i * 600 + Math.floor(Math.random() * 800),
  new_users: 2200 + i * 150 + Math.floor(Math.random() * 300),
  page_views: 42000 + i * 3000 + Math.floor(Math.random() * 5000),
  bounce_rate: 45 - i * 1.5 + Math.random() * 3,
  avg_session_duration: 125 + i * 8 + Math.floor(Math.random() * 20),
  conversions: 320 + i * 25 + Math.floor(Math.random() * 40),
}))

export const mockGA4TrafficSources: GA4TrafficSource[] = [
  { channel: 'Organic Search', sessions: 6200, users: 4800 },
  { channel: 'Organic Social', sessions: 4100, users: 3200 },
  { channel: 'Direct', sessions: 3500, users: 2800 },
  { channel: 'Referral', sessions: 1800, users: 1400 },
  { channel: 'Paid Search', sessions: 1200, users: 950 },
]

export const mockGA4Pages: GA4Page[] = [
  { page_path: '/', page_title: 'トップページ', page_views: 18500, avg_time_on_page: 45.2 },
  { page_path: '/menu', page_title: 'メニュー', page_views: 12300, avg_time_on_page: 92.5 },
  { page_path: '/reservation', page_title: '予約', page_views: 8900, avg_time_on_page: 68.3 },
  { page_path: '/access', page_title: 'アクセス', page_views: 6700, avg_time_on_page: 35.8 },
  { page_path: '/about', page_title: '店舗紹介', page_views: 4200, avg_time_on_page: 78.1 },
]

export const mockGBPMetrics: GBPMetric[] = months6.map((date, i) => ({
  date,
  queries_direct: 3200 + i * 250 + Math.floor(Math.random() * 300),
  queries_indirect: 8500 + i * 400 + Math.floor(Math.random() * 600),
  views_maps: 5600 + i * 300 + Math.floor(Math.random() * 400),
  views_search: 4200 + i * 200 + Math.floor(Math.random() * 300),
  actions_website: 890 + i * 50 + Math.floor(Math.random() * 80),
  actions_phone: 420 + i * 25 + Math.floor(Math.random() * 40),
  actions_directions: 650 + i * 30 + Math.floor(Math.random() * 50),
}))

export const mockGBPReviews: GBPReview[] = [
  { date: '2026-02-28', rating: 5, text: '料理もサービスも最高でした！特にパスタが絶品。', author: '山田太郎' },
  { date: '2026-02-25', rating: 4, text: '雰囲気が良く、デートにぴったりです。', author: '佐藤花子' },
  { date: '2026-02-20', rating: 5, text: '予約して行きましたが、スタッフの対応が素晴らしかった。', author: '鈴木一郎' },
  { date: '2026-02-15', rating: 3, text: '料理は美味しかったですが、少し待ち時間が長かったです。', author: '田中美咲' },
  { date: '2026-02-10', rating: 5, text: 'ランチメニューがコスパ最高！また来ます。', author: '高橋健' },
]

export const mockGA4Demographic: GA4Demographic = {
  devices: [
    { label: 'モバイル', percentage: 62.5 },
    { label: 'デスクトップ', percentage: 28.3 },
    { label: 'タブレット', percentage: 9.2 },
  ],
  ages: [
    { label: '18-24', percentage: 12.8 },
    { label: '25-34', percentage: 31.2 },
    { label: '35-44', percentage: 24.6 },
    { label: '45-54', percentage: 17.3 },
    { label: '55-64', percentage: 9.8 },
    { label: '65+', percentage: 4.3 },
  ],
  regions: [
    { label: '東京', percentage: 38.5 },
    { label: '神奈川', percentage: 16.2 },
    { label: '千葉', percentage: 11.8 },
    { label: '埼玉', percentage: 9.4 },
    { label: 'その他', percentage: 24.1 },
  ],
}

function generateGA4HourlySessions(month: string): GA4HourlySession[] {
  const rand = seededRandom(monthSeed(month) + 2000)
  const data: GA4HourlySession[] = []
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 8; h < 23; h++) {
      // Restaurant traffic: peaks at lunch (11-13) and dinner (17-20), weekends higher
      let base = 20
      if (h >= 11 && h <= 13) base = 80
      else if (h >= 17 && h <= 20) base = 100
      else if (h >= 14 && h <= 16) base = 40
      if (dow >= 5) base = Math.floor(base * 1.3) // weekend boost
      data.push({
        day_of_week: dow,
        hour: h,
        sessions: base + Math.floor(rand() * base * 0.5),
      })
    }
  }
  return data
}

export const mockGBPRatingDistribution: GBPRatingDistribution[] = [
  { rating: 5, count: 42 },
  { rating: 4, count: 28 },
  { rating: 3, count: 12 },
  { rating: 2, count: 5 },
  { rating: 1, count: 3 },
]

function generateGBPHourlyActions(month: string): GBPHourlyAction[] {
  const rand = seededRandom(monthSeed(month) + 3000)
  const data: GBPHourlyAction[] = []
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 8; h < 23; h++) {
      let base = 5
      if (h >= 11 && h <= 13) base = 25
      else if (h >= 17 && h <= 20) base = 30
      else if (h >= 14 && h <= 16) base = 10
      if (dow >= 5) base = Math.floor(base * 1.2)
      data.push({
        day_of_week: dow,
        hour: h,
        actions: base + Math.floor(rand() * base * 0.4),
      })
    }
  }
  return data
}

/** Store-specific scale factors — each store has different traffic/engagement levels */
const STORE_PROFILES = [
  { scale: 1.0, label: '海鮮居酒屋魚魯こ' },
  { scale: 0.72, label: '練馬鳥長・新潟' },
  { scale: 0.55, label: '魚とシャリUROKO' },
]

function generateStoreInstagramInsights(storeIndex: number): InstagramInsight[] {
  const s = STORE_PROFILES[storeIndex] ?? STORE_PROFILES[0]
  const seed = seededRandom(4000 + storeIndex * 100)
  return months6.map((date, i) => ({
    date,
    followers_count: Math.floor((12500 + i * 320) * s.scale + seed() * 100),
    reach: Math.floor((45000 + i * 3000) * s.scale + seed() * 5000),
    impressions: Math.floor((82000 + i * 4000) * s.scale + seed() * 8000),
    profile_views: Math.floor((3200 + i * 200) * s.scale + seed() * 300),
    website_clicks: Math.floor((450 + i * 30) * s.scale + seed() * 50),
  }))
}

function generateStoreGBPMetrics(storeIndex: number): GBPMetric[] {
  const s = STORE_PROFILES[storeIndex] ?? STORE_PROFILES[0]
  const seed = seededRandom(5000 + storeIndex * 100)
  return months6.map((date, i) => ({
    date,
    queries_direct: Math.floor((3200 + i * 250) * s.scale + seed() * 300),
    queries_indirect: Math.floor((8500 + i * 400) * s.scale + seed() * 600),
    views_maps: Math.floor((5600 + i * 300) * s.scale + seed() * 400),
    views_search: Math.floor((4200 + i * 200) * s.scale + seed() * 300),
    actions_website: Math.floor((890 + i * 50) * s.scale + seed() * 80),
    actions_phone: Math.floor((420 + i * 25) * s.scale + seed() * 40),
    actions_directions: Math.floor((650 + i * 30) * s.scale + seed() * 50),
  }))
}

const STORE_REVIEWS: GBPReview[][] = [
  [
    { date: '2026-02-28', rating: 5, text: '料理もサービスも最高でした！特にパスタが絶品。', author: '山田太郎' },
    { date: '2026-02-25', rating: 4, text: '雰囲気が良く、デートにぴったりです。', author: '佐藤花子' },
    { date: '2026-02-20', rating: 5, text: '予約して行きましたが、スタッフの対応が素晴らしかった。', author: '鈴木一郎' },
    { date: '2026-02-15', rating: 3, text: '料理は美味しかったですが、少し待ち時間が長かったです。', author: '田中美咲' },
    { date: '2026-02-10', rating: 5, text: 'ランチメニューがコスパ最高！また来ます。', author: '高橋健' },
  ],
  [
    { date: '2026-02-27', rating: 5, text: '表参道の隠れ家的なお店。雰囲気抜群です！', author: '中村優子' },
    { date: '2026-02-22', rating: 4, text: 'おしゃれな内装でインスタ映えします。料理も美味。', author: '小林真' },
    { date: '2026-02-18', rating: 4, text: 'ワインの品揃えが豊富で大満足。', author: '渡辺さくら' },
    { date: '2026-02-12', rating: 5, text: '記念日ディナーで利用。特別感がありました。', author: '伊藤大輔' },
  ],
  [
    { date: '2026-02-26', rating: 4, text: '新宿で気軽に入れる良いお店。ランチがお得！', author: '加藤翔太' },
    { date: '2026-02-21', rating: 3, text: '味は良いですが、席が少し狭いかな。', author: '松本由美' },
    { date: '2026-02-14', rating: 5, text: 'スタッフが親切で居心地が良い。また行きます。', author: '木村拓也' },
    { date: '2026-02-08', rating: 4, text: '駅近で便利。仕事帰りに重宝しています。', author: '吉田恵' },
    { date: '2026-02-03', rating: 2, text: '混雑時は注文から提供まで時間がかかりました。', author: '斎藤圭' },
  ],
]

const STORE_RATING_DISTRIBUTIONS: GBPRatingDistribution[][] = [
  [{ rating: 5, count: 42 }, { rating: 4, count: 28 }, { rating: 3, count: 12 }, { rating: 2, count: 5 }, { rating: 1, count: 3 }],
  [{ rating: 5, count: 31 }, { rating: 4, count: 22 }, { rating: 3, count: 8 }, { rating: 2, count: 3 }, { rating: 1, count: 1 }],
  [{ rating: 5, count: 18 }, { rating: 4, count: 20 }, { rating: 3, count: 14 }, { rating: 2, count: 6 }, { rating: 1, count: 4 }],
]

export function getMockDataForMonth(month: string, storeIndex = 0) {
  const igInsights = generateStoreInstagramInsights(storeIndex)
  const gbpMetrics = generateStoreGBPMetrics(storeIndex)

  const idx = months6.indexOf(month)
  const currentIdx = idx >= 0 ? idx : months6.length - 1
  const prevIdx = currentIdx > 0 ? currentIdx - 1 : 0

  return {
    instagram: {
      current: igInsights[currentIdx],
      previous: igInsights[prevIdx],
      trend: igInsights,
      posts: generatePostsForMonth(month),
    },
    line: {
      current: { date: months6[currentIdx], followers: 0, targeted_reaches: 0, blocks: 0 },
      previous: { date: months6[prevIdx], followers: 0, targeted_reaches: 0, blocks: 0 },
      trend: [],
      messages: [],
      demographic: { genders: [], ages: [], areas: [] },
    },
    ga4: {
      current: mockGA4Metrics[currentIdx],
      previous: mockGA4Metrics[prevIdx],
      trend: mockGA4Metrics,
      trafficSources: mockGA4TrafficSources,
      pages: mockGA4Pages,
      demographic: mockGA4Demographic,
      hourlySessions: generateGA4HourlySessions(month),
    },
    gbp: {
      current: gbpMetrics[currentIdx],
      previous: gbpMetrics[prevIdx],
      trend: gbpMetrics,
      reviews: STORE_REVIEWS[storeIndex] ?? STORE_REVIEWS[0],
      ratingDistribution: STORE_RATING_DISTRIBUTIONS[storeIndex] ?? STORE_RATING_DISTRIBUTIONS[0],
      hourlyActions: generateGBPHourlyActions(month),
    },
  }
}

/** Filter items by date range — works for any object with a date or timestamp field */
export function filterByDateRange<T extends Record<string, unknown>>(
  items: T[],
  start: string,
  end: string,
  dateField: keyof T = 'date' as keyof T,
): T[] {
  const startDate = new Date(start)
  const endDate = new Date(end)
  endDate.setHours(23, 59, 59, 999)

  return items.filter((item) => {
    const val = item[dateField]
    if (typeof val !== 'string') return true
    const d = new Date(val)
    return d >= startDate && d <= endDate
  })
}
