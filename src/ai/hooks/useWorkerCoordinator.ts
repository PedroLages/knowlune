/**
 * useWorkerCoordinator
 *
 * React hook for safe worker coordinator usage in components.
 * Returns the global coordinator singleton and optionally terminates
 * specific workers when the component unmounts (e.g., panels that load
 * vector indexes should clean up on close).
 *
 * Example:
 *   const { coordinator } = useWorkerCoordinator({ terminateOnUnmount: ['search'] })
 */

import { useEffect, useRef } from 'react'
import { coordinator } from '@/ai/workers/coordinator'
import type { WorkerRequestType } from '@/ai/workers/types'

interface UseWorkerCoordinatorOptions {
  /**
   * Worker types to terminate when this component unmounts.
   * If omitted, no workers are terminated on unmount (global coordinator persists).
   */
  terminateOnUnmount?: WorkerRequestType[]
}

export function useWorkerCoordinator(options: UseWorkerCoordinatorOptions = {}) {
  const { terminateOnUnmount } = options
  const terminateTypesRef = useRef(terminateOnUnmount)

  useEffect(() => {
    terminateTypesRef.current = terminateOnUnmount
  }, [terminateOnUnmount])

  useEffect(() => {
    return () => {
      const types = terminateTypesRef.current
      if (types && types.length > 0) {
        for (const type of types) {
          coordinator.terminateWorkerType(type)
        }
      }
    }
  }, []) // Intentionally empty — only runs on unmount

  return { coordinator }
}
