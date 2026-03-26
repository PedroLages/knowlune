import { test, expect } from '@playwright/test'
import { seedImportedCourses, seedStudySessions } from '../support/helpers/seed-helpers'
import { FIXED_DATE, addMinutes } from '../utils/test-time'

/**
 * NFR35: Export notes as Markdown with YAML frontmatter
 *
 * This test validates the note export functionality:
 * - Export button appears in expanded note view
 * - Clicking export triggers a download
 * - Downloaded file has .md extension
 * - File contains YAML frontmatter and Markdown content
 */
test.describe('NFR35: Note export as Markdown', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first to initialize IndexedDB
    await page.goto('/')

    // Seed a course with modules and lessons
    await seedImportedCourses(page, [
      {
        id: 'test-course-export',
        name: 'Test Course for Export',
        tags: [],
        status: 'ready',
        modules: [
          {
            id: 'test-module',
            title: 'Test Module',
            order: 1,
            lessons: [
              {
                id: 'test-lesson',
                title: 'Test Lesson',
                order: 1,
              },
            ],
          },
        ],
      },
    ])

    // Seed a test note
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    await page.evaluate(async () => {
      const request = indexedDB.open('ElearningDB')
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = async () => {
          const db = request.result
          const tx = db.transaction(['notes'], 'readwrite')
          const store = tx.objectStore('notes')

          const testNote = {
            id: 'test-note-export',
            courseId: 'test-course-export',
            videoId: 'test-lesson',
            content: '<h1>Test Note</h1><p>This is a <strong>bold</strong> test.</p>',
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T12:00:00.000Z',
            tags: ['test', 'export'],
          }

          store.add(testNote)

          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    })

    // Seed a study session to ensure course appears in navigation
    await seedStudySessions(page, [
      {
        id: 'session-1',
        courseId: 'test-course-export',
        lessonId: 'test-lesson',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        duration: 1800,
      },
    ])
  })

  test('should show export button in expanded note view', async ({ page }) => {
    // Navigate to the notes page
    await page.goto('/notes')

    // Wait for page to load and notes to be visible
    await page.waitForLoadState('networkidle')

    // Wait for note card to appear
    const noteCard = page.getByTestId('note-card').first()
    await expect(noteCard).toBeVisible()

    // Export button should initially be hidden (collapsed view)
    const exportButton = page.locator('[data-testid="export-note-button"]').first()
    await expect(exportButton).toBeHidden()

    // Expand the note card by clicking the preview text (inside clickable area)
    await noteCard.locator('p').click()

    // Export button should now be visible
    await expect(exportButton).toBeVisible()
  })

  test('should trigger download when export button is clicked', async ({ page }) => {
    // Navigate to the notes page
    await page.goto('/notes')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Wait for note card to appear and expand it
    await page.getByTestId('note-card').first().locator('p').click()

    // Set up download listener before clicking
    const downloadPromise = page.waitForEvent('download')

    // Click the export button
    await page.getByTestId('export-note-button').click()

    // Wait for download to start
    const download = await downloadPromise

    // Verify filename ends with .md
    const suggestedFilename = download.suggestedFilename()
    expect(suggestedFilename).toMatch(/\.md$/)
    expect(suggestedFilename).toContain('Test-Note')
  })

  test('should export markdown with correct YAML frontmatter', async ({ page }) => {
    // Navigate to the notes page
    await page.goto('/notes')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Wait for note card to appear and expand it
    await page.getByTestId('note-card').first().locator('p').click()

    // Wait for export button to appear
    await page.waitForSelector('[data-testid="export-note-button"]', { state: 'visible' })

    // Set up download listener and get content
    const downloadPromise = page.waitForEvent('download')

    // Click the export button
    await page.getByTestId('export-note-button').click()

    // Wait for download and read content
    const download = await downloadPromise
    const path = await download.path()
    expect(path).toBeTruthy()

    if (path) {
      const fs = await import('fs/promises')
      const content = await fs.readFile(path, 'utf-8')

      // Verify YAML frontmatter
      expect(content).toContain('---')
      expect(content).toContain('title: "Test Note"')
      expect(content).toContain('tags: ["test", "export"]')
      expect(content).toContain('course: "test-course-export"') // Falls back to ID for test-seeded courses
      expect(content).toContain('lesson: "test-lesson"') // Falls back to ID for test-seeded lessons
      expect(content).toContain('created: "2025-01-15T10:00:00.000Z"')
      expect(content).toContain('updated: "2025-01-15T12:00:00.000Z"')

      // Verify Markdown content
      expect(content).toContain('# Test Note')
      expect(content).toContain('**bold**')
      expect(content).toContain('This is a')
    }
  })

  test('should sanitize special characters in filename', async ({ page }) => {
    // Seed a note with special characters
    // eslint-disable-next-line test-patterns/use-seeding-helpers -- test-specific seeding with custom schema
    await page.evaluate(async () => {
      const request = indexedDB.open('ElearningDB')
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = async () => {
          const db = request.result
          const tx = db.transaction(['notes'], 'readwrite')
          const store = tx.objectStore('notes')

          const testNote = {
            id: 'test-note-special',
            courseId: 'test-course-export',
            videoId: 'test-lesson',
            content: '<p>My/Note:Test?File*Name</p>',
            createdAt: '2025-01-15T10:00:00.000Z',
            updatedAt: '2025-01-15T10:00:00.000Z',
            tags: [],
          }

          store.add(testNote)

          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    })

    // Navigate to the notes page
    await page.goto('/notes')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Find the second note card (special chars) and expand it
    const noteCards = page.getByTestId('note-card')
    await noteCards.nth(1).locator('p').click()

    // Wait for the second note's export button to appear
    await page.waitForSelector('[data-testid="export-note-button"]', { state: 'visible' })

    // Set up download listener
    const downloadPromise = page.waitForEvent('download')

    // Click the export button (should be the only visible one now)
    await page.getByTestId('export-note-button').click()

    // Wait for download
    const download = await downloadPromise

    // Verify filename has sanitized special chars
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^My-Note-Test-File-Name\.md$/)
  })

  test('should show success toast after export', async ({ page }) => {
    // Navigate to the notes page
    await page.goto('/notes')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Wait for note card to appear and expand it
    await page.getByTestId('note-card').first().locator('p').click()

    // Set up download listener (to prevent download dialog)
    page.on('download', () => {})

    // Click the export button
    await page.getByTestId('export-note-button').click()

    // Verify success toast appears
    await expect(page.getByText('Note exported successfully')).toBeVisible()
  })
})
