/**
 * E50-S06: SRS Events in Feed + Overview Widget
 *
 * Tests cover:
 * - AC3: Study blocks shown in time order for today
 * - AC4: Flashcard due count with "Review now" button
 * - AC5: Empty state when no schedules or due cards
 * - AC6: "Start" button navigates to course page
 */
import { test, expect } from '../../support/fixtures'
import { FIXED_DATE } from '../../utils/test-time'
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'
import {
  createDueFlashcard,
  createFutureFlashcard,
} from '../../support/fixtures/factories/flashcard-factory'

const DB_NAME = 'ElearningDB'

// Dismiss WelcomeWizard and OnboardingOverlay by marking both complete in localStorage
const WIZARD_DISMISSED = JSON.stringify({ completedAt: FIXED_DATE })
const ONBOARDING_DISMISSED = JSON.stringify({ completedAt: FIXED_DATE, skipped: true })

// FIXED_DATE is 2025-01-15 (Wednesday)
const TODAY_DAY = 'wednesday'

function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: `sched-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Study Block',
    days: [TODAY_DAY],
    startTime: '09:00',
    durationMinutes: 60,
    recurrence: 'weekly',
    reminderMinutes: 15,
    enabled: true,
    timezone: 'UTC',
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

test.describe("E50-S06: Today's Study Plan Widget", () => {
  test('AC5: empty state when no schedules or due cards', async ({ page }) => {
    // Mock date to FIXED_DATE (Wednesday)
    await page.addInitScript((fixedDate: string) => {
      const fixed = new Date(fixedDate).getTime()
      const OrigDate = Date
      class MockDate extends OrigDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) super(fixed)
          else super(...(args as [unknown]))
        }
        static override now() {
          return fixed
        }
      }
       
      globalThis.Date = MockDate as unknown as DateConstructor
    }, FIXED_DATE)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const widget = page.getByTestId('todays-study-plan')
    await expect(widget).toBeVisible()
    await expect(widget.getByText('No study blocks today.')).toBeVisible()
    await expect(widget.getByText('Schedule study time')).toBeVisible()
  })

  test('AC3: study blocks shown in time order', async ({ page }) => {
    await page.addInitScript((fixedDate: string) => {
      const fixed = new Date(fixedDate).getTime()
      const OrigDate = Date
      class MockDate extends OrigDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) super(fixed)
          else super(...(args as [unknown]))
        }
        static override now() {
          return fixed
        }
      }
      globalThis.Date = MockDate as unknown as DateConstructor
    }, FIXED_DATE)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Seed two Wednesday study blocks (later time first to verify sort)
    await seedIndexedDBStore(page, DB_NAME, 'studySchedules', [
      makeSchedule({
        id: 'sched-afternoon',
        title: 'Afternoon React',
        startTime: '14:00',
        durationMinutes: 45,
      }),
      makeSchedule({
        id: 'sched-morning',
        title: 'Morning TypeScript',
        startTime: '08:30',
        durationMinutes: 60,
      }),
    ])

    // Reload so Zustand picks up seeded data
    await page.reload({ waitUntil: 'networkidle' })

    const widget = page.getByTestId('todays-study-plan')
    await expect(widget).toBeVisible()

    // Both blocks visible
    await expect(widget.getByText('Morning TypeScript')).toBeVisible()
    await expect(widget.getByText('Afternoon React')).toBeVisible()

    // Verify time order: Morning appears before Afternoon in DOM
    const items = widget.locator('[aria-label*="at"]')
    const labels = await items.allTextContents()
    const morningIdx = labels.findIndex(l => l.includes('Morning TypeScript'))
    const afternoonIdx = labels.findIndex(l => l.includes('Afternoon React'))
    expect(morningIdx).toBeLessThan(afternoonIdx)
  })

  test('AC4: flashcard due count with Review now button', async ({ page }) => {
    await page.addInitScript((fixedDate: string) => {
      const fixed = new Date(fixedDate).getTime()
      const OrigDate = Date
      class MockDate extends OrigDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) super(fixed)
          else super(...(args as [unknown]))
        }
        static override now() {
          return fixed
        }
      }
      globalThis.Date = MockDate as unknown as DateConstructor
    }, FIXED_DATE)
    // Dismiss WelcomeWizard + OnboardingOverlay so they don't cover widget
    await page.addInitScript(
      ([wizardVal, onboardingVal]: string[]) => {
        localStorage.setItem('knowlune-welcome-wizard-v1', wizardVal)
        localStorage.setItem('knowlune-onboarding-v1', onboardingVal)
      },
      [WIZARD_DISMISSED, ONBOARDING_DISMISSED]
    )

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Seed 3 due flashcards and 1 future (not due)
    const flashcards = [
      createDueFlashcard({ id: 'fc-due-1' }),
      createDueFlashcard({ id: 'fc-due-2' }),
      createDueFlashcard({ id: 'fc-due-3' }),
      createFutureFlashcard({ id: 'fc-future-1' }),
    ]
    await seedIndexedDBStore(
      page,
      DB_NAME,
      'flashcards',
      flashcards as unknown as Record<string, unknown>[]
    )

    await page.reload({ waitUntil: 'networkidle' })

    const widget = page.getByTestId('todays-study-plan')
    await expect(widget).toBeVisible()

    // Wait for Overview skeleton to clear (500ms delay) and flashcards to load from IDB
    // The widget may briefly show empty state before loadFlashcards() resolves
    await expect(widget.getByText(/\d+ flashcards? due for review/)).toBeVisible({ timeout: 15000 })
    await expect(widget.getByText(/3 flashcards due for review/)).toBeVisible({ timeout: 5000 })
    await expect(widget.getByText('Review now')).toBeVisible()
  })

  test('AC6: Start button navigates to course page', async ({ page }) => {
    await page.addInitScript((fixedDate: string) => {
      const fixed = new Date(fixedDate).getTime()
      const OrigDate = Date
      class MockDate extends OrigDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) super(fixed)
          else super(...(args as [unknown]))
        }
        static override now() {
          return fixed
        }
      }
      globalThis.Date = MockDate as unknown as DateConstructor
    }, FIXED_DATE)
    // Dismiss WelcomeWizard + OnboardingOverlay so Start button is clickable
    await page.addInitScript(
      ([wizardVal, onboardingVal]: string[]) => {
        localStorage.setItem('knowlune-welcome-wizard-v1', wizardVal)
        localStorage.setItem('knowlune-onboarding-v1', onboardingVal)
      },
      [WIZARD_DISMISSED, ONBOARDING_DISMISSED]
    )

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const courseId = 'course-react-101'
    await seedIndexedDBStore(page, DB_NAME, 'studySchedules', [
      makeSchedule({ id: 'sched-nav', title: 'React Study', courseId }),
    ])

    await page.reload({ waitUntil: 'networkidle' })

    const widget = page.getByTestId('todays-study-plan')
    await expect(widget.getByText('React Study')).toBeVisible()

    await widget.getByRole('button', { name: /Start studying/i }).click()

    await page.waitForURL(`**/courses/${courseId}`)
    expect(page.url()).toContain(`/courses/${courseId}`)
  })
})
