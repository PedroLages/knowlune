import * as Sentry from '@sentry/react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/index.css'

// Initialize Sentry error reporting (graceful no-op when DSN is not configured)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  })
}

// Render first, initialize data after — improves FCP/LCP by deferring heavy work
createRoot(document.getElementById('root')!).render(<App />)

// Deferred initialization — runs after first paint via requestIdleCallback/setTimeout
const deferInit = (fn: () => void) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn)
  } else {
    setTimeout(fn, 1)
  }
}

deferInit(async () => {
  const [
    { db },
    { migrateBookmarksFromLocalStorage },
    { buildCourseLookup, initializeSearchIndex },
  ] = await Promise.all([import('@/db'), import('@/lib/bookmarks'), import('@/lib/noteSearch')])

  // Fire-and-forget: migrate any legacy localStorage bookmarks to IndexedDB
  migrateBookmarksFromLocalStorage()

  // Initialize Dexie, then build search index
  db.open()
    .then(async () => {
      // Build course/lesson lookup maps for search enrichment (empty — regular courses removed in E89-S01)
      buildCourseLookup([])

      const notes = await db.notes.toArray()
      initializeSearchIndex(notes)
    })
    .catch(async error => {
      console.error('[Migration] Failed:', error)
      const { toast } = await import('sonner')
      toast.warning('Data migration incomplete. Some features may be limited.')
    })
})

// Request persistent storage (prevents browser from evicting IndexedDB + cache data)
if (navigator.storage?.persist) {
  navigator.storage.persist()
}

// Start Web Vitals performance monitoring (deferred — non-critical)
deferInit(() => {
  import('@/lib/performanceMonitoring').then(({ initPerformanceMonitoring }) => {
    initPerformanceMonitoring()
  })
})

// E32-S03: Check IndexedDB storage quota on startup (deferred — non-critical)
deferInit(() => {
  import('@/lib/storageQuotaMonitor').then(({ checkStorageQuota }) => {
    checkStorageQuota().catch(err => {
      // silent-catch-ok: quota check is advisory, never block startup
      console.warn('[StorageQuota] Startup check failed:', err)
    })
  })
})

// E32-S04: Run data pruning on startup (deferred — non-critical, never blocks first paint)
deferInit(() => {
  import('@/lib/dataPruning').then(({ runDataPruning }) => {
    runDataPruning().catch(err => {
      // silent-catch-ok: pruning is advisory, never block startup
      console.warn('[DataPruning] Startup pruning failed:', err)
    })
  })
})

// AC4: Run Ollama health check on startup if configured (deferred — non-critical)
deferInit(() => {
  import('@/lib/ollamaHealthCheck').then(({ runStartupHealthCheck }) => {
    // silent-catch-ok: startup error logged to console
    runStartupHealthCheck().catch(err => {
      console.warn('[Ollama] Startup health check failed:', err)
    })
  })
})
