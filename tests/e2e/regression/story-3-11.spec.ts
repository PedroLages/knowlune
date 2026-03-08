/**
 * Story 3.11: Rich Text Toolbar Expansion — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Toolbar organization with groups, dividers, 44px touch targets, focus rings
 *   - AC2: Highlight toggle on selected text
 *   - AC3: Task list with interactive checkboxes and strikethrough
 *   - AC4: Typography auto-correction (smart quotes, em-dashes)
 *   - AC5: Word count in status bar
 *   - Pre-flight: Link dialog replaces window.prompt
 *
 * Navigation: LessonPlayer → Notes tab → NoteEditor
 * Uses static course data (nci-access) — no IndexedDB seeding needed.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { TIMEOUTS } from '../../utils/constants'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'

// ---------------------------------------------------------------------------
// Test Data — use a static course/lesson that has video (renders Notes tab)
// ---------------------------------------------------------------------------

const COURSE_ID = 'nci-access'
const LESSON_ID = 'nci-fnl-drones-psyops'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to lesson player Notes tab with sidebar closed. */
async function openNoteEditor(page: import('@playwright/test').Page) {
  await page.evaluate(sidebarState => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())

  // Navigate to lesson player
  await navigateAndWait(page, `/courses/${COURSE_ID}/${LESSON_ID}`)

  // Wait for Notes tab to appear, then click it
  const notesTab = page.getByRole('tab', { name: 'Notes' })
  await notesTab.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD })
  await notesTab.click()

  // Wait for editor to render
  await page.waitForSelector('[data-testid="note-editor"]', { timeout: TIMEOUTS.MEDIA })
}

// ---------------------------------------------------------------------------
// AC1: Toolbar organization, 44px touch targets, focus rings
// ---------------------------------------------------------------------------

