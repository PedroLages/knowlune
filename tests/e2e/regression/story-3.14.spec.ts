/**
 * Story 3.14: Tables — ATDD Acceptance Tests (RED phase)
 *
 * Tests verify:
 *   - AC1: Grid picker from toolbar button or `/table` slash command inserts table
 *   - AC2: Right-click context menu, Tab navigation, row/column operations
 *
 * Navigation: LessonPlayer → Notes tab → NoteEditor
 * Uses static course data (nci-access) — no IndexedDB seeding needed.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { TIMEOUTS } from '../../utils/constants'
import { closeSidebar } from '@/tests/support/fixtures/constants/sidebar-constants'

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
  await page.evaluate((sidebarState) => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())

  await navigateAndWait(page, `/courses/${COURSE_ID}/${LESSON_ID}`)

  const notesTab = page.getByRole('tab', { name: 'Notes' })
  await notesTab.waitFor({ state: 'visible', timeout: TIMEOUTS.PAGE_LOAD })
  await notesTab.click()

  await page.waitForSelector('[data-testid="note-editor"]', { timeout: TIMEOUTS.MEDIA })
}

/** Type text into the Tiptap editor */
async function typeInEditor(page: import('@playwright/test').Page, text: string) {
  const editor = page.locator('.tiptap')
  await editor.click()
  await page.keyboard.type(text)
}

// ---------------------------------------------------------------------------
// AC1: Table insertion via toolbar grid picker and slash command
// ---------------------------------------------------------------------------

test.describe('AC1: Table Grid Picker & Slash Command', () => {
  test('toolbar Table button opens grid picker', async ({ page }) => {
    await openNoteEditor(page)

    // Click the Table toolbar button
    const tableButton = page.getByRole('button', { name: 'Insert table' })
    await tableButton.click()

    // Grid picker should appear
    const gridPicker = page.locator('[data-testid="table-grid-picker"]')
    await expect(gridPicker).toBeVisible({ timeout: TIMEOUTS.LONG })
  })

  test('clicking grid cell inserts table of correct dimensions', async ({ page }) => {
    await openNoteEditor(page)

    // Open grid picker
    const tableButton = page.getByRole('button', { name: 'Insert table' })
    await tableButton.click()

    const gridPicker = page.locator('[data-testid="table-grid-picker"]')
    await expect(gridPicker).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Hover and click on cell at position (2, 4) — should create 2 cols x 4 rows
    // Grid cells are identified by data attributes
    const targetCell = gridPicker.locator('[data-row="4"][data-col="2"]')
    await targetCell.click()

    // Grid picker should close
    await expect(gridPicker).not.toBeVisible({ timeout: TIMEOUTS.DEFAULT })

    // Table should be inserted in the editor
    const editor = page.locator('.tiptap')
    const table = editor.locator('table')
    await expect(table).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Verify dimensions: 4 rows (1 header + 3 body), 2 columns
    const rows = table.locator('tr')
    await expect(rows).toHaveCount(4)

    const headerCells = table.locator('th')
    await expect(headerCells).toHaveCount(2)
  })

  test('/table slash command inserts default 3x3 table', async ({ page }) => {
    await openNoteEditor(page)

    // Type slash command
    await typeInEditor(page, '/')

    // Wait for slash command palette
    const commandList = page.locator('[data-testid="slash-command-list"]')
    await expect(commandList).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Type "table" to filter
    await page.keyboard.type('table')

    // Select the Table command
    const tableCommand = commandList.getByText('Table', { exact: true })
    await expect(tableCommand).toBeVisible({ timeout: TIMEOUTS.DEFAULT })
    await page.keyboard.press('Enter')

    // Table should be inserted with default 3x3 dimensions
    const editor = page.locator('.tiptap')
    const table = editor.locator('table')
    await expect(table).toBeVisible({ timeout: TIMEOUTS.LONG })

    // 3 rows (1 header + 2 body), 3 columns
    const rows = table.locator('tr')
    await expect(rows).toHaveCount(3)

    const headerCells = table.locator('th')
    await expect(headerCells).toHaveCount(3)
  })
})

// ---------------------------------------------------------------------------
// AC2: Context menu, Tab navigation, row/column operations
// ---------------------------------------------------------------------------

