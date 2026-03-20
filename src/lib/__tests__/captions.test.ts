import { describe, it, expect } from 'vitest'
import {
  parseTime,
  parseVTT,
  parseSRT,
  srtToWebVTT,
  detectCaptionFormat,
  validateCaptionFile,
  createCaptionBlobUrl,
} from '../captions'

// ---------------------------------------------------------------------------
// parseTime
// ---------------------------------------------------------------------------

describe('parseTime', () => {
  it('parses HH:MM:SS.mmm format', () => {
    expect(parseTime('00:01:30.500')).toBeCloseTo(90.5)
  })

  it('parses MM:SS.mmm format', () => {
    expect(parseTime('01:30.500')).toBeCloseTo(90.5)
  })

  it('parses SRT comma format HH:MM:SS,mmm', () => {
    expect(parseTime('00:00:01,000')).toBeCloseTo(1.0)
  })

  it('parses HH:MM:SS without milliseconds', () => {
    expect(parseTime('01:02:03')).toBeCloseTo(3723)
  })

  it('returns NaN for empty string', () => {
    expect(parseTime('')).toBeNaN()
  })

  it('returns NaN for whitespace-only string', () => {
    expect(parseTime('   ')).toBeNaN()
  })

  it('returns NaN for malformed input', () => {
    expect(parseTime('not-a-time')).toBeNaN()
  })

  it('returns NaN for single-part input', () => {
    expect(parseTime('123')).toBeNaN()
  })
})

// ---------------------------------------------------------------------------
// parseVTT
// ---------------------------------------------------------------------------

describe('parseVTT', () => {
  it('parses a valid WebVTT file', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
First subtitle line

00:00:05.000 --> 00:00:08.000
Second subtitle line
`
    const cues = parseVTT(vtt)
    expect(cues).toHaveLength(2)
    expect(cues[0].startTime).toBeCloseTo(1)
    expect(cues[0].endTime).toBeCloseTo(4)
    expect(cues[0].text).toBe('First subtitle line')
    expect(cues[1].startTime).toBeCloseTo(5)
    expect(cues[1].text).toBe('Second subtitle line')
  })

  it('handles Windows line endings (\\r\\n)', () => {
    const vtt = 'WEBVTT\r\n\r\n00:00:01.000 --> 00:00:04.000\r\nHello world\r\n'
    const cues = parseVTT(vtt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Hello world')
  })

  it('handles MM:SS.mmm timestamps', () => {
    const vtt = `WEBVTT

01:30.000 --> 02:00.000
Short format
`
    const cues = parseVTT(vtt)
    expect(cues).toHaveLength(1)
    expect(cues[0].startTime).toBeCloseTo(90)
  })

  it('skips cues with malformed timestamps', () => {
    const vtt = `WEBVTT

bad --> timestamps
Should be skipped

00:00:05.000 --> 00:00:08.000
Valid cue
`
    const cues = parseVTT(vtt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Valid cue')
  })

  it('skips blocks without text content', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000

00:00:05.000 --> 00:00:08.000
Has text
`
    const cues = parseVTT(vtt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Has text')
  })

  it('returns empty array for invalid content', () => {
    const cues = parseVTT('This is not a caption file')
    expect(cues).toEqual([])
  })

  it('joins multi-line cue text', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Line one
Line two
`
    const cues = parseVTT(vtt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Line one Line two')
  })
})

// ---------------------------------------------------------------------------
// parseSRT
// ---------------------------------------------------------------------------

describe('parseSRT', () => {
  it('parses a valid SRT file with comma timestamps', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
First subtitle

2
00:00:05,000 --> 00:00:08,000
Second subtitle
`
    const cues = parseSRT(srt)
    expect(cues).toHaveLength(2)
    expect(cues[0].startTime).toBeCloseTo(1)
    expect(cues[0].text).toBe('First subtitle')
    expect(cues[1].startTime).toBeCloseTo(5)
  })

  it('handles Windows line endings in SRT', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:04,000\r\nHello\r\n'
    const cues = parseSRT(srt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Hello')
  })
})

