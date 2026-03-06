interface PageSizeSelectorProps {
  total: number
  pageSize: number
  onChangePageSize: (size: number) => void
  options?: number[]
}

export default function PageSizeSelector({
  total,
  pageSize,
  onChangePageSize,
  options = [5, 10, 20],
}: PageSizeSelectorProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{total} 件</span>
      <span className="text-border">|</span>
      <label className="flex items-center gap-1">
        <span className="hidden sm:inline">表示</span>
        <select
          value={pageSize >= total ? -1 : pageSize}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChangePageSize(v === -1 ? total : v)
          }}
          className="rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground outline-none focus:border-primary min-h-[28px]"
        >
          {options.map((n) => (
            <option key={n} value={n}>
              {n}件
            </option>
          ))}
          <option value={-1}>全件</option>
        </select>
      </label>
    </div>
  )
}
