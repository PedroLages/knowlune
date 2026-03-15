import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Challenge, StreakMilestone } from '@/data/types'

// Mock db before importing module
vi.mock('@/db/schema', () => ({
  db: {
    challenges: {
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('../settings', () => ({
  getSettings: () => ({
    displayName: 'Test Student',
    bio: '',
    theme: 'system',
  }),
}))

// Import after mocks
const { exportAchievementsAsBadges } = await import('../openBadges')

describe('openBadges', () => {
  let localStorageGetSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem')
    localStorageGetSpy.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array when no achievements exist', async () => {
    const badges = await exportAchievementsAsBadges()
    expect(badges).toEqual([])
  })

  it('generates badge from completed challenge', async () => {
    const { db } = await import('@/db/schema')
    const completedChallenge: Challenge = {
      id: 'ch1',
      name: 'Watch 10 videos',
      type: 'completion',
      targetValue: 10,
      deadline: '2026-02-01',
      createdAt: '2026-01-01T00:00:00Z',
      currentProgress: 10,
      celebratedMilestones: [25, 50, 75, 100],
      completedAt: '2026-01-20T15:00:00Z',
    }
    vi.mocked(db.challenges.toArray).mockResolvedValueOnce([completedChallenge])

    const badges = await exportAchievementsAsBadges()

    expect(badges).toHaveLength(1)
    expect(badges[0].type).toContain('OpenBadgeCredential')
    expect(badges[0].credentialSubject.achievement.name).toContain('Watch 10 videos')
    expect(badges[0].issuanceDate).toBe('2026-01-20T15:00:00Z')
    expect(badges[0].evidence).toBeDefined()
  })

  it('generates badge from streak milestone', async () => {
    const milestone: StreakMilestone = {
      id: 'sm1',
      milestoneValue: 30,
      earnedAt: '2026-02-14T08:00:00Z',
      streakStartDate: '2026-01-15',
    }
    localStorageGetSpy.mockReturnValueOnce(JSON.stringify([milestone]))

    const badges = await exportAchievementsAsBadges()

    expect(badges).toHaveLength(1)
    expect(badges[0].credentialSubject.achievement.name).toBe('30-Day Study Streak')
    expect(badges[0].credentialSubject.achievement.criteria.narrative).toContain('30 consecutive days')
  })

  it('skips incomplete challenges', async () => {
    const { db } = await import('@/db/schema')
    const incompleteChallenge: Challenge = {
      id: 'ch2',
      name: 'Study 20 hours',
      type: 'time',
      targetValue: 20,
      deadline: '2026-03-01',
      createdAt: '2026-01-01T00:00:00Z',
      currentProgress: 5,
      celebratedMilestones: [25],
    }
    vi.mocked(db.challenges.toArray).mockResolvedValueOnce([incompleteChallenge])

    const badges = await exportAchievementsAsBadges()
    expect(badges).toHaveLength(0)
  })

  it('includes OB v3.0 context URIs', async () => {
    const { db } = await import('@/db/schema')
    const challenge: Challenge = {
      id: 'ch1',
      name: 'Test',
      type: 'completion',
      targetValue: 1,
      deadline: '2026-02-01',
      createdAt: '2026-01-01T00:00:00Z',
      currentProgress: 1,
      celebratedMilestones: [100],
      completedAt: '2026-01-02T00:00:00Z',
    }
    vi.mocked(db.challenges.toArray).mockResolvedValueOnce([challenge])

    const badges = await exportAchievementsAsBadges()

    expect(badges[0]['@context']).toContain('https://www.w3.org/ns/credentials/v2')
    expect(badges[0]['@context']).toContain(
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'
    )
  })
})
