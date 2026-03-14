import { useEffect } from 'react'
import { coordinator } from '../workers/coordinator'
import type { WorkerRequestType } from '../workers/types'

/**
 * Component-scoped cleanup hook.
 * Terminates specified worker types on component unmount.
 * The global coordinator singleton persists for other consumers.
 */
export function useWorkerCoordinator(workerTypes: WorkerRequestType[]): void {
  useEffect(() => {
    return () => {
      workerTypes.forEach(type => {
        coordinator.terminateWorkerType(type)
      })
    }
  }, []) // intentional: cleanup only on unmount, workerTypes are stable
}
