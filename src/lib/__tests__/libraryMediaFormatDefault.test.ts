import { describe, it, expect } from 'vitest'
import {
  chooseFirstEmptyFormatDefault,
  chooseHandledEmptyFormatResync,
  isAudiobookOnlyFormatFilter,
  isEbookTabFormatFilter,
  libraryHasAudiobooks,
  libraryHasEbooks,
} from '@/lib/libraryMediaFormatDefault'

describe('libraryMediaFormatDefault', () => {
  describe('libraryHasAudiobooks / libraryHasEbooks', () => {
    it('detects audiobook', () => {
      expect(libraryHasAudiobooks([{ format: 'epub' }, { format: 'audiobook' }])).toBe(true)
      expect(libraryHasAudiobooks([{ format: 'epub' }])).toBe(false)
    })
    it('detects ebooks', () => {
      expect(libraryHasEbooks([{ format: 'audiobook' }, { format: 'epub' }])).toBe(true)
      expect(libraryHasEbooks([{ format: 'pdf' }])).toBe(true)
      expect(libraryHasEbooks([{ format: 'audiobook' }])).toBe(false)
    })
  })

  describe('isAudiobookOnlyFormatFilter', () => {
    it('matches single audiobook tab', () => {
      expect(isAudiobookOnlyFormatFilter(['audiobook'])).toBe(true)
      expect(isAudiobookOnlyFormatFilter(['audiobook', 'epub'])).toBe(false)
      expect(isAudiobookOnlyFormatFilter(undefined)).toBe(false)
    })
  })

  describe('isEbookTabFormatFilter', () => {
    it('matches epub/pdf-only shapes', () => {
      expect(isEbookTabFormatFilter(['epub', 'pdf'])).toBe(true)
      expect(isEbookTabFormatFilter(['epub'])).toBe(true)
      expect(isEbookTabFormatFilter(['audiobook'])).toBe(false)
    })
  })

  describe('chooseFirstEmptyFormatDefault', () => {
    it('leaves unset when both modalities exist', () => {
      expect(chooseFirstEmptyFormatDefault(true, true)).toBe('leave_unset')
    })
    it('picks single modality', () => {
      expect(chooseFirstEmptyFormatDefault(true, false)).toBe('audiobook')
      expect(chooseFirstEmptyFormatDefault(false, true)).toBe('ebooks')
      expect(chooseFirstEmptyFormatDefault(false, false)).toBe('leave_unset')
    })
  })

  describe('chooseHandledEmptyFormatResync', () => {
    it('stays unset when mixed', () => {
      expect(chooseHandledEmptyFormatResync(true, true)).toBe('stay_unset')
    })
    it('resyncs single modality', () => {
      expect(chooseHandledEmptyFormatResync(true, false)).toBe('audiobook')
      expect(chooseHandledEmptyFormatResync(false, true)).toBe('ebooks')
      expect(chooseHandledEmptyFormatResync(false, false)).toBe(null)
    })
  })
})
