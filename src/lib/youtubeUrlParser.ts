/**
 * YouTube URL Parser
 *
 * Extracts videoId and playlistId from various YouTube URL formats:
 * - Standard watch: youtube.com/watch?v=VIDEO_ID
 * - Short: youtu.be/VIDEO_ID
 * - Embed: youtube.com/embed/VIDEO_ID
 * - Shorts: youtube.com/shorts/VIDEO_ID
 * - Playlist: youtube.com/playlist?list=PLAYLIST_ID
 * - Watch with playlist: youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID
 * - Music: music.youtube.com/watch?v=VIDEO_ID
 * - Nocookie embed: youtube-nocookie.com/embed/VIDEO_ID
 *
 * Returns structured results with validation status for each parsed URL.
 */

/** Result of parsing a single YouTube URL */
export interface YouTubeUrlParseResult {
  /** Original URL that was parsed */
  originalUrl: string
  /** Whether the URL is a valid YouTube URL */
  valid: boolean
  /** Extracted video ID (11 chars, alphanumeric + dash + underscore) */
  videoId?: string
  /** Extracted playlist ID (starts with PL, OL, LL, or similar) */
  playlistId?: string
  /** Detected URL type */
  type?: 'video' | 'playlist' | 'video-in-playlist' | 'short' | 'embed'
}

/** Valid YouTube video ID pattern: 11 characters, alphanumeric + dash + underscore */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/** Valid YouTube playlist ID pattern: starts with PL, OL, LL, RD, UU, etc. */
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{2,}$/

/** Recognized YouTube hostnames */
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

/**
 * Parses a single YouTube URL and extracts videoId and/or playlistId
 *
 * @param url - The URL string to parse
 * @returns Parsed result with validation status
 *
 * @example
 * parseYouTubeUrl('https://youtube.com/watch?v=abc123DEF_-')
 * // { originalUrl: '...', valid: true, videoId: 'abc123DEF_-', type: 'video' }
 *
 * @example
 * parseYouTubeUrl('https://youtube.com/playlist?list=PLxyz123')
 * // { originalUrl: '...', valid: true, playlistId: 'PLxyz123', type: 'playlist' }
 */
export function parseYouTubeUrl(url: string): YouTubeUrlParseResult {
  const trimmed = url.trim()
  const invalid: YouTubeUrlParseResult = { originalUrl: trimmed, valid: false }

  if (!trimmed) return invalid

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return invalid
  }

  // Validate protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return invalid
  }

  // Validate hostname
  const hostname = parsed.hostname.toLowerCase()
  if (!YOUTUBE_HOSTS.has(hostname)) {
    return invalid
  }

  let videoId: string | undefined
  let playlistId: string | undefined

  // Short URL: youtu.be/VIDEO_ID
  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    const pathId = parsed.pathname.slice(1) // Remove leading /
    if (pathId && VIDEO_ID_PATTERN.test(pathId)) {
      videoId = pathId
    }
    // youtu.be can also carry a list param
    const listParam = parsed.searchParams.get('list')
    if (listParam && PLAYLIST_ID_PATTERN.test(listParam)) {
      playlistId = listParam
    }
  } else {
    // Standard YouTube URLs
    const pathSegments = parsed.pathname.split('/').filter(Boolean)

    // Embed: /embed/VIDEO_ID
    if (pathSegments[0] === 'embed' && pathSegments[1]) {
      if (VIDEO_ID_PATTERN.test(pathSegments[1])) {
        videoId = pathSegments[1]
      }
    }

    // Shorts: /shorts/VIDEO_ID
    if (pathSegments[0] === 'shorts' && pathSegments[1]) {
      if (VIDEO_ID_PATTERN.test(pathSegments[1])) {
        videoId = pathSegments[1]
      }
    }

    // Live: /live/VIDEO_ID
    if (pathSegments[0] === 'live' && pathSegments[1]) {
      if (VIDEO_ID_PATTERN.test(pathSegments[1])) {
        videoId = pathSegments[1]
      }
    }

    // Watch page: /watch?v=VIDEO_ID
    const vParam = parsed.searchParams.get('v')
    if (vParam && VIDEO_ID_PATTERN.test(vParam)) {
      videoId = vParam
    }

    // Playlist: ?list=PLAYLIST_ID
    const listParam = parsed.searchParams.get('list')
    if (listParam && PLAYLIST_ID_PATTERN.test(listParam)) {
      playlistId = listParam
    }
  }

  // Determine result validity and type
  if (!videoId && !playlistId) {
    return invalid
  }

  let type: YouTubeUrlParseResult['type']
  if (videoId && playlistId) {
    type = 'video-in-playlist'
  } else if (playlistId) {
    type = 'playlist'
  } else if (parsed.pathname.includes('/embed/')) {
    type = 'embed'
  } else if (parsed.pathname.includes('/shorts/')) {
    type = 'short'
  } else {
    type = 'video'
  }

  return {
    originalUrl: trimmed,
    valid: true,
    videoId,
    playlistId,
    type,
  }
}

/**
 * Parses multiple YouTube URLs (one per line)
 *
 * Filters out empty lines and returns a result for each non-empty line.
 *
 * @param input - Multiline string with one URL per line
 * @returns Array of parse results, one per non-empty line
 *
 * @example
 * parseMultipleYouTubeUrls(`
 *   https://youtube.com/watch?v=abc123DEF_-
 *   https://example.com
 *   https://youtu.be/xyz789ABC_-
 * `)
 * // Returns 3 results: valid, invalid, valid
 */
export function parseMultipleYouTubeUrls(input: string): YouTubeUrlParseResult[] {
  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => parseYouTubeUrl(line))
}

/**
 * Quick check: does this string look like a YouTube URL?
 *
 * Lightweight check without full parsing — useful for UI hints.
 *
 * @param url - String to check
 * @returns True if the string contains a YouTube domain
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}
