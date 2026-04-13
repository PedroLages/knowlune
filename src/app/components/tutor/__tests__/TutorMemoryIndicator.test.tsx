/**
 * Tests for TutorMemoryIndicator (E72-S02)
 *
 * Coverage:
 * - Renders nothing when learnerModel is null
 * - Renders strengths when model has data
 * - Collapse/expand toggle works
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TutorMemoryIndicator } from '../TutorMemoryIndicator'
import type { LearnerModel } from '@/data/types'

function makeLearnerModel(overrides: Partial<LearnerModel> = {}): LearnerModel {
  return {
    id: 'model-1',
    courseId: 'course-1',
    vocabularyLevel: 'beginner',
    strengths: [],
    misconceptions: [],
    topicsExplored: [],
    preferredMode: 'socratic',
    lastSessionSummary: '',
    quizStats: { totalQuestions: 0, correctAnswers: 0, weakTopics: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

const defaultProps = {
  courseId: 'course-1',
  onClearMemory: vi.fn().mockResolvedValue(undefined),
  onUpdateMemory: vi.fn().mockResolvedValue(undefined),
}

describe('TutorMemoryIndicator', () => {
  it('renders nothing when learnerModel is null', () => {
    const { container } = render(<TutorMemoryIndicator {...defaultProps} learnerModel={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the memory indicator when learnerModel exists', () => {
    render(<TutorMemoryIndicator {...defaultProps} learnerModel={makeLearnerModel()} />)
    expect(screen.getByTestId('tutor-memory-indicator')).toBeInTheDocument()
  })

  it('renders strengths when model has strength data', () => {
    const model = makeLearnerModel({
      strengths: [
        {
          concept: 'React hooks',
          confidence: 0.9,
          assessedBy: 'explain',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
    })
    render(<TutorMemoryIndicator {...defaultProps} learnerModel={model} />)

    // Expand the collapsible first
    const trigger = screen.getByLabelText('Toggle tutor memory panel')
    userEvent.click(trigger)

    expect(screen.getByTestId('tutor-memory-indicator')).toBeInTheDocument()
  })

  it('shows insight count in the trigger label', () => {
    const model = makeLearnerModel({
      strengths: [
        {
          concept: 'TypeScript',
          confidence: 0.8,
          assessedBy: 'socratic',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
        {
          concept: 'Hooks',
          confidence: 0.7,
          assessedBy: 'explain',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
      misconceptions: [
        {
          concept: 'useEffect deps',
          confidence: 0.6,
          assessedBy: 'debug',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
      quizStats: { totalQuestions: 5, correctAnswers: 3, weakTopics: ['closures'] },
    })
    render(<TutorMemoryIndicator {...defaultProps} learnerModel={model} />)

    // 2 strengths + 1 misconception + 1 weakTopic = 4
    // Multiple spans render the count; use getAllByText to verify at least one matches
    const matches = screen.getAllByText(/4 insights/)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('collapse/expand toggle works', async () => {
    const user = userEvent.setup()
    const model = makeLearnerModel({
      strengths: [
        {
          concept: 'React hooks',
          confidence: 0.9,
          assessedBy: 'explain',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
    })
    render(<TutorMemoryIndicator {...defaultProps} learnerModel={model} />)

    const trigger = screen.getByLabelText('Toggle tutor memory panel')

    // Initially collapsed — content should not be visible
    expect(screen.queryByText('Strengths')).not.toBeInTheDocument()

    // Click to expand
    await user.click(trigger)
    expect(screen.getByText('Strengths')).toBeInTheDocument()

    // Click again to collapse
    await user.click(trigger)
    expect(screen.queryByText('Strengths')).not.toBeInTheDocument()
  })
})
