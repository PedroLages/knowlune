/**
 * ATDD E2E tests for E25-S08: Progressive Sidebar Disclosure
 *
 * Tests progressive disclosure of sidebar navigation items:
 * - AC1: New users see simplified sidebar (Overview, My Courses, Courses, Settings)
 * - AC2: Unlocking disclosure keys reveals additional items
 * - AC3: "Show all menu items" toggle in Settings bypasses disclosure
 * - AC4: Disclosure state persists in localStorage
 * - AC5: Direct URL navigation still works for hidden items
 */
import { test, expect } from '../../support/fixtures'

const DISCLOSURE_STORAGE_KEY = 'knowlune-sidebar-disclosure-v1'
const SHOW_ALL_STORAGE_KEY = 'knowlune-sidebar-show-all-v1'

// Always-visible items (no disclosureKey)
const ALWAYS_VISIBLE = ['Overview', 'My Courses', 'Courses']

// Items gated behind disclosure keys
const GATED_ITEMS = {
  'course-imported': ['Authors'],
  'lesson-completed': ['Study Analytics', 'Quiz Analytics'],
  'note-created': ['Notes'],
  'review-used': ['Review', 'Retention'],
  'challenge-used': ['Challenges', 'Session History'],
  'ai-used': ['Learning Path', 'Knowledge Gaps', 'AI Analytics'],
}

