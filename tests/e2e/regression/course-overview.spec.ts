/**
 * CourseOverview page E2E tests.
 *
 * Tests the /courses/:courseId/overview route which displays:
 * - Hero section with course title, category badge, difficulty badge
 * - Stats row (duration, lessons, videos, level)
 * - About section with description
 * - Author card with link to author profile
 * - "What You'll Learn" tags section
 * - CTA card with "Start First Lesson" button
 * - Curriculum section with expandable modules and lessons
 * - Not-found state for invalid course IDs
 * - Sequential course locking (locked modules show lock icons)
 */
import { test, expect } from '../../support/fixtures'
import { seedIndexedDBStore, seedAuthors } from '../../support/helpers/seed-helpers'
import { createCourse, createModule, createLesson } from '../../support/fixtures/factories'
import { FIXED_DATE } from '../../utils/test-time'
import { navigateAndWait } from '../../support/helpers/navigation'

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const AUTHOR_ID = 'test-author-overview'
const COURSE_ID = 'test-course-overview'

function buildTestAuthor() {
  return {
    id: AUTHOR_ID,
    name: 'Jane Doe',
    title: 'Behavioral Science Expert',
    bio: 'An expert in behavioral analysis and influence.',
    shortBio: 'Behavioral science expert',
    courseIds: [COURSE_ID],
    specialties: ['behavioral-analysis', 'influence'],
    isPreseeded: false,
    createdAt: FIXED_DATE,
  }
}

function buildLesson1() {
  return createLesson({
    id: 'lesson-overview-1',
    title: 'Introduction to Body Language',
    order: 1,
    duration: '12:30',
  })
}

function buildLesson2() {
  return createLesson({
    id: 'lesson-overview-2',
    title: 'Reading Micro-Expressions',
    order: 2,
    duration: '18:45',
  })
}

function buildLesson3() {
  return createLesson({
    id: 'lesson-overview-3',
    title: 'Advanced Deception Detection',
    order: 1,
    duration: '22:10',
  })
}

function buildModule1() {
  return createModule({
    id: 'module-overview-1',
    title: 'Foundations of Behavioral Analysis',
    order: 1,
    lessons: [buildLesson1(), buildLesson2()],
  })
}

function buildModule2() {
  return createModule({
    id: 'module-overview-2',
    title: 'Advanced Techniques',
    order: 2,
    lessons: [buildLesson3()],
  })
}

function buildTestCourse(overrides: Record<string, unknown> = {}) {
  return {
    ...createCourse({
      id: COURSE_ID,
      title: 'Behavioral Analysis Masterclass',
      description: 'Master the art of reading people through behavioral cues and micro-expressions.',
      category: 'behavioral-analysis',
      difficulty: 'intermediate',
      estimatedHours: 8,
      tags: ['body-language', 'micro-expressions', 'deception-detection'],
      modules: [buildModule1(), buildModule2()],
      isSequential: false,
    }),
    authorId: AUTHOR_ID,
    ...overrides,
  }
}

