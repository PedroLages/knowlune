/**
 * E111-S01: Audio Clips — ATDD acceptance tests
 *
 * GREEN phase: All tests should pass after feature implementation.
 * Each test maps to an acceptance criterion from the story file.
 */
import { test, expect } from '@playwright/test'
import { dismissOnboarding } from '../../helpers/dismiss-onboarding'
import { seedBooks, seedAudioClips } from '../../support/helpers/indexeddb-seed'
import { mockAudioElement } from '../../support/helpers/audio-mock'
import { FIXED_DATE } from '../../utils/test-time'

const AUDIOBOOK_ID = 'clip-test-audiobook'

async function seedAudiobook(page: import('@playwright/test').Page) {
  await seedBooks(page, [
    {
      id: AUDIOBOOK_ID,
      title: 'Test Audiobook',
      author: 'Test Author',
      format: 'audiobook',
      status: 'reading',
      source: { type: 'remote', url: 'http://localhost/test.m4b' },
      chapters: [
        {
          id: 'ch-1',
          bookId: AUDIOBOOK_ID,
          title: 'Chapter 1',
          order: 0,
          position: { type: 'time', seconds: 0 },
        },
      ],
      totalDuration: 600,
      progress: 0,
      createdAt: FIXED_DATE,
    },
  ])
}

/** Pre-seeds two clips so panel tests have data to work with */
async function seedClips(page: import('@playwright/test').Page) {
  await seedAudioClips(page, [
    {
      id: 'clip-1',
      bookId: AUDIOBOOK_ID,
      chapterId: 'Chapter 1',
      chapterIndex: 0,
      startTime: 10,
      endTime: 30,
      title: 'First Clip',
      sortOrder: 0,
      createdAt: FIXED_DATE,
    },
    {
      id: 'clip-2',
      bookId: AUDIOBOOK_ID,
      chapterId: 'Chapter 1',
      chapterIndex: 0,
      startTime: 60,
      endTime: 90,
      title: 'Second Clip',
      sortOrder: 1,
      createdAt: FIXED_DATE,
    },
  ])
}

