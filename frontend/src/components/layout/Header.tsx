import type { ReactNode } from 'react'
import PeriodPicker from '@/components/common/PeriodPicker'
import ExportDropdown, { type ReportType } from '@/components/common/ExportDropdown'
import { useTheme } from '@/hooks/useTheme'

interface HeaderProps {
  title: string
  icon?: string
  brandIcon?: ReactNode
  color?: string
  lightBg?: string
  reportType?: ReportType
  storeIndex?: number
}

const THEME_CYCLE = [
  { value: 'light', icon: 'light_mode', next: 'dark' },
  { value: 'dark', icon: 'dark_mode', next: 'system' },
  { value: 'system', icon: 'computer', next: 'light' },
] as const

export default function Header({ title, icon, brandIcon, color, lightBg, reportType, storeIndex }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const currentTheme = THEME_CYCLE.find((t) => t.value === theme) ?? THEME_CYCLE[0]

  return (
    <header className="mb-8 flex items-center justify-between border-b border-border pb-5">
      <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 mr-3">
        {(icon || brandIcon) && color && (
          <div
            className="flex size-8 md:size-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: lightBg || `${color}15` }}
          >
            {brandIcon || (
              <span
                className="material-symbols-outlined text-lg md:text-xl"
                style={{ color }}
              >
                {icon}
              </span>
            )}
          </div>
        )}
        <h2
          className="text-base font-bold tracking-tight md:text-2xl truncate"
          style={color ? { color } : undefined}
        >
          {title}
        </h2>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <PeriodPicker />
        {reportType && (
          <ExportDropdown currentType={reportType} storeIndex={storeIndex} />
        )}
        <button
          onClick={() => setTheme(currentTheme.next)}
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          aria-label="テーマ切り替え"
        >
          <span className="material-symbols-outlined text-[20px]">{currentTheme.icon}</span>
        </button>
      </div>
    </header>
  )
}
