/**
 * Citation Extractor
 *
 * Parses citation markers from LLM responses and maps them to note metadata.
 */

import type { CitationMetadata, RetrievedContext } from './types'

export class CitationExtractor {
  /**
   * Extract citations from AI response and map to note metadata
   *
   * @param response - AI-generated text with citation markers like [1], [2]
   * @param retrievedNotes - Notes that were provided as context
   * @returns Map of citation index to note metadata
   *
   * @example
   * const response = "React hooks are useful [1]. They simplify state management [2]."
   * const citations = extractor.extract(response, context.notes)
   * // Returns Map: 1 -> note1 metadata, 2 -> note2 metadata
   */
  extract(
    response: string,
    retrievedNotes: RetrievedContext['notes']
  ): Map<number, CitationMetadata> {
    const citations = new Map<number, CitationMetadata>()

    // Find all citation markers [1], [2], etc.
    const citationRegex = /\[(\d+)\]/g
    let match: RegExpExecArray | null

    while ((match = citationRegex.exec(response)) !== null) {
      const citationIndex = parseInt(match[1], 10)

      // Validate citation index is within range of provided notes
      if (citationIndex < 1 || citationIndex > retrievedNotes.length) {
        console.warn(`[CitationExtractor] Invalid citation index: ${citationIndex}`)
        continue
      }

      // Map citation to note metadata (citations are 1-indexed, array is 0-indexed)
      const note = retrievedNotes[citationIndex - 1]
      if (!note) continue

      citations.set(citationIndex, {
        noteId: note.noteId,
        videoId: note.videoId,
        videoFilename: note.videoFilename,
        courseId: '', // CourseId not available in current note structure
        courseName: note.courseName,
      })
    }

    return citations
  }

  /**
   * Validate that all citations in response map to provided notes
   *
   * @param response - AI-generated text
   * @param retrievedNotes - Notes provided as context
   * @returns True if all citations are valid
   */
  validateCitations(response: string, retrievedNotes: RetrievedContext['notes']): boolean {
    const citationRegex = /\[(\d+)\]/g
    let match: RegExpExecArray | null

    while ((match = citationRegex.exec(response)) !== null) {
      const citationIndex = parseInt(match[1], 10)
      if (citationIndex < 1 || citationIndex > retrievedNotes.length) {
        return false
      }
    }

    return true
  }
}

// Singleton instance
export const citationExtractor = new CitationExtractor()
