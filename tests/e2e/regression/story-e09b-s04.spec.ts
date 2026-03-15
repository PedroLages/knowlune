/**
 * E2E tests for Story E09B-S04: Knowledge Gap Detection
 *
 * Tests the Knowledge Gaps panel, rule-based gap detection, severity sorting,
 * note link suggestions, bidirectional linking, and AI fallback behavior.
 *
 * Status: ATDD — tests written before implementation (Red phase).
 */

import { test, expect, type Page } from '@playwright/test'
import { seedIndexedDBStore } from '../../support/helpers/indexeddb-seed'
import { FIXED_DATE } from '../../utils/test-time'

// ─── Shared test fixtures ────────────────────────────────────────────────────

const course1 = {
  id: 'course-1',
  name: 'React Fundamentals',
  importedAt: FIXED_DATE,
  category: 'Programming',
  tags: ['react', 'javascript'],
  status: 'not-started' as const,
  videoCount: 3,
  pdfCount: 0,
  // @ts-expect-error - FileSystemDirectoryHandle not available in test context
  directoryHandle: null,
}

const course2 = {
  id: 'course-2',
  name: 'Node.js Basics',
  importedAt: FIXED_DATE,
  category: 'Programming',
  tags: ['nodejs', 'javascript'],
  status: 'not-started' as const,
  videoCount: 2,
  pdfCount: 0,
  // @ts-expect-error - FileSystemDirectoryHandle not available in test context
  directoryHandle: null,
}

const video1 = {
  id: 'video-1',
  title: 'Intro to React',
  courseId: 'course-1',
  filename: 'intro.mp4',
  duration: 600,
  order: 1,
  importedAt: FIXED_DATE,
}

const video2 = {
  id: 'video-2',
  title: 'React Hooks',
  courseId: 'course-1',
  filename: 'hooks.mp4',
  duration: 900,
  order: 2,
  importedAt: FIXED_DATE,
}

const video3 = {
  id: 'video-3',
  title: 'State Management',
  courseId: 'course-1',
  filename: 'state.mp4',
  duration: 1200,
  order: 3,
  importedAt: FIXED_DATE,
}

const video4 = {
  id: 'video-4',
  title: 'Node.js Modules',
  courseId: 'course-2',
  filename: 'modules.mp4',
  duration: 800,
  order: 1,
  importedAt: FIXED_DATE,
}

// Note for course-2 (to be used in note link suggestion tests)
const existingNote = {
  id: 'note-existing',
  courseId: 'course-2',
  videoId: 'video-4',
  content: 'JavaScript async patterns are crucial for Node.js development.',
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  tags: ['javascript', 'async'],
}

// ─── Setup helpers ───────────────────────────────────────────────────────────

async function configureAI(page: Page, connected = true) {
  await page.addInitScript(connected => {
    localStorage.setItem(
      'ai-configuration',
      JSON.stringify({
        provider: 'openai',
        connectionStatus: connected ? 'connected' : 'unconfigured',
        apiKeyEncrypted: { iv: 'mock-iv', encryptedData: 'mock-encrypted' },
        consentSettings: {
          videoSummary: true,
          noteQA: true,
          learningPath: true,
          knowledgeGaps: true,
          noteOrganization: true,
          analytics: true,
        },
      })
    )
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  }, connected)
}

async function seedCourses(page: Page) {
  await seedIndexedDBStore(page, 'ElearningDB', 'importedCourses', [course1, course2])
  await seedIndexedDBStore(page, 'ElearningDB', 'importedVideos', [video1, video2, video3, video4])
}

// ─── AC1: Under-noted topic detection ────────────────────────────────────────

test('AC1 — detects under-noted topics (< 1 note per 3 videos)', async ({ page }) => {
  await configureAI(page)
  // No notes seeded — 3 videos, 0 notes for course-1 → under-noted critical gap
  await page.goto('/knowledge-gaps')
  await seedCourses(page)

  await page.getByTestId('analyze-gaps-button').click()
  // Note: analyzing-indicator may not be visible — detection completes near-instantly on small datasets
  await expect(page.getByTestId('knowledge-gaps-list')).toBeVisible({ timeout: 10000 })

  // Expect at least one under-noted gap for course-1
  const gapItem = page.getByTestId('gap-item').filter({ hasText: 'React Fundamentals' }).first()
  await expect(gapItem).toBeVisible()
  await expect(gapItem.getByTestId('gap-type')).toHaveText(/under-noted/i)
  await expect(gapItem.getByTestId('gap-severity')).toHaveAttribute('data-severity', 'critical')
})

