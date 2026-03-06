/**
 * ATDD tests for E04-S01: Mark Content Completion Status
 *
 * Tests use the static '6mx' course which has multiple modules with
 * multiple lessons — ideal for verifying status indicators, selectors,
 * and parent cascade behavior.
 *
 * Key IDs (from src/data/courses/6mx.ts):
 *   Course:  6mx
 *   Module:  6mx-day1 (5 lessons)
 *   Lesson1: 6mx-day1-human-comm
 *   Lesson2: 6mx-day1-laws
 */
import { test, expect } from '../support/fixtures'

const COURSE_ID = '6mx'
const MODULE_ID = '6mx-day1'
const LESSON_1_ID = '6mx-day1-human-comm'
const LESSON_2_ID = '6mx-day1-laws'

// All lessons in the Day One module
const DAY1_LESSON_IDS = [
  '6mx-day1-human-comm',
  '6mx-day1-laws',
  '6mx-day1-points-of-failure',
  '6mx-day1-btoe',
  '6mx-day1-eyes',
]

test.describe('E04-S01: Mark Content Completion Status', () => {
  test.beforeEach(async ({ page }) => {
    // Seed sidebar closed to prevent overlay on tablet viewports
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })
    // Clear any previous contentProgress data
    await page.goto(`/courses/${COURSE_ID}`)
    await page.evaluate(async () => {
      const request = indexedDB.open('ElearningDB')
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const db = request.result
          if (db.objectStoreNames.contains('contentProgress')) {
            const tx = db.transaction('contentProgress', 'readwrite')
            tx.objectStore('contentProgress').clear()
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          } else {
            db.close()
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      })
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    // Expand Day One module to reveal lessons
    await page.getByText('The 6MX Behavior Course Day One').click()
  })

  // AC1: Status selector with three options
  test('AC1: clicking a status indicator opens a selector with 3 options', async ({ page }) => {
    const statusIndicator = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await expect(statusIndicator).toBeVisible()
    await statusIndicator.click()

    // Status selector should appear with 3 options
    const selector = page.getByTestId('status-selector')
    await expect(selector).toBeVisible()

    await expect(selector.getByText('Not Started')).toBeVisible()
    await expect(selector.getByText('In Progress')).toBeVisible()
    await expect(selector.getByText('Completed')).toBeVisible()
  })

  // AC2: Optimistic state update
  test('AC2: selecting a new status updates the indicator optimistically', async ({ page }) => {
    const indicator = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await indicator.click()

    // Select "Completed" (wait for selector visibility, then click — matches AC4 pattern)
    await expect(page.getByTestId('status-selector')).toBeVisible()
    await page.getByTestId('status-selector').getByText('Completed').click()
    await expect(page.getByTestId('status-selector')).not.toBeVisible()

    // Indicator should immediately reflect the new status (optimistic)
    await expect(indicator).toHaveAttribute('data-status', 'completed')

    // Wait for async IndexedDB persistence to complete before reloading
    await expect
      .poll(
        async () => {
          return page.evaluate(async () => {
            const request = indexedDB.open('ElearningDB')
            return new Promise<string | null>(resolve => {
              request.onsuccess = () => {
                const db = request.result
                if (!db.objectStoreNames.contains('contentProgress')) {
                  db.close()
                  resolve(null)
                  return
                }
                const tx = db.transaction('contentProgress', 'readonly')
                const store = tx.objectStore('contentProgress')
                const getReq = store.get(['6mx', '6mx-day1-human-comm'])
                getReq.onsuccess = () => {
                  db.close()
                  resolve((getReq.result as { status?: string })?.status ?? null)
                }
                getReq.onerror = () => {
                  db.close()
                  resolve(null)
                }
              }
            })
          })
        },
        { timeout: 5000 }
      )
      .toBe('completed')

    // Verify persistence survives page reload
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByText('The 6MX Behavior Course Day One').click()
    const reloadedIndicator = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await expect(reloadedIndicator).toHaveAttribute('data-status', 'completed')
  })

  // AC3: Color-coded visual indicators with accessibility
  test('AC3: status indicators display correct color coding and accessibility labels', async ({
    page,
  }) => {
    // Default status should be "Not Started"
    const indicator = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await expect(indicator).toHaveAttribute('data-status', 'not-started')

    // Accessibility: indicator should have an accessible label (aria-label)
    const label = await indicator.getAttribute('aria-label')
    expect(label).not.toBeNull()
    expect(label?.toLowerCase()).toContain('not started')

    // Verify correct icon: not-started shows Circle icon
    const circleIcon = indicator.locator('svg.lucide-circle')
    await expect(circleIcon).toBeVisible()

    // Change to completed and verify Check icon
    await indicator.click()
    await page.getByTestId('status-selector').getByText('Completed').click()
    await expect(indicator).toHaveAttribute('data-status', 'completed')
    const checkIcon = indicator.locator('svg.lucide-check')
    await expect(checkIcon).toBeVisible()
  })

  // AC4: Auto-complete parent chapter when all children are completed
  test('AC4: completing all lessons in a module auto-completes the parent module', async ({
    page,
  }) => {
    // Mark all lessons in Day One as Completed
    for (const id of DAY1_LESSON_IDS) {
      const indicator = page.getByTestId(`status-indicator-${id}`)
      await indicator.click()
      await page.getByTestId('status-selector').getByText('Completed').click()
      // Wait for popover to close before next click
      await expect(page.getByTestId('status-selector')).not.toBeVisible()
    }

    // Parent module should auto-complete
    const moduleIndicator = page.getByTestId(`status-indicator-${MODULE_ID}`)
    await expect(moduleIndicator).toHaveAttribute('data-status', 'completed')
  })

  // AC5: Reverting a child reverts auto-completed parent
  test('AC5: changing a completed item back reverts the parent module to in-progress', async ({
    page,
  }) => {
    // Complete all lessons first
    for (const id of DAY1_LESSON_IDS) {
      const indicator = page.getByTestId(`status-indicator-${id}`)
      await indicator.click()
      await page.getByTestId('status-selector').getByText('Completed').click()
      await expect(page.getByTestId('status-selector')).not.toBeVisible()
    }

    // Verify parent is completed
    const moduleIndicator = page.getByTestId(`status-indicator-${MODULE_ID}`)
    await expect(moduleIndicator).toHaveAttribute('data-status', 'completed')

    // Now revert lesson 1 to "In Progress"
    const indicator1 = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await indicator1.click()
    await page.getByTestId('status-selector').getByText('In Progress').click()

    // Parent module should revert to in-progress
    await expect(moduleIndicator).toHaveAttribute('data-status', 'in-progress')
  })

  // AC5b: Reverting all children to not-started reverts parent to not-started
  test('AC5b: reverting all children to not-started reverts the parent module', async ({
    page,
  }) => {
    // Complete one lesson first
    const indicator1 = page.getByTestId(`status-indicator-${LESSON_1_ID}`)
    await indicator1.click()
    await page.getByTestId('status-selector').getByText('Completed').click()
    await expect(page.getByTestId('status-selector')).not.toBeVisible()

    // Module should be in-progress (one of many completed)
    const moduleIndicator = page.getByTestId(`status-indicator-${MODULE_ID}`)
    await expect(moduleIndicator).toHaveAttribute('data-status', 'in-progress')

    // Revert back to not-started
    await indicator1.click()
    await page.getByTestId('status-selector').getByText('Not Started').click()

    // Module should revert to not-started
    await expect(moduleIndicator).toHaveAttribute('data-status', 'not-started')
  })
})
