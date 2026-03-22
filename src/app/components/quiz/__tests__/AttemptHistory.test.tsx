import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttemptHistory } from '../AttemptHistory'
import { makeAttempt } from '../../../../../tests/support/fixtures/factories/quiz-factory'
import { FIXED_DATE, getRelativeDate } from '../../../../../tests/utils/test-time'

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn() },
}))

const COURSE_ID = 'course-test'
const LESSON_ID = 'lesson-test'

// Attempts are passed in most-recent-first order (as returned by loadAttempts)
const attempt1 = makeAttempt({
  id: 'a1',
  completedAt: getRelativeDate(-2),
  percentage: 60,
  passed: false,
  timeSpent: 45000,
})
const attempt2 = makeAttempt({
  id: 'a2',
  completedAt: getRelativeDate(-1),
  percentage: 80,
  passed: true,
  timeSpent: 90000,
})
const attempt3 = makeAttempt({
  id: 'a3',
  completedAt: FIXED_DATE,
  percentage: 100,
  passed: true,
  timeSpent: 30000,
})

// Most-recent-first order: [a3, a2, a1]
const threeAttempts = [attempt3, attempt2, attempt1]

describe('AttemptHistory', () => {
  it('shows "(1 attempt)" for a single attempt', () => {
    render(
      <AttemptHistory
        attempts={[attempt1]}
        currentAttemptId={attempt1.id}
        courseId={COURSE_ID}
        lessonId={LESSON_ID}
      />
    )
    expect(
      screen.getByRole('button', { name: /view attempt history \(1 attempt\)/i })
    ).toBeInTheDocument()
  })

  it('shows "(3 attempts)" for three attempts', () => {
    render(
      <AttemptHistory
        attempts={threeAttempts}
        currentAttemptId={attempt3.id}
        courseId={COURSE_ID}
        lessonId={LESSON_ID}
      />
    )
    expect(
      screen.getByRole('button', { name: /view attempt history \(3 attempts\)/i })
    ).toBeInTheDocument()
  })

  it('is collapsed by default — content not visible before click', () => {
    render(
      <AttemptHistory
        attempts={threeAttempts}
        currentAttemptId={attempt3.id}
        courseId={COURSE_ID}
        lessonId={LESSON_ID}
      />
    )
    // Attempt numbers should not be visible while collapsed
    expect(screen.queryByText('#3')).not.toBeInTheDocument()
  })

  it('expands to show all attempt data fields after clicking trigger', async () => {
    const user = userEvent.setup()
    render(
      <AttemptHistory
        attempts={threeAttempts}
        currentAttemptId={attempt3.id}
        courseId={COURSE_ID}
        lessonId={LESSON_ID}
      />
    )

    await user.click(screen.getByRole('button', { name: /view attempt history/i }))

    // Attempt numbers visible (highest number = most recent = index 0)
    expect(screen.getAllByText('#3').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('#2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('#1').length).toBeGreaterThanOrEqual(1)

    // Score percentages
    expect(screen.getAllByText('100%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('80%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('60%').length).toBeGreaterThanOrEqual(1)

    // Time durations
    expect(screen.getAllByText('30s').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('1m 30s').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('45s').length).toBeGreaterThanOrEqual(1)

    // Status badges
    expect(screen.getAllByText('Passed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Not Passed').length).toBeGreaterThanOrEqual(1)
  })

  it('marks current attempt with "Current" badge', async () => {
    const user = userEvent.setup()
    render(
      <AttemptHistory
        attempts={threeAttempts}
        currentAttemptId={attempt3.id}
        courseId={COURSE_ID}
        lessonId={LESSON_ID}
      />
    )

    await user.click(screen.getByRole('button', { name: /view attempt history/i }))

    // "Current" badge should appear (may appear twice due to desktop+mobile renders)
    expect(screen.getAllByText('Current').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Review buttons when expanded', async () => {
    const user = userEvent.setup()
    render(
      <AttemptHistory
        attempts={threeAttempts}
        currentAttemptId={attempt3.id}
        courseId={COURSE_ID}
        lessonId={LESSON_ID}
      />
    )

    await user.click(screen.getByRole('button', { name: /view attempt history/i }))

    // Review button visible per attempt (may appear twice due to responsive layout)
    expect(screen.getAllByRole('button', { name: /review/i }).length).toBeGreaterThanOrEqual(3)
  })

  it('clicking a Review button shows "Review mode coming soon" toast', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(
      <AttemptHistory
        attempts={threeAttempts}
        currentAttemptId={attempt3.id}
        courseId={COURSE_ID}
        lessonId={LESSON_ID}
      />
    )

    await user.click(screen.getByRole('button', { name: /view attempt history/i }))
    await user.click(screen.getAllByRole('button', { name: /review attempt #3/i })[0])

    expect(toast.info).toHaveBeenCalledWith('Review mode coming soon.')
  })

  it('Review buttons have contextual aria-labels distinguishing attempts', async () => {
    const user = userEvent.setup()
    render(
      <AttemptHistory
        attempts={threeAttempts}
        currentAttemptId={attempt3.id}
        courseId={COURSE_ID}
        lessonId={LESSON_ID}
      />
    )

    await user.click(screen.getByRole('button', { name: /view attempt history/i }))

    // Each attempt should have a uniquely named Review button (desktop table renders one per attempt)
    expect(
      screen.getAllByRole('button', { name: /review attempt #3/i }).length
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByRole('button', { name: /review attempt #2/i }).length
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByRole('button', { name: /review attempt #1/i }).length
    ).toBeGreaterThanOrEqual(1)
  })
})
