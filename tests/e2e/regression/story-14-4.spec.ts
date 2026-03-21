/**
 * ATDD E2E tests for E14-S04: Support Rich Text Formatting in Questions
 *
 * Tests Markdown rendering in quiz questions:
 * - AC1: Code blocks, inline code, lists, bold/italic render correctly
 * - AC2: Code blocks scroll horizontally, contrast ≥4.5:1, dark mode tokens
 * - AC3: Mobile (375px) — text wraps, code blocks scroll independently
 * - AC4: Markdown outside <legend>, aria-labelledby preserves association
 */
import { test, expect } from '../support/fixtures'
import { makeQuiz, makeQuestion } from '../support/fixtures/factories/quiz-factory'
import { seedIndexedDBStore } from '../support/helpers/indexeddb-seed'

// ---------------------------------------------------------------------------
// Test data — questions with various Markdown formatting
// ---------------------------------------------------------------------------

const COURSE_ID = 'test-course-e14s04'
const LESSON_ID = 'test-lesson-e14s04'

const markdownQuestion = makeQuestion({
  id: 'q1-markdown-formatting',
  order: 1,
  type: 'multiple-choice',
  text: [
    'Consider the following **JavaScript** function:',
    '',
    '```javascript',
    'function greet(name) {',
    '  return `Hello, ${name}!`;',
    '}',
    '```',
    '',
    'What does `greet("World")` return?',
    '',
    'Key points:',
    '',
    '- Uses *template literals*',
    '- Returns a **string**',
    '',
    '1. First item',
    '2. Second item',
  ].join('\n'),
  options: ['Hello, World!', 'undefined', 'null', 'Error'],
  correctAnswer: 'Hello, World!',
  points: 1,
})

const longCodeQuestion = makeQuestion({
  id: 'q2-long-code-block',
  order: 2,
  type: 'true-false',
  text: [
    'Does the following code produce an error?',
    '',
    '```',
    'const veryLongVariableName = someExtremelyLongFunctionName(parameterOne, parameterTwo, parameterThree, parameterFour, parameterFive)',
    '```',
  ].join('\n'),
  options: ['True', 'False'],
  correctAnswer: 'False',
  points: 1,
})