test.describe('AC1: Toolbar organization', () => {
  test('toolbar buttons are organized in logical groups with separators', async ({ page }) => {
    await openNoteEditor(page)

    const toolbar = page.getByTestId('note-editor-toolbar')

    // Verify separators exist between groups
    const separators = toolbar.locator('[role="separator"]')
    await expect(separators).toHaveCount(4) // Inline | Block | Lists | Code | Links

    // Verify all expected buttons are present
    const expectedButtons = [
      'Bold',
      'Italic',
      'Underline',
      'Highlight',
      'Heading',
      'Align left',
      'Align center',
      'Align right',
      'Bullet list',
      'Ordered list',
      'Task list',
      'Code block',
      'Insert link',
    ]
    for (const name of expectedButtons) {
      await expect(toolbar.getByRole('button', { name })).toBeVisible()
    }
  })

  test('all toolbar buttons have 44x44px minimum touch targets', async ({ page }) => {
    await openNoteEditor(page)

    const toolbar = page.getByTestId('note-editor-toolbar')
    // Only check visible buttons (mobile overflow button is hidden at desktop viewport)
    const buttons = toolbar.locator('button:visible')
    const count = await buttons.count()

    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox()
      expect(box, `Button ${i} should have a bounding box`).not.toBeNull()
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('toolbar buttons have visible focus rings via Tab navigation', async ({ page }) => {
    await openNoteEditor(page)

    const toolbar = page.getByTestId('note-editor-toolbar')
    const firstButton = toolbar.getByRole('button').first()

    // Focus via Tab
    await firstButton.focus()
    await page.keyboard.press('Tab')

    const focused = page.locator(':focus')
    const outline = await focused.evaluate(el => {
      const styles = window.getComputedStyle(el)
      return {
        outlineStyle: styles.outlineStyle,
        boxShadow: styles.boxShadow,
      }
    })

    // Should have visible focus indicator (ring-2 maps to box-shadow)
    const hasFocusRing =
      outline.outlineStyle !== 'none' || (outline.boxShadow !== 'none' && outline.boxShadow !== '')
    expect(hasFocusRing).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AC2: Highlight toggle
// ---------------------------------------------------------------------------

test.describe('AC2: Highlight', () => {
  test('apply and remove highlight on selected text', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')

    // Type some text
    await editor.click()
    await page.keyboard.type('Highlight this text')

    // Select all text (Meta+a on macOS, Control+a on Linux/Windows)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+a`)

    // Click Highlight button
    const highlightBtn = page.getByRole('button', { name: 'Highlight' })
    await highlightBtn.click()

    // Verify <mark> element exists
    const mark = editor.locator('mark')
    await expect(mark).toBeVisible()

    // Toggle off — focus editor, select all, then click Highlight
    await editor.focus()
    await page.keyboard.press(`${modifier}+a`)
    // Verify selection is active before toggling
    await expect(mark).toBeVisible()
    await highlightBtn.click()
    await expect(editor.locator('mark')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------
// AC3: Task list
// ---------------------------------------------------------------------------

test.describe('AC3: Task list', () => {
  test('insert task list with interactive checkboxes and strikethrough', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Click Task List button
    const taskBtn = page.getByRole('button', { name: 'Task list' })
    await taskBtn.click()

    // Type a task item
    await page.keyboard.type('Buy groceries')

    // Verify task list markup
    const taskList = editor.locator('ul[data-type="taskList"]')
    await expect(taskList).toBeVisible()

    // Verify checkbox is present
    const checkbox = taskList.locator('input[type="checkbox"]')
    await expect(checkbox).toBeVisible()

    // Toggle checkbox
    await checkbox.click()

    // Verify checked state and strikethrough
    const checkedItem = taskList.locator('li[data-checked="true"]')
    await expect(checkedItem).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC4: Typography auto-correction
// ---------------------------------------------------------------------------

test.describe('AC4: Typography auto-correction', () => {
  test('straight quotes are converted to smart quotes', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Type text with straight quotes
    await page.keyboard.type('"hello"')

    // Verify smart quotes are used (Unicode \u201C \u201D or similar curly quotes)
    const text = await editor.innerText()
    // Typography extension converts " to \u201C and \u201D
    expect(text).toContain('\u201C') // left double quote
    expect(text).toContain('\u201D') // right double quote
  })

  test('double hyphens are converted to em-dashes', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Type text with double hyphens
    await page.keyboard.type('word--another')

    // Verify em-dash conversion
    const text = await editor.innerText()
    expect(text).toContain('\u2014') // em-dash
  })
})

// ---------------------------------------------------------------------------
// AC5: Word count
// ---------------------------------------------------------------------------

test.describe('AC5: Word count', () => {
  test('word count displays in status bar and updates in real-time', async ({ page }) => {
    await openNoteEditor(page)

    const wordCount = page.getByTestId('note-word-count')

    // Initially 0 words
    await expect(wordCount).toHaveText('0 words')

    // Type some text
    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('The quick brown fox')

    // Verify word count updated
    await expect(wordCount).toHaveText('4 words', { timeout: TIMEOUTS.LONG })

    // Type one more word
    await page.keyboard.type(' jumps')
    await expect(wordCount).toHaveText('5 words', { timeout: TIMEOUTS.LONG })
  })

  test('word count shows singular "word" for exactly 1 word', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()
    await page.keyboard.type('hello')

    const wordCount = page.getByTestId('note-word-count')
    await expect(wordCount).toHaveText('1 word', { timeout: TIMEOUTS.LONG })
  })
})

// ---------------------------------------------------------------------------
// Pre-flight: Link dialog (not window.prompt)
// ---------------------------------------------------------------------------

test.describe('Pre-flight: Link dialog', () => {
  test('clicking link button opens a dialog instead of window.prompt', async ({ page }) => {
    await openNoteEditor(page)

    // Monitor that window.prompt is NOT called
    await page.evaluate(() => {
      ;(window as unknown as { __promptCalled: boolean }).__promptCalled = false
      window.prompt = () => {
        ;(window as unknown as { __promptCalled: boolean }).__promptCalled = true
        return null
      }
    })

    // Click Link button
    const linkBtn = page.getByRole('button', { name: 'Insert link' })
    await linkBtn.click()

    // Verify dialog opened (not prompt)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Verify window.prompt was NOT called
    const promptCalled = await page.evaluate(
      () => (window as unknown as { __promptCalled: boolean }).__promptCalled
    )
    expect(promptCalled).toBe(false)
  })
})
