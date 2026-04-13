/**
 * Learner Model CRUD Service (E72-S01)
 *
 * Persistent per-course learner model updated at session boundaries.
 * Distinct from E63's LearnerProfileData (ephemeral prompt injection aggregation).
 *
 * @see src/data/types.ts — LearnerModel, ConceptAssessment, VocabularyLevel
 */

import { db } from '@/db'
import type { LearnerModel, ConceptAssessment } from '@/data/types'

/**
 * Get learner model for a course, or return null if none exists.
 */
export async function getLearnerModel(courseId: string): Promise<LearnerModel | null> {
  const model = await db.learnerModels.where('courseId').equals(courseId).first()
  return model ?? null
}

/**
 * Get existing learner model or create a new one with default values.
 * Idempotent — calling twice returns the same record.
 */
export async function getOrCreateLearnerModel(courseId: string): Promise<LearnerModel> {
  const existing = await getLearnerModel(courseId)
  if (existing) return existing

  const now = new Date().toISOString()
  const model: LearnerModel = {
    id: crypto.randomUUID(),
    courseId,
    vocabularyLevel: 'beginner',
    strengths: [],
    misconceptions: [],
    topicsExplored: [],
    preferredMode: 'socratic',
    lastSessionSummary: '',
    quizStats: {
      totalQuestions: 0,
      correctAnswers: 0,
      weakTopics: [],
    },
    createdAt: now,
    updatedAt: now,
  }

  await db.learnerModels.add(model)
  return model
}

/**
 * Deduplicate ConceptAssessment array by concept name,
 * keeping the entry with the most recent lastAssessed timestamp.
 */
function deduplicateConcepts(assessments: ConceptAssessment[]): ConceptAssessment[] {
  const map = new Map<string, ConceptAssessment>()
  for (const a of assessments) {
    const existing = map.get(a.concept)
    if (!existing || a.lastAssessed > existing.lastAssessed) {
      map.set(a.concept, a)
    }
  }
  return Array.from(map.values())
}

/**
 * Update learner model with additive merge semantics:
 * - strengths/misconceptions: appended then deduplicated by concept (latest wins)
 * - topicsExplored: set union
 * - vocabularyLevel, lastSessionSummary, preferredMode: overwrite
 * - quizStats: additive (totalQuestions/correctAnswers sum, weakTopics union)
 */
export async function updateLearnerModel(
  courseId: string,
  updates: Partial<LearnerModel>
): Promise<LearnerModel | null> {
  const existing = await getLearnerModel(courseId)
  if (!existing) return null

  const now = new Date().toISOString()

  // Additive merge for array fields
  const mergedStrengths = updates.strengths
    ? deduplicateConcepts([...existing.strengths, ...updates.strengths])
    : existing.strengths

  const mergedMisconceptions = updates.misconceptions
    ? deduplicateConcepts([...existing.misconceptions, ...updates.misconceptions])
    : existing.misconceptions

  const mergedTopics = updates.topicsExplored
    ? [...new Set([...existing.topicsExplored, ...updates.topicsExplored])]
    : existing.topicsExplored

  // Additive merge for quizStats
  const mergedQuizStats = updates.quizStats
    ? {
        totalQuestions: existing.quizStats.totalQuestions + updates.quizStats.totalQuestions,
        correctAnswers: existing.quizStats.correctAnswers + updates.quizStats.correctAnswers,
        weakTopics: [...new Set([...existing.quizStats.weakTopics, ...updates.quizStats.weakTopics])],
      }
    : existing.quizStats

  const merged: LearnerModel = {
    ...existing,
    // Overwrite fields (only if provided)
    ...(updates.vocabularyLevel !== undefined && { vocabularyLevel: updates.vocabularyLevel }),
    ...(updates.lastSessionSummary !== undefined && { lastSessionSummary: updates.lastSessionSummary }),
    ...(updates.preferredMode !== undefined && { preferredMode: updates.preferredMode }),
    // Merged fields
    strengths: mergedStrengths,
    misconceptions: mergedMisconceptions,
    topicsExplored: mergedTopics,
    quizStats: mergedQuizStats,
    updatedAt: now,
  }

  await db.learnerModels.put(merged)
  return merged
}

/**
 * Delete learner model for a course. Returns null on subsequent get.
 */
export async function clearLearnerModel(courseId: string): Promise<void> {
  const existing = await getLearnerModel(courseId)
  if (existing) {
    await db.learnerModels.delete(existing.id)
  }
}
