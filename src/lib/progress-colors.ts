export function getProgressColor(percentage: number): string {
  if (percentage >= 80) return 'var(--success)'
  if (percentage >= 40) return 'var(--warning)'
  return 'var(--destructive)'
}

export function getProgressTextClass(percentage: number): string {
  if (percentage >= 80) return 'text-success'
  if (percentage >= 40) return 'text-warning'
  return 'text-destructive'
}
