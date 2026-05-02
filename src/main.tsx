import * as Sentry from '@sentry/react'
import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/index.css'

// E2E TEST SUPPORT: Expose test mode control for E2E tests (dev only)
// Tests can call window.__enableBookContentTestMode__() to enable mock EPUB loading
// Gated behind import.meta.env.DEV — Vite tree-shakes this entire block from production builds
if (import.meta.env.DEV && typeof window !== 'undefined') {
  import('./services/BookContentService').then(({ enableTestMode }) => {
    ;(window as any).__enableBookContentTestMode__ = enableTestMode
    // Auto-enable if flag was set before module load
    if ((window as any).__BOOK_CONTENT_TEST_MODE__) {
      enableTestMode()
    }
  })

  // Expose audio player store for E2E test control (mini-player state seeding)
  import('./stores/useAudioPlayerStore').then(({ useAudioPlayerStore }) => {
    ;(window as any).__audioPlayerStore__ = useAudioPlayerStore
  })

  // Expose book store for E2E test control
  import('./stores/useBookStore').then(({ useBookStore }) => {
    ;(window as any).__bookStore__ = useBookStore
  })
}

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
  const [{ db }, { migrateBookmarksFromLocalStorage }, unifiedSearch, { getMergedAuthors }] =
    await Promise.all([
      import('@/db'),
      import('@/lib/bookmarks'),
      import('@/lib/unifiedSearch'),
      import('@/lib/authors'),
    ])

  // Fire-and-forget: migrate any legacy localStorage bookmarks to IndexedDB
  migrateBookmarksFromLocalStorage()

  // Open Dexie, then build the unified search index across all six entity
  // types. Per-entity isolation via Promise.allSettled: if one table throws,
  // the others still index and the palette degrades gracefully.
  db.open()
    .then(async () => {
      const tableReads = await Promise.allSettled([
        db.importedCourses.toArray(),
        db.importedVideos.toArray(),
        db.authors.toArray(),
        db.books.toArray(),
        db.notes.toArray(),
        db.bookHighlights.toArray(),
      ])

      const [coursesR, videosR, authorsR, booksR, notesR, highlightsR] = tableReads

      const courses = coursesR.status === 'fulfilled' ? coursesR.value : []
      const videos = videosR.status === 'fulfilled' ? videosR.value : []
      const storeAuthors = authorsR.status === 'fulfilled' ? authorsR.value : []
      const books = booksR.status === 'fulfilled' ? booksR.value : []
      const notes = notesR.status === 'fulfilled' ? notesR.value : []
      const highlights = highlightsR.status === 'fulfilled' ? highlightsR.value : []

      // Log any individual failures so graceful degradation is observable.
      const labels = ['courses', 'videos', 'authors', 'books', 'notes', 'highlights'] as const
      tableReads.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(`[unified-search] failed to index ${labels[i]}:`, result.reason)
        }
      })

      // Seed course / lesson lookup maps BEFORE indexing notes so the note
      // docs carry their parent course name + lesson title.
      for (const c of courses) unifiedSearch.registerCourseName(c.id, c.name)
      const courseNameById = new Map(courses.map(c => [c.id, c.name]))
      for (const v of videos) {
        unifiedSearch.registerLessonTitle(v.id, v.filename || v.youtubeVideoId || v.id)
      }

      const bookTitleById = new Map(books.map(b => [b.id, b.title]))
      const mergedAuthors = getMergedAuthors(storeAuthors)

      const docs = [
        ...courses.map(c => unifiedSearch.toSearchableCourse(c)),
        ...videos.map(v => unifiedSearch.toSearchableLesson(v, courseNameById.get(v.courseId))),
        ...mergedAuthors.map(a => unifiedSearch.toSearchableAuthor(a)),
        ...books.map(b => unifiedSearch.toSearchableBook(b)),
        ...notes.map(n => unifiedSearch.toSearchableNote(n)),
        ...highlights.map(h => unifiedSearch.toSearchableHighlight(h, bookTitleById.get(h.bookId))),
      ]

      unifiedSearch.initializeUnifiedSearch(docs)
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

// E52-S04: Backfill course embeddings for courses that lack them (deferred — non-critical)
deferInit(() => {
  import('@/ai/courseEmbeddingService').then(({ backfillCourseEmbeddings }) => {
    backfillCourseEmbeddings().catch(err => {
      // silent-catch-ok: backfill is advisory, recommendations fall back to tag-based matching
      console.warn('[CourseEmbedding] Startup backfill failed:', err)
    })
  })
})
