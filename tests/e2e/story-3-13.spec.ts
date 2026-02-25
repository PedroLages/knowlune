/**
 * Story 3.13: Smart Editor UX — ATDD Acceptance Tests (RED phase)
 *
 * Tests verify:
 *   - AC1: Bubble Menu with formatting options on text selection
 *   - AC2: Slash command palette on `/` keystroke
 *   - AC3: Drag handle on block hover
 *   - AC4: Emoji insertion via `:` trigger
 *   - AC5: Find/Replace panel via Cmd+F
 *   - AC6: Table of Contents from headings
 *
 * Navigation: LessonPlayer → Notes tab → NoteEditor
 * Uses static course data (nci-access) — no IndexedDB seeding needed.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Test Data — use a static course/lesson that has video (renders Notes tab)
// ---------------------------------------------------------------------------

const COURSE_ID = 'nci-access'
const LESSON_ID = 'nci-fnl-drones-psyops'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to lesson player Notes tab with sidebar closed. */
async function openNoteEditor(
  page: import('@playwright/test').Page,
) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  // Navigate to lesson player
  await navigateAndWait(page, `/courses/${COURSE_ID}/${LESSON_ID}`)

  // Wait for Notes tab to appear, then click it
  const notesTab = page.getByRole('tab', { name: 'Notes' })
  await notesTab.waitFor({ state: 'visible', timeout: 30000 })
  await notesTab.click()

  // Wait for editor to render
  await page.waitForSelector('[data-testid="note-editor"]', { timeout: 15000 })
}

/** Type text into the Tiptap editor */
async function typeInEditor(page: import('@playwright/test').Page, text: string) {
  const editor = page.locator('.tiptap')
  await editor.click()
  await page.keyboard.type(text)
}

// ---------------------------------------------------------------------------
// AC1: Bubble Menu
// ---------------------------------------------------------------------------

test.describe('AC1: Bubble Menu', () => {
  test('selecting text shows bubble menu with formatting options', async ({
    page,
  }) => {
    await openNoteEditor(page)

    // Type some text
    await typeInEditor(page, 'Hello world this is a test')

    // Select the word "world" by double-clicking it
    const editor = page.locator('.tiptap')
    const textNode = editor.getByText('Hello world this is a test')
    await textNode.dblclick({ position: { x: 60, y: 10 } })

    // Bubble menu should appear
    const bubbleMenu = page.locator('[data-testid="bubble-menu"]')
    await expect(bubbleMenu).toBeVisible({ timeout: 5000 })

    // Should contain formatting buttons
    await expect(bubbleMenu.getByRole('button', { name: /bold/i })).toBeVisible()
    await expect(bubbleMenu.getByRole('button', { name: /italic/i })).toBeVisible()
    await expect(bubbleMenu.getByRole('button', { name: /underline/i })).toBeVisible()
    await expect(bubbleMenu.getByRole('button', { name: /highlight/i })).toBeVisible()
    await expect(bubbleMenu.getByRole('button', { name: /link/i })).toBeVisible()
    await expect(bubbleMenu.getByRole('button', { name: /color/i })).toBeVisible()
  })

  test('bubble menu disappears when selection is cleared', async ({
    page,
  }) => {
    await openNoteEditor(page)

    await typeInEditor(page, 'Some text to select')

    // Select text
    await page.keyboard.down('Shift')
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft')
    await page.keyboard.up('Shift')

    const bubbleMenu = page.locator('[data-testid="bubble-menu"]')
    await expect(bubbleMenu).toBeVisible({ timeout: 5000 })

    // Click elsewhere to clear selection
    const editor = page.locator('.tiptap')
    await editor.click({ position: { x: 5, y: 5 } })

    await expect(bubbleMenu).not.toBeVisible({ timeout: 3000 })
  })
})

// ---------------------------------------------------------------------------
// AC2: Slash Commands
// ---------------------------------------------------------------------------

