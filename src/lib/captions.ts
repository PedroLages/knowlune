/**
 * Caption file parsing, validation, and persistence.
 *
 * Supports SRT and WebVTT formats. SRT is converted to WebVTT at load time
 * because the browser <track> element only supports WebVTT natively.
 *
 * Caption content is stored in Dexie (not as file handles) so captions
 * auto-load on return visits without re-prompting for file permissions.
 */
import type { CaptionTrack, TranscriptCue, VideoCaptionRecord } from '@/data/types'
import { db } from '@/db/schema'

/** Max caption file size: 5MB (generous for text-based subtitle files) */
const MAX_CAPTION_FILE_SIZE = 5 * 1024 * 1024

// ---------------------------------------------------------------------------
// Timestamp parsing (extracted from TranscriptPanel)
// Handles HH:MM:SS.mmm, MM:SS.mmm, HH:MM:SS,mmm (SRT comma format)
// ---------------------------------------------------------------------------

export function parseTime(t: string): number {
  if (!t || !t.trim()) return NaN
  const parts = t.replace(',', '.').split(':')
  if (parts.length === 3) {
    const val = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
    return isFinite(val) ? val : NaN
  }
  if (parts.length === 2) {
    const val = parseFloat(parts[0]) * 60 + parseFloat(parts[1])
    return isFinite(val) ? val : NaN
  }
  return NaN
}

// ---------------------------------------------------------------------------
// VTT parsing (extracted from TranscriptPanel)
// ---------------------------------------------------------------------------

const TIMESTAMP_RE = /(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*-->\s*(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)/

export function parseVTT(text: string): TranscriptCue[] {
  // Normalize Windows line endings
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.trim().split(/\n\n+/)
  const cues: TranscriptCue[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timestampLine = lines.find(l => l.includes('-->'))
    if (!timestampLine) continue

    const match = timestampLine.match(TIMESTAMP_RE)
    if (!match) continue

    const startTime = parseTime(match[1])
    const endTime = parseTime(match[2])

    // Skip cues with invalid timestamps
    if (isNaN(startTime) || isNaN(endTime)) continue

    const tsIdx = lines.indexOf(timestampLine)
    const textLines = lines.slice(tsIdx + 1).filter(l => l.trim())
    if (!textLines.length) continue

    cues.push({ startTime, endTime, text: textLines.join(' ') })
  }

  return cues
}

// ---------------------------------------------------------------------------
// SRT parsing
// ---------------------------------------------------------------------------

export function parseSRT(text: string): TranscriptCue[] {
  // SRT format is structurally identical to VTT (blocks separated by blank
  // lines, timestamp --> timestamp, text lines) — the only difference is
  // commas in timestamps, which parseTime already handles.
  return parseVTT(text)
}

// ---------------------------------------------------------------------------
// SRT → WebVTT conversion (structural, not regex)
// ---------------------------------------------------------------------------

export function srtToWebVTT(srtText: string): string {
  // Parse SRT into cues, then reconstruct as WebVTT.
  // This avoids regex fragility with sequence numbers, Windows line endings,
  // BOM characters, and numeric cue text.
  const cues = parseSRT(srtText)

  const lines = ['WEBVTT', '']
  for (const cue of cues) {
    const start = formatVTTTimestamp(cue.startTime)
    const end = formatVTTTimestamp(cue.endTime)
    lines.push(`${start} --> ${end}`)
    lines.push(cue.text)
    lines.push('')
  }

  return lines.join('\n')
}

function formatVTTTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
}

// ---------------------------------------------------------------------------
// Format detection and validation
// ---------------------------------------------------------------------------

export function detectCaptionFormat(filename: string): 'srt' | 'vtt' | null {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'srt') return 'srt'
  if (ext === 'vtt') return 'vtt'
  return null
}

export function validateCaptionFile(
  text: string,
  format: 'srt' | 'vtt'
): { valid: boolean; error?: string } {
  if (!text || !text.trim()) {
    return { valid: false, error: 'Caption file is empty' }
  }

  const cues = format === 'srt' ? parseSRT(text) : parseVTT(text)

  if (cues.length === 0) {
    return {
      valid: false,
      error: `Invalid caption file: could not parse ${format.toUpperCase()} format`,
    }
  }

  return { valid: true }
}

// ---------------------------------------------------------------------------
// Blob URL creation
// ---------------------------------------------------------------------------

export function createCaptionBlobUrl(content: string, format: 'srt' | 'vtt'): string {
  const vttContent = format === 'srt' ? srtToWebVTT(content) : content
  const blob = new Blob([vttContent], { type: 'text/vtt' })
  return URL.createObjectURL(blob)
}

// ---------------------------------------------------------------------------
// Dexie CRUD helpers
// ---------------------------------------------------------------------------

export async function saveCaptionForVideo(
  courseId: string,
  videoId: string,
  file: File
): Promise<{ captionTrack: CaptionTrack; error: null } | { captionTrack: null; error: string }> {
  const format = detectCaptionFormat(file.name)
  if (!format) {
    return { captionTrack: null, error: 'Unsupported file format. Use .srt or .vtt files' }
  }

  if (file.size > MAX_CAPTION_FILE_SIZE) {
    return { captionTrack: null, error: 'Caption file is too large (max 5MB)' }
  }

  const text = await file.text()
  const validation = validateCaptionFile(text, format)
  if (!validation.valid) {
    return { captionTrack: null, error: validation.error! }
  }

  const record: VideoCaptionRecord = {
    courseId,
    videoId,
    filename: file.name,
    content: text,
    format,
    createdAt: new Date().toISOString(),
  }

  await db.videoCaptions.put(record)

  const blobUrl = createCaptionBlobUrl(text, format)
  return {
    captionTrack: {
      src: blobUrl,
      label: file.name,
      language: 'und', // undetermined — user-loaded file
    },
    error: null,
  }
}

export async function getCaptionForVideo(
  courseId: string,
  videoId: string
): Promise<CaptionTrack | null> {
  const record = await db.videoCaptions.get([courseId, videoId])
  if (!record) return null

  const blobUrl = createCaptionBlobUrl(record.content, record.format)
  return {
    src: blobUrl,
    label: record.filename,
    language: 'und',
  }
}

export async function removeCaptionForVideo(courseId: string, videoId: string): Promise<void> {
  await db.videoCaptions.delete([courseId, videoId])
}
