/**
 * Sub-processor Registry — E119-S12
 *
 * Machine-readable list of all third-party sub-processors used by Knowlune.
 * This is the single source of truth consumed by the CI drift-check script:
 *   scripts/compliance/verify-subprocessors.ts
 *
 * Human-readable counterpart: docs/compliance/subprocessors.md
 *
 * Design invariants:
 *   - Pure module: no Dexie, React, or Zustand imports.
 *   - `packagePatterns`: glob-like strings matched against npm package names.
 *     Use `*` as a wildcard suffix only (e.g. `@supabase/*`).
 *   - `FIRST_PARTY_INFRA`: packages that run entirely on the operator's hardware
 *     or in the user's browser without external data transmission — not sub-processors.
 *   - Add any new external service to this file AND to docs/compliance/subprocessors.md
 *     before shipping the corresponding package to production.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubProcessor {
  /** Display name (matches docs/compliance/subprocessors.md). */
  name: string
  /** Role description — what this processor does for Knowlune. */
  role: string
  /** Link to the DPA or ToS accepted by the operator. */
  dpaUrl: string
  /** Categories of personal data transferred to this processor. */
  dataTransferred: readonly string[]
  /**
   * npm package name patterns that identify this sub-processor.
   * The verify-subprocessors script matches package names against these patterns.
   * Use exact names or trailing wildcard (`@supabase/*`).
   */
  packagePatterns: readonly string[]
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SUBPROCESSOR_REGISTRY: readonly SubProcessor[] = [
  {
    name: 'Supabase',
    role: 'Authentication, cloud database, object storage, real-time sync',
    dpaUrl: 'https://supabase.com/privacy#dpa',
    dataTransferred: [
      'Email address',
      'Password hash',
      'Session tokens',
      'Learning progress records',
      'User-authored content (notes, bookmarks, flashcards)',
      'Vector embeddings',
      'AI conversation history',
      'GDPR export archives',
    ],
    packagePatterns: ['@supabase/*', 'supabase'],
  },
  {
    name: 'Stripe',
    role: 'Payment processing and subscription management',
    dpaUrl: 'https://stripe.com/privacy',
    dataTransferred: ['Billing email', 'Stripe customer ID', 'Subscription status'],
    packagePatterns: ['stripe', '@stripe/*'],
  },
  {
    name: 'Anthropic',
    role: 'AI language model API (Claude) — consent-gated (ai_tutor)',
    dpaUrl: 'https://www.anthropic.com/privacy',
    dataTransferred: ['AI query content (course text, notes, question text) — consent-gated only'],
    packagePatterns: ['@anthropic-ai/*'],
  },
  {
    name: 'OpenAI',
    role: 'AI language model API (GPT) — consent-gated (ai_tutor)',
    dpaUrl: 'https://openai.com/enterprise-privacy',
    dataTransferred: ['AI query content — consent-gated only'],
    packagePatterns: ['openai'],
  },
  {
    name: 'Google (Gemini AI + OAuth)',
    role: 'Gemini AI API (consent-gated) and optional Google OAuth sign-in',
    dpaUrl: 'https://policies.google.com/privacy',
    dataTransferred: [
      'AI query content — consent-gated only',
      'Google account email + identifier (OAuth only)',
    ],
    packagePatterns: ['@ai-sdk/google'],
  },
  {
    name: 'Groq',
    role: 'AI inference API (Llama / Mistral models) — consent-gated (ai_tutor)',
    dpaUrl: 'https://groq.com/privacy-policy/',
    dataTransferred: ['AI query content — consent-gated only'],
    packagePatterns: ['@ai-sdk/groq'],
  },
  {
    name: 'Vercel AI SDK (provider-neutral)',
    role: 'Client-side AI SDK that routes to Anthropic, OpenAI, Google, Groq',
    dpaUrl: 'https://vercel.com/legal/privacy-policy',
    dataTransferred: ['Routing layer only; actual data goes to registered AI sub-processors above'],
    packagePatterns: ['ai', '@ai-sdk/*'],
  },
  {
    name: 'Sentry',
    role: 'Error tracking and performance monitoring (anonymised)',
    dpaUrl: 'https://sentry.io/privacy/',
    dataTransferred: ['Anonymised stack traces', 'Browser/OS metadata', 'Error event metadata'],
    packagePatterns: ['@sentry/*'],
  },
  {
    name: 'Resend',
    role: 'Transactional email delivery (marketing_email consent-gated)',
    dpaUrl: 'https://resend.com/legal/privacy-policy',
    dataTransferred: ['Email address', 'First name'],
    packagePatterns: ['resend'],
  },
]

// ---------------------------------------------------------------------------
// First-party infrastructure (not sub-processors)
// ---------------------------------------------------------------------------

/**
 * npm packages that run entirely on the operator's hardware or in the user's browser.
 * These are excluded from the sub-processor drift-check even if they match an
 * external-service naming pattern.
 */
export const FIRST_PARTY_INFRA: readonly string[] = [
  '@mlc-ai/web-llm', // In-browser WASM AI runtime — no external data transmission
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the SubProcessor entry for a given npm package name, or undefined if
 * the package is not registered as a sub-processor.
 */
export function findSubProcessorForPackage(packageName: string): SubProcessor | undefined {
  return SUBPROCESSOR_REGISTRY.find((sp) =>
    sp.packagePatterns.some((pattern) => {
      if (pattern.endsWith('/*')) {
        const scope = pattern.slice(0, -2) // e.g. "@supabase"
        return packageName.startsWith(scope + '/')
      }
      return packageName === pattern
    }),
  )
}

/**
 * Returns true if the given package is registered as first-party infrastructure
 * and should be excluded from sub-processor checks.
 */
export function isFirstPartyInfra(packageName: string): boolean {
  return (FIRST_PARTY_INFRA as readonly string[]).includes(packageName)
}
