import type { Page } from '@playwright/test'
import { FIXED_DATE, getRelativeDate } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const OVERVIEW_STORES = [
  'importedCourses',
  'importedVideos',
  'importedPdfs',
  'progress',
  'contentProgress',
  'studySessions',
  'studySchedules',
  'flashcards',
  'quizzes',
  'quizAttempts',
] as const

export type OverviewSeedState = 'early' | 'active' | 'returning'

type OverviewStoreRecords = Partial<
  Record<(typeof OVERVIEW_STORES)[number], Array<Record<string, unknown>>>
>

export async function freezeOverviewClock(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date(FIXED_DATE))
}

export async function clearOverviewData(page: Page): Promise<void> {
  await replaceOverviewData(page, {})
}

async function replaceOverviewData(page: Page, records: OverviewStoreRecords): Promise<void> {
  await page.evaluate(
    async ({ dbName, stores, recordsByStore }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName)
        request.onsuccess = () => {
          const database = request.result
          const availableStores = stores.filter(store => database.objectStoreNames.contains(store))
          if (availableStores.length === 0) {
            database.close()
            resolve()
            return
          }

          const transaction = database.transaction(availableStores, 'readwrite')
          for (const storeName of availableStores) {
            const store = transaction.objectStore(storeName)
            store.clear()
            for (const record of recordsByStore[storeName] ?? []) store.put(record)
          }
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => {
            database.close()
            reject(transaction.error)
          }
        }
        request.onerror = () => reject(request.error)
      })
    },
    { dbName: DB_NAME, stores: [...OVERVIEW_STORES], recordsByStore: records }
  )
}

function completedSession(id: string, daysAgo: number, duration: number) {
  const startTime = getRelativeDate(-daysAgo)
  const endTime = new Date(new Date(startTime).getTime() + duration * 1000).toISOString()
  return {
    id,
    courseId: 'overview-course',
    contentItemId: daysAgo % 2 === 0 ? 'overview-pdf' : 'overview-lesson-2',
    startTime,
    endTime,
    duration,
    idleTime: 120,
    videosWatched: ['overview-lesson-2'],
    lastActivity: endTime,
    sessionType: daysAgo % 2 === 0 ? 'pdf' : 'video',
  }
}

export async function seedOverviewLearner(page: Page, state: OverviewSeedState): Promise<void> {
  await clearOverviewData(page)

  const course = {
    id: 'overview-course',
    name: 'Systems Thinking',
    description: 'A practical course for understanding complex systems.',
    importedAt: getRelativeDate(-45),
    category: 'Strategy',
    tags: ['systems', 'thinking'],
    status: 'active',
    videoCount: 2,
    pdfCount: 1,
    directoryHandle: null,
  }
  const videos = [
    {
      id: 'overview-lesson-1',
      courseId: course.id,
      filename: '01-foundations.mp4',
      title: 'Foundations',
      path: '01-foundations.mp4',
      duration: 900,
      format: 'mp4',
      order: 1,
      fileHandle: null,
    },
    {
      id: 'overview-lesson-2',
      courseId: course.id,
      filename: '02-feedback-loops.mp4',
      title: 'Feedback Loops',
      path: '02-feedback-loops.mp4',
      duration: 1200,
      format: 'mp4',
      order: 2,
      fileHandle: null,
    },
  ]
  const pdf = {
    id: 'overview-pdf',
    courseId: course.id,
    filename: 'systems-workbook.pdf',
    path: 'systems-workbook.pdf',
    pageCount: 48,
    fileHandle: null,
  }
  const progress = [
    {
      courseId: course.id,
      videoId: videos[0].id,
      currentTime: 900,
      completionPercentage: 100,
      completedAt: getRelativeDate(-4),
      updatedAt: getRelativeDate(-4),
    },
    {
      courseId: course.id,
      videoId: videos[1].id,
      currentTime: 360,
      completionPercentage: 30,
      updatedAt: getRelativeDate(-1),
    },
    {
      courseId: course.id,
      videoId: pdf.id,
      currentTime: 0,
      completionPercentage: 25,
      currentPage: 12,
      updatedAt: getRelativeDate(-2),
    },
  ]
  const contentProgress = [
    {
      courseId: course.id,
      itemId: videos[0].id,
      contentType: 'video',
      status: 'completed',
      progressPct: 100,
      updatedAt: getRelativeDate(-4),
    },
    {
      courseId: course.id,
      itemId: videos[1].id,
      contentType: 'video',
      status: 'in-progress',
      progressPct: 30,
      updatedAt: getRelativeDate(-1),
    },
  ]
  const sessions =
    state === 'early'
      ? [completedSession('session-early-1', 1, 1500), completedSession('session-early-2', 4, 900)]
      : state === 'returning'
        ? [
            completedSession('session-returning-1', 20, 1200),
            completedSession('session-returning-2', 21, 1800),
            completedSession('session-returning-3', 25, 900),
          ]
        : [
            completedSession('session-active-1', 1, 1800),
            completedSession('session-active-2', 2, 1200),
            completedSession('session-active-3', 4, 2700),
            completedSession('session-active-4', 8, 900),
          ]

  const quiz = {
    id: 'overview-quiz',
    lessonId: videos[1].id,
    title: 'Feedback loops check',
    description: 'Check your understanding.',
    questions: [
      {
        id: 'overview-question',
        order: 1,
        type: 'multiple-choice',
        text: 'What closes a feedback loop?',
        options: ['Observation', 'Action and response'],
        correctAnswer: 'Action and response',
        explanation: 'A loop connects an action to its observed result.',
        points: 1,
        topic: 'Feedback loops',
      },
    ],
    timeLimit: null,
    passingScore: 70,
    allowRetakes: true,
    shuffleQuestions: false,
    shuffleAnswers: false,
    createdAt: getRelativeDate(-10),
    updatedAt: getRelativeDate(-3),
  }
  const attempt = {
    id: 'overview-attempt',
    quizId: quiz.id,
    answers: [
      {
        questionId: 'overview-question',
        userAnswer: 'Observation',
        isCorrect: false,
        pointsEarned: 0,
        pointsPossible: 1,
      },
    ],
    score: 0,
    percentage: 60,
    passed: false,
    timeSpent: 90_000,
    completedAt: getRelativeDate(-2),
    startedAt: getRelativeDate(-2),
    timerAccommodation: 'standard',
  }
  const flashcard = {
    id: 'overview-flashcard',
    courseId: course.id,
    front: 'What is a reinforcing loop?',
    back: 'A loop that amplifies change.',
    stability: 2,
    difficulty: 5,
    reps: 2,
    lapses: 0,
    state: 2,
    elapsed_days: 2,
    scheduled_days: 2,
    due: getRelativeDate(-1),
    last_review: getRelativeDate(-3),
    createdAt: getRelativeDate(-20),
    updatedAt: getRelativeDate(-3),
  }

  await replaceOverviewData(page, {
    importedCourses: [course],
    importedVideos: videos,
    importedPdfs: [pdf],
    progress,
    contentProgress,
    studySessions: sessions,
    flashcards: [flashcard],
    quizzes: state === 'early' ? [] : [quiz],
    quizAttempts: state === 'early' ? [] : [attempt],
  })
}

export async function openSeededOverview(page: Page, state: OverviewSeedState): Promise<void> {
  await freezeOverviewClock(page)
  await page.goto('/overview', { waitUntil: 'domcontentloaded' })
  await seedOverviewLearner(page, state)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor({ state: 'visible' })
}
