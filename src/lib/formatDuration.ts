/**
 * Convert milliseconds to a human-readable duration string.
 *
 * @param ms Duration in milliseconds
 * @returns Formatted string like "8m 32s", "1m 5s", "45s", or "0s"
 */
/**
 * Convert seconds to a clock-style duration string (H:MM:SS or M:SS).
 *
 * @param seconds Duration in seconds
 * @returns Formatted string like "1:02:30" or "5:09"
 */
export function formatClockDuration(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}
