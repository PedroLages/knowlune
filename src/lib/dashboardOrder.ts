/** Stable, user-controlled Overview dashboard preferences. */

const PREFERENCES_KEY = 'knowlune-dashboard-preferences-v2'
const LEGACY_ORDER_KEY = 'dashboard-section-order'
const LEGACY_STATS_KEY = 'dashboard-section-stats'

export type DashboardSectionId =
  | 'focus'
  | 'pulse'
  | 'progress'
  | 'consistency'
  | 'insights'
  | 'library'

export type DashboardPreset = 'focus' | 'balanced' | 'analytics' | 'custom'

export interface DashboardPreferencesV2 {
  version: 2
  preset: DashboardPreset
  order: DashboardSectionId[]
  hidden: DashboardSectionId[]
}

export const SECTION_LABELS: Record<DashboardSectionId, string> = {
  focus: 'Learning Focus',
  pulse: 'Learning Pulse',
  progress: 'Progress',
  consistency: 'Consistency',
  insights: 'Learning Insights',
  library: 'Library',
}

export const DEFAULT_ORDER: DashboardSectionId[] = [
  'focus',
  'pulse',
  'progress',
  'consistency',
  'insights',
  'library',
]

export const PRESET_LABELS: Record<Exclude<DashboardPreset, 'custom'>, string> = {
  focus: 'Focus',
  balanced: 'Balanced',
  analytics: 'Analytics',
}

export const PRESET_DESCRIPTIONS: Record<Exclude<DashboardPreset, 'custom'>, string> = {
  focus: 'Keep next actions and progress prominent.',
  balanced: 'Show every section in the product order.',
  analytics: 'Lead with trends, consistency, and insights.',
}

const PRESETS: Record<Exclude<DashboardPreset, 'custom'>, DashboardPreferencesV2> = {
  balanced: {
    version: 2,
    preset: 'balanced',
    order: [...DEFAULT_ORDER],
    hidden: [],
  },
  focus: {
    version: 2,
    preset: 'focus',
    order: ['focus', 'pulse', 'progress', 'library', 'consistency', 'insights'],
    hidden: ['consistency', 'insights'],
  },
  analytics: {
    version: 2,
    preset: 'analytics',
    order: ['pulse', 'progress', 'consistency', 'insights', 'focus', 'library'],
    hidden: [],
  },
}

const LEGACY_SECTION_GROUPS: Record<string, DashboardSectionId> = {
  'recommended-next': 'focus',
  'continue-learning-path': 'focus',
  'study-schedule': 'focus',
  'todays-study-plan': 'focus',
  'metrics-strip': 'pulse',
  'insight-action': 'progress',
  'engagement-zone': 'consistency',
  'study-history': 'consistency',
  'quiz-performance': 'insights',
  'skill-proficiency': 'insights',
  'knowledge-map': 'insights',
  'reading-overview': 'insights',
  'course-gallery': 'library',
}

function clonePreferences(preferences: DashboardPreferencesV2): DashboardPreferencesV2 {
  return {
    version: 2,
    preset: preferences.preset,
    order: [...preferences.order],
    hidden: [...preferences.hidden],
  }
}

function isSectionId(value: unknown): value is DashboardSectionId {
  return typeof value === 'string' && DEFAULT_ORDER.includes(value as DashboardSectionId)
}

function isPreset(value: unknown): value is DashboardPreset {
  return value === 'focus' || value === 'balanced' || value === 'analytics' || value === 'custom'
}

function normalizeOrder(value: unknown): DashboardSectionId[] {
  const saved = Array.isArray(value) ? value.filter(isSectionId) : []
  const unique = saved.filter((sectionId, index) => saved.indexOf(sectionId) === index)
  return [...unique, ...DEFAULT_ORDER.filter(sectionId => !unique.includes(sectionId))]
}

function normalizePreferences(value: unknown): DashboardPreferencesV2 | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<DashboardPreferencesV2>
  if (candidate.version !== 2 || !isPreset(candidate.preset)) return null
  return {
    version: 2,
    preset: candidate.preset,
    order: normalizeOrder(candidate.order),
    hidden: Array.isArray(candidate.hidden)
      ? candidate.hidden
          .filter(isSectionId)
          .filter((id, index, items) => items.indexOf(id) === index)
      : [],
  }
}

