interface StoreSelectorProps {
  stores: { storeName: string }[]
  selectedIndex: number
  onSelect: (index: number) => void
  color: string
}

export default function StoreSelector({
  stores,
  selectedIndex,
  onSelect,
  color,
}: StoreSelectorProps) {
  // Don't render if only one store (or none configured)
  if (stores.length <= 1) return null

  return (
    <div className="flex items-center gap-2">
      <span
        className="material-symbols-outlined text-[18px]"
        style={{ color }}
      >
        store
      </span>
      <select
        value={selectedIndex}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs md:text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 min-h-[36px] md:min-h-0"
      >
        {stores.map((store, i) => (
          <option key={i} value={i}>
            {store.storeName || `店舗 ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  )
}
