import type { Challenge, ChallengeType } from '../../../../src/data/types'

export function createChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: crypto.randomUUID(),
    name: 'Test Challenge',
    type: 'completion' as ChallengeType,
    targetValue: 10,
    deadline: '2030-12-31',
    createdAt: new Date().toISOString(),
    currentProgress: 0,
    celebratedMilestones: [],
    ...overrides,
  }
}
