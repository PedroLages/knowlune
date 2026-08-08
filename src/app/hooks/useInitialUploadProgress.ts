/**
 * React adapter for the bounded first-upload state owned by syncCoordinator.
 *
 * The coordinator snapshots queue row IDs before it starts uploading. This
 * hook deliberately does not derive progress from the mutable pending count:
 * later writes belong to a separate follow-up phase and cannot make the
 * original progress bar move backwards.
 */
import { useEffect, useState } from 'react'
import {
  syncCoordinator,
  type InitialUploadProgress as CoordinatorInitialUploadProgress,
} from '@/lib/sync/syncCoordinator'

export type InitialUploadProgress = CoordinatorInitialUploadProgress

/**
 * @param userId Retained for the component API; the coordinator is already
 * scoped to the authenticated user by the auth lifecycle.
 * @param enabled Subscribe only while the wizard is visible and uploading.
 */
export function useInitialUploadProgress(userId: string, enabled: boolean): InitialUploadProgress {
  const [progress, setProgress] = useState<InitialUploadProgress>(() =>
    syncCoordinator.getInitialUploadProgress()
  )

  useEffect(() => {
    if (!enabled || !userId) {
      setProgress(syncCoordinator.getInitialUploadProgress())
      return
    }

    setProgress(syncCoordinator.getInitialUploadProgress())
    return syncCoordinator.subscribeInitialUpload(() => {
      setProgress(syncCoordinator.getInitialUploadProgress())
    })
  }, [userId, enabled])

  return progress
}
