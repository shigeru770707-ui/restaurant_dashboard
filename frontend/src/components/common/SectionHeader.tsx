interface SectionHeaderProps {
  title: string
  icon?: string
  color?: string
  withDivider?: boolean
  children?: React.ReactNode
}

export default function SectionHeader({
  title,
  icon,
  color,
  withDivider = false,
  children,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        {icon && (
          <span
            className="material-symbols-outlined text-sm"
            style={color ? { color } : undefined}
          >
            {icon}
          </span>
        )}
        {title}
        {withDivider && <span className="flex-1 h-px bg-border ml-2" />}
      </h3>
      {children}
    </div>
  )
}