// ─── AC2: Skipped video detection ────────────────────────────────────────────

test('AC2 — detects skipped videos (marked complete but < 50% watched)', async ({ page }) => {
  await configureAI(page)
  await page.goto('/knowledge-gaps')
  await seedCourses(page)

  // Seed video-1 as completed but only 30% watched
  await seedIndexedDBStore(page, 'ElearningDB', 'progress', [
    {
      courseId: 'course-1',
      videoId: 'video-1',
      currentTime: 180, // 30% of 600s
      completionPercentage: 30,
      completedAt: FIXED_DATE,
    },
  ])

  // Also seed a note so under-noted doesn't dominate
  await seedIndexedDBStore(page, 'ElearningDB', 'notes', [
    {
      id: 'note-1',
      courseId: 'course-1',
      videoId: 'video-1',
      content: 'Intro note',
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      tags: ['react'],
    },
    {
      id: 'note-2',
      courseId: 'course-1',
      videoId: 'video-2',
      content: 'Hooks note',
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      tags: ['hooks'],
    },
    {
      id: 'note-3',
      courseId: 'course-1',
      videoId: 'video-3',
      content: 'State note',
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      tags: ['state'],
    },
  ])

  await page.getByTestId('analyze-gaps-button').click()
  await expect(page.getByTestId('knowledge-gaps-list')).toBeVisible({ timeout: 10000 })

  // Note: videoTitle is derived from filename (intro.mp4 → "intro"), not fixture title
  const skippedGap = page.getByTestId('gap-item').filter({ hasText: 'intro' }).first()
  await expect(skippedGap.getByTestId('gap-type')).toHaveText(/skipped/i)
  await expect(skippedGap.getByTestId('gap-watch-percentage')).toHaveText(/30%/)
})

// ─── AC3: Gaps sorted by severity with direct video links ─────────────────────

test('AC3 — gaps sorted by severity with direct video links', async ({ page }) => {
  await configureAI(page)
  await page.goto('/knowledge-gaps')
  await seedCourses(page)

  // Seed: video-1 skipped at 20% (critical), video-2 skipped at 45% (medium)
  await seedIndexedDBStore(page, 'ElearningDB', 'progress', [
    {
      courseId: 'course-1',
      videoId: 'video-1',
      currentTime: 120,
      completionPercentage: 20,
      completedAt: FIXED_DATE,
    },
    {
      courseId: 'course-1',
      videoId: 'video-2',
      currentTime: 405,
      completionPercentage: 45,
      completedAt: FIXED_DATE,
    },
  ])

  await page.getByTestId('analyze-gaps-button').click()
  await expect(page.getByTestId('knowledge-gaps-list')).toBeVisible({ timeout: 10000 })

  // Critical gap should appear before medium gap
  const gapItems = page.getByTestId('gap-item')
  const firstSeverity = await gapItems
    .nth(0)
    .getByTestId('gap-severity')
    .getAttribute('data-severity')
  expect(firstSeverity).toBe('critical')

  // Each gap has a direct link to the video
  const firstLink = gapItems.nth(0).getByTestId('gap-video-link')
  await expect(firstLink).toBeVisible()
  const href = await firstLink.getAttribute('href')
  expect(href).toMatch(/imported-courses\/course-1\/lessons\/video-/)
})

// ─── AC4: Note link suggestion toast ──────────────────────────────────────────

test('AC4 — suggests note links via non-blocking toast when saving a note with shared tags', async ({
  page,
}) => {
  await configureAI(page)
  // Navigate to Knowledge Gaps page (any page with Sonner toasts works)
  await page.goto('/knowledge-gaps')
  await seedCourses(page)
  await seedIndexedDBStore(page, 'ElearningDB', 'notes', [existingNote])

  // Save a new note with 2+ shared tags via progress.saveNote (same path as LessonPlayer)
  await page.evaluate(async () => {
    const { saveNote } = await import('/src/lib/progress.ts')
    await saveNote('course-1', 'video-1', 'JavaScript async patterns are key for React too.', [
      'javascript',
      'async',
    ])
  })

  // Sonner toast should appear with note link suggestion
  const toastEl = page.locator('[data-sonner-toast]').filter({ hasText: 'Note connection found' })
  await expect(toastEl).toBeVisible({ timeout: 5000 })
  await expect(toastEl).toContainText('Node.js Basics') // targetCourseTitle
  await expect(toastEl.getByRole('button', { name: /link notes/i })).toBeVisible()
  await expect(toastEl.getByRole('button', { name: /dismiss/i })).toBeVisible()
})

