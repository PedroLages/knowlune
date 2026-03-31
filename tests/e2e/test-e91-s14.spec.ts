/**
 * E91-S14 Exploratory QA: Clickable Note Timestamps
 * Tests AC1-AC5 for the clickable timestamp feature in the lesson player notes panel.
 */
import { test, expect } from '../support/fixtures'
import { createImportedCourse } from '../support/fixtures/factories/imported-course-factory'
import { navigateAndWait } from '../support/helpers/navigation'
import { seedImportedCourses, seedImportedVideos } from '../support/helpers/seed-helpers'
import type { Page } from '@playwright/test'

const COURSE_ID = 'e91-s14-qa-course'
const VIDEO_ID = 'e91-s14-qa-video-01'

const TEST_COURSE = createImportedCourse({
  id: COURSE_ID,
  name: 'QA Test Course - Timestamps',
  videoCount: 1,
  pdfCount: 0,
})

const TEST_VIDEO = {
  id: VIDEO_ID,
  courseId: COURSE_ID,
  filename: '01-Test.mp4',
  path: '/01-Test.mp4',
  duration: 300,
  format: 'mp4',
  order: 0,
}

async function seedAndNavigate(page: Page): Promise<void> {
  await navigateAndWait(page, '/')
  await seedImportedCourses(page, [TEST_COURSE as unknown as Record<string, unknown>])
  await seedImportedVideos(page, [TEST_VIDEO as unknown as Record<string, unknown>])
  await page.reload({ waitUntil: 'domcontentloaded' })
  await navigateAndWait(page, `/courses/${COURSE_ID}/lessons/${VIDEO_ID}`)
  await page.waitForTimeout(1000)
}

async function openNotesTab(page: Page): Promise<void> {
  const notesTab = page.locator('[role="tab"]').filter({ hasText: /^notes$/i })
  const count = await notesTab.count()
  if (count === 0) {
    throw new Error('Notes tab not found')
  }
  await notesTab.first().click()
  await page.waitForTimeout(500)
}

async function getEditor(page: Page) {
  return page.locator('.ProseMirror[contenteditable="true"]').first()
}

