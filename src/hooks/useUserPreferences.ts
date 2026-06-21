/**
 * User Preferences Hook
 *
 * Aggregates reorder history into preference vectors for personalized AI
 * path building. Reads from the local-only `reorderHistory` Dexie table.
 *
 * @module
 */

import { useState, useEffect, useRef } from 'react'
import { db } from '@/db'
import type { ReorderHistoryEntry } from '@/data/types'

/** Preference vectors derived from reorder history */
export interface UserPreferences {
  /** Ratio of easy-first vs hard-first moves (1 = strong easy-first, -1 = strong hard-first) */
  difficultyOrdering: number
  /** Ratio of short-first vs long-first moves */
  durationOrdering: number
  /** Top 3 topics the user consistently places earlier than AI suggests */
  topicAffinity: string[]
  /** Ratio of video-first vs text-first moves */
  formatAffinity: number
}

interface UserPreferencesResult {
  preferences: UserPreferences | null
  /** Number of history entries used for computation */
  entryCount: number
  /** True when >= 3 entries exist (reliable signal) */
  isReady: boolean
  /** Manually refresh preferences */
  refresh: () => void
}

const DIFFICULTY_TERMS: Record<string, number> = {
  beginner: -1,
  fundamentals: -1,
  basic: -1,
  introduction: -1,
  intermediate: 0,
  advanced: 1,
  expert: 1,
  master: 1,
}

const FORMAT_VIDEO_TERMS = new Set([
  'video',
  'course',
  'lecture',
  'tutorial',
  'workshop',
  'training',
])

const FORMAT_TEXT_TERMS = new Set([
  'book',
  'article',
  'pdf',
  'document',
  'guide',
  'reference',
  'manual',
])

function detectDifficultyFromTags(tags: string[]): number {
  let score = 0
  let count = 0
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    for (const [term, value] of Object.entries(DIFFICULTY_TERMS)) {
      if (lower.includes(term)) {
        score += value
        count++
        break
      }
    }
  }
  return count > 0 ? score / count : 0
}

function detectFormatFromTags(tags: string[]): 'video' | 'text' | 'mixed' {
  let videoHits = 0
  let textHits = 0
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    if (FORMAT_VIDEO_TERMS.has(lower)) videoHits++
    if (FORMAT_TEXT_TERMS.has(lower)) textHits++
  }
  if (videoHits > textHits) return 'video'
  if (textHits > videoHits) return 'text'
  return 'mixed'
}

const TOPIC_BLACKLIST = new Set([
  'beginner',
  'intermediate',
  'advanced',
  'fundamentals',
  'basic',
  'video',
  'book',
  'course',
  'tutorial',
  'lecture',
  'workshop',
  'training',
  'article',
  'pdf',
  'document',
  'guide',
  'reference',
])

function extractTopicsFromTags(tags: string[]): string[] {
  return tags.filter(t => !TOPIC_BLACKLIST.has(t.toLowerCase()))
}

/**
 * Hook that aggregates reorder history into preference vectors.
 *
 * Memoized with stale-while-revalidate: returns cached result immediately
 * and refreshes in the background.
 */
export function useUserPreferences(): UserPreferencesResult {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [entryCount, setEntryCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function compute() {
      try {
        const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
        const recent = await db.reorderHistory
          .orderBy('movedAt')
          .reverse()
          .filter(e => new Date(e.movedAt).getTime() >= cutoff)
          .limit(50)
          .toArray()

        if (!mountedRef.current) return

        setEntryCount(recent.length)

        if (recent.length < 3) {
          setPreferences(null)
          return
        }

        const prefs = computePreferences(recent)
        setPreferences(prefs)
      } catch (err) {
        // silent-catch-ok: background preference computation failure is non-critical;
        // preferences degrade gracefully to null (no personalization)
        console.warn('[useUserPreferences] Failed to compute:', err)
        if (mountedRef.current) {
          setPreferences(null)
          setEntryCount(0)
        }
      }
    }

    compute()

    return () => {
      mountedRef.current = false
    }
  }, [refreshKey])

  return {
    preferences,
    entryCount,
    isReady: entryCount >= 3 && preferences !== null,
    refresh: () => setRefreshKey(k => k + 1),
  }
}

