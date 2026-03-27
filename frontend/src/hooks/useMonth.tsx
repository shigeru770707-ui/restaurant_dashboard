// Backward-compatible re-export — all pages can keep using useMonth()


import { usePeriod } from './usePeriod'

export function useMonth() {
  const { selectedMonth, setSelectedMonth } = usePeriod()
  return { selectedMonth, setSelectedMonth }
}
