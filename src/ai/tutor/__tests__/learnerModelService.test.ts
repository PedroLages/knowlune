/**
 * Tests for Learner Model CRUD Service (E72-S01)
 *
 * Coverage:
 * - getOrCreateLearnerModel: creates defaults, idempotent
 * - updateLearnerModel: additive merge, deduplication, overwrite fields
 * - clearLearnerModel: hard delete, subsequent get returns null
 * - getLearnerModel: read-only, returns null if not found
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getLearnerModel,
  getOrCreateLearnerModel,
  updateLearnerModel,
  clearLearnerModel,
} from '../learnerModelService'
import { db } from '@/db'

beforeEach(async () => {
  await db.learnerModels.clear()
})

describe('learnerModelService', () => {
  describe('getLearnerModel', () => {
    it('returns null for non-existent course', async () => {
      const result = await getLearnerModel('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('getOrCreateLearnerModel', () => {
    it('creates a default model for a new course', async () => {
      const model = await getOrCreateLearnerModel('course-1')

      expect(model.courseId).toBe('course-1')
      expect(model.id).toBeTruthy()
      expect(model.vocabularyLevel).toBe('beginner')
      expect(model.strengths).toEqual([])
      expect(model.misconceptions).toEqual([])
      expect(model.topicsExplored).toEqual([])
      expect(model.preferredMode).toBe('socratic')
      expect(model.lastSessionSummary).toBe('')
      expect(model.quizStats).toEqual({
        totalQuestions: 0,
        correctAnswers: 0,
        weakTopics: [],
      })
      expect(model.createdAt).toBeTruthy()
      expect(model.updatedAt).toBeTruthy()
    })

    it('is idempotent — returns same record on second call', async () => {
      const first = await getOrCreateLearnerModel('course-1')
      const second = await getOrCreateLearnerModel('course-1')

      expect(second.id).toBe(first.id)
      expect(second.createdAt).toBe(first.createdAt)
    })
  })

  describe('updateLearnerModel', () => {
    it('returns null if model does not exist', async () => {
      const result = await updateLearnerModel('nonexistent', { vocabularyLevel: 'advanced' })
      expect(result).toBeNull()
    })

    it('appends strengths additively', async () => {
      await getOrCreateLearnerModel('course-1')

      const strength1 = {
        concept: 'recursion',
        confidence: 0.8,
        lastAssessed: '2026-01-01T00:00:00Z',
        assessedBy: 'socratic' as const,
      }
      const strength2 = {
        concept: 'loops',
        confidence: 0.9,
        lastAssessed: '2026-01-02T00:00:00Z',
        assessedBy: 'explain' as const,
      }

      await updateLearnerModel('course-1', { strengths: [strength1] })
      const result = await updateLearnerModel('course-1', { strengths: [strength2] })

      expect(result!.strengths).toHaveLength(2)
      expect(result!.strengths.map(s => s.concept)).toContain('recursion')
      expect(result!.strengths.map(s => s.concept)).toContain('loops')
    })

    it('deduplicates concepts by keeping most recent lastAssessed', async () => {
      await getOrCreateLearnerModel('course-1')

      const older = {
        concept: 'recursion',
        confidence: 0.5,
        lastAssessed: '2026-01-01T00:00:00Z',
        assessedBy: 'socratic' as const,
      }
      const newer = {
        concept: 'recursion',
        confidence: 0.9,
        lastAssessed: '2026-01-15T00:00:00Z',
        assessedBy: 'explain' as const,
      }

      await updateLearnerModel('course-1', { strengths: [older] })
      const result = await updateLearnerModel('course-1', { strengths: [newer] })

      expect(result!.strengths).toHaveLength(1)
      expect(result!.strengths[0].confidence).toBe(0.9)
      expect(result!.strengths[0].lastAssessed).toBe('2026-01-15T00:00:00Z')
    })

    it('does not replace newer with older concept assessment', async () => {
      await getOrCreateLearnerModel('course-1')

      const newer = {
        concept: 'recursion',
        confidence: 0.9,
        lastAssessed: '2026-01-15T00:00:00Z',
        assessedBy: 'socratic' as const,
      }
      const older = {
        concept: 'recursion',
        confidence: 0.3,
        lastAssessed: '2026-01-01T00:00:00Z',
        assessedBy: 'explain' as const,
      }

      await updateLearnerModel('course-1', { strengths: [newer] })
      const result = await updateLearnerModel('course-1', { strengths: [older] })

      expect(result!.strengths).toHaveLength(1)
      expect(result!.strengths[0].confidence).toBe(0.9)
    })

    it('unions topicsExplored without duplicates', async () => {
      await getOrCreateLearnerModel('course-1')

      await updateLearnerModel('course-1', { topicsExplored: ['arrays', 'loops'] })
      const result = await updateLearnerModel('course-1', {
        topicsExplored: ['loops', 'functions'],
      })

      expect(result!.topicsExplored).toEqual(
        expect.arrayContaining(['arrays', 'loops', 'functions'])
      )
      expect(result!.topicsExplored).toHaveLength(3)
    })

    it('overwrites vocabularyLevel', async () => {
      await getOrCreateLearnerModel('course-1')

      const result = await updateLearnerModel('course-1', { vocabularyLevel: 'advanced' })
      expect(result!.vocabularyLevel).toBe('advanced')
    })

    it('overwrites lastSessionSummary', async () => {
      await getOrCreateLearnerModel('course-1')

      const result = await updateLearnerModel('course-1', {
        lastSessionSummary: 'Covered recursion basics',
      })
      expect(result!.lastSessionSummary).toBe('Covered recursion basics')
    })

    it('overwrites preferredMode', async () => {
      await getOrCreateLearnerModel('course-1')

      const result = await updateLearnerModel('course-1', { preferredMode: 'explain' })
      expect(result!.preferredMode).toBe('explain')
    })

    it('merges quizStats additively', async () => {
      await getOrCreateLearnerModel('course-1')

      await updateLearnerModel('course-1', {
        quizStats: { totalQuestions: 10, correctAnswers: 7, weakTopics: ['arrays'] },
      })
      const result = await updateLearnerModel('course-1', {
        quizStats: { totalQuestions: 5, correctAnswers: 4, weakTopics: ['arrays', 'recursion'] },
      })

      expect(result!.quizStats.totalQuestions).toBe(15)
      expect(result!.quizStats.correctAnswers).toBe(11)
      expect(result!.quizStats.weakTopics).toEqual(expect.arrayContaining(['arrays', 'recursion']))
      expect(result!.quizStats.weakTopics).toHaveLength(2)
    })

    it('refreshes updatedAt on update', async () => {
      const model = await getOrCreateLearnerModel('course-1')
      const originalUpdatedAt = model.updatedAt

      // Small delay to ensure different timestamp
      await new Promise(r => setTimeout(r, 10))

      const result = await updateLearnerModel('course-1', { vocabularyLevel: 'intermediate' })
      expect(result!.updatedAt).not.toBe(originalUpdatedAt)
    })
  })

  describe('clearLearnerModel', () => {
    it('deletes model and subsequent get returns null', async () => {
      await getOrCreateLearnerModel('course-1')

      await clearLearnerModel('course-1')

      const result = await getLearnerModel('course-1')
      expect(result).toBeNull()
    })

    it('does not throw for non-existent course', async () => {
      await expect(clearLearnerModel('nonexistent')).resolves.toBeUndefined()
    })

    it('does not auto-create a new model after clearing', async () => {
      await getOrCreateLearnerModel('course-1')
      await clearLearnerModel('course-1')

      // getLearnerModel (not getOrCreate) should return null
      const result = await getLearnerModel('course-1')
      expect(result).toBeNull()
    })
  })
})
