import { useState, useEffect, useCallback } from 'react'

const STORAGE_PREFIX = 'track-manual-completions-'

function storageKey(trackId: string): string {
  return `${STORAGE_PREFIX}${trackId}`
}

function loadFromStorage(trackId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(trackId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter(id => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function persistToStorage(trackId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(storageKey(trackId), JSON.stringify([...ids]))
  } catch {
    // localStorage quota exceeded — non-critical, state remains in-memory
  }
}

export interface ManualModuleCompletion {
  completedIds: Set<string>
  markComplete: (entryId: string) => void
  undoComplete: (entryId: string) => void
  isManuallyCompleted: (entryId: string) => boolean
}

export function useManualModuleCompletion(trackId: string): ManualModuleCompletion {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  // Load from localStorage on mount and when trackId changes
  useEffect(() => {
    setCompletedIds(loadFromStorage(trackId))
  }, [trackId])

  // Persist to localStorage whenever the set changes
  useEffect(() => {
    persistToStorage(trackId, completedIds)
  }, [trackId, completedIds])

  const markComplete = useCallback((entryId: string) => {
    setCompletedIds(prev => {
      const next = new Set(prev)
      next.add(entryId)
      return next
    })
  }, [])

  const undoComplete = useCallback((entryId: string) => {
    setCompletedIds(prev => {
      const next = new Set(prev)
      next.delete(entryId)
      return next
    })
  }, [])

  const isManuallyCompleted = useCallback(
    (entryId: string) => completedIds.has(entryId),
    [completedIds]
  )

  return { completedIds, markComplete, undoComplete, isManuallyCompleted }
}
