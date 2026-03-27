import { useState, useCallback } from 'react'
import type {
  ApiSettings,
  InstagramStoreSettings,
  GBPStoreSettings,
} from '@/types/settings'

const STORAGE_KEY = 'sns-analytics-api-settings'

const emptyInstagramStore: InstagramStoreSettings = {
  storeName: '',
  accessToken: '',
  userId: '',
  appId: '',
  appSecret: '',
}

const emptyGBPStore: GBPStoreSettings = {
  storeName: '',
  oauthClientId: '',
  oauthClientSecret: '',
  refreshToken: '',
  locationId: '',
}

const defaultSettings: ApiSettings = {
  instagram: [
    { storeName: '海鮮居酒屋魚魯こ', accessToken: '', userId: '', appId: '', appSecret: '' },
    { storeName: 'Vento e Mare', accessToken: '', userId: '', appId: '', appSecret: '' },
    { storeName: '練馬鳥長新潟', accessToken: '', userId: '', appId: '', appSecret: '' },
    { storeName: '魚とシャリUROKO', accessToken: '', userId: '', appId: '', appSecret: '' },
  ],
  line: { channelAccessToken: '', oaEmail: '', oaPassword: '', oaAccountId: '' },
  ga4: { propertyId: '', serviceAccountJson: '' },
  gbp: [
    { storeName: '海鮮居酒屋魚魯こ', oauthClientId: '', oauthClientSecret: '', refreshToken: '', locationId: '' },
    { storeName: 'Vento e Mare', oauthClientId: '', oauthClientSecret: '', refreshToken: '', locationId: '' },
    { storeName: '練馬鳥長新潟', oauthClientId: '', oauthClientSecret: '', refreshToken: '', locationId: '' },
    { storeName: '魚とシャリUROKO', oauthClientId: '', oauthClientSecret: '', refreshToken: '', locationId: '' },
  ],
}

function loadSettings(): ApiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw)
    // Migration: convert old single-object instagram/gbp to array
    if (parsed.instagram && !Array.isArray(parsed.instagram)) {
      parsed.instagram = [{ storeName: '店舗1', ...parsed.instagram }]
    }
    if (parsed.gbp && !Array.isArray(parsed.gbp)) {
      parsed.gbp = [{ storeName: '店舗1', ...parsed.gbp }]
    }
    // Migration: convert old GA4 fields (clientEmail+privateKey) to serviceAccountJson
    if (parsed.ga4 && 'clientEmail' in parsed.ga4 && !('serviceAccountJson' in parsed.ga4)) {
      parsed.ga4 = { propertyId: parsed.ga4.propertyId || '', serviceAccountJson: '' }
    }
    // Migration: convert old GBP fields (clientEmail+privateKey) to OAuth fields
    if (Array.isArray(parsed.gbp)) {
      parsed.gbp = parsed.gbp.map((s: Record<string, string>) => {
        if ('clientEmail' in s && !('oauthClientId' in s)) {
          return { storeName: s.storeName || '', oauthClientId: '', oauthClientSecret: '', refreshToken: '', locationId: s.locationId || '' }
        }
        return s
      })
    }
    return {
      ...defaultSettings,
      ...parsed,
      instagram: parsed.instagram?.length ? parsed.instagram : [{ ...emptyInstagramStore }],
      gbp: parsed.gbp?.length ? parsed.gbp : [{ ...emptyGBPStore }],
    }
  } catch {
    return defaultSettings
  }
}

export function useApiSettings() {
  const [settings, setSettings] = useState<ApiSettings>(loadSettings)

  const saveSettings = useCallback((newSettings: ApiSettings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
    setSettings(newSettings)
  }, [])

  const clearSettings = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSettings(defaultSettings)
  }, [])

  const updateLine = useCallback(
    (value: Partial<ApiSettings['line']>) => {
      setSettings((prev) => ({
        ...prev,
        line: { ...prev.line, ...value },
      }))
    },
    []
  )

  const updateGA4 = useCallback(
    (value: Partial<ApiSettings['ga4']>) => {
      setSettings((prev) => ({
        ...prev,
        ga4: { ...prev.ga4, ...value },
      }))
    },
    []
  )

  // Instagram multi-store helpers
  const updateInstagramStore = useCallback(
    (index: number, value: Partial<InstagramStoreSettings>) => {
      setSettings((prev) => {
        const stores = [...prev.instagram]
        stores[index] = { ...stores[index], ...value }
        return { ...prev, instagram: stores }
      })
    },
    []
  )

  const addInstagramStore = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      instagram: [...prev.instagram, { ...emptyInstagramStore }],
    }))
  }, [])

  const removeInstagramStore = useCallback((index: number) => {
    setSettings((prev) => ({
      ...prev,
      instagram: prev.instagram.filter((_, i) => i !== index),
    }))
  }, [])

  // GBP multi-store helpers
  const updateGBPStore = useCallback(
    (index: number, value: Partial<GBPStoreSettings>) => {
      setSettings((prev) => {
        const stores = [...prev.gbp]
        stores[index] = { ...stores[index], ...value }
        return { ...prev, gbp: stores }
      })
    },
    []
  )

  const addGBPStore = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      gbp: [...prev.gbp, { ...emptyGBPStore }],
    }))
  }, [])

  const removeGBPStore = useCallback((index: number) => {
    setSettings((prev) => ({
      ...prev,
      gbp: prev.gbp.filter((_, i) => i !== index),
    }))
  }, [])

  return {
    settings,
    saveSettings,
    clearSettings,
    updateLine,
    updateGA4,
    updateInstagramStore,
    addInstagramStore,
    removeInstagramStore,
    updateGBPStore,
    addGBPStore,
    removeGBPStore,
  }
}
