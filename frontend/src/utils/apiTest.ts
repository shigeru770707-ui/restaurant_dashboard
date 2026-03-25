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
  if (!settings.appSecret) {
    return { status: 'error', message: 'App Secretを入力してください（Meta App設定でApp Secret証明が必須です）' }
  }
  try {
    const data = await postJson<{ ok: boolean; message: string }>('/api/test/instagram', {
      user_id: settings.userId,
      access_token: settings.accessToken,
      app_secret: settings.appSecret || undefined,
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

export async function testLine(
  settings: ApiSettings['line']
): Promise<ConnectionTestResult> {
  if (!settings.channelAccessToken) {
    return { status: 'error', message: 'Channel Access Tokenを入力してください' }
  }
  try {
    const data = await postJson<{ ok: boolean; message: string }>('/api/test/line', {
      channel_access_token: settings.channelAccessToken,
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

export interface GA4TestResult extends ConnectionTestResult {
  parsedJson?: Record<string, unknown>
}

export async function testGA4(
  settings: ApiSettings['ga4'],
  parsedObject?: Record<string, unknown> | null,
): Promise<GA4TestResult> {
  if (!settings.propertyId) {
    return {
      status: 'error',
      message: 'Property IDを入力してください',
    }
  }
  if (!parsedObject && !settings.serviceAccountJson) {
    return {
      status: 'error',
      message: 'サービスアカウントJSONをアップロードしてください',
    }
  }
  try {
    // Use pre-parsed object if available, otherwise try to parse the string
    let saInfo: Record<string, unknown>
    if (parsedObject) {
      saInfo = parsedObject
    } else {
      try {
        saInfo = JSON.parse(settings.serviceAccountJson)
      } catch (parseErr) {
        return {
          status: 'error',
          message: `サービスアカウントJSONの解析に失敗: ${parseErr instanceof Error ? parseErr.message : '不明'}。JSONファイルのアップロードをお試しください。`,
        }
      }
    }
    const data = await postJson<{ ok: boolean; message: string }>('/api/test/ga4', {
      property_id: settings.propertyId,
      service_account_json: saInfo,
    })
    return {
      status: data.ok ? 'success' : 'error',
      message: data.message,
      parsedJson: data.ok ? saInfo : undefined,
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
