/**
 * Field Mapper — E92-S03
 *
 * Two pure functions that translate between Dexie (camelCase) and Supabase
 * (snake_case) record shapes using the per-table `fieldMap` from the
 * registry combined with a universal `IDENTITY_FIELD_MAP` for identity
 * fields (`userId`, `createdAt`, `updatedAt`).
 *
 * # Scope
 *
 * The mapper handles pure key-renaming, stripping, and vault-exclusion. It
 * does NOT recurse into nested values, and it does NOT handle semantic
 * transformations (e.g., projecting Dexie's `currentTime` into Supabase's
 * `watched_seconds` — the upload phase of E92-S05 owns that).
 *
 * # Purity
 *
 * Both functions are pure: no I/O, no `Date.now()`, no random IDs, no
 * mutation of the input record. A fresh object is always returned.
 *
 * @see tableRegistry.ts for the data that drives these transforms.
 */

import { IDENTITY_FIELD_MAP, type TableRegistryEntry } from './tableRegistry'

/**
 * Cache of merged-and-inverted rename maps keyed by registry entry. The
 * inversion is stable for an entry (registry is frozen at module load) and
 * costs O(|fieldMap|) to compute, so caching avoids repeated work across
 * many records from the same table.
 */
const inverseMapCache = new WeakMap<TableRegistryEntry, Readonly<Record<string, string>>>()

function buildForwardMap(entry: TableRegistryEntry): Readonly<Record<string, string>> {
  // Per-table fieldMap takes precedence over identity map (by spreading
  // after). Keeps identity handling universal while allowing explicit overrides.
  return { ...IDENTITY_FIELD_MAP, ...entry.fieldMap }
}

function buildInverseMap(entry: TableRegistryEntry): Readonly<Record<string, string>> {
  const cached = inverseMapCache.get(entry)
  if (cached) return cached

  const forward = buildForwardMap(entry)
  const inverse: Record<string, string> = {}
  for (const [camel, snake] of Object.entries(forward)) {
    inverse[snake] = camel
  }
  inverseMapCache.set(entry, inverse)
  return inverse
}

/**
 * Translate a Dexie record shape to a Supabase row payload.
 *
 * - Keys listed in `entry.stripFields` are dropped entirely.
 * - Keys listed in `entry.vaultFields` are dropped entirely (Vault writes
 *   happen separately in E95).
 * - Remaining keys are renamed via `IDENTITY_FIELD_MAP` ∪ `entry.fieldMap`,
 *   falling back to the original key when no rename is declared.
 * - Values are copied by reference (no deep clone).
 * - The input object is never mutated.
 */
export function toSnakeCase(
  entry: TableRegistryEntry,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const forward = buildForwardMap(entry)
  const strip = new Set<string>([
    ...(entry.stripFields ?? []),
    ...(entry.vaultFields ?? []),
  ])

  const output: Record<string, unknown> = {}
  for (const key of Object.keys(record)) {
    if (strip.has(key)) continue
    const renamed = forward[key] ?? key
    output[renamed] = record[key]
  }
  return output
}

/**
 * Translate a Supabase row payload back to a Dexie record shape.
 *
 * - Keys are renamed via the inverse of `IDENTITY_FIELD_MAP` ∪ `entry.fieldMap`.
 * - Unknown keys pass through unchanged.
 * - `stripFields` / `vaultFields` are NOT restored here — callers handle
 *   those separately (file handles come from local IndexedDB; vault values
 *   come from a Vault read).
 * - Values are copied by reference.
 * - The input object is never mutated.
 */
export function toCamelCase(
  entry: TableRegistryEntry,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const inverse = buildInverseMap(entry)
  const output: Record<string, unknown> = {}
  for (const key of Object.keys(record)) {
    const renamed = inverse[key] ?? key
    output[renamed] = record[key]
  }
  return output
}
