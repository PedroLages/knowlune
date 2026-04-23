/**
 * Consent Service — E119-S07
 *
 * Single gatekeeper for all consent decisions in Knowlune.
 * All AI routing, feature guards, and withdrawal effects MUST call this module
 * rather than querying the database directly.
 *
 * Design invariants:
 *   - Fail-closed: unknown purpose → false + warning log (never open by default)
 *   - Consent state is read from the local Dexie `userConsents` table; the sync
 *     engine (E119-S07 AC-7) keeps this table in sync with Supabase bidirectionally.
 *   - No React or Zustand imports — pure module, safe to use in any context.
 *
 * Purpose enum is the canonical source of truth for valid purpose keys.
 * `docs/compliance/consent-inventory.md` must list every key here (AC-6 parity test).
 */

import { db } from '@/db/schema'
import type { UserConsent } from '@/data/types'

/** Convenience re-export for callers that prefer the old name. */
export type { UserConsent as UserConsentRow } from '@/data/types'

// ---------------------------------------------------------------------------
// Purpose enum
// ---------------------------------------------------------------------------

/**
 * Consent purposes that require explicit user opt-in (lawful basis: consent).
 * Core processing purposes (contract, legitimate_interest) are not listed here
 * because they are not user-controllable.
 *
 * IMPORTANT: Every key here must appear in docs/compliance/consent-inventory.md
 * and vice versa. The parity test in src/lib/compliance/__tests__/consentParity.test.ts
 * enforces this invariant at CI time.
 */
export const CONSENT_PURPOSES = {
  /** Send learning content to AI model for explanations, quizzes, suggestions. */
  AI_TUTOR: 'ai_tutor',
  /** Generate vector embeddings for semantic search and recommendations. */
  AI_EMBEDDINGS: 'ai_embeddings',
  /** Transcribe audio recordings to text. */
  VOICE_TRANSCRIPTION: 'voice_transcription',
  /** Collect anonymised usage events for product improvement. */
  ANALYTICS_TELEMETRY: 'analytics_telemetry',
  /** Send product announcements, tips, and promotional emails. */
  MARKETING_EMAIL: 'marketing_email',
} as const

/** Union type of all valid purpose key values. */
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[keyof typeof CONSENT_PURPOSES]

/** All valid purpose key strings as a Set, for O(1) membership check. */
const VALID_PURPOSES = new Set<string>(Object.values(CONSENT_PURPOSES))

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

/**
 * Consent service interface — injectable for testing.
 */
export interface IConsentService {
  isGranted(userId: string, purpose: string): Promise<boolean>
  listForUser(userId: string): Promise<UserConsent[]>
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Check whether a user has currently granted consent for a given purpose.
 *
 * Fail-closed policy:
 *   - Unknown purpose → false + console.warn (never silently open)
 *   - Database error → false + console.error (never silently open)
 *   - No consent row → false (consent is not assumed)
 *   - Row with withdrawnAt set → false (withdrawn = not consented)
 *   - Row with grantedAt set and withdrawnAt null → true
 *
 * @param userId  Supabase auth user UUID
 * @param purpose One of the CONSENT_PURPOSES values
 * @returns       true if consent is currently granted, false otherwise
 */
export async function isGranted(userId: string, purpose: string): Promise<boolean> {
  if (!VALID_PURPOSES.has(purpose)) {
    console.warn(
      `[consentService] isGranted called with unknown purpose "${purpose}". ` +
        `Failing closed. Valid purposes: ${[...VALID_PURPOSES].join(', ')}`,
    )
    return false
  }

  try {
    const rows = await db.userConsents.where('userId').equals(userId).toArray()
    const row = rows.find(r => r.purpose === purpose)

    if (!row) {
      // No consent record — default is not consented.
      return false
    }

    // Granted if grantedAt is set and withdrawnAt is null.
    return row.grantedAt !== null && row.withdrawnAt === null
  } catch (err) {
    console.error(
      `[consentService] isGranted failed for purpose "${purpose}": ${String(err)}. ` +
        `Failing closed.`,
    )
    return false
  }
}

/**
 * List all consent records for a user.
 * Returns an empty array on error (fail-safe for display purposes).
 *
 * @param userId  Supabase auth user UUID
 * @returns       Array of consent rows (may be empty if no consents recorded)
 */
export async function listForUser(userId: string): Promise<UserConsent[]> {
  try {
    return await db.userConsents.where('userId').equals(userId).toArray()
  } catch (err) {
    console.error(
      `[consentService] listForUser failed for user "${userId}": ${String(err)}`,
    )
    return []
  }
}

/**
 * Check whether consent for a specific purpose has been granted for a given AI provider.
 * Used by E119-S09 provider re-consent flow.
 *
 * Returns false if:
 *   - Purpose consent is not granted (delegates to isGranted)
 *   - Consent was granted for a different provider (triggers re-consent)
 *   - No evidence.provider_id in the consent row (legacy row — requires re-consent)
 *
 * @param userId     Supabase auth user UUID
 * @param purpose    One of the CONSENT_PURPOSES values
 * @param providerId Provider identity key (e.g. 'openai', 'anthropic', 'ollama')
 */
export async function isGrantedForProvider(
  userId: string,
  purpose: string,
  providerId: string,
): Promise<boolean> {
  if (!VALID_PURPOSES.has(purpose)) {
    console.warn(
      `[consentService] isGrantedForProvider called with unknown purpose "${purpose}". Failing closed.`,
    )
    return false
  }

  try {
    const rows = await db.userConsents.where('userId').equals(userId).toArray()
    const row = rows.find(r => r.purpose === purpose)

    if (!row || row.grantedAt === null || row.withdrawnAt !== null) {
      return false
    }

    // If no provider_id recorded in evidence, require re-consent.
    const grantedProvider = (row.evidence as Record<string, unknown>)?.provider_id
    if (!grantedProvider) {
      return false
    }

    return grantedProvider === providerId
  } catch (err) {
    console.error(
      `[consentService] isGrantedForProvider failed: ${String(err)}. Failing closed.`,
    )
    return false
  }
}

/** Default export for convenience imports. */
export const consentService: IConsentService = {
  isGranted,
  listForUser,
}
export default consentService