// ─── AC5: Accept suggestion creates bidirectional link ─────────────────────────

test('AC5 — accepting note link suggestion creates bidirectional link visible in both notes', async ({
  page,
}) => {
  await configureAI(page)
  await page.goto('/knowledge-gaps')
  await seedCourses(page)
  await seedIndexedDBStore(page, 'ElearningDB', 'notes', [existingNote])

  // Save a new note that triggers note link suggestion
  await page.evaluate(async () => {
    const { saveNote } = await import('/src/lib/progress.ts')
    await saveNote('course-1', 'video-1', 'JavaScript async patterns in React components.', [
      'javascript',
      'async',
    ])
  })

  // Accept the link suggestion
  const toastEl = page.locator('[data-sonner-toast]').filter({ hasText: 'Note connection found' })
  await expect(toastEl).toBeVisible({ timeout: 5000 })
  await toastEl.getByRole('button', { name: /link notes/i }).click()

  // Verify success toast appears (confirms DB write succeeded)
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: 'Notes linked!' })
  ).toBeVisible({ timeout: 5000 })

  // Verify bidirectional link in IDB: both notes have linkedNoteIds
  const linkCheck = await page.evaluate(async () => {
    const { db } = await import('/src/db/index.ts')
    const allNotes = await db.notes.toArray()
    const source = allNotes.find(n => n.courseId === 'course-1' && n.videoId === 'video-1')
    const target = allNotes.find(n => n.id === 'note-existing')
    return {
      sourceLinked: source?.linkedNoteIds?.includes('note-existing') ?? false,
      targetLinked: target?.linkedNoteIds?.includes(source?.id ?? '') ?? false,
    }
  })

  expect(linkCheck.sourceLinked).toBe(true)
  expect(linkCheck.targetLinked).toBe(true)
})

// ─── AC6: Dismiss prevents re-suggestion for that pair ─────────────────────────

test('AC6 — dismissing note link suggestion prevents it from reappearing for that pair', async ({
  page,
}) => {
  await configureAI(page)
  await page.goto('/knowledge-gaps')
  await seedCourses(page)
  await seedIndexedDBStore(page, 'ElearningDB', 'notes', [existingNote])

  // First save: create note → expect toast
  await page.evaluate(async () => {
    const { saveNote } = await import('/src/lib/progress.ts')
    await saveNote('course-1', 'video-1', 'JavaScript async patterns — dismissed pair test.', [
      'javascript',
      'async',
    ])
  })

  const toastEl = page.locator('[data-sonner-toast]').filter({ hasText: 'Note connection found' })
  await expect(toastEl).toBeVisible({ timeout: 5000 })

  // Dismiss the suggestion
  await toastEl.getByRole('button', { name: /dismiss/i }).click()
  await expect(toastEl).not.toBeVisible()

  // Re-save the same note → toast should NOT reappear (dismissed pair persisted)
  await page.evaluate(async () => {
    const { saveNote } = await import('/src/lib/progress.ts')
    await saveNote(
      'course-1',
      'video-1',
      'JavaScript async patterns — dismissed pair test. Updated.',
      ['javascript', 'async']
    )
  })

  // Confirm toast does NOT appear
  await expect(
    page.locator('[data-sonner-toast]').filter({ hasText: 'Note connection found' })
  ).not.toBeVisible()
})

// ─── AC7: AI unavailable → rule-based fallback ────────────────────────────────

test('AC7 — falls back to rule-based detection when AI provider is unavailable', async ({
  page,
}) => {
  // Configure AI as unavailable
  await configureAI(page, false)
  await page.goto('/knowledge-gaps')
  await seedCourses(page)
  // No notes — 3 videos → under-noted gap detected by rule-based engine

  await page.getByTestId('analyze-gaps-button').click()
  await expect(page.getByTestId('knowledge-gaps-list')).toBeVisible({ timeout: 5000 })

  // Gaps ARE detected even without AI
  const gapItems = page.getByTestId('gap-item')
  await expect(gapItems.first()).toBeVisible()

  // "Rule-based analysis" badge should be shown (not AI-enriched)
  await expect(page.getByTestId('rule-based-analysis-badge')).toBeVisible()

  // No AI-specific descriptions (aiDescription fields absent)
  await expect(page.getByTestId('ai-gap-description')).not.toBeVisible()
})
