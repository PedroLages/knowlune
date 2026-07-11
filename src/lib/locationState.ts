/**
 * locationState — Narrowing guards for React Router location.state values.
 *
 * React Router's `location.state` is typed as `unknown` (via `NavigationOptions`
 * and `useLocation`), so every access point must narrow the shape. These guards
 * keep that narrowing in one place so consumers don't inline ad-hoc checks.
 */

/** Narrow an unknown location.state to the fromTrack shape, returning undefined on mismatch. */
export function readFromTrack(state: unknown): { trackId: string; trackName: string } | undefined {
  if (typeof state !== 'object' || state === null) return undefined
  const s = state as Record<string, unknown>
  if (
    typeof s.fromTrack === 'object' &&
    s.fromTrack !== null &&
    typeof (s.fromTrack as Record<string, unknown>).trackId === 'string' &&
    typeof (s.fromTrack as Record<string, unknown>).trackName === 'string'
  ) {
    return s.fromTrack as { trackId: string; trackName: string }
  }
  return undefined
}
