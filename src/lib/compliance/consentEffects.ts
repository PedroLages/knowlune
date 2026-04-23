/**
 * Consent Effects — E119-S08
 *
 * Provides `grantConsent` and `withdrawConsent` functions that atomically
 * write consent state to Dexie and apply per-purpose data effects.
 *
 * Atomicity contract (withdrawConsent):
 *   1. Write withdrawnAt to Dexie via syncableWrite (persists intent).
 *   2. Run the purpose-specific effect.
 *   3. On any effect error: rollback (clear withdrawnAt) and return { success: false }.
 *   Never leave consent=off with effects=incomplete.
 *
 * The device's IndexedDB is scoped to the signed-in user, so bulk deletes
 * (embeddings, aiUsageEvents) need not filter by userId — all rows belong
 * to the current user. This is an explicit design choice; see consent-inventory.md.
 */

import { db } from '@/db/schema'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import { CURRENT_NOTICE_VERSION } from '@/lib/compliance/noticeVersion'
import { CONSENT_PURPOSES, type ConsentPurpose } from '@/lib/compliance/consentService'
import { abortAllInFlightAIRequests } from '@/ai/lib/inFlightRegistry'

// ---------------------------------------------------------------------------
// Purpose metadata
// ---------------------------------------------------------------------------

/**
 * Human-readable metadata for each consent purpose, sourced from
 * docs/compliance/consent-inventory.md. Used by the Privacy UI to
 * display purpose copy, data categories, and withdrawal effects.
 */
export const CONSENT_PURPOSE_META: Record<
  ConsentPurpose,
  {
    label: string
    description: string
    dataCategories: string
    withdrawalCopy: string
  }
