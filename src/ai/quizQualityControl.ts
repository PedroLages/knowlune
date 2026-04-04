/**
 * Quiz Quality Control Pipeline
 *
 * Deterministic QC checks (no LLM calls) that validate generated questions:
 * 1. Duplicate detection via text-based cosine similarity
 * 2. Answer uniqueness (correctAnswer in options, all options distinct)
 * 3. Transcript grounding (key terms from question appear in source chunk)
 *
 * @see E52-S03 Quiz Quality & Feedback
 * @module
 */

import type { GeneratedQuestion } from './quizPrompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of the quality control pipeline */
export interface QualityControlResult {
  /** Questions that passed all QC checks */
  validQuestions: GeneratedQuestion[]
  /** Questions that failed one or more QC checks */
  rejectedQuestions: Array<{
    question: GeneratedQuestion
    reasons: string[]
  }>
  /** Whether any questions were rejected (signals retry needed) */
  retryNeeded: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cosine similarity threshold — questions above this are considered duplicates */
const DUPLICATE_SIMILARITY_THRESHOLD = 0.85

/** Minimum fraction of key terms that must appear in the chunk for grounding */
const GROUNDING_MIN_TERM_RATIO = 0.3

/** Log prefix */
const LOG_PREFIX = '[QuizQC]'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run quality control checks on a set of generated questions.
 *
 * Checks (in order):
 * 1. Answer uniqueness per question
 * 2. Transcript grounding per question
 * 3. Duplicate detection across all questions
 *
 * @param questions - Generated questions from LLM
 * @param chunkText - Source transcript chunk text for grounding check
 * @returns QC result with valid/rejected questions
 */
export function runQualityControl(
  questions: GeneratedQuestion[],
  chunkText: string
): QualityControlResult {
  if (questions.length === 0) {
    return { validQuestions: [], rejectedQuestions: [], retryNeeded: false }
  }

  const rejectionMap = new Map<number, string[]>()

  // Check 1: Answer uniqueness
  for (let i = 0; i < questions.length; i++) {
    const reasons = checkAnswerUniqueness(questions[i])
    if (reasons.length > 0) {
      rejectionMap.set(i, [...(rejectionMap.get(i) ?? []), ...reasons])
    }
  }

  // Check 2: Transcript grounding
  const chunkLower = chunkText.toLowerCase()
  for (let i = 0; i < questions.length; i++) {
    const reasons = checkTranscriptGrounding(questions[i], chunkLower)
    if (reasons.length > 0) {
      rejectionMap.set(i, [...(rejectionMap.get(i) ?? []), ...reasons])
    }
  }

  // Check 3: Duplicate detection (only among non-rejected questions)
  const candidateIndices = questions
    .map((_, i) => i)
    .filter(i => !rejectionMap.has(i))

  const duplicateIndices = detectDuplicates(
    candidateIndices.map(i => questions[i]),
    candidateIndices
  )

  for (const idx of duplicateIndices) {
    rejectionMap.set(idx, [...(rejectionMap.get(idx) ?? []), 'Duplicate of another question'])
  }

  // Build result
  const validQuestions: GeneratedQuestion[] = []
  const rejectedQuestions: QualityControlResult['rejectedQuestions'] = []

  for (let i = 0; i < questions.length; i++) {
    const reasons = rejectionMap.get(i)
    if (reasons && reasons.length > 0) {
      rejectedQuestions.push({ question: questions[i], reasons })
    } else {
      validQuestions.push(questions[i])
    }
  }

  if (rejectedQuestions.length > 0) {
    console.warn(
      LOG_PREFIX,
      `${rejectedQuestions.length}/${questions.length} questions rejected:`,
      rejectedQuestions.map(r => r.reasons.join(', '))
    )
  }

  return {
    validQuestions,
    rejectedQuestions,
    retryNeeded: rejectedQuestions.length > 0 && validQuestions.length === 0,
  }
}

// ---------------------------------------------------------------------------
// Check 1: Answer Uniqueness
// ---------------------------------------------------------------------------

/**
 * Verify correctAnswer is present in options and all options are distinct.
 */
function checkAnswerUniqueness(question: GeneratedQuestion): string[] {
  const reasons: string[] = []

  // Fill-in-blank questions don't have options
  if (question.type === 'fill-in-blank') return reasons

  const options = question.options
  if (!options || options.length === 0) {
    reasons.push('Missing options for non-fill-in-blank question')
    return reasons
  }

  // Check correctAnswer is in options
  const correctAnswer =
    typeof question.correctAnswer === 'string'
      ? question.correctAnswer
      : question.correctAnswer[0]

  if (!options.includes(correctAnswer)) {
    reasons.push(`correctAnswer "${correctAnswer}" not found in options`)
  }

  // Check all options are distinct (case-sensitive)
  const uniqueOptions = new Set(options)
  if (uniqueOptions.size !== options.length) {
    reasons.push('Duplicate options detected')
  }

  return reasons
}

// ---------------------------------------------------------------------------
// Check 2: Transcript Grounding
// ---------------------------------------------------------------------------

/**
 * Extract key terms from question text and verify they appear in the chunk.
 * Uses simple stop-word filtering and term presence checking.
 */
function checkTranscriptGrounding(
  question: GeneratedQuestion,
  chunkLower: string
): string[] {
  const terms = extractKeyTerms(question.text)

  if (terms.length === 0) return []

  const foundCount = terms.filter(term => chunkLower.includes(term)).length
  const ratio = foundCount / terms.length

  if (ratio < GROUNDING_MIN_TERM_RATIO) {
    return [
      `Failed transcript grounding: only ${foundCount}/${terms.length} key terms found in chunk`,
    ]
  }

  return []
}

/** Common English stop words to filter out */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'that', 'this',
  'which', 'what', 'who', 'whom', 'these', 'those', 'it', 'its',
  'he', 'she', 'they', 'them', 'his', 'her', 'their', 'my', 'your',
  'we', 'you', 'i', 'me', 'us', 'about', 'up', 'also',
  'following', 'true', 'false', 'correct', 'incorrect', 'answer',
])

