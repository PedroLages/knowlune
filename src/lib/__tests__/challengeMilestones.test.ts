import { describe, it, expect, vi } from 'vitest'
import {
  detectChallengeMilestones,
  getChallengeTierConfig,
  CHALLENGE_TIER_CONFIG,
} from '@/lib/challengeMilestones'
import type { Challenge } from '@/data/types'

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'test-id',
    name: 'Test Challenge',
    type: 'completion',
    targetValue: 4,
    deadline: '2030-12-31',
    createdAt: new Date().toISOString(),
    currentProgress: 0,
    celebratedMilestones: [],
    ...overrides,
  }
}

describe('detectChallengeMilestones', () => {
  it('returns empty array when targetValue is 0', () => {
    const c = makeChallenge({ targetValue: 0 })
    expect(detectChallengeMilestones(c, 0)).toEqual([])
  })

  it('returns empty array when targetValue is negative', () => {
    const c = makeChallenge({ targetValue: -5 })
    expect(detectChallengeMilestones(c, 0)).toEqual([])
  })

  it('returns [25] when crossing 25% for first time', () => {
    const c = makeChallenge({ targetValue: 4, celebratedMilestones: [] })
    expect(detectChallengeMilestones(c, 1)).toEqual([25])
  })

  it('skips already-celebrated thresholds', () => {
    const c = makeChallenge({ targetValue: 4, celebratedMilestones: [25, 50] })
    expect(detectChallengeMilestones(c, 3)).toEqual([75])
  })

  it('returns multiple thresholds when progress jumps (20% to 80%)', () => {
    const c = makeChallenge({ targetValue: 10, celebratedMilestones: [] })
    expect(detectChallengeMilestones(c, 8)).toEqual([25, 50, 75])
  })

  it('returns all four thresholds when targetValue is 1 and progress is 1', () => {
    const c = makeChallenge({ targetValue: 1, celebratedMilestones: [] })
    expect(detectChallengeMilestones(c, 1)).toEqual([25, 50, 75, 100])
  })

  it('returns [100] at exactly 100% with prior milestones celebrated', () => {
    const c = makeChallenge({ targetValue: 4, celebratedMilestones: [25, 50, 75] })
    expect(detectChallengeMilestones(c, 4)).toEqual([100])
  })

  it('returns empty array when progress is below next threshold', () => {
    const c = makeChallenge({ targetValue: 4, celebratedMilestones: [25] })
    // 1/4 = 25%, still at 25% which is already celebrated
    expect(detectChallengeMilestones(c, 1)).toEqual([])
  })

  it('returns empty array when all milestones already celebrated', () => {
    const c = makeChallenge({ targetValue: 4, celebratedMilestones: [25, 50, 75, 100] })
    expect(detectChallengeMilestones(c, 4)).toEqual([])
  })

  it('handles progress overshooting target', () => {
    const c = makeChallenge({ targetValue: 4, celebratedMilestones: [25, 50, 75] })
    // Progress > target — should still return 100
    expect(detectChallengeMilestones(c, 10)).toEqual([100])
  })

  it('treats non-array celebratedMilestones as empty (corrupted data)', () => {
    const c = makeChallenge({ celebratedMilestones: 'corrupted' as unknown as number[] })
    // With corrupted data, all crossed thresholds should be returned
    expect(detectChallengeMilestones(c, 1)).toEqual([25])
  })

  it('treats null celebratedMilestones as empty', () => {
    const c = makeChallenge({ celebratedMilestones: null as unknown as number[] })
    expect(detectChallengeMilestones(c, 2)).toEqual([25, 50])
  })
})

describe('getChallengeTierConfig', () => {
  it('returns correct label for each threshold', () => {
    expect(getChallengeTierConfig(25).label).toBe('25% Complete')
    expect(getChallengeTierConfig(50).label).toBe('Halfway There')
    expect(getChallengeTierConfig(75).label).toBe('Almost There')
    expect(getChallengeTierConfig(100).label).toBe('Challenge Complete')
  })

  it('falls back to 25% config for unknown threshold with console warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = getChallengeTierConfig(99)
    expect(result).toEqual(CHALLENGE_TIER_CONFIG[25])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown threshold 99'))
    warnSpy.mockRestore()
  })
})
