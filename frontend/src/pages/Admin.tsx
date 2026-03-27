import { useState, useRef, useEffect, useCallback, type ReactNode, type FormEvent, type CSSProperties } from 'react'
import Header from '@/components/layout/Header'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardAction,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { useApiSettings } from '@/hooks/useApiSettings'
import type { InstagramStoreSettings } from '@/types/settings'
import type { ConnectionStatus, ConnectionTestResult } from '@/types/settings'
import { testInstagram, testLine, testGA4, testGBP } from '@/utils/apiTest'
import { saveCredentials, fetchCredentialsSummary, fetchStores, postJson } from '@/utils/api'
import { InstagramIcon, LineIcon, GA4Icon, GBPIcon } from '@/components/common/BrandIcons'

// ─── CSS for animations ───
const animationStyles = `
@keyframes fadeInUp {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes tokenPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .status-card, .tab-content-enter, .tab-content-active, .tab-indicator {
    animation: none !important;
    transition-duration: 0ms !important;
  }
}
`

// ─── Types ───
type MainTab = 'status' | 'api' | 'accounts'
type ApiSubTab = 'instagram' | 'line' | 'ga4' | 'gbp'

interface AccountUser {
  id: number
  username: string
  role: string
  store_id: number | null
  display_name: string
  is_active: number
}

interface AccountStore {
  id: number
  name: string
}

const ROLE_OPTIONS = [
  { value: 'hq', label: '本部 (HQ)' },
  { value: 'pr', label: '広報担当' },
  { value: 'manager', label: '店舗マネージャー' },
  { value: 'staff', label: '社員' },
]

const ROLE_LABELS: Record<string, string> = {
  hq: '本部',
  pr: '広報',
  manager: '店舗MGR',
  staff: '社員',
}

const ROLE_COLORS: Record<string, string> = {
  hq: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  pr: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  manager: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  staff: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
}

// ─── Sub-components ───

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

function SaveButton({
  onClick,
  label = '保存',
}: {
  onClick: () => Promise<void> | void
  label?: string
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const handleClick = async () => {
    setState('saving')
    try {
      await onClick()
      setState('saved')
      setTimeout(() => setState('idle'), 1500)
    } catch {
      setState('idle')
    }
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleClick}
      disabled={state === 'saving'}
    >
      {state === 'saved' ? (
        <span
          className="flex items-center gap-1"
          style={{ opacity: 1, transition: 'opacity 150ms ease-out' }}
        >
          <span className="material-symbols-outlined text-base">check</span>
          保存しました
        </span>
      ) : (
        <>
          <span className="material-symbols-outlined text-base">save</span>
          {label}
        </>
      )}
    </Button>
  )
}

// ─── Main Component ───

