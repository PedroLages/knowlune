import {
  Trophy,
  Flame,
  Clock,
  Sparkles,
  GraduationCap,
  Download,
  BookOpen,
  Brain,
} from 'lucide-react'
import type { NotificationType } from '@/data/types'

// --- Shared icon mapping for notification types ---

export const notificationIcons: Record<NotificationType, typeof Trophy> = {
  'course-complete': GraduationCap,
  'streak-milestone': Flame,
  'import-finished': Download,
  'achievement-unlocked': Trophy,
  'review-due': Clock,
  'srs-due': BookOpen,
  'knowledge-decay': Brain,
}

export const notificationIconColors: Record<NotificationType, string> = {
  'course-complete': 'text-brand',
  'streak-milestone': 'text-destructive',
  'import-finished': 'text-success',
  'achievement-unlocked': 'text-warning',
  'review-due': 'text-muted-foreground',
  'srs-due': 'text-brand',
  'knowledge-decay': 'text-warning',
}

// Fallback icons for unknown types
export const DEFAULT_ICON = Sparkles
export const DEFAULT_ICON_COLOR = 'text-muted-foreground'

// --- Relative time helper ---

export function relativeTime(dateIso: string): string {
  const date = new Date(dateIso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHr = Math.floor(diffMs / 3_600_000)
  const diffDay = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  return date.toLocaleDateString()
}
