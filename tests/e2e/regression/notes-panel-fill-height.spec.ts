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
  const timstampBtn = page.locator(
    '#lesson-notes-panel [aria-label="Add Timestamp"]'
  )
  const downloadBtn = page.locator(
    '#lesson-notes-panel [aria-label="Download note as Markdown"]'
  )

  await expect(toolbar).toBeVisible()
  await expect(timstampBtn).toBeVisible()
  await expect(downloadBtn).toBeVisible()

  const toolbarBox = await toolbar.boundingBox()
  const tsBox = await timstampBtn.boundingBox()
  const dlBox = await downloadBtn.boundingBox()
  expect(toolbarBox).toBeTruthy()
  expect(tsBox).toBeTruthy()
  expect(dlBox).toBeTruthy()

  // Timestamp and Download do not overlap
  expect(boxesOverlap(tsBox!, dlBox)).toBe(false)

  // Both buttons are fully inside the toolbar
  const toolbarRight = toolbarBox!.x + toolbarBox!.width
  const toolbarBottom = toolbarBox!.y + toolbarBox!.height
  expect(tsBox!.x + tsBox!.width).toBeLessThanOrEqual(toolbarRight + 2)
  expect(tsBox!.y + tsBox!.height).toBeLessThanOrEqual(toolbarBottom + 2)
  expect(dlBox!.x + dlBox!.width).toBeLessThanOrEqual(toolbarRight + 2)
  expect(dlBox!.y + dlBox!.height).toBeLessThanOrEqual(toolbarBottom + 2)
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

const LESSON_URL = '/courses/operative-six/op6-introduction'

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

    await page.locator('#lesson-notes-panel [aria-label="Add Timestamp"]').click()

    const editorHtml = await page
      .locator('#lesson-notes-panel .ProseMirror')
      .innerHTML()
    expect(editorHtml).toMatch(/Jump to|\d+:\d{2}/)
  })
})

test.describe('E2E-6c: frame capture smoke', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('@slow capture button visible after panel open', async ({ page }) => {
    test.skip(!!process.env.CI, 'Optional nightly — frame capture timing varies in CI')

    await goToLessonPlayer(page)
    await page.getByTestId('notes-toggle').click()

    const captureBtn = page.locator('#lesson-notes-panel [aria-label="Capture video frame"]')
    await expect(captureBtn).toBeVisible({ timeout: TIMEOUTS.LONG })
    await expect(captureBtn).toBeEnabled()
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

  test('E2E-9c: toolbar actions contained with capture frame visible', async ({ page }) => {
    await goToLessonPlayer(page)
    await page.getByTestId('notes-toggle').click()
    await expect(page.locator('#lesson-notes-panel')).toBeVisible()

    // Only run assertions if capture frame button is present
    const captureBtn = page.locator('#lesson-notes-panel [aria-label="Capture video frame"]')
    if (await captureBtn.count()) {
      const downloadBtn = page.locator(
        '#lesson-notes-panel [aria-label="Download note as Markdown"]'
      )
      const tsBtn = page.locator('#lesson-notes-panel [aria-label="Add Timestamp"]')
      await expect(captureBtn).toBeVisible()
      await expect(tsBtn).toBeVisible()
      await expect(downloadBtn).toBeVisible()

      const cBox = await captureBtn.boundingBox()
      const tsBox = await tsBtn.boundingBox()
      const dlBox = await downloadBtn.boundingBox()
      expect(cBox).toBeTruthy()
      expect(tsBox).toBeTruthy()
      expect(dlBox).toBeTruthy()

      // None of the three buttons overlap
      expect(boxesOverlap(cBox!, tsBox!)).toBe(false)
      expect(boxesOverlap(tsBox!, dlBox!)).toBe(false)
      expect(boxesOverlap(cBox!, dlBox!)).toBe(false)
    }
  })
})
