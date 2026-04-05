import { useRef, useCallback } from 'react'

/**
 * useStableCallback — returns a stable function reference that always calls
 * the latest version of the provided callback.
 *
 * Solves the recurring stale closure pattern where useCallback deps cause
 * unnecessary re-renders, and manual refs require boilerplate.
 *
 * Usage:
 *   const handleClick = useStableCallback((id: string) => {
 *     // Safely references latest props/state — no stale closures
 *     doSomething(id, currentState)
 *   })
 *
 * The returned function has a stable identity (never changes between renders),
 * so it's safe to use in useEffect deps without causing re-runs.
 *
 * @see https://react.dev/reference/react/useRef#referencing-a-value-with-a-ref
 * @see Epic 88 retrospective — stale closure pattern in S02/S04
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  const callbackRef = useRef<T>(callback)
  callbackRef.current = callback

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args: Parameters<T>) => callbackRef.current(...args)) as T, [])
}
