/**
 * Open Library API service for book metadata and cover fetching.
 *
 * Public API with no authentication required.
 * All requests have a 5-second timeout — cover fetch is best-effort
 * and never blocks import.
 *
 * @module OpenLibraryService
 * @since E83-S02
 */

export interface OpenLibraryResult {
  coverUrl?: string
  description?: string
  subjects?: string[]
}

const TIMEOUT_MS = 5000

/**
 * Fetch book metadata from Open Library.
 * Searches by ISBN first, falls back to title+author search.
 * Returns partial results — never throws.
 */
export async function fetchOpenLibraryMetadata(params: {
  isbn?: string
  title: string
  author: string
}): Promise<OpenLibraryResult> {
  try {
    // Try ISBN search first
    if (params.isbn) {
      const result = await searchByIsbn(params.isbn)
      if (result?.coverUrl) return result
    }

    // Fallback: search by title + author
    return await searchByTitleAuthor(params.title, params.author)
  } catch {
    // silent-catch-ok: Open Library is best-effort, import proceeds without it
    return {}
  }
}

/**
 * Fetch cover image as a Blob. Returns null if unavailable.
 */
export async function fetchCoverImage(coverUrl: string): Promise<Blob | null> {
  try {
    const response = await fetchWithTimeout(coverUrl)
    if (!response.ok) return null
    return await response.blob()
  } catch {
    // silent-catch-ok: cover is best-effort
    return null
  }
}

async function searchByIsbn(isbn: string): Promise<OpenLibraryResult | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
  const response = await fetchWithTimeout(url)
  if (!response.ok) return null

  const data = await response.json()
  const entry = data[`ISBN:${isbn}`]
  if (!entry) return null

  return {
    coverUrl: entry.cover?.large || entry.cover?.medium,
    description:
      typeof entry.excerpts?.[0]?.text === 'string'
        ? entry.excerpts[0].text
        : undefined,
    subjects: entry.subjects?.map((s: { name: string }) => s.name).slice(0, 5),
  }
}

async function searchByTitleAuthor(
  title: string,
  author: string
): Promise<OpenLibraryResult> {
  const params = new URLSearchParams({
    title: title,
    author: author,
    limit: '1',
  })
  const url = `https://openlibrary.org/search.json?${params}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) return {}

  const data = await response.json()
  const doc = data.docs?.[0]
  if (!doc) return {}

  const coverId = doc.cover_i
  return {
    coverUrl: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : undefined,
    subjects: doc.subject?.slice(0, 5),
  }
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  )
}
