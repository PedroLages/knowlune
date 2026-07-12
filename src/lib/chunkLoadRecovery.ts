const CHUNK_RELOAD_KEY = 'knowlune:chunk-reload-attempted'

const CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'expected a javascript-or-wasm module script',
]

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.toLowerCase()
  return CHUNK_ERROR_PATTERNS.some(pattern => normalized.includes(pattern))
}

function recoveryKey(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return `${CHUNK_RELOAD_KEY}:${window.location.pathname}${window.location.search}:${message}`
}

/** Clear recovery state between isolated tests or after an explicit update. */
export function resetChunkReloadGuard(): void {
  const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
    sessionStorage.key(index)
  )
  for (const key of keys) {
    if (key?.startsWith(CHUNK_RELOAD_KEY)) sessionStorage.removeItem(key)
  }
}

/**
 * Register Vite's production lazy-chunk recovery before React starts routing.
 * A session guard prevents an unavailable deployment from causing a reload loop.
 */
export function registerChunkLoadRecovery(
  reload: () => void = () => window.location.reload()
): () => void {
  const handlePreloadError = (event: Event) => {
    const preloadEvent = event as Event & { payload?: unknown }
    if (!isChunkLoadError(preloadEvent.payload)) return

    const key = recoveryKey(preloadEvent.payload)
    if (sessionStorage.getItem(key) === 'true') return

    event.preventDefault()
    sessionStorage.setItem(key, 'true')
    reload()
  }

  window.addEventListener('vite:preloadError', handlePreloadError)
  return () => window.removeEventListener('vite:preloadError', handlePreloadError)
}