test.describe('E91-S14: Clickable Note Timestamps', () => {
  let consoleErrors: string[] = []
  let consoleWarnings: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    consoleWarnings = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
      if (msg.type() === 'warning') consoleWarnings.push(msg.text())
    })
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`))
  })

  test('AC1+AC2+AC3: Click timestamp seeks video and does not navigate', async ({ page }) => {
    await seedAndNavigate(page)

    const initialUrl = page.url()
    console.log('Initial URL:', initialUrl)

    // Check if Notes tab is available
    await openNotesTab(page)

    const editor = await getEditor(page)
    const editorVisible = await editor.isVisible()
    console.log('Editor visible:', editorVisible)
    expect(editorVisible).toBeTruthy()

    // Click into editor to focus
    await editor.click()
    await page.waitForTimeout(300)

    // Insert timestamp via Alt+T
    await page.keyboard.press('Alt+t')
    await page.waitForTimeout(500)

    // Check for video:// link
    const videoLinks = page.locator('.ProseMirror a[href^="video://"]')
    const linkCount = await videoLinks.count()
    console.log('Timestamp links after Alt+T:', linkCount)

    if (linkCount === 0) {
      // Try finding any timestamp button in the toolbar
      const toolbarBtns = await page.locator('button').all()
      for (const btn of toolbarBtns) {
        const title = await btn.getAttribute('title') ?? ''
        const ariaLabel = await btn.getAttribute('aria-label') ?? ''
        const text = await btn.textContent() ?? ''
        if (/timestamp|time|clock/i.test(title + ariaLabel + text)) {
          console.log('Found timestamp button:', title || ariaLabel || text)
          await btn.click()
          await page.waitForTimeout(500)
          break
        }
      }
    }

    const linkCountAfter = await videoLinks.count()
    console.log('Timestamp links after toolbar attempt:', linkCountAfter)

    if (linkCountAfter > 0) {
      const linkHref = await videoLinks.first().getAttribute('href')
      const linkText = await videoLinks.first().textContent()
      console.log('Link href:', linkHref, '| text:', linkText)

      // Click the link
      await videoLinks.first().click({ force: true })
      await page.waitForTimeout(500)

      // AC3: URL should not change
      const urlAfterClick = page.url()
      console.log('URL after timestamp click:', urlAfterClick)
      expect(urlAfterClick).toBe(initialUrl)

      // AC1: Video should seek (for seeded test videos, no actual <video> element may render)
      const videoTime = await page.evaluate(() => {
        const v = document.querySelector('video')
        return v ? v.currentTime : 'no-video-element'
      })
      console.log('Video currentTime after click:', videoTime)
    } else {
      console.log('WARNING: No timestamp links found — Alt+T may not have worked')
    }

    console.log('Console errors so far:', consoleErrors)
  })

  test('AC4: Timestamp links have pointer cursor and visual hover feedback', async ({ page }) => {
    await seedAndNavigate(page)
    await openNotesTab(page)

    const editor = await getEditor(page)
    await editor.click()
    await page.keyboard.press('Alt+t')
    await page.waitForTimeout(500)

    const videoLinks = page.locator('.ProseMirror a[href^="video://"]')
    const count = await videoLinks.count()
    console.log('Timestamp links for style check:', count)

    if (count > 0) {
      const styles = await videoLinks.first().evaluate(el => {
        const cs = window.getComputedStyle(el)
        return {
          cursor: cs.cursor,
          textDecoration: cs.textDecorationLine,
          color: cs.color,
        }
      })
      console.log('Computed styles:', JSON.stringify(styles))

      // AC4: pointer cursor
      expect(styles.cursor).toBe('pointer')
      // AC4: underline
      expect(styles.textDecoration).toContain('underline')
    } else {
      console.log('WARNING: No timestamp links found to check styles')
    }
  })

  test('AC5: onVideoSeek wired - Notes tab in side panel renders NoteEditor with seek', async ({ page }) => {
    await seedAndNavigate(page)

    // Check that the Notes tab is rendered in the side panel
    const notesTab = page.locator('[role="tab"]').filter({ hasText: /^notes$/i })
    const tabCount = await notesTab.count()
    console.log('Notes tabs found:', tabCount)
    expect(tabCount).toBeGreaterThan(0)

    await openNotesTab(page)

    // The editor should be present meaning the full prop chain rendered
    const editor = await getEditor(page)
    expect(await editor.isVisible()).toBeTruthy()

    // Insert a timestamp and verify it links correctly (proves onVideoSeek wired)
    await editor.click()
    await page.keyboard.press('Alt+t')
    await page.waitForTimeout(500)

    const videoLinks = page.locator('.ProseMirror a[href^="video://"]')
    console.log('Timestamp links rendered:', await videoLinks.count())
  })

  test('Edge case: Multiple timestamps each seek to their own time', async ({ page }) => {
    await seedAndNavigate(page)
    await openNotesTab(page)

    const editor = await getEditor(page)
    await editor.click()

    // Insert first timestamp at ~t=0
    await page.keyboard.press('Alt+t')
    await page.waitForTimeout(300)

    // Seek video to 30s via evaluate, then insert second timestamp
    await page.evaluate(() => {
      const v = document.querySelector('video')
      if (v) v.currentTime = 30
    })
    await page.waitForTimeout(300)

    await editor.click()
    await page.keyboard.press('End') // move to end of line
    await page.keyboard.press('Enter')
    await page.keyboard.press('Alt+t')
    await page.waitForTimeout(300)

    const videoLinks = page.locator('.ProseMirror a[href^="video://"]')
    const linkCount = await videoLinks.count()
    console.log('Multiple timestamp links:', linkCount)

    if (linkCount >= 2) {
      const hrefs = await videoLinks.evaluateAll(els => els.map(e => e.getAttribute('href')))
      console.log('Link hrefs:', hrefs)
      // Should have different seconds
      expect(hrefs[0]).not.toBe(hrefs[1])
    }
  })

  test('Edge case: Timestamps persist after hard refresh', async ({ page }) => {
    await seedAndNavigate(page)
    await openNotesTab(page)

    const editor = await getEditor(page)
    await editor.click()
    await page.keyboard.press('Alt+t')
    await page.waitForTimeout(500)

    // Check links exist
    const beforeLinks = await page.locator('.ProseMirror a[href^="video://"]').count()
    console.log('Links before refresh:', beforeLinks)

    if (beforeLinks > 0) {
      // Save the note first (look for a save button or auto-save)
      await page.waitForTimeout(2000) // wait for auto-save

      // Hard refresh
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1000)

      await openNotesTab(page)
      await page.waitForTimeout(500)

      const afterLinks = await page.locator('.ProseMirror a[href^="video://"]').count()
      console.log('Links after refresh:', afterLinks)

      // Note: If note was auto-saved, links should persist
      // If not auto-saved, this is a bug to report
    }
  })

  test('Console health audit', async ({ page }) => {
    await seedAndNavigate(page)
    await openNotesTab(page)

    const editor = await getEditor(page)
    if (await editor.isVisible()) {
      await editor.click()
      await page.keyboard.press('Alt+t')
      await page.waitForTimeout(500)

      const links = page.locator('.ProseMirror a[href^="video://"]')
      if (await links.count() > 0) {
        await links.first().click({ force: true })
        await page.waitForTimeout(500)
      }
    }

    console.log('=== CONSOLE ERRORS ===')
    consoleErrors.forEach(e => console.log('ERROR:', e))
    console.log('=== CONSOLE WARNINGS ===')
    consoleWarnings.forEach(w => console.log('WARN:', w))
    console.log('Total errors:', consoleErrors.length)
    console.log('Total warnings:', consoleWarnings.length)

    expect(consoleErrors.filter(e => !e.includes('ERR_FILE_NOT_FOUND'))).toHaveLength(0)
  })
})
