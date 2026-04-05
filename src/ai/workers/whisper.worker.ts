/**
 * Whisper Worker
 *
 * Transcribes audio using Whisper via Transformers.js.
 * Runs in Web Worker to avoid blocking main thread during inference.
 *
 * Models: Xenova/whisper-tiny.en (English), Xenova/whisper-tiny (multilingual)
 * Backend: WebAssembly (CPU-based, no GPU required)
 */

import { pipeline, env } from '@xenova/transformers'

// Disable local model cache (IndexedDB only)
env.allowLocalModels = false
env.backends.onnx.wasm.numThreads = 1 // CRITICAL: Limit to 1 thread per worker

// ============================================================================
// Types
// ============================================================================

interface TranscribePayload {
  audioData: Float32Array
  sampleRate: number
  lang?: string
  modelSize: 'tiny' | 'base'
}

interface TranscribeResult {
  segments: Array<{ start: number; end: number; text: string }>
  language: string
}

interface ProgressMessage {
  type: 'progress'
  stage: 'downloading-model' | 'loading-model' | 'transcribing'
  percent: number
}

interface WorkerRequest {
  requestId: string
  type: string
  payload: TranscribePayload
}

// ============================================================================
// Pipeline Management
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic pipeline type from @xenova/transformers
let whisperPipeline: any = null
let loadedModelName: string | null = null

function getModelName(modelSize: 'tiny' | 'base', lang?: string): string {
  const size = modelSize || 'tiny'
  // Use English-only model when language is explicitly English (smaller, faster)
  if (size === 'tiny') {
    return lang === 'en' || !lang ? 'Xenova/whisper-tiny.en' : 'Xenova/whisper-tiny'
  }
  return lang === 'en' || !lang ? 'Xenova/whisper-base.en' : 'Xenova/whisper-base'
}

async function initializePipeline(modelSize: 'tiny' | 'base', lang?: string) {
  const modelName = getModelName(modelSize, lang)

  // Re-use existing pipeline if same model
  if (whisperPipeline && loadedModelName === modelName) {
    return whisperPipeline
  }

  console.log('[WhisperWorker] Loading model:', modelName)

  try {
    whisperPipeline = await pipeline('automatic-speech-recognition', modelName, {
      progress_callback: (progress: { status: string; progress?: number; file?: string }) => {
        let stage: ProgressMessage['stage'] = 'loading-model'
        let percent = 0

        if (progress.status === 'download' || progress.status === 'progress') {
          stage = 'downloading-model'
          percent = progress.progress ?? 0
        } else if (progress.status === 'ready') {
          stage = 'loading-model'
          percent = 100
        }

        const msg: ProgressMessage = { type: 'progress', stage, percent }
        self.postMessage(msg)
      },
    })

    loadedModelName = modelName
    console.log('[WhisperWorker] Model loaded successfully')
  } catch (error) {
    console.error('[WhisperWorker] Model load failed:', error)
    throw new Error('Unable to load Whisper model. Check your internet connection.')
  }

  return whisperPipeline
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (e: MessageEvent) => {
  const request = e.data as WorkerRequest
  const { requestId, type, payload } = request

  if (type !== 'transcribe') {
    self.postMessage({
      requestId,
      type: 'error',
      error: `Unknown request type: ${type}`,
    })
    return
  }

  try {
    const { audioData, lang, modelSize } = payload

    if (!audioData || audioData.length === 0) {
      throw new Error('Invalid payload: audioData must be a non-empty Float32Array')
    }

    // Signal transcription start
    const progressMsg: ProgressMessage = { type: 'progress', stage: 'transcribing', percent: 0 }
    self.postMessage(progressMsg)

    const pipe = await initializePipeline(modelSize, lang)

    // Run transcription with chunked long-form support
    const result = await pipe(audioData, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      ...(lang && lang !== 'en' ? { language: lang } : {}),
    })

    // Signal transcription complete
    const doneMsg: ProgressMessage = { type: 'progress', stage: 'transcribing', percent: 100 }
    self.postMessage(doneMsg)

    // Extract segments from result
    const segments: TranscribeResult['segments'] = (result.chunks ?? []).map(
      (chunk: { timestamp: [number, number]; text: string }) => ({
        start: chunk.timestamp[0] ?? 0,
        end: chunk.timestamp[1] ?? 0,
        text: chunk.text ?? '',
      })
    )

    // If no chunks, use the full text as a single segment
    if (segments.length === 0 && result.text) {
      segments.push({ start: 0, end: 0, text: result.text })
    }

    const transcribeResult: TranscribeResult = {
      segments,
      language: lang || 'en',
    }

    self.postMessage({
      requestId,
      type: 'success',
      result: transcribeResult,
    })
  } catch (error) {
    console.error('[WhisperWorker] Error:', error)

    self.postMessage({
      requestId,
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// ============================================================================
// Error Handler
// ============================================================================

self.addEventListener('error', event => {
  console.error('[WhisperWorker] Unhandled error:', event)

  // Notify coordinator of crash
  self.postMessage({
    type: 'error',
    error: 'Worker crashed due to memory pressure. Reloading...',
  })

  // Terminate worker (coordinator will respawn on next request)
  self.close()
})

// ============================================================================
// Export for TypeScript
// ============================================================================

export {}
