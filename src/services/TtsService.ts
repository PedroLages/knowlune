/**
 * TtsService — Web Speech API wrapper for EPUB read-aloud feature.
 *
 * Responsibilities:
 * - Detect TTS availability (window.speechSynthesis)
 * - Speak text with configurable rate via SpeechSynthesisUtterance
 * - Split text into sentence chunks to work around Chrome's 15-second pause bug
 * - Fire onBoundary callbacks for word-by-word highlighting
 * - Fire onEnd callback when all chunks complete
 * - Provide pause(), resume(), stop() controls
 *
 * Chrome ~15s bug: speechSynthesis pauses after ~15 seconds of continuous speech.
 * Workaround: split text into sentence-length utterances queued via onend callbacks.
 *
 * @module TtsService
 */

export interface TtsBoundaryEvent {
  charIndex: number
  charLength: number
  word: string
}

export interface TtsOptions {
  rate?: number // 0.5–2.0, default 1.0
  onBoundary?: (event: TtsBoundaryEvent, chunkOffset: number) => void
  onEnd?: () => void
  onChunkStart?: (chunkIndex: number, totalChunks: number) => void
}

// Sentence boundary regex — splits on ., !, ? followed by whitespace or end
const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z])/

/**
 * Splits text into sentence-level chunks for sequential TTS queuing.
 * This avoids Chrome's 15-second speechSynthesis pause limitation.
 */
function splitIntoChunks(text: string, maxChunkLength = 200): string[] {
  // First split by sentence boundaries
  const sentences = text
    .split(SENTENCE_SPLIT_RE)
    .flatMap(s => {
      // Further split long sentences by comma or semicolon
      if (s.length <= maxChunkLength) return [s]
      return s.split(/(?<=[,;])\s+/)
    })
    .map(s => s.trim())
    .filter(s => s.length > 0)

  // Merge very short chunks to avoid excessive utterance overhead
  const chunks: string[] = []
  let current = ''
  for (const sentence of sentences) {
    if (current.length + sentence.length < maxChunkLength) {
      current = current ? `${current} ${sentence}` : sentence
    } else {
      if (current) chunks.push(current)
      current = sentence
    }
  }
  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [text]
}

class TtsService {
  private chunks: string[] = []
  private chunkIndex = 0
  private options: TtsOptions = {}
  private chunkOffsets: number[] = [] // char offset for each chunk start in full text
  private isPaused = false
  private isActive = false

  /** Returns true if Web Speech API is available in this browser */
  isTtsAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  /** Start speaking the given text with the provided options */
  speak(text: string, options: TtsOptions = {}): void {
    if (!this.isTtsAvailable()) return

    this.stop()
    this.options = options
    this.isPaused = false
    this.isActive = true

    // Build chunks and their character offsets in the original text
    this.chunks = splitIntoChunks(text)
    this.chunkOffsets = []
    let offset = 0
    for (const chunk of this.chunks) {
      this.chunkOffsets.push(offset)
      offset += chunk.length + 1 // +1 for space separator
    }

    this.chunkIndex = 0
    this.speakChunk(this.chunkIndex)
  }

  private speakChunk(index: number): void {
    if (!this.isTtsAvailable() || index >= this.chunks.length || !this.isActive) {
      if (this.isActive) {
        this.isActive = false
        this.options.onEnd?.()
      }
      return
    }

    const text = this.chunks[index]
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = this.options.rate ?? 1.0

    this.options.onChunkStart?.(index, this.chunks.length)

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name === 'word') {
        const word = text.substring(event.charIndex, event.charIndex + (event.charLength ?? 0))
        this.options.onBoundary?.(
          { charIndex: event.charIndex, charLength: event.charLength ?? 0, word },
          this.chunkOffsets[index] ?? 0
        )
      }
    }

    utterance.onend = () => {
      if (!this.isActive) return
      this.chunkIndex = index + 1
      this.speakChunk(this.chunkIndex)
    }

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      // 'interrupted' is expected when stop() is called mid-utterance
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.error('[TtsService] Utterance error:', event.error)
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  /** Pause TTS playback */
  pause(): void {
    if (!this.isTtsAvailable() || !this.isActive) return
    window.speechSynthesis.pause()
    this.isPaused = true
  }

  /** Resume TTS playback after pause */
  resume(): void {
    if (!this.isTtsAvailable() || !this.isActive) return
    window.speechSynthesis.resume()
    this.isPaused = false
  }

  /** Stop TTS and cancel all queued utterances */
  stop(): void {
    if (!this.isTtsAvailable()) return
    this.isActive = false
    this.isPaused = false
    window.speechSynthesis.cancel()
    this.chunks = []
    this.chunkIndex = 0
  }

  get active(): boolean {
    return this.isActive
  }

  get paused(): boolean {
    return this.isPaused
  }
}

/** Singleton TTS service instance */
export const ttsService = new TtsService()
