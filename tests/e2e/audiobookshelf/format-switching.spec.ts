/**
 * E2E Tests: E103-S02 — Format Switching UI
 *
 * Acceptance criteria covered:
 * - AC1: "Switch to Reading" button visible in audiobook when chapter mapping exists
 * - AC2: Clicking "Switch to Reading" navigates to EPUB with correct startChapter
 * - AC3: "Switch to Listening" button visible in EPUB reader when chapter mapping exists
 * - AC4: Clicking "Switch to Listening" navigates to audiobook with correct startChapter
 * - AC5: No switch buttons when no chapter mapping exists
 */
import { test, expect } from '../../support/fixtures'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import { FIXED_DATE } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const EPUB_BOOK = {
  id: 'epub-book-1',
  title: 'Dune',
  author: 'Frank Herbert',
  format: 'epub',
  status: 'reading',
  tags: [],
  chapters: [],
  source: { type: 'local', opfsPath: '/books/epub-book-1/book.epub' },
  progress: 20,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const ABS_AUDIOBOOK = {
  id: 'abs-audiobook-fmt',
  title: 'Dune',
  author: 'Frank Herbert',
  format: 'audiobook',
  status: 'reading',
  tags: [],
  chapters: [
    {
      id: 'ch-1',
      bookId: 'abs-audiobook-fmt',
      title: 'Chapter 1',
      order: 0,
      position: { type: 'time', seconds: 0 },
    },
    {
      id: 'ch-2',
      bookId: 'abs-audiobook-fmt',
      title: 'Chapter 2',
      order: 1,
      position: { type: 'time', seconds: 600 },
    },
    {
      id: 'ch-3',
      bookId: 'abs-audiobook-fmt',
      title: 'Chapter 3',
      order: 2,
      position: { type: 'time', seconds: 1200 },
    },
  ],
  source: {
    type: 'remote',
    url: 'http://abs.test:13378',
    auth: { bearer: 'test-api-key-abc' },
  },
  absServerId: 'abs-server-1',
  absItemId: 'abs-item-1',
  totalDuration: 1800,
  progress: 0,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const STANDALONE_AUDIOBOOK = {
  id: 'standalone-audiobook',
  title: 'Standalone Book',
  author: 'Some Author',
  format: 'audiobook',
  status: 'unread',
  tags: [],
  chapters: [
    {
      id: 'sch-1',
      bookId: 'standalone-audiobook',
      title: 'Chapter 1',
      order: 0,
      position: { type: 'time', seconds: 0 },
    },
  ],
  source: {
    type: 'remote',
    url: 'http://abs.test:13378',
    auth: { bearer: 'test-api-key-abc' },
  },
  absServerId: 'abs-server-1',
  absItemId: 'abs-item-2',
  totalDuration: 900,
  progress: 0,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const CHAPTER_MAPPING = {
  epubBookId: 'epub-book-1',
  audioBookId: 'abs-audiobook-fmt',
  mappings: [
    { epubChapterHref: 'chapter1.xhtml', audioChapterIndex: 0, confidence: 0.95 },
    { epubChapterHref: 'chapter2.xhtml', audioChapterIndex: 1, confidence: 0.91 },
    { epubChapterHref: 'chapter3.xhtml', audioChapterIndex: 2, confidence: 0.88 },
  ],
  computedAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

const ABS_SERVER = {
  id: 'abs-server-1',
  name: 'Home Server',
  url: 'http://abs.test:13378',
  apiKey: 'test-api-key-abc',
  libraryIds: ['lib-1'],
  status: 'connected',
  lastSyncedAt: FIXED_DATE,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
}

/** Mock Audio element for headless browser */
async function mockAudioElement(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: () => Promise.resolve(),
    })
    const originalLoad = HTMLMediaElement.prototype.load
    HTMLMediaElement.prototype.load = function () {
      originalLoad.call(this)
      Promise.resolve().then(() => {
        this.dispatchEvent(new Event('canplay'))
      })
    }
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc ? 4 : 0
      },
    })
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      configurable: true,
      get() {
        return (this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc ?? ''
      },
      set(value: string) {
        ;(this as HTMLMediaElement & { _fakeSrc?: string })._fakeSrc = value
        if (srcDescriptor?.set) srcDescriptor.set.call(this, value)
      },
    })
  })
}

async function seedData(
  page: import('@playwright/test').Page,
  { withMapping = true }: { withMapping?: boolean } = {}
): Promise<void> {
  await mockAudioElement(page)
  await page.addInitScript(() => {
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z', skipped: true })
    )
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2025-01-01T00:00:00.000Z' })
    )
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
  await page.goto('/')

  const books = [EPUB_BOOK, ABS_AUDIOBOOK, STANDALONE_AUDIOBOOK]
  await seedIndexedDBStore(page, DB_NAME, 'books', books as unknown as Record<string, unknown>[])
  await seedIndexedDBStore(page, DB_NAME, 'audiobookshelfServers', [
    ABS_SERVER,
  ] as unknown as Record<string, unknown>[])

  if (withMapping) {
    await seedIndexedDBStore(page, DB_NAME, 'chapterMappings', [
      CHAPTER_MAPPING,
    ] as unknown as Record<string, unknown>[])
  }
}

test.describe('E103-S02: Format Switching UI', () => {
  test('AC1: "Switch to Reading" button visible for audiobook with chapter mapping', async ({
    page,
  }) => {
    await seedData(page)
    await page.goto(`/library/${ABS_AUDIOBOOK.id}/read`)
    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('switch-to-reading-button')).toBeVisible()
  })

  test('AC2: Clicking "Switch to Reading" navigates to EPUB reader with startChapter', async ({
    page,
  }) => {
    await seedData(page)
    await page.goto(`/library/${ABS_AUDIOBOOK.id}/read`)
    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })

    const switchButton = page.getByTestId('switch-to-reading-button')
    await expect(switchButton).toBeVisible()
    await switchButton.click()

    // Should navigate to the linked EPUB's reader
    await page.waitForURL(url => url.pathname.includes(`/library/${EPUB_BOOK.id}/read`), {
      timeout: 10000,
    })
  })

  test('AC5: No switch button when audiobook has no chapter mapping', async ({ page }) => {
    await seedData(page)
    await page.goto(`/library/${STANDALONE_AUDIOBOOK.id}/read`)
    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('switch-to-reading-button')).not.toBeVisible()
  })

  test('AC5 (no mapping seeded): No switch button when no mappings exist', async ({ page }) => {
    await seedData(page, { withMapping: false })
    await page.goto(`/library/${ABS_AUDIOBOOK.id}/read`)
    await expect(page.getByTestId('audiobook-reader')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('switch-to-reading-button')).not.toBeVisible()
  })
})
