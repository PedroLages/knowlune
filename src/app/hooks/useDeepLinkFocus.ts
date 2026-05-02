/**
 * useDeepLinkFocus — E97-S05 Unit 4
 *
 * Reads `?focus=<kind>:<id>` from the URL, invokes a callback to open
 * the correct settings form, and clears the param after consumption.
 *
 * This hook is intentionally separate from `src/app/hooks/useDeepLinkEffects.ts`.
 * `useDeepLinkEffects` is purpose-built for the lesson player (reads `?t=<seconds>`,
 * `?panel=notes`; accepts player-specific setters; fires on every param change).
 * `useDeepLinkFocus` is a different shape:
 *   - Accepts a generic `(id: string) => void` callback.
 *   - Reads `?focus=<kind>:<id>` with a colon-separated kind filter.
 *   - Fires EXACTLY ONCE per URL token, then clears the param (navigation semantics,
 *     not seek semantics).
 *   - Consumers live in three unrelated trees (Settings, OPDS dialog, ABS dialog).
 *
 * See E97-S05 plan Unit 4 for the full split rationale.
 *
 * @module useDeepLinkFocus
 * @since E97-S05
 */

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

type FocusKind = 'ai-provider' | 'opds' | 'abs'

/**
 * Reads `?focus=<kind>:<id>` from the URL and calls onFocus(id) exactly once
 * when the kind matches. Clears the param after consumption.
 *
 * @param kind - The kind prefix to match (e.g. 'opds', 'abs', 'ai-provider')
 * @param onFocus - Callback invoked with the extracted id
 */
export function useDeepLinkFocus(kind: FocusKind, onFocus: (id: string) => void): void {
  const [searchParams, setSearchParams] = useSearchParams()

  // Guard ref ensures the callback fires exactly once per URL token.
  // Stores the last token we processed to prevent re-firing on unrelated re-renders.
  const processedTokenRef = useRef<string | null>(null)

  const focusParam = searchParams.get('focus')

  useEffect(() => {
    if (!focusParam) return
    if (!focusParam.startsWith(`${kind}:`)) return

    // Extract the id after "<kind>:"
    const id = focusParam.slice(kind.length + 1)
    if (!id) return

    // Guard: only fire once per unique token
    if (processedTokenRef.current === focusParam) return
    processedTokenRef.current = focusParam

    // Invoke the caller callback
    onFocus(id)

    // Clear the param so unrelated re-renders don't re-trigger
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('focus')
        return next
      },
      { replace: true }
    )
  }, [focusParam, kind, onFocus, setSearchParams])
}
