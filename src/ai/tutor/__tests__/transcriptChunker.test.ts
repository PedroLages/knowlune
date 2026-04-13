import { describe, it, expect } from 'vitest'
import { chunkTranscript, type TranscriptChunk } from '../transcriptChunker'
import type { TranscriptCue } from '@/data/types'

function makeCue(startTime: number, text: string, duration = 5): TranscriptCue {
  return { startTime, endTime: startTime + duration, text }
}

describe('chunkTranscript', () => {
  it('returns empty array for empty cues', () => {
    expect(chunkTranscript([])).toEqual([])
  })

  it('creates a single chunk for short transcript', () => {
    const cues = [
      makeCue(0, 'Hello world'),
      makeCue(5, 'This is a test'),
    ]
    const chunks = chunkTranscript(cues)
    expect(chunks.length).toBeGreaterThanOrEqual(1)
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[0].startTime).toBe(0)
    expect(chunks[0].text).toContain('Hello world')
  })

  it('preserves timestamp metadata on chunks', () => {
    const cues = [
      makeCue(10, 'First sentence'),
      makeCue(15, 'Second sentence'),
    ]
    const chunks = chunkTranscript(cues)
    expect(chunks[0].startTime).toBe(10)
    expect(chunks[0].endTime).toBe(20)
  })

  it('creates multiple chunks for long transcript', () => {
    // Each cue is ~25 chars = ~6 tokens. 512 tokens = ~85 cues per chunk
    const cues: TranscriptCue[] = []
    for (let i = 0; i < 200; i++) {
      cues.push(makeCue(i * 5, `This is sentence number ${i} in the transcript.`))
    }
    const chunks = chunkTranscript(cues)
    expect(chunks.length).toBeGreaterThan(1)

    // All chunks should have valid timestamps
    for (const chunk of chunks) {
      expect(chunk.startTime).toBeGreaterThanOrEqual(0)
      expect(chunk.endTime).toBeGreaterThan(chunk.startTime)
    }
  })

  it('creates overlapping chunks (20% overlap)', () => {
    // Create enough cues for multiple chunks
    const cues: TranscriptCue[] = []
    for (let i = 0; i < 300; i++) {
      cues.push(makeCue(i * 3, `Word ${i} in the long transcript text here.`))
    }
    const chunks = chunkTranscript(cues)

    if (chunks.length >= 2) {
      // Second chunk should start before the first chunk ends (overlap)
      expect(chunks[1].startTime).toBeLessThan(chunks[0].endTime)
    }
  })

  it('assigns sequential chunk indices', () => {
    const cues: TranscriptCue[] = []
    for (let i = 0; i < 200; i++) {
      cues.push(makeCue(i * 5, `Sentence ${i} with enough text to fill chunks.`))
    }
    const chunks = chunkTranscript(cues)
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i)
    }
  })
})
