/**
 * Notice acknowledgement write helper — E119-S02
 *
 * Provides the canonical function to persist a privacy-notice acknowledgement
 * row to Supabase. Used by:
 *   - EmailPasswordForm (signup flow, AC-3)
 *   - LegalUpdateBanner re-ack button (AC-5)
 *   - SoftBlockGate CTA (AC-6)
 *
 * Design decisions:
 *   - ip_hash is intentionally NULL (tracked in docs/known-issues.yaml).
 *   - Throws on error so callers can decide whether it is fatal (banner)
 *     or non-fatal (signup — user must still be able to complete signup).
 *   - Guards against null supabase client (non-Supabase deployments).
 */

import { supabase } from '@/lib/auth/supabase'
import { NOTICE_DOCUMENT_ID } from './noticeVersion'

/**
 * Insert a notice acknowledgement row for the currently authenticated user.
 *
 * @param version - The notice version string being acknowledged (e.g. "2026-04-23.1")
 * @throws {Error} if Supabase is not configured or if the insert fails
 */
export async function writeNoticeAck(version: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase not configured — cannot write notice acknowledgement')
  }

  // Resolve the current user's ID. auth.uid() in RLS validates ownership,
  // but the user_id column (NOT NULL, no DEFAULT) must be supplied explicitly.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Cannot write notice acknowledgement — no authenticated user')
  }

  const { error } = await supabase.from('notice_acknowledgements').insert({
    user_id: user.id,
    document_id: NOTICE_DOCUMENT_ID,
    version,
    acknowledged_at: new Date().toISOString(),
    ip_hash: null,
  })

  if (error) {
    throw new Error(`Failed to write notice acknowledgement: ${error.message}`)
  }
}
