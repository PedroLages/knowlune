/**
 * useNoticeAcknowledgement — E119-S02 (AC-4)
 *
 * Queries the user's latest privacy-notice acknowledgement and compares it
 * against CURRENT_NOTICE_VERSION to determine whether a re-acknowledgement
 * is required.
 *
 * Returns:
 *   acknowledged - true when the user has acked the current version
 *   stale        - true when the user has acked an older version
 *   staleDays    - days since the current notice release date (used for the
 *                  30-day soft-block threshold)
 *   refetch      - re-runs the query (call after writing a new ack row)
 *
 * Fail-open contract:
 *   - Unauthenticated users → acknowledged:true, stale:false (no gate for guests)
 *   - Supabase null          → acknowledged:true, stale:false (graceful fallback)
 *   - Query error            → logs warning, returns acknowledged:true, stale:false
 *     (prevents locking out users during transient Supabase failures)
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { supabase } from '@/lib/auth/supabase'
import {
  CURRENT_NOTICE_VERSION,
  NOTICE_DOCUMENT_ID,
  parseNoticeVersion,
} from '@/lib/compliance/noticeVersion'

export interface NoticeAcknowledgementState {
  acknowledged: boolean
  stale: boolean
  staleDays: number
  refetch: () => void
}

/** Days since the current notice release date (calculated from CURRENT_NOTICE_VERSION). */
function computeStaleDays(): number {
  const { isoDate } = parseNoticeVersion(CURRENT_NOTICE_VERSION)
  const releaseMs = Date.parse(isoDate)
  return Math.floor((Date.now() - releaseMs) / 86_400_000)
}

/** Safe fallback returned when we cannot determine ack status. */
const FAIL_OPEN: Omit<NoticeAcknowledgementState, 'refetch'> = {
  acknowledged: true,
  stale: false,
  staleDays: 0,
}

export function useNoticeAcknowledgement(): NoticeAcknowledgementState {
  const user = useAuthStore(s => s.user)

  const [state, setState] = useState<Omit<NoticeAcknowledgementState, 'refetch'>>(FAIL_OPEN)
  const [fetchTrigger, setFetchTrigger] = useState(0)

  const refetch = useCallback(() => {
    setFetchTrigger(t => t + 1)
  }, [])

  useEffect(() => {
    // No gate for unauthenticated users.
    if (!user) {
      setState(FAIL_OPEN)
      return
    }

    // Graceful fallback when Supabase is not configured.
    if (!supabase) {
      setState(FAIL_OPEN)
      return
    }

    let mounted = true

    async function fetchLatestAck() {
      try {
        if (!supabase) return // satisfy TS narrowing

        const { data, error } = await supabase
          .from('notice_acknowledgements')
          .select('version')
          .eq('document_id', NOTICE_DOCUMENT_ID)
          .order('acknowledged_at', { ascending: false })
          .limit(1)

        if (!mounted) return

        if (error) {
          console.warn('[useNoticeAcknowledgement] Query failed — failing open:', error.message)
          setState(FAIL_OPEN)
          return
        }

        const latestVersion = data?.[0]?.version ?? null
        const staleDays = computeStaleDays()

        if (latestVersion === CURRENT_NOTICE_VERSION) {
          // User has acknowledged the current version.
          setState({ acknowledged: true, stale: false, staleDays })
        } else if (latestVersion !== null) {
          // User has acknowledged an older version.
          setState({ acknowledged: false, stale: true, staleDays })
        } else {
          // No ack record at all (new user who hasn't completed signup ack, or
          // a user who signed up via OAuth before this feature was launched).
          setState({ acknowledged: false, stale: false, staleDays })
        }
      } catch (err) {
        if (!mounted) return
        // silent-catch-ok: fail-open on read errors — console.warn is
        // the appropriate feedback for a background query failure.
        // Surfacing a toast here would be noisy and alarming for a
        // transient network error that doesn't affect core functionality.
        console.warn('[useNoticeAcknowledgement] Unexpected error — failing open:', err)
        setState(FAIL_OPEN)
      }
    }

    fetchLatestAck()

    return () => {
      mounted = false
    }
  }, [user?.id, fetchTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, refetch }
}
