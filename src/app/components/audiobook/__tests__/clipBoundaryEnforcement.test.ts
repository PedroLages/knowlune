import { describe, it, expect } from 'vitest'

/**
 * Pure-function extraction of the clip boundary pause logic from
 * AudiobookRenderer.tsx (useEffect around line 363-374).
 *
 * Tolerance of 0.1s accounts for timeupdate firing at ~4Hz.
 */
function shouldPauseClip(
  currentTime: number,
  currentChapterIndex: number,
  activeClipEnd: { chapterIndex: number; endTime: number } | null
): boolean {
  if (!activeClipEnd) return false
  return (
    currentChapterIndex === activeClipEnd.chapterIndex &&
    currentTime >= activeClipEnd.endTime - 0.1
  )
}

describe('shouldPauseClip – clip boundary enforcement', () => {
  it('returns false when activeClipEnd is null', () => {
    expect(shouldPauseClip(15, 0, null)).toBe(false)
  })

  it('returns false when currentTime is well before endTime', () => {
    expect(shouldPauseClip(29.0, 0, { chapterIndex: 0, endTime: 30.0 })).toBe(false)
  })

  it('returns true when currentTime is within 0.1s tolerance', () => {
    expect(shouldPauseClip(29.95, 0, { chapterIndex: 0, endTime: 30.0 })).toBe(true)
  })

  it('returns true when currentTime equals endTime exactly', () => {
    expect(shouldPauseClip(30.0, 0, { chapterIndex: 0, endTime: 30.0 })).toBe(true)
  })

  it('returns false when chapterIndex does not match', () => {
    expect(shouldPauseClip(29.95, 1, { chapterIndex: 0, endTime: 30.0 })).toBe(false)
  })
})
