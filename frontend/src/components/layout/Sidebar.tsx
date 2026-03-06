import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { InstagramIcon, LineIcon, GA4Icon, GBPIcon } from '@/components/common/BrandIcons'

interface NavItem {
  path: string
  label: string
  mobileLabel?: string
  icon?: string
  brandIcon?: (size: number) => ReactNode
  color: string
  lightBg: string
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'サマリー', icon: 'chart_data', color: '#6366F1', lightBg: '#EEF2FF' },
  { path: '/instagram', label: 'Instagram', mobileLabel: 'Insta', brandIcon: (s) => <InstagramIcon size={s} />, color: '#E1306C', lightBg: '#FCE7EF' },
  { path: '/line', label: 'LINE', brandIcon: (s) => <LineIcon size={s} />, color: '#00B900', lightBg: '#E6F9E6' },
  { path: '/ga4', label: 'GA4', brandIcon: (s) => <GA4Icon size={s} />, color: '#4285F4', lightBg: '#EBF2FF' },
  { path: '/gbp', label: 'GBP', brandIcon: (s) => <GBPIcon size={s} />, color: '#EA4335', lightBg: '#FDECE9' },
  { path: '/settings', label: '設定', icon: 'settings', color: '#6B7280', lightBg: '#F3F4F6' },
]

const DESKTOP_NAV_ITEMS: NavItem[] = [
  { path: '/', label: '全体サマリー', icon: 'chart_data', color: '#6366F1', lightBg: '#EEF2FF' },
  { path: '/instagram', label: 'Instagram', brandIcon: (s) => <InstagramIcon size={s} />, color: '#E1306C', lightBg: '#FCE7EF' },
  { path: '/line', label: 'LINE', brandIcon: (s) => <LineIcon size={s} />, color: '#00B900', lightBg: '#E6F9E6' },
  { path: '/ga4', label: 'Google Analytics 4', brandIcon: (s) => <GA4Icon size={s} />, color: '#4285F4', lightBg: '#EBF2FF' },
  { path: '/gbp', label: 'Google ビジネス', brandIcon: (s) => <GBPIcon size={s} />, color: '#EA4335', lightBg: '#FDECE9' },
]

const THEME_OPTIONS = [
  { value: 'light' as const, icon: 'light_mode', label: 'ライト' },
  { value: 'dark' as const, icon: 'dark_mode', label: 'ダーク' },
  { value: 'system' as const, icon: 'computer', label: '自動' },
]

export default function Sidebar() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed top-0 left-0 z-50 hidden h-screen w-[260px] flex-col border-r border-border bg-card overflow-y-auto md:flex">
        {/* Brand Area */}
        <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <span className="material-symbols-outlined text-xl text-primary">analytics</span>
          </div>
          <div>
            <h1 className="text-[15px] font-bold tracking-wide text-foreground leading-tight">
              SNS Analytics
            </h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Dashboard</p>
          </div>
        </div>

        <div className="mx-4 border-b border-border" />

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            メディア分析
          </p>
          {DESKTOP_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { background: item.lightBg, color: item.color }
                  : undefined
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-[3px] rounded-r-full"
                      style={{ background: item.color }}
                    />
                  )}
                  {item.brandIcon ? (
                    <span className="flex-shrink-0">{item.brandIcon(20)}</span>
                  ) : (
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={isActive ? { color: item.color } : undefined}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Theme Switcher */}
        <div className="mx-4 border-t border-border" />
        <div className="px-4 py-3">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            テーマ
          </p>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                  theme === opt.value
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="mx-4 border-t border-border" />
        <div className="px-3 py-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-muted text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span>API設定</span>
          </NavLink>
        </div>

        {/* Copyright */}
        <div className="mt-auto border-t border-border px-4 py-3">
          <p className="text-[10px] text-center text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors duration-300 select-none">
            &copy; 2026 GNS inc.
          </p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm md:hidden">
        <div className="pb-[env(safe-area-inset-bottom)]">
          <div className="flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[52px] py-1.5 transition-colors duration-150 ${
                  isActive
                    ? 'font-semibold'
                    : 'text-muted-foreground/60'
                }`
              }
              style={({ isActive }) =>
                isActive ? { color: item.color } : undefined
              }
            >
              {({ isActive }) => (
                <>
                  {item.brandIcon ? (
                    <span className="flex-shrink-0">{item.brandIcon(isActive ? 22 : 20)}</span>
                  ) : (
                    <span
                      className={`material-symbols-outlined ${isActive ? 'text-[22px]' : 'text-[20px]'}`}
                      style={isActive ? { color: item.color } : undefined}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span
                    className={`leading-none tracking-tight ${
                      isActive
                        ? 'text-[10px] font-semibold'
                        : 'text-[9px] font-medium text-muted-foreground/50'
                    }`}
                    style={isActive ? { color: item.color } : undefined}
                  >
                    {item.mobileLabel || item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
          </div>
          <p className="text-[8px] text-center text-muted-foreground/30 pb-0.5 select-none">
            &copy; 2026 GNS inc.
          </p>
        </div>
      </nav>
    </>
  )
}
