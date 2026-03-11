import type {
  InstagramStoreSettings,
  GBPStoreSettings,
  ApiSettings,
  ConnectionTestResult,
} from '@/types/settings'
import { postJson } from '@/utils/api'

export async function testInstagram(
  settings: InstagramStoreSettings
): Promise<ConnectionTestResult> {
  if (!settings.accessToken || !settings.userId) {
    return { status: 'error', message: 'Access TokenとUser IDを入力してください' }
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${settings.userId}?fields=id,username&access_token=${settings.accessToken}`
    )
    if (!res.ok) {
      const err = await res.json()
      return {
        status: 'error',
        message: err.error?.message || `HTTPエラー: ${res.status}`,
      }
    }
    const data = await res.json()
    return {
      status: 'success',
      message: `接続成功: @${data.username || data.id}`,
    }
  } catch (e) {
    return {
      status: 'error',
      message: `接続失敗: ${e instanceof Error ? e.message : '不明なエラー'}`,
    }
  }
}

export async function testLine(
  settings: ApiSettings['line']
): Promise<ConnectionTestResult> {
  if (!settings.channelAccessToken) {
    return { status: 'error', message: 'Channel Access Tokenを入力してください' }
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${settings.channelAccessToken}` },
    })
    if (!res.ok) {
      return { status: 'error', message: `HTTPエラー: ${res.status}` }
    }
    const data = await res.json()
    return {
      status: 'success',
      message: `接続成功: ${data.basicId || data.displayName || 'Bot確認済み'}`,
    }
  } catch (e) {
    return {
      status: 'error',
      message: `接続失敗: ${e instanceof Error ? e.message : '不明なエラー'}`,
    }
  }
}

export async function testGA4(
  settings: ApiSettings['ga4']
): Promise<ConnectionTestResult> {
  if (!settings.serviceAccountJson || !settings.propertyId) {
    return {
      status: 'error',
      message: 'サービスアカウントJSONとProperty IDを入力してください',
    }
  }
  try {
    const data = await postJson<{ ok: boolean; message: string }>('/api/test/ga4', {
      property_id: settings.propertyId,
      service_account_json: settings.serviceAccountJson,
    })
    return {
      status: data.ok ? 'success' : 'error',
      message: data.message,
    }
  } catch (e) {
    return {
      status: 'error',
      message: `接続失敗: ${e instanceof Error ? e.message : '不明なエラー'}`,
    }
  }
}

export async function testGBP(
  settings: GBPStoreSettings
): Promise<ConnectionTestResult> {
  if (
    !settings.oauthClientId ||
    !settings.oauthClientSecret ||
    !settings.refreshToken ||
    !settings.locationId
  ) {
    return {
      status: 'error',
      message:
        'OAuth Client ID、Client Secret、リフレッシュトークン、Location IDをすべて入力してください',
    }
  }
  try {
    const data = await postJson<{ ok: boolean; message: string }>('/api/test/gbp', {
      location_id: settings.locationId,
      oauth_client_id: settings.oauthClientId,
      oauth_client_secret: settings.oauthClientSecret,
      oauth_refresh_token: settings.refreshToken,
    })
    return {
      status: data.ok ? 'success' : 'error',
      message: data.message,
    }
  } catch (e) {
    return {
      status: 'error',
      message: `接続失敗: ${e instanceof Error ? e.message : '不明なエラー'}`,
    }
  }
}
