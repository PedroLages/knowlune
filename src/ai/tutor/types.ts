/**
 * Tutor AI Types (E57-S01)
 *
 * Type definitions for the tutor chat system: modes, context injection,
 * prompt slots, and transcript status.
 */

/** Tutor interaction mode — determines system prompt personality */
export type TutorMode = 'socratic' | 'explain' | 'quiz' | 'eli5' | 'debug'

/** Transcript grounding strategy used for context injection */
export type TranscriptStrategy = 'full' | 'chapter' | 'window' | 'none'

/** Transcript availability status shown via TranscriptBadge */
export interface TranscriptStatus {
  /** Whether transcript data is available */
  available: boolean
  /** Strategy used for context injection */
  strategy: TranscriptStrategy
  /** Human-readable label for the badge */
  label: string
}

/** Context injected into the tutor system prompt */
export interface TutorContext {
  /** Course display name */
  courseName: string
  /** Lesson display name */
  lessonTitle: string
  /** Lesson position (e.g. "3 of 12") */
  lessonPosition?: string
  /** Current video playback time in seconds */
  videoPositionSeconds?: number
  /** Transcript excerpt (may be full, chapter, or windowed) */
  transcriptExcerpt?: string
  /** Strategy used to extract the transcript excerpt */
  transcriptStrategy: TranscriptStrategy
  /** Chapter title (when using chapter strategy) */
  chapterTitle?: string
  /** Time range header for windowed excerpts (e.g. "[05:30 - 07:15]") */
  timeRange?: string
}

/** Priority-ordered prompt slot for the system prompt builder */
export interface PromptSlot {
  /** Slot identifier */
  id: 'base' | 'mode' | 'course' | 'transcript' | 'rag' | 'learner' | 'resume'
  /** Whether this slot is required (never omitted for budget) */
  required: boolean
  /** Priority (lower = higher priority, filled first) */
  priority: number
  /** Slot content */
  content: string
}
