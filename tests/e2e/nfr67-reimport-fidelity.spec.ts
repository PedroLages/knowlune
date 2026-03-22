import { test, expect } from '@playwright/test'
import {
  seedImportedCourses,
  seedStudySessions,
  seedNotes,
} from '../support/helpers/seed-helpers'
import { FIXED_DATE, addMinutes } from '../utils/test-time'

// addMinutes(minutes) adds minutes to FIXED_DATE and returns ISO string

/**
 * NFR67: Exported data can be re-imported with >= 95% semantic fidelity.
 *
 * Seeds data -> exports JSON -> clears DB -> re-imports -> compares record counts.
 */
test.describe('NFR67: Export/Re-import round-trip fidelity', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // Seed diverse test data
    await seedImportedCourses(page, [
      {
        id: 'fidelity-course-1',
        name: 'Fidelity Test Course',
        tags: ['testing', 'nfr67'],
        status: 'ready',
        modules: [
          {
            id: 'mod-1',
            title: 'Module 1',
            order: 1,
            lessons: [{ id: 'vid-1', title: 'Lesson 1', type: 'video', order: 1 }],
          },
        ],
        importedAt: FIXED_DATE,
      },
    ])

    await seedNotes(page, [
      {
        id: 'fidelity-note-1',
        courseId: 'fidelity-course-1',
        videoId: 'vid-1',
        content: '<p>Round-trip fidelity test note</p>',
        plainText: 'Round-trip fidelity test note',
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
        tags: ['fidelity'],
      },
    ])

    await seedStudySessions(page, [
      {
        id: 'fidelity-session-1',
        courseId: 'fidelity-course-1',
        startTime: FIXED_DATE,
        endTime: addMinutes(30),
        durationMinutes: 30,
      },
    ])

    await page.reload()
    await page.waitForLoadState('domcontentloaded')
  })

  test('export and re-import preserves all records', async ({ page }) => {
    // Step 1: Export via the export service
    const exportData = await page.evaluate(async () => {
      const { exportAllAsJson } = await import('/src/lib/exportService.ts')
      return await exportAllAsJson()
    })
    expect(exportData).toBeTruthy()
    expect(exportData.schemaVersion).toBeDefined()
    expect(exportData.data).toBeDefined()

    // Count records in export
    const exportCounts = {
      courses: (exportData.data.importedCourses || []).length,
      notes: (exportData.data.notes || []).length,
      sessions: (exportData.data.studySessions || []).length,
    }

    expect(exportCounts.courses).toBeGreaterThanOrEqual(1)
    expect(exportCounts.notes).toBeGreaterThanOrEqual(1)
    expect(exportCounts.sessions).toBeGreaterThanOrEqual(1)

    // Step 2: Clear all data
    await page.evaluate(async () => {
      const { db } = await import('/src/db/schema.ts')
      // Clear all tables
      const tableNames = db.tables.map(t => t.name)
      await db.transaction('rw', db.tables, async () => {
        for (const name of tableNames) {
          await db.table(name).clear()
        }
      })
      localStorage.clear()
    })

    // Step 3: Re-import
    const exportJson = JSON.stringify(exportData)
    const importResult = await page.evaluate(async (json: string) => {
      const { importFullData } = await import('/src/lib/importService.ts')
      return await importFullData(json)
    }, exportJson)

    expect(importResult.success).toBe(true)
    expect(importResult.recordCount).toBeGreaterThan(0)

    // Step 4: Verify data integrity - count records after re-import
    const reimportCounts = await page.evaluate(async () => {
      const { db } = await import('/src/db/schema.ts')
      return {
        courses: await db.importedCourses.count(),
        notes: await db.notes.count(),
        sessions: await db.studySessions.count(),
      }
    })

    // >= 95% fidelity: all seeded records must round-trip
    expect(reimportCounts.courses).toBe(exportCounts.courses)
    expect(reimportCounts.notes).toBe(exportCounts.notes)
    expect(reimportCounts.sessions).toBe(exportCounts.sessions)
  })
})
