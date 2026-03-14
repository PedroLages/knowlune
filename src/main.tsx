import { createRoot } from 'react-dom/client'
import App from './app/App.tsx'
import './styles/index.css'
import { db } from '@/db'
import { migrateBookmarksFromLocalStorage } from '@/lib/bookmarks'
import { buildCourseLookup, initializeSearchIndex } from '@/lib/noteSearch'
import { allCourses } from '@/data/courses'
import { toast } from 'sonner'
import { initPerformanceMonitoring } from '@/lib/performanceMonitoring'

// Fire-and-forget: migrate any legacy localStorage bookmarks to IndexedDB
migrateBookmarksFromLocalStorage()

// Build course/lesson lookup maps for search enrichment
buildCourseLookup(allCourses)

// Initialize Dexie (triggers v4 upgrade/migration if needed), then build search index
db.open()
  .then(async () => {
    const notes = await db.notes.toArray()
    initializeSearchIndex(notes)
  })
  .catch(error => {
    console.error('[Migration] Failed:', error)
    toast.warning('Data migration incomplete. Some features may be limited.')
  })

createRoot(document.getElementById('root')!).render(<App />)

// Request persistent storage (prevents browser from evicting IndexedDB + cache data)
if (navigator.storage?.persist) {
  navigator.storage.persist()
}

// Start Web Vitals performance monitoring (LCP, FID, CLS, FCP, TTFB, INP)
initPerformanceMonitoring()
