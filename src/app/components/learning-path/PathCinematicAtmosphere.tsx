/**
 * PathCinematicAtmosphere — decorative cover-derived page atmosphere.
 *
 * A blurred, low-opacity cover backdrop that extends the hero's palette down
 * the page as a subtle ambient glow behind the content area. Content cards
 * stay solid `bg-card` so the atmosphere never reduces readability.
 *
 * Adapted from AudiobookPlayerAtmosphere but page-scoped (not `fixed inset-0`)
 * to sit inside the Layout content column, not over the sidebar/header.
 *
 * @module PathCinematicAtmosphere
 */
/* eslint-disable react-best-practices/no-inline-styles */

interface PathCinematicAtmosphereProps {
  /** The track cover URL (dynamic, from coverImageUrl). */
  coverUrl?: string | null
  /** The track cover preset name (used when no coverUrl is available). */
  coverPreset?: string
}

export function PathCinematicAtmosphere({
  coverUrl,
  coverPreset,
}: PathCinematicAtmosphereProps) {
  // Without a usable cover image, derive a subtle tint from the preset
  // gradient, or render nothing for the brand default to avoid muddying
  // light themes.
  const hasCover = !!coverUrl
  const hasPreset = !!coverPreset

  // Render nothing when there's neither cover nor preset — brand gradients
  // are already visually self-contained and don't need atmosphere.
  if (!hasCover && !hasPreset) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Base background scrim — fades the glow into bg-background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/0 to-background" />

      {coverUrl && (
        <>
          {/* Blurred cover aura */}
          <div
            className="absolute motion-reduce:transform-none"
            style={{
              inset: '-12%',
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(72px) saturate(1.2)',
              opacity: 0.15,
              transform: 'scale(1.08)',
            }}
          />
          {/* Secondary bloom layer — wider, softer, more diffuse */}
          <div
            className="absolute motion-reduce:transform-none"
            style={{
              inset: '-24%',
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(120px) saturate(1.3) brightness(1.05)',
              opacity: 0.10,
            }}
          />
        </>
      )}

      {/* Preset-derived subtle tint — a muted gradient in the same
          color family as the selected preset. This is extremely faint
          and purely decorative. */}
      {!coverUrl && hasPreset && (
        <div className="absolute inset-0 opacity-[0.04] bg-gradient-to-b from-brand/30 to-transparent" />
      )}
    </div>
  )
}
