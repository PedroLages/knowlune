/**
 * scrollIntoView wrapper that respects prefers-reduced-motion.
 * Falls back to { behavior: 'auto' } (instant jump) when the user
 * has enabled reduced-motion at OS level.
 */
export function scrollIntoViewReducedMotion(el: Element, options?: ScrollIntoViewOptions): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({
    ...options,
    behavior: reducedMotion ? 'auto' : (options?.behavior ?? 'smooth'),
  })
}
