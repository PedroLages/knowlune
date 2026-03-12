export function supportsWorkers(): boolean {
  return typeof Worker !== 'undefined'
}

export function detectWorkerFeatures(): { workers: boolean; sharedWorkers: boolean } {
  return {
    workers: typeof Worker !== 'undefined',
    sharedWorkers: typeof SharedWorker !== 'undefined',
  }
}
