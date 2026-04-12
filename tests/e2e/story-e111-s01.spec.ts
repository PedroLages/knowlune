/**
 * E111-S01: Audio Clips — ATDD acceptance tests
 *
 * RED phase: All tests should FAIL until the feature is implemented.
 * Each test maps to an acceptance criterion from the story file.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { seedBooks } from '../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../utils/test-time'

const AUDIOBOOK_ID = 'clip-test-audiobook'

async function seedAudiobook(page: import('@playwright/test').Page) {
  await seedBooks(page, [
    {
      id: AUDIOBOOK_ID,
      title: 'Test Audiobook',
      author: 'Test Author',
      format: 'audiobook',
      status: 'reading',
      createdAt: FIXED_DATE,
    },
  ])
}

test.describe('E111-S01: Audio Clips', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await dismissOnboarding(page)
    await seedAudiobook(page)
  })

  test('AC-1: Start Clip button captures current playback time', async ({
    page,
  }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Expect a "Start Clip" button in the audiobook player
    const startClipBtn = page.getByRole('button', { name: /start clip/i })
    await expect(startClipBtn).toBeVisible()

    await startClipBtn.click()
    // Expect a visual recording indicator to appear
    await expect(page.getByTestId('clip-recording-indicator')).toBeVisible()
  })

  test('AC-2: End Clip saves clip to database', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Start a clip
    await page.getByRole('button', { name: /start clip/i }).click()
    await expect(page.getByTestId('clip-recording-indicator')).toBeVisible()

    // End the clip
    const endClipBtn = page.getByRole('button', { name: /end clip/i })
    await expect(endClipBtn).toBeVisible()
    await endClipBtn.click()

    // Recording indicator should disappear
    await expect(
      page.getByTestId('clip-recording-indicator'),
    ).not.toBeVisible()

    // Verify clip was persisted to IndexedDB
    const clipCount = await page.evaluate(async () => {
      const db = (
        await new Promise<IDBDatabase>((resolve, reject) => {
          const req = indexedDB.open('ElearningDB')
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
      )
      const tx = db.transaction('audioClips', 'readonly')
      const store = tx.objectStore('audioClips')
      return new Promise<number>((resolve, reject) => {
        const countReq = store.count()
        countReq.onsuccess = () => resolve(countReq.result)
        countReq.onerror = () => reject(countReq.error)
      })
    })
    expect(clipCount).toBe(1)
  })

  test('AC-3: Clips panel lists all clips for the book', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Open clips panel
    const clipsPanelBtn = page.getByRole('button', { name: /clips/i })
    await expect(clipsPanelBtn).toBeVisible()
    await clipsPanelBtn.click()

    // Clips panel should be visible
    await expect(page.getByTestId('clip-list-panel')).toBeVisible()
  })

  test('AC-4: Tapping a clip plays from start to end time', async ({
    page,
  }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Open clips panel
    await page.getByRole('button', { name: /clips/i }).click()
    await expect(page.getByTestId('clip-list-panel')).toBeVisible()

    // Should have at least one clip item (requires seeded clip data)
    const clipItem = page.getByTestId('clip-item').first()
    await expect(clipItem).toBeVisible()
    await clipItem.click()

    // Player should be playing
    await expect(page.getByTestId('audio-playing-indicator')).toBeVisible()
  })

  test('AC-5: Clip title can be edited', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /clips/i }).click()

    // Find the edit button for a clip
    const editBtn = page
      .getByTestId('clip-item')
      .first()
      .getByRole('button', { name: /edit/i })
    await expect(editBtn).toBeVisible()
    await editBtn.click()

    // Title input should be visible
    const titleInput = page.getByTestId('clip-title-input')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('My Favorite Passage')
    await titleInput.press('Enter')

    // Title should be updated
    await expect(
      page.getByTestId('clip-item').first().getByText('My Favorite Passage'),
    ).toBeVisible()
  })

  test('AC-6: Clip can be deleted', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /clips/i }).click()

    const clipItems = page.getByTestId('clip-item')
    const initialCount = await clipItems.count()
    expect(initialCount).toBeGreaterThan(0)

    // Delete first clip
    const deleteBtn = clipItems
      .first()
      .getByRole('button', { name: /delete/i })
    await deleteBtn.click()

    // Confirm deletion
    await page.getByRole('button', { name: /confirm/i }).click()

    // Count should decrease
    await expect(clipItems).toHaveCount(initialCount - 1)
  })

  test('AC-7: Clips can be reordered via drag-and-drop', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /clips/i }).click()

    // Should have drag handles
    const dragHandles = page.getByTestId('clip-drag-handle')
    await expect(dragHandles.first()).toBeVisible()
  })

  test('AC-8: Accessibility — keyboard navigation and ARIA labels', async ({
    page,
  }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)

    // Start Clip button should have accessible name
    const startClipBtn = page.getByRole('button', { name: /start clip/i })
    await expect(startClipBtn).toBeVisible()

    // Clips panel button should have accessible name
    const clipsPanelBtn = page.getByRole('button', { name: /clips/i })
    await expect(clipsPanelBtn).toBeVisible()

    // Verify touch target size (minimum 44x44px)
    const box = await startClipBtn.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})
