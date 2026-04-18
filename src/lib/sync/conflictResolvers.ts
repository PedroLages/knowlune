/**
 * Conflict Resolvers — E93-S03
 *
 * Pure functions for applying conflict resolution strategies to sync records.
 *
 * Pure module — no Dexie, Supabase, or React imports. Safe to import anywhere.
 * Conflict detection (is this a conflict?) stays in syncEngine.ts.
 * These functions are transforms only — called only when a conflict is confirmed.
 *
 * Named exports only (consistent with fieldMapper.ts, tableRegistry.ts).
 */

import type { Note } from '@/data/types'

/**
 * Apply the conflict-copy strategy for a confirmed note conflict.
 *
 * Remote is the winner (higher updatedAt). The local version is preserved as
 * a `conflictCopy` snapshot on the winning note so the learner can review and
 * resolve it via the NoteConflictDialog.
 *
 * @param local  The local note (lower updatedAt — the losing version)
 * @param remote The remote note (higher updatedAt — the winning version)
 * @returns A new Note object: remote spread as winner with conflictCopy attached
 */
export function applyConflictCopy(local: Note, remote: Note): Note {
  return {
    ...remote,
    conflictCopy: {
      content: local.content,
      tags: local.tags,
      savedAt: local.updatedAt,
    },
    conflictSourceId: local.id,
  }
}
