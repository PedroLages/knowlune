/**
 * Privacy notice versioning — single source of truth for the current notice version.
 *
 * Format: YYYY-MM-DD.N
 *   - YYYY-MM-DD: ISO date of the last material change
 *   - N: integer revision number within that date (starts at 1)
 *
 * Bump CURRENT_NOTICE_VERSION whenever the privacy notice content changes materially.
 * Downstream consumers (S02 re-acknowledgement, S07 consent records) import from here.
 */

/** Canonical identifier for the privacy document (matches LegalUpdateBanner storage key). */
export const NOTICE_DOCUMENT_ID = 'privacy' as const

/** Current notice version in YYYY-MM-DD.N format. */
export const CURRENT_NOTICE_VERSION = '2026-04-23.1' as const

/** Parsed representation of a notice version string. */
export interface ParsedNoticeVersion {
  isoDate: string
  revision: number
}

/**
 * Parse a notice version string into its component parts.
 *
 * @throws {Error} if the version string does not match YYYY-MM-DD.N format
 */
export function parseNoticeVersion(version: string): ParsedNoticeVersion {
  const match = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(version)
  if (!match) {
    throw new Error(
      `Invalid notice version format: "${version}". Expected YYYY-MM-DD.N (e.g. "2026-04-23.1").`,
    )
  }
  return {
    isoDate: match[1],
    revision: parseInt(match[2], 10),
  }
}

/**
 * Format a notice version string for display in the legal update banner.
 *
 * @returns "Effective YYYY-MM-DD (rev N)"
 * @throws {Error} if the version string is invalid
 */
export function formatNoticeEffectiveDate(version: string): string {
  const { isoDate, revision } = parseNoticeVersion(version)
  return `Effective ${isoDate} (rev ${revision})`
}
