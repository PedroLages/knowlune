import { test, expect } from '@playwright/test'

/**
 * NFR7: Memory usage does not increase by more than 50MB over a 2-hour session.
 *
 * Approximation: Navigate through all routes 10 times and measure heap growth.
 * If heap grows < 5MB over 10 full cycles, extrapolated 2hr growth is within budget.
 */
test.describe('NFR7: Memory stability', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only - CDP required')

  test('heap growth stays under 5MB over 10 navigation cycles', async ({ page }) => {
    const routes = ['/', '/courses', '/my-class', '/reports', '/settings']

    // Seed sidebar state
    await page.addInitScript(() => {
      localStorage.setItem('eduvi-sidebar-v1', 'false')
    })

    // Warm up - navigate each route once
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
    }

    // Force GC and measure baseline
    const client = await page.context().newCDPSession(page)
    await client.send('HeapProfiler.collectGarbage')
    const baseline = await client.send('Runtime.getHeapUsage')
    const baselineBytes = baseline.usedSize

    // Navigate 10 cycles through all routes
    for (let cycle = 0; cycle < 10; cycle++) {
      for (const route of routes) {
        await page.goto(route)
        await page.waitForLoadState('domcontentloaded')
      }
    }

    // Force GC and measure final
    await client.send('HeapProfiler.collectGarbage')
    const finalResult = await client.send('Runtime.getHeapUsage')
    const finalBytes = finalResult.usedSize

    const growthMB = (finalBytes - baselineBytes) / (1024 * 1024)

    console.log(
      `Memory: baseline=${(baselineBytes / 1024 / 1024).toFixed(2)}MB, ` +
        `final=${(finalBytes / 1024 / 1024).toFixed(2)}MB, ` +
        `growth=${growthMB.toFixed(2)}MB`
    )

    // 5MB growth over 50 navigations is reasonable
    expect(growthMB).toBeLessThan(5)
  })
})
