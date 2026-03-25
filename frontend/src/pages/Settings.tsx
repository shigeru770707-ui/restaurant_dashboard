import { useState, useRef, useEffect } from 'react'
import Header from '@/components/layout/Header'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useApiSettings } from '@/hooks/useApiSettings'
import type { InstagramStoreSettings } from '@/types/settings'
import { testInstagram, testLine, testGA4, testGBP } from '@/utils/apiTest'
import { saveCredentials, postJson, fetchCredentialsSummary } from '@/utils/api'
import type { ConnectionStatus, ConnectionTestResult } from '@/types/settings'

function StatusIndicator({
  status,
  message,
}: {
  status: ConnectionStatus
  message: string
}) {
  if (status === 'untested') return null
  if (status === 'testing') {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="material-symbols-outlined animate-spin text-base">
          progress_activity
        </span>
        テスト中...
      </div>
    )
  }
  if (status === 'success') {
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-success">
        <span className="material-symbols-outlined text-base">check_circle</span>
        {message}
      </div>
    )
  }
  return (
    <div className="mt-2 flex items-center gap-2 text-sm text-danger">
      <span className="material-symbols-outlined text-base">error</span>
      {message}
    </div>
  )
}

function SectionHeader({
  icon,
  color,
  lightBg,
  label,
}: {
  icon: string
  color: string
  lightBg: string
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex size-9 items-center justify-center rounded-lg"
        style={{ background: lightBg }}
      >
        <span className="material-symbols-outlined text-lg" style={{ color }}>
          {icon}
        </span>
      </div>
      <CardTitle style={{ color }}>{label}</CardTitle>
    </div>
  )
}

