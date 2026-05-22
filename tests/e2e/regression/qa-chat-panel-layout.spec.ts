/**
 * QAChatPanel layout regression — keyboard hint must stay inside panel shell.
 *
 * Requirements:
 *   R1 — Desktop popover: hint fully inside panel background
 *   R2 — Long message list scrolls; footer + hint pinned and visible
 *   R3 — Mobile sheet: same pinned footer behavior
 */
import { test, expect } from '../../support/fixtures'
import type { Page, Locator } from '@playwright/test'
import { createImportedCourse } from '../../support/fixtures/factories/imported-course-factory'
import { goToCourses, navigateAndWait } from '../../support/helpers/navigation'
import { configureGeminiNoteQA } from '../../support/helpers/note-qa-test-helpers'
import { seedImportedVideos, seedNotes } from '../../support/helpers/seed-helpers'

const TEST_COURSE = createImportedCourse({
  id: 'course-react-101',
  name: 'React Fundamentals',
  videoCount: 3,
  pdfCount: 1,
})

interface ImportedVideoTestData {
  id: string
  courseId: string
  filename: string
  order: number
  duration?: number
}

const TEST_VIDEOS: ImportedVideoTestData[] = [
  {
    id: 'video-intro',
    courseId: 'course-react-101',
    filename: '01-Introduction.mp4',
    order: 0,
    duration: 320,
  },
]

async function seedLessonPlayerWithNotes(
  page: Page,
  indexedDB: { seedImportedCourses: (c: ReturnType<typeof createImportedCourse>[]) => Promise<void> }
): Promise<void> {
  await goToCourses(page)
  await indexedDB.seedImportedCourses([TEST_COURSE])
  await seedImportedVideos(page, TEST_VIDEOS as unknown as Record<string, unknown>[])
  await seedNotes(page, [
    {
      id: 'note-gemini-qa',
      courseId: 'course-react-101',
      videoId: 'video-intro',
      content: 'React hooks let components use state and effects.',
      createdAt: '2026-04-27T00:00:00.000Z',
      updatedAt: '2026-04-27T00:00:00.000Z',
      tags: ['react'],
    },
  ])
  await configureGeminiNoteQA(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await navigateAndWait(page, '/courses/course-react-101/lessons/video-intro')
}

async function openAskAIPanel(page: Page): Promise<void> {
  const width = page.viewportSize()?.width ?? 1280

  if (width < 768) {
    // Mobile: QA trigger lives inside the BottomNav lesson tools drawer
    await page.getByTestId('bottomnav-more-trigger').click()
    await page.locator('[data-testid="qa-panel-trigger"]').filter({ visible: true }).click()
  } else if (width < 1024) {
    // Tablet: inline header trigger is hidden; open via kebab (controlled panel)
    await page.getByTestId('tablet-kebab-trigger').click()
    await page.getByTestId('kebab-qa-panel').click()
  } else {
    await page.getByTestId('qa-panel-trigger').click()
  }

  await expect(page.getByTestId('qa-panel-shell')).toBeVisible()
  await expect(page.getByTestId('qa-panel-keyboard-hint')).toBeVisible()
}

async function assertHintInsideShell(page: Page): Promise<void> {
  const hint = page.locator('[data-testid="qa-panel-keyboard-hint"]').filter({ visible: true })
  const shell = page.locator('[data-testid="qa-panel-shell"]').filter({ visible: true })

  await expect(hint).toBeVisible()
  await expect(shell).toBeVisible()

  const hintBox = await hint.boundingBox()
  const shellBox = await shell.boundingBox()

  expect(hintBox).toBeTruthy()
  expect(shellBox).toBeTruthy()

  const tolerance = 1
  expect(hintBox!.y).toBeGreaterThanOrEqual(shellBox!.y - tolerance)
  expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(shellBox!.y + shellBox!.height + tolerance)
}

async function seedManyQAMessages(page: Page, count = 24): Promise<void> {
  await page.evaluate(async ({ messageCount }) => {
    const { useQAChatStore } = await import('/src/stores/useQAChatStore.ts')
    useQAChatStore.getState().clearHistory()
    for (let i = 0; i < messageCount; i++) {
      useQAChatStore.getState().addQuestion(`Question ${i + 1}?`)
      useQAChatStore.getState().addAnswer(`Answer ${i + 1}: detailed response about React hooks.`, [], [])
    }
  }, { messageCount: count })
}

async function getMessageScrollViewport(page: Page): Promise<Locator> {
  return page.locator(
    '[data-testid="qa-panel-shell"]:visible [data-slot="scroll-area-viewport"]'
  )
}

test.describe('QAChatPanel layout regression', () => {
  test('R1: desktop popover keeps keyboard hint inside panel shell', async ({ page, indexedDB }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'R1 targets desktop popover layout')
    await seedLessonPlayerWithNotes(page, indexedDB)
    await openAskAIPanel(page)
    await assertHintInsideShell(page)
  })

  test('R2: long message list scrolls while footer and hint stay pinned inside shell', async ({
    page,
    indexedDB,
  }) => {
    await seedLessonPlayerWithNotes(page, indexedDB)
    await seedManyQAMessages(page)
    await openAskAIPanel(page)

    const viewport = await getMessageScrollViewport(page)
    await expect(viewport).toBeVisible()

    const scrollMetrics = await viewport.evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }))

    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)

    // Pre-seeded messages do not retrigger auto-scroll on panel open — scroll manually
    await viewport.evaluate(el => {
      el.scrollTop = el.scrollHeight
    })
    const scrolledDown = await viewport.evaluate(el => el.scrollTop)
    expect(scrolledDown).toBeGreaterThan(0)

    await viewport.evaluate(el => {
      el.scrollTop = 0
    })

    const afterScrollTop = await viewport.evaluate(el => el.scrollTop)
    expect(afterScrollTop).toBe(0)

    await expect(page.getByTestId('qa-panel-input')).toBeVisible()
    await expect(page.getByTestId('qa-panel-keyboard-hint')).toBeVisible()
    await assertHintInsideShell(page)
  })

  test('R3: mobile sheet keeps keyboard hint inside panel shell', async ({ page, indexedDB }, testInfo) => {
    test.skip(
      !testInfo.project.name.includes('Mobile'),
      'R3 targets mobile sheet layout'
    )
    await page.setViewportSize({ width: 375, height: 812 })
    await seedLessonPlayerWithNotes(page, indexedDB)
    await openAskAIPanel(page)

    await expect(page.getByRole('dialog')).toBeVisible()
    await assertHintInsideShell(page)
  })
})
