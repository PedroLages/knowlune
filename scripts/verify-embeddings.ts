/**
 * Quick verification script for real Transformers.js embeddings
 *
 * Verifies:
 * 1. Model downloads successfully (~23MB)
 * 2. Embeddings are generated (384-dim Float32Array)
 * 3. IndexedDB stores embeddings correctly
 */

import { chromium } from '@playwright/test'

async function verifyEmbeddings() {
  console.log('🚀 Starting embedding verification...\n')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  // Capture console messages
  const consoleMessages: string[] = []
  page.on('console', msg => {
    const text = msg.text()
    consoleMessages.push(text)
    if (text.includes('[EmbeddingWorker]')) {
      console.log('📝 Console:', text)
    }
  })

  // Track network requests for model download
  let modelDownloaded = false
  page.on('response', response => {
    const url = response.url()
    if (url.includes('ort-wasm-simd.wasm') || url.includes('all-MiniLM-L6-v2')) {
      console.log('📦 Model file downloaded:', url.split('/').pop())
      modelDownloaded = true
    }
  })

  try {
    // Navigate to a lesson with video
    console.log('📍 Navigating to lesson...')
    await page.goto('http://localhost:5173/courses/001/001-001')
    await page.waitForLoadState('networkidle')

    // Wait for notes panel to be available (may need to click a tab)
    console.log('📝 Opening notes panel...')

    // Check if there's a Notes tab to click
    const notesTab = page.locator('[role="tab"]', { hasText: 'Notes' })
    // eslint-disable-next-line error-handling/no-silent-catch -- CLI script logs errors to console
    const isTabVisible = await notesTab.isVisible().catch(() => false)
    if (isTabVisible) {
      console.log('   Clicking Notes tab...')
      await notesTab.click()
      await page.waitForTimeout(500)
    }

    // Create a test note
    console.log('✍️  Creating test note...')

    // Wait for NoteEditor to be present
    await page.waitForSelector('[data-testid="note-editor"]', { timeout: 10000 })

    // Find the TipTap editor within NoteEditor
    const editor = page.locator('[data-testid="note-editor"] [contenteditable="true"]').first()
    await editor.waitFor({ state: 'visible', timeout: 5000 })
    await editor.click()
    await editor.fill('This is a test note to verify Transformers.js embeddings are working correctly.')

    console.log('   Note content entered successfully')

    // Wait for embedding generation (may take 2-5 seconds for first note)
    console.log('⏳ Waiting for embedding generation (this may take a few seconds)...')
    await page.waitForTimeout(8000) // Allow time for model download + embedding generation

    // Check IndexedDB for embeddings
    console.log('🔍 Checking IndexedDB for embeddings...')
    const embeddingData = await page.evaluate(async () => {
      const dbName = 'levelup-db'
      const storeName = 'embeddings'

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName)

        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const getAll = store.getAll()

          getAll.onsuccess = () => {
            const embeddings = getAll.result
            if (embeddings.length === 0) {
              resolve({ found: false, count: 0 })
              return
            }

            const latest = embeddings[embeddings.length - 1]
            resolve({
              found: true,
              count: embeddings.length,
              dimensions: latest.embedding?.length || 0,
              isFloat32Array: latest.embedding instanceof Float32Array,
              hasNonZeroValues: latest.embedding && Array.from(latest.embedding).some((v: number) => v !== 0)
            })
          }

          getAll.onerror = () => reject(getAll.error)
        }

        request.onerror = () => reject(request.error)
      })
    })

    // Verify results
    console.log('\n📊 Verification Results:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const modelLoadSuccess = consoleMessages.some(m => m.includes('[EmbeddingWorker] Model loaded successfully'))
    const modelLoadStarted = consoleMessages.some(m => m.includes('[EmbeddingWorker] Loading model'))

    console.log('✅ Model download initiated:', modelLoadStarted ? 'YES' : 'NO')
    console.log('✅ Model loaded successfully:', modelLoadSuccess ? 'YES' : 'NO')
    console.log('✅ Model file downloaded:', modelDownloaded ? 'YES' : 'NO')
    console.log('✅ Embeddings in IndexedDB:', embeddingData.found ? `YES (${embeddingData.count} total)` : 'NO')

    if (embeddingData.found) {
      console.log('✅ Vector dimensions:', embeddingData.dimensions === 384 ? '384 ✓' : `${embeddingData.dimensions} ✗`)
      console.log('✅ Is Float32Array:', embeddingData.isFloat32Array ? 'YES' : 'NO')
      console.log('✅ Has non-zero values:', embeddingData.hasNonZeroValues ? 'YES' : 'NO')
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Final verdict
    const allChecksPass = modelLoadSuccess &&
                          embeddingData.found &&
                          embeddingData.dimensions === 384 &&
                          embeddingData.isFloat32Array &&
                          embeddingData.hasNonZeroValues

    if (allChecksPass) {
      console.log('\n🎉 SUCCESS! Real Transformers.js embeddings are working correctly.')
      console.log('\nPhase 2 complete ✅')
    } else {
      console.log('\n❌ VERIFICATION FAILED - Check the issues above.')
      console.log('\nDebugging tips:')
      console.log('- Check browser console for errors')
      console.log('- Verify internet connection (model downloads from HuggingFace)')
      console.log('- Check IndexedDB manually in DevTools')
    }

  // eslint-disable-next-line error-handling/no-silent-catch -- CLI script logs errors to console
  } catch (error) {
    console.error('\n❌ Error during verification:', error)
  } finally {
    console.log('\n🔄 Closing browser in 5 seconds...')
    await page.waitForTimeout(5000)
    await browser.close()
  }
}

// Run verification
// eslint-disable-next-line error-handling/no-silent-catch -- CLI script logs errors to console
verifyEmbeddings().catch(console.error)
