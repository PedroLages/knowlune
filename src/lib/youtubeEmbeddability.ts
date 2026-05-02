/**
 * YouTube Embeddability Probe
 *
 * Keyless, zero-quota check for whether a YouTube video can be embedded on
 * other sites. Uses the public oEmbed endpoint:
 *   - 200 → embeddable
 *   - 401 → embedding disabled by owner
 *   - 404 → video deleted or private
 *   - other / network failure → unknown
 *
 * Results are cached in memory per-session (keyed by videoId) to dedupe
 * back-to-back calls during an import. Network failures are also cached to
 * avoid repeatedly hammering a failing endpoint within the same session.
 *
 * Caller policy (see Unit 3 of the plan): a `reason: 'unknown'` result should
 * NOT block import — the runtime fallback is the safety net.
 *
 * No toasts are emitted from this module — it returns structured results in
 * the same spirit as {@link YouTubeApiResult} in `youtubeApi.ts`.
 */

import type { UnembeddableReason } from '@/data/types'

export type { UnembeddableReason }

const OEMBED_ENDPOINT = 'https://www.youtube.com/oembed'

export type EmbeddabilityResult =
  | { embeddable: true }
  | { embeddable: false; reason: UnembeddableReason }

const cache = new Map<string, EmbeddabilityResult>()

/**
 * Probe whether a YouTube video can be embedded by calling the oEmbed endpoint.
 *
 * @param videoId YouTube video ID (11 chars, e.g. `dQw4w9WgXcQ`)
 * @returns Cached result if previously probed this session; otherwise fetches
 *   and caches a fresh result. On network failure returns
 *   `{ embeddable: false, reason: 'unknown' }` (fail-safe — caller decides
 *   whether to treat as blocking).
 */
export async function probeEmbeddability(videoId: string): Promise<EmbeddabilityResult> {
  const cached = cache.get(videoId)
  if (cached) return cached

  const url = `${OEMBED_ENDPOINT}?url=https://www.youtube.com/watch?v=${encodeURIComponent(
    videoId
  )}&format=json`

  let result: EmbeddabilityResult
  try {
    const response = await fetch(url)
    if (response.status === 200) {
      result = { embeddable: true }
    } else if (response.status === 401) {
      result = { embeddable: false, reason: 'embedding-disabled' }
    } else if (response.status === 404) {
      result = { embeddable: false, reason: 'deleted-or-private' }
    } else {
      result = { embeddable: false, reason: 'unknown' }
    }
  } catch {
    // Network error — fail-safe. Cache so we don't retry within session.
    result = { embeddable: false, reason: 'unknown' }
  }

  cache.set(videoId, result)
  return result
}

/** Clear the in-memory embeddability cache. Intended for tests. */
export function clearEmbeddabilityCache(): void {
  cache.clear()
}
