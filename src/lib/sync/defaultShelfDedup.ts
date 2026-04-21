/**
 * defaultShelfDedup — E94-S03
 *
 * Pure helper that reconciles incoming remote shelves against existing local
 * shelves so a new-device sign-in does not accumulate duplicate default
 * shelves.
 *
 * The problem: each device seeds 3 default shelves (Favorites, Currently
 * Reading, Want to Read) at first launch with device-local UUIDs. When a
 * user signs in on Device B after using Device A, the incoming batch from
 * Supabase contains Device A's 3 default shelves. A naive sync would
 * insert all 3 remote rows alongside the 3 local rows → 6 "Favorites"
 * shelves.
 *
 * The fix: match incoming defaults against local defaults by normalized
 * name (lowercase + trimmed). Matching remote rows are skipped; the mapping
 * {remoteId → localId} is returned so the caller can persist it and use
 * it to rewrite `book_shelves.shelf_id` on the next download cycle.
 *
 * Only defaults participate — custom user-created shelves are always
 * inserted even if they share a name with a local default.
 *
 * Pure module: no I/O, no imports beyond the `Shelf` type.
 *
 * @module defaultShelfDedup
 * @since E94-S03
 */

import type { Shelf } from '@/data/types'

/**
 * Dedup decision result.
 *
 * - `toInsert` — incoming rows that are NOT local-default duplicates; apply
 *   normally.
 * - `toSkip` — incoming rows that collide with an existing local default;
 *   do NOT insert. Callers should use `mergedIdMap` to rewrite any
 *   downstream foreign-key references.
 * - `mergedIdMap` — mapping from remote (skipped) shelf id to the local
 *   canonical id. Persist this map in `syncMetadata` so subsequent
 *   `book_shelves` downloads can remap `shelfId` correctly.
 */
export interface DedupResult {
  toInsert: Shelf[]
  toSkip: Shelf[]
  mergedIdMap: Record<string, string>
}

/**
 * Normalize a shelf name for dedup-key comparison.
 * Trim whitespace and lowercase to collapse minor casing drift across
 * devices. `"favorites"`, `"Favorites"`, `" Favorites "` all map to the
 * same key.
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Partition `incoming` shelves into those to insert and those to skip
 * based on default-name collisions with `existingLocal`.
 *
 * Rules:
 *   1. Only rows where `isDefault === true` on BOTH sides are candidates
 *      for dedup. Custom shelves always pass through to `toInsert`.
 *   2. Name matching is case-insensitive and trim-insensitive.
 *   3. A local default with name "X" is chosen as the canonical target
 *      for incoming defaults named "X".
 *   4. If multiple local defaults share the same normalized name, the
 *      first one encountered wins (input-order stable).
 *   5. If multiple incoming defaults share the same normalized name AND
 *      a local match exists, all of them are mapped to the same local id
 *      (subsequent remote-side duplicates collapse to the same canonical
 *      local row).
 */
export function dedupDefaultShelves(incoming: Shelf[], existingLocal: Shelf[]): DedupResult {
  // Build lookup table of local defaults by normalized name.
  const localDefaultsByName = new Map<string, Shelf>()
  for (const shelf of existingLocal) {
    if (shelf.isDefault !== true) continue
    const key = normalizeName(shelf.name)
    if (!localDefaultsByName.has(key)) {
      localDefaultsByName.set(key, shelf)
    }
  }

  const toInsert: Shelf[] = []
  const toSkip: Shelf[] = []
  const mergedIdMap: Record<string, string> = {}

  for (const remote of incoming) {
    if (remote.isDefault !== true) {
      toInsert.push(remote)
      continue
    }

    const key = normalizeName(remote.name)
    const localMatch = localDefaultsByName.get(key)
    if (localMatch && localMatch.id !== remote.id) {
      toSkip.push(remote)
      mergedIdMap[remote.id] = localMatch.id
    } else {
      // Either no local match, or the incoming row IS the canonical local
      // row (same id — e.g. subsequent sync cycles after first download).
      toInsert.push(remote)
    }
  }

  return { toInsert, toSkip, mergedIdMap }
}
