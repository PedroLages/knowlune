/**
 * Shared design constants for the library redesign.
 *
 * Provides reusable Tailwind class patterns for ghost-bordered inputs,
 * uppercase labels, and gradient CTAs used across all redesigned screens.
 *
 * @since Library Redesign
 */

/** Ghost-bordered input: subtle border, focus ring in brand color */
export const ghostInputClass =
  'bg-card rounded-lg px-4 py-3 border border-border/15 focus-within:ring-2 focus-within:ring-brand/40 transition-all'

/** Editorial label: small uppercase tracking for form labels */
export const labelClass = 'text-xs font-bold uppercase tracking-widest text-muted-foreground'

/** Gradient CTA button: brand gradient with pill shape */
export const gradientCtaClass =
  'bg-gradient-to-br from-brand to-brand-hover text-brand-foreground rounded-full shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all'

/** Ghost cancel button: minimal, text-only */
export const ghostCancelClass =
  'text-muted-foreground hover:text-foreground bg-transparent border-none transition-colors'
