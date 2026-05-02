/**
 * useSoftBlock — E119-S02 (AC-6)
 *
 * Returns true when the user's notice acknowledgement is stale AND more
 * than 30 days have passed since the current notice release date.
 *
 * This is a thin wrapper around useNoticeAcknowledgement. The 30-day
 * window is measured from parseNoticeVersion(CURRENT_NOTICE_VERSION).isoDate
 * — the server-authored release date — not the client clock.
 *
 * Returns false for:
 *   - Unauthenticated users (no gate for guests)
 *   - Users who are acknowledged or within the 30-day grace period
 *   - Supabase not configured (graceful fallback)
 */

import { useNoticeAcknowledgement } from './useNoticeAcknowledgement'

const SOFT_BLOCK_THRESHOLD_DAYS = 30

export function useSoftBlock(): boolean {
  const { stale, staleDays } = useNoticeAcknowledgement()
  return stale && staleDays > SOFT_BLOCK_THRESHOLD_DAYS
}