> = {
  ai_tutor: {
    label: 'AI Tutor',
    description:
      'Send learning content to an AI model to generate explanations, quizzes, and study suggestions.',
    dataCategories: 'Course content, notes, question text',
    withdrawalCopy:
      'In-flight AI requests will be cancelled. No historical data is deleted (your notes remain).',
  },
  ai_embeddings: {
    label: 'AI Embeddings',
    description:
      'Generate vector embeddings of your notes and highlights for semantic search and recommendations.',
    dataCategories: 'Notes, bookmarks, highlights (text fragments)',
    withdrawalCopy:
      'All embedding data will be deleted. Semantic search and personalised recommendations will stop. Your learner profile will be frozen until you re-enable this.',
  },
  voice_transcription: {
    label: 'Voice Transcription',
    description: 'Transcribe audio recordings to text.',
    dataCategories: 'Voice recordings, transcription text',
    withdrawalCopy:
      'Voice transcription will stop. Past transcripts are kept as part of your notes.',
  },
  analytics_telemetry: {
    label: 'Analytics & Telemetry',
    description:
      'Collect anonymised usage events for product improvement. No personal information is included.',
    dataCategories: 'Anonymised interaction events, session metadata',
    withdrawalCopy: 'All analytics data on this device will be deleted.',
  },
  marketing_email: {
    label: 'Marketing Emails',
    description: 'Receive product announcements, tips, and promotional emails.',
    dataCategories: 'Email address, first name',
    withdrawalCopy: 'You will be unsubscribed from all marketing communications.',
  },
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface ConsentOperationResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Grant consent
// ---------------------------------------------------------------------------

/**
 * Grant consent for a purpose.
 *
 * Upserts a userConsents row with grantedAt=now, withdrawnAt=null,
 * noticeVersion=CURRENT_NOTICE_VERSION.
 * Idempotent: re-granting updates grantedAt and clears withdrawnAt.
 *
 * The `evidence` parameter is merged with any existing evidence so that
 * provider-specific metadata (e.g. `{ provider_id: 'openai' }`) added by
 * E119-S09's re-consent flow is captured without overwriting unrelated fields.
 *
 * @param userId    Supabase auth user UUID
 * @param purpose   One of the CONSENT_PURPOSES values
 * @param evidence  Optional additional evidence fields to merge (E119-S09: provider_id)
 */
export async function grantConsent(
  userId: string,
  purpose: ConsentPurpose,
  evidence?: Record<string, unknown>,
): Promise<ConsentOperationResult> {
  const now = new Date().toISOString()
  try {
    const rows = await db.userConsents.where('userId').equals(userId).toArray()
    const existing = rows.find(r => r.purpose === purpose)

    const record = {
      id: existing?.id ?? crypto.randomUUID(),
      userId,
      purpose,
      grantedAt: now,
      withdrawnAt: null,
      noticeVersion: CURRENT_NOTICE_VERSION,
      // Merge new evidence fields over existing ones so that a provider_id
      // re-consent call updates provider_id without losing other evidence keys.
      evidence: { ...(existing?.evidence as Record<string, unknown> ?? {}), ...(evidence ?? {}) },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    await syncableWrite('userConsents', 'put', record)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[consentEffects] grantConsent failed for purpose "${purpose}": ${message}`)
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Withdraw consent
// ---------------------------------------------------------------------------

/**
 * Withdraw consent for a purpose, atomically applying the purpose-specific
 * data effects.
 *
 * Atomicity:
 *   - Sets withdrawnAt first (intent persisted).
 *   - Runs effect; on failure, rolls back withdrawnAt.
 *   - Never leaves consent=off with effects=incomplete.
 *
 * @param userId  Supabase auth user UUID
 * @param purpose One of the CONSENT_PURPOSES values
 */
export async function withdrawConsent(
  userId: string,
  purpose: ConsentPurpose,
): Promise<ConsentOperationResult> {
  const now = new Date().toISOString()

  // Step 1: Mark consent withdrawn.
  let consentRecord: import('@/data/types').UserConsent | undefined
  try {
    const rows = await db.userConsents.where('userId').equals(userId).toArray()
    consentRecord = rows.find(r => r.purpose === purpose)

    const record = {
      id: consentRecord?.id ?? crypto.randomUUID(),
      userId,
      purpose,
      grantedAt: consentRecord?.grantedAt ?? null,
      withdrawnAt: now,
      noticeVersion: consentRecord?.noticeVersion ?? CURRENT_NOTICE_VERSION,
      evidence: consentRecord?.evidence ?? {},
      createdAt: consentRecord?.createdAt ?? now,
      updatedAt: now,
    }

    await syncableWrite('userConsents', 'put', record)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `[consentEffects] withdrawConsent: failed to write withdrawnAt for purpose "${purpose}": ${message}`,
    )
    return { success: false, error: message }
  }

  // Step 2: Apply purpose-specific effect.
  try {
    await _applyWithdrawalEffect(userId, purpose)
  } catch (err) {
    // Step 3: Rollback — restore previous state.
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `[consentEffects] withdrawConsent: effect failed for purpose "${purpose}", rolling back: ${message}`,
    )
    try {
      const rollbackRecord = {
        id: consentRecord?.id ?? crypto.randomUUID(),
        userId,
        purpose,
        grantedAt: consentRecord?.grantedAt ?? null,
        withdrawnAt: consentRecord?.withdrawnAt ?? null,
        noticeVersion: consentRecord?.noticeVersion ?? CURRENT_NOTICE_VERSION,
        evidence: consentRecord?.evidence ?? {},
        createdAt: consentRecord?.createdAt ?? now,
        updatedAt: new Date().toISOString(),
      }
      await syncableWrite('userConsents', 'put', rollbackRecord)
    } catch (rollbackErr) {
      console.error(
        `[consentEffects] CRITICAL: rollback also failed for purpose "${purpose}":`,
        rollbackErr,
      )
    }
    return { success: false, error: message }
  }

  return { success: true }
}

// ---------------------------------------------------------------------------
// Per-purpose withdrawal effects (private)
// ---------------------------------------------------------------------------

async function _applyWithdrawalEffect(userId: string, purpose: ConsentPurpose): Promise<void> {
  switch (purpose) {
    case CONSENT_PURPOSES.AI_TUTOR:
      // Cancel any in-flight AI requests (best-effort — hooks may not all be registered).
      abortAllInFlightAIRequests()
      break

    case CONSENT_PURPOSES.AI_EMBEDDINGS:
      await _effectAiEmbeddings(userId)
      break

    case CONSENT_PURPOSES.VOICE_TRANSCRIPTION:
      // No audio job queue exists in the current implementation.
      // Past transcripts are retained as part of the user's notes (by design).
      console.info('[consentEffects] voice_transcription withdrawal: no queue to clear (no-op).')
      break

    case CONSENT_PURPOSES.ANALYTICS_TELEMETRY:
      await _effectAnalyticsTelemetry()
      break

    case CONSENT_PURPOSES.MARKETING_EMAIL:
      // No additional Dexie writes needed beyond the consent row.
      // Server-side webhook propagates the withdrawal to Resend on next sync.
      break

    default:
      console.warn(`[consentEffects] Unknown purpose "${purpose}" in withdrawal effect.`)
  }
}

async function _effectAiEmbeddings(userId: string): Promise<void> {
  // Bulk-delete all embeddings. The device's IndexedDB is user-scoped,
  // so all rows belong to the current user.
  await db.embeddings.clear()

  // Freeze all learner models for this user.
  // Best-effort: failure is logged but does not trigger rollback.
  try {
    const models = await db.learnerModels.where('userId').equals(userId).toArray()
    const frozenModels = models.map(m => ({
      ...m,
      frozenReason: 'consent_withdrawn',
      updatedAt: new Date().toISOString(),
    }))
    if (frozenModels.length > 0) {
      await db.learnerModels.bulkPut(frozenModels)
    }
  } catch (err) {
    console.warn(
      `[consentEffects] ai_embeddings: failed to freeze learner models (non-fatal): ${String(err)}`,
    )
  }
}

async function _effectAnalyticsTelemetry(): Promise<void> {
  // Delete all analytics events. Device-scoped DB — all rows are the current user's.
  await db.aiUsageEvents.clear()
}
