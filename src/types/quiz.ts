/**
 * Quiz Type Definitions & Zod Validation Schemas
 *
 * Foundation types for the quiz subsystem (Epics 12-18, 61 QFRs).
 * All types are inferred from Zod schemas — schemas are the single source of truth.
 *
 * Usage:
 *   import { QuizSchema, type Quiz } from '@/types/quiz'
 *   const result = QuizSchema.safeParse(data) // never throws
 *
 * Scoring convention (documented, not enforced here):
 *   - MC, TF, FIB: all-or-nothing (0% or 100% of question points)
 *   - MS: Partial Credit Model — max(0, (correct - incorrect) / total_correct)
 *     (implemented in Epic 14)
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums / Union Types
// ---------------------------------------------------------------------------

/** The four supported question types (QFR9-12) */
export const QuestionTypeEnum = z.enum([
  'multiple-choice',
  'true-false',
  'multiple-select',
  'fill-in-blank',
])
export type QuestionType = z.infer<typeof QuestionTypeEnum>

/** Timer accommodation multiplier for accessibility (QFR49) */
export const TimerAccommodationEnum = z.enum(['standard', '150%', '200%', 'untimed'])
export type TimerAccommodation = z.infer<typeof TimerAccommodationEnum>

// ---------------------------------------------------------------------------
// QuestionMedia
// ---------------------------------------------------------------------------

/** Optional media attachment for a question (image, video, or audio) */
export const QuestionMediaSchema = z.object({
  /** Media type */
  type: z.enum(['image', 'video', 'audio']),
  /** URL to the media resource */
  url: z.string().min(1),
  /** Accessible alt text */
  alt: z.string().optional(),
})
export type QuestionMedia = z.infer<typeof QuestionMediaSchema>

// ---------------------------------------------------------------------------
// Question
// ---------------------------------------------------------------------------

/**
 * Base question schema before type-specific refinements.
 *
 * Refinements enforce:
 *   - MC: options required, 2-6 items
 *   - TF: options required, exactly 2 items
 *   - MS: options required, 2-6 items
 *   - FIB: options must be absent or empty
 *
 * Design note: BaseQuestionSchema is a ZodObject; QuestionSchema is ZodEffects
 * (due to .refine). z.infer<typeof QuestionSchema> === z.infer<typeof BaseQuestionSchema>
 * at the TypeScript level — refinements are runtime-only and do not narrow the type.
 * Always use QuestionSchema.safeParse() for validation; use BaseQuestionSchema
 * only if you need .pick()/.omit()/.extend() in Epic 13+ form schemas.
 */
const BaseQuestionSchema = z.object({
  /** Unique question identifier */
  id: z.string().min(1),
  /** Display order within the quiz (1-indexed) */
  order: z.number().int().positive(),
  /** Question type discriminator */
  type: QuestionTypeEnum,
  /** Question text (may contain Markdown) */
  text: z.string().min(1),
  /** Answer options — required for MC/TF/MS, absent for FIB */
  options: z.array(z.string()).optional(),
  /** Correct answer: string for MC/TF/FIB, string[] for MS (must be non-empty) */
  correctAnswer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  /** Explanation shown after answering */
  explanation: z.string(), // intentionally allows empty — explanation is optional content, not scored data
  /** Points awarded for a correct answer */
  points: z.number().positive(),
  /** Optional media attachment */
  media: QuestionMediaSchema.optional(),
})

// TODO(E13): Replace .refine() with .superRefine() + ctx.addIssue() per case to
// produce type-specific error messages for the quiz creation form validation UI.
/** Question schema with type-specific validation refinements */
export const QuestionSchema = BaseQuestionSchema.refine(q => {
  switch (q.type) {
    case 'multiple-choice':
      return Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 6
    case 'true-false':
      return Array.isArray(q.options) && q.options.length === 2
    case 'multiple-select':
      return Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 6
    case 'fill-in-blank':
      return !q.options || q.options.length === 0
    default:
      return false
  }
}, 'Question options do not match the expected constraints for this question type')

