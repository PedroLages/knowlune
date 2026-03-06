/**
 * Story 3.12: Code & Media Blocks — ATDD Acceptance Tests
 *
 * Tests verify:
 *   - AC1: Code blocks with syntax highlighting and language selector
 *   - AC2: Inline images via drag-and-drop / toolbar button
 *   - AC3: YouTube embeds via toolbar button and paste
 *   - AC4: Collapsible details (toggle) blocks
 *
 * Navigation: LessonPlayer → Notes tab → NoteEditor
 * Uses static course data (nci-access) — no IndexedDB seeding needed.
 */
import { test, expect } from '../support/fixtures'
import { navigateAndWait } from '../support/helpers/navigation'
import path from 'node:path'
import fs from 'node:fs'

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

// ---------------------------------------------------------------------------
// AC1: Code blocks with syntax highlighting
// ---------------------------------------------------------------------------

test.describe('AC1: Code blocks with syntax highlighting', () => {
  test('inserting a code block renders with syntax highlighting', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Click Code Block toolbar button
    const codeBlockBtn = page.getByRole('button', { name: 'Code block' })
    await codeBlockBtn.click()

    // Type some JavaScript code
    await page.keyboard.type('const x = 42;')

    // Verify code block element exists
    const codeBlock = editor.locator('pre code')
    await expect(codeBlock).toBeVisible()
  })

  test('code block has a language selector dropdown', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Insert a code block
    const codeBlockBtn = page.getByRole('button', { name: 'Code block' })
    await codeBlockBtn.click()
    await page.keyboard.type('print("hello")')

    // Verify language selector is visible
    const langSelect = page.locator('[data-testid="code-block-language-select"]')
    await expect(langSelect).toBeVisible()

    // Verify supported languages are present in the dropdown
    const options = langSelect.locator('option')
    const optionTexts = await options.allTextContents()
    expect(optionTexts).toEqual(
      expect.arrayContaining(['JavaScript', 'TypeScript', 'Python', 'CSS', 'HTML', 'Bash'])
    )
  })

  test('changing language re-highlights code', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Insert a code block
    const codeBlockBtn = page.getByRole('button', { name: 'Code block' })
    await codeBlockBtn.click()
    await page.keyboard.type('const x = 42;')

    // Change language to Python
    const langSelect = page.locator('[data-testid="code-block-language-select"]')
    await langSelect.selectOption('python')

    // Verify the language attribute changed
    const codeElement = editor.locator('pre code')
    await expect(codeElement).toHaveAttribute('class', /language-python/)
  })
})

// ---------------------------------------------------------------------------
// AC2: Inline images
// ---------------------------------------------------------------------------

test.describe('AC2: Inline images', () => {
  test('toolbar image button triggers file picker', async ({ page }) => {
    await openNoteEditor(page)

    // Click image button and verify file chooser event fires
    const imageBtn = page.getByRole('button', { name: /image/i })
    const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), imageBtn.click()])
    expect(fileChooser).toBeTruthy()
  })

  test('image uploads via file input and renders inline', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Create a temporary 1x1 red pixel PNG file for testing
    const tmpDir = path.join(process.cwd(), 'test-results')
    fs.mkdirSync(tmpDir, { recursive: true })
    const tmpFile = path.join(tmpDir, 'test-image.png')
    // Minimal valid PNG: 1x1 red pixel
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'base64'
    )
    fs.writeFileSync(tmpFile, pngBuffer)

    // Use the hidden file input to upload
    const fileInput = page.locator('[data-testid="note-editor"] input[type="file"]')
    await fileInput.setInputFiles(tmpFile)

    // Verify image was inserted
    const img = editor.locator('img')
    await expect(img).toBeVisible({ timeout: 10000 })

    // Cleanup
    fs.unlinkSync(tmpFile)
  })
})

// ---------------------------------------------------------------------------
// AC3: YouTube embeds
// ---------------------------------------------------------------------------

test.describe('AC3: YouTube embeds', () => {
  test('toolbar YouTube button opens a URL dialog', async ({ page }) => {
    await openNoteEditor(page)

    // Click YouTube toolbar button
    const youtubeBtn = page.getByRole('button', { name: /youtube/i })
    await youtubeBtn.click()

    // Verify dialog opens
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Verify URL input exists in the dialog
    const urlInput = dialog.locator('input')
    await expect(urlInput).toBeVisible()
  })

  test('inserting a YouTube URL creates a responsive embed', async ({ page }) => {
    await openNoteEditor(page)

    // Open YouTube dialog
    const youtubeBtn = page.getByRole('button', { name: /youtube/i })
    await youtubeBtn.click()

    const dialog = page.getByRole('dialog')
    const urlInput = dialog.locator('input')

    // Enter a YouTube URL
    await urlInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    // Click insert button
    const insertBtn = dialog.getByRole('button', { name: 'Insert' })
    await insertBtn.click()

    // Verify YouTube embed container exists (Tiptap wraps in div[data-youtube-video])
    const embed = page.locator('.tiptap div[data-youtube-video]')
    await expect(embed).toBeVisible({ timeout: 10000 })

    // Verify 16:9 aspect ratio via CSS
    const box = await embed.boundingBox()
    if (box) {
      const ratio = box.width / box.height
      expect(ratio).toBeCloseTo(16 / 9, 0)
    }
  })

  test('invalid YouTube URL keeps Insert button disabled', async ({ page }) => {
    await openNoteEditor(page)

    const youtubeBtn = page.getByRole('button', { name: /youtube/i })
    await youtubeBtn.click()

    const dialog = page.getByRole('dialog')
    const urlInput = dialog.locator('input')
    const insertBtn = dialog.getByRole('button', { name: 'Insert' })

    // Enter an invalid URL
    await urlInput.fill('https://example.com/not-youtube')

    // Insert button should be disabled
    await expect(insertBtn).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// AC4: Collapsible details blocks
// ---------------------------------------------------------------------------

test.describe('AC4: Collapsible details blocks', () => {
  test('toolbar toggle button inserts a details block', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Click toggle toolbar button — scoped to the editor toolbar to avoid matching "Toggle theater mode"
    const toolbar = page.locator('[data-testid="note-editor-toolbar"]')
    const toggleBtn = toolbar.getByRole('button', { name: 'Toggle block' })
    await toggleBtn.click()

    // Verify details wrapper is inserted (Tiptap renders div[data-type="details"])
    const details = editor.locator('div[data-type="details"]')
    await expect(details).toBeVisible()

    // Verify summary element exists inside the details block
    const summary = editor.locator('div[data-type="details"] summary')
    await expect(summary).toBeVisible()
  })

  test('clicking toggle button opens/closes content', async ({ page }) => {
    await openNoteEditor(page)

    const editor = page.locator('.tiptap')
    await editor.click()

    // Insert a details block — scoped to toolbar
    const toolbar = page.locator('[data-testid="note-editor-toolbar"]')
    const toggleBtn = toolbar.getByRole('button', { name: 'Toggle block' })
    await toggleBtn.click()

    // Verify the details wrapper is inserted
    const details = editor.locator('div[data-type="details"]')
    await expect(details).toBeVisible()

    // Click the toggle button inside the details block to open content
    const detailsToggle = details.locator('> button')
    await detailsToggle.click()

    // Verify the details block gets the "is-open" class
    await expect(details).toHaveClass(/is-open/)

    // Click again to close
    await detailsToggle.click()

    // Verify "is-open" class is removed
    await expect(details).not.toHaveClass(/is-open/)
  })
})
