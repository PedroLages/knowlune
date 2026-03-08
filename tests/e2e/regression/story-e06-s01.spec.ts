import { FIXED_DATE, getRelativeDate } from './../../utils/test-time'
/**
 * ATDD — E06-S01: Create Learning Challenges
 *
 * Acceptance tests mapped to each AC.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'

/** Navigate to the Challenges page. */
async function goToChallenges(page: import('@playwright/test').Page) {
  await navigateAndWait(page, '/challenges')
  await page.waitForSelector('[data-testid="header-create-challenge"]', {
    state: 'visible',
    timeout: 10000,
  })
}

/** Open the Create Challenge dialog from the page header button. */
async function openCreateDialog(page: import('@playwright/test').Page) {
  await goToChallenges(page)
  await page.getByTestId('header-create-challenge').click()
  // Wait for dialog to appear
  await expect(page.getByRole('dialog')).toBeVisible()
}

/** Fill the type select (Radix Select) */
async function selectType(page: import('@playwright/test').Page, type: RegExp) {
  await page.getByLabel(/challenge type/i).click()
  await page.getByRole('option', { name: type }).click()
}

test.describe('Create Learning Challenges (E06-S01)', () => {
  test.beforeEach(async ({ page }) => {
    // Close tablet sidebar overlay
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
  })

  test.afterEach(async ({ page }) => {
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('ElearningDB')
          req.onsuccess = () => {
            const idb = req.result
            if (!idb.objectStoreNames.contains('challenges')) {
              idb.close()
              resolve()
              return
            }
            const tx = idb.transaction('challenges', 'readwrite')
            const clearReq = tx.objectStore('challenges').clear()
            clearReq.onsuccess = () => {
              idb.close()
              resolve()
            }
            clearReq.onerror = () => reject(clearReq.error)
          }
          req.onerror = () => reject(req.error)
        })
    )
  })

  // ── AC 1: Form displays all required fields ──────────────────────
  test('AC1: create challenge form has name, type, target, and deadline fields', async ({
    page,
  }) => {
    await openCreateDialog(page)

    await expect(page.getByLabel(/challenge name/i)).toBeVisible()
    await expect(page.getByLabel(/challenge type/i)).toBeVisible()
    await expect(page.getByLabel(/target/i)).toBeVisible()
    await expect(page.getByLabel(/deadline/i)).toBeVisible()
  })

  // ── AC 2: Type selection updates target label ────────────────────
  test('AC2: selecting completion type shows "videos" as target unit', async ({ page }) => {
    await openCreateDialog(page)
    await selectType(page, /completion/i)
    await expect(page.getByLabel(/target.*videos/i)).toBeVisible()
  })

  test('AC2: selecting time type shows "hours" as target unit', async ({ page }) => {
    await openCreateDialog(page)
    await selectType(page, /time/i)
    await expect(page.getByLabel(/target.*hours/i)).toBeVisible()
  })

  test('AC2: selecting streak type shows "days" as target unit', async ({ page }) => {
    await openCreateDialog(page)
    await selectType(page, /streak/i)
    await expect(page.getByLabel(/target.*days/i)).toBeVisible()
  })

  test('AC2: changing type dynamically updates the target label', async ({ page }) => {
    await openCreateDialog(page)
    await selectType(page, /time/i)
    await expect(page.getByLabel(/target.*hours/i)).toBeVisible()

    // Re-select a different type and verify label updates
    await selectType(page, /completion/i)
    await expect(page.getByLabel(/target.*videos/i)).toBeVisible()
  })

  // ── AC 3: Valid submission saves to IndexedDB ────────────────────
  test('AC3: submitting valid form saves challenge and shows success toast', async ({ page }) => {
    await openCreateDialog(page)

    // Fill the form with valid data
    await page.getByLabel(/challenge name/i).fill('Complete 5 Videos')
    await selectType(page, /completion/i)
    await page.getByLabel(/target/i).fill('5')

    // Set deadline to 7 days from now
    const futureDate = new Date(getRelativeDate(7))
    await page
      .getByLabel(/deadline/i)
      .fill(
        `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`
      )

    // Submit via the dialog's submit button
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /create challenge/i })
      .click()

    // Success toast
    const toastEl = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /challenge.*created|created.*challenge/i })
    await expect(toastEl).toBeVisible({ timeout: 10000 })

    // Verify challenge appears in the list
    await expect(page.getByText('Complete 5 Videos')).toBeVisible()

    // Verify IndexedDB record has correct structural fields
    const record = await page.evaluate(async () => {
      const { indexedDB } = window
      return new Promise<Record<string, unknown> | null>((resolve, reject) => {
        const req = indexedDB.open('ElearningDB')
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('challenges', 'readonly')
          const store = tx.objectStore('challenges')
          const getAll = store.getAll()
          getAll.onsuccess = () => {
            const records = getAll.result as Record<string, unknown>[]
            resolve(records.length > 0 ? records[0] : null)
          }
          getAll.onerror = () => reject(getAll.error)
        }
        req.onerror = () => reject(req.error)
      })
    })

    expect(record).not.toBeNull()
    expect(record!.id).toBeTruthy()
    expect(typeof record!.id).toBe('string')
    expect(record!.createdAt).toBeTruthy()
    expect(record!.currentProgress).toBe(0)
  })

  // ── AC 4: Invalid submission shows inline errors ─────────────────
  test('AC4: empty name shows validation error', async ({ page }) => {
    await openCreateDialog(page)

    // Leave name empty, fill other fields
    await selectType(page, /completion/i)
    await page.getByLabel(/target/i).fill('5')

    const futureDate = new Date(getRelativeDate(7))
    await page
      .getByLabel(/deadline/i)
      .fill(
        `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`
      )

    // Submit
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /create challenge/i })
      .click()

    // Inline error for name field
    await expect(page.getByText(/name is required/i)).toBeVisible()
  })

  test('AC4: zero target value shows validation error', async ({ page }) => {
    await openCreateDialog(page)

    await page.getByLabel(/challenge name/i).fill('My Challenge')
    await selectType(page, /completion/i)
    await page.getByLabel(/target/i).fill('0')

    const futureDate = new Date(getRelativeDate(7))
    await page
      .getByLabel(/deadline/i)
      .fill(
        `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`
      )

    await page
      .getByRole('dialog')
      .getByRole('button', { name: /create challenge/i })
      .click()

    await expect(page.getByText(/must be greater than zero/i)).toBeVisible()
    // Dialog should remain open (form not submitted)
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('AC4: negative target value shows validation error', async ({ page }) => {
    await openCreateDialog(page)

    await page.getByLabel(/challenge name/i).fill('My Challenge')
    await selectType(page, /completion/i)
    await page.getByLabel(/target/i).fill('-5')

    const futureDate = new Date(getRelativeDate(7))
    await page
      .getByLabel(/deadline/i)
      .fill(
        `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`
      )

    await page
      .getByRole('dialog')
      .getByRole('button', { name: /create challenge/i })
      .click()

    await expect(page.getByText(/must be greater than zero/i)).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('AC4: past deadline shows validation error', async ({ page }) => {
    await openCreateDialog(page)

    await page.getByLabel(/challenge name/i).fill('My Challenge')
    await selectType(page, /completion/i)
    await page.getByLabel(/target/i).fill('5')

    // Set deadline in the past
    await page.getByLabel(/deadline/i).fill('2020-01-01')

    await page
      .getByRole('dialog')
      .getByRole('button', { name: /create challenge/i })
      .click()

    await expect(page.getByText(/deadline must be in the future/i)).toBeVisible()
  })

  // ── AC 5: Accessibility ──────────────────────────────────────────
  test('AC5: form fields have associated labels and are keyboard navigable', async ({ page }) => {
    await openCreateDialog(page)

    // Verify labels are associated (getByLabel succeeds only with proper label association)
    const nameInput = page.getByLabel(/challenge name/i)
    await expect(nameInput).toBeVisible()

    // Keyboard navigation: Tab through fields and verify focus actually lands
    await nameInput.focus()
    await expect(nameInput).toBeFocused()

    await page.keyboard.press('Tab')
    // Verify focus landed on the type select by checking document.activeElement
    const focusedAfterTab1 = await page.evaluate(() => document.activeElement?.id)
    expect(focusedAfterTab1).toBe('challenge-type')

    await page.keyboard.press('Tab')
    const focusedAfterTab2 = await page.evaluate(() => document.activeElement?.id)
    expect(focusedAfterTab2).toBe('challenge-target')

    await page.keyboard.press('Tab')
    const focusedAfterTab3 = await page.evaluate(() => document.activeElement?.id)
    expect(focusedAfterTab3).toBe('challenge-deadline')

    // Verify Cancel and Create buttons are focusable within the dialog
    // (date inputs have internal sub-elements so Tab count varies by browser)
    const cancelButton = page.getByRole('dialog').getByRole('button', { name: /cancel/i })
    await cancelButton.focus()
    await expect(cancelButton).toBeFocused()

    const createButton = page.getByRole('dialog').getByRole('button', { name: /create challenge/i })
    await createButton.focus()
    await expect(createButton).toBeFocused()
  })

  test('AC5: validation errors are announced via aria-live', async ({ page }) => {
    await openCreateDialog(page)

    // Submit empty form to trigger errors
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /create challenge/i })
      .click()

    // Check that each field's error is rendered with role="alert" (implicit aria-live="assertive")
    const alerts = page.locator('[role="alert"]')
    await expect(alerts.first()).toBeVisible()

    // Verify specific error messages are present
    await expect(page.locator('[role="alert"]', { hasText: /name is required/i })).toBeVisible()
    await expect(
      page.locator('[role="alert"]', { hasText: /select a challenge type/i })
    ).toBeVisible()
    await expect(
      page.locator('[role="alert"]', { hasText: /must be greater than zero/i })
    ).toBeVisible()
    await expect(page.locator('[role="alert"]', { hasText: /deadline is required/i })).toBeVisible()

    // Verify aria-invalid is set on each input
    await expect(page.getByLabel(/challenge name/i)).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel(/challenge type/i)).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel(/target/i)).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel(/deadline/i)).toHaveAttribute('aria-invalid', 'true')
  })
})
