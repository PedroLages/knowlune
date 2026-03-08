import { test, expect } from '@playwright/test'
import { FIXED_DATE, getRelativeDate, addMinutes } from '../utils/test-time'
import { seedStudySessions } from '../support/helpers/indexeddb-seed'
import { createCourse } from '../support/fixtures/factories/course-factory'
import { createSession } from '../support/fixtures/factories/session-factory'

test.describe('Story E07-S04: At-Risk Course Detection & Completion Estimates', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to courses page before each test
    await page.goto('/courses')
  })

  test('AC1: displays "At Risk" badge when course has 14+ days inactivity and momentum < 20', async ({
    page,
  }) => {
    // Arrange: Create course with last session 15 days ago (momentum will be < 20)
    const atRiskCourse = createCourse({
      id: 'at-risk-course',
      title: 'Neglected Course',
    })

    const oldSession = createSession({
      courseId: atRiskCourse.id,
      startTime: getRelativeDate(-15), // 15 days ago
      endTime: addMinutes(30),
      duration: 1800,
    })

    // Seed course and session
    await page.evaluate(
      async ({ course, session }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const tx = db.transaction(['courses', 'sessions'], 'readwrite')
        tx.objectStore('courses').add(course)
        tx.objectStore('sessions').add(session)
        await new Promise((resolve) => (tx.oncomplete = resolve))
        db.close()
      },
      { course: atRiskCourse, session: oldSession }
    )

    // Act: Reload page to trigger render
    await page.reload()

    // Assert: At-risk badge is visible
    const courseCard = page.locator(`[data-testid="course-card-${atRiskCourse.id}"]`)
    await expect(courseCard.locator('[data-testid="at-risk-badge"]')).toBeVisible()
  })

  test('AC2: removes "At Risk" badge when momentum score increases to 20+', async ({ page }) => {
    // Arrange: Create course with old session (at-risk)
    const course = createCourse({ id: 'recovering-course', title: 'Recovering Course' })

    const oldSession = createSession({
      courseId: course.id,
      startTime: getRelativeDate(-15),
      endTime: getRelativeDate(-15),
      duration: 1800,
    })

    await page.evaluate(
      async ({ course, session }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const tx = db.transaction(['courses', 'sessions'], 'readwrite')
        tx.objectStore('courses').add(course)
        tx.objectStore('sessions').add(session)
        await new Promise((resolve) => (tx.oncomplete = resolve))
        db.close()
      },
      { course, session: oldSession }
    )

    await page.reload()

    // Verify badge exists initially
    const courseCard = page.locator(`[data-testid="course-card-${course.id}"]`)
    await expect(courseCard.locator('[data-testid="at-risk-badge"]')).toBeVisible()

    // Act: Add recent session to boost momentum
    const recentSession = createSession({
      courseId: course.id,
      startTime: FIXED_DATE,
      endTime: addMinutes(60),
      duration: 3600,
    })

    await seedStudySessions(page, [recentSession])
    await page.reload()

    // Assert: At-risk badge is no longer visible
    await expect(courseCard.locator('[data-testid="at-risk-badge"]')).not.toBeVisible()
  })

  test('AC3: displays estimated completion time based on remaining content and average pace', async ({
    page,
  }) => {
    // Arrange: Create course with 120 min duration, 60% complete (48 min remaining)
    const course = createCourse({
      id: 'course-with-estimate',
      title: 'In Progress Course',
      duration: 7200, // 120 minutes in seconds
      progress: 60, // 60% complete
    })

    // User's average session: 30 min/session over past 30 days
    const sessions = [
      createSession({
        courseId: course.id,
        startTime: getRelativeDate(-5),
        endTime: getRelativeDate(-5),
        duration: 1800, // 30 min
      }),
      createSession({
        courseId: course.id,
        startTime: getRelativeDate(-10),
        endTime: getRelativeDate(-10),
        duration: 1800, // 30 min
      }),
    ]

    await page.evaluate(
      async ({ course, sessions }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const tx = db.transaction(['courses', 'sessions'], 'readwrite')
        tx.objectStore('courses').add(course)
        sessions.forEach((s) => tx.objectStore('sessions').add(s))
        await new Promise((resolve) => (tx.oncomplete = resolve))
        db.close()
      },
      { course, sessions }
    )

    await page.reload()

    // Assert: Completion estimate is displayed
    // 48 min remaining / 30 min per session = ~1.6 sessions (~2 sessions)
    const courseCard = page.locator(`[data-testid="course-card-${course.id}"]`)
    const estimateText = courseCard.locator('[data-testid="completion-estimate"]')
    await expect(estimateText).toBeVisible()
    await expect(estimateText).toContainText(/session/)
  })

  test('AC4: uses default 30-minute pace for new users with no sessions', async ({ page }) => {
    // Arrange: Create course with no sessions
    const course = createCourse({
      id: 'new-user-course',
      title: 'New User Course',
      duration: 3600, // 60 minutes
      progress: 0,
    })

    await page.evaluate(
      async ({ course }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const tx = db.transaction(['courses'], 'readwrite')
        tx.objectStore('courses').add(course)
        await new Promise((resolve) => (tx.oncomplete = resolve))
        db.close()
      },
      { course }
    )

    await page.reload()

    // Assert: Completion estimate uses default pace (60 min / 30 min = 2 sessions)
    const courseCard = page.locator(`[data-testid="course-card-${course.id}"]`)
    const estimateText = courseCard.locator('[data-testid="completion-estimate"]')
    await expect(estimateText).toBeVisible()
    await expect(estimateText).toContainText(/2.*session/)
  })

  test('AC5: displays both at-risk badge and completion estimate without overlap', async ({
    page,
  }) => {
    // Arrange: Create at-risk course with completion estimate
    const course = createCourse({
      id: 'at-risk-with-estimate',
      title: 'At Risk Course',
      duration: 3600,
      progress: 50,
    })

    const oldSession = createSession({
      courseId: course.id,
      startTime: getRelativeDate(-15),
      endTime: getRelativeDate(-15),
      duration: 1800,
    })

    await page.evaluate(
      async ({ course, session }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const tx = db.transaction(['courses', 'sessions'], 'readwrite')
        tx.objectStore('courses').add(course)
        tx.objectStore('sessions').add(session)
        await new Promise((resolve) => (tx.oncomplete = resolve))
        db.close()
      },
      { course, session: oldSession }
    )

    await page.reload()

    // Assert: Both indicators are visible
    const courseCard = page.locator(`[data-testid="course-card-${course.id}"]`)
    const atRiskBadge = courseCard.locator('[data-testid="at-risk-badge"]')
    const completionEstimate = courseCard.locator('[data-testid="completion-estimate"]')

    await expect(atRiskBadge).toBeVisible()
    await expect(completionEstimate).toBeVisible()

    // Assert: No visual overlap (bounding boxes don't intersect)
    const badgeBox = await atRiskBadge.boundingBox()
    const estimateBox = await completionEstimate.boundingBox()

    expect(badgeBox).toBeTruthy()
    expect(estimateBox).toBeTruthy()

    // Check for overlap: boxes don't overlap if one is completely to the left/right/above/below the other
    const noOverlap =
      badgeBox!.x + badgeBox!.width <= estimateBox!.x || // badge to left of estimate
      estimateBox!.x + estimateBox!.width <= badgeBox!.x || // estimate to left of badge
      badgeBox!.y + badgeBox!.height <= estimateBox!.y || // badge above estimate
      estimateBox!.y + estimateBox!.height <= badgeBox!.y // estimate above badge

    expect(noOverlap).toBeTruthy()
  })

  test('AC6: at-risk courses appear at bottom when sorted by momentum', async ({ page }) => {
    // Arrange: Create 3 courses with different momentum levels
    const hotCourse = createCourse({ id: 'hot-course', title: 'Hot Course' })
    const warmCourse = createCourse({ id: 'warm-course', title: 'Warm Course' })
    const atRiskCourse = createCourse({ id: 'at-risk-course', title: 'At Risk Course' })

    // Hot course: recent session
    const hotSession = createSession({
      courseId: hotCourse.id,
      startTime: FIXED_DATE,
      endTime: addMinutes(30),
      duration: 1800,
    })

    // Warm course: 7 days ago
    const warmSession = createSession({
      courseId: warmCourse.id,
      startTime: getRelativeDate(-7),
      endTime: getRelativeDate(-7),
      duration: 1800,
    })

    // At-risk course: 15 days ago
    const atRiskSession = createSession({
      courseId: atRiskCourse.id,
      startTime: getRelativeDate(-15),
      endTime: getRelativeDate(-15),
      duration: 1800,
    })

    await page.evaluate(
      async ({ courses, sessions }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('ElearningDB')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const tx = db.transaction(['courses', 'sessions'], 'readwrite')
        courses.forEach((c: any) => tx.objectStore('courses').add(c))
        sessions.forEach((s: any) => tx.objectStore('sessions').add(s))
        await new Promise((resolve) => (tx.oncomplete = resolve))
        db.close()
      },
      { courses: [hotCourse, warmCourse, atRiskCourse], sessions: [hotSession, warmSession, atRiskSession] }
    )

    await page.reload()

    // Act: Sort by momentum
    await page.locator('[data-testid="sort-by-momentum"]').click()

    // Assert: Course order is hot → warm → at-risk
    const courseCards = page.locator('[data-testid^="course-card-"]')
    const firstCard = courseCards.nth(0)
    const lastCard = courseCards.nth(2)

    await expect(firstCard).toHaveAttribute('data-testid', `course-card-${hotCourse.id}`)
    await expect(lastCard).toHaveAttribute('data-testid', `course-card-${atRiskCourse.id}`)

    // Verify at-risk badge is on the last card
    await expect(lastCard.locator('[data-testid="at-risk-badge"]')).toBeVisible()
  })
})
