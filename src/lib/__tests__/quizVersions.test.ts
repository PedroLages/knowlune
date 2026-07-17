import { describe, expect, it } from 'vitest'
import { makeQuiz } from '../../../tests/support/fixtures/factories/quiz-factory'
import { selectNewestQuiz, sortQuizzesNewestFirst } from '@/lib/quizVersions'

describe('quizVersions', () => {
  it('selects the newest quiz while preserving version history order', () => {
    const older = makeQuiz({ id: 'older', createdAt: '2026-01-01T00:00:00.000Z' })
    const newer = makeQuiz({ id: 'newer', createdAt: '2026-02-01T00:00:00.000Z' })
    const versions = [older, newer]

    expect(selectNewestQuiz(versions)?.id).toBe('newer')
    expect(sortQuizzesNewestFirst(versions).map(quiz => quiz.id)).toEqual(['newer', 'older'])
    expect(versions.map(quiz => quiz.id)).toEqual(['older', 'newer'])
  })

  it('returns null when no quiz exists', () => {
    expect(selectNewestQuiz([])).toBeNull()
  })
})
