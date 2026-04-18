/**
 * searchFrecency — local persistence helpers for unified-search ranking (E117-S02).
 *
 * Two persistence structures:
 *  1. `localStorage[RECENT_LIST_KEY]` — last 20 `{type, id, openedAt}` entries,
 *     JSON array, deduped by `${type}:${id}` (newest wins). Drives the
 *     "Recently opened" row in the palette's empty state.
 *  2. Dexie `searchFrecency` table — per-entity `{openCount, lastOpenedAt}`.
 *     Drives the Best Matches frecency multiplier via `applyFrecency`.
 *
 * `recordVisit(entityType, entityId)` writes both in one call. The Dexie RMW
 * is wrapped in a transaction so concurrent calls on the same key produce
 * `openCount: N+2`, not `N+1`.
 *
 * `applyFrecency` is a pure transform over `UnifiedSearchResult[]` — it lives
 * here (not in `unifiedSearch.ts`) to keep the MiniSearch module persistence-free.
 *
 * Both writes are fire-and-forget and errors are logged (never swallowed) per
 * the `error-handling/no-silent-catch` ESLint rule.
 */
import { db } from '@/db'
import type { EntityType, UnifiedSearchResult } from '@/lib/unifiedSearch'
import { type FrecencyRow } from '@/db/schema'

export type { FrecencyRow }

export const RECENT_LIST_KEY = 'knowlune.recentSearchHits.v1'
export const RECENT_LIST_MAX = 20

export interface RecentHit {
  type: EntityType
  id: string
  /** ISO 8601 timestamp. Used for ordering, not display. */
  openedAt: string
}

const VALID_ENTITY_TYPES: ReadonlySet<EntityType> = new Set<EntityType>([
  'course',
  'book',
  'lesson',
  'note',
  'highlight',
  'author',
])

/**
 * Defensive shape check — a half-migrated v1 blob shouldn't crash the palette.
 */
function isRecentHit(value: unknown): value is RecentHit {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.type === 'string' &&
    VALID_ENTITY_TYPES.has(v.type as EntityType) &&
    typeof v.id === 'string' &&
    v.id.length > 0 &&
    typeof v.openedAt === 'string'
  )
}

/**
 * Read the current recent-list from localStorage.
 * Returns `[]` on corruption (with one console warning) so the palette can
 * still render.
 */
export function getRecentHits(): RecentHit[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(RECENT_LIST_KEY)
  } catch (err) {
    // silent-catch-ok: localStorage access may throw in locked-down browser contexts
    console.warn('[search-frecency] localStorage read failed:', err)
    return []
  }
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentHit)
  } catch (err) {
    // silent-catch-ok: corrupt JSON — treat as empty list and log once
    console.warn('[search-frecency] recent list JSON corrupt, resetting:', err)
    return []
  }
}

/**
 * Write the recent list back to localStorage.
 */
function writeRecentHits(list: RecentHit[]): void {
  try {
    localStorage.setItem(RECENT_LIST_KEY, JSON.stringify(list))
  } catch (err) {
    // silent-catch-ok: quota / disabled storage — logged, navigation continues
    console.error('[search-frecency] recent list write failed:', err)
  }
}

/**
 * Record a visit to an entity. Updates BOTH persistence structures:
 *  - localStorage recent list (prepend + dedup + cap to 20)
 *  - Dexie `searchFrecency` row (RMW wrapped in a transaction so concurrent
 *    calls on the same key produce `openCount: N+2`, not `N+1`)
 *
 * Fire-and-forget: errors are logged, never thrown. No-op when `entityId` is empty
 * (defensive against route components that fire before `useParams` resolves).
 */
export async function recordVisit(entityType: EntityType, entityId: string): Promise<void> {
  if (!entityId) return

  const nowIso = new Date().toISOString()

  // LS side — synchronous, inexpensive.
  try {
    const current = getRecentHits()
    const key = `${entityType}:${entityId}`
    const filtered = current.filter(h => `${h.type}:${h.id}` !== key)
    const next: RecentHit[] = [{ type: entityType, id: entityId, openedAt: nowIso }, ...filtered]
    const capped = next.slice(0, RECENT_LIST_MAX)
    writeRecentHits(capped)
  } catch (err) {
    // silent-catch-ok: LS write must never block Dexie write or navigation
    console.error('[search-frecency] recent list update failed:', err)
  }

  // Dexie side — RMW in a transaction to serialize concurrent calls on the
  // same compound key. Without the transaction, two concurrent calls both
  // read `openCount = N`, each put `N+1`, and the second overwrites the first
  // — silently dropping one increment.
  try {
    await db.transaction('rw', db.searchFrecency, async () => {
      const prev = await db.searchFrecency.get([entityType, entityId])
      await db.searchFrecency.put({
        entityType,
        entityId,
        openCount: (prev?.openCount ?? 0) + 1,
        lastOpenedAt: nowIso,
      })
    })
  } catch (err) {
    // silent-catch-ok: Dexie failure is logged; navigation must not block on it
    console.error('[search-frecency] put failed for %s:%s', entityType, entityId, err)
  }
}

/**
 * Pure transform — apply the frecency multiplier to MiniSearch scores.
 *
 * Formula (origin §6.2, with explicit `min(log2(1+openCount), 2)` cap so the
 * overall multiplier maxes at 2.0):
 *
 *   multiplier = 1 + 0.5 × clamp((30 - daysSinceLastOpen) / 30, 0, 1)
 *                       × min(log2(1 + openCount), 2)
 *   finalScore = miniSearchScore × multiplier
 *
 * - Missing frecency entry OR `lastOpenedAt === null` → multiplier = 1 (pure relevance).
 * - `daysSinceLastOpen >= 30` → decay = 0 → multiplier = 1.
 * - `openCount === 0` → log2(1) = 0 → multiplier = 1.
 * - `openCount >= 3` + same-day → multiplier = 2.0 (cap hit).
 *
 * Never mutates inputs. Returns a new array with new result objects where scores
 * differ; identical objects when multiplier = 1 (but re-wraps to be safe).
 */
export function applyFrecency(
  results: UnifiedSearchResult[],
  frecencyMap: Map<string, FrecencyRow>,
  nowMs: number
): UnifiedSearchResult[] {
  return results.map(r => {
    const key = `${r.type}:${r.id}`
    const row = frecencyMap.get(key)
    if (!row) return { ...r }
    const openCount = row.openCount ?? 0
    const lastOpenedAt = row.lastOpenedAt
    let decay = 0
    if (lastOpenedAt) {
      const parsed = Date.parse(lastOpenedAt)
      if (Number.isFinite(parsed)) {
        const days = (nowMs - parsed) / 86_400_000
        decay = Math.max(0, Math.min(1, (30 - days) / 30))
      }
    }
    const boost = Math.min(Math.log2(1 + openCount), 2)
    const multiplier = 1 + 0.5 * decay * boost
    return { ...r, score: r.score * multiplier }
  })
}
