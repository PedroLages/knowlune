import { useEffect } from 'react'
import type { WorkerRequestType } from '../workers/types'

/**
 * Component-scoped cleanup hook.
 * Logs intended worker cleanup on component unmount.
 * The global coordinator singleton persists for other consumers.
 */
export function useWorkerCoordinator(workerTypes: WorkerRequestType[]): void {
  useEffect(() => {
    return () => {
      console.log('[useWorkerCoordinator] Component unmount, types:', workerTypes)
    }
  }, []) // intentional: cleanup only on unmount, workerTypes are stable
}
