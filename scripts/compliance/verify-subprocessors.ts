#!/usr/bin/env node
/**
 * verify-subprocessors.ts — E119-S12
 *
 * CI drift-check: scans package.json for dependencies that match known
 * external-service patterns and verifies each is registered in
 * src/lib/compliance/subprocessorRegistry.ts.
 *
 * Usage:
 *   npx tsx scripts/compliance/verify-subprocessors.ts
 *
 * Exit codes:
 *   0 — All external-service packages are registered
 *   1 — One or more packages are unregistered (CI failure)
 */

import { readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ---------------------------------------------------------------------------
// Bootstrap: resolve repo root and import registry
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const repoRoot = resolve(__filename, '../../..')

// Dynamic import so tsx can handle the TS source directly
const { findSubProcessorForPackage, isFirstPartyInfra } = await import(
  join(repoRoot, 'src/lib/compliance/subprocessorRegistry.ts')
)

// ---------------------------------------------------------------------------
// Heuristics: package scope/name prefixes that indicate external-service packages
// ---------------------------------------------------------------------------

/**
 * These scopes/prefixes are known to be external API clients.
 * Any package matching one of these patterns will be flagged if not registered.
 */
const EXTERNAL_SERVICE_PATTERNS: RegExp[] = [
  /^@supabase\//,
  /^supabase$/,
  /^stripe$/,
  /^@stripe\//,
  /^@anthropic-ai\//,
  /^openai$/,
  /^@openai\//,
  /^@ai-sdk\//,
  /^ai$/, // Vercel AI SDK
  /^@sentry\//,
  /^resend$/,
  /^@resend\//,
  /^@google-cloud\//,
  /^firebase$/,
  /^@firebase\//,
  /^twilio$/,
  /^sendgrid$/,
  /^@sendgrid\//,
  /^mailgun-js$/,
  /^nodemailer$/, // only flag if used with external SMTP
  /^aws-sdk$/,
  /^@aws-sdk\//,
  /^datadog-metrics$/,
  /^dd-trace$/,
  /^newrelic$/,
  /^segment-analytics$/,
  /^analytics-node$/,
  /^mixpanel$/,
  /^posthog-node$/,
  /^@posthog\//,
  /^amplitude$/,
  /^rudder-sdk-node$/,
  /^plaid$/,
  /^braintree$/,
  /^paypal$/,
  /^square$/,
  /^pusher$/,
  /^pusher-js$/,
  /^ably$/,
  /^livekit-server-sdk$/,
  /^@deepgram\//,
  /^elevenlabs$/,
]

// ---------------------------------------------------------------------------
// Load package.json
// ---------------------------------------------------------------------------

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const pkgPath = join(repoRoot, 'package.json')
let pkg: PackageJson

try {
  pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson
} catch (err) {
  // silent-catch-ok — CLI script; error is logged to stderr and process exits non-zero
  console.error(`[verify-subprocessors] Failed to read package.json at ${pkgPath}:`, err)
  process.exit(1)
}

const allDeps = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
}

// ---------------------------------------------------------------------------
// Check each dependency
// ---------------------------------------------------------------------------

const unregistered: string[] = []
const registered: string[] = []
const firstParty: string[] = []
const skipped: string[] = []

for (const pkgName of Object.keys(allDeps)) {
  const matchesExternalPattern = EXTERNAL_SERVICE_PATTERNS.some((re) => re.test(pkgName))

  if (!matchesExternalPattern) {
    skipped.push(pkgName)
    continue
  }

  if (isFirstPartyInfra(pkgName)) {
    firstParty.push(pkgName)
    continue
  }

  const processor = findSubProcessorForPackage(pkgName)
  if (processor) {
    registered.push(`${pkgName} → ${processor.name}`)
  } else {
    unregistered.push(pkgName)
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log('\n[verify-subprocessors] Sub-processor drift check\n')
console.log(`Scanned ${Object.keys(allDeps).length} packages total.`)
console.log(`  External-service pattern matches: ${registered.length + unregistered.length + firstParty.length}`)
console.log(`  Skipped (non-external): ${skipped.length}`)

if (firstParty.length > 0) {
  console.log(`\n[OK] First-party infrastructure (excluded from check):`)
  for (const p of firstParty) {
    console.log(`  - ${p}`)
  }
}

if (registered.length > 0) {
  console.log(`\n[OK] Registered sub-processors:`)
  for (const r of registered) {
    console.log(`  - ${r}`)
  }
}

if (unregistered.length > 0) {
  console.error(`\n[FAIL] Unregistered external-service packages detected:`)
  for (const p of unregistered) {
    console.error(`  [UNLISTED] ${p}`)
  }
  console.error(`
ACTION REQUIRED: Each unregistered package above must be:
  1. Added to src/lib/compliance/subprocessorRegistry.ts (machine-readable)
  2. Added to docs/compliance/subprocessors.md (human-readable)
  3. A DPA or ToS acceptance URL must be recorded

See docs/compliance/subprocessors.md for guidance.
`)
  process.exit(1)
}

console.log('\n[PASS] All external-service packages are registered as sub-processors.\n')
process.exit(0)
