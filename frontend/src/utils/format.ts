export function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP')
}

export function formatPercent(value: number, decimals = 1): string {
  const fixed = value.toFixed(decimals)
  // 46.0% → 46%、3.5% → 3.5%
  const clean = fixed.replace(/\.0+$/, '')
  return `${clean}%`
}

function formatCompact(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}万`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toLocaleString('ja-JP')
}
