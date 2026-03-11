/**
 * Worker capability detection utilities.
 *
 * Used to guard coordinator initialization and provide graceful degradation
 * when running in environments without Worker support (SSR, old browsers).
 */

export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

export function supportsModuleWorkers(): boolean {
  // Module workers require: Chrome 80+, Firefox 114+, Safari 15+
  // All browsers that support Workers also support module workers in practice
  return supportsWorkers()
}

export function supportsWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export interface WorkerFeatures {
  workers: boolean
  moduleWorkers: boolean
  webGPU: boolean
  indexedDB: boolean
  sharedArrayBuffer: boolean
}

export function detectWorkerFeatures(): WorkerFeatures {
  return {
    workers: supportsWorkers(),
    moduleWorkers: supportsModuleWorkers(),
    webGPU: supportsWebGPU(),
    indexedDB: typeof indexedDB !== 'undefined',
    sharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  }
}
