import { shouldReduceMotion } from '@/lib/settings'

/**
 * scrollIntoView wrapper that respects the app-level motion setting.
 * Falls back to { behavior: 'auto' } (instant jump) when motion is reduced.
 */
export function scrollIntoViewReducedMotion(el: Element, options?: ScrollIntoViewOptions): void {
  const reducedMotion = shouldReduceMotion()
  el.scrollIntoView({
    ...options,
    behavior: reducedMotion ? 'auto' : (options?.behavior ?? 'smooth'),
  })
}
