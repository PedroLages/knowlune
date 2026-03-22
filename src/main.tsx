import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/index.css'
import { applyOllamaCSP } from '@/lib/aiConfiguration'

// Apply Ollama CSP before first render so direct-connection requests are allowed immediately
// Re-applied each session since meta tag changes are not persisted to index.html
;(() => {
  try {
    const stored = localStorage.getItem('ai-configuration')
    if (stored) {
      const config = JSON.parse(stored) as { provider?: string; ollamaBaseUrl?: string }
      if (config.provider === 'ollama' && config.ollamaBaseUrl) {
        applyOllamaCSP(config.ollamaBaseUrl)
      }
    }
  } catch (error) {
    console.warn('[CSP] Failed to apply Ollama CSP on startup:', error)
  }
})()

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
    { seedCoursesIfEmpty },
    { useCourseStore },
  ] = await Promise.all([
    import('@/db'),
    import('@/lib/bookmarks'),
    import('@/lib/noteSearch'),
    import('@/db/seedCourses'),
    import('@/stores/useCourseStore'),
  ])

  // Fire-and-forget: migrate any legacy localStorage bookmarks to IndexedDB
  migrateBookmarksFromLocalStorage()

  // Initialize Dexie (triggers v16 upgrade/migration if needed), then seed + build search index
  db.open()
    .then(async () => {
      // Seed courses from static data on first launch
      await seedCoursesIfEmpty()
      // Load courses into Zustand store
      await useCourseStore.getState().loadCourses()
      // Build course/lesson lookup maps for search enrichment
      buildCourseLookup(useCourseStore.getState().courses)

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