function migrateLegacyPreferences(raw: string): DashboardPreferencesV2 {
  try {
    const legacy = JSON.parse(raw) as { order?: unknown; pinnedSections?: unknown }
    const legacyOrder = [
      ...(Array.isArray(legacy.pinnedSections) ? legacy.pinnedSections : []),
      ...(Array.isArray(legacy.order) ? legacy.order : []),
    ]
    const mapped = legacyOrder
      .map(sectionId =>
        typeof sectionId === 'string' ? LEGACY_SECTION_GROUPS[sectionId] : undefined
      )
      .filter((sectionId): sectionId is DashboardSectionId => Boolean(sectionId))
      .filter((sectionId, index, items) => items.indexOf(sectionId) === index)

    if (mapped.length > 0) {
      return {
        version: 2,
        preset: 'custom',
        order: [...mapped, ...DEFAULT_ORDER.filter(sectionId => !mapped.includes(sectionId))],
        hidden: [],
      }
    }
  } catch {
    // silent-catch-ok: corrupted legacy preferences safely fall back to Balanced
  }
  return getPresetPreferences('balanced')
}

function removeLegacyStorage(): void {
  try {
    localStorage.removeItem(LEGACY_ORDER_KEY)
    localStorage.removeItem(LEGACY_STATS_KEY)
  } catch {
    // silent-catch-ok: storage cleanup is non-critical
  }
}

export function getPresetPreferences(
  preset: Exclude<DashboardPreset, 'custom'>
): DashboardPreferencesV2 {
  return clonePreferences(PRESETS[preset])
}

export function saveDashboardPreferences(preferences: DashboardPreferencesV2): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // silent-catch-ok: localStorage may be unavailable or full; in-memory UI still works
  }
}

export function getDashboardPreferences(): DashboardPreferencesV2 {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY)
    if (raw) {
      const normalized = normalizePreferences(JSON.parse(raw))
      if (normalized) {
        saveDashboardPreferences(normalized)
        removeLegacyStorage()
        return normalized
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_ORDER_KEY)
    if (legacyRaw) {
      const migrated = migrateLegacyPreferences(legacyRaw)
      saveDashboardPreferences(migrated)
      removeLegacyStorage()
      return migrated
    }
  } catch {
    // silent-catch-ok: corrupted or unavailable storage safely falls back to Balanced
  }

  const balanced = getPresetPreferences('balanced')
  removeLegacyStorage()
  return balanced
}

export function applyDashboardPreset(
  preset: Exclude<DashboardPreset, 'custom'>
): DashboardPreferencesV2 {
  const preferences = getPresetPreferences(preset)
  saveDashboardPreferences(preferences)
  return preferences
}

export function setManualOrder(newOrder: DashboardSectionId[]): DashboardPreferencesV2 {
  const current = getDashboardPreferences()
  const preferences: DashboardPreferencesV2 = {
    ...current,
    preset: 'custom',
    order: normalizeOrder(newOrder),
  }
  saveDashboardPreferences(preferences)
  return preferences
}

export function setSectionVisibility(
  sectionId: DashboardSectionId,
  visible: boolean
): DashboardPreferencesV2 {
  const current = getDashboardPreferences()
  const hidden = visible
    ? current.hidden.filter(id => id !== sectionId)
    : [...current.hidden.filter(id => id !== sectionId), sectionId]
  const preferences: DashboardPreferencesV2 = { ...current, preset: 'custom', hidden }
  saveDashboardPreferences(preferences)
  return preferences
}

export function resetDashboardPreferences(): DashboardPreferencesV2 {
  return applyDashboardPreset('balanced')
}

export function clearDashboardData(): void {
  try {
    localStorage.removeItem(PREFERENCES_KEY)
    localStorage.removeItem(LEGACY_ORDER_KEY)
    localStorage.removeItem(LEGACY_STATS_KEY)
  } catch {
    // silent-catch-ok: storage cleanup is non-critical
  }
}

export const DASHBOARD_PREFERENCES_KEY = PREFERENCES_KEY
