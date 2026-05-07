import { FIXED_DATE } from '../../utils/test-time'

/** Minimal book rows for `library-tabs` E2E seeds (Dexie `books` store). */
export function tabSeedsBase() {
  return [
    {
      id: 'tab-test-book-1',
      title: 'Tab Test Novel',
      author: 'Tab Author',
      format: 'epub',
      status: 'finished',
      tags: [],
      chapters: [],
      source: { type: 'local' as const, opfsPath: '/test' },
      progress: 100,
      finishedAt: FIXED_DATE,
      totalPages: 320,
      rating: 4,
      createdAt: FIXED_DATE,
    },
    {
      id: 'tab-test-book-2',
      title: 'Continue Reading Book',
      author: 'Some Author',
      format: 'epub',
      status: 'reading',
      tags: [],
      chapters: [],
      source: { type: 'local' as const, opfsPath: '/test2' },
      progress: 45,
      lastOpenedAt: FIXED_DATE,
      createdAt: FIXED_DATE,
    },
    {
      id: 'tab-test-hero-unread',
      title: 'Hero Unread Ebook',
      author: 'Seed Author',
      format: 'epub',
      status: 'unread' as const,
      tags: [],
      chapters: [],
      source: { type: 'local' as const, opfsPath: '/test-hero' },
      progress: 0,
      createdAt: '2025-06-01T12:00:00.000Z',
    },
  ]
}

/** Seed with only audiobook-format books (no ebooks). */
export function tabSeedsAudiobooksOnly() {
  return [
    {
      id: 'tab-test-audio-only-1',
      title: 'Audio Only Book',
      author: 'Audiobook Author',
      format: 'audiobook',
      status: 'unread',
      tags: [],
      chapters: [],
      source: { type: 'local' as const, opfsPath: '/test-audio-1' },
      progress: 0,
      createdAt: FIXED_DATE,
    },
    {
      id: 'tab-test-audio-only-2',
      title: 'Continue Audio Book',
      author: 'Another Narrator',
      format: 'audiobook',
      status: 'reading',
      tags: [],
      chapters: [],
      source: { type: 'local' as const, opfsPath: '/test-audio-2' },
      progress: 30,
      createdAt: FIXED_DATE,
    },
  ]
}

/** Seed with only ebook-format books (epub/pdf, no audiobooks). */
export function tabSeedsEbooksOnly() {
  return [
    {
      id: 'tab-test-ebook-only-1',
      title: 'Ebook Only Novel',
      author: 'Ebook Author',
      format: 'epub',
      status: 'unread',
      tags: [],
      chapters: [],
      source: { type: 'local' as const, opfsPath: '/test-ebook-1' },
      progress: 0,
      createdAt: FIXED_DATE,
    },
    {
      id: 'tab-test-ebook-only-2',
      title: 'Continue Ebook',
      author: 'Another Author',
      format: 'pdf',
      status: 'reading',
      tags: [],
      chapters: [],
      source: { type: 'local' as const, opfsPath: '/test-ebook-2' },
      progress: 50,
      createdAt: FIXED_DATE,
    },
  ]
}

export function tabSeedsWithMixedAudiobook() {
  return [
    ...tabSeedsBase(),
    {
      id: 'tab-test-mixed-audiobook',
      title: 'Mixed Library Audio',
      author: 'Narrator',
      format: 'audiobook',
      status: 'unread' as const,
      tags: [],
      chapters: [],
      source: { type: 'local' as const, opfsPath: '/test-audio' },
      progress: 0,
      createdAt: FIXED_DATE,
    },
  ]
}
