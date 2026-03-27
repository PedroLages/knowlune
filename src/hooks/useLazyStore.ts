import { useEffect, useRef } from 'react'

/**
 * useLazyStore — Defers non-critical Zustand store initialization to page-level.
 *
 * Wraps a store's `loadX()` function to ensure it's called exactly once
 * when the page mounts. Returns { isLoading } so pages can show skeletons
 * while IndexedDB data is being fetched.
 *
 * Critical stores (useCourseStore, useAuthStore) are loaded eagerly in
 * main.tsx / Layout.tsx. All other stores should use this hook.
 *
 * @example
 * ```tsx
 * const { notes, isLoading, loadNotes } = useNoteStore()
 * useLazyStore(loadNotes)
 *
 * if (isLoading) return <StoreLoadingSkeleton />
 * ```
 */
export function useLazyStore(loadFn: () => Promise<void> | void): void {
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true
    loadFn()
  }, [loadFn])
}
