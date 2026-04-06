/**
 * Unit tests for chapterSwitchResolver — pure functions for
 * resolving position when switching between EPUB and audiobook formats.
 *
 * @since E103-S03
 */

import { describe, it, expect } from 'vitest'
import {
  resolveAudioPositionFromEpub,
  resolveEpubPositionFromAudio,
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
        position: { type: 'cfi', value: '/2/4/1' },
      },
      {
        id: 'ch02.xhtml',
        bookId: 'epub-1',
        title: 'Chapter 2',
        order: 1,
        position: { type: 'cfi', value: '/2/4/2' },
      },
      {
        id: 'ch03.xhtml',
        bookId: 'epub-1',
        title: 'Chapter 3',
        order: 2,
        position: { type: 'cfi', value: '/2/4/3' },
      },
    ],
    source: { type: 'local', opfsPath: '/test.epub' },
    currentPosition: { type: 'cfi', value: '/2/4/2' },
    progress: 50,
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
      {
        id: 'ach-0',
        bookId: 'audio-1',
        title: 'Chapter 1',
        order: 0,
        position: { type: 'time', seconds: 0 },
      },
      {
        id: 'ach-1',
        bookId: 'audio-1',
        title: 'Chapter 2',
        order: 1,
        position: { type: 'time', seconds: 3600 },
      },
      {
        id: 'ach-2',
        bookId: 'audio-1',
        title: 'Chapter 3',
        order: 2,
        position: { type: 'time', seconds: 7200 },
      },
    ],
    source: { type: 'local', opfsPath: '/test.m4b' },
    currentPosition: { type: 'time', seconds: 4000 },
    totalDuration: 10800,
    progress: 37,
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

describe('resolveAudioPositionFromEpub', () => {
  it('returns audio chapter start time for matching EPUB chapter', () => {
    const epub = makeEpubBook({ currentPosition: { type: 'cfi', value: '/2/4/2' } })
    const audio = makeAudioBook()
    const mapping = makeMapping()

    const result = resolveAudioPositionFromEpub(epub, audio, mapping)

    expect(result).toEqual({ type: 'time', seconds: 3600 })
  })

  it('returns first chapter position when EPUB has no current position', () => {
    const epub = makeEpubBook({ currentPosition: undefined })
    const audio = makeAudioBook()
    const mapping = makeMapping()

    const result = resolveAudioPositionFromEpub(epub, audio, mapping)

    // Falls back to first mapped chapter
    expect(result).toEqual({ type: 'time', seconds: 0 })
  })

  it('returns null for empty mappings', () => {
    const epub = makeEpubBook()
    const audio = makeAudioBook()
    const mapping = makeMapping({ mappings: [] })

    const result = resolveAudioPositionFromEpub(epub, audio, mapping)

    expect(result).toBeNull()
  })

  it('returns null when formats are wrong', () => {
    const epub = makeEpubBook({ format: 'audiobook' } as Partial<Book>)
    const audio = makeAudioBook()
    const mapping = makeMapping()

    const result = resolveAudioPositionFromEpub(epub, audio, mapping)

    expect(result).toBeNull()
  })

  it('returns null when no mapping matches current chapter', () => {
    const epub = makeEpubBook({
      currentPosition: { type: 'cfi', value: '/2/4/99' },
      chapters: [
        {
          id: 'ch99.xhtml',
          bookId: 'epub-1',
          title: 'Chapter 99',
          order: 0,
          position: { type: 'cfi', value: '/2/4/99' },
        },
      ],
    })
    const audio = makeAudioBook()
    const mapping = makeMapping()

    const result = resolveAudioPositionFromEpub(epub, audio, mapping)

    expect(result).toBeNull()
  })
})

describe('resolveEpubPositionFromAudio', () => {
  it('returns EPUB chapter CFI for matching audio chapter', () => {
    const audio = makeAudioBook({ currentPosition: { type: 'time', seconds: 4000 } })
    const epub = makeEpubBook()
    const mapping = makeMapping()

    const result = resolveEpubPositionFromAudio(audio, epub, mapping)

    // At 4000s, user is in chapter index 1 (starts at 3600s)
    expect(result).toEqual({ type: 'cfi', value: '/2/4/2' })
  })

  it('returns first chapter when audio position is at start', () => {
    const audio = makeAudioBook({ currentPosition: { type: 'time', seconds: 100 } })
    const epub = makeEpubBook()
    const mapping = makeMapping()

    const result = resolveEpubPositionFromAudio(audio, epub, mapping)

    expect(result).toEqual({ type: 'cfi', value: '/2/4/1' })
  })

  it('returns null for empty mappings', () => {
    const audio = makeAudioBook()
    const epub = makeEpubBook()
    const mapping = makeMapping({ mappings: [] })

    const result = resolveEpubPositionFromAudio(audio, epub, mapping)

    expect(result).toBeNull()
  })

  it('returns null when formats are wrong', () => {
    const audio = makeAudioBook({ format: 'epub' } as Partial<Book>)
    const epub = makeEpubBook()
    const mapping = makeMapping()

    const result = resolveEpubPositionFromAudio(audio, epub, mapping)

    expect(result).toBeNull()
  })

  it('returns first mapped chapter when audio has no current position', () => {
    const audio = makeAudioBook({ currentPosition: undefined })
    const epub = makeEpubBook()
    const mapping = makeMapping()

    const result = resolveEpubPositionFromAudio(audio, epub, mapping)

    // Falls back to first mapped chapter
    expect(result).toEqual({ type: 'cfi', value: '/2/4/1' })
  })
})

describe('position independence', () => {
  it('EPUB and audiobook positions are completely independent objects', () => {
    const epub = makeEpubBook({ currentPosition: { type: 'cfi', value: '/2/4/3' } })
    const audio = makeAudioBook({ currentPosition: { type: 'time', seconds: 1000 } })

    // Mutating audio position does not affect epub
    const originalEpubPos = { ...epub.currentPosition! }
    audio.currentPosition = { type: 'time', seconds: 9999 }

    expect(epub.currentPosition).toEqual(originalEpubPos)
  })

  it('resolving a target position does not modify the source book', () => {
    const epub = makeEpubBook({ currentPosition: { type: 'cfi', value: '/2/4/2' } })
    const audio = makeAudioBook()
    const mapping = makeMapping()
    const originalEpubPos = { ...epub.currentPosition! }

    resolveAudioPositionFromEpub(epub, audio, mapping)

    // Source book unchanged
    expect(epub.currentPosition).toEqual(originalEpubPos)
  })
})
