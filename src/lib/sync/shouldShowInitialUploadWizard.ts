/**
 * E97-S03: Detection helper for the Initial Upload Wizard.
 *
 * Pure read-only predicate answering "should the wizard appear for this user
 * on this device?" Used by App.tsx to gate mounting of `InitialUploadWizard`.
 *
 * Truth table:
 *   - Completion flag already set → false (no flag write).
 *   - Otherwise: pending syncQueue entries OR unlinked records present → true.
 *   - Otherwise: DB is fully synced → write completion flag and return false
 *     (short-circuits future calls, per planning decision §7 Q1).
 *
 * Dexie read errors propagate to the caller. The caller should default to a
 * safe `false` on failure — showing the wizard mid-error is worse than hiding
 * it until the next sign-in.
 *
 * @see docs/plans/2026-04-19-024-feat-e97-s03-initial-upload-wizard-plan.md
 * @since E97-S03
 */
import { db } from '@/db'
import { hasUnlinkedRecords } from './hasUnlinkedRecords'

export const WIZARD_COMPLETE_PREFIX = 'sync:wizard:complete:'
export const WIZARD_DISMISSED_PREFIX = 'sync:wizard:dismissed:'

export function wizardCompleteKey(userId: string): string {
  return `${WIZARD_COMPLETE_PREFIX}${userId}`
}

export function wizardDismissedKey(userId: string): string {
  return `${WIZARD_DISMISSED_PREFIX}${userId}`
}

/**
 * Returns `true` when the wizard should be mounted for `userId` on this device.
 * Writes the completion flag as a side effect only on the "empty + unset"
 * branch (see module doc).
 */
export async function shouldShowInitialUploadWizard(userId: string): Promise<boolean> {
  if (!userId) return false

  const completeKey = wizardCompleteKey(userId)
  if (localStorage.getItem(completeKey) !== null) {
    return false
  }

  // Session-scoped dismissal: if the user clicked "Skip for now" in this
  // session, do not re-prompt until they sign out and back in (which clears
  // this flag in useAuthLifecycle) or complete the upload.
  if (localStorage.getItem(wizardDismissedKey(userId)) !== null) {
    return false
  }

  const pendingCount = await db.syncQueue.where('status').equals('pending').count()
  if (pendingCount > 0) {
    return true
  }

  const unlinked = await hasUnlinkedRecords(userId)
  if (unlinked) {
    return true
  }

  // Fully synced + flag not set: short-circuit future calls.
  localStorage.setItem(completeKey, new Date().toISOString())
  return false
}
