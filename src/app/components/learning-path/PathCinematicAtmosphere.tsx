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
  const hasCover = !!coverUrl
  const hasPreset = !!coverPreset

  // Render nothing when there's neither cover nor preset — brand gradients
  // are already visually self-contained and don't need atmosphere.
  if (!hasCover && !hasPreset) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      {/* Base background scrim */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/0 to-background" />

      {coverUrl && (
        <>
          {/* Blurred cover aura — single layer for GPU performance */}
          <div
            className="absolute scale-[1.08] motion-reduce:scale-100 opacity-15 bg-cover bg-center"
            style={{
              inset: '-12%',
              backgroundImage: `url(${coverUrl})`,
              filter: 'blur(72px) saturate(1.2)',
            }}
          />
        </>
      )}

      {!coverUrl && hasPreset && (
        <div className="absolute inset-0 opacity-[0.04] bg-gradient-to-b from-brand/30 to-transparent" />
      )}
    </div>
  )
}