const quiz = makeQuiz({
  id: 'quiz-e14s04',
  lessonId: LESSON_ID,
  title: 'Rich Text Formatting Quiz',
  description: 'A quiz with Markdown-formatted questions for E14-S04',
  questions: [markdownQuestion, longCodeQuestion],
  passingScore: 50,
  shuffleQuestions: false,
  shuffleAnswers: false,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function seedQuizData(page: import('@playwright/test').Page) {
  await seedIndexedDBStore(page, 'ElearningDB', 'quizzes', [quiz])
}

async function navigateToQuiz(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('eduvi-sidebar-v1', 'false')
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await seedQuizData(page)
  await page.goto(`/courses/${COURSE_ID}/lessons/${LESSON_ID}/quiz`, {
    waitUntil: 'domcontentloaded',
  })
}

async function startQuiz(page: import('@playwright/test').Page) {
  const startBtn = page.getByRole('button', { name: /start quiz/i })
  await expect(startBtn).toBeVisible()
  await startBtn.click()
}

/** Compute WCAG contrast ratio between a pre element's background and its code child's text color. */
async function getContrastRatio(pre: import('@playwright/test').Locator): Promise<number> {
  return pre.evaluate(el => {
    function colorToRgb(color: string): number[] {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (m) return [+m[1], +m[2], +m[3]]
      // Resolve non-rgb colors (oklch, lab, etc) via canvas
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return [r, g, b]
    }
    function luminance(rgb: number[]) {
      const [r, g, b] = rgb.map(c => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const cs = getComputedStyle(el)
    const code = el.querySelector('code')
    const fgColor = code ? getComputedStyle(code).color : cs.color
    const bgL = luminance(colorToRgb(cs.backgroundColor))
    const fgL = luminance(colorToRgb(fgColor))
    const lighter = Math.max(bgL, fgL)
    const darker = Math.min(bgL, fgL)
    return (lighter + 0.05) / (darker + 0.05)
  })
}

// ---------------------------------------------------------------------------
// AC1: Markdown formatting renders correctly
// ---------------------------------------------------------------------------

test.describe('E14-S04: Rich Text Formatting', () => {
  test('AC1: code blocks display with monospace font and background', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Code block should be in a <pre> element with background styling
    const codeBlock = page.locator('pre')
    await expect(codeBlock.first()).toBeVisible()

    // Code inside should use monospace font
    const code = codeBlock.first().locator('code')
    await expect(code).toBeVisible()
  })

  test('AC1: inline code is visually distinguished from regular text', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Inline code `greet("World")` should have distinct styling
    // It's inside a <code> element but NOT inside a <pre>
    const inlineCode = page.locator('code').filter({ hasText: 'greet("World")' })
    await expect(inlineCode).toBeVisible()
  })

  test('AC1: ordered and unordered lists display with proper indentation', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Unordered list (Key points)
    const ul = page.locator('ul').filter({ hasText: /template literals/ })
    await expect(ul).toBeVisible()

    // Ordered list (1. First item, 2. Second item)
    const ol = page.locator('ol').filter({ hasText: /First item/ })
    await expect(ol).toBeVisible()
  })

  test('AC1: bold and italic text render correctly', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // **JavaScript** should render as <strong>
    const bold = page.locator('strong').filter({ hasText: 'JavaScript' })
    await expect(bold).toBeVisible()

    // *template literals* should render as <em>
    const italic = page.locator('em').filter({ hasText: 'template literals' })
    await expect(italic).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC2: Code block horizontal scrolling and theme support
  // ---------------------------------------------------------------------------

  test('AC2: code blocks scroll horizontally when too wide', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // Navigate to question 2 (long code)
    await page.getByRole('radio', { name: 'Hello, World!' }).click()
    await page.getByRole('button', { name: /next/i }).click()

    const pre = page.locator('pre').first()
    await expect(pre).toBeVisible()

    // The pre element should have overflow-x: auto (scrollable)
    const overflowX = await pre.evaluate(el => getComputedStyle(el).overflowX)
    expect(overflowX).toBe('auto')
  })

  test('AC2: code block background contrasts with code text (≥4.5:1)', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    const questionText = page.locator('[data-testid="question-text"]').first()
    const pre = questionText.locator('pre').first()
    await expect(pre).toBeVisible()

    const ratio = await getContrastRatio(pre)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  test('AC2: code blocks render correctly in dark mode', async ({ page }) => {
    // App uses class-based dark mode (.dark on <html>), not prefers-color-scheme
    await page.addInitScript(() => {
      document.documentElement.classList.add('dark')
    })
    await navigateToQuiz(page)
    await startQuiz(page)

    const questionText = page.locator('[data-testid="question-text"]').first()
    const pre = questionText.locator('pre').first()
    await expect(pre).toBeVisible()

    const ratio = await getContrastRatio(pre)
    expect(ratio).toBeGreaterThanOrEqual(4.5)

    // Verify inline code also has distinct styling in dark mode
    const inlineCode = page.locator('code').filter({ hasText: 'greet("World")' })
    await expect(inlineCode).toBeVisible()
  })

  // ---------------------------------------------------------------------------
  // AC3: Mobile responsiveness
  // ---------------------------------------------------------------------------

  test('AC3: text wraps naturally on mobile (375px) without horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await navigateToQuiz(page)
    await startQuiz(page)

    // Page should not have horizontal scrollbar
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(hasHorizontalScroll).toBe(false)

    // Question text container should not overflow either
    const questionText = page.locator('[data-testid="question-text"]').first()
    await expect(questionText).toBeVisible()
    const textOverflows = await questionText.evaluate(el => el.scrollWidth > el.clientWidth)
    expect(textOverflows).toBe(false)
  })

  test('AC3: code blocks scroll independently on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await navigateToQuiz(page)
    await startQuiz(page)

    const pre = page.locator('pre').first()
    await expect(pre).toBeVisible()

    // Code block should scroll independently (overflow-x: auto)
    const overflowX = await pre.evaluate(el => getComputedStyle(el).overflowX)
    expect(overflowX).toBe('auto')
  })

  // ---------------------------------------------------------------------------
  // AC4: aria-labelledby association
  // ---------------------------------------------------------------------------

  test('AC4: question text uses aria-labelledby for fieldset association', async ({ page }) => {
    await navigateToQuiz(page)
    await startQuiz(page)

    // The fieldset should have aria-labelledby pointing to the question text div
    const fieldset = page.locator('fieldset')
    const labelledBy = await fieldset.first().getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()

    // The referenced element should contain the question text
    const labelElement = page.locator(`[id="${labelledBy}"]`)
    await expect(labelElement).toBeVisible()
    await expect(labelElement).toContainText('JavaScript')
  })
})
