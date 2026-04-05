/**
 * M4B audiobook parser — lazy-loads music-metadata to extract chapters,
 * metadata, and cover art from M4B (MP4/AAC container) files.
 *
 * Zero impact on initial bundle: music-metadata (~200KB gzipped) is
 * dynamically imported only when the user imports an M4B file.
 *
 * @module M4bParserService
 * @since E88-S04
 */

import type { BookChapter } from '@/data/types'

export interface M4bMetadata {
  title: string
  author: string
  coverBlob: Blob | null
  totalDuration: number // seconds
  chapters: BookChapter[]
}

/**
 * Parse an M4B file to extract metadata and chapter markers.
 *
 * Lazy-loads the `music-metadata` library on first call.
 * Falls back to a single chapter spanning full duration when no
 * chapter markers are found.
 */
export async function parseM4bFile(file: File, bookId: string): Promise<M4bMetadata> {
  // Lazy-load music-metadata — only imported on M4B import
  const { parseBlob } = await import('music-metadata')
  const metadata = await parseBlob(file)

  // Extract basic metadata
  const title = metadata.common.title || file.name.replace(/\.m4b$/i, '')
  const author = metadata.common.artist || ''
  const totalDuration = metadata.format.duration || 0

  // Extract cover art
  let coverBlob: Blob | null = null
  if (metadata.common.picture && metadata.common.picture.length > 0) {
    const pic = metadata.common.picture[0]
    coverBlob = new Blob([new Uint8Array(pic.data)], { type: pic.format })
  }

  // Extract chapters from metadata
  let chapters: BookChapter[] = []

  // music-metadata v11+ exposes chapters on the result object
  // Use a type-safe interface and optional-chain to avoid fragile Record<string, unknown> casts
  interface RawChapter {
    title?: string
    sampleOffset?: number
    offset?: number
    startTime?: number
  }
  const metadataWithChapters = metadata as { chapters?: unknown }
  const rawChaptersCandidate = metadataWithChapters.chapters
  if (Array.isArray(rawChaptersCandidate) && rawChaptersCandidate.length > 0) {
    const rawChapters = rawChaptersCandidate as RawChapter[]

    chapters = rawChapters.map((ch, index) => {
      const startTime =
        ch.startTime ??
        (ch.sampleOffset != null && metadata.format.sampleRate
          ? ch.sampleOffset / metadata.format.sampleRate
          : (ch.offset ?? 0))

      return {
        id: crypto.randomUUID(),
        bookId,
        title: ch.title || `Chapter ${index + 1}`,
        order: index,
        position: { type: 'time' as const, seconds: startTime },
      }
    })
  }

  // Fallback: check iTunes native tags for chapter markers.
  // Only match well-known iTunes chapter tag IDs to avoid false positives from
  // unrelated tags that happen to contain 'chap' in their name.
  const ITUNES_CHAPTER_TAG_IDS = new Set(['CHAP', '©chp', 'chpl'])
  if (chapters.length === 0 && metadata.native?.['iTunes']) {
    const itunesTags = metadata.native['iTunes']
    const chapterTags = itunesTags.filter((tag: { id: string }) =>
      ITUNES_CHAPTER_TAG_IDS.has(tag.id)
    )

    if (chapterTags.length > 0) {
      chapters = chapterTags.map((tag: { id: string; value: unknown }, index: number) => {
        // iTunes chapter tags may have various formats
        const value = tag.value as Record<string, unknown> | string | number
        let startTime = 0
        if (typeof value === 'object' && value !== null && 'startTime' in value) {
          startTime = Number(value.startTime) || 0
        }

        const chTitle =
          typeof value === 'object' && value !== null && 'title' in value
            ? String(value.title)
            : `Chapter ${index + 1}`

        return {
          id: crypto.randomUUID(),
          bookId,
          title: chTitle,
          order: index,
          position: { type: 'time' as const, seconds: startTime },
        }
      })
    }
  }

  // Final fallback: no chapters found — create single chapter spanning full duration
  if (chapters.length === 0) {
    chapters = [
      {
        id: crypto.randomUUID(),
        bookId,
        title: title,
        order: 0,
        position: { type: 'time' as const, seconds: 0 },
      },
    ]
  }

  return {
    title,
    author,
    coverBlob,
    totalDuration,
    chapters,
  }
}
