// E119-S04: Unit tests for sendEmail shared helper
// Run with: deno test --allow-env supabase/functions/_shared/__tests__/sendEmail.test.ts
//
// Uses Deno's built-in test runner + stub pattern (no third-party deps).

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

// ---------------------------------------------------------------------------
// Test helpers — minimal stub for globalThis.fetch
// ---------------------------------------------------------------------------

type FetchStub = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function stubFetch(impl: FetchStub) {
  const original = globalThis.fetch
  globalThis.fetch = impl as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

function setEnv(vars: Record<string, string | undefined>) {
  const original: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(vars)) {
    original[key] = Deno.env.get(key)
    if (value === undefined) {
      Deno.env.delete(key)
    } else {
      Deno.env.set(key, value)
    }
  }
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        Deno.env.delete(key)
      } else {
        Deno.env.set(key, value)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('sendEmail: returns { sent: true } when provider returns 200', async () => {
  const restoreEnv = setEnv({
    EMAIL_API_KEY: 'test-key',
    EMAIL_FROM: 'noreply@test.com',
    EMAIL_PROVIDER_URL: 'https://api.example.com/emails',
  })
  const restoreFetch = stubFetch(async () => new Response('{"id":"1"}', { status: 200 }))

  try {
    const { sendEmail } = await import('../sendEmail.ts')
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    })
    assertEquals(result, { sent: true })
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('sendEmail: returns { sent: false, skipped: true } when EMAIL_API_KEY is absent', async () => {
  const restoreEnv = setEnv({
    EMAIL_API_KEY: undefined,
    EMAIL_FROM: 'noreply@test.com',
  })

  try {
    const { sendEmail } = await import('../sendEmail.ts')
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    })
    assertEquals(result, { sent: false, skipped: true })
  } finally {
    restoreEnv()
  }
})

Deno.test('sendEmail: returns { sent: false, skipped: true } when EMAIL_FROM is absent', async () => {
  const restoreEnv = setEnv({
    EMAIL_API_KEY: 'test-key',
    EMAIL_FROM: undefined,
  })

  try {
    const { sendEmail } = await import('../sendEmail.ts')
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    })
    assertEquals(result, { sent: false, skipped: true })
  } finally {
    restoreEnv()
  }
})

Deno.test('sendEmail: returns { sent: false, error } when fetch throws network error', async () => {
  const restoreEnv = setEnv({
    EMAIL_API_KEY: 'test-key',
    EMAIL_FROM: 'noreply@test.com',
    EMAIL_PROVIDER_URL: 'https://api.example.com/emails',
  })
  const restoreFetch = stubFetch(async () => {
    throw new Error('Network unreachable')
  })

  try {
    const { sendEmail } = await import('../sendEmail.ts')
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    })
    assertEquals((result as { sent: false; error: string }).sent, false)
    assertEquals((result as { sent: false; error: string }).error, 'Network unreachable')
  } finally {
    restoreEnv()
    restoreFetch()
  }
})

Deno.test('sendEmail: returns { sent: false, error } when provider returns 4xx', async () => {
  const restoreEnv = setEnv({
    EMAIL_API_KEY: 'test-key',
    EMAIL_FROM: 'noreply@test.com',
    EMAIL_PROVIDER_URL: 'https://api.example.com/emails',
  })
  const restoreFetch = stubFetch(
    async () => new Response('{"error":"invalid_api_key"}', { status: 401, statusText: 'Unauthorized' })
  )

  try {
    const { sendEmail } = await import('../sendEmail.ts')
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    })
    const r = result as { sent: false; error: string }
    assertEquals(r.sent, false)
    // Error contains the HTTP status
    assertEquals(r.error.includes('401'), true)
  } finally {
    restoreEnv()
    restoreFetch()
  }
})
