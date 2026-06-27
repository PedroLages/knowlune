/**
 * Extracts the search term from a gap entry justification string.
 * Gap entries can have an optional "[Search for: <term>]" suffix that
 * hints at what course to search for when resolving the gap.
 *
 * @example
 *   extractGapSearchTerm("Introduction to React [Search for: React Basics]")
 *   // => "React Basics"
 *
 *   extractGapSearchTerm("Introduction to React")
 *   // => undefined
 */
export function extractGapSearchTerm(justification?: string): string | undefined {
  const match = justification?.match(/\[Search for: (.+)\]$/)
  return match ? match[1] : undefined
}

/**
 * Removes the "[Search for: <term>]" suffix from a gap entry justification,
 * returning only the clean justification text.
 *
 * @example
 *   cleanGapJustification("Introduction to React [Search for: React Basics]")
 *   // => "Introduction to React"
 */
export function cleanGapJustification(justification?: string): string | undefined {
  if (!justification) return undefined
  return justification.replace(/\s*\[Search for: .+\]$/, '') || undefined
}

/**
 * Create a provenance partial for a LearningPathEntry.
 *
 * Returns the common `{ source, state, manifestOrdinal, manifestCourseKey }`
 * fields shared by every new entry. Omit `source` to default to `'user'`.
 *
 * Spread the result into your entry object literal:
 * ```
 * const entry: LearningPathEntry = {
 *   id: crypto.randomUUID(),
 *   ...entryProvenance('user'),
 *   // … remaining fields
 * }
 * ```
 */
export function entryProvenance(source: 'user' | 'manifest' = 'user') {
  return {
    source,
    state: 'active' as const,
    manifestOrdinal: null,
    manifestCourseKey: null,
  }
}
