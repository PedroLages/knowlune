/**
 * Session + inventory helpers for Library auto format defaults (Continue tab).
 */

export const LIBRARY_FORMAT_CLEARED_KEY = 'libraryFormatCleared' as const
export const LIBRARY_FORMAT_CLEARED_VALUE = '1' as const

export function libraryHasAudiobooks(books: { format: string }[]): boolean {
  return books.some(b => b.format === 'audiobook')
}

export function libraryHasEbooks(books: { format: string }[]): boolean {
  return books.some(b => b.format === 'epub' || b.format === 'pdf')
}

/** True when filter is exactly the Audiobooks tab shape. */
export function isAudiobookOnlyFormatFilter(format: string[] | undefined): boolean {
  return !!format && format.length === 1 && format[0] === 'audiobook'
}

/** True when filter is the Ebooks tab shape (epub and/or pdf only). */
export function isEbookTabFormatFilter(format: string[] | undefined): boolean {
  return !!format && format.length > 0 && format.every(v => v === 'epub' || v === 'pdf')
}

/** First paint with empty format: what to apply before user interaction. */
export type FirstEmptyFormatChoice = 'leave_unset' | 'audiobook' | 'ebooks'

export function chooseFirstEmptyFormatDefault(
  hasAudiobooks: boolean,
  hasEbooks: boolean
): FirstEmptyFormatChoice {
  if (hasAudiobooks && hasEbooks) return 'leave_unset'
  if (hasAudiobooks) return 'audiobook'
  if (hasEbooks) return 'ebooks'
  return 'leave_unset'
}

/**
 * After initial handling, format still empty: apply single-modality default if
 * inventory shrank from mixed to one modality; keep unset if still mixed.
 */
export type HandledEmptyResync = 'stay_unset' | 'audiobook' | 'ebooks'

export function chooseHandledEmptyFormatResync(
  hasAudiobooks: boolean,
  hasEbooks: boolean
): HandledEmptyResync | null {
  if (hasAudiobooks && hasEbooks) return 'stay_unset'
  if (hasAudiobooks && !hasEbooks) return 'audiobook'
  if (!hasAudiobooks && hasEbooks) return 'ebooks'
  return null
}
