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
