/**
 * Knowlune brand logo — lunar eclipse icon + Space Grotesk wordmark.
 *
 * Design: A centered annulus (ring) at 50% opacity as the shadow layer,
 * with a crescent moon overlay on the left side at full opacity —
 * creating an illuminated lunar eclipse effect.
 *
 * Geometry: outer r=12, inner r=7.2 (40% wall thickness).
 * Crescent uses a slightly larger inner arc (r=13.6) to carve the moon shape.
 *
 * Lockups:
 *  - KnowluneLogo: Horizontal icon + wordmark (sidebar expanded)
 *  - KnowluneIcon: Standalone eclipse mark (favicon, collapsed sidebar)
 */

const BASE_ANNULUS =
  'M 20 8 A 12 12 0 1 1 20 32 A 12 12 0 1 1 20 8 M 20 12.8 A 7.2 7.2 0 1 0 20 27.2 A 7.2 7.2 0 1 0 20 12.8 Z'
const CRESCENT = 'M 20 8 A 12 12 0 0 0 20 32 A 13.6 13.6 0 0 1 20 8 Z'

/** Standalone lunar eclipse mark. */
export function KnowluneIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Knowlune"
      role="img"
    >
      <path d={BASE_ANNULUS} fillRule="evenodd" className="fill-brand opacity-50" />
      <path d={CRESCENT} className="fill-brand" />
    </svg>
  )
}

/** Horizontal lockup: eclipse icon + "Knowlune" wordmark. */
export function KnowluneLogo({ className = 'h-7 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 210 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Knowlune"
      role="img"
    >
      <path d={BASE_ANNULUS} fillRule="evenodd" className="fill-brand opacity-50" />
      <path d={CRESCENT} className="fill-brand" />
      <text
        x="48"
        y="29"
        style={{ fontFamily: 'var(--font-heading)' }}
        fontSize="26"
        fontWeight="600"
        fill="currentColor"
      >
        Knowlune
      </text>
    </svg>
  )
}
