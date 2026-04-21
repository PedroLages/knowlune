import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildFeedbackContext,
  buildIssueBody,
  buildIssuePayload,
  buildFallbackText,
  buildMailtoHref,
  submitToGitHub,
  FEEDBACK_FALLBACK_EMAIL,
} from '@/lib/feedbackService'
import type { FeedbackFormFields } from '@/lib/feedbackService'
import type { User } from '@supabase/supabase-js'

// Deterministic date constant per ESLint test-patterns/deterministic-time rule
const FIXED_DATE = new Date('2026-04-21T10:00:00Z')

// Minimal mock user
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: FIXED_DATE.toISOString(),
    ...overrides,
  } as User
}

const bugFields: FeedbackFormFields = {
  mode: 'bug',
  title: 'App crashes on login',
  description: 'The app crashes when I click login',
  stepsToReproduce: '1. Open app\n2. Click login',
}

const feedbackFields: FeedbackFormFields = {
  mode: 'feedback',
  title: 'Dark mode suggestion',
  message: 'Please add a true black dark mode',
}

describe('buildFeedbackContext', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes user id and email when user is provided', () => {
    const user = makeUser()
    const ctx = buildFeedbackContext(user, 'bug')
    expect(ctx.userId).toBe('user-123')
    expect(ctx.email).toBe('test@example.com')
  })

  it('omits userId and email when user is null (unauthenticated)', () => {
    const ctx = buildFeedbackContext(null, 'bug')
    expect(ctx.userId).toBeUndefined()
    expect(ctx.email).toBeUndefined()
  })

  it('includes standard context fields', () => {
    const ctx = buildFeedbackContext(null, 'feedback')
    expect(ctx.url).toBeDefined()
    expect(ctx.version).toBe(__APP_VERSION__)
    expect(ctx.ua).toBeDefined()
    expect(ctx.timestamp).toBe(FIXED_DATE.toISOString())
  })

  it('does not include sentryEventId for feedback mode', () => {
    const ctx = buildFeedbackContext(null, 'feedback')
    expect(ctx.sentryEventId).toBeUndefined()
  })
})

describe('buildIssuePayload', () => {
  const ctx = {
    url: 'https://app.example.com/overview',
    version: '0.0.1',
    ua: 'TestAgent/1.0',
    timestamp: FIXED_DATE.toISOString(),
  }

  it('uses bug + beta-feedback labels for bug mode', () => {
    const payload = buildIssuePayload(bugFields, ctx)
    expect(payload.labels).toEqual(['bug', 'beta-feedback'])
  })

  it('uses enhancement + beta-feedback labels for feedback mode', () => {
    const payload = buildIssuePayload(feedbackFields, ctx)
    expect(payload.labels).toEqual(['enhancement', 'beta-feedback'])
  })

  it('uses issue title from bug report fields', () => {
    const payload = buildIssuePayload(bugFields, ctx)
    expect(payload.title).toBe('App crashes on login')
  })

  it('falls back to "User feedback" when feedback has no title', () => {
    const noTitle: FeedbackFormFields = { mode: 'feedback', message: 'Great app!' }
    const payload = buildIssuePayload(noTitle, ctx)
    expect(payload.title).toBe('User feedback')
  })
})

describe('buildIssueBody', () => {
  const ctx = {
    url: 'https://app.example.com/overview',
    version: '0.0.1',
    ua: 'TestAgent/1.0',
    timestamp: FIXED_DATE.toISOString(),
    sentryEventId: 'sentry-abc-123',
    userId: 'user-123',
    email: 'test@example.com',
  }

  it('includes bug description and steps-to-reproduce', () => {
    const body = buildIssueBody(bugFields, ctx)
    expect(body).toContain('The app crashes when I click login')
    expect(body).toContain('Steps to Reproduce')
    expect(body).toContain('1. Open app')
  })

  it('includes <details> context block', () => {
    const body = buildIssueBody(bugFields, ctx)
    expect(body).toContain('<details>')
    expect(body).toContain('Auto-attached context')
    expect(body).toContain('</details>')
  })

  it('includes sentry event id in context block for bug mode', () => {
    const body = buildIssueBody(bugFields, ctx)
    expect(body).toContain('sentry-abc-123')
  })

  it('omits sentry row when sentryEventId is absent', () => {
    const ctxNoSentry = { ...ctx, sentryEventId: undefined }
    const body = buildIssueBody(bugFields, ctxNoSentry)
    expect(body).not.toContain('Sentry event')
  })

  it('includes feedback message in feedback mode', () => {
    const body = buildIssueBody(feedbackFields, ctx)
    expect(body).toContain('Please add a true black dark mode')
  })

  it('includes all context key fields', () => {
    const body = buildIssueBody(bugFields, ctx)
    expect(body).toContain(ctx.url)
    expect(body).toContain(ctx.version)
    expect(body).toContain(ctx.timestamp)
    expect(body).toContain(ctx.userId)
    expect(body).toContain(ctx.email)
  })
})

describe('buildFallbackText', () => {
  const ctx = {
    url: 'https://app.example.com/overview',
    version: '0.0.1',
    ua: 'TestAgent/1.0',
    timestamp: FIXED_DATE.toISOString(),
  }

  it('is non-empty and includes title, description, and context fields', () => {
    const text = buildFallbackText(bugFields, ctx)
    expect(text).toContain('App crashes on login')
    expect(text).toContain('The app crashes when I click login')
    expect(text).toContain(ctx.url)
    expect(text).toContain(ctx.version)
  })

  it('includes steps-to-reproduce when present', () => {
    const text = buildFallbackText(bugFields, ctx)
    expect(text).toContain('Steps to reproduce')
    expect(text).toContain('1. Open app')
  })

  it('works for feedback mode', () => {
    const text = buildFallbackText(feedbackFields, ctx)
    expect(text).toContain(feedbackFields.message)
    expect(text).toContain(ctx.url)
  })
})

describe('buildMailtoHref', () => {
  it('produces a valid mailto: link with encoded subject and body', () => {
    const href = buildMailtoHref('Bug report', 'Some content')
    expect(href).toMatch(/^mailto:/)
    expect(href).toContain(FEEDBACK_FALLBACK_EMAIL)
    expect(href).toContain('Bug%20report')
    expect(href).toContain('Some%20content')
  })
})

describe('submitToGitHub', () => {
  const payload = { title: 'Test bug', body: 'Some body', labels: ['bug'] }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns ok: true when GitHub responds with 201', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201 } as Response)
    )
    const result = await submitToGitHub(payload, 'token-abc')
    expect(result.ok).toBe(true)
  })

  it('returns ok: false with error message on 4xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 422 } as Response)
    )
    const result = await submitToGitHub(payload, 'token-abc')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('422')
    }
  })

  it('returns ok: false with timeout message on AbortError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
    )
    const result = await submitToGitHub(payload, 'token-abc')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('timed out')
    }
  })

  it('returns ok: false with network message on fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error'))
    )
    const result = await submitToGitHub(payload, 'token-abc')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('reach GitHub')
    }
  })
})
