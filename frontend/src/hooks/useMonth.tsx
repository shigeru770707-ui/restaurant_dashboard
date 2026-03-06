// Backward-compatible re-export — all pages can keep using useMonth()
export { PeriodProvider as MonthProvider } from './usePeriod'

import { usePeriod } from './usePeriod'

export function useMonth() {
  const { selectedMonth, setSelectedMonth } = usePeriod()
  return { selectedMonth, setSelectedMonth }
}
