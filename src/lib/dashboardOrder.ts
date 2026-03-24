/**
 * Dashboard section ordering system.
 *
 * Tracks user interactions with dashboard sections (views, time spent)
 * and computes an optimal display order based on usage patterns.
 * Supports manual pinning, drag-and-drop reordering, and reset to default.
 *
 * All data persisted to localStorage under 'dashboard-section-order'
 * and 'dashboard-section-stats'.
 */

const ORDER_KEY = 'dashboard-section-order'
const STATS_KEY = 'dashboard-section-stats'

/** Identifiers for each reorderable dashboard section */
export type DashboardSectionId =
  | 'recommended-next'
  | 'metrics-strip'
  | 'quiz-performance'
  | 'engagement-zone'
  | 'study-history'
  | 'study-schedule'
  | 'skill-proficiency'
  | 'insight-action'
  | 'course-gallery'

/** Human-readable labels for dashboard sections */
export const SECTION_LABELS: Record<DashboardSectionId, string> = {
  'recommended-next': 'Recommended Next',
  'metrics-strip': 'Metrics & Achievements',
  'quiz-performance': 'Quiz Performance',
  'engagement-zone': 'Study Streak & Goals',
  'study-history': 'Study History',
  'study-schedule': 'Suggested Study Time',
  'skill-proficiency': 'Skill Proficiency',
  'insight-action': 'Progress & Quick Actions',
  'course-gallery': 'Your Library',
}

/** Default section order (initial experience for new users) */
export const DEFAULT_ORDER: DashboardSectionId[] = [
  'recommended-next',
  'metrics-strip',
  'quiz-performance',
  'engagement-zone',
  'study-history',
  'study-schedule',
  'skill-proficiency',
  'insight-action',
  'course-gallery',
]

/** Interaction statistics for a single section */
export interface SectionStats {
  /** Total number of times section entered the viewport */
  views: number
  /** Cumulative time (ms) the section was visible */
  timeSpentMs: number
  /** ISO timestamp of last view */
  lastAccessedAt: string
}

/** Persisted ordering configuration */
export interface DashboardOrderConfig {
  /** Ordered list of section IDs */
  order: DashboardSectionId[]
  /** Sections manually pinned to the top */
  pinnedSections: DashboardSectionId[]
  /** Whether user has manually reordered (disables auto-reorder) */
  isManuallyOrdered: boolean
}

/** Get saved section statistics */
export function getSectionStats(): Record<DashboardSectionId, SectionStats> {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // silent-catch-ok: localStorage fallback to defaults
    // Corrupted data - return defaults
  }
  return createDefaultStats()
}

function createDefaultStats(): Record<DashboardSectionId, SectionStats> {
  const stats = {} as Record<DashboardSectionId, SectionStats>
  for (const id of DEFAULT_ORDER) {
    stats[id] = { views: 0, timeSpentMs: 0, lastAccessedAt: '' }
  }
  return stats
}

/** Save section statistics */
export function saveSectionStats(stats: Record<DashboardSectionId, SectionStats>): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats))
  } catch {
    // silent-catch-ok: localStorage quota exceeded, stats non-critical
    // Storage quota exceeded - silently fail
  }
}

/** Record a view for a section */
export function recordSectionView(sectionId: DashboardSectionId): void {
  const stats = getSectionStats()
  if (!stats[sectionId]) {
    stats[sectionId] = { views: 0, timeSpentMs: 0, lastAccessedAt: '' }
  }
  stats[sectionId].views += 1
  stats[sectionId].lastAccessedAt = new Date().toISOString()
  saveSectionStats(stats)
}

/** Record time spent viewing a section */
export function recordSectionTime(sectionId: DashboardSectionId, durationMs: number): void {
  const stats = getSectionStats()
  if (!stats[sectionId]) {
    stats[sectionId] = { views: 0, timeSpentMs: 0, lastAccessedAt: '' }
  }
  stats[sectionId].timeSpentMs += durationMs
  saveSectionStats(stats)
}

