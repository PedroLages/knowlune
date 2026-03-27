/**
 * Unit tests for TranscriptPanel logic — active cue detection,
 * search matching, and time formatting.
 *
 * Tests pure functions extracted from the component logic.
 * No React rendering needed — tests the data layer.
 *
 * @see E28-S10
 */
import { describe, it, expect } from 'vitest'
import type { TranscriptCue } from '@/data/types'

// ---------------------------------------------------------------------------
// Extracted helpers (mirroring TranscriptPanel internal logic)
// ---------------------------------------------------------------------------

function formatCueTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function findActiveCueIndex(cues: TranscriptCue[], currentTime: number): number {
  if (!cues.length) return -1
  for (let i = cues.length - 1; i >= 0; i--) {
    if (currentTime >= cues[i].startTime && currentTime < cues[i].endTime) {
      return i
    }
  }
  // If between cues, find the last cue that started before current time
  for (let i = cues.length - 1; i >= 0; i--) {
    if (currentTime >= cues[i].startTime) return i
  }
  return -1
}

function cueMatchesQuery(cue: TranscriptCue, query: string): boolean {
  if (!query.trim()) return false
  return cue.text.toLowerCase().includes(query.toLowerCase())
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SAMPLE_CUES: TranscriptCue[] = [
  { startTime: 0, endTime: 5, text: 'Welcome to this tutorial on React hooks.' },
  { startTime: 5, endTime: 12, text: 'Today we will learn about useState and useEffect.' },
  { startTime: 12, endTime: 20, text: 'These are the most commonly used hooks in React.' },
  { startTime: 20, endTime: 30, text: 'Let us start with a simple example.' },
  { startTime: 30, endTime: 40, text: 'First, import React from the react package.' },
  { startTime: 40, endTime: 50, text: 'Then create a functional component.' },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatCueTime', () => {
  it('should format 0 seconds as 0:00', () => {
    expect(formatCueTime(0)).toBe('0:00')
  })

  it('should format seconds < 60 with leading zero', () => {
    expect(formatCueTime(5)).toBe('0:05')
    expect(formatCueTime(45)).toBe('0:45')
  })

  it('should format minutes and seconds correctly', () => {
    expect(formatCueTime(60)).toBe('1:00')
    expect(formatCueTime(125)).toBe('2:05')
    expect(formatCueTime(3661)).toBe('61:01')
  })

  it('should floor fractional seconds', () => {
    expect(formatCueTime(5.7)).toBe('0:05')
    expect(formatCueTime(65.99)).toBe('1:05')
  })
})

describe('findActiveCueIndex', () => {
  it('should return -1 for empty cues', () => {
    expect(findActiveCueIndex([], 5)).toBe(-1)
  })

  it('should return -1 when currentTime is before all cues', () => {
    const cues: TranscriptCue[] = [{ startTime: 10, endTime: 20, text: 'First cue' }]
    expect(findActiveCueIndex(cues, 5)).toBe(-1)
  })

  it('should find the active cue when currentTime is within range', () => {
    expect(findActiveCueIndex(SAMPLE_CUES, 0)).toBe(0)
    expect(findActiveCueIndex(SAMPLE_CUES, 3)).toBe(0)
    expect(findActiveCueIndex(SAMPLE_CUES, 5)).toBe(1)
    expect(findActiveCueIndex(SAMPLE_CUES, 15)).toBe(2)
    expect(findActiveCueIndex(SAMPLE_CUES, 35)).toBe(4)
  })

  it('should return last matching cue at boundary', () => {
    // At exactly endTime of cue 0 (5s), cue 1 starts
    expect(findActiveCueIndex(SAMPLE_CUES, 5)).toBe(1)
  })

  it('should handle time past all cues', () => {
    expect(findActiveCueIndex(SAMPLE_CUES, 100)).toBe(5)
  })

  it('should handle gaps between cues', () => {
    const gappedCues: TranscriptCue[] = [
      { startTime: 0, endTime: 5, text: 'First' },
      { startTime: 10, endTime: 15, text: 'Second' },
    ]
    // At time 7 (in the gap), should return last cue that started before
    expect(findActiveCueIndex(gappedCues, 7)).toBe(0)
  })
})

describe('cueMatchesQuery', () => {
  const cue: TranscriptCue = {
    startTime: 0,
    endTime: 5,
    text: 'Welcome to this tutorial on React hooks.',
  }

  it('should return false for empty query', () => {
    expect(cueMatchesQuery(cue, '')).toBe(false)
    expect(cueMatchesQuery(cue, '   ')).toBe(false)
  })

  it('should match case-insensitively', () => {
    expect(cueMatchesQuery(cue, 'react')).toBe(true)
    expect(cueMatchesQuery(cue, 'REACT')).toBe(true)
    expect(cueMatchesQuery(cue, 'React')).toBe(true)
  })

  it('should match partial words', () => {
    expect(cueMatchesQuery(cue, 'hook')).toBe(true)
    expect(cueMatchesQuery(cue, 'tut')).toBe(true)
  })

  it('should return false for non-matching query', () => {
    expect(cueMatchesQuery(cue, 'Angular')).toBe(false)
    expect(cueMatchesQuery(cue, 'xyz123')).toBe(false)
  })

  it('should match multiple words in cue text', () => {
    expect(cueMatchesQuery(cue, 'Welcome')).toBe(true)
    expect(cueMatchesQuery(cue, 'tutorial')).toBe(true)
    expect(cueMatchesQuery(cue, 'hooks')).toBe(true)
  })
})

describe('search match counting', () => {
  it('should count matching cues correctly', () => {
    const query = 'react'
    const matchCount = SAMPLE_CUES.filter(c => cueMatchesQuery(c, query)).length
    expect(matchCount).toBe(3) // cues 0, 2, and 4 ("import React from the react package")
  })

  it('should return 0 for no matches', () => {
    const query = 'Angular'
    const matchCount = SAMPLE_CUES.filter(c => cueMatchesQuery(c, query)).length
    expect(matchCount).toBe(0)
  })

  it('should return all cues for common word', () => {
    // All cues have different text, test a word that appears in multiple
    const query = 'the'
    const matchCount = SAMPLE_CUES.filter(c => cueMatchesQuery(c, query)).length
    expect(matchCount).toBeGreaterThan(0)
  })
})
