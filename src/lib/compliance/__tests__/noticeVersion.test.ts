import { describe, it, expect } from 'vitest'
import {
  CURRENT_NOTICE_VERSION,
  NOTICE_DOCUMENT_ID,
  parseNoticeVersion,
  formatNoticeEffectiveDate,
} from '../noticeVersion'

describe('CURRENT_NOTICE_VERSION', () => {
  it('matches the required YYYY-MM-DD.N format', () => {
    expect(CURRENT_NOTICE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/)
  })

  it('is a non-empty string', () => {
    expect(typeof CURRENT_NOTICE_VERSION).toBe('string')
    expect(CURRENT_NOTICE_VERSION.length).toBeGreaterThan(0)
  })
})

describe('NOTICE_DOCUMENT_ID', () => {
  it('is "privacy"', () => {
    expect(NOTICE_DOCUMENT_ID).toBe('privacy')
  })
})

describe('parseNoticeVersion', () => {
  it('parses a standard version string', () => {
    expect(parseNoticeVersion('2026-04-23.1')).toEqual({ isoDate: '2026-04-23', revision: 1 })
  })

  it('parses a version with a double-digit revision', () => {
    expect(parseNoticeVersion('2026-12-31.10')).toEqual({ isoDate: '2026-12-31', revision: 10 })
  })

  it('parses revision as an integer', () => {
    const { revision } = parseNoticeVersion('2026-04-23.3')
    expect(typeof revision).toBe('number')
    expect(revision).toBe(3)
  })

  it('throws on invalid format — missing revision', () => {
    expect(() => parseNoticeVersion('2026-04-23')).toThrow(/Invalid notice version format/)
  })

  it('throws on invalid format — bare string', () => {
    expect(() => parseNoticeVersion('invalid')).toThrow(/Invalid notice version format/)
  })

  it('throws on empty string', () => {
    expect(() => parseNoticeVersion('')).toThrow(/Invalid notice version format/)
  })
})

describe('formatNoticeEffectiveDate', () => {
  it('formats a standard version as "Effective YYYY-MM-DD (rev N)"', () => {
    expect(formatNoticeEffectiveDate('2026-04-23.1')).toBe('Effective 2026-04-23 (rev 1)')
  })

  it('formats a version with a double-digit revision', () => {
    expect(formatNoticeEffectiveDate('2026-12-31.10')).toBe('Effective 2026-12-31 (rev 10)')
  })

  it('throws on invalid version string', () => {
    expect(() => formatNoticeEffectiveDate('bad-version')).toThrow(/Invalid notice version format/)
  })
})
