export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getPreviousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getPreviousYearMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return `${year - 1}-${String(m).padStart(2, '0')}`
}

export function getMonthRange(month: string): { startDate: string; endDate: string } {
  const [year, m] = month.split('-').map(Number)
  const start = new Date(year, m - 1, 1)
  const end = new Date(year, m, 0)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return `${year}年${m}月`
}

export function getLast6Months(currentMonth: string): string[] {
  const months: string[] = []
  let month = currentMonth
  for (let i = 0; i < 6; i++) {
    months.unshift(month)
    month = getPreviousMonth(month)
  }
  return months
}
