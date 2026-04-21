import { useEffect } from 'react'
import { supabase } from '@/lib/auth/supabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { hydrateSettingsFromSupabase } from '@/lib/settings'
import { observedHydrate } from '@/lib/sync/observedHydrate'
import { useDownloadStatusStore } from '@/app/stores/useDownloadStatusStore'
import { backfillUserId } from '@/lib/sync/backfill'
import { syncEngine } from '@/lib/sync/syncEngine'
import { clearSyncState } from '@/lib/sync/clearSyncState'
import { hasUnlinkedRecords } from '@/lib/sync/hasUnlinkedRecords'
import { credentialCache } from '@/lib/credentials/cache'
import { runCredentialsToVaultMigration } from '@/lib/credentials/migrateCredentialsToVault'

/**
 * E43-S04: Subscribes to Supabase auth state changes and manages session lifecycle.
 *
 * Handles:
 * - SIGNED_IN / INITIAL_SESSION: sets session, hydrates settings from user_metadata,
 *   then either shows the LinkDataDialog (unlinked records detected) or starts sync.
 * - TOKEN_REFRESHED: silently updates session (no UI)
 * - SIGNED_OUT: distinguishes user-initiated vs system-initiated (session expiry);
 *   stops sync engine and clears sync state (queue + cursors).
 *
 * Replaces the useEffect at App.tsx lines 66-79 (E19-S01).
 *
 * @param options.onUnlinkedDetected  Called with the userId when local data exists
 *   that is not linked to the signing-in user. App.tsx shows the LinkDataDialog in
 *   response. syncEngine.start() is deferred until the user resolves the dialog.
 *   If omitted, sync starts immediately (safe default).
 *
 * @see LinkDataDialog  – shown by App.tsx when this callback fires.
 * @since E92-S08
 */

const LINKED_FLAG_PREFIX = 'sync:linked:'
// E97-S03: Session-scoped dismissal flag for the initial upload wizard.
// Cleared on SIGNED_OUT so the wizard reappears for the next session if the
// upload still hasn't completed. The completion flag (sync:wizard:complete:*)
// is permanent per device and is NOT cleared here.
const WIZARD_DISMISSED_PREFIX = 'sync:wizard:dismissed:'

export interface UseAuthLifecycleOptions {
  /** Called with the userId when unlinked local records are detected on sign-in. */
  onUnlinkedDetected?: (userId: string) => void
}