/** Get saved order configuration */
export function getOrderConfig(): DashboardOrderConfig {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (raw) {
      const config = JSON.parse(raw) as DashboardOrderConfig
      // Ensure all sections are present (handles new sections added over time)
      const missing = DEFAULT_ORDER.filter(id => !config.order.includes(id))
      if (missing.length > 0) {
        config.order = [...config.order, ...missing]
      }
      // Remove sections that no longer exist
      config.order = config.order.filter(id => DEFAULT_ORDER.includes(id))
      config.pinnedSections = config.pinnedSections.filter(id => DEFAULT_ORDER.includes(id))
      return config
    }
  } catch {
    // silent-catch-ok: localStorage fallback to defaults
    // Corrupted data - return defaults
  }
  return {
    order: [...DEFAULT_ORDER],
    pinnedSections: [],
    isManuallyOrdered: false,
  }
}

/** Save order configuration */
export function saveOrderConfig(config: DashboardOrderConfig): void {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(config))
  } catch {
    // silent-catch-ok: localStorage quota exceeded, order non-critical
    // Storage quota exceeded - silently fail
  }
}

/**
 * Compute relevance score for a section.
 * Weighs recency (40%), view count (30%), and time spent (30%).
 */
export function computeRelevanceScore(stats: SectionStats): number {
  const now = Date.now()
  const lastAccessed = stats.lastAccessedAt ? new Date(stats.lastAccessedAt).getTime() : 0
  const hoursSinceAccess = lastAccessed > 0 ? (now - lastAccessed) / (1000 * 60 * 60) : 999

  // Recency: exponential decay (half-life = 24 hours)
  const recencyScore = Math.exp(-hoursSinceAccess / 24)

  // View count: logarithmic scaling (diminishing returns)
  const viewScore = Math.log2(stats.views + 1) / 10

  // Time spent: logarithmic scaling (minutes)
  const timeMinutes = stats.timeSpentMs / 60000
  const timeScore = Math.log2(timeMinutes + 1) / 10

  return recencyScore * 0.4 + viewScore * 0.3 + timeScore * 0.3
}

/**
 * Compute the auto-ordered section list based on usage stats.
 * Pinned sections always come first (in pin order), then
 * remaining sections sorted by relevance score descending.
 */
export function computeAutoOrder(
  stats: Record<DashboardSectionId, SectionStats>,
  pinnedSections: DashboardSectionId[]
): DashboardSectionId[] {
  const pinned = pinnedSections.filter(id => DEFAULT_ORDER.includes(id))
  const unpinned = DEFAULT_ORDER.filter(id => !pinned.includes(id))

  // Sort unpinned by relevance score
  const scored = unpinned.map(id => ({
    id,
    score: stats[id] ? computeRelevanceScore(stats[id]) : 0,
  }))
  scored.sort((a, b) => b.score - a.score)

  // If all scores are 0 (no interactions yet), keep default order
  const hasInteractions = scored.some(s => s.score > 0)
  if (!hasInteractions) {
    return [...pinned, ...unpinned]
  }

  return [...pinned, ...scored.map(s => s.id)]
}

/** Pin a section to the top */
export function pinSection(sectionId: DashboardSectionId): DashboardOrderConfig {
  const config = getOrderConfig()
  if (!config.pinnedSections.includes(sectionId)) {
    config.pinnedSections.push(sectionId)
  }
  // Recompute order: pinned first, then rest
  const stats = getSectionStats()
  config.order = computeAutoOrder(stats, config.pinnedSections)
  saveOrderConfig(config)
  return config
}

/** Unpin a section */
export function unpinSection(sectionId: DashboardSectionId): DashboardOrderConfig {
  const config = getOrderConfig()
  config.pinnedSections = config.pinnedSections.filter(id => id !== sectionId)
  // Recompute order
  const stats = getSectionStats()
  config.order = computeAutoOrder(stats, config.pinnedSections)
  saveOrderConfig(config)
  return config
}

/** Set manual order (from drag-and-drop) */
export function setManualOrder(newOrder: DashboardSectionId[]): DashboardOrderConfig {
  const config = getOrderConfig()
  config.order = newOrder
  config.isManuallyOrdered = true
  saveOrderConfig(config)
  return config
}

/** Reset to default order, clear pins and manual flag */
export function resetToDefaultOrder(): DashboardOrderConfig {
  const config: DashboardOrderConfig = {
    order: [...DEFAULT_ORDER],
    pinnedSections: [],
    isManuallyOrdered: false,
  }
  saveOrderConfig(config)
  return config
}

/** Clear all stats and order data */
export function clearDashboardData(): void {
  localStorage.removeItem(ORDER_KEY)
  localStorage.removeItem(STATS_KEY)
}
