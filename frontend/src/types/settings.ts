export interface InstagramStoreSettings {
  storeName: string
  accessToken: string
  userId: string
  appSecret: string
}

export interface LineSettings {
  channelAccessToken: string
  oaEmail: string
  oaPassword: string
  oaAccountId: string
}

export interface GA4Settings {
  propertyId: string
  serviceAccountJson: string
}

export interface GBPStoreSettings {
  storeName: string
  oauthClientId: string
  oauthClientSecret: string
  refreshToken: string
  locationId: string
}

export interface ApiSettings {
  instagram: InstagramStoreSettings[]
  line: LineSettings
  ga4: GA4Settings
  gbp: GBPStoreSettings[]
}

export type ConnectionStatus = 'untested' | 'testing' | 'success' | 'error'

export interface ConnectionTestResult {
  status: 'success' | 'error'
  message: string
}
