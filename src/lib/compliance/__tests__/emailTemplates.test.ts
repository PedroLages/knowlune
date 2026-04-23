import { describe, it, expect } from 'vitest'
import { deletionScheduledEmail, deletionCompleteEmail } from '../emailTemplates'

describe('deletionScheduledEmail', () => {
  it('returns the expected subject mentioning "scheduled"', () => {
    const result = deletionScheduledEmail('https://example.com/cancel')
    expect(result.subject).toContain('scheduled')
  })

  it('includes the cancel URL in the HTML output', () => {
    const cancelUrl = 'https://example.com/cancel'
    const result = deletionScheduledEmail(cancelUrl)
    expect(result.html).toContain(cancelUrl)
  })

  it('includes the cancel URL in the plain-text output', () => {
    const cancelUrl = 'https://example.com/cancel'
    const result = deletionScheduledEmail(cancelUrl)
    expect(result.text).toContain(cancelUrl)
  })

  it('returns non-empty subject, html, and text', () => {
    const result = deletionScheduledEmail('https://example.com/cancel')
    expect(result.subject.length).toBeGreaterThan(0)
    expect(result.html.length).toBeGreaterThan(0)
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('plain-text contains no HTML tags', () => {
    const result = deletionScheduledEmail('https://example.com/cancel')
    expect(result.text).not.toMatch(/<[^>]+>/)
  })

  it('handles a cancel URL with special characters without double-encoding', () => {
    const cancelUrl = 'https://example.com/cancel?token=abc&foo=bar'
    const result = deletionScheduledEmail(cancelUrl)
    // URL must appear verbatim — not HTML-entity encoded
    expect(result.html).toContain(cancelUrl)
    expect(result.text).toContain(cancelUrl)
  })

  it('returns an object with exactly subject, html, and text keys', () => {
    const result = deletionScheduledEmail('https://example.com/cancel')
    expect(Object.keys(result).sort()).toEqual(['html', 'subject', 'text'])
  })
})

describe('deletionCompleteEmail', () => {
  it('returns the expected subject mentioning "deleted"', () => {
    const result = deletionCompleteEmail()
    expect(result.subject).toContain('deleted')
  })

  it('returns non-empty html', () => {
    const result = deletionCompleteEmail()
    expect(result.html.length).toBeGreaterThan(0)
  })

  it('returns non-empty plain-text', () => {
    const result = deletionCompleteEmail()
    expect(result.text.length).toBeGreaterThan(0)
  })

  it('plain-text contains no HTML tags', () => {
    const result = deletionCompleteEmail()
    expect(result.text).not.toMatch(/<[^>]+>/)
  })

  it('HTML mentions permanent deletion', () => {
    const result = deletionCompleteEmail()
    expect(result.html.toLowerCase()).toContain('deleted')
  })

  it('returns an object with exactly subject, html, and text keys', () => {
    const result = deletionCompleteEmail()
    expect(Object.keys(result).sort()).toEqual(['html', 'subject', 'text'])
  })
})