export default function Settings() {
  const {
    settings,
    saveSettings,
    updateLine,
    updateGA4,
    updateInstagramStore,
    addInstagramStore,
    removeInstagramStore,
    updateGBPStore,
    addGBPStore,
    removeGBPStore,
  } = useApiSettings()

  // Per-store statuses for Instagram
  const [igStatuses, setIgStatuses] = useState<Record<number, ConnectionStatus>>({})
  const [igMessages, setIgMessages] = useState<Record<number, string>>({})

  // Single statuses for LINE / GA4
  const [lineStatus, setLineStatus] = useState<ConnectionStatus>('untested')
  const [lineMsg, setLineMsg] = useState('')
  const ga4FileRef = useRef<HTMLInputElement>(null)
  const ga4ParsedRef = useRef<Record<string, unknown> | null>(null)
  const [ga4Status, setGa4Status] = useState<ConnectionStatus>('untested')
  const [ga4Msg, setGa4Msg] = useState('')

  // Per-store statuses for GBP
  const [gbpStatuses, setGbpStatuses] = useState<Record<number, ConnectionStatus>>({})
  const [gbpMessages, setGbpMessages] = useState<Record<number, string>>({})

  const [saved, setSaved] = useState(false)

  // LINE scraper control panel state
  const [scraperStatus, setScraperStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [scraperMsg, setScraperMsg] = useState('')
  const [scraperSchedule, setScraperSchedule] = useState('')
  const [scraperLastRun, setScraperLastRun] = useState<string | null>(null)
  const [scraperNextRun, setScraperNextRun] = useState<string | null>(null)
  const [scraperConfigured, setScraperConfigured] = useState(false)

  // DB保存済みの認証情報をロードしてフォームに反映
  useEffect(() => {
    fetchCredentialsSummary(1).then((summary) => {
      if (!summary) return
      // LINE: DB保存済みトークンがあり、localStorageに未設定ならDBの値を使う
      if (summary.line_channel_access_token_raw && !settings.line.channelAccessToken) {
        updateLine({ channelAccessToken: summary.line_channel_access_token_raw })
      }
      if (summary.line_oa_email && !settings.line.oaEmail) {
        updateLine({ oaEmail: summary.line_oa_email })
      }
      if (summary.line_oa_account_id && !settings.line.oaAccountId) {
        updateLine({ oaAccountId: summary.line_oa_account_id })
      }
      // Instagram: DB保存済みの認証情報を復元
      if (summary.instagram_access_token_raw || summary.instagram_app_secret_raw || summary.instagram_user_id) {
        const igStore = settings.instagram[0]
        if (igStore) {
          const updates: Partial<InstagramStoreSettings> = {}
          if (summary.instagram_access_token_raw && !igStore.accessToken) {
            updates.accessToken = summary.instagram_access_token_raw
          }
          if (summary.instagram_app_secret_raw && !igStore.appSecret) {
            updates.appSecret = summary.instagram_app_secret_raw
          }
          if (summary.instagram_user_id && !igStore.userId) {
            updates.userId = summary.instagram_user_id
          }
          if (Object.keys(updates).length > 0) {
            updateInstagramStore(0, updates)
          }
        }
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('/api/line-scraper/status?store_id=1')
      .then((r) => r.json())
      .then((data: { configured: boolean; schedule: string; last_run: string | null; next_run: string | null }) => {
        setScraperConfigured(data.configured)
        setScraperSchedule(data.schedule || '')
        setScraperLastRun(data.last_run)
        setScraperNextRun(data.next_run)
      })
      .catch(() => {})
  }, [])

  const handleScraperRun = async () => {
    setScraperStatus('running')
    setScraperMsg('')
    try {
      const result = await postJson<{ ok: boolean; message: string }>('/api/line-scraper/run', { store_id: 1 })
      setScraperStatus(result.ok ? 'success' : 'error')
      setScraperMsg(result.message)
      if (result.ok) {
        setScraperLastRun(new Date().toISOString())
      }
    } catch (e) {
      setScraperStatus('error')
      setScraperMsg(`実行エラー: ${e}`)
    }
  }

  const handleScraperScheduleSave = async () => {
    try {
      const result = await postJson<{ ok: boolean; message: string }>('/api/line-scraper/schedule', {
        store_id: 1,
        schedule: scraperSchedule,
      })
      setScraperMsg(result.message)
      setScraperStatus(result.ok ? 'success' : 'error')
    } catch (e) {
      setScraperMsg(`保存エラー: ${e}`)
      setScraperStatus('error')
    }
  }

  const handleTestIg = async (index: number) => {
    setIgStatuses((p) => ({ ...p, [index]: 'testing' }))
    const result: ConnectionTestResult = await testInstagram(settings.instagram[index])
    setIgStatuses((p) => ({ ...p, [index]: result.status }))
    setIgMessages((p) => ({ ...p, [index]: result.message }))

    if (result.status === 'success') {
      try {
        const store = settings.instagram[index]
        const storeId = index + 1
        const credsToSave: Record<string, string> = {
          instagram_user_id: store.userId,
          instagram_access_token: store.accessToken,
        }
        if (store.appSecret) credsToSave.instagram_app_secret = store.appSecret
        await saveCredentials(storeId, credsToSave)
        saveSettings(settings)
        setIgMessages((p) => ({ ...p, [index]: '接続成功！認証情報を保存しました。データを取得中...' }))

        const fetchResult = await postJson<{ ok: boolean; message: string }>('/api/fetch/instagram', {
          user_id: store.userId,
          access_token: store.accessToken,
          app_secret: store.appSecret || undefined,
          store_id: storeId,
          days: 30,
        })
        setIgMessages((p) => ({
          ...p,
          [index]: fetchResult.ok
            ? fetchResult.message
            : `認証情報は保存済み。データ取得エラー: ${fetchResult.message}`,
        }))
      } catch (e) {
        console.warn('Auto-save/fetch failed:', e)
        setIgMessages((p) => ({ ...p, [index]: '接続成功（自動保存またはデータ取得に失敗しました）' }))
      }
    }
  }

  const handleTestLine = async () => {
    setLineStatus('testing')
    const result = await testLine(settings.line)
    setLineStatus(result.status)
    setLineMsg(result.message)

    if (result.status === 'success') {
      try {
        await saveCredentials(1, {
          line_channel_access_token: settings.line.channelAccessToken,
        })
        saveSettings(settings)
        setLineMsg('接続成功！認証情報を保存しました。データを取得中...')

        const fetchResult = await postJson<{ ok: boolean; message: string }>('/api/fetch/line', {
          channel_access_token: settings.line.channelAccessToken,
          store_id: 1,
          days: 30,
        })
        setLineMsg(fetchResult.ok
          ? fetchResult.message
          : `認証情報は保存済み。データ取得エラー: ${fetchResult.message}`)
      } catch (e) {
        console.warn('Auto-save/fetch failed:', e)
        setLineMsg('接続成功（自動保存またはデータ取得に失敗しました）')
      }
    }
  }

  const handleTestGA4 = async () => {
    setGa4Status('testing')
    const result = await testGA4(settings.ga4, ga4ParsedRef.current)
    setGa4Status(result.status)
    setGa4Msg(result.message)

    // On success: auto-save credentials + trigger data fetch
    const parsed = result.parsedJson
    if (result.status === 'success' && parsed) {
      try {
        // Save credentials to backend DB
        await saveCredentials(1, {
          ga4_property_id: settings.ga4.propertyId,
          ga4_service_account_json: JSON.stringify(parsed),
        })
        // Also save to localStorage
        saveSettings(settings)
        setGa4Msg('接続成功！認証情報を保存しました。GA4データを取得中...')

        // Trigger initial GA4 data fetch (last 30 days)
        const fetchResult = await postJson<{ ok: boolean; message: string }>('/api/fetch/ga4', {
          property_id: settings.ga4.propertyId,
          service_account_json: parsed,
          store_id: 1,
          days: 30,
        })
        setGa4Msg(fetchResult.ok
          ? fetchResult.message
          : `認証情報は保存済み。データ取得エラー: ${fetchResult.message}`)
      } catch (e) {
        console.warn('Auto-save/fetch failed:', e)
        setGa4Msg('接続成功（自動保存またはデータ取得に失敗しました）')
      }
    }
  }

  const handleTestGbp = async (index: number) => {
    setGbpStatuses((p) => ({ ...p, [index]: 'testing' }))
    const result: ConnectionTestResult = await testGBP(settings.gbp[index])
    setGbpStatuses((p) => ({ ...p, [index]: result.status }))
    setGbpMessages((p) => ({ ...p, [index]: result.message }))

    if (result.status === 'success') {
      try {
        const store = settings.gbp[index]
        const storeId = index + 1
        await saveCredentials(storeId, {
          gbp_location_id: store.locationId,
          gbp_oauth_client_id: store.oauthClientId,
          gbp_oauth_client_secret: store.oauthClientSecret,
          gbp_oauth_refresh_token: store.refreshToken,
        })
        saveSettings(settings)
        setGbpMessages((p) => ({ ...p, [index]: '接続成功！認証情報を保存しました。データを取得中...' }))

        const fetchResult = await postJson<{ ok: boolean; message: string }>('/api/fetch/gbp', {
          location_id: store.locationId,
          oauth_client_id: store.oauthClientId,
          oauth_client_secret: store.oauthClientSecret,
          oauth_refresh_token: store.refreshToken,
          store_id: storeId,
          days: 30,
        })
        setGbpMessages((p) => ({
          ...p,
          [index]: fetchResult.ok
            ? fetchResult.message
            : `認証情報は保存済み。データ取得エラー: ${fetchResult.message}`,
        }))
      } catch (e) {
        console.warn('Auto-save/fetch failed:', e)
        setGbpMessages((p) => ({ ...p, [index]: '接続成功（自動保存またはデータ取得に失敗しました）' }))
      }
    }
  }

  const [saveError, setSaveError] = useState('')

  const handleSave = async () => {
    // Save to localStorage
    saveSettings(settings)

    // Also save GA4/GBP credentials to backend DB (store_id=1 as default)
    try {
      const ga4Creds: Record<string, string> = {}
      if (settings.ga4.propertyId) ga4Creds.ga4_property_id = settings.ga4.propertyId
      if (settings.ga4.serviceAccountJson) ga4Creds.ga4_service_account_json = settings.ga4.serviceAccountJson
      if (Object.keys(ga4Creds).length > 0) {
        await saveCredentials(1, ga4Creds)
      }

      // Save LINE OA scraping credentials
      const lineCreds: Record<string, string> = {}
      if (settings.line.oaEmail) lineCreds.line_oa_email = settings.line.oaEmail
      if (settings.line.oaPassword) lineCreds.line_oa_password = settings.line.oaPassword
      if (settings.line.oaAccountId) lineCreds.line_oa_account_id = settings.line.oaAccountId
      if (Object.keys(lineCreds).length > 0) {
        await saveCredentials(1, lineCreds)
      }

      // Save first GBP store credentials
      if (settings.gbp.length > 0) {
        const gbp = settings.gbp[0]
        const gbpCreds: Record<string, string> = {}
        if (gbp.locationId) gbpCreds.gbp_location_id = gbp.locationId
        if (gbp.oauthClientId) gbpCreds.gbp_oauth_client_id = gbp.oauthClientId
        if (gbp.oauthClientSecret) gbpCreds.gbp_oauth_client_secret = gbp.oauthClientSecret
        if (gbp.refreshToken) gbpCreds.gbp_oauth_refresh_token = gbp.refreshToken
        if (Object.keys(gbpCreds).length > 0) {
          await saveCredentials(1, gbpCreds)
        }
      }

      setSaveError('')
    } catch (e) {
      console.warn('Backend credential save failed:', e)
      setSaveError('ローカルに保存しました（バックエンドへの保存に失敗しました）')
    }

    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setSaveError('')
    }, 3000)
  }

  return (
    <>
      <Header title="API設定" icon="settings" color="#6366F1" lightBg="#EEF2FF" />

      <div className="space-y-6">
        {/* ========== Instagram (multi-store) ========== */}
        <Card>
          <CardHeader>
            <SectionHeader
              icon="photo_camera"
              color="#E1306C"
              lightBg="#FCE7EF"
              label="Instagram"
            />
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={addInstagramStore}
              >
                <span className="material-symbols-outlined text-base">add</span>
                店舗を追加
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            {settings.instagram.map((store, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-4 space-y-4"
                style={{ borderLeft: '3px solid #E1306C' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    店舗 {i + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleTestIg(i)}
                      disabled={igStatuses[i] === 'testing'}
                    >
                      <span className="material-symbols-outlined text-sm">cable</span>
                      接続テスト
                    </Button>
                    {settings.instagram.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeInstagramStore(i)}
                      >
                        <span className="material-symbols-outlined text-base text-muted-foreground">close</span>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>店舗名</Label>
                    <Input
                      placeholder="渋谷店"
                      value={store.storeName}
                      onChange={(e) =>
                        updateInstagramStore(i, { storeName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram User ID</Label>
                    <Input
                      placeholder="17841400000000000"
                      value={store.userId}
                      onChange={(e) =>
                        updateInstagramStore(i, { userId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Meta Access Token</Label>
                    <Input
                      type="password"
                      placeholder="EAAxxxxxxx..."
                      value={store.accessToken}
                      onChange={(e) =>
                        updateInstagramStore(i, { accessToken: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>App Secret</Label>
                    <Input
                      type="password"
                      placeholder="Meta App Secret"
                      value={store.appSecret}
                      onChange={(e) =>
                        updateInstagramStore(i, { appSecret: e.target.value })
                      }
                    />
                  </div>
                </div>
                <StatusIndicator
                  status={igStatuses[i] || 'untested'}
                  message={igMessages[i] || ''}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ========== LINE ========== */}
        <Card>
          <CardHeader>
            <SectionHeader
              icon="chat"
              color="#00B900"
              lightBg="#E6F9E6"
              label="LINE"
            />
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestLine}
                disabled={lineStatus === 'testing'}
              >
                <span className="material-symbols-outlined text-base">cable</span>
                接続テスト
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="line-token">Channel Access Token</Label>
              <Input
                id="line-token"
                type="password"
                placeholder="xxxxxxxxxxxxxxx"
                value={settings.line.channelAccessToken}
                onChange={(e) =>
                  updateLine({ channelAccessToken: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                LINE Messaging API のチャネルアクセストークン（友だち数・属性データ取得用）
              </p>
            </div>
            <StatusIndicator status={lineStatus} message={lineMsg} />

            <Separator />

            {/* LINE OA Manager スクレイピング設定 */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">
                LINE OAマネージャー スクレイピング設定
              </h4>
              <p className="text-xs text-muted-foreground mb-4">
                配信メッセージの開封率・クリック率を自動取得するための認証情報です。
              </p>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="line-oa-email">LINE Business メールアドレス</Label>
                  <Input
                    id="line-oa-email"
                    type="email"
                    placeholder="example@company.com"
                    value={settings.line.oaEmail}
                    onChange={(e) =>
                      updateLine({ oaEmail: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="line-oa-password">パスワード</Label>
                  <Input
                    id="line-oa-password"
                    type="password"
                    placeholder="••••••••"
                    value={settings.line.oaPassword}
                    onChange={(e) =>
                      updateLine({ oaPassword: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="line-oa-account-id">アカウントID（任意）</Label>
                <Input
                  id="line-oa-account-id"
                  placeholder="例: @restaurant-shibuya"
                  value={settings.line.oaAccountId}
                  onChange={(e) =>
                    updateLine({ oaAccountId: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  manager.line.biz のアカウントID。未入力の場合、最初のアカウントが使用されます。
                </p>
              </div>
            </div>

            <Separator />

            {/* スクレイピング コントロールパネル */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-1">
                スクレイピング コントロール
              </h4>
              <p className="text-xs text-muted-foreground mb-4">
                LINE APIデータの手動取得・スケジュール設定
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1 space-y-2">
                  <Label>スケジュール</Label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={scraperSchedule}
                      onChange={(e) => setScraperSchedule(e.target.value)}
                    >
                      <option value="">無効</option>
                      <option value="0 4 * * *">毎日 4:00</option>
                      <option value="0 8 * * *">毎日 8:00</option>
                      <option value="0 12 * * *">毎日 12:00</option>
                      <option value="0 20 * * *">毎日 20:00</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={handleScraperScheduleSave}>
                      保存
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 mb-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-20">ステータス:</span>
                  {scraperConfigured ? (
                    <span className="flex items-center gap-1 text-success">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      認証情報設定済み
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span className="material-symbols-outlined text-sm">info</span>
                      未設定
                    </span>
                  )}
                </div>
                {scraperLastRun && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-20">最終実行:</span>
                    <span>{new Date(scraperLastRun).toLocaleString('ja-JP')}</span>
                  </div>
                )}
                {scraperNextRun && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-20">次回予定:</span>
                    <span>{new Date(scraperNextRun).toLocaleString('ja-JP')}</span>
                  </div>
                )}
              </div>

              <Button
                variant="outline"
                onClick={handleScraperRun}
                disabled={scraperStatus === 'running'}
              >
                {scraperStatus === 'running' ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                    実行中...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">play_arrow</span>
                    今すぐ実行
                  </>
                )}
              </Button>

              {scraperMsg && (
                <div className={`mt-2 flex items-center gap-2 text-sm ${scraperStatus === 'error' ? 'text-danger' : 'text-success'}`}>
                  <span className="material-symbols-outlined text-base">
                    {scraperStatus === 'error' ? 'error' : 'check_circle'}
                  </span>
                  {scraperMsg}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ========== GA4 ========== */}
        <Card>
          <CardHeader>
            <SectionHeader
              icon="monitoring"
              color="#4285F4"
              lightBg="#EBF2FF"
              label="Google Analytics 4"
            />
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestGA4}
                disabled={ga4Status === 'testing'}
              >
                <span className="material-symbols-outlined text-base">cable</span>
                接続テスト
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="ga4-property">Property ID</Label>
              <Input
                id="ga4-property"
                placeholder="123456789"
                value={settings.ga4.propertyId}
                onChange={(e) =>
                  updateGA4({ propertyId: e.target.value })
                }
              />
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="ga4-sa-json">サービスアカウントJSON</Label>
              <div className="flex gap-2 mb-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => ga4FileRef.current?.click()}
                >
                  <span className="material-symbols-outlined text-base">upload_file</span>
                  JSONファイルを選択
                </Button>
                {settings.ga4.serviceAccountJson && (
                  <span className="text-xs text-green-600 flex items-center">✅ 設定済み</span>
                )}
                <input
                  ref={ga4FileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (ev) => {
                        const text = ev.target?.result as string
                        try {
                          const parsed = JSON.parse(text)
                          ga4ParsedRef.current = parsed
                          updateGA4({ serviceAccountJson: JSON.stringify(parsed, null, 2) })
                        } catch {
                          ga4ParsedRef.current = null
                          updateGA4({ serviceAccountJson: text })
                        }
                      }
                      reader.readAsText(file)
                    }
                    e.target.value = ''
                  }}
                />
              </div>
              <Textarea
                id="ga4-sa-json"
                placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", "client_email": "...", ...}'
                rows={6}
                value={settings.ga4.serviceAccountJson}
                onChange={(e) =>
                  updateGA4({ serviceAccountJson: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                JSONファイルをアップロードするか、内容を貼り付けてください。
              </p>
            </div>
            <StatusIndicator status={ga4Status} message={ga4Msg} />
          </CardContent>
        </Card>

        {/* ========== GBP (multi-store) ========== */}
        <Card>
          <CardHeader>
            <SectionHeader
              icon="location_on"
              color="#EA4335"
              lightBg="#FDECE9"
              label="Google ビジネスプロフィール"
            />
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={addGBPStore}
              >
                <span className="material-symbols-outlined text-base">add</span>
                店舗を追加
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-6">
            {settings.gbp.map((store, i) => (
              <div
                key={i}
                className="rounded-lg border border-border p-4 space-y-4"
                style={{ borderLeft: '3px solid #EA4335' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    店舗 {i + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => handleTestGbp(i)}
                      disabled={gbpStatuses[i] === 'testing'}
                    >
                      <span className="material-symbols-outlined text-sm">cable</span>
                      接続テスト
                    </Button>
                    {settings.gbp.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeGBPStore(i)}
                      >
                        <span className="material-symbols-outlined text-base text-muted-foreground">close</span>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>店舗名</Label>
                    <Input
                      placeholder="渋谷店"
                      value={store.storeName}
                      onChange={(e) =>
                        updateGBPStore(i, { storeName: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location ID</Label>
                    <Input
                      placeholder="12345678901234567"
                      value={store.locationId}
                      onChange={(e) =>
                        updateGBPStore(i, { locationId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>OAuth Client ID</Label>
                    <Input
                      placeholder="xxxx.apps.googleusercontent.com"
                      value={store.oauthClientId}
                      onChange={(e) =>
                        updateGBPStore(i, { oauthClientId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>OAuth Client Secret</Label>
                    <Input
                      type="password"
                      placeholder="GOCSPX-xxxxx"
                      value={store.oauthClientSecret}
                      onChange={(e) =>
                        updateGBPStore(i, { oauthClientSecret: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>リフレッシュトークン</Label>
                  <Input
                    type="password"
                    placeholder="1//xxxxx"
                    value={store.refreshToken}
                    onChange={(e) =>
                      updateGBPStore(i, { refreshToken: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Google Cloud Console でOAuth 2.0クライアントを作成し、リフレッシュトークンを取得してください。
                  </p>
                </div>
                <StatusIndicator
                  status={gbpStatuses[i] || 'untested'}
                  message={gbpMessages[i] || ''}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Separator />

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <Button size="lg" className="w-full sm:w-auto" onClick={handleSave}>
            <span className="material-symbols-outlined text-base">save</span>
            設定を保存
          </Button>
          {saved && !saveError && (
            <span className="text-sm text-success">保存しました</span>
          )}
          {saveError && (
            <span className="text-sm text-amber-600">{saveError}</span>
          )}
        </div>
      </div>
    </>
  )
}
