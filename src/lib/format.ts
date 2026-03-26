/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format total seconds to a human-readable course duration (e.g., "8h 24m", "45m").
 * Used on course cards to show aggregate video duration (E1B-S02).
 */
export function formatCourseDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return '< 1m'
}

/**
 * Format bytes to a human-readable file size (e.g., "2.4 GB", "350 MB").
 * Used in course card tooltips (E1B-S02).
 */
export function formatFileSize(bytes: number): string {
  const safe = Math.max(0, bytes)
  if (safe === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(safe) / Math.log(1024)), units.length - 1)
  const value = safe / Math.pow(1024, i)

  // Show 1 decimal for values < 10, none for >= 10
  const formatted = value < 10 && i > 0 ? value.toFixed(1) : Math.round(value).toString()
  return `${formatted} ${units[i]}`
}

/**
 * Convert a video height in pixels to a human-readable resolution label.
 * Returns the standard marketing name (e.g., "4K", "1080p") (E1B-S02 AC5).
 */
export function getResolutionLabel(height: number): string {
  if (height >= 2160) return '4K'
  if (height >= 1440) return '1440p'
  if (height >= 1080) return '1080p'
  if (height >= 720) return '720p'
  if (height >= 480) return '480p'
  if (height >= 360) return '360p'
  return `${height}p`
}
