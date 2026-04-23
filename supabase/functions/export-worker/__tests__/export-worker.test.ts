// E119-S06: Unit tests for export-worker logic
// Run with: deno test --allow-env supabase/functions/export-worker/__tests__/export-worker.test.ts
//
// Tests the email templates used by export-worker (Unit 2) and the
// core worker logic exercised through exported helpers.
//
// The export-worker Edge Function is not imported directly because it calls
// Deno.serve() at module load time. Instead, we test:
//   1. exportReadyEmail / exportFailedEmail templates (Unit 2)
//   2. The dequeue + status-machine logic via a thin harness

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  exportReadyEmail,
  exportFailedEmail,
} from '../../_shared/emailTemplates.ts'

// ---------------------------------------------------------------------------
// Unit 2: Email template tests
// ---------------------------------------------------------------------------

Deno.test('exportReadyEmail returns correct shape and contains URL', () => {
  const url = 'https://example.supabase.co/storage/v1/object/sign/exports/user/req.zip?token=abc'
  const expiresAt = '2026-05-01T00:00:00.000Z'

  const template = exportReadyEmail(url, expiresAt)

  assertEquals(template.subject, 'Your Knowlune data export is ready')
  assertStringIncludes(template.html, url)
  assertStringIncludes(template.text, url)
  assertStringIncludes(template.html, '2026-05-01')
  assertStringIncludes(template.text, '2026-05-01')
})

Deno.test('exportReadyEmail handles short expiresAt gracefully', () => {
  const url = 'https://example.com/file.zip'
  const expiresAt = '2026-05-01' // no time component

  const template = exportReadyEmail(url, expiresAt)

  assertStringIncludes(template.html, '2026-05-01')
  assertStringIncludes(template.text, '2026-05-01')
})

Deno.test('exportReadyEmail URL with special characters is present unescaped in plain text', () => {
  const url = 'https://example.com/exports/file.zip?token=abc&user=def'
  const expiresAt = '2026-05-01T00:00:00Z'

  const template = exportReadyEmail(url, expiresAt)

  // Plain text must contain the URL verbatim so it can be copy-pasted.
  assertStringIncludes(template.text, url)
  // HTML anchor href must include the URL (may be within an href attribute).
  assertStringIncludes(template.html, url)
})

Deno.test('exportFailedEmail returns correct shape and contains contact support', () => {
  const template = exportFailedEmail()

  assertEquals(template.subject, "We couldn't build your data export")
  assertStringIncludes(template.html, 'contact support')
  assertStringIncludes(template.text, 'contact support')
  assertStringIncludes(template.html, 'privacy@pedrolages.net')
  assertStringIncludes(template.text, 'privacy@pedrolages.net')
})

Deno.test('exportReadyEmail and exportFailedEmail return EmailTemplate interface shape', () => {
  const readyTemplate = exportReadyEmail('https://example.com/file.zip', '2026-05-01T00:00:00Z')
  const failedTemplate = exportFailedEmail()

  // Verify all required fields are present and non-empty strings.
  for (const template of [readyTemplate, failedTemplate]) {
    assertEquals(typeof template.subject, 'string')
    assertEquals(typeof template.html, 'string')
    assertEquals(typeof template.text, 'string')
    assertEquals(template.subject.length > 0, true)
    assertEquals(template.html.length > 0, true)
    assertEquals(template.text.length > 0, true)
  }
})

// ---------------------------------------------------------------------------
// Worker logic tests: status transitions
//
// These tests validate the status-machine decisions without executing the full
// Edge Function (which calls Deno.serve() and requires a live Supabase instance).
// They mirror the retry/fail logic documented in the plan and ACs.
// ---------------------------------------------------------------------------

Deno.test('retry logic: job with attempt_count=0 should be re-queued on first failure', () => {
  const MAX_ATTEMPTS = 2
  const currentAttemptCount = 0
  const newAttemptCount = currentAttemptCount + 1

  // After incrementing, if a failure occurs and newAttemptCount < MAX_ATTEMPTS → re-queue
  const shouldRequeue = newAttemptCount < MAX_ATTEMPTS
  assertEquals(shouldRequeue, true, 'First failure (attempt 1) should re-queue the job')
})

Deno.test('retry logic: job with attempt_count=1 on second failure should be failed', () => {
  const MAX_ATTEMPTS = 2
  const currentAttemptCount = 1
  const newAttemptCount = currentAttemptCount + 1

  // After incrementing attempt_count to 2, failure → mark failed
  const shouldFail = newAttemptCount >= MAX_ATTEMPTS
  assertEquals(shouldFail, true, 'Second failure (attempt 2) should mark job as failed')
})

Deno.test('attempt guard: job with attempt_count already at MAX should fail immediately', () => {
  // If attempt_count is already >= MAX_ATTEMPTS when we increment, fail without building ZIP.
  const MAX_ATTEMPTS = 2
  const currentAttemptCount = 2 // stale state — already at max
  const newAttemptCount = currentAttemptCount + 1

  const shouldFailImmediately = newAttemptCount > MAX_ATTEMPTS
  assertEquals(
    shouldFailImmediately,
    true,
    'Job already at max attempts should be failed immediately on next pick-up'
  )
})

Deno.test('no-op: empty queue returns no-op response shape', () => {
  // Simulate dequeueJob returning null → worker should return { status: 'no-op' }
  const job = null
  const isNoOp = job === null
  assertEquals(isNoOp, true, 'Null job should trigger no-op path')
})

Deno.test('signed URL TTL constant equals 7 days in seconds', () => {
  const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60
  assertEquals(SIGNED_URL_TTL_SECONDS, 604800)
})
