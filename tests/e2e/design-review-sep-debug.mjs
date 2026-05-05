/**
 * Quick debug for separator detection.
 */
import { chromium } from 'playwright'

async function run() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

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

  const sepDataSlot = await page.evaluate(() => {
    const els = document.querySelectorAll('[data-slot="separator-root"]')
    return Array.from(els).map(el => ({
      tag: el.tagName,
      classes: el.className.slice(0, 120),
      visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
      rect: { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }
    }))
  })
  console.log('SEPARATORS (data-slot):', JSON.stringify(sepDataSlot, null, 2))
  console.log('Count:', sepDataSlot.length)

  await browser.close()
}

run().catch(err => { console.error(err.message); process.exit(1) })
