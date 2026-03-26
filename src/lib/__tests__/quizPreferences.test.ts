import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getQuizPreferences,
  saveQuizPreferences,
  DEFAULT_QUIZ_PREFERENCES,
  STORAGE_KEY,
} from '@/lib/quizPreferences'
import { loadSavedAccommodation } from '@/app/pages/Quiz'

describe('quizPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('DEFAULT_QUIZ_PREFERENCES', () => {
    it('has correct default values', () => {
      expect(DEFAULT_QUIZ_PREFERENCES).toEqual({
        timerAccommodation: 'standard',
        showImmediateFeedback: false,
        shuffleQuestions: false,
      })
    })
  })

  describe('getQuizPreferences', () => {
    it('returns defaults when localStorage is empty', () => {
      const prefs = getQuizPreferences()
      expect(prefs).toEqual(DEFAULT_QUIZ_PREFERENCES)
    })

    it('returns saved preferences when they exist', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          timerAccommodation: '150%',
          showImmediateFeedback: true,
          shuffleQuestions: true,
        })
      )
      const prefs = getQuizPreferences()
      expect(prefs.timerAccommodation).toBe('150%')
      expect(prefs.showImmediateFeedback).toBe(true)
      expect(prefs.shuffleQuestions).toBe(true)
    })

    it('returns defaults when localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-json')
      const prefs = getQuizPreferences()
      expect(prefs).toEqual(DEFAULT_QUIZ_PREFERENCES)
    })

    it('returns defaults when values fail Zod validation', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ timerAccommodation: 'untimed', showImmediateFeedback: 'yes' })
      )
      const prefs = getQuizPreferences()
      expect(prefs).toEqual(DEFAULT_QUIZ_PREFERENCES)
    })

    it('returns a new object each time (not a reference)', () => {
      const p1 = getQuizPreferences()
      const p2 = getQuizPreferences()
      expect(p1).toEqual(p2)
      expect(p1).not.toBe(p2)
    })
  })

  describe('saveQuizPreferences', () => {
    it('persists to localStorage under the correct key', () => {
      saveQuizPreferences({ timerAccommodation: '200%' })
      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.timerAccommodation).toBe('200%')
    })

    it('merges partial updates with existing preferences', () => {
      saveQuizPreferences({ showImmediateFeedback: true })
      saveQuizPreferences({ shuffleQuestions: true })
      const prefs = getQuizPreferences()
      expect(prefs.showImmediateFeedback).toBe(true)
      expect(prefs.shuffleQuestions).toBe(true)
      expect(prefs.timerAccommodation).toBe('standard') // unchanged default
    })

    it('returns the updated preferences', () => {
      const result = saveQuizPreferences({ timerAccommodation: '150%' })
      expect(result).not.toBeNull()
      expect(result!.timerAccommodation).toBe('150%')
      expect(result!.showImmediateFeedback).toBe(false)
      expect(result!.shuffleQuestions).toBe(false)
    })

    it('overwrites previously saved values', () => {
      saveQuizPreferences({ timerAccommodation: '150%' })
      saveQuizPreferences({ timerAccommodation: '200%' })
      expect(getQuizPreferences().timerAccommodation).toBe('200%')
    })

    it('can set all fields at once', () => {
      const result = saveQuizPreferences({
        timerAccommodation: '200%',
        showImmediateFeedback: true,
        shuffleQuestions: true,
      })
      expect(result).not.toBeNull()
      expect(result!).toEqual({
        timerAccommodation: '200%',
        showImmediateFeedback: true,
        shuffleQuestions: true,
      })
    })

    it('returns null when localStorage throws', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      const result = saveQuizPreferences({ shuffleQuestions: true })
      expect(result).toBeNull()
      spy.mockRestore()
    })

    it('validates patch with Zod and drops invalid values', () => {
      saveQuizPreferences({ timerAccommodation: '150%' })
      const result = saveQuizPreferences({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test/evaluate context with dynamic types
        timerAccommodation: 'invalid' as any,
      })
      expect(result).not.toBeNull()
      expect(result!.timerAccommodation).toBe('150%')
    })

    it('returns current preferences unchanged for empty patch', () => {
      saveQuizPreferences({ timerAccommodation: '200%', showImmediateFeedback: true })
      const result = saveQuizPreferences({})
      expect(result).toEqual({
        timerAccommodation: '200%',
        showImmediateFeedback: true,
        shuffleQuestions: false,
      })
    })
  })

  describe('loadSavedAccommodation', () => {
    it('returns global preference when no per-lesson key exists', () => {
      saveQuizPreferences({ timerAccommodation: '150%' })
      expect(loadSavedAccommodation('lesson-1')).toBe('150%')
    })

    it('returns per-lesson key when it is a valid TimerAccommodation', () => {
      localStorage.setItem('quiz-accommodation-lesson-2', '200%')
      expect(loadSavedAccommodation('lesson-2')).toBe('200%')
    })

    it('falls back to global preference when per-lesson key is an invalid enum value', () => {
      saveQuizPreferences({ timerAccommodation: '150%' })
      localStorage.setItem('quiz-accommodation-lesson-3', 'invalid-value')
      expect(loadSavedAccommodation('lesson-3')).toBe('150%')
    })

    it('falls back to global preference when per-lesson key is a non-enum string', () => {
      saveQuizPreferences({ timerAccommodation: '200%' })
      // 'bogus' is not a valid TimerAccommodation enum value, so Zod rejects it
      localStorage.setItem('quiz-accommodation-lesson-4', 'bogus')
      expect(loadSavedAccommodation('lesson-4')).toBe('200%')
    })

    it('returns standard when no preferences exist at all', () => {
      expect(loadSavedAccommodation('lesson-5')).toBe('standard')
    })
  })
})
