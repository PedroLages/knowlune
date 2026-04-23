/**
 * E119-S10 AC-4, AC-6: Parity test — retention.md ↔ retentionPolicy.ts ↔ tableRegistry ↔ CONSENT_PURPOSES
 *
 * Asserts that:
 *   - Every supabaseTable in tableRegistry has a matching artefact in RETENTION_POLICY.
 *   - Every RETENTION_POLICY entry's artefact appears in retention.md.
 *   - Every artefact in retention.md appears in RETENTION_POLICY.
 *   - Every CONSENT_PURPOSES value is covered by PURPOSE_ARTEFACTS.
 *   - Entries with period: null are surfaced for reviewer sign-off (AC-6).
 *
 * If this test fails:
 *   - Add the missing artefact to RETENTION_POLICY in retentionPolicy.ts, AND
 *   - Add the corresponding row to docs/compliance/retention.md
 *   OR
 *   - Remove the stale entry from both files simultaneously.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { RETENTION_POLICY, PURPOSE_ARTEFACTS, INDEFINITE_RETENTION_ARTEFACTS } from '../retentionPolicy'
import { tableRegistry } from '../../sync/tableRegistry'
import { CONSENT_PURPOSES } from '../consentService'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ---------------------------------------------------------------------------
// Parse artefact keys from retention.md
// ---------------------------------------------------------------------------

/**
 * Extract artefact keys from the retention matrix markdown.
 *
 * Only parses tables whose first header column is "Artefact" — this avoids
 * picking up the consent-purpose mapping table (whose first column is "Consent Purpose")
 * or any other non-artefact tables in the document.
 *
 * Handles both plain-text artefacts (e.g. `auth_session_logs`) and
 * backtick-wrapped artefacts (e.g. `` `content_progress` ``).
 */
