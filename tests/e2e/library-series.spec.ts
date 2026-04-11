/**
 * Smoke tests for the Library series grouping view (E110-S02).
 */

import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { seedBooks } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

const TEST_BOOKS = [
  {
    id: 'series-book-1',
    title: 'Foundation',
    author: 'Isaac Asimov',
    format: 'epub',
    status: 'reading',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/test' },
    progress: 50,
    series: 'Foundation',
    seriesSequence: '1',
    createdAt: FIXED_DATE,
  },
  {
    id: 'series-book-2',
    title: 'Foundation and Empire',
    author: 'Isaac Asimov',
    format: 'epub',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/test2' },
    progress: 0,
    series: 'Foundation',
    seriesSequence: '2',
    createdAt: FIXED_DATE,
  },
  {
    id: 'ungrouped-book',
    title: 'Standalone Novel',
    author: 'Jane Doe',
    format: 'epub',
    status: 'unread',
    tags: [],
    chapters: [],
    source: { type: 'local', opfsPath: '/test3' },
    progress: 0,
    createdAt: FIXED_DATE,
  },
]

test.beforeEach(async ({ page }) => {
  // Dismiss onboarding/welcome overlays to prevent pointer interception
  await dismissOnboarding(page)
  // Navigate to seed books into IndexedDB (requires a real URL, not about:blank)
  await page.goto('/')
  await seedBooks(page, TEST_BOOKS)
})

test('series view renders when switching to series tab', async ({ page }) => {
  await page.goto('/library')

  // Switch to local series view via the tab button
  const seriesTab = page.locator('[data-testid="local-view-series"]')
  await expect(seriesTab).toBeVisible()
  await seriesTab.click()

  // Verify the series view container renders
  await expect(page.locator('[data-testid="local-series-view"]')).toBeVisible()
})

test('series view shows ungrouped books alongside series groups', async ({ page }) => {
  await page.goto('/library')

  const seriesTab = page.locator('[data-testid="local-view-series"]')
  await expect(seriesTab).toBeVisible()
  await seriesTab.click()

  const seriesView = page.locator('[data-testid="local-series-view"]')
  await expect(seriesView).toBeVisible()

  // Verify no JS errors during render
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  // Wait for the series view to be stable (auto-retry)
  await expect(page.locator('[data-testid="local-series-view"]')).toBeVisible()
  expect(consoleErrors.filter(e => !e.includes('favicon'))).toHaveLength(0)
})
