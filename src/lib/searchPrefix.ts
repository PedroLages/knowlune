import type { EntityType } from '@/lib/unifiedSearch'

/** Maps single-character prefix keys to entity types. */
export const PREFIX_MAP: Record<string, EntityType> = {
  c: 'course',
  b: 'book',
  l: 'lesson',
  a: 'author',
  n: 'note',
  h: 'highlight',
}

export interface ParsedPrefix {
  scope: EntityType
  /** The text after the prefix + colon (may be empty string). */
  rest: string
}

/**
 * Parse a position-0 prefix from raw input.
 *
 * Rules:
 *  - Must start at position 0 (leading space → null).
 *  - Must be a known single lowercase character + colon (minimum 2 chars).
 *  - Rest may be empty — `c:` alone enters scoped mode with empty query.
 *  - Returns null for all other inputs.
 */
export function parsePrefix(raw: string): ParsedPrefix | null {
  if (raw.length < 2) return null
  if (raw[1] !== ':') return null
  const char = raw[0]
  const type = PREFIX_MAP[char]
  if (!type) return null
  return { scope: type, rest: raw.slice(2) }
}
