/**
 * E119-S07 AC-6: Parity test — consent-inventory.md ↔ consentService purpose enum
 *
 * Asserts that every purpose key in the consent inventory document exists in
 * the CONSENT_PURPOSES enum (and vice versa). This prevents drift between the
 * compliance documentation and the runtime gatekeeper.
 *
 * If this test fails:
 *   - Add the missing key to CONSENT_PURPOSES in consentService.ts, OR
 *   - Add the missing row to docs/compliance/consent-inventory.md
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { CONSENT_PURPOSES } from '../consentService'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ---------------------------------------------------------------------------
// Parse purpose keys from the consent inventory markdown
// ---------------------------------------------------------------------------

/**
 * Extract consent purpose keys from the consent inventory markdown.
 *
 * Parses only the "Consent Purposes" section (between the
 * "### Consent Purposes" heading and the next "###" or "---" section).
 * Looks for backtick-wrapped snake_case identifiers in table rows.
 * Ignores the core_* purposes (lawful basis: contract) and provider IDs.
 */
function parseInventoryPurposeKeys(markdown: string): Set<string> {
  // Extract only the "Consent Purposes" section of the document.
  const consentSectionMatch = markdown.match(
    /### Consent Purposes.*?\n([\s\S]*?)(?=\n###|\n---)/,
  )
  const section = consentSectionMatch ? consentSectionMatch[1] : markdown

  const keys = new Set<string>()
  const purposePattern = /^\|\s*`([a-z][a-z0-9_]*)`/gm
  let match: RegExpExecArray | null

  while ((match = purposePattern.exec(section)) !== null) {
    const key = match[1]
    // Skip core_ purposes — they are contract-basis, not consent-basis.
    if (!key.startsWith('core_')) {
      keys.add(key)
    }
  }

  return keys
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('E119-S07 AC-6: consent-inventory.md ↔ CONSENT_PURPOSES parity', () => {
  const inventoryPath = resolve(
    __dirname,
    '../../../../docs/compliance/consent-inventory.md',
  )

  let inventoryKeys: Set<string>
  let serviceKeys: Set<string>

  beforeAll(() => {
    expect(existsSync(inventoryPath)).toBe(true)
    const markdown = readFileSync(inventoryPath, 'utf-8')
    inventoryKeys = parseInventoryPurposeKeys(markdown)
    serviceKeys = new Set(Object.values(CONSENT_PURPOSES))
  })

  it('inventory contains at least the 5 required consent purposes (AC-2)', () => {
    const required = [
      'ai_tutor',
      'ai_embeddings',
      'voice_transcription',
      'analytics_telemetry',
      'marketing_email',
    ]
    for (const key of required) {
      expect(inventoryKeys.has(key)).toBe(true)
    }
  })

  it('every inventory consent purpose exists in CONSENT_PURPOSES enum', () => {
    const missing: string[] = []
    for (const key of inventoryKeys) {
      if (!serviceKeys.has(key)) {
        missing.push(key)
      }
    }
    expect(missing).toEqual([])
  })

  it('every CONSENT_PURPOSES enum value exists in the inventory', () => {
    const missing: string[] = []
    for (const key of serviceKeys) {
      if (!inventoryKeys.has(key)) {
        missing.push(key)
      }
    }
    expect(missing).toEqual([])
  })

  it('inventory and CONSENT_PURPOSES have the same number of consent purposes', () => {
    expect(inventoryKeys.size).toBe(serviceKeys.size)
  })
})
