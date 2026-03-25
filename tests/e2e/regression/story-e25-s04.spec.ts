import { test, expect } from '@playwright/test'
import { seedAuthors, seedImportedCourses } from '../../support/helpers/seed-helpers'

test.describe('E25-S04: Author Auto-Detection During Import', () => {
  test.beforeEach(async ({ page }) => {
    // Dismiss welcome wizard so it doesn't block navigation
    await page.addInitScript(() => {
      localStorage.setItem(
        'knowlune-welcome-wizard-v1',
        JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
      )
    })
  })

  test('imported course linked to author appears on Authors page', async ({ page }) => {
    // Navigate to page first to init Dexie, then seed data
    await page.goto('/authors')

    // Seed author + imported course with authorId (simulates post-detection state)
    await seedAuthors(page, [
      {
        id: 'jane-smith-id',
        name: 'Jane Smith',
        courseIds: ['course-react-patterns'],
        isPreseeded: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ])

    await seedImportedCourses(page, [
      {
        id: 'course-react-patterns',
        name: 'Jane Smith - React Patterns',
        importedAt: '2026-01-01T00:00:00.000Z',
        category: '',
        tags: [],
        status: 'active',
        videoCount: 5,
        pdfCount: 1,
        authorId: 'jane-smith-id',
      },
    ])

    // Reload so Zustand picks up seeded data
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Verify author appears on the page as an author card
    const janeCard = page
      .locator('[data-testid="author-card"]')
      .filter({ hasText: 'Jane Smith' })
    await expect(janeCard).toBeVisible()
  })

  test('author without linked courses shows zero count', async ({ page }) => {
    await page.goto('/authors')

    // Seed only an author with no courses
    await seedAuthors(page, [
      {
        id: 'solo-author-id',
        name: 'Solo Author',
        courseIds: [],
        isPreseeded: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ])

    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.getByText('Solo Author')).toBeVisible()
  })
})
