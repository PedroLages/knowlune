import { assertEquals } from 'jsr:@std/assert'
import {
  __resetEntitlementCacheForTests,
  isBYOK,
  resolveEntitlement,
} from '../entitlement.ts'

const SUPABASE_URL = 'https://example.supabase.co'
const SERVICE_KEY = 'service-role-key'

const originalFetch = globalThis.fetch

type FetchHandler = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function mockFetch(handler: FetchHandler): { calls: number; restore: () => void } {
  const state = { calls: 0 }
  globalThis.fetch = (async (input, init) => {
    state.calls++
    return await handler(input as string | URL | Request, init)
  }) as typeof fetch
  return {
    get calls() {
      return state.calls
    },
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─────────── isBYOK ───────────

Deno.test('isBYOK: apiKey present → true', () => {
  assertEquals(isBYOK({ apiKey: 'sk-abc123' }), true)
})

Deno.test('isBYOK: ollamaServerUrl present → true', () => {
  assertEquals(isBYOK({ ollamaServerUrl: 'http://localhost:11434' }), true)
})

Deno.test('isBYOK: both present → true', () => {
  assertEquals(
    isBYOK({ apiKey: 'sk-x', ollamaServerUrl: 'http://localhost:11434' }),
    true
  )
})

Deno.test('isBYOK: neither present → false', () => {
  assertEquals(isBYOK({ prompt: 'hi' }), false)
})

Deno.test('isBYOK: empty apiKey → false', () => {
  assertEquals(isBYOK({ apiKey: '' }), false)
})

Deno.test('isBYOK: null body → false', () => {
  assertEquals(isBYOK(null), false)
})

Deno.test('isBYOK: undefined body → false', () => {
  assertEquals(isBYOK(undefined), false)
})

// ─────────── resolveEntitlement ───────────

Deno.test('resolveEntitlement: active premium → premium', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() => Promise.resolve(jsonResponse([{ tier: 'premium' }])))
  try {
    const tier = await resolveEntitlement({
      userId: 'u1',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(tier, 'premium')
  } finally {
    m.restore()
  }
})

Deno.test('resolveEntitlement: active trial → trial', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() => Promise.resolve(jsonResponse([{ tier: 'trial' }])))
  try {
    const tier = await resolveEntitlement({
      userId: 'u2',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(tier, 'trial')
  } finally {
    m.restore()
  }
})

Deno.test('resolveEntitlement: no rows → free', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() => Promise.resolve(jsonResponse([])))
  try {
    const tier = await resolveEntitlement({
      userId: 'u3',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(tier, 'free')
  } finally {
    m.restore()
  }
})

Deno.test('resolveEntitlement: unexpected tier (enterprise) → free', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() =>
    Promise.resolve(jsonResponse([{ tier: 'enterprise' }]))
  )
  try {
    const tier = await resolveEntitlement({
      userId: 'u4',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(tier, 'free')
  } finally {
    m.restore()
  }
})

Deno.test('resolveEntitlement: 500 response → free', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() =>
    Promise.resolve(new Response('boom', { status: 500 }))
  )
  try {
    const tier = await resolveEntitlement({
      userId: 'u5',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(tier, 'free')
  } finally {
    m.restore()
  }
})

Deno.test('resolveEntitlement: network error → free', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() => Promise.reject(new TypeError('network down')))
  try {
    const tier = await resolveEntitlement({
      userId: 'u6',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(tier, 'free')
  } finally {
    m.restore()
  }
})

Deno.test('resolveEntitlement: timeout (AbortError) → free', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() => {
    const err = new DOMException('The signal has been aborted', 'AbortError')
    return Promise.reject(err)
  })
  try {
    const tier = await resolveEntitlement({
      userId: 'u7',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(tier, 'free')
  } finally {
    m.restore()
  }
})

Deno.test('resolveEntitlement: second call within TTL served from cache', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() =>
    Promise.resolve(jsonResponse([{ tier: 'premium' }]))
  )
  try {
    const t1 = await resolveEntitlement({
      userId: 'cache-user',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    const t2 = await resolveEntitlement({
      userId: 'cache-user',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(t1, 'premium')
    assertEquals(t2, 'premium')
    assertEquals(m.calls, 1)
  } finally {
    m.restore()
  }
})

Deno.test('resolveEntitlement: after TTL expires fetch is called again', async () => {
  __resetEntitlementCacheForTests()
  const m = mockFetch(() =>
    Promise.resolve(jsonResponse([{ tier: 'premium' }]))
  )
  const realNow = Date.now
  try {
    let current = 1_000_000_000_000
    Date.now = () => current

    const t1 = await resolveEntitlement({
      userId: 'ttl-user',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(t1, 'premium')
    assertEquals(m.calls, 1)

    // Advance past TTL (5 min + 1s).
    current += 5 * 60 * 1000 + 1000

    const t2 = await resolveEntitlement({
      userId: 'ttl-user',
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_KEY,
    })
    assertEquals(t2, 'premium')
    assertEquals(m.calls, 2)
  } finally {
    Date.now = realNow
    m.restore()
  }
})
