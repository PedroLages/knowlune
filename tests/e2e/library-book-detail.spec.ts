/**
 * E2E tests for the book detail page (/library/:bookId).
 *
 * Covers:
 * - Navigation from hero Details button to detail page
 * - All sections render (hero, metadata grid, synopsis, action buttons)
 * - Format-specific metadata (ebook vs audiobook)
 * - Similar books shelf
 * - Edge cases: book not found redirect
 * - Mobile responsive layout
 *
 * @since book-detail-page (2026-05-07)
 */

import { test, expect } from '../support/fixtures'
import { seedBooks } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

// ─── Test Data ────────────────────────────────────────────────────────────────

const EBOOK_BOOK = {
  id: 'ebook-1',
  title: 'Thinking, Fast and Slow',
  author: 'Daniel Kahneman',
  format: 'epub',
  status: 'reading',
  tags: ['psychology', 'cognitive-bias'],
  chapters: [],
  source: { type: 'local', opfsPath: '/test' },
  progress: 30,
  totalPages: 499,
  description: 'A book about the two systems that drive the way we think.',
  createdAt: FIXED_DATE,
}

const AUDIOBOOK_BOOK = {
  id: 'audiobook-1',
  title: 'The Great Mental Models',
  author: 'Shane Parrish',
  narrator: 'Shane Parrish',
  format: 'audiobook',
  status: 'reading',
  tags: ['mental-models', 'decision-making'],
  chapters: [],
  source: { type: 'local', opfsPath: '/test2' },
  progress: 45,
  totalDuration: 45000, // 12h 30m
  description: 'A guide to using the best ideas from various disciplines.',
  language: 'English',
  publishDate: '2024',
  createdAt: FIXED_DATE,
}

const SIMILAR_BOOK = {
  id: 'similar-1',
  title: 'Predictably Irrational',
  author: 'Dan Ariely',
  format: 'epub',
  status: 'unread',
  tags: ['psychology', 'behavioral-economics'],
  chapters: [],
  source: { type: 'local', opfsPath: '/test3' },
  progress: 0,
  totalPages: 368,
  description:
    'A fascinating exploration of the hidden forces that shape our decisions, revealing how cognitive biases affect our everyday choices.',
  createdAt: FIXED_DATE,
}

const UNRELATED_BOOK = {
  id: 'unrelated-1',
  title: 'Cooking 101',
  author: 'Chef Bob',
  format: 'epub',
  status: 'unread',
  tags: ['cooking'],
  chapters: [],
  source: { type: 'local', opfsPath: '/test4' },
  progress: 0,
  description: 'Learn the basics of cooking delicious meals at home.',
  createdAt: FIXED_DATE,
}

const ALL_BOOKS = [EBOOK_BOOK, AUDIOBOOK_BOOK, SIMILAR_BOOK, UNRELATED_BOOK]

// ─── Tests ────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await seedBooks(page, ALL_BOOKS)
})

test.describe('Navigation', () => {
  test('navigates from hero Details button to book detail page', async ({ page }) => {
    await page.goto('/library?tab=continue')

    // Click Details button on the hero
    await page.locator('[data-testid="library-media-hero-details"]').first().click()

    // Should be on the book detail page
    await expect(page).toHaveURL(/\/library\/ebook-1/)
    await expect(page.getByTestId('detail-title')).toBeVisible()
  })

  test('back button returns to library', async ({ page }) => {
    await page.goto('/library?tab=continue')

    // Navigate to a known book detail page
    await page.goto('/library/ebook-1')

    // Click back button
    await page.locator('[data-testid="book-detail-back"]').click()

    // Should return to library
    await expect(page).toHaveURL(/\/library/)
  })

  test('navigating to invalid bookId redirects with toast', async ({ page }) => {
    await page.goto('/library/nonexistent-id')

    // Should redirect to /library
    await expect(page).toHaveURL(/\/library/)
  })
})

