/**
 * Field Mapper — E92-S03
 *
 * Pure functions for converting Dexie record field names to Supabase column
 * names (camelCase → snake_case) and back (snake_case → camelCase).
 *
 * Conversion rules (applied in order):
 *   1. If the field name appears in `entry.fieldMap`, use the explicit override.
 *   2. Otherwise, apply automatic camelCase → snake_case conversion.
 *
 * Additional behaviours of `toSnakeCase`:
 *   - Fields in `entry.stripFields` are removed (non-serializable browser handles).
 *   - Fields in `entry.vaultFields` are removed (credentials that must never
 *     reach Postgres rows — routed to Supabase Vault in E95-S02).
 *
 * Pure module — no Dexie, Zustand, or React imports. Safe to import anywhere.
 */

import type { TableRegistryEntry } from './tableRegistry'

/**
 * Convert a camelCase string to snake_case.
 * Examples:
 *   courseId      → course_id
 *   watchedSeconds → watched_seconds
 *   updatedAt     → updated_at
 */
function camelToSnake(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase()
}

/**
 * Convert a snake_case string to camelCase.
 * Examples:
 *   course_id       → courseId
 *   watched_seconds → watchedSeconds
 *   updated_at      → updatedAt
 */
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Build a reverse fieldMap: Supabase column name → Dexie field name.
 * Used by `toCamelCase` to invert explicit overrides.
 */
function invertFieldMap(fieldMap: Record<string, string>): Record<string, string> {
  const reversed: Record<string, string> = {}
  for (const [camel, snake] of Object.entries(fieldMap)) {
    reversed[snake] = camel
  }
  return reversed
}

/**
 * Convert a Dexie record's field names to Supabase column names.
 *
 * - Applies explicit `entry.fieldMap` overrides first.
 * - Falls back to automatic camelCase → snake_case conversion.
 * - Strips fields listed in `entry.stripFields` (non-serializable handles).
 * - Strips fields listed in `entry.vaultFields` (credentials → Vault only).
 * - Only converts key names; values are never modified.
 *
 * @param entry  The registry entry for the table being synced.
 * @param record The Dexie record to convert (read-only — a new object is returned).
 * @returns A new object with Supabase-compatible column names.
 */
export function toSnakeCase(
  entry: TableRegistryEntry,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const stripSet = new Set<string>([
    ...(entry.stripFields ?? []),
    ...(entry.vaultFields ?? []),
  ])

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    // Drop non-serializable handles and vault credentials.
    if (stripSet.has(key)) {
      continue
    }

    // Use explicit fieldMap override if present; otherwise auto-convert.
    const mappedKey = entry.fieldMap[key] ?? camelToSnake(key)
    result[mappedKey] = value
  }

  return result
}

/**
 * Convert a Supabase record's column names back to Dexie field names.
 *
 * - Applies the inverse of `entry.fieldMap` for explicit overrides.
 * - Falls back to automatic snake_case → camelCase conversion.
 * - Only converts key names; values are never modified.
 *
 * Note: fields that were stripped by `toSnakeCase` (stripFields / vaultFields)
 * will not be present in the input and therefore will not appear in the output.
 * This is expected — stripped fields are not round-trippable by design.
 *
 * @param entry  The registry entry for the table being synced.
 * @param record The Supabase record to convert (read-only — a new object is returned).
 * @returns A new object with Dexie-compatible field names.
 */
export function toCamelCase(
  entry: TableRegistryEntry,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const reverseMap = invertFieldMap(entry.fieldMap)

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    // Use inverse fieldMap override if present; otherwise auto-convert.
    const mappedKey = reverseMap[key] ?? snakeToCamel(key)
    result[mappedKey] = value
  }

  return result
}
