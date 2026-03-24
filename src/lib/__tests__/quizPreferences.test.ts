import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getQuizPreferences,
  saveQuizPreferences,
  DEFAULT_QUIZ_PREFERENCES,
  STORAGE_KEY,
} from '@/lib/quizPreferences'

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
})
