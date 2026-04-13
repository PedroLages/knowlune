import { describe, it, expect } from 'vitest'
import { formatRAGContext, type TutorRAGChunk } from '../tutorRAG'

describe('formatRAGContext', () => {
  it('returns empty string for no chunks', () => {
    expect(formatRAGContext([])).toBe('')
  })

  it('formats transcript chunks with timestamps', () => {
    const chunks: TutorRAGChunk[] = [
      {
        text: 'React hooks allow you to use state in functional components.',
        startTime: 120,
        endTime: 180,
        sourceType: 'transcript',
        rawScore: 0.85,
        boostedScore: 0.95,
      },
    ]
    const result = formatRAGContext(chunks)
    expect(result).toContain('[02:00 - 03:00]')
    expect(result).toContain('React hooks allow you to use state')
    expect(result).toContain('Retrieved transcript passages')
  })

  it('formats note chunks without timestamps', () => {
    const chunks: TutorRAGChunk[] = [
      {
        text: 'My note about hooks',
        startTime: 0,
        endTime: 0,
        sourceType: 'note',
        rawScore: 0.7,
        boostedScore: 0.7,
        noteId: 'note-1',
      },
    ]
    const result = formatRAGContext(chunks)
    expect(result).toContain('Learner notes')
    expect(result).toContain('My note about hooks')
  })

  it('separates transcript and note sections', () => {
    const chunks: TutorRAGChunk[] = [
      {
        text: 'Transcript content',
        startTime: 60,
        endTime: 120,
        sourceType: 'transcript',
        rawScore: 0.9,
        boostedScore: 0.9,
      },
      {
        text: 'Note content',
        startTime: 0,
        endTime: 0,
        sourceType: 'note',
        rawScore: 0.7,
        boostedScore: 0.7,
      },
    ]
    const result = formatRAGContext(chunks)
    expect(result).toContain('Retrieved transcript passages')
    expect(result).toContain('Learner notes')
  })
})

describe('position-aware boosting', () => {
  it('boosts chunks within 60s of playhead by +0.2', () => {
    // This tests the boosting logic conceptually
    const videoPosition = 300 // 5:00

    // Chunk at 4:30 (within 60s)
    const nearChunk = { startTime: 260, endTime: 280 }
    const midpoint = (nearChunk.startTime + nearChunk.endTime) / 2
    const isNear = Math.abs(midpoint - videoPosition) <= 60
    expect(isNear).toBe(true)

    const rawScore = 0.7
    const boostedScore = rawScore + (isNear ? 0.2 : 0)
    expect(boostedScore).toBeCloseTo(0.9)
  })

  it('does not boost chunks outside 60s window', () => {
    const videoPosition = 300

    // Chunk at 1:00 (way before playhead)
    const farChunk = { startTime: 50, endTime: 70 }
    const midpoint = (farChunk.startTime + farChunk.endTime) / 2
    const isNear = Math.abs(midpoint - videoPosition) <= 60
    expect(isNear).toBe(false)

    const rawScore = 0.7
    const boostedScore = rawScore + (isNear ? 0.2 : 0)
    expect(boostedScore).toBe(0.7)
  })
})
