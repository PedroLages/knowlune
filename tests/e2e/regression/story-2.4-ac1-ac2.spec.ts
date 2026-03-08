import { FIXED_DATE, getRelativeDate } from './../../utils/test-time'
/**
 * Story 2.4: PDF Viewer with Page Navigation — ATDD Acceptance Tests (AC1-AC2)
 *
 * RED PHASE: All tests are expected to FAIL until implementation is complete.
 *
 * Tests verify:
 *   - AC1: PDF rendering with page navigation and keyboard controls
 *   - AC2: Zoom controls and text selection
 *
 * Data seeding:
 *   - Uses static course data (allCourses) with known PDF resources
 *   - Progress seeded via localStorage fixture
 *
 * Reference: TEA knowledge base - test-quality.md, selector-resilience.md
 */
import { test, expect } from '../../support/fixtures'
import type { Page } from '@playwright/test'
import { navigateAndWait } from '../../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Constants — known course/lesson with PDF resources
// ---------------------------------------------------------------------------

/** Course and lesson IDs from operative-six.ts that have PDF resources */
const COURSE_ID = 'operative-six'
const LESSON_WITH_PDF = 'op6-introduction' // has both video + 1-page PDF
const LESSON_PLAYER_URL = `/courses/${COURSE_ID}/${LESSON_WITH_PDF}`

/** Lesson with multi-page PDFs in Materials tab (for navigation tests) */
const LESSON_MULTI_PAGE_PDF = 'op6-resources' // PDF-only, Materials tab has 29-page handbook
const MULTI_PDF_URL = `/courses/${COURSE_ID}/${LESSON_MULTI_PAGE_PDF}`

// On tablet (768px), the sidebar Sheet opens by default on fresh visits,
// covering main content. Dismiss it before tests interact with page elements.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })
})

/** Navigate to lesson, click Materials tab, and wait for first PDF to fully load. */
async function openPdfViewer(page: Page, url = LESSON_PLAYER_URL) {
  await navigateAndWait(page, url)
  await page.getByRole('tab', { name: /materials/i }).click()
  // Wait for react-pdf to finish loading the document (totalPages > 0)
  const materialsPanel = page.getByRole('tabpanel', { name: /materials/i })
  await expect(materialsPanel.getByTestId('pdf-total-pages').first()).not.toHaveText('0', {
    timeout: 15000,
  })
}

/** Get the first PdfViewer inside the Materials tab panel. */
function materialsPdfViewer(page: Page) {
  return page
    .getByRole('tabpanel', { name: /materials/i })
    .getByTestId('pdf-viewer')
    .first()
}

// ===========================================================================
// AC1: PDF Rendering with Page Navigation
// ===========================================================================