test.describe('E111-S01: Audio Clips', () => {
  test.beforeEach(async ({ page }) => {
    await mockAudioElement(page)
    await page.goto('/')
    await dismissOnboarding(page)
    await seedAudiobook(page)
  })

  test('AC-1: Start Clip button captures current playback time', async ({ page }) => {
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

    // Start playback to activate the RAF loop so currentTime updates via React state.
    // Without play(), the rAF loop is idle and ClipButton's currentTime prop stays at 0,
    // causing endTime <= startTime validation to reject the clip.
    await page.evaluate(() => {
      ;(window as Window & { __mockCurrentTime__?: number }).__mockCurrentTime__ = 10
    })
    await page.getByRole('button', { name: /^play$/i }).click()
    // Wait for RAF loop to propagate time=10 into React state (shown in the time display)
    await expect(page.getByTestId('current-time-display')).toHaveText('0:10')

    // Start clip at time=10
    await page.getByRole('button', { name: /start clip/i }).click()
    await expect(page.getByTestId('clip-recording-indicator')).toBeVisible()

    // Advance mock currentTime so endTime (30) > startTime (10)
    await page.evaluate(() => {
      ;(window as Window & { __mockCurrentTime__?: number }).__mockCurrentTime__ = 30
    })
    // Wait for RAF loop to propagate time=30 into React state
    await expect(page.getByTestId('current-time-display')).toHaveText('0:30')

    // End the clip
    const endClipBtn = page.getByRole('button', { name: /end clip/i })
    await expect(endClipBtn).toBeVisible()
    await endClipBtn.click()

    // Recording indicator should disappear
    await expect(page.getByTestId('clip-recording-indicator')).not.toBeVisible()

    // Verify clip was persisted to IndexedDB
    const clipCount = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
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
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Open clips panel
    const clipsPanelBtn = page.getByRole('button', { name: /^clips$/i })
    await expect(clipsPanelBtn).toBeVisible()
    await clipsPanelBtn.click()

    // Clips panel should be visible
    await expect(page.getByTestId('clip-list-panel')).toBeVisible()

    // Should display the correct number of seeded clips
    const clipItems = page.getByTestId('clip-item')
    await expect(clipItems).toHaveCount(2)

    // Each clip should display chapter title and timestamp text
    const firstClip = clipItems.nth(0)
    const secondClip = clipItems.nth(1)
    await expect(firstClip.getByText('Chapter 1')).toBeVisible()
    await expect(firstClip.getByText(/0:10/)).toBeVisible()
    await expect(secondClip.getByText('Chapter 1')).toBeVisible()
    await expect(secondClip.getByText(/1:00/)).toBeVisible()

    // Verify ordering — first clip's start time (10s) is before second clip's (60s)
    const firstClipTime = await firstClip.getByText(/\d+:\d+/).first().textContent()
    const secondClipTime = await secondClip.getByText(/\d+:\d+/).first().textContent()
    expect(firstClipTime).toBeTruthy()
    expect(secondClipTime).toBeTruthy()
    // Parse "M:SS" timestamps and verify ordering
    const parseTime = (t: string) => {
      const parts = t.split(':').map(Number)
      return parts.length === 2 ? parts[0] * 60 + parts[1] : 0
    }
    expect(parseTime(firstClipTime!)).toBeLessThan(parseTime(secondClipTime!))
  })

  test('AC-4: Tapping a clip plays from start to end time', async ({ page }) => {
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    // Open clips panel
    await page.getByRole('button', { name: /^clips$/i }).click()
    await expect(page.getByTestId('clip-list-panel')).toBeVisible()

    // Should have at least one clip item (seeded above)
    const clipItem = page.getByTestId('clip-item').first()
    await expect(clipItem).toBeVisible()
    await clipItem.getByRole('button', { name: /play clip/i }).click()

    // Player should be playing (play button gets the data-testid)
    await expect(page.getByTestId('audio-playing-indicator')).toBeVisible()
  })

  test('AC-5: Clip title can be edited', async ({ page }) => {
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /^clips$/i }).click()

    // Find the edit button for the first clip
    const editBtn = page
      .getByTestId('clip-item')
      .first()
      .getByRole('button', { name: /edit clip title/i })
    await expect(editBtn).toBeVisible()
    await editBtn.click()

    // Title input should be visible
    const titleInput = page.getByTestId('clip-title-input')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('My Favorite Passage')
    await titleInput.press('Enter')

    // Title should be updated
    await expect(
      page.getByTestId('clip-item').first().getByText('My Favorite Passage')
    ).toBeVisible()
  })

  test('AC-6: Clip can be deleted', async ({ page }) => {
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /^clips$/i }).click()

    const clipItems = page.getByTestId('clip-item')
    await expect(clipItems.first()).toBeVisible()
    const initialCount = await clipItems.count()
    expect(initialCount).toBeGreaterThan(0)

    // Delete first clip
    const deleteBtn = clipItems.first().getByRole('button', { name: /delete clip/i })
    await deleteBtn.click()

    // Confirm deletion
    await page.getByRole('button', { name: /confirm/i }).click()

    // Count should decrease
    await expect(clipItems).toHaveCount(initialCount - 1)
  })

  test('AC-7: Clips can be reordered via drag-and-drop', async ({ page }) => {
    await seedClips(page)
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)
    await page.getByRole('button', { name: /^clips$/i }).click()

    // Should have drag handles
    const dragHandles = page.getByTestId('clip-drag-handle')
    await expect(dragHandles.first()).toBeVisible()

    // Verify initial order: First Clip before Second Clip
    const clipItems = page.getByTestId('clip-item')
    await expect(clipItems).toHaveCount(2)
    await expect(clipItems.nth(0)).toContainText('First Clip')
    await expect(clipItems.nth(1)).toContainText('Second Clip')

    // Drag second clip's handle above the first clip using pointer events (dnd-kit PointerSensor)
    const handle = dragHandles.nth(1)
    const target = clipItems.nth(0)

    const handleBox = await handle.boundingBox()
    const targetBox = await target.boundingBox()
    if (!handleBox || !targetBox) throw new Error('Could not get bounding boxes for drag test')

    const startX = handleBox.x + handleBox.width / 2
    const startY = handleBox.y + handleBox.height / 2
    const endX = targetBox.x + targetBox.width / 2
    // Drop in upper quarter to place above the first item
    const endY = targetBox.y + targetBox.height / 4

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    // Activate PointerSensor: needs ≥5px movement before drag starts
    await page.mouse.move(startX, startY - 6, { steps: 4 })
    // Gradually move to target position
    await page.mouse.move(endX, endY, { steps: 20 })
    await page.mouse.up()

    // Assert new order: Second Clip is now before First Clip
    await expect(clipItems.nth(0)).toContainText('Second Clip')
    await expect(clipItems.nth(1)).toContainText('First Clip')
  })

  test('AC-8: Accessibility — keyboard navigation and ARIA labels', async ({ page }) => {
    await page.goto(`/library/${AUDIOBOOK_ID}/read`)

    // Start Clip button should have accessible name
    const startClipBtn = page.getByRole('button', { name: /start clip/i })
    await expect(startClipBtn).toBeVisible()

    // Clips panel button should have accessible name
    const clipsPanelBtn = page.getByRole('button', { name: /^clips$/i })
    await expect(clipsPanelBtn).toBeVisible()

    // Verify touch target size (minimum 44x44px)
    const box = await startClipBtn.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  })
})
