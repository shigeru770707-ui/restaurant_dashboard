import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'

export type PeriodType = 'month' | 'dateRange'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function getMonthStart(month: string): string {
  return `${month}-01`
}

function getMonthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return `${month}-${String(lastDay).padStart(2, '0')}`
}

interface PeriodContextType {
  periodType: PeriodType
  setPeriodType: (type: PeriodType) => void
  selectedMonth: string
  setSelectedMonth: (month: string) => void
  startDate: string
  setStartDate: (date: string) => void
  endDate: string
  setEndDate: (date: string) => void
  /** Always returns the effective start date (YYYY-MM-DD) regardless of mode */
  effectiveStart: string
  /** Always returns the effective end date (YYYY-MM-DD) regardless of mode */
  effectiveEnd: string
}

const PeriodContext = createContext<PeriodContextType | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const currentMonth = getCurrentMonth()
  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [startDate, setStartDate] = useState(getMonthStart(currentMonth))
  const [endDate, setEndDate] = useState(getToday())

  const effectiveStart = periodType === 'month' ? getMonthStart(selectedMonth) : startDate
  const effectiveEnd = periodType === 'month' ? getMonthEnd(selectedMonth) : endDate

  const value = useMemo(
    () => ({
      periodType,
      setPeriodType,
      selectedMonth,
      setSelectedMonth,
      startDate,
      setStartDate,
      endDate,
      setEndDate,
      effectiveStart,
      effectiveEnd,
    }),
    [periodType, selectedMonth, startDate, endDate, effectiveStart, effectiveEnd],
  )

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used within PeriodProvider')
  return ctx
}
