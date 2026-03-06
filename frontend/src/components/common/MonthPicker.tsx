import { useMonth } from '@/hooks/useMonth'

export default function MonthPicker() {
  const { selectedMonth, setSelectedMonth } = useMonth()

  return (
    <input
      type="month"
      value={selectedMonth}
      onChange={(e) => setSelectedMonth(e.target.value)}
      className="rounded-lg border border-border bg-card px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm min-h-[44px] md:min-h-0 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
    />
  )
}