test.describe('AC1: PDF Rendering and Page Navigation', () => {
  test('should render PDF viewer with react-pdf (not iframe)', async ({ page }) => {
    // GIVEN: A lesson with a PDF resource
    await navigateAndWait(page, LESSON_PLAYER_URL)

    // WHEN: The materials tab is selected
    await page.getByRole('tab', { name: /materials/i }).click()

    // THEN: PDF viewer renders using react-pdf (Document/Page components, not iframe)
    const pdfViewer = page.getByTestId('pdf-viewer')
    await expect(pdfViewer).toBeVisible()

    // And it should NOT use an iframe
    const iframes = pdfViewer.locator('iframe')
    await expect(iframes).toHaveCount(0)
  })

  test('should display page navigation showing current page and total pages', async ({ page }) => {
    // GIVEN: PDF viewer is rendered and loaded (multi-page for indicator testing)
    await openPdfViewer(page, MULTI_PDF_URL)

    // THEN: Page indicator shows current page input and total pages text
    const pdfViewer = materialsPdfViewer(page)
    const pageInput = pdfViewer.getByTestId('pdf-page-input')
    await expect(pageInput).toHaveValue('1')
    const totalPages = pdfViewer.getByTestId('pdf-total-pages')
    const total = await totalPages.textContent()
    expect(Number(total)).toBeGreaterThan(1)
  })

  test('should navigate to next page when clicking next button', async ({ page }) => {
    // GIVEN: PDF viewer on page 1, fully loaded (multi-page PDF)
    await openPdfViewer(page, MULTI_PDF_URL)

    const pdfViewer = materialsPdfViewer(page)
    const pageInput = pdfViewer.getByTestId('pdf-page-input')
    await expect(pageInput).toHaveValue('1')

    // WHEN: User clicks the next page button
    await pdfViewer.getByTestId('pdf-next-page').click()

    // THEN: Page advances to 2
    await expect(pageInput).toHaveValue('2')
  })

  test('should navigate to previous page when clicking prev button', async ({ page }) => {
    // GIVEN: PDF viewer on page 2, fully loaded (multi-page PDF)
    await openPdfViewer(page, MULTI_PDF_URL)

    const pdfViewer = materialsPdfViewer(page)
    // Navigate to page 2 first
    await pdfViewer.getByTestId('pdf-next-page').click()
    const pageInput = pdfViewer.getByTestId('pdf-page-input')
    await expect(pageInput).toHaveValue('2')

    // WHEN: User clicks previous page button
    await pdfViewer.getByTestId('pdf-prev-page').click()

    // THEN: Page goes back to 1
    await expect(pageInput).toHaveValue('1')
  })

  test('should support keyboard navigation with PageDown', async ({ page }) => {
    // GIVEN: PDF viewer is focused, fully loaded (multi-page PDF)
    await openPdfViewer(page, MULTI_PDF_URL)

    const pdfViewer = materialsPdfViewer(page)
    await pdfViewer.focus()

    // WHEN: User presses PageDown
    await page.keyboard.press('PageDown')

    // THEN: Page advances
    const pageInput = pdfViewer.getByTestId('pdf-page-input')
    await expect(pageInput).toHaveValue('2')
  })

  test('should support keyboard navigation with PageUp', async ({ page }) => {
    // GIVEN: PDF viewer focused on page 2, fully loaded (multi-page PDF)
    await openPdfViewer(page, MULTI_PDF_URL)

    const pdfViewer = materialsPdfViewer(page)
    await pdfViewer.focus()
    await page.keyboard.press('PageDown')

    // WHEN: User presses PageUp
    await page.keyboard.press('PageUp')

    // THEN: Page goes back
    const pageInput = pdfViewer.getByTestId('pdf-page-input')
    await expect(pageInput).toHaveValue('1')
  })

  test('should navigate to first page with Home key', async ({ page }) => {
    // GIVEN: PDF viewer on a later page, fully loaded (multi-page PDF)
    await openPdfViewer(page, MULTI_PDF_URL)

    const pdfViewer = materialsPdfViewer(page)
    await pdfViewer.focus()
    await page.keyboard.press('PageDown')
    await page.keyboard.press('PageDown')

    // WHEN: User presses Home
    await page.keyboard.press('Home')

    // THEN: Returns to page 1
    const pageInput = pdfViewer.getByTestId('pdf-page-input')
    await expect(pageInput).toHaveValue('1')
  })

  test('should navigate to last page with End key', async ({ page }) => {
    // GIVEN: PDF viewer is focused, fully loaded (multi-page PDF)
    await openPdfViewer(page, MULTI_PDF_URL)

    const pdfViewer = materialsPdfViewer(page)
    await pdfViewer.focus()

    // WHEN: User presses End
    await page.keyboard.press('End')

    // THEN: Page input shows the last page (value matches total)
    const pageInput = pdfViewer.getByTestId('pdf-page-input')
    const totalPages = pdfViewer.getByTestId('pdf-total-pages')
    const total = await totalPages.textContent()
    await expect(pageInput).toHaveValue(total!.trim())
  })

  test('should have accessible PDF viewer with role=document', async ({ page }) => {
    // GIVEN: PDF viewer rendered
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    // THEN: PDF viewer has document role and aria-label
    const pdfViewer = page.getByTestId('pdf-viewer')
    await expect(pdfViewer).toHaveAttribute('role', 'document')
    const ariaLabel = await pdfViewer.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()
  })

  test('should have toolbar with role=toolbar', async ({ page }) => {
    // GIVEN: PDF viewer rendered
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    // THEN: Toolbar element exists with proper role
    const toolbar = page.getByTestId('pdf-toolbar')
    await expect(toolbar).toHaveAttribute('role', 'toolbar')
  })
})