test.describe('E25-S08: Progressive Sidebar Disclosure', () => {
  test.describe('AC1: Default sidebar for new users', () => {
    test('shows only always-visible items plus Settings for new users', async ({ page }) => {
      // Clear any disclosure state
      await page.goto('/')
      await page.evaluate(
        ([dk, sk]) => {
          localStorage.removeItem(dk)
          localStorage.removeItem(sk)
        },
        [DISCLOSURE_STORAGE_KEY, SHOW_ALL_STORAGE_KEY]
      )
      await page.reload()
      await page.waitForLoadState('networkidle')

      // Desktop sidebar should show only always-visible items + Settings
      const sidebar = page.locator('aside[aria-label="Sidebar"]')
      await expect(sidebar).toBeVisible()

      for (const name of ALWAYS_VISIBLE) {
        await expect(sidebar.getByText(name, { exact: true })).toBeVisible()
      }

      // Settings always visible at bottom
      await expect(sidebar.getByText('Settings', { exact: true })).toBeVisible()

      // Gated items should NOT be visible
      for (const items of Object.values(GATED_ITEMS)) {
        for (const name of items) {
          await expect(sidebar.getByText(name, { exact: true })).not.toBeVisible()
        }
      }
    })
  })

  test.describe('AC2: Unlocking reveals items', () => {
    test('unlocking course-imported reveals Authors', async ({ page }) => {
      await page.goto('/')
      await page.evaluate(
        ([dk, sk]) => {
          localStorage.removeItem(dk)
          localStorage.removeItem(sk)
        },
        [DISCLOSURE_STORAGE_KEY, SHOW_ALL_STORAGE_KEY]
      )
      await page.reload()
      await page.waitForLoadState('networkidle')

      const sidebar = page.locator('aside[aria-label="Sidebar"]')
      await expect(sidebar.getByText('Authors', { exact: true })).not.toBeVisible()

      // Simulate unlocking via localStorage + event
      await page.evaluate(key => {
        localStorage.setItem(key, JSON.stringify(['course-imported']))
        window.dispatchEvent(new CustomEvent('sidebar-unlock', { detail: 'course-imported' }))
      }, DISCLOSURE_STORAGE_KEY)

      await expect(sidebar.getByText('Authors', { exact: true })).toBeVisible()
    })

    test('unlocking lesson-completed reveals analytics items', async ({ page }) => {
      await page.goto('/')
      await page.evaluate(
        ([dk, sk]) => {
          localStorage.removeItem(dk)
          localStorage.removeItem(sk)
        },
        [DISCLOSURE_STORAGE_KEY, SHOW_ALL_STORAGE_KEY]
      )
      await page.reload()
      await page.waitForLoadState('networkidle')

      const sidebar = page.locator('aside[aria-label="Sidebar"]')
      await expect(sidebar.getByText('Study Analytics', { exact: true })).not.toBeVisible()

      await page.evaluate(key => {
        localStorage.setItem(key, JSON.stringify(['lesson-completed']))
        window.dispatchEvent(new CustomEvent('sidebar-unlock', { detail: 'lesson-completed' }))
      }, DISCLOSURE_STORAGE_KEY)

      await expect(sidebar.getByText('Study Analytics', { exact: true })).toBeVisible()
      await expect(sidebar.getByText('Quiz Analytics', { exact: true })).toBeVisible()
    })
  })

  test.describe('AC3: Show all toggle in Settings', () => {
    test('toggling "Show all menu items" reveals everything', async ({ page }) => {
      await page.goto('/')
      await page.evaluate(
        ([dk, sk]) => {
          localStorage.removeItem(dk)
          localStorage.removeItem(sk)
        },
        [DISCLOSURE_STORAGE_KEY, SHOW_ALL_STORAGE_KEY]
      )
      await page.reload()
      await page.waitForLoadState('networkidle')

      const sidebar = page.locator('aside[aria-label="Sidebar"]')

      // Verify gated items are hidden
      await expect(sidebar.getByText('Authors', { exact: true })).not.toBeVisible()

      // Navigate to Settings and toggle "Show all"
      await sidebar.getByText('Settings', { exact: true }).click()
      await page.waitForLoadState('networkidle')

      const showAllSwitch = page.locator('#show-all-nav')
      await expect(showAllSwitch).toBeVisible()
      await showAllSwitch.click()

      // Navigate back to overview to check sidebar
      await sidebar.getByText('Overview', { exact: true }).click()
      await page.waitForLoadState('networkidle')

      // Now all items should be visible
      for (const items of Object.values(GATED_ITEMS)) {
        for (const name of items) {
          await expect(sidebar.getByText(name, { exact: true })).toBeVisible()
        }
      }
    })
  })

  test.describe('AC4: Persistence', () => {
    test('disclosure state persists across page reloads', async ({ page }) => {
      await page.goto('/')
      // Pre-seed disclosure state
      await page.evaluate(
        ([dk, sk]) => {
          localStorage.setItem(dk, JSON.stringify(['course-imported', 'note-created']))
          localStorage.removeItem(sk)
        },
        [DISCLOSURE_STORAGE_KEY, SHOW_ALL_STORAGE_KEY]
      )
      await page.reload()
      await page.waitForLoadState('networkidle')

      const sidebar = page.locator('aside[aria-label="Sidebar"]')
      // Unlocked items visible
      await expect(sidebar.getByText('Authors', { exact: true })).toBeVisible()
      await expect(sidebar.getByText('Notes', { exact: true })).toBeVisible()

      // Still-locked items hidden
      await expect(sidebar.getByText('Study Analytics', { exact: true })).not.toBeVisible()
    })

    test('show-all preference persists across reloads', async ({ page }) => {
      await page.goto('/')
      await page.evaluate(
        ([dk, sk]) => {
          localStorage.removeItem(dk)
          localStorage.setItem(sk, 'true')
        },
        [DISCLOSURE_STORAGE_KEY, SHOW_ALL_STORAGE_KEY]
      )
      await page.reload()
      await page.waitForLoadState('networkidle')

      const sidebar = page.locator('aside[aria-label="Sidebar"]')
      // Everything should be visible
      await expect(sidebar.getByText('Authors', { exact: true })).toBeVisible()
      await expect(sidebar.getByText('Notes', { exact: true })).toBeVisible()
      await expect(sidebar.getByText('Study Analytics', { exact: true })).toBeVisible()
    })
  })

  test.describe('AC5: URL access always works', () => {
    test('hidden pages are still accessible via direct URL', async ({ page }) => {
      await page.goto('/')
      await page.evaluate(
        ([dk, sk]) => {
          localStorage.removeItem(dk)
          localStorage.removeItem(sk)
        },
        [DISCLOSURE_STORAGE_KEY, SHOW_ALL_STORAGE_KEY]
      )

      // Navigate directly to authors (hidden in sidebar)
      await page.goto('/authors')
      await page.waitForLoadState('networkidle')

      // Page should load (not 404 or redirect)
      await expect(page).toHaveURL(/\/authors/)
    })
  })
})
