/**
 * Browser Whisper Provider
 *
 * In-browser transcription using @xenova/transformers (Whisper WASM).
 * Zero configuration, free, runs entirely client-side.
 *
 * Audio is decoded to 16kHz mono Float32Array via Web Audio API
 * before being sent to the Whisper worker for transcription.
 */

import type { WhisperProvider, WhisperTranscription, WhisperProgress } from './types'

export class BrowserWhisperProvider implements WhisperProvider {
  readonly id = 'browser' as const
  readonly name = 'In-Browser (Free)'
  private worker: Worker | null = null
  private modelSize: 'tiny' | 'base'

  constructor(modelSize: 'tiny' | 'base' = 'tiny') {
    this.modelSize = modelSize
  }

  async isAvailable(): Promise<boolean> {
    // Browser provider is always available (WASM support is universal in modern browsers)
    return typeof WebAssembly !== 'undefined'
  }

  async transcribe(
    audio: Blob,
    lang?: string,
    onProgress?: (progress: WhisperProgress) => void
  ): Promise<WhisperTranscription> {
    // 1. Decode audio to Float32Array using Web Audio API
    const audioData = await this.decodeAudio(audio)

    // 2. Spawn worker (lazy, single instance)
    const worker = this.getOrCreateWorker()

    // 3. Send to worker and await result
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID()

      const handler = (e: MessageEvent) => {
        const msg = e.data
        if (msg.requestId !== requestId && msg.type !== 'progress') return

        if (msg.type === 'progress') {
          onProgress?.(msg)
          return
        }

        worker.removeEventListener('message', handler)

        if (msg.type === 'error') {
          reject(new Error(msg.error))
        } else {
          // Convert segments to VTT
          const vtt = this.segmentsToVTT(msg.result.segments)
          resolve({
            vtt,
            language: msg.result.language || lang || 'en',
          })
        }
      }

      worker.addEventListener('message', handler)
      worker.postMessage({
        requestId,
        type: 'transcribe',
        payload: {
          audioData: audioData.audioData,
          sampleRate: audioData.sampleRate,
          lang,
          modelSize: this.modelSize,
        },
      })
    })
  }

  /** Decode audio Blob to mono Float32Array at 16kHz (Whisper's expected format) */
  private async decodeAudio(
    blob: Blob
  ): Promise<{ audioData: Float32Array; sampleRate: number }> {
    const audioContext = new AudioContext({ sampleRate: 16000 })
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

      // Mix to mono
      const numChannels = audioBuffer.numberOfChannels
      const length = audioBuffer.length
      const mono = new Float32Array(length)

      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch)
        for (let i = 0; i < length; i++) {
          mono[i] += channelData[i] / numChannels
        }
      }

      return { audioData: mono, sampleRate: 16000 }
    } finally {
      await audioContext.close()
    }
  }

  /** Convert transcription segments to WebVTT format */
  private segmentsToVTT(
    segments: Array<{ start: number; end: number; text: string }>
  ): string {
    const lines = ['WEBVTT', '']
    for (const seg of segments) {
      lines.push(
        this.formatTimestamp(seg.start) + ' --> ' + this.formatTimestamp(seg.end)
      )
      lines.push(seg.text.trim())
      lines.push('')
    }
    return lines.join('\n')
  }

  /** Format seconds to VTT timestamp (HH:MM:SS.mmm) */
  private formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
  }

  private getOrCreateWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../../ai/workers/whisper.worker.ts', import.meta.url),
        { type: 'module' }
      )
    }
    return this.worker
  }

  /** Terminate the worker (for cleanup) */
  dispose(): void {
    this.worker?.terminate()
    this.worker = null
  }
}
