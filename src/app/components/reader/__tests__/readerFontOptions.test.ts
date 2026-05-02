import { describe, it, expect } from 'vitest'
import {
  getReaderFontEpubStack,
  getReaderFontOption,
  READER_FONT_OPTIONS,
} from '../readerFontOptions'

describe('readerFontOptions', () => {
  it('lists a Literata and Inter option for on-screen reading', () => {
    const values = READER_FONT_OPTIONS.map(o => o.value)
    expect(values).toContain('literata')
    expect(values).toContain('inter')
  })

  it('getReaderFontEpubStack returns inherit for default', () => {
    expect(getReaderFontEpubStack('default')).toBe('inherit')
  })

  it('getReaderFontEpubStack includes Literata for the literata value', () => {
    expect(getReaderFontEpubStack('literata')).toContain('Literata')
  })

  it('getReaderFontOption returns a row for every curated value', () => {
    for (const opt of READER_FONT_OPTIONS) {
      expect(getReaderFontOption(opt.value)?.value).toBe(opt.value)
    }
  })
})
