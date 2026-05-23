/**
 * Notes panel fill-height layout and desktop open/focus regression (2026-05-23).
 *
 * E2E-1..E2E-8 from docs/plans/2026-05-23-002-feat-notes-panel-fill-height-plan.md
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import { closeSidebar } from '../../support/fixtures/constants/sidebar-constants'
import { TIMEOUTS } from '../../utils/constants'

interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  const intersectionWidth = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const intersectionHeight = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return intersectionWidth > 0 && intersectionHeight > 0
}

async function assertToolbarActionsContained(page: PageParam) {
  const toolbar = page.locator('#lesson-notes-panel [data-testid="note-editor-toolbar"]')
  await expect(toolbar).toBeVisible()

  const toolbarBox = await toolbar.boundingBox()
  expect(toolbarBox).toBeTruthy()

  // In compact mode, trailing actions live in the overflow dropdown — no cluster in toolbar
  const cluster = page.locator('#lesson-notes-panel [data-testid="note-editor-toolbar-actions"]')
  if (await cluster.count()) {
    // Non-compact mode: buttons are in toolbar cluster, verify no overlap
    const timstampBtn = page.locator('#lesson-notes-panel [data-testid="note-editor-toolbar-actions"] [aria-label="Add Timestamp"]')
    const downloadBtn = page.locator('#lesson-notes-panel [data-testid="note-editor-toolbar-actions"] [aria-label="Download note as Markdown"]')

    await expect(timstampBtn).toBeVisible()
    await expect(downloadBtn).toBeVisible()

    const tsBox = await timstampBtn.boundingBox()
    const dlBox = await downloadBtn.boundingBox()
    expect(tsBox).toBeTruthy()
    expect(dlBox).toBeTruthy()

    expect(boxesOverlap(tsBox!, dlBox)).toBe(false)

    const toolbarRight = toolbarBox!.x + toolbarBox!.width
    const toolbarBottom = toolbarBox!.y + toolbarBox!.height
    expect(tsBox!.x + tsBox!.width).toBeLessThanOrEqual(toolbarRight + 2)
    expect(tsBox!.y + tsBox!.height).toBeLessThanOrEqual(toolbarBottom + 2)
    expect(dlBox!.x + dlBox!.width).toBeLessThanOrEqual(toolbarRight + 2)
    expect(dlBox!.y + dlBox!.height).toBeLessThanOrEqual(toolbarBottom + 2)
  } else {
    // Compact mode: trailing actions are in overflow dropdown — open it and verify
    const overflowTrigger = page.locator('#lesson-notes-panel [aria-label="More formatting options"]')
    await expect(overflowTrigger).toBeVisible()
    await overflowTrigger.click()

    const timestampItem = page.getByRole('menuitem', { name: /Add Timestamp/ })
    const downloadItem = page.getByRole('menuitem', { name: /Download as Markdown/ })
    await expect(timestampItem).toBeVisible()
    await expect(downloadItem).toBeVisible()

    // Close dropdown by pressing Escape
    await page.keyboard.press('Escape')
  }
}

async function assertNotesPanelFitsViewport(page: PageParam) {
  const panel = page.locator('#lesson-notes-panel')
  await expect(panel).toBeVisible()

  const panelBox = await panel.boundingBox()
  expect(panelBox).toBeTruthy()

  const viewportHeight = page.viewportSize()?.height ?? 800
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(viewportHeight + 2)

  const toolbar = page.locator('#lesson-notes-panel [data-testid="note-editor-toolbar"]')
  await expect(toolbar).toBeVisible()
  const toolbarBox = await toolbar.boundingBox()
  expect(toolbarBox).toBeTruthy()

  // Toolbar bottom edge is above editor body top edge
  const editorBody = page.locator('#lesson-notes-panel [data-testid="note-editor-body"]')
  if (await editorBody.count()) {
    const editorBodyBox = await editorBody.boundingBox()
    expect(editorBodyBox).toBeTruthy()
    expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(editorBodyBox!.y + 2)
  }
}

const LESSON_URL = '/courses/operative-six/lessons/op6-introduction'

type PageParam = Parameters<typeof navigateAndWait>[0]

async function goToLessonPlayer(page: PageParam, extraParams = '') {
  await page.evaluate(sidebarState => {
    Object.entries(sidebarState).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })
  }, closeSidebar())
  await navigateAndWait(page, LESSON_URL + extraParams)
  await page.getByTestId('lesson-player-content').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
}

async function focusPlayer(page: PageParam) {
  const player = page.getByTestId('video-player-container')
  await player.waitFor({ state: 'visible' })
  await player.focus()
}

async function openNotesViaHeader(page: PageParam) {
  await page.getByTestId('notes-toggle').click()
  await expect(page.locator('#lesson-notes-panel')).toBeVisible({ timeout: TIMEOUTS.SHORT })
}

async function assertEditorFillsPanel(page: PageParam) {
  const panel = page.locator('#lesson-notes-panel')
  const editor = page.locator('#lesson-notes-panel [data-testid="note-editor"]')
  await expect(panel).toBeVisible()
  await expect(editor).toBeVisible()

  const panelBox = await panel.boundingBox()
  const editorBox = await editor.boundingBox()
  expect(panelBox).toBeTruthy()
  expect(editorBox).toBeTruthy()

  const panelBottom = panelBox!.y + panelBox!.height
  const editorBottom = editorBox!.y + editorBox!.height
  expect(panelBottom - editorBottom).toBeLessThanOrEqual(8)
  expect(editorBox!.height).toBeGreaterThan(250)
}

test.describe('Notes panel fill-height (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('E2E-1: header toggle opens panel with fill-height editor', async ({ page }) => {
    await goToLessonPlayer(page)
    await openNotesViaHeader(page)
    await assertEditorFillsPanel(page)
  })

  test('E2E-2: ?panel=notes cold load opens panel and focuses editor', async ({ page }) => {
    await goToLessonPlayer(page, '?panel=notes')
    await expect(page.locator('#lesson-notes-panel')).toBeVisible({ timeout: TIMEOUTS.SHORT })

    const panelEditor = page.locator('#lesson-notes-panel .ProseMirror[contenteditable="true"]')
    await expect(panelEditor).toBeFocused({ timeout: TIMEOUTS.LONG })
  })

  test.describe('keyboard N key', () => {
    test.skip(({ browserName }) => browserName === 'webkit', 'Keyboard events not reliable on webkit in CI')

    test('E2E-3: N with panel closed opens side panel and focuses editor', async ({ page }) => {
      await goToLessonPlayer(page)
      await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
      await focusPlayer(page)

      await page.keyboard.press('n')

      await expect(page.locator('#lesson-notes-panel')).toBeVisible({ timeout: TIMEOUTS.SHORT })
      await expect(
        page.locator('#lesson-notes-panel .ProseMirror[contenteditable="true"]')
      ).toBeFocused({ timeout: TIMEOUTS.LONG })
    })

    test('E2E-4: N with panel open re-focuses editor without closing', async ({ page }) => {
      await goToLessonPlayer(page)
      await page.locator('video').waitFor({ state: 'visible', timeout: TIMEOUTS.NETWORK })
      await focusPlayer(page)

      await page.keyboard.press('n')
      const panelEditor = page.locator('#lesson-notes-panel .ProseMirror[contenteditable="true"]')
      await panelEditor.waitFor({ timeout: TIMEOUTS.LONG })

      await focusPlayer(page)
      await expect(panelEditor).not.toBeFocused()

      await page.keyboard.press('n')
      await expect(page.locator('#lesson-notes-panel')).toBeVisible()
      await expect(panelEditor).toBeFocused({ timeout: TIMEOUTS.SHORT })
    })
  })

  test('E2E-5: theater mode closes notes panel', async ({ page }) => {
    await goToLessonPlayer(page)
    await openNotesViaHeader(page)

    await page.getByTestId('theater-mode-toggle').click()
    await expect(page.locator('#lesson-notes-panel')).toBeHidden({ timeout: TIMEOUTS.SHORT })
    await expect(page.getByTestId('lesson-player-content')).toHaveAttribute('data-theater-mode', 'true')
  })

  test('E2E-5b: navigating to next lesson closes notes panel', async ({ page }) => {
    await goToLessonPlayer(page)
    await openNotesViaHeader(page)

    const nextBtn = page.getByRole('button', { name: /^Next$/ })
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()

    await expect(page.locator('#lesson-notes-panel')).toBeHidden({ timeout: TIMEOUTS.SHORT })
  })

  test('E2E-6a: toolbar stays pinned when editor body scrolls', async ({ page }) => {
    await goToLessonPlayer(page)
    await openNotesViaHeader(page)

    const toolbar = page.locator('#lesson-notes-panel [data-testid="note-editor-toolbar"]')
    await expect(toolbar).toBeVisible()
    await expect(toolbar.locator('[aria-label="Bold"]')).toBeVisible()

    const toolbarYBefore = (await toolbar.boundingBox())!.y

    const editorBody = page.locator('#lesson-notes-panel [data-testid="note-editor-body"]')
    if (await editorBody.count()) {
      await editorBody.evaluate(el => {
        el.scrollTop = 200
      })
    } else {
      await page.locator('#lesson-notes-panel .ProseMirror').evaluate(el => {
        el.scrollTop = 200
      })
    }

    const toolbarYAfter = (await toolbar.boundingBox())!.y
    expect(Math.abs(toolbarYAfter - toolbarYBefore)).toBeLessThanOrEqual(2)
  })

  test('E2E-7: editor remains visible after resizable panel drag', async ({ page }) => {
    await goToLessonPlayer(page)
    await openNotesViaHeader(page)

    const handle = page.locator('[data-separator]')
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()

    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x - 80, box!.y + box!.height / 2, { steps: 5 })
    await page.mouse.up()

    const editor = page.locator('#lesson-notes-panel [data-testid="note-editor"]')
    await expect(editor).toBeVisible()
    const editorBox = await editor.boundingBox()
    expect(editorBox!.height).toBeGreaterThan(200)
  })

  test('E2E-8: below-video editor stays content-sized when panel closed', async ({ page }) => {
    await goToLessonPlayer(page)

    const belowVideoEditor = page
      .getByTestId('lesson-content-scroll')
      .getByTestId('note-editor')
      .first()
    await expect(belowVideoEditor).toBeVisible()

    const box = await belowVideoEditor.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.height).toBeGreaterThanOrEqual(250)
    expect(box!.height).toBeLessThan(500)
  })
})

test.describe('E2E-6b: timestamp insertion', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test.describe.configure({ retries: 1 })

  test('Add Timestamp inserts jump link in panel editor', async ({ page }) => {
    await goToLessonPlayer(page)
    await page.getByTestId('notes-toggle').click()
    await expect(page.locator('#lesson-notes-panel')).toBeVisible()

    // In compact mode, Add Timestamp is in the overflow dropdown
    await page.locator('#lesson-notes-panel [aria-label="More formatting options"]').click()
    await page.getByRole('menuitem', { name: /Add Timestamp/ }).click()

    const editorHtml = await page
      .locator('#lesson-notes-panel .ProseMirror')
      .innerHTML()
    expect(editorHtml).toMatch(/Jump to|\d+:\d{2}/)
  })
})

test.describe('E2E-6c: frame capture smoke', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('@slow capture button available in overflow dropdown', async ({ page }) => {
    test.skip(!!process.env.CI, 'Optional nightly — frame capture timing varies in CI')

    await goToLessonPlayer(page)
    await page.getByTestId('notes-toggle').click()

    // In compact mode, Capture Frame is in the overflow dropdown
    await page.locator('#lesson-notes-panel [aria-label="More formatting options"]').click()
    const captureItem = page.getByRole('menuitem', { name: /Capture video frame/ })
    await expect(captureItem).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(captureItem).toBeEnabled()
    await page.keyboard.press('Escape')
  })
})

test.describe('Toolbar geometry regression (R1, R2)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('E2E-9a: toolbar actions contained at default panel width', async ({ page }) => {
    await goToLessonPlayer(page)
    await page.getByTestId('notes-toggle').click()
    await expect(page.locator('#lesson-notes-panel')).toBeVisible()

    await assertToolbarActionsContained(page)
    await assertNotesPanelFitsViewport(page)
  })

  test('E2E-9b: toolbar actions contained at minimum panel width', async ({ page }) => {
    await goToLessonPlayer(page)
    await page.getByTestId('notes-toggle').click()
    await expect(page.locator('#lesson-notes-panel')).toBeVisible()

    // Drag resizer to minimum panel width
    const handle = page.locator('[data-separator]')
    const box = await handle.boundingBox()
    expect(box).toBeTruthy()

    // Drag far enough left to hit ~25% min width
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x - 280, box!.y + box!.height / 2, { steps: 8 })
    await page.mouse.up()

    await assertToolbarActionsContained(page)
    await assertNotesPanelFitsViewport(page)
  })

  test('E2E-9c: toolbar actions accessible in overflow dropdown', async ({ page }) => {
    await goToLessonPlayer(page)
    await page.getByTestId('notes-toggle').click()
    await expect(page.locator('#lesson-notes-panel')).toBeVisible()

    // In compact mode, all trailing actions are in the overflow dropdown
    const overflowBtn = page.locator('#lesson-notes-panel [aria-label="More formatting options"]')
    await expect(overflowBtn).toBeVisible()
    await overflowBtn.click()

    // Verify all trailing actions are present in dropdown
    const timestampItem = page.getByRole('menuitem', { name: /Add Timestamp/ })
    const downloadItem = page.getByRole('menuitem', { name: /Download as Markdown/ })
    await expect(timestampItem).toBeVisible()
    await expect(downloadItem).toBeVisible()

    // Capture frame may or may not be present (depends on onCaptureFrame prop)
    await page.keyboard.press('Escape')

    // Toolbar itself should not overflow — the wide buttons are now in dropdown
    const toolbar = page.locator('#lesson-notes-panel [data-testid="note-editor-toolbar"]')
    const toolbarBox = await toolbar.boundingBox()
    expect(toolbarBox).toBeTruthy()

    // Toolbar fits within the notes panel
    const panel = page.locator('#lesson-notes-panel')
    const panelBox = await panel.boundingBox()
    expect(panelBox).toBeTruthy()
    expect(toolbarBox!.x + toolbarBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 2)
  })
})
