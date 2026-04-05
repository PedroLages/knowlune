/**
 * OPDS Catalog validation, browsing, and entry parsing service.
 *
 * Validates and browses OPDS (Atom/XML) catalog feeds using the browser's native DOMParser.
 * No external XML library needed. Handles CORS errors, auth, and network failures
 * with user-friendly error messages.
 *
 * @module OpdsService
 * @since E88-S01
 * @modified E88-S02 — added entry parsing, pagination, and nested feed navigation
 */

const FETCH_TIMEOUT_MS = 10_000
const ATOM_NS = 'http://www.w3.org/2005/Atom'

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

// ─── OPDS Entry Types (E88-S02) ──────────────────────────────────────────────

/** Format availability for an OPDS entry (book). */
export interface OpdsAcquisitionLink {
  href: string
  type: string // e.g. 'application/epub+zip', 'application/pdf'
}

/** A single book/entry parsed from an OPDS feed. */
export interface OpdsEntry {
  id: string
  title: string
  author: string
  summary: string
  acquisitionLinks: OpdsAcquisitionLink[]
  coverUrl?: string
  thumbnailUrl?: string
}

/** A navigation link to a sub-feed (category/author browse). */
export interface OpdsNavigationLink {
  title: string
  href: string
}

/** Breadcrumb entry for nested feed navigation. */
export interface OpdsBreadcrumb {
  title: string
  url: string
}

/** Result from fetching catalog entries. */
export type FetchEntriesResult =
  | {
      ok: true
      feedTitle: string
      entries: OpdsEntry[]
      navigationLinks: OpdsNavigationLink[]
      nextPageUrl?: string
    }
  | { ok: false; error: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve a potentially relative href against a base URL. */
function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    // silent-catch-ok — return as-is if URL resolution fails
    return href
  }
}

/** Extract text content from the first matching child element (namespace-aware). */
function getChildText(parent: Element, ns: string, localName: string): string {
  const el = parent.getElementsByTagNameNS(ns, localName)[0]
  return el?.textContent?.trim() ?? ''
}

/** Parse a single <entry> element into an OpdsEntry. */
function parseEntry(entryEl: Element, baseUrl: string): OpdsEntry {
  const id = getChildText(entryEl, ATOM_NS, 'id') || crypto.randomUUID()
  const title = getChildText(entryEl, ATOM_NS, 'title') || 'Untitled'

  // Author — may be nested: <author><name>...</name></author>
  const authorEl = entryEl.getElementsByTagNameNS(ATOM_NS, 'author')[0]
  const author = authorEl
    ? getChildText(authorEl, ATOM_NS, 'name') || 'Unknown Author'
    : 'Unknown Author'

  // Summary — try <summary>, then <content>
  const summary =
    getChildText(entryEl, ATOM_NS, 'summary') || getChildText(entryEl, ATOM_NS, 'content') || ''

  // Parse all <link> elements
  const links = Array.from(entryEl.getElementsByTagNameNS(ATOM_NS, 'link'))

  const acquisitionLinks: OpdsAcquisitionLink[] = []
  let coverUrl: string | undefined
  let thumbnailUrl: string | undefined

  for (const link of links) {
    const rel = link.getAttribute('rel') || ''
    const href = link.getAttribute('href') || ''
    const type = link.getAttribute('type') || ''

    if (!href) continue

    if (rel.startsWith('http://opds-spec.org/acquisition')) {
      acquisitionLinks.push({ href: resolveUrl(href, baseUrl), type })
    } else if (rel === 'http://opds-spec.org/image') {
      coverUrl = resolveUrl(href, baseUrl)
    } else if (rel === 'http://opds-spec.org/image/thumbnail') {
      thumbnailUrl = resolveUrl(href, baseUrl)
    }
  }

  return { id, title, author, summary, acquisitionLinks, coverUrl, thumbnailUrl }
}

/**
 * Fetch and parse entries from an OPDS catalog feed.
 *
 * Handles both acquisition feeds (book entries) and navigation feeds
 * (sub-catalogs like categories/authors). Supports pagination via `rel="next"`.
 *
 * @param url - The feed URL to fetch
 * @param auth - Optional basic auth credentials
 * @returns Parsed entries, navigation links, and next page URL (if any)
 */
