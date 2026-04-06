/**
 * LocalStorage fixture for seeding and cleaning up app state.
 *
 * The Knowlune app stores all user data in localStorage:
 *   - 'course-progress': Record<string, CourseProgress>
 *   - 'study-log': StudyAction[]
 *   - 'video-bookmarks': VideoBookmark[]
 *   - 'study-streak-pause': StreakPause
 *   - 'study-longest-streak': string
 *
 * This fixture provides helpers to seed and clear this data,
 * ensuring test isolation.
 */
import { test as base, Page } from '@playwright/test'

const STORAGE_KEYS = [
  'course-progress',
  'study-log',
  'video-bookmarks',
  'study-streak-pause',
  'study-longest-streak',
  'study-streak-freeze-days',
  'notes-migration-version',
  'study-goals',
  'study-reminders',
  'study-reminders-last-daily',
  'study-reminders-last-risk',
  'streak-milestones',
  'dashboard-section-order',
  'dashboard-section-stats',
  'video-playback-speed',
] as const

type LocalStorageHelper = {
  /** Seed a localStorage key with JSON data. Must be called after page.goto(). */
  seed: (key: string, data: unknown) => Promise<void>
  /** Clear all app-specific localStorage keys. Must be called after page.goto(). */
  clearAll: () => Promise<void>
  /** Get parsed JSON from a localStorage key. Must be called after page.goto(). */
  get: <T = unknown>(key: string) => Promise<T | null>
}

async function clearAppStorage(page: Page): Promise<void> {
  await page.evaluate(
    keys => {
      for (const key of keys) {
        localStorage.removeItem(key)
      }
    },
    [...STORAGE_KEYS]
  )
}

export const test = base.extend<{ localStorage: LocalStorageHelper }>({
  localStorage: async ({ page }, use) => {
    // Seed sidebar + onboarding dismissal via addInitScript so they are applied
    // before every page.goto() within this test. This prevents the onboarding
    // overlay and mobile sidebar Sheet from blocking test interactions.
    // Tests that rely on the onboarding dialog being visible (e.g. onboarding.spec.ts)
    // use page.addInitScript with __test_show_onboarding=1 BEFORE this fixture runs,
    // which takes precedence via the navigateAndWait guard logic.
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
      localStorage.setItem(
        'knowlune-onboarding-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
      )
      // Dismiss WelcomeWizard (uses a different storage key than onboarding)
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })

    const helper: LocalStorageHelper = {
      seed: async (key, data) => {
        await page.evaluate(
          ({ k, v }) => {
            window.localStorage.setItem(k, JSON.stringify(v))
          },
          { k: key, v: data }
        )
      },

      clearAll: async () => {
        await clearAppStorage(page)
        await page.evaluate(() => sessionStorage.clear())
      },

      get: async <T = unknown>(key: string): Promise<T | null> => {
        return page.evaluate(k => {
          const raw = window.localStorage.getItem(k)
          return raw ? JSON.parse(raw) : null
        }, key)
      },
    }

    await use(helper)

    // Auto-cleanup: clear all app storage after each test
    try {
      await clearAppStorage(page)
    } catch {
      // Page may already be closed; ignore cleanup errors
    }
  },
})
