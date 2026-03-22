/**
 * ATDD — E11-S02: Knowledge Retention Dashboard
 *
 * Failing acceptance tests mapped to each AC.
 * Tests seed IndexedDB with notes, review records, and study sessions,
 * then verify the retention dashboard renders correctly.
 */
import { test, expect } from '../../support/fixtures'
import { navigateAndWait } from '../../support/helpers/navigation'
import {
  seedIndexedDBStore,
  clearIndexedDBStore,
  seedStudySessions,
} from '../../support/helpers/seed-helpers'
import { createDexieNote } from '../../support/fixtures/factories/note-factory'
import { createStudySession } from '../../support/fixtures/factories/session-factory'
import { FIXED_DATE, getRelativeDate } from '../../utils/test-time'

const DB_NAME = 'ElearningDB'

const FIXED_NOW = new Date(FIXED_DATE)

/** Create a review record with specific retention characteristics */
function createReviewRecord(
  noteId: string,
  overrides: {
    reviewedDaysAgo?: number
    intervalDays?: number
    easeFactor?: number
    reviewCount?: number
    rating?: 'hard' | 'good' | 'easy'
  } = {}
) {
  const {
    reviewedDaysAgo = 1,
    intervalDays = 3,
    easeFactor = 2.5,
    reviewCount = 1,
    rating = 'good',
  } = overrides

  const reviewedAt = new Date(FIXED_NOW.getTime() - reviewedDaysAgo * 86_400_000)
  const nextReviewAt = new Date(reviewedAt.getTime() + intervalDays * 86_400_000)

  return {
    id: crypto.randomUUID(),
    noteId,
    rating,
    reviewedAt: reviewedAt.toISOString(),
    nextReviewAt: nextReviewAt.toISOString(),
    interval: intervalDays,
    easeFactor,
    reviewCount,
  }
}

/** Seed notes, reviews, and optionally sessions, then reload */
async function seedRetentionData(
  page: import('@playwright/test').Page,
  data: {
    notes: Record<string, unknown>[]
    reviews: Record<string, unknown>[]
    sessions?: Record<string, unknown>[]
  }
) {
  await navigateAndWait(page, '/retention')

  await seedIndexedDBStore(page, DB_NAME, 'notes', data.notes)
  await seedIndexedDBStore(page, DB_NAME, 'reviewRecords', data.reviews)
  if (data.sessions?.length) {
    await seedStudySessions(page, data.sessions)
  }

  await page.reload()
  await page.waitForLoadState('load')
}

/** Wait for the retention dashboard to settle */
async function waitForDashboard(page: import('@playwright/test').Page) {
  await Promise.race([
    page.waitForSelector('[data-testid="retention-dashboard"]', {
      state: 'visible',
      timeout: 15_000,
    }),
    page.waitForSelector('[data-testid="retention-empty-state"]', {
      state: 'visible',
      timeout: 15_000,
    }),
  ])
}

// Freeze browser clock to FIXED_DATE and seed sidebar closed for tablet viewports
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FIXED_NOW })
  await page.addInitScript(() => {
    localStorage.setItem('knowlune-sidebar-v1', 'false')
  })
})

test.afterEach(async ({ page }) => {
  await clearIndexedDBStore(page, DB_NAME, 'notes')
  await clearIndexedDBStore(page, DB_NAME, 'reviewRecords')
  // studySessions may not exist in all tests
  await clearIndexedDBStore(page, DB_NAME, 'studySessions').catch(e =>
    console.warn('[afterEach] studySessions cleanup:', e)
  )
})

// ─────────────────────────────────────────────────────────
// AC1: Per-topic retention level display
// ─────────────────────────────────────────────────────────