function parseRetentionArtefacts(markdown: string): Set<string> {
  const keys = new Set<string>()
  const lines = markdown.split('\n')
  let inArtefactTable = false

  for (const line of lines) {
    if (!line.startsWith('|')) {
      // Non-table line — reset table context
      inArtefactTable = false
      continue
    }

    const firstCell = line.split('|')[1]?.trim() ?? ''

    // Detect header rows: if first cell is "Artefact", we're in an artefact table
    if (firstCell === 'Artefact') {
      inArtefactTable = true
      continue
    }

    // Skip separator rows (--- lines)
    if (/^[-\s]+$/.test(firstCell)) {
      continue
    }

    // Only collect rows from artefact tables
    if (!inArtefactTable) {
      continue
    }

    // Strip backtick wrapping if present: `foo` → foo
    const key = firstCell.replace(/^`(.+)`$/, '$1')

    if (key) {
      keys.add(key)
    }
  }

  return keys
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const retentionMdPath = resolve(__dirname, '../../../../docs/compliance/retention.md')

let markdownArtefacts: Set<string>
let policyArtefacts: Set<string>
let registrySupabaseTables: Set<string>
let consentPurposeValues: Set<string>

beforeAll(() => {
  expect(existsSync(retentionMdPath)).toBe(true)
  const markdown = readFileSync(retentionMdPath, 'utf-8')
  markdownArtefacts = parseRetentionArtefacts(markdown)
  policyArtefacts = new Set(RETENTION_POLICY.map(e => e.artefact))
  // tableRegistry supabaseTable names — the `string` TypeScript type artefact is not present
  // in the actual exported array so this is clean already.
  registrySupabaseTables = new Set(tableRegistry.map(e => e.supabaseTable))
  consentPurposeValues = new Set(Object.values(CONSENT_PURPOSES))
})

// ---------------------------------------------------------------------------
// AC-4: Cross-reference assertions
// ---------------------------------------------------------------------------

describe('E119-S10 AC-4: retention matrix parity', () => {
  it('retention.md exists and is parseable', () => {
    expect(existsSync(retentionMdPath)).toBe(true)
    expect(markdownArtefacts.size).toBeGreaterThan(0)
  })

  it('every tableRegistry supabaseTable has an entry in RETENTION_POLICY', () => {
    const missing: string[] = []
    for (const tableName of registrySupabaseTables) {
      if (!policyArtefacts.has(tableName)) {
        missing.push(tableName)
      }
    }
    expect(missing, `Missing from RETENTION_POLICY: ${missing.join(', ')}`).toEqual([])
  })

  it('every RETENTION_POLICY artefact appears in retention.md', () => {
    const missing: string[] = []
    for (const artefact of policyArtefacts) {
      if (!markdownArtefacts.has(artefact)) {
        missing.push(artefact)
      }
    }
    expect(missing, `Missing from retention.md: ${missing.join(', ')}`).toEqual([])
  })

  it('every retention.md artefact appears in RETENTION_POLICY', () => {
    const missing: string[] = []
    for (const artefact of markdownArtefacts) {
      if (!policyArtefacts.has(artefact)) {
        missing.push(artefact)
      }
    }
    expect(missing, `Missing from RETENTION_POLICY: ${missing.join(', ')}`).toEqual([])
  })

  it('RETENTION_POLICY and retention.md have the same number of artefacts', () => {
    expect(policyArtefacts.size).toBe(markdownArtefacts.size)
  })

  it('every CONSENT_PURPOSES value is covered by PURPOSE_ARTEFACTS', () => {
    const missing: string[] = []
    for (const purpose of consentPurposeValues) {
      if (!(purpose in PURPOSE_ARTEFACTS)) {
        missing.push(purpose)
      }
    }
    expect(
      missing,
      `Consent purposes not mapped in PURPOSE_ARTEFACTS: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('PURPOSE_ARTEFACTS does not reference unknown artefacts', () => {
    const unknown: string[] = []
    for (const artefacts of Object.values(PURPOSE_ARTEFACTS)) {
      for (const artefact of artefacts) {
        if (!policyArtefacts.has(artefact)) {
          unknown.push(artefact)
        }
      }
    }
    expect(
      unknown,
      `PURPOSE_ARTEFACTS references unknown artefacts: ${unknown.join(', ')}`,
    ).toEqual([])
  })

  it('all RETENTION_POLICY entries have non-empty required fields', () => {
    const invalid: string[] = []
    for (const entry of RETENTION_POLICY) {
      if (
        !entry.artefact ||
        !entry.lawfulBasis ||
        !entry.deletionMechanism ||
        !entry.owner ||
        entry.dataCategories.length === 0
      ) {
        invalid.push(entry.artefact || '(unknown)')
      }
    }
    expect(invalid, `Entries with missing required fields: ${invalid.join(', ')}`).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// AC-6: Indefinite-retention entries — surface for reviewer sign-off
// ---------------------------------------------------------------------------

describe('E119-S10 AC-6: indefinite-retention entries require reviewer sign-off', () => {
  it('surfaces all artefacts with period: null for human review', () => {
    // This test always passes — its purpose is to make indefinite-retention
    // entries visible in CI output so they cannot be silently ignored.
    if (INDEFINITE_RETENTION_ARTEFACTS.length > 0) {
      console.warn(
        '[E119-S10 AC-6] Indefinite-retention artefacts (period: null) — require explicit reviewer sign-off:',
        INDEFINITE_RETENTION_ARTEFACTS,
      )
    }

    // The test itself does not fail — indefinite retention is sometimes valid
    // (e.g. pinned AI conversations). Reviewers must sign off on these entries
    // in the privacy notice review cycle (E119-S13).
    expect(INDEFINITE_RETENTION_ARTEFACTS).toBeDefined()
  })

  it('chat_conversations is present as an indefinite-retention entry (pinned conversations)', () => {
    // Pinned AI conversations have no automatic expiry — this is a known,
    // accepted case requiring explicit sign-off. This assertion documents
    // the intent rather than catching a regression.
    expect(INDEFINITE_RETENTION_ARTEFACTS).toContain('chat_conversations')
  })

  it('INDEFINITE_RETENTION_ARTEFACTS matches RETENTION_POLICY entries with period: null', () => {
    const expectedIndefinite = RETENTION_POLICY.filter(e => e.period === null).map(
      e => e.artefact,
    )
    expect(INDEFINITE_RETENTION_ARTEFACTS).toEqual(expectedIndefinite)
  })
})