export async function fetchCatalogEntries(
  url: string,
  auth?: { username: string; password: string }
): Promise<FetchEntriesResult> {
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
      return {
        ok: false,
        error:
          'Could not connect to catalog. The server may not allow browser access (CORS). Check the URL and server CORS settings.',
      }
    }
    return { ok: false, error: 'Could not connect to catalog. Check the URL and try again.' }
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: 'Authentication required. Please provide valid credentials.' }
  }
  if (!response.ok) {
    return { ok: false, error: `Server returned ${response.status}. Check the URL and try again.` }
  }

  // --- Parse XML ---
  let doc: Document
  try {
    const text = await response.text()
    const parser = new DOMParser()
    doc = parser.parseFromString(text, 'application/xml')

    const parseError = doc.querySelector('parsererror')
    if (parseError) {
      return { ok: false, error: 'Response is not valid XML.' }
    }
    // eslint-disable-next-line error-handling/no-silent-catch -- returns discriminated error result instead of throwing
  } catch {
    return { ok: false, error: 'Failed to parse server response.' }
  }

  // --- Validate feed ---
  const root = doc.documentElement
  const isAtomFeed =
    root.localName === 'feed' &&
    (root.namespaceURI === ATOM_NS || root.getAttribute('xmlns') === ATOM_NS)

  if (!isAtomFeed) {
    return { ok: false, error: 'Response is not a valid OPDS feed.' }
  }

  // --- Feed title ---
  const feedTitleEl = root.getElementsByTagNameNS(ATOM_NS, 'title')[0]
  const feedTitle = feedTitleEl?.textContent?.trim() || 'Catalog'

  // --- Parse entries ---
  const entryEls = root.getElementsByTagNameNS(ATOM_NS, 'entry')
  const entries: OpdsEntry[] = []
  const navigationLinks: OpdsNavigationLink[] = []

  for (const entryEl of Array.from(entryEls)) {
    const links = Array.from(entryEl.getElementsByTagNameNS(ATOM_NS, 'link'))

    // Check if this is a navigation entry (subsection / catalog link)
    const navLink = links.find(l => {
      const rel = l.getAttribute('rel') || ''
      const type = l.getAttribute('type') || ''
      return (
        rel === 'subsection' ||
        rel === 'http://opds-spec.org/sort/new' ||
        rel === 'http://opds-spec.org/sort/popular' ||
        type.includes('opds-catalog') ||
        type === 'application/atom+xml;profile=opds-catalog' ||
        type === 'application/atom+xml; profile=opds-catalog'
      )
    })

    if (navLink) {
      const href = navLink.getAttribute('href')
      const title = getChildText(entryEl, ATOM_NS, 'title') || 'Untitled'
      if (href) {
        navigationLinks.push({ title, href: resolveUrl(href, url) })
      }
    } else {
      // Regular book entry
      entries.push(parseEntry(entryEl, url))
    }
  }

  // --- Pagination: find <link rel="next"> ---
  const feedLinks = root.getElementsByTagNameNS(ATOM_NS, 'link')
  let nextPageUrl: string | undefined
  for (const link of Array.from(feedLinks)) {
    if (link.getAttribute('rel') === 'next') {
      const href = link.getAttribute('href')
      if (href) {
        nextPageUrl = resolveUrl(href, url)
      }
      break
    }
  }

  return { ok: true, feedTitle, entries, navigationLinks, nextPageUrl }
}

/**
 * Determine the best format label for an entry's acquisition links.
 *
 * Returns a user-friendly string like "EPUB", "PDF", "EPUB, PDF", etc.
 */
export function getFormatLabel(links: OpdsAcquisitionLink[]): string {
  const formats = new Set<string>()
  for (const l of links) {
    if (l.type.includes('epub')) formats.add('EPUB')
    else if (l.type.includes('pdf')) formats.add('PDF')
    else if (l.type.includes('mobi') || l.type.includes('x-mobipocket')) formats.add('MOBI')
    else formats.add(l.type.split('/').pop()?.toUpperCase() || 'FILE')
  }
  return Array.from(formats).join(', ') || 'Unknown'
}