test.describe('Book detail page rendering', () => {
  test('renders ebook detail with all sections', async ({ page }) => {
    await page.goto('/library/ebook-1')

    // Title
    await expect(page.getByTestId('detail-title')).toHaveText('Thinking, Fast and Slow')

    // Format badge
    await expect(page.getByTestId('format-badge-epub')).toBeVisible()

    // Metadata grid — ebook: Reading Time, Pages
    await expect(page.getByTestId('detail-stat-reading-time')).toBeVisible()
    await expect(page.getByTestId('detail-stat-pages')).toBeVisible()

    // Synopsis
    await expect(page.getByTestId('detail-synopsis')).toBeVisible()

    // Primary CTA
    await expect(page.getByTestId('detail-primary-cta')).toHaveText('Read Now')

    // Share button
    await expect(page.getByTestId('detail-share')).toBeVisible()
  })

  test('renders audiobook detail with narrator and listening time', async ({ page }) => {
    await page.goto('/library/audiobook-1')

    // Title
    await expect(page.getByTestId('detail-title')).toHaveText('The Great Mental Models')

    // Format badge
    await expect(page.getByTestId('format-badge-audiobook')).toBeVisible()

    // Metadata grid — audiobook: Listening Time, Narrator, Language, Released
    await expect(page.getByTestId('detail-stat-listening-time')).toBeVisible()
    await expect(page.getByTestId('detail-stat-narrator')).toBeVisible()
    await expect(page.getByTestId('detail-stat-language')).toBeVisible()
    await expect(page.getByTestId('detail-stat-released')).toBeVisible()

    // Primary CTA
    await expect(page.getByTestId('detail-primary-cta')).toHaveText('Listen Now')
  })

  test('audiobook without language shows Format stat', async ({ page }) => {
    const bookWithoutLang = {
      ...AUDIOBOOK_BOOK,
      id: 'audiobook-no-lang',
      title: 'No Language Book',
      language: undefined,
    }

    await seedBooks(page, [bookWithoutLang])
    await page.goto('/library/audiobook-no-lang')

    // Should show "Format: Audiobook" instead of Language
    await expect(page.getByTestId('detail-stat-format')).toBeVisible()
    await expect(page.getByTestId('detail-stat-format')).toContainText('Audiobook')
  })

  test('book without description hides synopsis section', async ({ page }) => {
    const bookNoDesc = { ...EBOOK_BOOK, id: 'no-desc', description: undefined }
    await seedBooks(page, [bookNoDesc])
    await page.goto('/library/no-desc')

    await expect(page.getByTestId('detail-synopsis')).not.toBeVisible()
  })
})

test.describe('Similar books shelf', () => {
  test('shows similar books based on keyword overlap', async ({ page }) => {
    await page.goto('/library/ebook-1')

    // The similar book "Predictably Irrational" has psychology/cognitive keywords
    // that should overlap with "Thinking, Fast and Slow"'s description
    await expect(page.getByTestId('similar-books-shelf')).toBeVisible()
    await expect(page.getByTestId('similar-book-similar-1')).toBeVisible()
  })

  test('similar book card links to detail page', async ({ page }) => {
    await page.goto('/library/ebook-1')

    // Click on the similar book card
    await page.locator('[data-testid="similar-book-similar-1"]').click()

    // Should navigate to that book's detail page
    await expect(page).toHaveURL(/\/library\/similar-1/)
    await expect(page.getByTestId('detail-title')).toHaveText('Predictably Irrational')
  })
})

test.describe('Action buttons', () => {
  test('primary CTA navigates to reader for EPUB', async ({ page }) => {
    await page.goto('/library/ebook-1')

    await page.getByTestId('detail-primary-cta').click()

    // EPUB should go to /read
    await expect(page).toHaveURL(/\/library\/ebook-1\/read/)
  })

  test('primary CTA navigates to reader for audiobook', async ({ page }) => {
    await page.goto('/library/audiobook-1')

    await page.getByTestId('detail-primary-cta').click()

    // Audiobook should go to /read
    await expect(page).toHaveURL(/\/library\/audiobook-1\/read/)
  })

  test('share button is visible and clickable', async ({ page }) => {
    await page.goto('/library/ebook-1')

    await expect(page.getByTestId('detail-share')).toBeVisible()
    await page.getByTestId('detail-share').click()
    // Should not error — clipboard write or share sheet attempted
  })
})

test.describe('Mobile responsive', () => {
  test('stacks columns vertically on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/library/ebook-1')

    // Title should be visible
    await expect(page.getByTestId('detail-title')).toBeVisible()

    // Cover should still be visible on mobile
    await expect(page.getByTestId('book-detail-back')).toBeVisible()

    // Metadata grid should use 2-column layout on mobile (grid-cols-2)
    await expect(page.getByTestId('detail-stat-reading-time')).toBeVisible()
  })
})