export function useAuthLifecycle({ onUnlinkedDetected }: UseAuthLifecycleOptions = {}): void {
  useEffect(() => {
    if (!supabase) return

    let ignore = false

    /**
     * Core sign-in handler shared by both the onAuthStateChange callback and
     * the getSession() fallback path.
     *
     * 1. Hydrates settings.
     * 2. If the user already linked this device (localStorage flag): start sync + backfill.
     * 3. Otherwise: check for unlinked records.
     *    - Has unlinked → call onUnlinkedDetected; syncEngine.start() deferred.
     *    - No unlinked → backfill (idempotent) + start sync immediately.
     */
    async function handleSignIn(userId: string, userMetadata: Record<string, unknown>) {
      if (ignore) return

      await hydrateSettingsFromSupabase(userMetadata, userId)

      // E96-S02: fan-out hydrate for the 9 P3/P4 LWW Dexie tables. Uses
      // Promise.allSettled internally — per-table failures are logged and
      // swallowed, matching the settings-hydrate error posture.
      // F3 fix: await before syncEngine.start() so download-phase bulkPuts
      // do not race with syncEngine writes (mirrors hydrateSettingsFromSupabase
      // ordering pattern).
      // E97-S04: Wrapped in `observedHydrate` so `useDownloadStatusStore`
      // tracks the lifecycle (`hydrating-p3p4` → `downloading-p0p2`). Hydrator
      // contract unchanged — this wrapper only observes the phase transition
      // and re-throws on rejection so the existing error log still fires.
      await observedHydrate(userId).catch(err => {
        console.error('[useAuthLifecycle] hydrateP3P4FromSupabase failed:', err)
      })

      // E95-S05: one-shot credential-to-vault migration. Runs on every sign-in
      // until it has uploaded every legacy `apiKey` / `auth.password` value
      // and marked itself `done` in `syncMetadata`. Idempotent; safe to await
      // here because collecting & uploading a handful of rows is fast.
      // silent-catch-ok — migration self-heals on next sign-in.
      runCredentialsToVaultMigration().catch(err => {
        console.error('[useAuthLifecycle] runCredentialsToVaultMigration failed:', err)
      })

      // Fast-path: this device already went through the dialog for this userId.
      const alreadyLinked = localStorage.getItem(`${LINKED_FLAG_PREFIX}${userId}`) === 'true'
      if (alreadyLinked) {
        // silent-catch-ok — backfill is idempotent and self-healing.
        backfillUserId(userId).catch(err => {
          console.error('[useAuthLifecycle] backfillUserId (fast-path) failed:', err)
        })
        syncEngine.start(userId).catch(err => {
          console.error('[useAuthLifecycle] syncEngine.start (fast-path) failed:', err)
        })
        return
      }

      // Check whether any local records are not yet linked to this userId.
      let unlinked = false
      try {
        unlinked = await hasUnlinkedRecords(userId)
      } catch (err) {
        // silent-catch-ok: gate is best-effort. On failure, default to showing
        // the dialog so the user can decide — safer than silently overwriting.
        console.error('[useAuthLifecycle] hasUnlinkedRecords failed:', err)
        unlinked = true
      }

      if (ignore) return

      if (unlinked && onUnlinkedDetected) {
        // Defer syncEngine.start() — the dialog handlers (Link / Start fresh)
        // will call it after the user resolves their choice.
        onUnlinkedDetected(userId)
      } else {
        // No unlinked records (or no dialog handler): backfill + start sync now.
        // silent-catch-ok — backfill is self-healing; next sign-in retries.
        backfillUserId(userId).catch(err => {
          console.error('[useAuthLifecycle] backfillUserId failed:', err)
        })
        syncEngine.start(userId).catch(err => {
          console.error('[useAuthLifecycle] syncEngine.start failed:', err)
        })
        // Mark this device as linked so the dialog is not shown again.
        localStorage.setItem(`${LINKED_FLAG_PREFIX}${userId}`, 'true')
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (ignore) return

      const state = useAuthStore.getState()

      if (event === 'SIGNED_OUT') {
        // Distinguish user-initiated sign-out from system-initiated (token expiry)
        if (state._userInitiatedSignOut) {
          // User clicked "Sign out" — no expiry banner, reset flag
          useAuthStore.setState({ _userInitiatedSignOut: false })
        } else {
          // System-initiated (refresh token expired) — show expiry banner
          useAuthStore.setState({ sessionExpired: true })
        }

        // E97-S03: Clear the wizard dismissal flag for the just-signed-out
        // user so the wizard can reappear on the next session (if still
        // needed). Read the id from the store before setSession(null) clears it.
        const signedOutUserId = state.user?.id
        if (signedOutUserId) {
          try {
            localStorage.removeItem(`${WIZARD_DISMISSED_PREFIX}${signedOutUserId}`)
          } catch (err) {
            // silent-catch-ok — dismissal flag cleanup is best-effort; worst
            // case the wizard suppresses once extra on next sign-in.
            console.error('[useAuthLifecycle] dismissal flag cleanup failed:', err)
          }
        }

        // E97-S04: Reset the new-device download lifecycle store so a stale
        // `error` or active phase from a previous user does not bleed into
        // the next sign-in (potentially for a different account).
        try {
          useDownloadStatusStore.getState().reset()
        } catch (err) {
          // silent-catch-ok — store reset is best-effort UI cleanup.
          console.error('[useAuthLifecycle] download store reset failed:', err)
        }

        // Stop sync and discard the in-flight upload queue + download cursors.
        // Local content records (notes, books, etc.) are intentionally kept —
        // the next sign-in will offer the Link/Start-fresh dialog.
        syncEngine.stop()
        // E95-S05: drop cached server/catalog credentials on sign-out. The
        // next authenticated session re-reads them through the vault broker.
        credentialCache.clear()
        clearSyncState().catch(err => {
          // silent-catch-ok: state is best-effort; next sign-in clears again.
          console.error('[useAuthLifecycle] clearSyncState failed:', err)
        })
      }

      // Clear sessionExpired on successful re-authentication
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        state.clearSessionExpired()
        useAuthStore.setState({ _userInitiatedSignOut: false })
      }

      // Always update session state (handles all events including TOKEN_REFRESHED)
      state.setSession(session)

      // Hydrate localStorage settings from Supabase user_metadata on sign-in
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        handleSignIn(session.user.id, session.user.user_metadata ?? {}).catch(err => {
          console.error('[useAuthLifecycle] handleSignIn (onAuthStateChange) failed:', err)
        })
      }
    })

    // Safety net: getSession() reads from localStorage (no network request).
    // Catches sessions established before React mounts (e.g., OAuth redirect
    // where tokens are extracted from URL hash before useEffect runs).
    // IMPORTANT: subscription MUST be established BEFORE getSession() so that
    // any session change during getSession() is not missed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (ignore) return
      const state = useAuthStore.getState()
      state.setSession(session)
      if (session?.user) {
        handleSignIn(session.user.id, session.user.user_metadata ?? {}).catch(err => {
          console.error('[useAuthLifecycle] handleSignIn (getSession) failed:', err)
        })
      }
    })

    // Clean hash fragment after OAuth redirect (cosmetic — Supabase cleanup is unreliable)
    if (window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [onUnlinkedDetected])
}
