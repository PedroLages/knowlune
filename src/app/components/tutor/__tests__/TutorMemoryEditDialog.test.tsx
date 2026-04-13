/**
 * Tests for TutorMemoryEditDialog (E72-S02, AC7)
 *
 * Coverage:
 * - Renders with strength and misconception entries
 * - Remove strength button calls onUpdate with filtered list
 * - Remove misconception button calls onUpdate with filtered list
 * - isRemoving state disables buttons during async operation
 * - Empty state renders when no entries exist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TutorMemoryEditDialog } from '../TutorMemoryEditDialog'
import type { LearnerModel } from '@/data/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLearnerModel(overrides: Partial<LearnerModel> = {}): LearnerModel {
  return {
    id: 'model-1',
    courseId: 'course-1',
    vocabularyLevel: 'intermediate',
    strengths: [],
    misconceptions: [],
    topicsExplored: [],
    preferredMode: 'socratic',
    lastSessionSummary: '',
    quizStats: { totalQuestions: 0, correctAnswers: 0, weakTopics: [] },
    createdAt: '2026-04-13T12:00:00.000Z',
    updatedAt: '2026-04-13T12:00:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TutorMemoryEditDialog', () => {
  const onUpdate = vi.fn()
  const onOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    onUpdate.mockResolvedValue(undefined)
  })

  it('renders strength entries when model has strengths', () => {
    const model = makeLearnerModel({
      strengths: [
        {
          concept: 'React hooks',
          confidence: 0.9,
          assessedBy: 'quiz',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
        {
          concept: 'Closures',
          confidence: 0.8,
          assessedBy: 'explain',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
    })

    render(
      <TutorMemoryEditDialog
        learnerModel={model}
        open={true}
        onOpenChange={onOpenChange}
        onUpdate={onUpdate}
      />
    )

    expect(screen.getByText('React hooks')).toBeInTheDocument()
    expect(screen.getByText('Closures')).toBeInTheDocument()
    expect(screen.getByText('Strengths')).toBeInTheDocument()
  })

  it('renders misconception entries when model has misconceptions', () => {
    const model = makeLearnerModel({
      misconceptions: [
        {
          concept: 'useEffect deps',
          confidence: 0.6,
          assessedBy: 'debug',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
    })

    render(
      <TutorMemoryEditDialog
        learnerModel={model}
        open={true}
        onOpenChange={onOpenChange}
        onUpdate={onUpdate}
      />
    )

    expect(screen.getByText('useEffect deps')).toBeInTheDocument()
    expect(screen.getByText('Misconceptions')).toBeInTheDocument()
  })

  it('calls onUpdate with filtered strengths when remove button is clicked', async () => {
    const user = userEvent.setup()
    const model = makeLearnerModel({
      strengths: [
        {
          concept: 'React hooks',
          confidence: 0.9,
          assessedBy: 'quiz',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
        {
          concept: 'Closures',
          confidence: 0.8,
          assessedBy: 'explain',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
    })

    render(
      <TutorMemoryEditDialog
        learnerModel={model}
        open={true}
        onOpenChange={onOpenChange}
        onUpdate={onUpdate}
      />
    )

    const removeButton = screen.getByRole('button', { name: 'Remove strength: React hooks' })
    await user.click(removeButton)

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce()
    })

    const [calledWith] = onUpdate.mock.calls[0]
    expect(calledWith.strengths).toHaveLength(1)
    expect(calledWith.strengths[0].concept).toBe('Closures')
  })

  it('calls onUpdate with filtered misconceptions when remove button is clicked', async () => {
    const user = userEvent.setup()
    const model = makeLearnerModel({
      misconceptions: [
        {
          concept: 'useEffect deps',
          confidence: 0.6,
          assessedBy: 'debug',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
        {
          concept: 'Promise.all',
          confidence: 0.4,
          assessedBy: 'quiz',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
    })

    render(
      <TutorMemoryEditDialog
        learnerModel={model}
        open={true}
        onOpenChange={onOpenChange}
        onUpdate={onUpdate}
      />
    )

    const removeButton = screen.getByRole('button', {
      name: 'Remove misconception: useEffect deps',
    })
    await user.click(removeButton)

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce()
    })

    const [calledWith] = onUpdate.mock.calls[0]
    expect(calledWith.misconceptions).toHaveLength(1)
    expect(calledWith.misconceptions[0].concept).toBe('Promise.all')
  })

  it('disables remove buttons during async operation (isRemoving state)', async () => {
    const user = userEvent.setup()
    let resolveUpdate!: () => void
    const slowUpdate = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveUpdate = resolve
        })
    )

    const model = makeLearnerModel({
      strengths: [
        {
          concept: 'TypeScript',
          confidence: 0.85,
          assessedBy: 'quiz',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
      misconceptions: [
        {
          concept: 'Generics',
          confidence: 0.5,
          assessedBy: 'debug',
          lastAssessed: '2026-04-13T00:00:00Z',
        },
      ],
    })

    render(
      <TutorMemoryEditDialog
        learnerModel={model}
        open={true}
        onOpenChange={onOpenChange}
        onUpdate={slowUpdate}
      />
    )

    const removeStrength = screen.getByRole('button', { name: 'Remove strength: TypeScript' })
    const removeMisconception = screen.getByRole('button', {
      name: 'Remove misconception: Generics',
    })

    // Click the first remove button — operation starts
    await user.click(removeStrength)

    // Both buttons should be disabled while the operation is in flight
    expect(removeStrength).toBeDisabled()
    expect(removeMisconception).toBeDisabled()

    // Resolve the operation
    resolveUpdate()

    // Buttons should become enabled again
    await waitFor(() => {
      expect(removeStrength).not.toBeDisabled()
    })
  })

  it('shows empty state when model has no strengths or misconceptions', () => {
    const model = makeLearnerModel()

    render(
      <TutorMemoryEditDialog
        learnerModel={model}
        open={true}
        onOpenChange={onOpenChange}
        onUpdate={onUpdate}
      />
    )

    expect(screen.getByText(/No individual entries to edit/)).toBeInTheDocument()
  })
})
