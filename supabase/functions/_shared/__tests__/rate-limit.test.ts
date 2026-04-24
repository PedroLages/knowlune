import {
  assertEquals,
  assertStrictEquals,
} from 'jsr:@std/assert'
import { checkRateLimit, rateLimitHeaders } from '../rate-limit.ts'

const SUPABASE_URL = 'https://test.supabase.co'
const SERVICE_ROLE_KEY = 'test-service-role-key'
const USER_ID = '11111111-1111-1111-1111-111111111111'

type FetchImpl = typeof fetch

/** Install a mock fetch for the duration of `fn`. */
async function withFetch(
  mock: FetchImpl,
  fn: () => Promise<void>
): Promise<void> {
  const original = globalThis.fetch
  globalThis.fetch = mock
  try {
    await fn()
  } finally {
    globalThis.fetch = original
  }
}

/** Mock that returns sequential integer counts for each RPC call. */
function countingFetch(): FetchImpl {
  let count = 0
  return ((_input: RequestInfo | URL, _init?: RequestInit) => {
    count += 1
    return Promise.resolve(
      new Response(JSON.stringify(count), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }) as FetchImpl
}

Deno.test('free tier: 1st-5th allowed, 6th denied, remaining decrements', async () => {
  await withFetch(countingFetch(), async () => {
    const expectedRemaining = [4, 3, 2, 1, 0, 0]
    for (let i = 1; i <= 6; i++) {
      const r = await checkRateLimit({
        userId: USER_ID,
        tier: 'free',
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
      })
      assertEquals(r.limit, 5)
      assertEquals(r.remaining, expectedRemaining[i - 1], `req ${i} remaining`)
      if (i <= 5) {
        assertStrictEquals(r.allowed, true, `req ${i} should be allowed`)
        assertStrictEquals(r.retryAfter, undefined)
      } else {
        assertStrictEquals(r.allowed, false, 'req 6 should be denied')
        assertEquals(typeof r.retryAfter, 'number')
        assertStrictEquals(r.retryAfter, r.resetInSeconds)
      }
    }
  })
})

Deno.test('premium tier: 15th allowed, 16th denied', async () => {
  await withFetch(countingFetch(), async () => {
    let last
    for (let i = 1; i <= 16; i++) {
      last = await checkRateLimit({
        userId: USER_ID,
        tier: 'premium',
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
      })
      if (i === 15) assertStrictEquals(last.allowed, true, '15th allowed')
    }
    assertStrictEquals(last!.allowed, false, '16th denied')
    assertEquals(last!.limit, 15)
  })
})

Deno.test('byok tier: 30th allowed, 31st denied', async () => {
  await withFetch(countingFetch(), async () => {
    let last
    for (let i = 1; i <= 31; i++) {
      last = await checkRateLimit({
        userId: USER_ID,
        tier: 'byok',
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
      })
      if (i === 30) assertStrictEquals(last.allowed, true, '30th allowed')
    }
    assertStrictEquals(last!.allowed, false, '31st denied')
    assertEquals(last!.limit, 30)
  })
})

Deno.test('DB error (non-OK response): fails open', async () => {
  const mock: FetchImpl = () =>
    Promise.resolve(new Response('boom', { status: 500 }))
  await withFetch(mock, async () => {
    const r = await checkRateLimit({
      userId: USER_ID,
      tier: 'free',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
    })
    assertStrictEquals(r.allowed, true)
    assertEquals(r.limit, 5)
    assertEquals(r.remaining, 5)
    // Headers should still serialize cleanly.
    const h = rateLimitHeaders(r)
    assertEquals(h['X-RateLimit-Limit'], '5')
    assertEquals(h['X-RateLimit-Remaining'], '5')
    assertEquals(h['Retry-After'], undefined)
  })
})

Deno.test('network/timeout: fails open', async () => {
  const mock: FetchImpl = () => Promise.reject(new Error('network down'))
  await withFetch(mock, async () => {
    const r = await checkRateLimit({
      userId: USER_ID,
      tier: 'premium',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
    })
    assertStrictEquals(r.allowed, true)
    assertEquals(r.remaining, 15)
  })
})

Deno.test('rateLimitHeaders: shape on allowed and denied', () => {
  const allowed = rateLimitHeaders({
    allowed: true,
    limit: 5,
    remaining: 3,
    resetInSeconds: 42,
  })
  assertEquals(allowed, {
    'X-RateLimit-Limit': '5',
    'X-RateLimit-Remaining': '3',
    'X-RateLimit-Reset': '42',
  })

  const denied = rateLimitHeaders({
    allowed: false,
    limit: 5,
    remaining: 0,
    resetInSeconds: 17,
    retryAfter: 17,
  })
  assertEquals(denied, {
    'X-RateLimit-Limit': '5',
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': '17',
    'Retry-After': '17',
  })
})

Deno.test('window boundary: counter resets when clock crosses window', async () => {
  // Fake Date.now. Start inside one 60s window, then jump to the next.
  const originalNow = Date.now
  // Pick an arbitrary epoch ms aligned to a window boundary, then +1s.
  const windowMs = 60_000
  const base = Math.floor(1_700_000_000_000 / windowMs) * windowMs
  let current = base + 1_000

  // Separate counters per (bucket_key, window_start) to emulate DB behavior.
  const counters = new Map<string, number>()
  const mock: FetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'))
    const key = `${body.p_bucket_key}|${body.p_window_start}`
    const next = (counters.get(key) ?? 0) + 1
    counters.set(key, next)
    return Promise.resolve(
      new Response(JSON.stringify(next), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  }) as FetchImpl

  Date.now = () => current
  try {
    await withFetch(mock, async () => {
      // Exhaust the free-tier window.
      for (let i = 0; i < 5; i++) {
        const r = await checkRateLimit({
          userId: USER_ID,
          tier: 'free',
          supabaseUrl: SUPABASE_URL,
          serviceRoleKey: SERVICE_ROLE_KEY,
        })
        assertStrictEquals(r.allowed, true, `in-window req ${i + 1}`)
      }
      // 6th in same window -> denied
      const denied = await checkRateLimit({
        userId: USER_ID,
        tier: 'free',
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
      })
      assertStrictEquals(denied.allowed, false)

      // Jump to the next window.
      current = base + windowMs + 1_000
      const afterBoundary = await checkRateLimit({
        userId: USER_ID,
        tier: 'free',
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
      })
      assertStrictEquals(afterBoundary.allowed, true, 'new window allows again')
      assertEquals(afterBoundary.remaining, 4)
    })
  } finally {
    Date.now = originalNow
  }
})