// ---------------------------------------------------------------------------
// srtToWebVTT
// ---------------------------------------------------------------------------

describe('srtToWebVTT', () => {
  it('starts with WEBVTT header', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello
`
    const vtt = srtToWebVTT(srt)
    expect(vtt.startsWith('WEBVTT')).toBe(true)
  })

  it('converts SRT timestamps to dot format', () => {
    const srt = `1
00:00:01,500 --> 00:00:04,000
Hello
`
    const vtt = srtToWebVTT(srt)
    expect(vtt).toContain('00:00:01.500')
    expect(vtt).toContain('00:00:04.000')
    expect(vtt).not.toContain(',')
  })

  it('preserves cue text including numeric-only lines', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
42

2
00:00:05,000 --> 00:00:08,000
Another line
`
    const vtt = srtToWebVTT(srt)
    expect(vtt).toContain('42')
    expect(vtt).toContain('Another line')
  })

  it('handles Windows line endings', () => {
    const srt = '1\r\n00:00:01,000 --> 00:00:04,000\r\nHello\r\n'
    const vtt = srtToWebVTT(srt)
    expect(vtt).toContain('WEBVTT')
    expect(vtt).toContain('Hello')
  })

  it('produces a valid round-trip (parse SRT → convert → parse VTT)', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
First line

2
00:00:05,000 --> 00:00:08,000
Second line
`
    const vtt = srtToWebVTT(srt)
    const cues = parseVTT(vtt)
    expect(cues).toHaveLength(2)
    expect(cues[0].text).toBe('First line')
    expect(cues[1].text).toBe('Second line')
  })
})

// ---------------------------------------------------------------------------
// detectCaptionFormat
// ---------------------------------------------------------------------------

describe('detectCaptionFormat', () => {
  it('detects .srt extension', () => {
    expect(detectCaptionFormat('subtitles.srt')).toBe('srt')
  })

  it('detects .vtt extension', () => {
    expect(detectCaptionFormat('captions.vtt')).toBe('vtt')
  })

  it('is case-insensitive', () => {
    expect(detectCaptionFormat('file.SRT')).toBe('srt')
    expect(detectCaptionFormat('file.VTT')).toBe('vtt')
  })

  it('returns null for unsupported extensions', () => {
    expect(detectCaptionFormat('file.txt')).toBeNull()
    expect(detectCaptionFormat('file.ass')).toBeNull()
  })

  it('returns null for files with no extension', () => {
    expect(detectCaptionFormat('noextension')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// validateCaptionFile
// ---------------------------------------------------------------------------

describe('validateCaptionFile', () => {
  it('returns valid for a proper VTT file', () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello
`
    expect(validateCaptionFile(vtt, 'vtt')).toEqual({ valid: true })
  })

  it('returns valid for a proper SRT file', () => {
    const srt = `1
00:00:01,000 --> 00:00:04,000
Hello
`
    expect(validateCaptionFile(srt, 'srt')).toEqual({ valid: true })
  })

  it('returns error for empty string', () => {
    const result = validateCaptionFile('', 'vtt')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('returns error for whitespace-only content', () => {
    const result = validateCaptionFile('   \n\n  ', 'srt')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('empty')
  })

  it('returns error for content with no valid timestamps', () => {
    const result = validateCaptionFile('This is not a caption file\nno timestamps here', 'srt')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('could not parse')
  })
})

// ---------------------------------------------------------------------------
// createCaptionBlobUrl
// ---------------------------------------------------------------------------

describe('createCaptionBlobUrl', () => {
  it('creates a blob: URL for VTT content', () => {
    const url = createCaptionBlobUrl('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello', 'vtt')
    expect(url).toMatch(/^blob:/)
    URL.revokeObjectURL(url)
  })

  it('creates a blob: URL for SRT content (converts to VTT)', () => {
    const url = createCaptionBlobUrl('1\n00:00:01,000 --> 00:00:04,000\nHello', 'srt')
    expect(url).toMatch(/^blob:/)
    URL.revokeObjectURL(url)
  })
})
