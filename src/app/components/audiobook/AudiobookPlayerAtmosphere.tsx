/**
 * Blurred cover backdrop + scrim + vignette for the full-screen audiobook player.
 * Inline styles are required for dynamic cover URLs and layered filters.
 *
 * @module AudiobookPlayerAtmosphere
 */
/* eslint-disable react-best-practices/no-inline-styles */

interface AudiobookPlayerAtmosphereProps {
  coverUrl: string | null | undefined
}

export function AudiobookPlayerAtmosphere({ coverUrl }: AudiobookPlayerAtmosphereProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-background" />
      {coverUrl && (
        <>
          <div
            className="absolute motion-reduce:transform-none"
            style={{
              inset: '-12%',
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(72px) saturate(1.35)',
              opacity: 'var(--player-atmosphere-blur-opacity, 0.52)',
              transform: 'scale(1.08)',
            }}
          />
          <div
            className="absolute motion-reduce:transform-none"
            style={{
              inset: '-28%',
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(120px) saturate(1.55) brightness(1.06)',
              opacity: 'var(--player-atmosphere-bloom-opacity, 0.38)',
            }}
          />
        </>
      )}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--player-atmosphere-scrim)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'var(--player-atmosphere-vignette)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.035] motion-reduce:opacity-0 dark:opacity-[0.055]"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgb(0 0 0 / 0.06) 2px, rgb(0 0 0 / 0.06) 3px)',
            'repeating-linear-gradient(90deg, transparent 0px, transparent 2px, rgb(0 0 0 / 0.04) 2px, rgb(0 0 0 / 0.04) 3px)',
          ].join(','),
        }}
      />
    </div>
  )
}
