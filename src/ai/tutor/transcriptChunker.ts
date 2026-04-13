/**
 * Transcript Chunker (E57-S05)
 *
 * Splits transcript cues into overlapping chunks for embedding.
 * Each chunk preserves timestamp metadata for citation and position-aware boosting.
 *
 * Configuration: 512-token chunks with 20% overlap (~102 tokens).
 * Token estimation uses ~4 chars/token heuristic.
 */

import type { TranscriptCue } from '@/data/types'
import { estimateTokens } from './transcriptContext'

/** Target token count per chunk */
const CHUNK_TOKEN_TARGET = 512
/** Overlap ratio (20%) */
const OVERLAP_RATIO = 0.2
/** Overlap in tokens */
const OVERLAP_TOKENS = Math.floor(CHUNK_TOKEN_TARGET * OVERLAP_RATIO)

export interface TranscriptChunk {
  /** Chunk text content */
  text: string
  /** Start time of first cue in chunk (seconds) */
  startTime: number
  /** End time of last cue in chunk (seconds) */
  endTime: number
  /** Zero-based index of this chunk */
  chunkIndex: number
}

/**
 * Split transcript cues into overlapping chunks for embedding.
 *
 * @param cues - Transcript cues with timing information
 * @returns Array of chunks with text and timestamp metadata
 */
export function chunkTranscript(cues: TranscriptCue[]): TranscriptChunk[] {
  if (cues.length === 0) return []

  const chunks: TranscriptChunk[] = []
  let cueIndex = 0
  let chunkIndex = 0

  while (cueIndex < cues.length) {
    const chunkCues: TranscriptCue[] = []
    let tokenCount = 0

    // Collect cues until we hit the token target
    let i = cueIndex
    while (i < cues.length && tokenCount < CHUNK_TOKEN_TARGET) {
      chunkCues.push(cues[i])
      tokenCount += estimateTokens(cues[i].text)
      i++
    }

    if (chunkCues.length === 0) break

    const text = chunkCues.map(c => c.text).join(' ')
    const firstCue = chunkCues[0]
    const lastCue = chunkCues[chunkCues.length - 1]

    chunks.push({
      text,
      startTime: firstCue.startTime,
      endTime: lastCue.endTime,
      chunkIndex,
    })

    chunkIndex++

    // Advance by (chunk size - overlap) in cues
    // Calculate how many cues correspond to the overlap
    let overlapTokens = 0
    let overlapCues = 0
    for (let j = chunkCues.length - 1; j >= 0; j--) {
      overlapTokens += estimateTokens(chunkCues[j].text)
      if (overlapTokens >= OVERLAP_TOKENS) break
      overlapCues++
    }

    // Move forward past the non-overlap portion
    const advance = Math.max(1, chunkCues.length - overlapCues)
    cueIndex += advance

    // Prevent infinite loop if we can't advance
    if (cueIndex <= cueIndex - advance) break
  }

  return chunks
}
