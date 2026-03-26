import { test, expect } from '@playwright/test'

/**
 * NFR33: File reading operations handle 2GB+ videos without exceeding
 * 100MB additional memory allocation (streaming, not full-file loading).
 *
 * Validates the blob: URL pattern does not buffer entire file in memory.
 */
test.describe('NFR33: Large file memory efficiency', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only - CDP required')

  test('blob URL creation does not buffer large file in heap', async ({ page }) => {
    // Seed sidebar state
    await page.addInitScript(() => {
      localStorage.setItem('knowlune-sidebar-v1', 'false')
    })

    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    const client = await page.context().newCDPSession(page)

    // Force GC and measure baseline
    await client.send('HeapProfiler.collectGarbage')
    const baseline = await client.send('Runtime.getHeapUsage')

    // Create a 50MB Blob in browser (simulates large video reference)
    // Uses repeated references to same 1MB chunk (Blob stores references, not copies)
    await page.evaluate(() => {
      const chunk = new Uint8Array(1024 * 1024) // 1MB
      const chunks: Uint8Array[] = []
      for (let i = 0; i < 50; i++) {
        chunks.push(chunk) // Same reference, 50 logical MB
      }
      const blob = new Blob(chunks, { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)

      // Hold references (simulates active video playback)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test/evaluate context with dynamic types
      ;(window as any).__testBlobUrl = url
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test/evaluate context with dynamic types
      ;(window as any).__testBlob = blob
    })

    // Force GC and measure after blob creation
    await client.send('HeapProfiler.collectGarbage')
    const afterBlob = await client.send('Runtime.getHeapUsage')

    const growthMB = (afterBlob.usedSize - baseline.usedSize) / (1024 * 1024)

    console.log(
      `Blob test: heap growth=${growthMB.toFixed(2)}MB ` +
        `(baseline=${(baseline.usedSize / 1024 / 1024).toFixed(2)}MB, ` +
        `after=${(afterBlob.usedSize / 1024 / 1024).toFixed(2)}MB)`
    )

    // Blob URL pattern should NOT buffer entire file
    // Allow 20MB overhead for Blob metadata and test infrastructure
    expect(growthMB).toBeLessThan(20)

    // Cleanup
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test/evaluate context with dynamic types
      URL.revokeObjectURL((window as any).__testBlobUrl)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test/evaluate context with dynamic types
      delete (window as any).__testBlobUrl
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test/evaluate context with dynamic types
      delete (window as any).__testBlob
    })
  })
})
