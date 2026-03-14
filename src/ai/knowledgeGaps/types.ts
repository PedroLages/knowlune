// --- Knowledge Gap Detection types (E9B-S04) ---

export type GapSeverity = 'critical' | 'medium' | 'low'

export interface GapItem {
  courseId: string
  courseTitle: string
  videoId: string
  videoTitle: string
  gapType: 'under-noted' | 'skipped'
  severity: GapSeverity
  /** Number of notes for this video */
  noteCount: number
  /** Total videos in the course (for ratio context) */
  videoCount: number
  /** Watch percentage — only present for 'skipped' gaps */
  watchPercentage?: number
  /** AI-enriched description — absent when falling back to rule-based */
  aiDescription?: string
}

export interface GapDetectionResult {
  gaps: GapItem[]
  /** true when the LLM enriched descriptions; false when rule-based only */
  aiEnriched: boolean
}

export interface NoteLinkSuggestion {
  sourceNoteId: string
  targetNoteId: string
  targetCourseId: string
  targetCourseTitle: string
  sharedTags: string[]
  /** First 100 characters of the target note content */
  previewContent: string
}

/** Window type declarations for E2E test injection */
declare global {
  interface Window {
    __mockKnowledgeGapsResponse?: GapDetectionResult
  }
}