// ===========================================================================
// AC2: Zoom Controls and Text Selection
// ===========================================================================

test.describe('AC2: Zoom Controls and Text Selection', () => {
  test('should display zoom controls', async ({ page }) => {
    // GIVEN: PDF viewer rendered
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    // THEN: Zoom controls are visible
    await expect(page.getByTestId('pdf-zoom-in')).toBeVisible()
    await expect(page.getByTestId('pdf-zoom-out')).toBeVisible()
    await expect(page.getByTestId('pdf-zoom-select')).toBeVisible()
  })

  test('should have fit-width option in zoom controls', async ({ page }, testInfo) => {
    // Fit-width button uses `hidden sm:inline-flex` — hidden on viewports < 640px
    test.skip(
      testInfo.project.name.startsWith('Mobile'),
      'Fit-width button hidden on mobile viewports'
    )

    // GIVEN: PDF viewer rendered
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    // THEN: Fit-width button is available
    await expect(page.getByTestId('pdf-fit-width')).toBeVisible()
  })

  test('should have fit-page option in zoom controls', async ({ page }, testInfo) => {
    // Fit-page button uses `hidden sm:inline-flex` — hidden on viewports < 640px
    test.skip(
      testInfo.project.name.startsWith('Mobile'),
      'Fit-page button hidden on mobile viewports'
    )

    // GIVEN: PDF viewer rendered
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    // THEN: Fit-page button is available
    await expect(page.getByTestId('pdf-fit-page')).toBeVisible()
  })

  test('should zoom in when clicking zoom-in button', async ({ page }) => {
    // GIVEN: PDF viewer at default zoom
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    const zoomSelect = page.getByTestId('pdf-zoom-select')
    const initialZoom = await zoomSelect.textContent()

    // WHEN: User clicks zoom in
    await page.getByTestId('pdf-zoom-in').click()

    // THEN: Zoom level increases
    const newZoom = await zoomSelect.textContent()
    expect(newZoom).not.toBe(initialZoom)
  })

  test('should zoom in with keyboard shortcut (+)', async ({ page }) => {
    // GIVEN: PDF viewer is focused
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    const pdfViewer = page.getByTestId('pdf-viewer')
    await pdfViewer.focus()

    const zoomSelect = page.getByTestId('pdf-zoom-select')
    const initialZoom = await zoomSelect.textContent()

    // WHEN: User presses + key
    await page.keyboard.press('+')

    // THEN: Zoom level increases
    const newZoom = await zoomSelect.textContent()
    expect(newZoom).not.toBe(initialZoom)
  })

  test('should zoom out with keyboard shortcut (-)', async ({ page }) => {
    // GIVEN: PDF viewer focused, zoomed in first
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    const pdfViewer = page.getByTestId('pdf-viewer')
    await pdfViewer.focus()

    // Zoom in first
    await page.keyboard.press('+')
    const zoomedIn = await page.getByTestId('pdf-zoom-select').textContent()

    // WHEN: User presses - key
    await page.keyboard.press('-')

    // THEN: Zoom level decreases
    const zoomedOut = await page.getByTestId('pdf-zoom-select').textContent()
    expect(zoomedOut).not.toBe(zoomedIn)
  })

  test('should render text layer for text selection', async ({ page }) => {
    // GIVEN: PDF viewer rendered and loaded
    await openPdfViewer(page)

    // THEN: Text layer element exists within the PDF page
    const textLayer = page.locator('.react-pdf__Page__textContent')
    await expect(textLayer.first()).toBeVisible()
  })

  test('should have Open in New Tab button', async ({ page }) => {
    // GIVEN: PDF viewer rendered
    await navigateAndWait(page, LESSON_PLAYER_URL)
    await page.getByRole('tab', { name: /materials/i }).click()

    // THEN: Open in new tab button is available
    const openBtn = page.getByTestId('pdf-open-new-tab')
    await expect(openBtn).toBeVisible()
    await expect(openBtn).toHaveAttribute('aria-label', /open.*new tab/i)
  })
})