export default function Admin() {
  const { user: currentUser, token, canAccessSettings, canManageUsers } = useAuth()

  // Determine available tabs based on role
  const tabs: { key: MainTab; label: string; icon: string }[] = []
  tabs.push({ key: 'status', label: '接続ステータス', icon: 'wifi' })
  if (canAccessSettings) {
    tabs.push({ key: 'api', label: 'API設定', icon: 'settings' })
  }
  if (canManageUsers) {
    tabs.push({ key: 'accounts', label: 'アカウント管理', icon: 'group' })
  }

  const [activeTab, setActiveTab] = useState<MainTab>('status')
  const [pendingSubTab, setPendingSubTab] = useState<ApiSubTab | null>(null)
  const [tabTransition, setTabTransition] = useState(false)
  const [isKeyboardNav, setIsKeyboardNav] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tabContainerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({})

  // Update indicator position
  const updateIndicator = useCallback(() => {
    const activeIndex = tabs.findIndex((t) => t.key === activeTab)
    const el = tabRefs.current[activeIndex]
    const container = tabContainerRef.current
    if (el && container) {
      const containerRect = container.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      setIndicatorStyle({
        transform: `translateX(${elRect.left - containerRect.left}px)`,
        width: `${elRect.width}px`,
      })
    }
  }, [activeTab, tabs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [updateIndicator])

  const switchTab = useCallback((tab: MainTab, viaKeyboard: boolean, subTab?: ApiSubTab) => {
    setIsKeyboardNav(viaKeyboard)
    if (subTab) setPendingSubTab(subTab)
    setTabTransition(true)
    // Allow opacity to drop, then switch content
    requestAnimationFrame(() => {
      setActiveTab(tab)
      // Reset transition flag after content renders
      requestAnimationFrame(() => {
        setTabTransition(false)
      })
    })
  }, [])

  // Tab content animation style
  const contentStyle: CSSProperties = isKeyboardNav
    ? {}
    : tabTransition
      ? { opacity: 0, transform: 'translateY(4px)' }
      : {
          opacity: 1,
          transform: 'translateY(0)',
          transition: 'opacity 150ms ease-out, transform 150ms ease-out',
        }

  // Indicator transition style
  const indicatorTransitionStyle: CSSProperties = isKeyboardNav
    ? { ...indicatorStyle, transition: 'none' }
    : {
        ...indicatorStyle,
        transition:
          'transform 200ms cubic-bezier(0.23, 1, 0.32, 1), width 200ms cubic-bezier(0.23, 1, 0.32, 1)',
      }

  return (
    <>
      <style>{animationStyles}</style>
      <Header title="管理" icon="admin_panel_settings" color="#CC5500" lightBg="#FFF0E5" />

      {/* ─── Tab Bar (Pill Style) ─── */}
      <div className="mb-6">
        <div ref={tabContainerRef} className="relative flex gap-1 rounded-xl bg-muted/60 p-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[i] = el }}
              onClick={() => switchTab(tab.key, false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  switchTab(tab.key, true)
                }
              }}
              className={`relative z-10 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              role="tab"
              aria-selected={activeTab === tab.key}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
          {/* Sliding pill indicator */}
          <div
            className="absolute top-1 h-[calc(100%-8px)] rounded-lg bg-card shadow-sm"
            style={indicatorTransitionStyle}
          />
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div style={contentStyle}>
        {activeTab === 'status' && <StatusTab onNavigateToApi={(platform) => switchTab('api', false, platform)} />}
        {activeTab === 'api' && canAccessSettings && <ApiSettingsTab initialSubTab={pendingSubTab} onSubTabConsumed={() => setPendingSubTab(null)} />}
        {activeTab === 'accounts' && canManageUsers && (
          <AccountsTab token={token} currentUser={currentUser} />
        )}
      </div>
    </>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 1: 接続ステータス
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PlatformStatus {
  platform: string
  connected: boolean
  warning?: boolean
  metric: string
  detail?: string
  tokenDaysRemaining?: number
}

function StatusTab({ onNavigateToApi }: { onNavigateToApi: (platform?: ApiSubTab) => void }) {
  const { canAccessSettings } = useAuth()
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([])
  const [lastFetch, setLastFetch] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        // 最初の店舗IDを取得
        const stores = await fetchStores().catch(() => [])
        const firstStoreId = stores.length > 0 ? stores[0].id : 1
        const summary = await fetchCredentialsSummary(firstStoreId)
        if (cancelled) return

        const igConnected = !!(summary?.instagram_access_token && summary.instagram_user_id)
        const lineConnected = !!summary?.line_channel_access_token
        const lineOaConfigured = false // OAスクレイパー廃止
        const ga4Connected = !!(summary?.ga4_property_id && summary?.ga4_service_account_json_set)
        const gbpConnected = !!(summary?.gbp_location_id && summary?.gbp_oauth_client_id && summary?.gbp_oauth_refresh_token_set)

        // Real token expiry from DB
        let tokenDays: number | undefined
        if (igConnected && summary?.instagram_token_expires_at) {
          const expiresAt = new Date(summary.instagram_token_expires_at)
          tokenDays = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)
          if (tokenDays < 0) tokenDays = 0
        } else if (igConnected) {
          tokenDays = undefined // 有効期限不明
        }

        setPlatforms([
          {
            platform: 'Instagram',
            connected: igConnected,
            metric: igConnected
              ? (tokenDays !== undefined ? (tokenDays > 0 ? `トークン残り${tokenDays}日` : 'トークン期限切れ') : 'トークン接続済み（期限不明）')
              : '未接続',
            tokenDaysRemaining: tokenDays,
            warning: tokenDays !== undefined && tokenDays < 14,
          },
          {
            platform: 'LINE',
            connected: lineConnected,
            metric: lineConnected
              ? lineOaConfigured ? 'API接続 + スクレイパー設定済み' : 'API接続済み'
              : '未接続',
          },
          {
            platform: 'GA4',
            connected: ga4Connected,
            metric: ga4Connected ? '接続済み' : '未設定',
          },
          {
            platform: 'GBP',
            connected: gbpConnected,
            metric: gbpConnected ? '接続済み' : '未接続',
          },
        ])
        setLastFetch(new Date().toLocaleString('ja-JP'))
      } catch {
        setPlatforms([
          { platform: 'Instagram', connected: false, metric: '取得エラー' },
          { platform: 'LINE', connected: false, metric: '取得エラー' },
          { platform: 'GA4', connected: false, metric: '取得エラー' },
          { platform: 'GBP', connected: false, metric: '取得エラー' },
        ])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const platformIcons: Record<string, ReactNode> = {
    Instagram: <InstagramIcon size={22} />,
    LINE: <LineIcon size={22} />,
    GA4: <GA4Icon size={22} />,
    GBP: <GBPIcon size={22} />,
  }

  const platformToSubTab: Record<string, ApiSubTab> = {
    Instagram: 'instagram',
    LINE: 'line',
    GA4: 'ga4',
    GBP: 'gbp',
  }

  const platformBorderColors: Record<string, string> = {
    Instagram: 'linear-gradient(180deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
    LINE: '#00B900',
    GA4: '#E37400',
    GBP: '#EA4335',
  }

  const connectedCount = platforms.filter((p) => p.connected).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined animate-spin text-2xl text-muted-foreground">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Summary Bar */}
      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {platforms.map((p) => (
              <div
                key={p.platform}
                className={`size-2 rounded-full transition-colors ${
                  p.connected
                    ? p.warning ? 'bg-amber-400' : 'bg-emerald-500'
                    : 'bg-red-400'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium text-foreground">
            {connectedCount}/{platforms.length} 接続済み
          </span>
        </div>
        {lastFetch && (
          <span className="text-xs text-muted-foreground">
            最終確認: {lastFetch}
          </span>
        )}
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {platforms.map((p, i) => {
          const borderColor = p.connected ? platformBorderColors[p.platform] : undefined
          const isGradient = borderColor?.includes('gradient')

          return (
            <div
              key={p.platform}
              className="status-card"
              style={{
                opacity: 0,
                transform: 'translateY(8px)',
                animation: `fadeInUp 300ms ease-out forwards`,
                animationDelay: `${i * 60}ms`,
              }}
            >
              <div
                className={`group relative overflow-hidden rounded-xl border bg-card transition-all duration-200 ${
                  canAccessSettings ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''
                } ${p.connected ? 'border-transparent' : 'border-border'}`}
                onClick={canAccessSettings ? () => onNavigateToApi(platformToSubTab[p.platform]) : undefined}
              >
                {/* Left accent border */}
                <div
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{
                    background: borderColor || 'var(--border)',
                  }}
                />

                <div className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-10 items-center justify-center rounded-lg ${
                        p.connected ? 'bg-muted' : 'bg-muted/60'
                      }`}>
                        {platformIcons[p.platform]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{p.platform}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{p.metric}</div>
                      </div>
                    </div>

                    {/* Status dot + label */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${
                        p.connected
                          ? p.warning ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}>
                        {p.connected ? (p.warning ? '警告' : '接続済み') : '未接続'}
                      </span>
                      <div className={`size-2.5 rounded-full ${
                        p.connected
                          ? p.warning
                            ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]'
                            : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]'
                          : 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.3)]'
                      }`}
                        style={!p.connected ? { animation: 'tokenPulse 2.5s ease-in-out infinite' } : undefined}
                      />
                    </div>
                  </div>

                  {/* Token warning for Instagram */}
                  {p.tokenDaysRemaining !== undefined && p.tokenDaysRemaining < 30 && (
                    <div className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      トークン残り {p.tokenDaysRemaining} 日 — 更新を推奨
                    </div>
                  )}
                  {p.tokenDaysRemaining !== undefined && p.tokenDaysRemaining >= 30 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      トークン残り {p.tokenDaysRemaining} 日
                    </div>
                  )}
                </div>

                {/* Hover arrow indicator */}
                {canAccessSettings && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="material-symbols-outlined text-base text-muted-foreground">chevron_right</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 2: API設定 (HQ only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ApiSettingsTab({ initialSubTab, onSubTabConsumed }: { initialSubTab?: ApiSubTab | null; onSubTabConsumed?: () => void }) {
  const [subTab, setSubTab] = useState<ApiSubTab>(initialSubTab || 'instagram')

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab)
      onSubTabConsumed?.()
    }
  }, [initialSubTab]) // eslint-disable-line react-hooks/exhaustive-deps
  const [subTabTransition, setSubTabTransition] = useState(false)

  const subTabs: { key: ApiSubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'instagram', label: 'Meta/IG', icon: <InstagramIcon size={16} /> },
    { key: 'line', label: 'LINE', icon: <LineIcon size={16} /> },
    { key: 'ga4', label: 'GA4', icon: <GA4Icon size={16} /> },
    { key: 'gbp', label: 'GBP', icon: <GBPIcon size={16} /> },
  ]

  const switchSubTab = useCallback((tab: ApiSubTab) => {
    setSubTabTransition(true)
    requestAnimationFrame(() => {
      setSubTab(tab)
      requestAnimationFrame(() => setSubTabTransition(false))
    })
  }, [])

  const subContentStyle: CSSProperties = subTabTransition
    ? { opacity: 0, transform: 'translateY(4px)' }
    : {
        opacity: 1,
        transform: 'translateY(0)',
        transition: 'opacity 150ms ease-out, transform 150ms ease-out',
      }

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 pl-2 border-b border-border/60">
        {subTabs.map((st) => (
          <button
            key={st.key}
            onClick={() => switchSubTab(st.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors duration-150 ${
              subTab === st.key
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {st.icon}
            {st.label}
          </button>
        ))}
      </div>

      <div style={subContentStyle}>
        {subTab === 'instagram' && <InstagramSubTab />}
        {subTab === 'line' && <LineSubTab />}
        {subTab === 'ga4' && <GA4SubTab />}
        {subTab === 'gbp' && <GBPSubTab />}
      </div>
    </div>
  )
}

// ─── Instagram Sub-tab ───

function TokenExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return null
  const expires = new Date(expiresAt)
  const now = new Date()
  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / 86400000)

  if (daysLeft <= 0) {
    return (
      <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
        <span className="material-symbols-outlined text-sm align-middle mr-1">error</span>
        トークン期限切れ — 即座に更新してください
      </div>
    )
  }
  if (daysLeft < 14) {
    return (
      <div
        className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        style={{ animation: 'tokenPulse 2s ease-in-out infinite' }}
      >
        <span className="material-symbols-outlined text-sm align-middle mr-1">warning</span>
        トークン残り {daysLeft} 日 — 更新を推奨
      </div>
    )
  }
  return (
    <div className="text-xs text-muted-foreground">
      <span className="material-symbols-outlined text-sm align-middle mr-1">schedule</span>
      トークン残り {daysLeft} 日（{expires.toLocaleDateString('ja-JP')} まで）
    </div>
  )
}

function InstagramSubTab() {
  const {
    settings,
    saveSettings,
    updateInstagramStore,
    addInstagramStore,
    removeInstagramStore,
  } = useApiSettings()

  const [igStatuses, setIgStatuses] = useState<Record<number, ConnectionStatus>>({})
  const [igMessages, setIgMessages] = useState<Record<number, string>>({})
  const [tokenExpiries, setTokenExpiries] = useState<Record<number, string | null>>({})
  const [refreshingToken, setRefreshingToken] = useState<Record<number | 'shared', boolean>>({})
  const [dbStoreIds, setDbStoreIds] = useState<number[]>([]) // 実際のDB上のstore ID

  // Shared Meta credentials (stored on the first store entry)
  const sharedAppId = settings.instagram[0]?.appId || ''
  const sharedAppSecret = settings.instagram[0]?.appSecret || ''
  const sharedAccessToken = settings.instagram[0]?.accessToken || ''

  // Helper: index → actual DB store ID
  const getStoreId = (index: number) => dbStoreIds[index] || (index + 1)

  // Load DB credentials for all stores on mount — DB起点で店舗リストを構築
  useEffect(() => {
    async function loadAllStores() {
      const stores = await fetchStores().catch(() => [])
      if (stores.length === 0) return
      const ids = stores.map((s) => s.id)
      setDbStoreIds(ids)

      // 全店舗の認証情報を一括取得
      const summaries = await Promise.all(
        ids.map((id) => fetchCredentialsSummary(id).catch(() => null))
      )

      // 最初の店舗のトークンを「共通トークン」とみなす
      const sharedTokenRaw = summaries[0]?.instagram_access_token_raw || ''

      // DBの店舗一覧からInstagram設定を再構築
      const newIgStores: InstagramStoreSettings[] = stores.map((store, i) => {
        const summary = summaries[i]
        const isFirstStore = i === 0
        const storeToken = summary?.instagram_access_token_raw || ''
        const hasOwnToken = storeToken && storeToken !== sharedTokenRaw

        return {
          storeName: store.name,
          userId: summary?.instagram_user_id || '',
          appId: isFirstStore ? (summary?.instagram_app_id || '') : '',
          appSecret: isFirstStore ? (summary?.instagram_app_secret_raw || '') : '',
          accessToken: isFirstStore
            ? storeToken
            : (hasOwnToken ? storeToken : ''),
        }
      })

      // settings を一括更新
      newIgStores.forEach((igStore, i) => {
        updateInstagramStore(i, igStore)
      })
      // 余分なlocalStorage店舗があれば削除（後ろから）
      for (let j = settings.instagram.length - 1; j >= stores.length; j--) {
        removeInstagramStore(j)
      }
      // 不足分があれば追加
      for (let j = settings.instagram.length; j < stores.length; j++) {
        addInstagramStore()
        updateInstagramStore(j, newIgStores[j])
      }

      // Token expiry
      summaries.forEach((summary, i) => {
        if (summary?.instagram_token_expires_at) {
          setTokenExpiries((p) => ({ ...p, [i]: summary.instagram_token_expires_at }))
        }
      })
    }
    loadAllStores()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateSharedField = (field: 'appId' | 'appSecret' | 'accessToken', value: string) => {
    // Update on all stores so the shared token propagates
    settings.instagram.forEach((_, i) => {
      updateInstagramStore(i, { [field]: value })
    })
  }

  const handleTestIg = async (index: number) => {
    setIgStatuses((p) => ({ ...p, [index]: 'testing' }))
    const store = settings.instagram[index]
    const testStore = {
      ...store,
      accessToken: store.accessToken || sharedAccessToken,
      appSecret: store.appSecret || sharedAppSecret,
    }
    const result: ConnectionTestResult = await testInstagram(testStore)
    setIgStatuses((p) => ({ ...p, [index]: result.status }))
    setIgMessages((p) => ({ ...p, [index]: result.message }))
  }

  // Refresh token for shared or per-store
  const handleRefreshToken = async (storeIndex?: number) => {
    const key = storeIndex !== undefined ? storeIndex : 'shared'
    setRefreshingToken((p) => ({ ...p, [key]: true }))
    try {
      const storeId = storeIndex !== undefined ? getStoreId(storeIndex) : getStoreId(0)
      const token = storeIndex !== undefined
        ? (settings.instagram[storeIndex]?.accessToken || sharedAccessToken)
        : sharedAccessToken

      const result = await postJson<{
        ok: boolean
        message: string
        new_token?: string
        expires_days?: number
      }>('/api/instagram/refresh-token', {
        store_id: storeId,
        access_token: token,
        app_id: sharedAppId,
        app_secret: sharedAppSecret,
      })

      if (result.ok && result.new_token) {
        // Update the token in settings
        if (storeIndex !== undefined && settings.instagram[storeIndex]?.accessToken) {
          // Per-store token: update that store only
          updateInstagramStore(storeIndex, { accessToken: result.new_token })
        } else {
          // Shared token: update all stores
          updateSharedField('accessToken', result.new_token)
        }
        // Update expiry display
        if (result.expires_days) {
          const expiresAt = new Date(Date.now() + result.expires_days * 86400000).toISOString()
          if (storeIndex !== undefined) {
            setTokenExpiries((p) => ({ ...p, [storeIndex]: expiresAt }))
          } else {
            // Update expiry for all stores using shared token
            setTokenExpiries((p) => {
              const updated = { ...p }
              settings.instagram.forEach((store, i) => {
                if (!store.accessToken) updated[i] = expiresAt
              })
              // Also update store 0
              updated[0] = expiresAt
              return updated
            })
          }
        }
        alert(result.message)
      } else {
        alert(`トークン更新失敗: ${result.message}`)
      }
    } catch (e) {
      alert(`トークン更新エラー: ${e}`)
    } finally {
      setRefreshingToken((p) => ({ ...p, [key]: false }))
    }
  }

  const handleTestShared = async () => {
    if (settings.instagram.length > 0) {
      await handleTestIg(0)
    }
  }

  const handleSaveShared = async () => {
    const store = settings.instagram[0]
    if (!store) return
    const credsToSave: Record<string, string> = {}
    if (store.accessToken) credsToSave.instagram_access_token = store.accessToken
    if (store.appId) credsToSave.instagram_app_id = store.appId
    if (store.appSecret) credsToSave.instagram_app_secret = store.appSecret
    if (store.userId) credsToSave.instagram_user_id = store.userId
    await saveCredentials(getStoreId(0), credsToSave)
    saveSettings(settings)
  }

  return (
    <div className="space-y-6">
      {/* Meta共通認証 card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ background: '#FCE7EF' }}
            >
              <InstagramIcon size={18} />
            </div>
            <CardTitle style={{ color: '#E1306C' }}>Meta共通認証</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>App ID</Label>
              <Input
                placeholder="Meta App ID"
                value={sharedAppId}
                onChange={(e) => updateSharedField('appId', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>App Secret</Label>
              <Input
                type="password"
                placeholder="Meta App Secret"
                value={sharedAppSecret}
                onChange={(e) => updateSharedField('appSecret', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Access Token（共通）</Label>
            <Input
              type="password"
              placeholder="EAAxxxxxxx..."
              value={sharedAccessToken}
              onChange={(e) => updateSharedField('accessToken', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              全店舗で共通のMeta長期アクセストークン（60日有効）。店舗別トークンがある場合は各店舗カードで設定。
            </p>
          </div>

          <TokenExpiryBadge expiresAt={tokenExpiries[0] || null} />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRefreshToken()}
              disabled={!!refreshingToken['shared']}
            >
              {refreshingToken['shared'] ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  更新中...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">refresh</span>
                  トークン更新（60日延長）
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestShared}
              disabled={igStatuses[0] === 'testing'}
            >
              <span className="material-symbols-outlined text-base">cable</span>
              接続テスト
            </Button>
            <SaveButton onClick={handleSaveShared} label="保存" />
          </div>

          <StatusIndicator
            status={igStatuses[0] || 'untested'}
            message={igMessages[0] || ''}
          />
        </CardContent>
      </Card>

      {/* Per-store cards */}
      {settings.instagram.map((store, i) => {
        const hasOwnToken = !!store.accessToken && store.accessToken !== sharedAccessToken

        const handleSaveStore = async () => {
          const storeId = getStoreId(i)
          const creds: Record<string, string> = {
            instagram_user_id: store.userId,
            instagram_app_id: sharedAppId,
            instagram_app_secret: sharedAppSecret,
          }
          creds.instagram_access_token = store.accessToken || sharedAccessToken
          await saveCredentials(storeId, creds)
          saveSettings(settings)
        }

        return (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-foreground">
                  店舗 {i + 1}{store.storeName ? ` — ${store.storeName}` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleTestIg(i)}
                    disabled={igStatuses[i] === 'testing'}
                  >
                    <span className="material-symbols-outlined text-sm">cable</span>
                    テスト
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
                  <Label>アカウント名（店舗名）</Label>
                  <Input
                    placeholder="uroko.kaisen"
                    value={store.storeName}
                    onChange={(e) => updateInstagramStore(i, { storeName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Instagram User ID（アカウントID）</Label>
                  <Input
                    placeholder="17841400000000000"
                    value={store.userId}
                    onChange={(e) => updateInstagramStore(i, { userId: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>
                  長期アクセストークン
                  <span className="text-xs text-muted-foreground ml-2">
                    （空欄の場合は上の共通トークンを使用）
                  </span>
                </Label>
                <Input
                  type="password"
                  placeholder="共通トークンを使用（店舗専用トークンがある場合のみ入力）"
                  value={store.accessToken}
                  onChange={(e) => updateInstagramStore(i, { accessToken: e.target.value })}
                />
              </div>
              <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    App ID
                    <span className="text-xs text-muted-foreground ml-2">
                      （空欄の場合は上の共通設定を使用）
                    </span>
                  </Label>
                  <Input
                    placeholder="Meta App ID"
                    value={store.appId}
                    onChange={(e) => updateInstagramStore(i, { appId: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    App Secret
                    <span className="text-xs text-muted-foreground ml-2">
                      （空欄の場合は上の共通設定を使用）
                    </span>
                  </Label>
                  <Input
                    type="password"
                    placeholder="Meta App Secret"
                    value={store.appSecret}
                    onChange={(e) => updateInstagramStore(i, { appSecret: e.target.value })}
                  />
                </div>
              </div>

              {/* Per-store token expiry and refresh */}
              {hasOwnToken && (
                <div className="mt-3 space-y-2">
                  <TokenExpiryBadge expiresAt={tokenExpiries[i] || null} />
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => handleRefreshToken(i)}
                    disabled={!!refreshingToken[i]}
                  >
                    {refreshingToken[i] ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                        更新中...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm">refresh</span>
                        この店舗のトークンを更新
                      </>
                    )}
                  </Button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <SaveButton onClick={handleSaveStore} label="この店舗を保存" />
              </div>
              <StatusIndicator
                status={igStatuses[i] || 'untested'}
                message={igMessages[i] || ''}
              />
            </CardContent>
          </Card>
        )
      })}

      <Button variant="outline" size="sm" onClick={addInstagramStore}>
        <span className="material-symbols-outlined text-base">add</span>
        店舗を追加
      </Button>

      {/* Auto-refresh settings card */}
      <AutoRefreshCard />
    </div>
  )
}

function AutoRefreshCard() {
  const [autoRefreshDays, setAutoRefreshDays] = useState(10)
  const [nextCheck, setNextCheck] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [storeStatuses, setStoreStatuses] = useState<
    { store_id: number; store_name: string; has_token: boolean; token_expires_at: string; auto_refresh_days: number }[]
  >([])
  const [saving, setSaving] = useState(false)
  const [runningNow, setRunningNow] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    fetch('/api/instagram/auto-refresh-settings')
      .then((r) => r.json())
      .then((data: { stores: typeof storeStatuses; next_check: string | null; enabled: boolean }) => {
        setStoreStatuses(data.stores)
        setNextCheck(data.next_check)
        setEnabled(data.enabled)
        if (data.stores.length > 0) {
          setAutoRefreshDays(data.stores[0].auto_refresh_days || 10)
        }
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setStatusMsg('')
    try {
      // Save for all stores
      for (const store of storeStatuses) {
        await postJson('/api/instagram/auto-refresh-settings', {
          store_id: store.store_id,
          auto_refresh_days: autoRefreshDays,
        })
      }
      setStatusMsg(`保存しました: 期限の${autoRefreshDays}日前に自動更新`)
    } catch (e) {
      setStatusMsg(`保存エラー: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleRunNow = async () => {
    setRunningNow(true)
    setStatusMsg('')
    try {
      const result = await postJson<{ ok: boolean; message: string }>('/api/instagram/auto-refresh-run', {})
      setStatusMsg(result.message)
    } catch (e) {
      setStatusMsg(`実行エラー: ${e}`)
    } finally {
      setRunningNow(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 items-center justify-center rounded-lg"
            style={{ background: '#FEF3E2' }}
          >
            <span className="material-symbols-outlined text-lg" style={{ color: '#F59E0B' }}>schedule</span>
          </div>
          <div>
            <CardTitle className="text-base">トークン自動更新</CardTitle>
            <CardDescription>
              有効期限の指定日数前に自動でトークンを更新します（毎日 03:00 チェック）
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Label className="whitespace-nowrap">期限の</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={autoRefreshDays}
            onChange={(e) => setAutoRefreshDays(Number(e.target.value))}
          >
            {[3, 5, 7, 10, 14, 21, 30].map((d) => (
              <option key={d} value={d}>{d}日前</option>
            ))}
          </select>
          <Label className="whitespace-nowrap">に自動更新</Label>
        </div>

        {/* Store token status list */}
        {storeStatuses.length > 0 && (
          <div className="rounded-lg border border-border divide-y divide-border">
            {storeStatuses.map((s) => {
              const daysLeft = s.token_expires_at
                ? Math.ceil((new Date(s.token_expires_at).getTime() - Date.now()) / 86400000)
                : null
              return (
                <div key={s.store_id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="font-medium">{s.store_name}</span>
                  <span className={`text-xs ${
                    !s.has_token ? 'text-muted-foreground' :
                    daysLeft === null ? 'text-muted-foreground' :
                    daysLeft <= 0 ? 'text-red-600' :
                    daysLeft < 14 ? 'text-amber-600' :
                    'text-green-600'
                  }`}>
                    {!s.has_token ? 'トークン未設定' :
                     daysLeft === null ? '期限不明' :
                     daysLeft <= 0 ? '期限切れ' :
                     `残り ${daysLeft} 日`}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">info</span>
            スケジューラ: {enabled ? '稼働中' : '停止中'}
          </div>
          {nextCheck && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">schedule</span>
              次回チェック: {new Date(nextCheck).toLocaleString('ja-JP')}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
            <span className="material-symbols-outlined text-base">save</span>
            {saving ? '保存中...' : '設定を保存'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRunNow} disabled={runningNow}>
            {runningNow ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                実行中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">play_arrow</span>
                今すぐチェック実行
              </>
            )}
          </Button>
        </div>

        {statusMsg && (
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {statusMsg}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Helper: 最初のDB store IDを取得 ───

function useFirstStoreId() {
  const [storeId, setStoreId] = useState<number | null>(null)
  useEffect(() => {
    fetchStores().then((stores) => {
      if (stores.length > 0) setStoreId(stores[0].id)
    }).catch(() => {})
  }, [])
  return storeId
}

// ─── LINE Sub-tab ───

function LineSubTab() {
  const { settings, saveSettings, updateLine } = useApiSettings()
  const firstStoreId = useFirstStoreId()
  const [lineStatus, setLineStatus] = useState<ConnectionStatus>('untested')
  const [lineMsg, setLineMsg] = useState('')

  // CSV Import state
  const csvFileRef = useRef<HTMLInputElement>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [csvError, setCsvError] = useState('')

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastSending, setBroadcastSending] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<{ request_id?: string; error?: string } | null>(null)

  // Broadcast history state
  const [broadcastHistory, setBroadcastHistory] = useState<Array<{
    sent_at: string
    title: string
    delivery_count: number
    open_count: number
    click_count: number
  }>>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // Load DB credentials
  useEffect(() => {
    if (!firstStoreId) return
    fetchCredentialsSummary(firstStoreId).then((summary) => {
      if (!summary) return
      if (summary.line_channel_access_token_raw && !settings.line.channelAccessToken) {
        updateLine({ channelAccessToken: summary.line_channel_access_token_raw })
      }
    })
  }, [firstStoreId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTestLine = async () => {
    setLineStatus('testing')
    const result = await testLine(settings.line)
    setLineStatus(result.status)
    setLineMsg(result.message)
  }

  const handleSaveLineApi = async () => {
    if (!firstStoreId) return
    await saveCredentials(firstStoreId, {
      line_channel_access_token: settings.line.channelAccessToken,
    })
    saveSettings(settings)
  }

  const handleSaveLineOa = async () => {
    // OAスクレイパー廃止 — 未使用だが参照があるため空実装を残す
  }

  // CSV Import handler
  const handleCsvImport = async () => {
    if (!firstStoreId || !csvFile) return
    setCsvImporting(true)
    setCsvResult(null)
    setCsvError('')
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('store_id', String(firstStoreId))
      const res = await fetch('/api/line/import-csv', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      if (res.ok && !result.error) {
        setCsvResult({ imported: result.imported ?? 0, skipped: result.skipped ?? 0 })
        setCsvFile(null)
        if (csvFileRef.current) csvFileRef.current.value = ''
      } else {
        setCsvError(result.error || 'インポートに失敗しました')
      }
    } catch (e) {
      setCsvError(`エラー: ${e}`)
    } finally {
      setCsvImporting(false)
    }
  }

  // Broadcast handler
  const handleBroadcast = async () => {
    if (!firstStoreId || !broadcastText) return
    if (!window.confirm('全フォロワーに配信します。よろしいですか？')) return
    setBroadcastSending(true)
    setBroadcastResult(null)
    try {
      const result = await postJson<{ request_id?: string; error?: string }>('/api/line/broadcast', {
        store_id: firstStoreId,
        title: broadcastTitle,
        text: broadcastText,
      })
      if (result.error) {
        setBroadcastResult({ error: result.error })
      } else {
        setBroadcastResult({ request_id: result.request_id })
        setBroadcastTitle('')
        setBroadcastText('')
      }
    } catch (e) {
      setBroadcastResult({ error: `送信エラー: ${e}` })
    } finally {
      setBroadcastSending(false)
    }
  }

  // Load broadcast history
  useEffect(() => {
    if (!firstStoreId) return
    setHistoryLoading(true)
    const endDate = new Date().toISOString().slice(0, 10)
    const startDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    fetch(`/api/line/messages?store_id=${firstStoreId}&start_date=${startDate}&end_date=${endDate}`)
      .then((r) => r.json())
      .then((data: Array<{ sent_at: string; title: string; delivery_count: number; open_count: number; click_count: number }>) => {
        setBroadcastHistory(Array.isArray(data) ? data.slice(0, 10) : [])
        setHistoryLoaded(true)
      })
      .catch(() => {
        setBroadcastHistory([])
        setHistoryLoaded(true)
      })
      .finally(() => setHistoryLoading(false))
  }, [firstStoreId])

  return (
    <div className="space-y-6">
      {/* Messaging API card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ background: '#E6F9E6' }}
            >
              <LineIcon size={18} />
            </div>
            <CardTitle style={{ color: '#00B900' }}>Messaging API</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="line-token">Channel Access Token</Label>
            <Input
              id="line-token"
              type="password"
              placeholder="xxxxxxxxxxxxxxx"
              value={settings.line.channelAccessToken}
              onChange={(e) => updateLine({ channelAccessToken: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              LINE Messaging API のチャネルアクセストークン（友だち数・属性データ取得用）
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestLine}
              disabled={lineStatus === 'testing'}
            >
              <span className="material-symbols-outlined text-base">cable</span>
              接続テスト
            </Button>
            <SaveButton onClick={handleSaveLineApi} label="保存" />
          </div>
          <StatusIndicator status={lineStatus} message={lineMsg} />
        </CardContent>
      </Card>

      {/* CSV Import card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ background: '#E6F9E6' }}
            >
              <LineIcon size={18} />
            </div>
            <CardTitle className="text-base">過去データインポート（CSV）</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            LINE OA Managerから「分析→メッセージ配信」でダウンロードしたCSVファイルをインポートします
          </p>
          <div className="space-y-2">
            <input
              ref={csvFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                setCsvFile(e.target.files?.[0] ?? null)
                setCsvResult(null)
                setCsvError('')
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => csvFileRef.current?.click()}
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              ファイルを選択
            </Button>
            {csvFile && (
              <p className="text-sm text-foreground">{csvFile.name}</p>
            )}
          </div>
          <Button
            onClick={handleCsvImport}
            disabled={!csvFile || csvImporting || !firstStoreId}
            size="sm"
          >
            {csvImporting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                インポート中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">database</span>
                インポート
              </>
            )}
          </Button>
          {csvResult && (
            <div className="mt-2 flex items-center gap-2 text-sm text-success">
              <span className="material-symbols-outlined text-base">check_circle</span>
              {csvResult.imported}件インポート、{csvResult.skipped}件スキップ
            </div>
          )}
          {csvError && (
            <div className="mt-2 flex items-center gap-2 text-sm text-danger">
              <span className="material-symbols-outlined text-base">error</span>
              {csvError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Broadcast card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ background: '#E6F9E6' }}
            >
              <LineIcon size={18} />
            </div>
            <CardTitle className="text-base">メッセージ配信</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="broadcast-title">タイトル（管理用）</Label>
            <Input
              id="broadcast-title"
              placeholder="例: 3月キャンペーン告知"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              管理用のタイトルです。LINE側には表示されません。
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="broadcast-text">メッセージ本文</Label>
            <Textarea
              id="broadcast-text"
              rows={4}
              placeholder="配信するメッセージを入力..."
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
            />
          </div>
          <p className="text-xs text-danger">
            全フォロワーに一斉配信されます。送信後の取り消しはできません。
          </p>
          <Button
            onClick={handleBroadcast}
            disabled={!broadcastText || broadcastSending || !firstStoreId}
            size="sm"
          >
            {broadcastSending ? (
              <>
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                送信中...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">send</span>
                送信
              </>
            )}
          </Button>
          {broadcastResult && (
            broadcastResult.error ? (
              <div className="mt-2 flex items-center gap-2 text-sm text-danger">
                <span className="material-symbols-outlined text-base">error</span>
                {broadcastResult.error}
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 text-sm text-success">
                <span className="material-symbols-outlined text-base">check_circle</span>
                送信完了（request_id: {broadcastResult.request_id}）
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Broadcast History card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ background: '#E6F9E6' }}
            >
              <LineIcon size={18} />
            </div>
            <CardTitle className="text-base">配信履歴（直近10件）</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              読み込み中...
            </div>
          ) : historyLoaded && broadcastHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">配信履歴がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">日付</th>
                    <th className="pb-2 pr-4 font-medium">タイトル</th>
                    <th className="pb-2 pr-4 font-medium text-right">配信数</th>
                    <th className="pb-2 pr-4 font-medium text-right">開封数</th>
                    <th className="pb-2 font-medium text-right">クリック数</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcastHistory.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">{new Date(row.sent_at).toLocaleDateString('ja-JP')}</td>
                      <td className="py-2 pr-4">{row.title || '—'}</td>
                      <td className="py-2 pr-4 text-right">{row.delivery_count?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 pr-4 text-right">{row.open_count?.toLocaleString() ?? '—'}</td>
                      <td className="py-2 text-right">{row.click_count?.toLocaleString() ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── GA4 Sub-tab ───

function GA4SubTab() {
  const { settings, saveSettings, updateGA4 } = useApiSettings()
  const firstStoreId = useFirstStoreId()
  const ga4FileRef = useRef<HTMLInputElement>(null)
  const ga4ParsedRef = useRef<Record<string, unknown> | null>(null)
  const [ga4Status, setGa4Status] = useState<ConnectionStatus>('untested')
  const [ga4Msg, setGa4Msg] = useState('')

  const handleTestGA4 = async () => {
    setGa4Status('testing')
    const result = await testGA4(settings.ga4, ga4ParsedRef.current)
    setGa4Status(result.status)
    setGa4Msg(result.message)
  }

  const handleSaveGA4 = async () => {
    if (!firstStoreId) return
    const ga4Creds: Record<string, string> = {}
    if (settings.ga4.propertyId) ga4Creds.ga4_property_id = settings.ga4.propertyId
    if (settings.ga4.serviceAccountJson) ga4Creds.ga4_service_account_json = settings.ga4.serviceAccountJson
    if (Object.keys(ga4Creds).length > 0) {
      await saveCredentials(firstStoreId, ga4Creds)
    }
    saveSettings(settings)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ background: '#EBF2FF' }}
            >
              <GA4Icon size={18} />
            </div>
            <CardTitle style={{ color: '#4285F4' }}>Google Analytics 4</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ga4-property">Property ID</Label>
            <Input
              id="ga4-property"
              placeholder="123456789"
              value={settings.ga4.propertyId}
              onChange={(e) => updateGA4({ propertyId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
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
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  設定済み
                </span>
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
              onChange={(e) => updateGA4({ serviceAccountJson: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              JSONファイルをアップロードするか、内容を貼り付けてください。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestGA4}
              disabled={ga4Status === 'testing'}
            >
              <span className="material-symbols-outlined text-base">cable</span>
              接続テスト
            </Button>
            <SaveButton onClick={handleSaveGA4} label="保存" />
          </div>
          <StatusIndicator status={ga4Status} message={ga4Msg} />
        </CardContent>
      </Card>
    </div>
  )
}

// ─── GBP Sub-tab ───

function GBPSubTab() {
  const {
    settings,
    saveSettings,
    updateGBPStore,
    addGBPStore,
    removeGBPStore,
  } = useApiSettings()

  const [dbStoreIds, setDbStoreIds] = useState<number[]>([])
  const [gbpStatuses, setGbpStatuses] = useState<Record<number, ConnectionStatus>>({})
  const [gbpMessages, setGbpMessages] = useState<Record<number, string>>({})

  useEffect(() => {
    fetchStores().then((stores) => setDbStoreIds(stores.map((s) => s.id))).catch(() => {})
  }, [])

  const handleTestGbp = async (index: number) => {
    setGbpStatuses((p) => ({ ...p, [index]: 'testing' }))
    const result: ConnectionTestResult = await testGBP(settings.gbp[index])
    setGbpStatuses((p) => ({ ...p, [index]: result.status }))
    setGbpMessages((p) => ({ ...p, [index]: result.message }))
  }

  const handleSaveGbp = async (index: number) => {
    const store = settings.gbp[index]
    const storeId = dbStoreIds[index] || (index + 1)
    const gbpCreds: Record<string, string> = {}
    if (store.locationId) gbpCreds.gbp_location_id = store.locationId
    if (store.oauthClientId) gbpCreds.gbp_oauth_client_id = store.oauthClientId
    if (store.oauthClientSecret) gbpCreds.gbp_oauth_client_secret = store.oauthClientSecret
    if (store.refreshToken) gbpCreds.gbp_oauth_refresh_token = store.refreshToken
    if (Object.keys(gbpCreds).length > 0) {
      await saveCredentials(storeId, gbpCreds)
    }
    saveSettings(settings)
  }

  return (
    <div className="space-y-6">
      {settings.gbp.map((store, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className="flex size-9 items-center justify-center rounded-lg"
                style={{ background: '#FDECE9' }}
              >
                <GBPIcon size={18} />
              </div>
              <CardTitle className="text-base">店舗 {i + 1}: {store.storeName || '未設定'}</CardTitle>
            </div>
            <CardAction>
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
                <SaveButton onClick={() => handleSaveGbp(i)} label="保存" />
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
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>店舗名</Label>
                <Input
                  placeholder="渋谷店"
                  value={store.storeName}
                  onChange={(e) => updateGBPStore(i, { storeName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Location ID</Label>
                <Input
                  placeholder="12345678901234567"
                  value={store.locationId}
                  onChange={(e) => updateGBPStore(i, { locationId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>OAuth Client ID</Label>
                <Input
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={store.oauthClientId}
                  onChange={(e) => updateGBPStore(i, { oauthClientId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>OAuth Client Secret</Label>
                <Input
                  type="password"
                  placeholder="GOCSPX-xxxxx"
                  value={store.oauthClientSecret}
                  onChange={(e) => updateGBPStore(i, { oauthClientSecret: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>リフレッシュトークン</Label>
              <Input
                type="password"
                placeholder="1//xxxxx"
                value={store.refreshToken}
                onChange={(e) => updateGBPStore(i, { refreshToken: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Google Cloud Console でOAuth 2.0クライアントを作成し、リフレッシュトークンを取得してください。
              </p>
            </div>
            <StatusIndicator
              status={gbpStatuses[i] || 'untested'}
              message={gbpMessages[i] || ''}
            />
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" size="sm" onClick={addGBPStore}>
        <span className="material-symbols-outlined text-base">add</span>
        店舗を追加
      </Button>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tab 3: アカウント管理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AccountsTab({
  token,
  currentUser,
}: {
  token: string | null
  currentUser: { id: number; role: string } | null
}) {
  const [users, setUsers] = useState<AccountUser[]>([])
  const [stores, setStores] = useState<AccountStore[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AccountUser | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [formUsername, setFormUsername] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formRole, setFormRole] = useState('staff')
  const [formStoreId, setFormStoreId] = useState<string>('')

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', { headers })
      if (res.ok) setUsers(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores', { headers })
      if (res.ok) setStores(await res.json())
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchUsers()
    fetchStores()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setFormUsername('')
    setFormPassword('')
    setFormDisplayName('')
    setFormRole('staff')
    setFormStoreId('')
    setEditingUser(null)
    setShowForm(false)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const openEdit = (u: AccountUser) => {
    setEditingUser(u)
    setFormUsername(u.username)
    setFormPassword('')
    setFormDisplayName(u.display_name)
    setFormRole(u.role)
    setFormStoreId(u.store_id?.toString() ?? '')
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (editingUser) {
      const body: Record<string, unknown> = {}
      if (formUsername !== editingUser.username) body.username = formUsername
      if (formPassword) body.password = formPassword
      if (formDisplayName !== editingUser.display_name) body.display_name = formDisplayName
      if (formRole !== editingUser.role) body.role = formRole
      const storeId = formStoreId ? parseInt(formStoreId) : null
      if (storeId !== editingUser.store_id) body.store_id = storeId

      if (Object.keys(body).length === 0) {
        setError('変更がありません')
        return
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || '更新に失敗しました')
        return
      }
      setSuccess('ユーザーを更新しました')
    } else {
      const body = {
        username: formUsername,
        password: formPassword,
        display_name: formDisplayName,
        role: formRole,
        store_id: formStoreId ? parseInt(formStoreId) : null,
      }
      const res = await fetch('/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || '作成に失敗しました')
        return
      }
      setSuccess('ユーザーを作成しました')
    }

    resetForm()
    fetchUsers()
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('このユーザーを無効化しますか？')) return
    setSuccess('')
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE', headers })
    if (!res.ok) {
      const data = await res.json()
      setError(data.detail || '削除に失敗しました')
      return
    }
    setSuccess('ユーザーを無効化しました')
    fetchUsers()
  }

  const canEditUser = (u: AccountUser) => {
    if (currentUser?.role === 'pr' && u.role === 'hq') return false
    return true
  }

  const availableRoles = currentUser?.role === 'pr'
    ? ROLE_OPTIONS.filter((r) => r.value !== 'hq')
    : ROLE_OPTIONS

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-rounded animate-spin text-2xl text-muted-foreground">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <span className="material-symbols-outlined text-xl text-primary">group</span>
          </div>
          <h2 className="text-lg font-bold">ユーザー一覧</h2>
        </div>
        <Button onClick={openCreate} size="sm">
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          新規追加
        </Button>
      </div>

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          {success}
        </div>
      )}

      {/* User Form (create/edit) */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingUser ? 'ユーザー編集' : '新規ユーザー作成'}
            </CardTitle>
            <CardDescription>
              {editingUser ? `${editingUser.display_name} の情報を編集` : 'ダッシュボードにアクセスできるユーザーを追加'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-display">表示名 <span className="text-red-500">*</span></Label>
                <Input
                  id="f-display"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="田中太郎"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-username">ユーザー名 <span className="text-red-500">*</span></Label>
                <Input
                  id="f-username"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="tanaka"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-password">
                  パスワード {!editingUser && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id="f-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? '変更する場合のみ入力' : 'パスワードを入力'}
                  required={!editingUser}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="f-role">ロール <span className="text-red-500">*</span></Label>
                <select
                  id="f-role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="h-10 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {availableRoles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {formRole === 'staff' && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="f-store">所属店舗 <span className="text-red-500">*</span></Label>
                  <select
                    id="f-store"
                    value={formStoreId}
                    onChange={(e) => setFormStoreId(e.target.value)}
                    className="h-10 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    required
                  >
                    <option value="">店舗を選択</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {error && (
                <p className="text-sm text-destructive sm:col-span-2">{error}</p>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={resetForm}>キャンセル</Button>
                <Button type="submit">
                  {editingUser ? '更新' : '作成'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* User List */}
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 font-medium">表示名</th>
                  <th className="pb-3 font-medium">ユーザー名</th>
                  <th className="pb-3 font-medium">ロール</th>
                  <th className="pb-3 font-medium">所属店舗</th>
                  <th className="pb-3 font-medium">状態</th>
                  <th className="pb-3 font-medium w-24"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const storeName = u.store_id
                    ? stores.find((s) => s.id === u.store_id)?.name ?? `ID:${u.store_id}`
                    : '—'
                  return (
                    <tr key={u.id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 font-medium">{u.display_name || '—'}</td>
                      <td className="py-3 text-muted-foreground">{u.username}</td>
                      <td className="py-3">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] ?? ''}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{storeName}</td>
                      <td className="py-3">
                        {u.is_active ? (
                          <span className="text-xs text-green-600 dark:text-green-400">有効</span>
                        ) : (
                          <span className="text-xs text-red-500">無効</span>
                        )}
                      </td>
                      <td className="py-3">
                        {canEditUser(u) && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => openEdit(u)}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 @media(hover:hover){&:hover{bg-muted text-foreground}}"
                              style={{}}
                              title="編集"
                              onMouseEnter={(e) => {
                                const el = e.currentTarget
                                if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                                  el.style.backgroundColor = 'var(--muted)'
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = ''
                              }}
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            {u.id !== currentUser?.id && u.is_active === 1 && (
                              <button
                                onClick={() => handleDelete(u.id)}
                                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150"
                                title="無効化"
                                onMouseEnter={(e) => {
                                  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
                                    e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = ''
                                }}
                              >
                                <span className="material-symbols-outlined text-[18px]">person_off</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      ユーザーが登録されていません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
