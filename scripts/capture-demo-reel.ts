/**
 * Manual, headed demo-reel capture for the course-import flows.
 *
 * Run with `npm run capture:demo-reel` while the app is available at BASE_URL.
 * Screenshots default to the ignored test-results/demo-reel directory.
 */
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'

const destination = path.resolve(process.env.DEMO_REEL_DIR ?? 'test-results/demo-reel')
const baseUrl = (process.env.BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '')

await mkdir(destination, { recursive: true })

const browser = await chromium.launch({ headless: false })

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })

  await context.addInitScript(() => {
    sessionStorage.setItem('knowlune-guest', 'true')
    sessionStorage.setItem('knowlune-guest-id', crypto.randomUUID())
    localStorage.setItem('knowlune-sidebar-v1', 'false')
    localStorage.setItem(
      'knowlune-onboarding-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true })
    )
    localStorage.setItem(
      'knowlune-welcome-wizard-v1',
      JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' })
    )
  })

  const page = await context.newPage()
  const capture = async (filename: string, description: string) => {
    await page.screenshot({ path: path.join(destination, filename), fullPage: false })
    console.log(`${description} captured`)
  }

  await page.goto(`${baseUrl}/learning-tracks`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await capture('frame-01-learning-tracks.png', 'Frame 1: Learning Tracks page')

  await page.getByRole('button', { name: 'Create Track' }).first().click()
  await page.waitForTimeout(1500)
  await capture('frame-02-create-track.png', 'Frame 2: Create Learning Path dialog')

  await page.getByTestId('import-multiple-action').click()
  await page.waitForTimeout(1500)
  await capture('frame-03-bulk-import-choose.png', 'Frame 3: Bulk import source selection')

  await page.getByTestId('import-multiple-url-btn').click()
  await page.waitForTimeout(1000)
  await capture('frame-04-bulk-import-url-idle.png', 'Frame 4: Bulk import URL entry')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  await page.getByRole('button', { name: 'Import Course' }).click()
  await page.waitForTimeout(1500)
  await capture('frame-05-import-wizard-source-cards.png', 'Frame 5: Import source selection')

  await page.getByRole('button', { name: 'Import from URL' }).click()
  await page.waitForTimeout(1000)
  await capture('frame-06-import-wizard-url-idle.png', 'Frame 6: Import URL entry')

  await page.getByLabel('Server URL').fill('https://example.com/courses')
  await page.waitForTimeout(500)
  await capture('frame-07-import-wizard-url-filled.png', 'Frame 7: Filled import URL')

  console.log(`All frames captured in ${destination}`)
} finally {
  await browser.close()
}
