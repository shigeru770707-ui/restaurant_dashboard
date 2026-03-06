import type {
  InstagramStoreSettings,
  GBPStoreSettings,
  ApiSettings,
  ConnectionTestResult,
} from '@/types/settings'

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
  if (!settings.clientEmail || !settings.privateKey || !settings.propertyId) {
    return {
      status: 'error',
      message: 'Client Email、Private Key、Property IDをすべて入力してください',
    }
  }
  return {
    status: 'success',
    message: `設定保存済み（Property ID: ${settings.propertyId}）※接続確認はバックエンド経由で行われます`,
  }
}

export async function testGBP(
  settings: GBPStoreSettings
): Promise<ConnectionTestResult> {
  if (
    !settings.clientEmail ||
    !settings.privateKey ||
    !settings.accountId ||
    !settings.locationId
  ) {
    return {
      status: 'error',
      message:
        'Client Email、Private Key、Account ID、Location IDをすべて入力してください',
    }
  }
  return {
    status: 'success',
    message: `設定保存済み（Location ID: ${settings.locationId}）※接続確認はバックエンド経由で行われます`,
  }
}
