export interface InstagramStoreSettings {
  storeName: string
  accessToken: string
  userId: string
}

export interface LineSettings {
  channelAccessToken: string
}

export interface GA4Settings {
  clientEmail: string
  privateKey: string
  propertyId: string
}

export interface GBPStoreSettings {
  storeName: string
  clientEmail: string
  privateKey: string
  accountId: string
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
