#!/usr/bin/env node
/**
 * ack-rate-report.ts — E119-S13 (AC-5)
 *
 * Read-only CLI script that reports the notice acknowledgement rate for the
 * current notice version. Intended to run weekly during the 30-day beta window.
 *
 * Usage:
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<service-role-key> \
 *     npx tsx scripts/compliance/ack-rate-report.ts
 *
 * Exit codes:
 *   0 — Report generated (even if ack rate < 95%)
 *   1 — Configuration error or unrecoverable Supabase error
 *
 * Target: ≥ 95% acknowledgement within 30 days of version bump.
 * Below 95%: a warning is printed; send follow-up emails per annual-review.md.
 */

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Bootstrap: resolve repo root
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const repoRoot = resolve(__filename, '../../..')

// ---------------------------------------------------------------------------
// Import CURRENT_NOTICE_VERSION from the compiled TypeScript source
// ---------------------------------------------------------------------------

const { CURRENT_NOTICE_VERSION } = (await import(
  resolve(repoRoot, 'src/lib/compliance/noticeVersion.ts')
)) as { CURRENT_NOTICE_VERSION: string }

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
  console.error(
    '[ack-rate-report] ERROR: SUPABASE_URL environment variable is not set.\n' +
      '  Usage: SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<service-role-key> npx tsx scripts/compliance/ack-rate-report.ts',
  )
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error(
    '[ack-rate-report] ERROR: SUPABASE_SERVICE_KEY environment variable is not set.\n' +
      '  A service-role key is required to read the auth.users list.\n' +
      '  Usage: SUPABASE_URL=<url> SUPABASE_SERVICE_KEY=<service-role-key> npx tsx scripts/compliance/ack-rate-report.ts',
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Supabase helpers (raw fetch — no SDK dependency in scripts)
// ---------------------------------------------------------------------------

/** Headers for Supabase REST API calls with service role. */
function supabaseHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_KEY!,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  }
}

/** Fetch all rows from notice_acknowledgements for the current version. */
async function fetchAckedUserIds(version: string): Promise<string[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/notice_acknowledgements`)
  url.searchParams.set('select', 'user_id')
  url.searchParams.set('version', `eq.${version}`)

  const res = await fetch(url.toString(), {
    headers: {
      ...supabaseHeaders(),
      Prefer: 'count=exact',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[ack-rate-report] ERROR: Failed to fetch notice_acknowledgements: ${text}`)
    process.exit(1)
  }

  const rows = (await res.json()) as Array<{ user_id: string }>
  // Deduplicate — a user may have multiple ack rows if they acknowledged multiple times.
  const seen = new Set<string>()
  for (const row of rows) {
    seen.add(row.user_id)
  }
  return [...seen]
}

/** Fetch all auth user IDs with pagination (100 per page). */
async function fetchAllAuthUserIds(): Promise<string[]> {
  const userIds: string[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const url = new URL(`${SUPABASE_URL}/auth/v1/admin/users`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', String(perPage))

    const res = await fetch(url.toString(), {
      headers: supabaseHeaders(),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[ack-rate-report] ERROR: Failed to fetch auth users (page ${page}): ${text}`)
      process.exit(1)
    }

    const body = (await res.json()) as {
      users?: Array<{ id: string }>
      // Supabase admin API returns { users: [...] } with a total count in headers
    }

    const users = body.users ?? []
    for (const u of users) {
      userIds.push(u.id)
    }

    if (users.length < perPage) {
      // Last page
      break
    }

    page++
  }

  return userIds
}

// ---------------------------------------------------------------------------
// Main report
// ---------------------------------------------------------------------------

console.log('\n[ack-rate-report] Notice acknowledgement rate\n')
console.log(`Version:    ${CURRENT_NOTICE_VERSION}`)

let ackedUserIds: string[]
let allUserIds: string[]

try {
  ;[ackedUserIds, allUserIds] = await Promise.all([
    fetchAckedUserIds(CURRENT_NOTICE_VERSION),
    fetchAllAuthUserIds(),
  ])
} catch (err) {
  // silent-catch-ok — CLI script; error logged to stderr above (process.exit already called)
  console.error('[ack-rate-report] Unexpected error:', err)
  process.exit(1)
}

const totalUsers = allUserIds.length
const ackedCount = ackedUserIds.length
const ackPct = totalUsers === 0 ? 100 : Math.round((ackedCount / totalUsers) * 100)

const ackedSet = new Set(ackedUserIds)
const unackedUserIds = allUserIds.filter(id => !ackedSet.has(id))

console.log(`Total users:      ${totalUsers}`)
console.log(`Acknowledged:     ${ackedCount} (${ackPct}%)`)
console.log(`Unacknowledged:   ${unackedUserIds.length}`)

if (ackPct < 95) {
  console.log(
    `\n[WARN] Ack rate (${ackPct}%) is below the 95% target.\n` +
      `       Review unacked user list and send follow-up email per docs/compliance/annual-review.md.\n`,
  )
} else {
  console.log(`\n[OK] Ack rate meets the ≥ 95% target.\n`)
}

if (unackedUserIds.length > 0) {
  console.log('Unacknowledged user IDs:')
  for (const id of unackedUserIds) {
    console.log(`  - ${id}`)
  }
  console.log()
}

// Always exit 0 — this is a reporting tool, not a CI gate.
process.exit(0)
