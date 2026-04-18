/**
 * searchScopedTop — frecency-ordered top-N results for a single entity type.
 *
 * Used by the palette's empty scoped-query branch (chip active, no text).
 * Algorithm:
 *  1. Query `db.searchFrecency` by entityType, descending by lastOpenedAt.
 *  2. Map each frecency row to a UnifiedSearchResult (via the MiniSearch corpus).
 *     Drop rows whose id is no longer in the index (deleted entity).
 *  3. Append unopened corpus entries alphabetically (by displayTitle).
 *  4. Cap total at `limit`.
 */
import { db } from '@/db'
import { getCorpusEntries } from '@/lib/unifiedSearch'
import type { EntityType, UnifiedSearchResult } from '@/lib/unifiedSearch'

export async function getScopedTopResults(
  type: EntityType,
  limit: number
): Promise<UnifiedSearchResult[]> {
  const corpus = getCorpusEntries(type)
  if (corpus.size === 0) return []

  let frecRows: Array<{ entityType: EntityType; entityId: string; lastOpenedAt: string }>
  try {
    frecRows = await db.searchFrecency
      .where('entityType')
      .equals(type)
      .reverse()
      .sortBy('lastOpenedAt')
  } catch (err) {
    console.error('[search-scoped-top] frecency query failed, falling back to alphabetical:', err)
    frecRows = []
  }

  const results: UnifiedSearchResult[] = []
  const coveredIds = new Set<string>()

  for (const row of frecRows) {
    if (results.length >= limit) break
    const displayTitle = corpus.get(row.entityId)
    if (displayTitle === undefined) continue // deleted entity
    coveredIds.add(row.entityId)
    results.push({
      id: row.entityId,
      type,
      score: 1,
      displayTitle,
    })
  }

  if (results.length < limit) {
    // Alphabetical pad from corpus entries not yet covered by frecency.
    const alphabetical = [...corpus.entries()]
      .filter(([id]) => !coveredIds.has(id))
      .sort(([, a], [, b]) => a.localeCompare(b))

    for (const [id, displayTitle] of alphabetical) {
      if (results.length >= limit) break
      results.push({ id, type, score: 0, displayTitle })
    }
  }

  return results
}
