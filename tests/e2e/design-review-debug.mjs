/**
 * Debug script to investigate 400 errors and page state.
 */
import { chromium } from 'playwright'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text().substring(0, 300))
    }
  })

  page.on('requestfailed', req => {
    console.log('REQUEST FAILED:', req.url().substring(0, 200), '-', req.failure()?.errorText)
  })

  await page.addInitScript(() => {
    sessionStorage.setItem('knowlune-guest', 'true')
    if (!sessionStorage.getItem('knowlune-guest-id')) {
      sessionStorage.setItem('knowlune-guest-id', crypto.randomUUID())
    }
    localStorage.setItem('knowlune-sidebar-v1', 'false')
    localStorage.setItem('knowlune-onboarding-v1', JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true }))
    localStorage.setItem('knowlune-welcome-wizard-v1', JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' }))
  })

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(500)

  // Seed courses
  await page.evaluate(async () => {
    function openDB() { return new Promise((resolve, reject) => { const r = indexedDB.open('ElearningDB'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
    const db = await openDB()
    if (!db.objectStoreNames.contains('importedCourses')) { db.close(); throw new Error('no store') }
    const tx = db.transaction('importedCourses', 'readwrite')
    const store = tx.objectStore('importedCourses')
    const now = new Date()
    for (const c of [
      { id: 'c1', name: 'Course 1', videoCount: 10, pdfCount: 2, totalDuration: 36000, maxResolutionHeight: 1080, totalFileSize: 1e9, status: 'active', tags: ['AI'], category: '', description: '', importedAt: now.toISOString(), authorId: null, youtubeThumbnailUrl: null, source: 'folder' },
      { id: 'c2', name: 'Course 2', videoCount: 5, pdfCount: 1, totalDuration: 18000, maxResolutionHeight: 720, totalFileSize: 5e8, status: 'not-started', tags: [], category: '', description: '', importedAt: new Date(now.getTime() - 86400000).toISOString(), authorId: null, youtubeThumbnailUrl: null, source: 'folder' },
    ]) store.put(c)
    await new Promise((resolve, reject) => { tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => reject(tx.error) })
  })

  await page.goto('http://localhost:5173/courses', { waitUntil: 'networkidle', timeout: 15000 })
  await page.waitForTimeout(2000)

  // Log page state
  const pageState = await page.evaluate(() => {
    return {
      title: document.querySelector('h1')?.textContent ?? '(none)',
      h2s: Array.from(document.querySelectorAll('h2')).map(h => h.textContent),
      controlLabels: Array.from(document.querySelectorAll('span'))
        .filter(s => /^(Filter|Sort|View)$/i.test(s.textContent?.trim() || ''))
        .map(s => s.textContent?.trim()),
      separators: document.querySelectorAll('[role="separator"]').length,
      toggleGroup: document.querySelector('[data-testid="course-view-mode-toggle"]') !== null,
      filterBar: document.querySelector('[data-testid="status-filter-bar"]') !== null,
      errorBoundary: document.querySelector('[data-testid="route-error-boundary"]') !== null,
      bodyPreview: document.body.innerText.substring(0, 800)
    }
  })
  console.log('PAGE STATE:', JSON.stringify(pageState, null, 2))

  // Check separators
  const sepInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="separator"]')).map(el => ({
      tag: el.tagName,
      classes: el.className.slice(0, 100),
      rect: { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height },
      visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
    }))
  })
  console.log('SEPARATORS:', JSON.stringify(sepInfo, null, 2))

  await browser.close()
}

run().catch(err => {
  console.error('FAILED:', err.message)
  process.exit(1)
})