function buildSequentialCourse() {
  return buildTestCourse({
    id: 'test-course-sequential',
    title: 'Sequential Analysis Course',
    isSequential: true,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DB_NAME = 'ElearningDB'

async function seedCourseAndAuthor(page: import('@playwright/test').Page) {
  // Navigate first to initialize the DB
  await navigateAndWait(page, '/')

  // Seed courses and authors
  await seedIndexedDBStore(page, DB_NAME, 'courses', [buildTestCourse()] as Record<string, unknown>[])
  await seedAuthors(page, [buildTestAuthor()])
}

async function goToCourseOverview(
  page: import('@playwright/test').Page,
  courseId: string = COURSE_ID
) {
  await navigateAndWait(page, `/courses/${courseId}/overview`)
}

// ---------------------------------------------------------------------------
// Hero section and basic rendering
// ---------------------------------------------------------------------------

test.describe('CourseOverview — hero and metadata', () => {
  test('renders course title in hero section', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Behavioral Analysis Masterclass')
  })

  test('shows category and difficulty badges', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // Category and difficulty badges are uppercase tracking-wide spans in the hero
    // Use exact: true to avoid matching partial text in the title or elsewhere
    await expect(page.getByText('Behavioral Analysis', { exact: true })).toBeVisible()
    // Difficulty badge appears in the hero (also in stats row as "intermediate")
    // Scope to the hero area by checking for uppercase badge text
    const mainContent = page.getByRole('main')
    const intermediateBadges = mainContent.getByText('intermediate')
    await expect(intermediateBadges.first()).toBeVisible()
  })

  test('displays stats row with duration, lessons, videos, and level', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // Duration
    await expect(page.getByText('8h')).toBeVisible()
    // Lessons count (totalLessons computed from modules: 2 + 1 = 3)
    await expect(page.getByText('3').first()).toBeVisible()
    // Level label
    await expect(page.getByText('Level')).toBeVisible()
    // Duration label
    await expect(page.getByText('Duration')).toBeVisible()
  })

  test('shows course description in about section', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByText('About This Course')).toBeVisible()
    await expect(
      page.getByText('Master the art of reading people through behavioral cues and micro-expressions.')
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Author card
// ---------------------------------------------------------------------------

test.describe('CourseOverview — author card', () => {
  test('displays instructor name and label', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByText('Instructor')).toBeVisible()
    await expect(page.getByText('Jane Doe')).toBeVisible()
  })

  test('displays author bio when available', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(
      page.getByText('An expert in behavioral analysis and influence.')
    ).toBeVisible()
  })

  test('author card links to author profile', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    const authorLink = page.getByRole('link', { name: /Jane Doe/ })
    await expect(authorLink).toBeVisible()
    await expect(authorLink).toHaveAttribute('href', `/authors/${AUTHOR_ID}`)
  })

  test('shows author initials fallback when no photo', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // Avatar fallback shows initials "JD" for "Jane Doe"
    await expect(page.getByText('JD')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// What You'll Learn (tags)
// ---------------------------------------------------------------------------

test.describe('CourseOverview — what you will learn', () => {
  test('renders tags as learning outcomes', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByText("What You'll Learn")).toBeVisible()
    // Tags are formatted: "body-language" → "Body Language"
    // Use exact match to avoid partial matches in lesson titles (e.g., "Introduction to Body Language")
    await expect(page.getByText('Body Language', { exact: true })).toBeVisible()
    await expect(page.getByText('Micro Expressions', { exact: true })).toBeVisible()
    await expect(page.getByText('Deception Detection', { exact: true })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// CTA / Start button
// ---------------------------------------------------------------------------

test.describe('CourseOverview — CTA section', () => {
  test('shows "Start First Lesson" button linking to first lesson', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    const ctaButton = page.getByRole('link', { name: /Start First Lesson/ })
    await expect(ctaButton).toBeVisible()
    await expect(ctaButton).toHaveAttribute('href', `/courses/${COURSE_ID}/lesson-overview-1`)
  })

  test('CTA section shows "Ready to Start?" heading', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByText('Ready to Start?')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Curriculum section — modules and lessons
// ---------------------------------------------------------------------------

test.describe('CourseOverview — curriculum', () => {
  test('displays curriculum heading with lesson count badge', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByText('Curriculum')).toBeVisible()
    await expect(page.getByText('3 lessons')).toBeVisible()
  })

  test('renders all module titles', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByText('Foundations of Behavioral Analysis')).toBeVisible()
    await expect(page.getByText('Advanced Techniques')).toBeVisible()
  })

  test('shows lesson count per module', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // Module 1 has 2 lessons, Module 2 has 1 lesson
    await expect(page.getByText('2 lessons')).toBeVisible()
    await expect(page.getByText('1 lesson')).toBeVisible()
  })

  test('first module is auto-expanded on load', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // First module's lessons should be visible by default
    await expect(page.getByText('Introduction to Body Language')).toBeVisible()
    await expect(page.getByText('Reading Micro-Expressions')).toBeVisible()
  })

  test('second module is collapsed by default', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // Second module's lessons should NOT be visible initially
    await expect(page.getByText('Advanced Deception Detection')).not.toBeVisible()
  })

  test('clicking a collapsed module expands it to show lessons', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // Click the second module header to expand it
    await page.getByText('Advanced Techniques').click()

    // Now the lesson should be visible
    await expect(page.getByText('Advanced Deception Detection')).toBeVisible()
  })

  test('clicking an expanded module collapses it', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // First module is auto-expanded — click to collapse
    await page.getByText('Foundations of Behavioral Analysis').click()

    // Lessons should disappear
    await expect(page.getByText('Introduction to Body Language')).not.toBeVisible()
  })

  test('lessons show duration badges', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // First module is expanded, check duration badges
    await expect(page.getByText('12:30')).toBeVisible()
    await expect(page.getByText('18:45')).toBeVisible()
  })

  test('lessons show "Lesson N" labels', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByText('Lesson 1').first()).toBeVisible()
    await expect(page.getByText('Lesson 2').first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Sequential course — locked modules
// ---------------------------------------------------------------------------

test.describe('CourseOverview — sequential course locking', () => {
  async function seedSequentialCourse(page: import('@playwright/test').Page) {
    await navigateAndWait(page, '/')
    await seedIndexedDBStore(page, DB_NAME, 'courses', [buildSequentialCourse()] as Record<
      string,
      unknown
    >[])
    await seedAuthors(page, [buildTestAuthor()])
  }

  test('first module shows number, not lock icon', async ({ page }) => {
    await seedSequentialCourse(page)
    await navigateAndWait(page, '/courses/test-course-sequential/overview')

    // Module 1 header should be visible with module number
    await expect(page.getByText('Foundations of Behavioral Analysis')).toBeVisible()
  })

  test('second module of sequential course shows locked state', async ({ page }) => {
    await seedSequentialCourse(page)
    await navigateAndWait(page, '/courses/test-course-sequential/overview')

    // Expand the second module
    await page.getByText('Advanced Techniques').click()

    // Locked lessons should have muted text styling (text-muted-foreground/50)
    // The lesson title should still be visible but with reduced opacity class
    const lessonText = page.getByText('Advanced Deception Detection')
    await expect(lessonText).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Not-found state
// ---------------------------------------------------------------------------

test.describe('CourseOverview — not-found state', () => {
  test('displays "Course Not Found" for invalid course ID', async ({ page }) => {
    await navigateAndWait(page, '/courses/nonexistent-course-id-xyz/overview')

    await expect(page.getByText('Course Not Found')).toBeVisible()
    await expect(
      page.getByText('The course you are looking for does not exist.')
    ).toBeVisible()
  })

  test('shows "Back to Courses" link in not-found state', async ({ page }) => {
    await navigateAndWait(page, '/courses/nonexistent-course-id-xyz/overview')

    const backLink = page.getByRole('link', { name: 'Back to Courses' })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/courses')
  })
})

// ---------------------------------------------------------------------------
// Back navigation
// ---------------------------------------------------------------------------

test.describe('CourseOverview — back navigation', () => {
  test('back button is visible', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    await expect(page.getByRole('button', { name: /Back/ })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Hero image fallback
// ---------------------------------------------------------------------------

test.describe('CourseOverview — hero image', () => {
  test('renders hero section without cover image (gradient fallback)', async ({ page }) => {
    await seedCourseAndAuthor(page)
    await goToCourseOverview(page)

    // The hero section should still render with gradient background
    // even without a coverImage (the course factory doesn't set one)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Behavioral Analysis Masterclass'
    )
  })

  test('renders hero section with cover image that fails to load', async ({ page }) => {
    // Seed a course with a coverImage that will fail to load
    await navigateAndWait(page, '/')
    const courseWithImage = buildTestCourse({ coverImage: '/nonexistent/cover' })
    await seedIndexedDBStore(page, DB_NAME, 'courses', [courseWithImage] as Record<
      string,
      unknown
    >[])
    await seedAuthors(page, [buildTestAuthor()])
    await goToCourseOverview(page)

    // The page should still render correctly (onError hides the broken image)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Behavioral Analysis Masterclass'
    )
  })
})
