import { useState } from 'react'
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
import { testInstagram, testLine, testGA4, testGBP } from '@/utils/apiTest'
import { saveCredentials } from '@/utils/api'
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
  const [ga4Status, setGa4Status] = useState<ConnectionStatus>('untested')
  const [ga4Msg, setGa4Msg] = useState('')

  // Per-store statuses for GBP
  const [gbpStatuses, setGbpStatuses] = useState<Record<number, ConnectionStatus>>({})
  const [gbpMessages, setGbpMessages] = useState<Record<number, string>>({})

  const [saved, setSaved] = useState(false)

  const handleTestIg = async (index: number) => {
    setIgStatuses((p) => ({ ...p, [index]: 'testing' }))
    const result: ConnectionTestResult = await testInstagram(settings.instagram[index])
    setIgStatuses((p) => ({ ...p, [index]: result.status }))
    setIgMessages((p) => ({ ...p, [index]: result.message }))
  }

  const handleTestLine = async () => {
    setLineStatus('testing')
    const result = await testLine(settings.line)
    setLineStatus(result.status)
    setLineMsg(result.message)
  }

  const handleTestGA4 = async () => {
    setGa4Status('testing')
    const result = await testGA4(settings.ga4)
    setGa4Status(result.status)
    setGa4Msg(result.message)
  }

  const handleTestGbp = async (index: number) => {
    setGbpStatuses((p) => ({ ...p, [index]: 'testing' }))
    const result: ConnectionTestResult = await testGBP(settings.gbp[index])
    setGbpStatuses((p) => ({ ...p, [index]: result.status }))
    setGbpMessages((p) => ({ ...p, [index]: result.message }))
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
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
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
                    <Label>Instagram User ID</Label>
                    <Input
                      placeholder="17841400000000000"
                      value={store.userId}
                      onChange={(e) =>
                        updateInstagramStore(i, { userId: e.target.value })
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
          <CardContent>
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
            </div>
            <StatusIndicator status={lineStatus} message={lineMsg} />
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
                Google Cloud Console からダウンロードしたサービスアカウントのJSONキーをそのまま貼り付けてください。
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