test.describe('AC1: Topic retention levels', () => {
  test('displays retention level (strong/fading/weak) per topic based on review history', async ({
    page,
  }) => {
    // Create notes with different topics (tags)
    const noteStrong = createDexieNote({ tags: ['Mathematics'] })
    const noteFading = createDexieNote({ tags: ['Physics'] })
    const noteWeak = createDexieNote({ tags: ['Chemistry'] })

    // Strong: reviewed recently (1 day ago, 7-day interval → high retention)
    const reviewStrong = createReviewRecord(noteStrong.id, {
      reviewedDaysAgo: 1,
      intervalDays: 7,
    })
    // Fading: e^(-3/7) = 65% → fading range (50-79%)
    const reviewFading = createReviewRecord(noteFading.id, {
      reviewedDaysAgo: 3,
      intervalDays: 7,
    })
    // Weak: reviewed long ago (14 days ago, 3-day interval → low retention)
    const reviewWeak = createReviewRecord(noteWeak.id, {
      reviewedDaysAgo: 14,
      intervalDays: 3,
    })

    await seedRetentionData(page, {
      notes: [noteStrong, noteFading, noteWeak],
      reviews: [reviewStrong, reviewFading, reviewWeak],
    })
    await waitForDashboard(page)

    // Each topic should display with its retention level
    const mathCard = page.locator('[data-testid="topic-retention-card"]', {
      hasText: 'Mathematics',
    })
    await expect(mathCard).toBeVisible()
    await expect(mathCard.getByText(/strong/i)).toBeVisible()

    const physicsCard = page.locator('[data-testid="topic-retention-card"]', {
      hasText: 'Physics',
    })
    await expect(physicsCard).toBeVisible()
    await expect(physicsCard.getByText(/fading/i)).toBeVisible()

    const chemCard = page.locator('[data-testid="topic-retention-card"]', {
      hasText: 'Chemistry',
    })
    await expect(chemCard).toBeVisible()
    await expect(chemCard.getByText(/weak/i)).toBeVisible()
  })

  test('shows time elapsed since last review per topic', async ({ page }) => {
    const note = createDexieNote({ tags: ['History'] })
    const review = createReviewRecord(note.id, {
      reviewedDaysAgo: 3,
      intervalDays: 7,
    })

    await seedRetentionData(page, {
      notes: [note],
      reviews: [review],
    })
    await waitForDashboard(page)

    const topicCard = page.locator('[data-testid="topic-retention-card"]', {
      hasText: 'History',
    })
    await expect(topicCard).toBeVisible()
    // Should display time elapsed (e.g., "3 days ago")
    await expect(topicCard.getByText(/3 days/i)).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────
// AC2: Retention level degradation over time
// ─────────────────────────────────────────────────────────

test.describe('AC2: Retention degradation', () => {
  test('retention degrades from strong to fading to weak as time passes', async ({ page }) => {
    // Two notes in the same topic with different review ages
    // to demonstrate the degradation visual indicator
    const noteRecent = createDexieNote({ tags: ['Biology'] })
    const noteOld = createDexieNote({ tags: ['Geology'] })

    // Recently reviewed → strong
    const reviewRecent = createReviewRecord(noteRecent.id, {
      reviewedDaysAgo: 0,
      intervalDays: 7,
    })
    // Long overdue → weak (reviewed 20 days ago with 3-day interval)
    const reviewOld = createReviewRecord(noteOld.id, {
      reviewedDaysAgo: 20,
      intervalDays: 3,
    })

    await seedRetentionData(page, {
      notes: [noteRecent, noteOld],
      reviews: [reviewRecent, reviewOld],
    })
    await waitForDashboard(page)

    // Biology should show strong with success color
    const biologyCard = page.locator('[data-testid="topic-retention-card"]', {
      hasText: 'Biology',
    })
    await expect(biologyCard.locator('[data-testid="retention-indicator"]')).toHaveAttribute(
      'data-level',
      'strong'
    )

    // Geology should show weak with destructive color
    const geologyCard = page.locator('[data-testid="topic-retention-card"]', {
      hasText: 'Geology',
    })
    await expect(geologyCard.locator('[data-testid="retention-indicator"]')).toHaveAttribute(
      'data-level',
      'weak'
    )
  })
})

// ─────────────────────────────────────────────────────────
// AC3: Engagement decay — study frequency decline
// ─────────────────────────────────────────────────────────

test.describe('AC3: Frequency decline alert', () => {
  test('shows alert when study frequency drops below 50% of 2-week rolling average', async ({
    page,
  }) => {
    const note = createDexieNote({ tags: ['General'] })
    const review = createReviewRecord(note.id, { reviewedDaysAgo: 1, intervalDays: 7 })

    // Create sessions: many in previous 2 weeks (14-28d ago), few in current 2 weeks (0-14d)
    // Weekly buckets: [w3: 28-21d, w2: 21-14d, w1: 14-7d, w0: 7-0d]
    // previousTwoWeeks = w3+w2, currentTwoWeeks = w1+w0
    const sessions: Record<string, unknown>[] = []

    // Previous 2 weeks (14-28 days ago): 10 sessions
    for (let i = 0; i < 10; i++) {
      sessions.push(
        createStudySession({
          startTime: getRelativeDate(-15 - i), // days 15-24 ago
          endTime: getRelativeDate(-15 - i),
          duration: 1800,
        })
      )
    }

    // Current 2 weeks (0-14 days ago): 2 sessions (<50% of 10)
    sessions.push(
      createStudySession({
        startTime: getRelativeDate(-5),
        endTime: getRelativeDate(-5),
        duration: 1800,
      })
    )
    sessions.push(
      createStudySession({
        startTime: getRelativeDate(-1),
        endTime: getRelativeDate(-1),
        duration: 1800,
      })
    )

    await seedRetentionData(page, {
      notes: [note],
      reviews: [review],
      sessions,
    })
    await waitForDashboard(page)

    // Should display frequency decline alert
    const alert = page.locator('[data-testid="engagement-decay-alert"]', {
      hasText: /frequency/i,
    })
    await expect(alert).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────
// AC4: Engagement decay — session duration decline
// ─────────────────────────────────────────────────────────

test.describe('AC4: Duration decline alert', () => {
  test('shows alert when session duration declines more than 30% over 4 weeks', async ({
    page,
  }) => {
    const note = createDexieNote({ tags: ['General'] })
    const review = createReviewRecord(note.id, { reviewedDaysAgo: 1, intervalDays: 7 })

    const sessions: Record<string, unknown>[] = []

    // Week 4 ago: long sessions (3600s = 60 min)
    for (let i = 0; i < 3; i++) {
      sessions.push(
        createStudySession({
          startTime: getRelativeDate(-28 + i),
          endTime: getRelativeDate(-28 + i),
          duration: 3600,
        })
      )
    }

    // Week 3 ago: slightly shorter (3000s = 50 min)
    for (let i = 0; i < 3; i++) {
      sessions.push(
        createStudySession({
          startTime: getRelativeDate(-21 + i),
          endTime: getRelativeDate(-21 + i),
          duration: 3000,
        })
      )
    }

    // Week 2 ago: shorter (2000s = 33 min)
    for (let i = 0; i < 3; i++) {
      sessions.push(
        createStudySession({
          startTime: getRelativeDate(-14 + i),
          endTime: getRelativeDate(-14 + i),
          duration: 2000,
        })
      )
    }

    // Last week: very short (1200s = 20 min — >30% decline from week 4)
    for (let i = 0; i < 3; i++) {
      sessions.push(
        createStudySession({
          startTime: getRelativeDate(-7 + i),
          endTime: getRelativeDate(-7 + i),
          duration: 1200,
        })
      )
    }

    await seedRetentionData(page, {
      notes: [note],
      reviews: [review],
      sessions,
    })
    await waitForDashboard(page)

    const alert = page.locator('[data-testid="engagement-decay-alert"]', {
      hasText: /duration/i,
    })
    await expect(alert).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────
// AC5: Engagement decay — stalled completion velocity
// ─────────────────────────────────────────────────────────

test.describe('AC5: Stalled progress alert', () => {
  test('shows alert with suggestion when completion velocity is negative for 3+ weeks', async ({
    page,
  }) => {
    const note = createDexieNote({ tags: ['General'] })
    const review = createReviewRecord(note.id, { reviewedDaysAgo: 1, intervalDays: 7 })

    // All sessions are older than 3 weeks — nothing in last 21 days
    // This means recentWeeks (last 3 weekly buckets) all have 0 sessions
    const sessions: Record<string, unknown>[] = []
    for (let i = 0; i < 4; i++) {
      sessions.push(
        createStudySession({
          startTime: getRelativeDate(-25 - i), // 25-28 days ago
          endTime: getRelativeDate(-25 - i),
          duration: 1800,
        })
      )
    }

    await seedRetentionData(page, {
      notes: [note],
      reviews: [review],
      sessions,
    })
    await waitForDashboard(page)

    const alert = page.locator('[data-testid="engagement-decay-alert"]', {
      hasText: /stalled|progress/i,
    })
    await expect(alert).toBeVisible()
    // Should include suggestion to revisit material
    await expect(alert.getByText(/revisit/i)).toBeVisible()
  })
})

// ─────────────────────────────────────────────────────────
// AC6: Healthy engagement state
// ─────────────────────────────────────────────────────────

test.describe('AC6: Healthy engagement', () => {
  test('shows healthy status when no decay conditions are met', async ({ page }) => {
    const note = createDexieNote({ tags: ['Mathematics'] })
    const review = createReviewRecord(note.id, {
      reviewedDaysAgo: 1,
      intervalDays: 7,
    })

    // Consistent sessions over 4 weeks (no decline)
    const sessions: Record<string, unknown>[] = []
    for (let day = 0; day < 28; day += 2) {
      sessions.push(
        createStudySession({
          startTime: getRelativeDate(-day),
          endTime: getRelativeDate(-day),
          duration: 1800,
        })
      )
    }

    await seedRetentionData(page, {
      notes: [note],
      reviews: [review],
      sessions,
    })
    await waitForDashboard(page)

    // No decay alerts should be visible
    await expect(page.locator('[data-testid="engagement-decay-alert"]')).toHaveCount(0)

    // Healthy engagement indicator should be visible
    await expect(page.locator('[data-testid="engagement-status-healthy"]')).toBeVisible()
  })
})
