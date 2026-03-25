import { z } from 'zod'

// ── Schema ──

/** Quiz preferences schema (excludes 'untimed' — only 1x, 1.5x, 2x timer options per QFR43) */
export const QuizPreferencesSchema = z.object({
  timerAccommodation: z.enum(['standard', '150%', '200%']),
  showImmediateFeedback: z.boolean(),
  shuffleQuestions: z.boolean(),
})

export type QuizPreferences = z.infer<typeof QuizPreferencesSchema>

// ── Constants ──

export const STORAGE_KEY = 'levelup-quiz-preferences'

export const DEFAULT_QUIZ_PREFERENCES: QuizPreferences = {
  timerAccommodation: 'standard',
  showImmediateFeedback: false,
  shuffleQuestions: false,
}

// ── CRUD ──

/** Load quiz preferences from localStorage, falling back to defaults on any error or invalid data. */
export function getQuizPreferences(): QuizPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_QUIZ_PREFERENCES }
    const parsed = QuizPreferencesSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : { ...DEFAULT_QUIZ_PREFERENCES }
  } catch {
    return { ...DEFAULT_QUIZ_PREFERENCES }
  }
}

/** Save a partial or full update to quiz preferences. Returns the merged result, or null on storage failure. */
export function saveQuizPreferences(patch: Partial<QuizPreferences>): QuizPreferences | null {
  const current = getQuizPreferences()
  const merged = { ...current, ...patch }
  const validated = QuizPreferencesSchema.safeParse(merged)
  const updated = validated.success ? validated.data : current
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    return null
  }
  return updated
}