/**
 * Extract meaningful terms from question text (lowercase, no stop words, 3+ chars).
 */
export function extractKeyTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word))
}

// ---------------------------------------------------------------------------
// Check 3: Duplicate Detection (text-based cosine similarity)
// ---------------------------------------------------------------------------

/**
 * Detect duplicate questions using TF-IDF-like cosine similarity on question text.
 * Uses term frequency vectors rather than embeddings (no LLM needed).
 *
 * @returns Set of indices (from originalIndices) that are duplicates
 */
function detectDuplicates(
  questions: GeneratedQuestion[],
  originalIndices: number[]
): Set<number> {
  const duplicates = new Set<number>()
  if (questions.length < 2) return duplicates

  // Build term frequency vectors
  const vectors = questions.map(q => buildTermVector(q.text))

  // Compare all pairs
  for (let i = 0; i < vectors.length; i++) {
    if (duplicates.has(originalIndices[i])) continue
    for (let j = i + 1; j < vectors.length; j++) {
      if (duplicates.has(originalIndices[j])) continue

      const similarity = textCosineSimilarity(vectors[i], vectors[j])
      if (similarity > DUPLICATE_SIMILARITY_THRESHOLD) {
        // Mark the later question as the duplicate
        duplicates.add(originalIndices[j])
      }
    }
  }

  return duplicates
}

/** Build a term frequency map from text */
function buildTermVector(text: string): Map<string, number> {
  const terms = extractKeyTerms(text)
  const vector = new Map<string, number>()
  for (const term of terms) {
    vector.set(term, (vector.get(term) ?? 0) + 1)
  }
  return vector
}

/** Cosine similarity between two term frequency maps */
export function textCosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (const [term, freqA] of a) {
    normA += freqA * freqA
    const freqB = b.get(term)
    if (freqB !== undefined) {
      dotProduct += freqA * freqB
    }
  }

  for (const freqB of b.values()) {
    normB += freqB * freqB
  }

  const magnitude = Math.sqrt(normA * normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}
