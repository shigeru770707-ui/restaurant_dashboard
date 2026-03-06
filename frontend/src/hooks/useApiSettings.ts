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
}

const emptyGBPStore: GBPStoreSettings = {
  storeName: '',
  clientEmail: '',
  privateKey: '',
  accountId: '',
  locationId: '',
}

const defaultSettings: ApiSettings = {
  instagram: [
    { storeName: '渋谷店', accessToken: '', userId: '' },
    { storeName: '表参道店', accessToken: '', userId: '' },
    { storeName: '新宿店', accessToken: '', userId: '' },
  ],
  line: { channelAccessToken: '' },
  ga4: { clientEmail: '', privateKey: '', propertyId: '' },
  gbp: [
    { storeName: '渋谷店', clientEmail: '', privateKey: '', accountId: '', locationId: '' },
    { storeName: '表参道店', clientEmail: '', privateKey: '', accountId: '', locationId: '' },
    { storeName: '新宿店', clientEmail: '', privateKey: '', accountId: '', locationId: '' },
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
