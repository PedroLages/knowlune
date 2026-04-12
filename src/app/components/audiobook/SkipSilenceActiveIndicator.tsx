/**
 * SkipSilenceActiveIndicator — persistent pill shown when skip silence is running.
 *
 * Renders a small badge near the playback controls so the user knows that
 * silence detection is active. Hidden (not removed from DOM) when inactive.
 *
 * @module SkipSilenceActiveIndicator
 * @since E111-S02
 */

interface SkipSilenceActiveIndicatorProps {
  isActive: boolean
}

export function SkipSilenceActiveIndicator({ isActive }: SkipSilenceActiveIndicatorProps) {
  return (
    <div
      data-testid="skip-silence-active-indicator"
      role="status"
      aria-label={isActive ? 'Skip silence is active' : undefined}
      aria-hidden={!isActive}
      className={`transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-[10px] font-medium text-brand-soft-foreground">
        <span
          className="inline-block size-1.5 rounded-full bg-brand-soft-foreground animate-pulse"
          aria-hidden="true"
        />
        Skip Silence
      </span>
    </div>
  )
}
