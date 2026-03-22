import type { Challenge, ChallengeType } from '../../../../src/data/types'
import { FIXED_DATE } from '../../../utils/test-time'

export function createChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: crypto.randomUUID(),
    name: 'Test Challenge',
    type: 'completion' as ChallengeType,
    targetValue: 10,
    deadline: '2030-12-31',
    createdAt: FIXED_DATE,
    currentProgress: 0,
    celebratedMilestones: [],
    ...overrides,
  }
}