function computePreferences(history: ReorderHistoryEntry[]): UserPreferences {
  // Difficulty ordering: +1 = easy-first, -1 = hard-first
  let difficultySignal = 0
  let difficultyCount = 0

  // Topic affinity: count times user places a topic earlier than AI suggested
  const topicMoves = new Map<string, number>()

  // Format affinity: +1 = video-first, -1 = text-first
  let formatSignal = 0
  let formatCount = 0

  for (const entry of history) {
    if (entry.suggestedPosition === null) continue

    const difficultyScore = detectDifficultyFromTags(entry.courseTags)
    if (difficultyScore !== 0) {
      // Positive: user moved harder course earlier (hard-first preference)
      // Negative: user moved easier course earlier (easy-first preference)
      const moveDir = entry.chosenPosition - entry.suggestedPosition
      // If the course is hard (positive difficultyScore) and user moved it earlier (negative moveDir),
      // that indicates hard-first preference (+1)
      if (difficultyScore > 0 && moveDir < 0) difficultySignal += 1
      else if (difficultyScore > 0 && moveDir > 0) difficultySignal -= 1
      else if (difficultyScore < 0 && moveDir < 0) difficultySignal -= 1
      else if (difficultyScore < 0 && moveDir > 0) difficultySignal += 1
      difficultyCount++
    }

    const format = detectFormatFromTags(entry.courseTags)
    if (format !== 'mixed') {
      const moveDir = entry.chosenPosition - entry.suggestedPosition
      if (format === 'video' && moveDir < 0) formatSignal += 1
      else if (format === 'video' && moveDir > 0) formatSignal -= 1
      else if (format === 'text' && moveDir < 0) formatSignal -= 1
      else if (format === 'text' && moveDir > 0) formatSignal += 1
      formatCount++
    }

    // Track topic placement
    const topics = extractTopicsFromTags(entry.courseTags)
    for (const topic of topics) {
      const moveDir = entry.chosenPosition - entry.suggestedPosition
      // Positive = user wants this topic earlier
      const signal = moveDir < 0 ? 1 : moveDir > 0 ? -1 : 0
      topicMoves.set(topic, (topicMoves.get(topic) || 0) + signal)
    }
  }

  // Top 3 topics with strongest "place earlier" signal
  const topicAffinity = Array.from(topicMoves.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic)

  return {
    difficultyOrdering:
      difficultyCount > 0 ? Math.round((difficultySignal / difficultyCount) * 100) / 100 : 0,
    durationOrdering: 0, // No duration data in current model
    topicAffinity,
    formatAffinity: formatCount > 0 ? Math.round((formatSignal / formatCount) * 100) / 100 : 0,
  }
}

/**
 * Format preferences as natural language for AI prompt injection.
 * Returns an empty string if preferences are null.
 */
export function formatPreferencesForPrompt(prefs: UserPreferences | null): string {
  if (!prefs) return ''

  const lines: string[] = []

  if (prefs.difficultyOrdering > 0.3) {
    lines.push('- Tends to prefer easier courses first, building up to harder content')
  } else if (prefs.difficultyOrdering < -0.3) {
    lines.push('- Tends to prefer harder/challenging courses first')
  }

  if (prefs.topicAffinity.length > 0) {
    lines.push(`- Shows strong interest in: ${prefs.topicAffinity.join(', ')}`)
  }

  if (prefs.formatAffinity > 0.3) {
    lines.push('- Tends to prefer video-based courses earlier in the sequence')
  } else if (prefs.formatAffinity < -0.3) {
    lines.push('- Tends to prefer text/book-based courses earlier in the sequence')
  }

  if (lines.length === 0) return ''

  return lines.join('\n')
}
