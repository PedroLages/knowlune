/**
 * OPDS Catalog validation and parsing service.
 *
 * Validates OPDS (Atom/XML) catalog feeds using the browser's native DOMParser.
 * No external XML library needed. Handles CORS errors, auth, and network failures
 * with user-friendly error messages.
 *
 * @module OpdsService
 * @since E88-S01
 */

const FETCH_TIMEOUT_MS = 10_000

/**
 * Returns true if the given URL uses HTTP (not HTTPS).
 * Used to warn users when credentials may be sent unencrypted.
 */
export function isInsecureUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'http:'
  } catch {
    // silent-catch-ok — invalid URL simply means not insecure
    return false
  }
}

/** Metadata extracted from a successfully validated OPDS catalog root feed. */
export interface OpdsCatalogMeta {
  title: string
  entryCount: number
  iconUrl?: string
}

/** Discriminated result from catalog validation. */
export type ValidateCatalogResult =
  | { ok: true; meta: OpdsCatalogMeta }
  | { ok: false; error: string }

/**
 * Fetch and validate an OPDS catalog URL.
 *
 * 1. Fetches the URL with optional Basic Auth and a timeout.
 * 2. Parses response as XML via DOMParser.
 * 3. Validates Atom namespace and OPDS structure.
 *
 * Returns a discriminated union so callers never need try/catch.
 */
export async function validateCatalog(
  url: string,
  auth?: { username: string; password: string }
): Promise<ValidateCatalogResult> {
  // --- Fetch ---
  let response: Response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const headers: Record<string, string> = {
      Accept: 'application/atom+xml, application/xml, text/xml',
    }
    if (auth?.username) {
      headers['Authorization'] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`
    }

    response = await fetch(url, { signal: controller.signal, headers })
    clearTimeout(timeoutId)
    // eslint-disable-next-line error-handling/no-silent-catch -- returns discriminated error result instead of throwing
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out. Check the URL and try again.' }
    }
    if (err instanceof TypeError) {
      // TypeError from fetch usually means network/CORS failure
      return {
        ok: false,
        error:
          'Could not connect to OPDS catalog. The server may not allow browser access (CORS). Check the URL and server CORS settings.',
      }
    }
    return { ok: false, error: 'Could not connect to OPDS catalog. Check the URL and try again.' }
  }

  // --- HTTP status ---
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      error: 'Authentication required. Please provide valid credentials.',
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `Server returned ${response.status}. Check the URL and try again.`,
    }
  }

  // --- Parse XML ---
  let doc: Document
  try {
    const text = await response.text()
    const parser = new DOMParser()
    doc = parser.parseFromString(text, 'application/xml')

    // DOMParser returns a parsererror document for invalid XML
    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      return {
        ok: false,
        error: 'Response is not valid XML. Make sure the URL points to an OPDS catalog.',
      }
    }
    // eslint-disable-next-line error-handling/no-silent-catch -- returns discriminated error result instead of throwing
  } catch {
    return {
      ok: false,
      error: 'Failed to parse server response. Make sure the URL points to an OPDS catalog.',
    }
  }

  // --- Validate OPDS/Atom structure ---
  const ATOM_NS = 'http://www.w3.org/2005/Atom'

  // Check for <feed> root with Atom namespace
  const root = doc.documentElement
  const isAtomFeed =
    root.localName === 'feed' &&
    (root.namespaceURI === ATOM_NS || root.getAttribute('xmlns') === ATOM_NS)

  if (!isAtomFeed) {
    return {
      ok: false,
      error:
        'Response is not an OPDS catalog. Expected an Atom feed. Make sure the URL points to an OPDS catalog root.',
    }
  }

  // Extract title
  const titleEl = root.getElementsByTagNameNS(ATOM_NS, 'title')[0]
  const title = titleEl?.textContent?.trim() || 'Untitled Catalog'

  // Count entries (books or navigation links)
  const entries = root.getElementsByTagNameNS(ATOM_NS, 'entry')
  const entryCount = entries.length

  // Look for an icon
  const iconEl = root.getElementsByTagNameNS(ATOM_NS, 'icon')[0]
  const iconUrl = iconEl?.textContent?.trim() || undefined

  // Valid if it has at least the Atom feed structure
  // (empty catalogs are valid — they just have 0 entries)
  return {
    ok: true,
    meta: { title, entryCount, iconUrl },
  }
}