test.describe('AC2: Slash Commands', () => {
  test('typing / on empty line shows command palette', async ({
    page,
  }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Type / to trigger slash command
    await page.keyboard.type('/')

    // Command palette should appear
    const palette = page.locator('[data-testid="slash-command-list"]')
    await expect(palette).toBeVisible({ timeout: 5000 })

    // Should show block options
    await expect(palette.getByText(/heading 1/i)).toBeVisible()
    await expect(palette.getByText(/bullet list/i)).toBeVisible()
    await expect(palette.getByText(/code block/i)).toBeVisible()
  })

  test('palette filters as user types', async ({
    page,
  }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Type /code to filter
    await page.keyboard.type('/code')

    const palette = page.locator('[data-testid="slash-command-list"]')
    await expect(palette).toBeVisible({ timeout: 5000 })

    // Should show Code Block, not Heading
    await expect(palette.getByText(/code block/i)).toBeVisible()
    await expect(palette.getByText(/heading 1/i)).not.toBeVisible()
  })

  test('selecting a command inserts the block', async ({
    page,
  }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Type / and select Heading 1
    await page.keyboard.type('/')

    const palette = page.locator('[data-testid="slash-command-list"]')
    await expect(palette).toBeVisible({ timeout: 5000 })

    // Click Heading 1 option
    await palette.getByText(/heading 1/i).click()

    // The slash command text should be replaced with a heading
    await expect(editor.locator('h1')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// AC3: Drag-and-Drop
// ---------------------------------------------------------------------------

test.describe('AC3: Drag-and-Drop', () => {
  test('hovering over a block shows drag handle in left gutter', async ({
    page,
  }) => {
    await openNoteEditor(page)

    // Type some content to create a block
    await typeInEditor(page, 'A paragraph block')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Second paragraph')

    // Hover over the first paragraph
    const firstParagraph = page.locator('.tiptap p').first()
    await firstParagraph.hover()

    // Drag handle should appear
    const dragHandle = page.locator('[data-testid="drag-handle"]')
    await expect(dragHandle).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// AC4: Emoji
// ---------------------------------------------------------------------------

test.describe('AC4: Emoji', () => {
  test('typing : followed by search term shows emoji suggestions', async ({
    page,
  }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Type :smi to trigger emoji suggestions
    await page.keyboard.type(':smi')

    // Emoji suggestion popup should appear
    const emojiList = page.locator('[data-testid="emoji-list"]')
    await expect(emojiList).toBeVisible({ timeout: 5000 })
  })

  test('selecting an emoji inserts it inline', async ({
    page,
  }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Type :smile to trigger emoji suggestions
    await page.keyboard.type(':smile')

    const emojiList = page.locator('[data-testid="emoji-list"]')
    await expect(emojiList).toBeVisible({ timeout: 5000 })

    // Select the first emoji suggestion
    await page.keyboard.press('Enter')

    // Emoji should be inserted — the colon trigger should be gone
    await expect(editor).not.toContainText(':smile')
  })
})

// ---------------------------------------------------------------------------
// AC5: Find/Replace
// ---------------------------------------------------------------------------

test.describe('AC5: Find/Replace', () => {
  test('Cmd+F opens find/replace panel', async ({
    page,
  }) => {
    await openNoteEditor(page)

    // Press Cmd+F
    await page.keyboard.press('Meta+f')

    // Find/replace panel should appear
    const panel = page.locator('[data-testid="find-replace-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Should have find and replace inputs
    await expect(panel.getByPlaceholder(/find/i)).toBeVisible()
    await expect(panel.getByPlaceholder(/replace/i)).toBeVisible()
  })

  test('searching highlights matches in document', async ({
    page,
  }) => {
    await openNoteEditor(page)

    // Type some content with repeated words
    await typeInEditor(page, 'The quick brown fox jumps over the lazy fox')

    // Open find panel
    await page.keyboard.press('Meta+f')

    const panel = page.locator('[data-testid="find-replace-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Search for "fox"
    const findInput = panel.getByPlaceholder(/find/i)
    await findInput.fill('fox')

    // Matches should be highlighted
    const highlights = page.locator('.search-match')
    await expect(highlights).toHaveCount(2, { timeout: 5000 })
  })

  test('replace replaces the current match', async ({
    page,
  }) => {
    await openNoteEditor(page)

    await typeInEditor(page, 'Hello world Hello world')

    // Open find panel
    await page.keyboard.press('Meta+f')

    const panel = page.locator('[data-testid="find-replace-panel"]')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Find "Hello"
    await panel.getByPlaceholder(/find/i).fill('Hello')

    // Type replacement
    await panel.getByPlaceholder(/replace/i).fill('Goodbye')

    // Click replace button
    await panel.getByRole('button', { name: /^replace$/i }).click()

    // One instance should be replaced
    const editor = page.locator('.tiptap')
    await expect(editor).toContainText('Goodbye world Hello world')
  })
})

// ---------------------------------------------------------------------------
// AC6: Table of Contents
// ---------------------------------------------------------------------------

test.describe('AC6: Table of Contents', () => {
  test('document with headings shows TOC entries', async ({
    page,
  }) => {
    await openNoteEditor(page)

    // Create headings via slash commands or keyboard shortcuts
    const editor = page.locator('.tiptap')
    await editor.click()

    // Type headings (using Markdown-like shortcuts that Tiptap supports)
    await page.keyboard.type('# Introduction')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Some intro text')
    await page.keyboard.press('Enter')
    await page.keyboard.type('## Methods')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Some methods text')

    // Open TOC panel
    const tocButton = page.getByRole('button', { name: /table of contents/i })
    await tocButton.click()

    // TOC should show the headings
    const tocPanel = page.locator('[data-testid="toc-panel"]')
    await expect(tocPanel).toBeVisible({ timeout: 5000 })
    await expect(tocPanel.getByText('Introduction')).toBeVisible()
    await expect(tocPanel.getByText('Methods')).toBeVisible()
  })

  test('clicking TOC entry scrolls to heading', async ({
    page,
  }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Create enough content to enable scrolling
    await page.keyboard.type('# Top Section')
    await page.keyboard.press('Enter')
    for (let i = 0; i < 20; i++) {
      await page.keyboard.type(`Line ${i + 1} of filler text to create scrollable content.`)
      await page.keyboard.press('Enter')
    }
    await page.keyboard.type('## Bottom Section')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Content at the bottom')

    // Open TOC and click "Top Section"
    const tocButton = page.getByRole('button', { name: /table of contents/i })
    await tocButton.click()

    const tocPanel = page.locator('[data-testid="toc-panel"]')
    await expect(tocPanel).toBeVisible({ timeout: 5000 })

    // Click the "Bottom Section" entry
    await tocPanel.getByText('Bottom Section').click()

    // The heading should be scrolled into view
    const bottomHeading = editor.locator('h2', { hasText: 'Bottom Section' })
    await expect(bottomHeading).toBeInViewport({ timeout: 5000 })
  })
})
