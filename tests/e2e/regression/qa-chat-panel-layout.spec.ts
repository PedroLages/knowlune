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
import { seedIndexedDBStore } from '../../support/helpers/seed-helpers'

const DB_NAME = 'ElearningDB'

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

async function seedImportedVideos(page: Page, videos: ImportedVideoTestData[]): Promise<void> {
  await page.evaluate(
    async ({ dbName, data }) => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('importedVideos')) {
            db.close()
            reject(new Error('Store "importedVideos" not found'))
            return
          }
          const tx = db.transaction('importedVideos', 'readwrite')
          const store = tx.objectStore('importedVideos')
          for (const item of data) {
            store.put(item)
          }
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
    },
    { dbName: DB_NAME, data: videos }
  )
}

async function configureGeminiNoteQA(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const { saveAIConfiguration, saveProviderApiKey } = await import('/src/lib/aiConfiguration.ts')

    await saveProviderApiKey(
      'gemini',
      'AIzanotPRODUCTIONneverE2Eonly_knownfakekey000000000000000000'
    )
    await saveAIConfiguration({
      provider: 'openai',
      connectionStatus: 'unconfigured',
      consentSettings: {
        videoSummary: true,
        noteQA: true,
        learningPath: true,
        knowledgeGaps: true,
        noteOrganization: true,
        analytics: true,
      },
      featureModels: {
        noteQA: {
          provider: 'gemini',
          model: 'gemini-3-flash-preview',
        },
      },
    })
  })
}

async function seedLessonPlayerWithNotes(
  page: Page,
  indexedDB: { seedImportedCourses: (c: ReturnType<typeof createImportedCourse>[]) => Promise<void> }
): Promise<void> {
  await goToCourses(page)
  await indexedDB.seedImportedCourses([TEST_COURSE])
  await seedImportedVideos(page, TEST_VIDEOS)
  await seedIndexedDBStore(page, DB_NAME, 'notes', [
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
  await page.getByTestId('qa-panel-trigger').click()
  await expect(page.getByTestId('qa-panel-shell')).toBeVisible()
  await expect(page.getByTestId('qa-panel-keyboard-hint')).toBeVisible()
}

async function assertHintInsideShell(page: Page): Promise<void> {
  const hint = page.getByTestId('qa-panel-keyboard-hint')
  const shell = page.getByTestId('qa-panel-shell')

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
  return page.locator('[data-testid="qa-panel-shell"] [data-slot="scroll-area-viewport"]')
}

test.describe('QAChatPanel layout regression', () => {
  test('R1: desktop popover keeps keyboard hint inside panel shell', async ({ page, indexedDB }) => {
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
      scrollTop: el.scrollTop,
    }))

    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)
    expect(scrollMetrics.scrollTop).toBeGreaterThan(0)

    await viewport.evaluate(el => {
      el.scrollTop = 0
    })

    const afterScrollTop = await viewport.evaluate(el => el.scrollTop)
    expect(afterScrollTop).toBe(0)

    await expect(page.getByTestId('qa-panel-input')).toBeVisible()
    await expect(page.getByTestId('qa-panel-keyboard-hint')).toBeVisible()
    await assertHintInsideShell(page)
  })

  test('R3: mobile sheet keeps keyboard hint inside panel shell', async ({ page, indexedDB }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await seedLessonPlayerWithNotes(page, indexedDB)
    await openAskAIPanel(page)

    await expect(page.getByRole('dialog')).toBeVisible()
    await assertHintInsideShell(page)
  })
})
