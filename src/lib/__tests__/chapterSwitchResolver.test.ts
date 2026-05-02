/**
 * Unit tests for chapterSwitchResolver — pure intra-chapter math for
 * resolving position when switching between EPUB and audiobook formats.
 *
 * @since E103 (Link Formats — Story B)
 */

import { describe, it, expect } from 'vitest'
import {
  resolveAudioPositionFromEpub,
  resolveEpubPositionFromAudio,
  type EpubLocations,
} from '../chapterSwitchResolver'
import type { Book, ChapterMappingRecord } from '@/data/types'

// -- Factories --

function makeEpubBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'epub-1',
    title: 'Test Book',
    author: 'Author',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [
      {
        id: 'ch01.xhtml',
        bookId: 'epub-1',
        title: 'Chapter 1',
        order: 0,
        position: { type: 'cfi', value: 'cfi-ch01' },
      },
      {
        id: 'ch02.xhtml',
        bookId: 'epub-1',
        title: 'Chapter 2',
        order: 1,
        position: { type: 'cfi', value: 'cfi-ch02' },
      },
      {
        id: 'ch03.xhtml',
        bookId: 'epub-1',
        title: 'Chapter 3',
        order: 2,
        position: { type: 'cfi', value: 'cfi-ch03' },
      },
    ],
    source: { type: 'local', opfsPath: '/test.epub' },
    progress: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeAudioBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'audio-1',
    title: 'Test Book',
    author: 'Author',
    format: 'audiobook',
    status: 'reading',
    tags: [],
    chapters: [
      { id: 'a0', bookId: 'audio-1', title: 'Ch 1', order: 0, position: { type: 'time', seconds: 0 } },
      { id: 'a1', bookId: 'audio-1', title: 'Ch 2', order: 1, position: { type: 'time', seconds: 3600 } },
      { id: 'a2', bookId: 'audio-1', title: 'Ch 3', order: 2, position: { type: 'time', seconds: 7200 } },
    ],
    source: { type: 'local', opfsPath: '/test.m4b' },
    totalDuration: 10800,
    progress: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeMapping(overrides: Partial<ChapterMappingRecord> = {}): ChapterMappingRecord {
  return {
    epubBookId: 'epub-1',
    audioBookId: 'audio-1',
    mappings: [
      { epubChapterHref: 'ch01.xhtml', audioChapterIndex: 0, confidence: 0.95 },
      { epubChapterHref: 'ch02.xhtml', audioChapterIndex: 1, confidence: 0.9 },
      { epubChapterHref: 'ch03.xhtml', audioChapterIndex: 2, confidence: 0.85 },
    ],
    computedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Mock EpubLocations with a deterministic CFI ↔ percentage mapping.
 * cfi-ch01 → 0.0, cfi-ch02 → 0.4, cfi-ch03 → 0.7, anything else → 0.5
 * cfiFromPercentage returns "cfi@<pct>" so tests can assert on it.
 */
function makeLocations(): EpubLocations {
  const cfiToPct: Record<string, number> = {
    'cfi-ch01': 0.0,
    'cfi-ch02': 0.4,
    'cfi-ch03': 0.7,
  }
  return {
    percentageFromCfi(cfi: string) {
      if (cfi in cfiToPct) return cfiToPct[cfi]
      // Mid-chapter CFI helper used by EPUB→Audio: "cfi-ch02-mid" → 0.5 (between 0.4 and 0.7)
      if (cfi === 'cfi-ch02-mid') return 0.55 // 50% through chapter 2 (0.4..0.7)
      if (cfi === 'cfi-ch01-quarter') return 0.1 // 25% through chapter 1 (0.0..0.4)
      return 0.5
    },
    cfiFromPercentage(pct: number) {
      return `cfi@${pct.toFixed(4)}`
    },
  }
}

describe('resolveEpubPositionFromAudio', () => {
  it('lands at the proportional CFI within the mapped EPUB chapter', () => {
    // Audio chapter 1 spans 3600..7200; user at 5400 = 50% through.
    // EPUB chapter 2 spans 0.4..0.7; 50% through = 0.55. cfiFromPercentage('0.5500')
    const result = resolveEpubPositionFromAudio({
      audioCurrentTime: 5400,
      audioBook: makeAudioBook(),
      audioChapterIndex: 1,
      epubBook: makeEpubBook(),
      mapping: makeMapping(),
      epubLocations: makeLocations(),
    })
    expect(result).toEqual({ targetCfi: 'cfi@0.5500' })
  })

  it('clamps at chapter start when current time is before the chapter', () => {
    const result = resolveEpubPositionFromAudio({
      audioCurrentTime: 0,
      audioBook: makeAudioBook(),
      audioChapterIndex: 1,
      epubBook: makeEpubBook(),
      mapping: makeMapping(),
      epubLocations: makeLocations(),
    })
    // chapterPct clamps to 0 → targetPct = 0.4 (chapter 2 start)
    expect(result).toEqual({ targetCfi: 'cfi@0.4000' })
  })

  it('returns null when locations are not yet generated', () => {
    expect(
      resolveEpubPositionFromAudio({
        audioCurrentTime: 5400,
        audioBook: makeAudioBook(),
        audioChapterIndex: 1,
        epubBook: makeEpubBook(),
        mapping: makeMapping(),
        epubLocations: null,
      })
    ).toBeNull()
  })

  it('returns null when no mapping exists for the current audio chapter', () => {
    const mapping = makeMapping({
      mappings: [{ epubChapterHref: 'ch01.xhtml', audioChapterIndex: 0, confidence: 0.95 }],
    })
    expect(
      resolveEpubPositionFromAudio({
        audioCurrentTime: 5400,
        audioBook: makeAudioBook(),
        audioChapterIndex: 1,
        epubBook: makeEpubBook(),
        mapping,
        epubLocations: makeLocations(),
      })
    ).toBeNull()
  })

  it('returns null when mapping confidence is below the floor', () => {
    const mapping = makeMapping({
      mappings: [{ epubChapterHref: 'ch02.xhtml', audioChapterIndex: 1, confidence: 0.5 }],
    })
    expect(
      resolveEpubPositionFromAudio({
        audioCurrentTime: 5400,
        audioBook: makeAudioBook(),
        audioChapterIndex: 1,
        epubBook: makeEpubBook(),
        mapping,
        epubLocations: makeLocations(),
      })
    ).toBeNull()
  })

  it('falls back through audioElementDuration for the last chapter', () => {
    const audio = makeAudioBook({ totalDuration: undefined })
    const result = resolveEpubPositionFromAudio({
      audioCurrentTime: 8100, // 50% through last chapter (7200..9000)
      audioBook: audio,
      audioChapterIndex: 2,
      epubBook: makeEpubBook(),
      mapping: makeMapping(),
      epubLocations: makeLocations(),
      audioElementDuration: 9000,
    })
    // EPUB chapter 3 spans 0.7..1.0; 50% → 0.85
    expect(result).toEqual({ targetCfi: 'cfi@0.8500' })
  })

  it('returns null when last-chapter end is fully indeterminate', () => {
    const audio = makeAudioBook({ totalDuration: undefined })
    expect(
      resolveEpubPositionFromAudio({
        audioCurrentTime: 8000,
        audioBook: audio,
        audioChapterIndex: 2,
        epubBook: makeEpubBook(),
        mapping: makeMapping(),
        epubLocations: makeLocations(),
      })
    ).toBeNull()
  })
})

describe('resolveAudioPositionFromEpub', () => {
  it('lands at proportional seconds with the default 3s lead-in subtracted', () => {
    // EPUB chapter 2 spans 0.4..0.7; user at 0.55 = 50% through.
    // Audio chapter 1 spans 3600..7200; 50% = 5400. With 3s lead-in → 5397.
    const result = resolveAudioPositionFromEpub({
      epubCurrentCfi: 'cfi-ch02-mid',
      epubBook: makeEpubBook(),
      epubChapterHref: 'ch02.xhtml',
      audioBook: makeAudioBook(),
      mapping: makeMapping(),
      epubLocations: makeLocations(),
    })
    expect(result?.targetSeconds).toBeCloseTo(5397, 6)
  })

  it('clamps to chapter start when lead-in would go before it', () => {
    // EPUB chapter 1 spans 0.0..0.4; user at 0.1 = 25% through.
    // Audio chapter 0 spans 0..3600; 25% = 900. With 3s lead-in → 897.
    const result = resolveAudioPositionFromEpub({
      epubCurrentCfi: 'cfi-ch01-quarter',
      epubBook: makeEpubBook(),
      epubChapterHref: 'ch01.xhtml',
      audioBook: makeAudioBook(),
      mapping: makeMapping(),
      epubLocations: makeLocations(),
    })
    expect(result?.targetSeconds).toBeCloseTo(897, 6)
  })

  it('honours a custom leadInSeconds value', () => {
    const result = resolveAudioPositionFromEpub({
      epubCurrentCfi: 'cfi-ch02-mid',
      epubBook: makeEpubBook(),
      epubChapterHref: 'ch02.xhtml',
      audioBook: makeAudioBook(),
      mapping: makeMapping(),
      epubLocations: makeLocations(),
      leadInSeconds: 0,
    })
    expect(result?.targetSeconds).toBeCloseTo(5400, 6)
  })

  it('clamps to chapter start when CFI is at the very start of the chapter', () => {
    const result = resolveAudioPositionFromEpub({
      epubCurrentCfi: 'cfi-ch02', // exactly at chapter 2 start (pct 0.4)
      epubBook: makeEpubBook(),
      epubChapterHref: 'ch02.xhtml',
      audioBook: makeAudioBook(),
      mapping: makeMapping(),
      epubLocations: makeLocations(),
    })
    // chapterPct = 0 → audio target = 3600. Lead-in subtracted → clamped to chapter start (3600).
    expect(result).toEqual({ targetSeconds: 3600 })
  })

  it('returns null when locations are not yet generated', () => {
    expect(
      resolveAudioPositionFromEpub({
        epubCurrentCfi: 'cfi-ch02-mid',
        epubBook: makeEpubBook(),
        epubChapterHref: 'ch02.xhtml',
        audioBook: makeAudioBook(),
        mapping: makeMapping(),
        epubLocations: null,
      })
    ).toBeNull()
  })

  it('returns null when no mapping exists for the current EPUB chapter', () => {
    const mapping = makeMapping({
      mappings: [{ epubChapterHref: 'ch01.xhtml', audioChapterIndex: 0, confidence: 0.95 }],
    })
    expect(
      resolveAudioPositionFromEpub({
        epubCurrentCfi: 'cfi-ch02-mid',
        epubBook: makeEpubBook(),
        epubChapterHref: 'ch02.xhtml',
        audioBook: makeAudioBook(),
        mapping,
        epubLocations: makeLocations(),
      })
    ).toBeNull()
  })

  it('returns null when mapping confidence is below the floor', () => {
    const mapping = makeMapping({
      mappings: [{ epubChapterHref: 'ch02.xhtml', audioChapterIndex: 1, confidence: 0.5 }],
    })
    expect(
      resolveAudioPositionFromEpub({
        epubCurrentCfi: 'cfi-ch02-mid',
        epubBook: makeEpubBook(),
        epubChapterHref: 'ch02.xhtml',
        audioBook: makeAudioBook(),
        mapping,
        epubLocations: makeLocations(),
      })
    ).toBeNull()
  })
})
