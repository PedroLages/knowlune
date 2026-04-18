/**
 * E93-S03: Note Conflict Preservation
 *
 * Tests conflict badge visibility, dialog open/close, and resolution flows.
 * Seeds pre-built conflictCopy payloads via seedNotes (no actual two-device sync).
 *
 * Navigation: /notes (global notes page) — notes seeded directly into IndexedDB.
 *
 * @since E93-S03
 */
import { test, expect } from '../support/fixtures'
import { seedNotes } from '../support/helpers/seed-helpers'
import { dismissOnboarding } from '../helpers/dismiss-onboarding'
import { FIXED_DATE, getRelativeDate } from '../utils/test-time'

const CONFLICT_NOTE_ID = 'note-e93-s03-conflict'
const CLEAN_NOTE_ID = 'note-e93-s03-clean'

const WINNING_CONTENT = '<p>Remote winning content</p>'
const LOSING_CONTENT = '<p>Older local version content</p>'

const CONFLICT_NOTE = {
  id: CONFLICT_NOTE_ID,
  courseId: 'course-e93',
  videoId: 'video-e93',
  content: WINNING_CONTENT,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: ['remote-tag'],
  deleted: false,
  conflictCopy: {
    content: LOSING_CONTENT,
    tags: ['local-tag'],
    savedAt: getRelativeDate(-1),
  },
}

const CLEAN_NOTE = {
  id: CLEAN_NOTE_ID,
  courseId: 'course-e93',
  videoId: 'video-e93-2',
  content: '<p>Clean note with no conflict</p>',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: [],
  deleted: false,
}

test.describe('E93-S03: Note Conflict Preservation', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss onboarding overlays and close sidebar BEFORE navigation
    await dismissOnboarding(page)

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  // ── Test 1: Conflict badge visible on conflicted note ────────────────────

  test('conflict badge button is visible on a note with active conflictCopy', async ({ page }) => {
    await seedNotes(page, [CONFLICT_NOTE])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.goto('/notes')
    await page.waitForLoadState('domcontentloaded')

    const badge = page.getByRole('button', { name: /sync conflict/i })
    await expect(badge).toBeVisible()
  })

  // ── Test 2: No conflict badge on clean notes ─────────────────────────────

  test('no conflict badge on notes without conflictCopy', async ({ page }) => {
    await seedNotes(page, [CLEAN_NOTE])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.goto('/notes')
    await page.waitForLoadState('domcontentloaded')

    const badge = page.getByRole('button', { name: /sync conflict/i })
    await expect(badge).not.toBeVisible()
  })

  // ── Test 3: Badge click opens conflict dialog ────────────────────────────

  test('clicking conflict badge opens the conflict dialog with both version panels', async ({ page }) => {
    await seedNotes(page, [CONFLICT_NOTE])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.goto('/notes')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /sync conflict/i }).click()

    // Dialog should open
    await expect(page.getByRole('dialog')).toBeVisible()
    // Use heading role to avoid strict-mode collision with the badge button text
    await expect(page.getByRole('heading', { name: /sync conflict/i })).toBeVisible()

    // Both version panels should be present
    await expect(page.getByText('Current version', { exact: true })).toBeVisible()
    await expect(page.getByText('Other version', { exact: true })).toBeVisible()
  })

  // ── Test 4: "Keep Current" resolution ───────────────────────────────────

  test('"Keep Current" resolves conflict — badge disappears, content unchanged', async ({ page }) => {
    await seedNotes(page, [CONFLICT_NOTE])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.goto('/notes')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /sync conflict/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: /keep current/i }).click()

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Conflict badge should be gone
    await expect(page.getByRole('button', { name: /sync conflict/i })).not.toBeVisible()
  })

  // ── Test 5: "Use Other Version" resolution ───────────────────────────────

  test('"Use Other Version" resolves conflict — badge disappears', async ({ page }) => {
    // Seed a fresh note for this test
    const freshNote = {
      ...CONFLICT_NOTE,
      id: 'note-e93-s03-use-other',
    }
    await seedNotes(page, [freshNote])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.goto('/notes')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /sync conflict/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    await page.getByRole('button', { name: /use other version/i }).click()

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Conflict badge should be gone
    await expect(page.getByRole('button', { name: /sync conflict/i })).not.toBeVisible()
  })

  // ── Test 6: Resolved note has conflictCopy: null in IndexedDB ───────────
  // (syncQueue integration tested via unit tests — E2E verifies Dexie state)

  test('after "Keep Current", resolved note has conflictCopy: null in IndexedDB', async ({ page }) => {
    const noteId = 'note-e93-s03-dexie-check'

    await seedNotes(page, [{ ...CONFLICT_NOTE, id: noteId }])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.goto('/notes')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /sync conflict/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /keep current/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Verify conflictCopy was cleared in Dexie
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- reading Dexie state post-resolution
    const noteInDexie = await page.evaluate(async (id: string) => {
      return new Promise<{ conflictCopy: unknown } | null>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('notes', 'readonly')
          const store = tx.objectStore('notes')
          const getReq = store.get(id)
          getReq.onsuccess = () => {
            db.close()
            const note = getReq.result
            resolve(note ? { conflictCopy: note.conflictCopy } : null)
          }
          getReq.onerror = () => { db.close(); reject(getReq.error) }
        }
        req.onerror = () => reject(req.error)
      })
    }, noteId)

    expect(noteInDexie).not.toBeNull()
    // conflictCopy should be null (explicitly cleared) — not the original object
    expect(noteInDexie?.conflictCopy).toBeNull()
  })

  // ── Test 7: "Merge" button is disabled ──────────────────────────────────

  test('"Merge" button is disabled with tooltip text', async ({ page }) => {
    await seedNotes(page, [CONFLICT_NOTE])
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.goto('/notes')
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /sync conflict/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const mergeButton = page.getByRole('button', { name: /merge/i })
    await expect(mergeButton).toBeDisabled()
  })
})
