/**
 * Drift test: asserts that PrivacyPolicy.tsx renders content that mirrors
 * the canonical docs/compliance/privacy-notice.md source of truth.
 *
 * Strategy: render the component, extract textContent, and assert that a
 * curated set of legally significant phrases from the canonical document
 * are present in the rendered output. This catches meaningful content drift
 * without being brittle to whitespace or JSX entity encoding differences.
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { PrivacyPolicy } from '../PrivacyPolicy'
import {
  CURRENT_NOTICE_VERSION,
  formatNoticeEffectiveDate,
} from '@/lib/compliance/noticeVersion'

// ---------------------------------------------------------------------------
// Canonical phrases — derived from docs/compliance/privacy-notice.md.
// These are legally significant terms that MUST appear in the rendered notice.
// Update this list only when the canonical document is intentionally updated.
// ---------------------------------------------------------------------------
const CANONICAL_PHRASES = [
  'supervisory authority',
  'Supabase',
  'Stripe',
  'Lawful Basis',
  'right to be forgotten',
  'AI Processing',
  'privacy@knowlune.com',
  'WebLLM',
  'Ollama',
  'Data portability',
]

describe('PrivacyPolicy — canonical notice sync', () => {
  function renderPrivacyPolicy(): string {
    const { container } = render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    )
    return container.textContent ?? ''
  }

  it('renders all canonically required phrases', () => {
    const text = renderPrivacyPolicy()
    for (const phrase of CANONICAL_PHRASES) {
      expect(text, `Expected rendered policy to contain "${phrase}"`).toContain(phrase)
    }
  })

  it('displays the effective date from noticeVersion constants', () => {
    const text = renderPrivacyPolicy()
    const expectedDate = formatNoticeEffectiveDate(CURRENT_NOTICE_VERSION)
    expect(text).toContain(expectedDate)
  })

  it('renders the current version number', () => {
    const text = renderPrivacyPolicy()
    expect(text).toContain(CURRENT_NOTICE_VERSION)
  })

  it('CURRENT_NOTICE_VERSION matches required YYYY-MM-DD.N format', () => {
    expect(CURRENT_NOTICE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/)
  })

  it('canonical source document exists on disk with expected content', () => {
    // Verify the source-of-truth document is present and contains key Art 13 headings.
    // This test runs in Node context where fs is available.
    const noticeFilePath = resolve(process.cwd(), 'docs/compliance/privacy-notice.md')
    const noticeContent = readFileSync(noticeFilePath, 'utf-8')

    expect(noticeContent).toContain('supervisory authority')
    expect(noticeContent).toContain('Lawful Basis')
    expect(noticeContent).toContain('Supabase')
    expect(noticeContent).toContain('Stripe')
    expect(noticeContent).toContain('AI Processing')
    expect(noticeContent).toContain('privacy@knowlune.com')
  })
})