// NOTE: inferred from BaseQuestionSchema (not QuestionSchema) because z.infer on
// ZodEffects produces the same structural type — this is intentional, see JSDoc above.
export type Question = z.infer<typeof BaseQuestionSchema>

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/** Complete quiz definition with questions and settings */
export const QuizSchema = z.object({
  /** Unique quiz identifier */
  id: z.string().min(1),
  /** Associated lesson ID */
  lessonId: z.string().min(1),
  /** Quiz display title */
  title: z.string().min(1),
  /** Quiz description */
  description: z.string(),
  /** Ordered list of questions */
  questions: z.array(QuestionSchema).min(1),
  /** Time limit in milliseconds, or null for untimed */
  timeLimit: z.number().positive().nullable(),
  /** Minimum percentage (0-100) to pass */
  passingScore: z.number().min(0).max(100),
  /** Whether retakes are allowed after completion */
  allowRetakes: z.boolean(),
  /** Whether to randomize question order on each attempt */
  shuffleQuestions: z.boolean(),
  /** Whether to randomize answer option order */
  shuffleAnswers: z.boolean(),
  /** ISO 8601 creation timestamp */
  createdAt: z.string().datetime(),
  /** ISO 8601 last-updated timestamp */
  updatedAt: z.string().datetime(),
})
export type Quiz = z.infer<typeof QuizSchema>

// ---------------------------------------------------------------------------
// Answer
// ---------------------------------------------------------------------------

/** A learner's answer to a single question */
export const AnswerSchema = z.object({
  /** Question this answer corresponds to */
  questionId: z.string().min(1),
  /** Learner's response: string for MC/TF/FIB, string[] for MS (must be non-empty) */
  userAnswer: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  /** Whether the answer was scored as correct */
  isCorrect: z.boolean(),
  /** Points awarded for this answer */
  pointsEarned: z.number().min(0),
  /** Maximum points available for this question */
  pointsPossible: z.number().positive(),
})
export type Answer = z.infer<typeof AnswerSchema>

// ---------------------------------------------------------------------------
// QuizAttempt
// ---------------------------------------------------------------------------

// Business-rule invariants (enforced by the scoring service in Epic 14, not here):
//   percentage = (score / totalPoints) * 100
//   passed     = percentage >= quiz.passingScore
//   score      = sum of answers[*].pointsEarned
/** A completed quiz attempt with scoring results */
export const QuizAttemptSchema = z.object({
  /** Unique attempt identifier */
  id: z.string().min(1),
  /** Quiz this attempt belongs to */
  quizId: z.string().min(1),
  /** Individual question answers */
  answers: z.array(AnswerSchema),
  /** Total points earned */
  score: z.number().min(0),
  /** Score as percentage (0-100) */
  percentage: z.number().min(0).max(100),
  /** Whether the learner met the passing threshold */
  passed: z.boolean(),
  /** Time spent in milliseconds */
  timeSpent: z.number().min(0),
  /** ISO 8601 timestamp when quiz was submitted */
  completedAt: z.string().datetime(),
  /** ISO 8601 timestamp when quiz was started */
  startedAt: z.string().datetime(),
  /** Timer accommodation used for this attempt */
  timerAccommodation: TimerAccommodationEnum,
})
export type QuizAttempt = z.infer<typeof QuizAttemptSchema>

// ---------------------------------------------------------------------------
// QuizProgress (crash recovery state — persisted in localStorage)
// ---------------------------------------------------------------------------

/** In-progress quiz state for crash recovery via Zustand persist middleware */
export const QuizProgressSchema = z.object({
  /** Quiz being attempted */
  quizId: z.string().min(1),
  /** Current question index (0-based) */
  currentQuestionIndex: z.number().int().min(0),
  /** Answers keyed by question ID (key must be non-empty to prevent stale/corrupt entries) */
  answers: z.record(z.string().min(1), z.union([z.string(), z.array(z.string())])),
  /** Unix timestamp (ms) when the attempt started */
  startTime: z.number(),
  /** Remaining time in milliseconds, or null for untimed quizzes */
  timeRemaining: z.number().min(0).nullable(),
  /** Whether the quiz is currently paused */
  isPaused: z.boolean(),
  /** Question IDs flagged for review by the learner */
  markedForReview: z.array(z.string()),
  /** Persisted shuffled question order for deterministic crash recovery */
  questionOrder: z.array(z.string()),
  /** Timer accommodation for this session */
  timerAccommodation: TimerAccommodationEnum,
})
export type QuizProgress = z.infer<typeof QuizProgressSchema>
