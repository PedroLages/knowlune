/**
 * Data Pruning Service (E32-S04)
 *
 * Automatically prunes old data from IndexedDB tables to prevent unbounded growth.
 * Runs as a background task after app initialization (never blocks first paint).
 *
 * Tables pruned:
 * - studySessions: by startTime (configurable TTL, default 90 days)
 * - aiUsageEvents: by timestamp (configurable TTL, default 90 days)
 * - embeddings: orphaned only (noteId not found in notes table)
 *
 * Settings stored in localStorage under 'data-retention-settings'.
 */

import { db } from '@/db'

// --- Types ---

/** TTL options in days. 0 = keep forever. */
export type RetentionDays = 30 | 60 | 90 | 180 | 0

export interface DataRetentionSettings {
  studySessionsTTL: RetentionDays
  aiUsageEventsTTL: RetentionDays
  /** Orphaned embeddings are always pruned (no TTL — just reference check) */
  pruneOrphanedEmbeddings: boolean
}

export interface PruneResult {
  studySessionsPruned: number
  aiUsageEventsPruned: number
  embeddingsPruned: number
}

// --- Constants ---

const STORAGE_KEY = 'data-retention-settings'

const DEFAULT_SETTINGS: DataRetentionSettings = {
  studySessionsTTL: 90,
  aiUsageEventsTTL: 90,
  pruneOrphanedEmbeddings: true,
}

export const TTL_OPTIONS: { value: RetentionDays; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 0, label: 'Keep forever' },
]

// --- Settings API ---

export function getRetentionSettings(): DataRetentionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveRetentionSettings(
  settings: Partial<DataRetentionSettings>
): DataRetentionSettings {
  const current = getRetentionSettings()
  const updated = { ...current, ...settings }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

// --- Pruning Logic ---

/**
 * Computes ISO date string for N days ago from now.
 */
function cutoffDate(days: number): string {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return cutoff.toISOString()
}

/**
 * Prune study sessions older than the configured TTL.
 * Uses startTime index for efficient range deletion.
 */
async function pruneStudySessions(ttlDays: RetentionDays): Promise<number> {
  if (ttlDays === 0) return 0

  const cutoff = cutoffDate(ttlDays)
  const count = await db.studySessions.where('startTime').below(cutoff).delete()

  if (count > 0) {
    console.log(`[DataPruning] Pruned ${count} study sessions older than ${ttlDays} days`)
  }
  return count
}

/**
 * Prune AI usage events older than the configured TTL.
 * Uses timestamp index for efficient range deletion.
 */
async function pruneAIUsageEvents(ttlDays: RetentionDays): Promise<number> {
  if (ttlDays === 0) return 0

  const cutoff = cutoffDate(ttlDays)
  const count = await db.aiUsageEvents.where('timestamp').below(cutoff).delete()

  if (count > 0) {
    console.log(`[DataPruning] Pruned ${count} AI usage events older than ${ttlDays} days`)
  }
  return count
}

/**
 * Prune orphaned embeddings (noteId not found in notes table).
 * This requires loading all embedding noteIds and checking against existing notes.
 */
async function pruneOrphanedEmbeddings(): Promise<number> {
  const allEmbeddings = await db.embeddings.toArray()
  if (allEmbeddings.length === 0) return 0

  // Get all note IDs as a Set for O(1) lookups
  const noteIds = new Set(await db.notes.toCollection().primaryKeys())

  // Find orphaned embedding noteIds
  const orphanedNoteIds = allEmbeddings.filter(e => !noteIds.has(e.noteId)).map(e => e.noteId)

  if (orphanedNoteIds.length === 0) return 0

  // Delete orphaned embeddings
  await db.embeddings.bulkDelete(orphanedNoteIds)
  console.log(`[DataPruning] Pruned ${orphanedNoteIds.length} orphaned embeddings`)
  return orphanedNoteIds.length
}

/**
 * Run all pruning tasks based on current retention settings.
 * Returns a summary of what was pruned.
 */
export async function runDataPruning(): Promise<PruneResult> {
  const settings = getRetentionSettings()

  const [studySessionsPruned, aiUsageEventsPruned, embeddingsPruned] = await Promise.all([
    pruneStudySessions(settings.studySessionsTTL),
    pruneAIUsageEvents(settings.aiUsageEventsTTL),
    settings.pruneOrphanedEmbeddings ? pruneOrphanedEmbeddings() : Promise.resolve(0),
  ])

  const total = studySessionsPruned + aiUsageEventsPruned + embeddingsPruned
  if (total > 0) {
    console.log(`[DataPruning] Total pruned: ${total} records`)
  }

  return { studySessionsPruned, aiUsageEventsPruned, embeddingsPruned }
}