test.describe('AC2: Table Context Menu & Navigation', () => {
  /** Helper: insert a 3x3 table via slash command */
  async function insertTable(page: import('@playwright/test').Page) {
    await typeInEditor(page, '/')
    const commandList = page.locator('[data-testid="slash-command-list"]')
    await expect(commandList).toBeVisible({ timeout: TIMEOUTS.LONG })
    await page.keyboard.type('table')
    await page.keyboard.press('Enter')
    const table = page.locator('.tiptap table')
    await expect(table).toBeVisible({ timeout: TIMEOUTS.LONG })
  }

  test('right-click in table cell shows context menu', async ({ page }) => {
    await openNoteEditor(page)
    await insertTable(page)

    // Right-click on a table cell
    const firstCell = page.locator('.tiptap th').first()
    await firstCell.click({ button: 'right' })

    // Context menu should appear
    const contextMenu = page.locator('[data-testid="table-context-menu"]')
    await expect(contextMenu).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Should contain all operations
    await expect(contextMenu.getByText('Add Row Above')).toBeVisible()
    await expect(contextMenu.getByText('Add Row Below')).toBeVisible()
    await expect(contextMenu.getByText('Add Column Left')).toBeVisible()
    await expect(contextMenu.getByText('Add Column Right')).toBeVisible()
    await expect(contextMenu.getByText('Delete Row')).toBeVisible()
    await expect(contextMenu.getByText('Delete Column')).toBeVisible()
    await expect(contextMenu.getByText('Delete Table')).toBeVisible()
  })

  test('Tab navigates between cells', async ({ page }) => {
    await openNoteEditor(page)
    await insertTable(page)

    // Click into the first header cell and type
    const firstCell = page.locator('.tiptap th').first()
    await firstCell.click()
    await page.keyboard.type('Cell 1')

    // Tab to next cell
    await page.keyboard.press('Tab')
    await page.keyboard.type('Cell 2')

    // Verify second header cell has the text
    const secondCell = page.locator('.tiptap th').nth(1)
    await expect(secondCell).toContainText('Cell 2')
  })

  test('Add Row Below increases row count', async ({ page }) => {
    await openNoteEditor(page)
    await insertTable(page)

    // Verify initial row count: 3 (1 header + 2 body)
    const table = page.locator('.tiptap table')
    await expect(table.locator('tr')).toHaveCount(3)

    // Right-click a cell and add row below
    const bodyCell = page.locator('.tiptap td').first()
    await bodyCell.click({ button: 'right' })

    const contextMenu = page.locator('[data-testid="table-context-menu"]')
    await expect(contextMenu).toBeVisible({ timeout: TIMEOUTS.LONG })
    await contextMenu.getByText('Add Row Below').click()

    // Row count should increase by 1
    await expect(table.locator('tr')).toHaveCount(4)
  })

  test('Delete Table removes the table', async ({ page }) => {
    await openNoteEditor(page)
    await insertTable(page)

    // Verify table exists
    const table = page.locator('.tiptap table')
    await expect(table).toBeVisible()

    // Right-click and delete
    const cell = page.locator('.tiptap td').first()
    await cell.click({ button: 'right' })

    const contextMenu = page.locator('[data-testid="table-context-menu"]')
    await expect(contextMenu).toBeVisible({ timeout: TIMEOUTS.LONG })
    await contextMenu.getByText('Delete Table').click()

    // Table should be removed
    await expect(table).not.toBeVisible({ timeout: TIMEOUTS.LONG })
  })

  test('Tab at end of table creates new row', async ({ page }) => {
    await openNoteEditor(page)
    await insertTable(page)

    // 3x3 table: 1 header row + 2 body rows = 3 total
    const table = page.locator('.tiptap table')
    await expect(table.locator('tr')).toHaveCount(3)

    // Click the last body cell and type to ensure TipTap cursor is there
    const lastCell = table.locator('td').last()
    await lastCell.click()
    await page.keyboard.type('x')

    // Tab from the last cell should create a new row
    await page.keyboard.press('Tab')

    // Row count should increase from 3 to 4
    await expect(table.locator('tr')).toHaveCount(4)
  })

  test('context menu closes on Escape', async ({ page }) => {
    await openNoteEditor(page)
    await insertTable(page)

    // Right-click to open context menu
    const cell = page.locator('.tiptap td').first()
    await cell.click({ button: 'right' })

    const contextMenu = page.locator('[data-testid="table-context-menu"]')
    await expect(contextMenu).toBeVisible({ timeout: TIMEOUTS.LONG })

    // Press Escape
    await page.keyboard.press('Escape')

    // Context menu should close
    await expect(contextMenu).not.toBeVisible({ timeout: TIMEOUTS.DEFAULT })
  })
})
