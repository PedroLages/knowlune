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
