/**
 * Unit tests for resolveConflict() — LWW conflict resolution between
 * Audiobookshelf remote progress and local book position.
 *
 * @see useAudiobookshelfProgressSync.ts
 * @since E102 test chores
 */
import { describe, it, expect } from 'vitest'
import { resolveConflict } from '@/app/hooks/useAudiobookshelfProgressSync'
import { FIXED_TIMESTAMP, addMinutes } from '../../../../tests/utils/test-time'

describe('resolveConflict', () => {
  const TEN_MIN_BEFORE = addMinutes(-10)
  const FIVE_MIN_BEFORE_TS = FIXED_TIMESTAMP - 5 * 60 * 1000
  const TWENTY_MIN_BEFORE_TS = FIXED_TIMESTAMP - 20 * 60 * 1000

  it('returns "use-abs" when ABS timestamp is newer than local', () => {
    // ABS updated 5 min ago, local opened 10 min ago
    const result = resolveConflict(FIVE_MIN_BEFORE_TS, TEN_MIN_BEFORE, 1800)
    expect(result).toBe('use-abs')
  })

  it('returns "use-local" when local timestamp is newer than ABS', () => {
    // ABS updated 20 min ago, local opened 10 min ago
    const result = resolveConflict(TWENTY_MIN_BEFORE_TS, TEN_MIN_BEFORE, 1800)
    expect(result).toBe('use-local')
  })

  it('returns "use-local" when timestamps are equal (ties go to local)', () => {
    const localOpenedAt = TEN_MIN_BEFORE
    const absTimestamp = new Date(localOpenedAt).getTime()
    const result = resolveConflict(absTimestamp, localOpenedAt, 1800)
    expect(result).toBe('use-local')
  })

  it('returns "use-abs" when localLastOpenedAt is undefined', () => {
    const result = resolveConflict(FIVE_MIN_BEFORE_TS, undefined, 900)
    expect(result).toBe('use-abs')
  })

  it('returns "use-abs" when localCurrentSeconds is 0 (no local progress)', () => {
    const result = resolveConflict(TWENTY_MIN_BEFORE_TS, TEN_MIN_BEFORE, 0)
    expect(result).toBe('use-abs')
  })
})
