/**
 * Course content server HTTP service (E133-S01).
 *
 * Communicates with an nginx file server serving course content from a
 * directory tree. Uses nginx autoindex HTML parsing to discover files and
 * directories — no API needed beyond the default nginx directory listing.
 *
 * Pure functions, no stored state, no React imports. Safe to use from
 * service workers, tests, and React components.
 *
 * @module courseServerService
 * @since E133-S01
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServerFile {
  name: string
  url: string
  type: 'video' | 'pdf' | 'image' | 'directory' | 'other'
  /** File size in bytes, extracted from autoindex when available. */
  fileSize?: number
}

export interface DirectoryListing {
  url: string
  files: ServerFile[]
}

export type ServerResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000

/** Recognized video extensions. */
const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mkv',
  '.webm',
  '.ts',
  '.mov',
  '.avi',
  '.m4v',
  '.flv',
  '.wmv',
])

/** Recognized PDF extension. */
const PDF_EXTENSIONS = new Set(['.pdf'])

/** Recognized image extensions (cover candidates). */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return ''
  return filename.toLowerCase().slice(dot)
}

function classifyFile(name: string): ServerFile['type'] {
  // Directory entries have trailing slash in nginx autoindex
  if (name.endsWith('/')) return 'directory'
  const ext = getExtension(name)
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (PDF_EXTENSIONS.has(ext)) return 'pdf'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  return 'other'
}

/**
 * Parse an nginx autoindex HTML page into a list of files.
 *
 * nginx autoindex format (stable, well-documented):
 *   <html><head><title>Index of /path/</title></head><body>
 *   <h1>Index of /path/</h1><hr>
 *   <pre><a href="../">../</a>
 *   <a href="file.mp4">file.mp4</a>      08-Sep-2025 10:00    23M
 *   <a href="folder/">folder/</a>         08-Sep-2025 10:00       -
 *   </pre><hr></body></html>
 *
 * Directories are detected by trailing `/` in href.
 * File size is extracted from the text node following the link.
 *
 * @param html - Raw nginx autoindex HTML string
 * @param baseUrl - Base URL of the directory being listed (for resolving relative links)
 */
function parseAutoindex(html: string, baseUrl: string): ServerFile[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const links = doc.querySelectorAll('pre a')

  return [...links]
    .filter(a => {
      const href = a.getAttribute('href')
      return href && href !== '../'
    })
    .map(a => {
      const href = a.getAttribute('href')!
      const decodedName = decodeURIComponent(href)

      return {
        name: decodedName,
        url: new URL(href, baseUrl + (baseUrl.endsWith('/') ? '' : '/')).href,
        type: classifyFile(decodedName),
      }
    })
}

/**
 * Validate a URL for use with the import system.
 *
 * Checks that the URL is a non-empty string, parseable via the URL constructor,
 * has protocol http: or https:, and is not a bare IP-literal URL without a path
 * segment (which would be an nginx root that isn't useful for course import).
 *
 * Returns a discriminated union so callers can render precise inline errors.
 */
export function isValidImportUrl(url: string): { valid: true } | { valid: false; reason: string } {
  if (!url.trim()) {
    return { valid: false, reason: 'URL is empty' }
  }

  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return { valid: false, reason: 'URL is not valid — check the address and try again' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Unsupported protocol "${parsed.protocol.replace(':', '')}". Only http:// and https:// are supported.`,
    }
  }

  // Reject bare IP-literal URLs without any path — they're server roots, not course folders
  const pathname = parsed.pathname.replace(/\/+$/, '')
  if (!pathname || pathname === '') {
    return {
      valid: false,
      reason:
        'URL must include a folder path — paste a specific folder URL, not just the server root.',
    }
  }

  return { valid: true }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a directory listing from an nginx autoindex page.
 *
 * Makes a single HTTP GET request to the folder URL, parses the autoindex
 * HTML response, and returns structured file entries. Directories are
 * listed but NOT recursed into — use multiple calls for subdirectories.
 *
 * @param url - Full URL to the folder (e.g., "http://192.168.2.200:8099/AI/Course/")
 */
export async function fetchDirectoryListing(url: string): Promise<ServerResult<DirectoryListing>> {
  // Normalize for child URL construction (no trailing slash).
  const normalized = normalizeBaseUrl(url)

  // Preserve trailing slash for fetch — nginx autoindex 301-redirects
  // directory URLs without trailing slashes, and redirect: 'error' converts
  // that into a TypeError (→ "Network error — server unreachable").
  const fetchUrl = url.endsWith('/') ? url : url + '/'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/html' },
      redirect: 'error',
    })

    if (!response.ok) {
      clearTimeout(timeout)
      return {
        ok: false,
        error: `Server returned ${response.status} ${response.statusText}`,
        status: response.status,
      }
    }

    const html = await response.text()
    clearTimeout(timeout)
    // Use normalized (slash-stripped) URL as base so child URLs resolve correctly.
    const files = parseAutoindex(html, normalized + '/')

    return { ok: true, data: { url: normalized, files } }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Request timed out' }
    }
    return {
      ok: false,
      error: err instanceof TypeError ? 'Network error — server unreachable' : String(err),
    }
  }
}

/**
 * Verify a course server is reachable by fetching its root directory listing.
 *
 * Returns ok:true if the server responds with a non-error HTTP status.
 * Does NOT validate the response body structure — just checks connectivity.
 *
 * @param url - Base URL of the server (e.g., "http://192.168.2.200:8099/")
 * @param authToken - Optional Bearer token for authenticated servers
 */
export async function verifyConnection(
  url: string,
  authToken?: string | null
): Promise<ServerResult<{ reachable: boolean }>> {
  // Preserve trailing slash for fetch — same redirect issue as fetchDirectoryListing.
  const fetchUrl = url.endsWith('/') ? url : url + '/'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const headers: Record<string, string> = { Accept: 'text/html' }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers,
      redirect: 'error',
    })

    clearTimeout(timeout)

    if (response.ok) {
      return { ok: true, data: { reachable: true } }
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: 'Authentication failed', status: response.status }
    }

    return {
      ok: false,
      error: `Server returned ${response.status}`,
      status: response.status,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out' }
    }
    return {
      ok: false,
      error: err instanceof TypeError ? 'Server unreachable' : String(err),
    }
  }
}

/**
 * Build a full file URL from a base server URL and a relative path.
 *
 * Handles URL encoding of path segments so filenames with spaces/special
 * characters work correctly. The base URL is assumed to already be encoded.
 *
 * @example
 *   buildFileUrl('http://192.168.2.200:8099', 'AI/Course/01. Video.mp4')
 *   // => 'http://192.168.2.200:8099/AI/Course/01.%20Video.mp4'
 */
export function buildFileUrl(baseUrl: string, relativePath: string): string {
  const normalized = normalizeBaseUrl(baseUrl)
  // Split the path into segments, encode each segment, then join
  const segments = relativePath.split('/').map(seg => encodeURIComponent(decodeURIComponent(seg)))
  return `${normalized}/${segments.join('/')}`
}
