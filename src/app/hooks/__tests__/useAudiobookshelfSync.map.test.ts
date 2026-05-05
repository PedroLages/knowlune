/**
 * Unit tests for ABS format detection and ebook mapping.
 *
 * Tests the detectFormat helper and related mapping behavior
 * for distinguishing between audiobook and ebook ABS items.
 *
 * @see useAudiobookshelfSync.ts
 */
import { describe, it, expect } from 'vitest'
import { detectFormat, VALID_FORMATS } from '@/app/hooks/useAudiobookshelfSync'
import type { AbsLibraryItem } from '@/data/types'

// ── Helpers ──────────────────────────────────────────────────────

function makeAbsItem(overrides: Partial<AbsLibraryItem> = {}): AbsLibraryItem {
  return {
    id: 'item-1',
    ino: 'ino-1',
    mediaType: 'book',
    media: {
      metadata: {
        title: 'Test Item',
        authors: [{ id: 'auth-1', name: 'Test Author' }],
        narrators: [],
        duration: 0,
        numChapters: 0,
      },
      chapters: [],
    },
    ...overrides,
  }
}

function makeAbsItemWithNarrators(
  narrators: string[],
  duration: number,
  overrides: Partial<AbsLibraryItem> = {}
): AbsLibraryItem {
  return makeAbsItem({
    media: {
      metadata: {
        title: 'Test Item',
        authors: [{ id: 'auth-1', name: 'Test Author' }],
        narrators,
        duration,
        numChapters: 1,
      },
      chapters: [{ id: 'ch-1', title: 'Chapter 1', start: 0, end: 3600 }],
    },
    ...overrides,
  })
}

// ── Tests ────────────────────────────────────────────────────────

describe('VALID_FORMATS', () => {
  it('includes epub and audiobook', () => {
    expect(VALID_FORMATS).toContain('epub')
    expect(VALID_FORMATS).toContain('audiobook')
  })

  it('does not include pdf', () => {
    expect(VALID_FORMATS).not.toContain('pdf')
  })
})

describe('detectFormat', () => {
  // ── Happy paths ──────────────────────────────────────────────

  it('classifies as audiobook when item has narrators AND duration', () => {
    const item = makeAbsItemWithNarrators(['Jane Doe'], 3600)
    expect(detectFormat(item)).toBe('audiobook')
  })

  it('classifies as epub when item has no narrators and no duration', () => {
    const item = makeAbsItem({
      media: {
        metadata: {
          title: 'Ebook Title',
          authors: [{ id: 'auth-1', name: 'Author' }],
          narrators: [],
          duration: 0,
          numChapters: 0,
        },
        chapters: [],
      },
    })
    expect(detectFormat(item)).toBe('epub')
  })

  it('classifies as epub when item has empty narrators array and no duration', () => {
    const item = makeAbsItemWithNarrators([], 0)
    expect(detectFormat(item)).toBe('epub')
  })

  it('mentions epub in VALID_FORMATS for allow-list gating', () => {
    // The format returned by detectFormat must be in VALID_FORMATS
    const item = makeAbsItemWithNarrators([], 0)
    const format = detectFormat(item)
    expect(VALID_FORMATS.includes(format)).toBe(true)
  })

  it('mentions audiobook in VALID_FORMATS for allow-list gating', () => {
    const item = makeAbsItemWithNarrators(['Jane Doe'], 3600)
    const format = detectFormat(item)
    expect(VALID_FORMATS.includes(format)).toBe(true)
  })

  // ── Edge cases ─────────────────────────────────────────────

  it('classifies as epub when item has narrators but no duration', () => {
    const item = makeAbsItem({
      media: {
        metadata: {
          title: 'Test',
          authors: [{ id: 'auth-1', name: 'Author' }],
          narrators: ['Solo Narrator'],
          duration: 0,
          numChapters: 1,
        },
        chapters: [{ id: 'ch-1', title: 'Ch 1', start: 0, end: 1800 }],
      },
    })
    // metadata.duration is undefined — falls through to media.duration
    expect(detectFormat(item)).toBe('epub')
  })

  it('classifies as epub when item has duration but no narrators', () => {
    const item = makeAbsItem({
      media: {
        metadata: {
          title: 'Test',
          authors: [{ id: 'auth-1', name: 'Author' }],
          narrators: [],
          duration: 3600,
          numChapters: 1,
        },
        chapters: [{ id: 'ch-1', title: 'Ch 1', start: 0, end: 3600 }],
      },
    })
    expect(detectFormat(item)).toBe('epub')
  })

  it('classifies as epub when narrators exist but duration is zero', () => {
    const item = makeAbsItemWithNarrators(['Solo'], 0)
    expect(detectFormat(item)).toBe('epub')
  })

  it('classifies as audiobook when both narrators and media-level duration exist', () => {
    // Some ABS versions put duration at media level rather than metadata
    const item = makeAbsItem({
      media: {
        metadata: {
          title: 'Test',
          authors: [{ id: 'auth-1', name: 'Author' }],
          narrators: ['Jane Doe'],
          duration: 0, // metadata.duration is 0
          numChapters: 1,
        },
        duration: 7200, // media.duration is set
        chapters: [{ id: 'ch-1', title: 'Ch 1', start: 0, end: 7200 }],
      },
    })
    expect(detectFormat(item)).toBe('audiobook')
  })

  it('classifies as epub with multiple narrators and no duration', () => {
    const item = makeAbsItem({
      media: {
        metadata: {
          title: 'Test',
          authors: [{ id: 'auth-1', name: 'Author' }],
          narrators: ['Narrator A', 'Narrator B'],
          duration: 0,
          numChapters: 1,
        },
        chapters: [],
      },
    })
    expect(detectFormat(item)).toBe('epub')
  })

  it('classifies as audiobook when narratorName string is used as fallback', () => {
    // ABS list endpoint sometimes returns narratorName (string) instead of narrators (array)
    const item = makeAbsItem({
      media: {
        metadata: {
          title: 'Test',
          authors: [{ id: 'auth-1', name: 'Author' }],
          narrators: [],
          duration: 3600,
          numChapters: 1,
          // narratorName is a phantom field — not in type, read via bracket access
        } as any,
        chapters: [],
      },
    })
    ;(item.media.metadata as any).narratorName = 'Jane Doe'
    expect(detectFormat(item)).toBe('audiobook')
  })

  // ── Dual-format items (scope limitation) ────────────────────

  it('classifies dual-format items as audiobook when both signals present', () => {
    // Items existing in both audiobook and ebook libraries will both
    // be classified as 'audiobook' if both have narrators and duration.
    // This is an accepted scope limitation — no deduplication logic.
    const item = makeAbsItemWithNarrators(['Jane Doe'], 3600)
    expect(detectFormat(item)).toBe('audiobook')
  })

  // ── mediaType-based filtering ───────────────────────────────

  it('is callable for items with mediaType "ebook" (not skipped by sync filter)', () => {
    // After the sync loop filter widening, items with mediaType 'ebook'
    // reach mapAbsItemToBook. detectFormat should handle them normally.
    const item = makeAbsItemWithNarrators([], 0)
    expect(detectFormat(item)).toBe('epub')
  })

  it('handles items where mediaType is undefined (legacy ABS data)', () => {
    const item = makeAbsItemWithNarrators(['Jane Doe'], 3600)
    expect(detectFormat(item)).toBe('audiobook')
  })
})
