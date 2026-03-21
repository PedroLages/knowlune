/**
 * QuestionDisplay edge-case option counts — E12-S05-AC5 traceability
 *
 * "Question with fewer than 2 or more than 6 options renders whatever
 * options exist, logs warning to console."
 *
 * The warning is emitted by MultipleChoiceQuestion (delegated from QuestionDisplay).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionDisplay } from '../QuestionDisplay'
import { makeQuestion } from '../../../../../tests/support/fixtures/factories/quiz-factory'

describe('QuestionDisplay — edge-case option counts (E12-S05-AC5)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  afterEach(() => {
    warnSpy?.mockRestore()
  })

  it('renders with 0 options without crashing', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const question = makeQuestion({ options: [] })

    render(
      <QuestionDisplay question={question} value={undefined} onChange={vi.fn()} mode="active" />
    )

    // Question text still renders
    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()

    // No radio buttons rendered
    expect(screen.queryAllByRole('radio')).toHaveLength(0)

    // Warning logged for out-of-range option count
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has 0 options (expected 2-6)'))
  })

  it('renders with 1 option without crashing', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const question = makeQuestion({ options: ['Only option'] })

    render(
      <QuestionDisplay question={question} value={undefined} onChange={vi.fn()} mode="active" />
    )

    // The single option renders
    expect(screen.getByText('Only option')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(1)

    // Warning logged for fewer than 2 options
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has 1 options (expected 2-6)'))
  })

  it('renders with 7 options (more than max 6)', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const sevenOptions = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
    const question = makeQuestion({ options: sevenOptions })

    render(
      <QuestionDisplay question={question} value={undefined} onChange={vi.fn()} mode="active" />
    )

    // All 7 options render
    for (const opt of sevenOptions) {
      expect(screen.getByText(opt)).toBeInTheDocument()
    }
    expect(screen.getAllByRole('radio')).toHaveLength(7)

    // Warning logged for more than 6 options
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('has 7 options (expected 2-6)'))
  })

  it('renders normally with 4 options (within range) — no warning', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const question = makeQuestion({
      options: ['Paris', 'London', 'Berlin', 'Madrid'],
    })

    render(
      <QuestionDisplay question={question} value={undefined} onChange={vi.fn()} mode="active" />
    )

    // All 4 options render
    expect(screen.getAllByRole('radio')).toHaveLength(4)

    // No warning for valid option count
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
