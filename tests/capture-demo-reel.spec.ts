/**
 * Temporary demo reel capture script
 * Captures BulkImportDialog and ImportWizardDialog states
 */
import { chromium } from '@playwright/test'
import * as path from 'path'

const RUN_DIR = '/var/folders/9l/rrj3yt0d6t12c9bd9xj01g_00000gn/T/demo-reel.wWDSGmOWP5'

;(async () => {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })

  // Seed guest session and dismiss onboarding BEFORE any navigation
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

  // Navigate to learning-tracks
  await page.goto('http://localhost:5173/learning-tracks', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // Frame 1: Learning Tracks page (base state)
  await page.screenshot({ path: path.join(RUN_DIR, 'frame-01-learning-tracks.png'), fullPage: false })
  console.log('Frame 1: Learning Tracks page captured')

  // Click "Create Track" button to open CurriculumComposer dialog
  await page.getByRole('button', { name: 'Create Track' }).first().click()
  await page.waitForTimeout(1500)

  // Frame 2: Create Learning Path dialog (verify dialog opened)
  await page.screenshot({ path: path.join(RUN_DIR, 'frame-02-create-track.png'), fullPage: false })
  console.log('Frame 2: Create Learning Path dialog captured')

  // Click "Import multiple" to open BulkImportDialog
  await page.getByTestId('import-multiple-action').click()
  await page.waitForTimeout(1500)

  // Frame 3: BulkImportDialog - choose step (source selection cards)
  await page.screenshot({ path: path.join(RUN_DIR, 'frame-03-bulk-import-choose.png'), fullPage: false })
  console.log('Frame 3: BulkImportDialog choose step captured')

  // Click "Import Multiple from URL" card (data-testid="import-multiple-url-btn")
  await page.getByTestId('import-multiple-url-btn').click()
  await page.waitForTimeout(1000)

  // Frame 4: BulkImportDialog - enter URL step (idle state)
  await page.screenshot({ path: path.join(RUN_DIR, 'frame-04-bulk-import-url-idle.png'), fullPage: false })
  console.log('Frame 4: BulkImportDialog URL entry captured')

  // Close BulkImportDialog
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  // Close Create Learning Path dialog
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // Now click "Import Course" on the main page to open ImportWizardDialog
  await page.getByRole('button', { name: 'Import Course' }).click()
  await page.waitForTimeout(1500)

  // Frame 5: ImportWizardDialog - source selection cards
  await page.screenshot({ path: path.join(RUN_DIR, 'frame-05-import-wizard-source-cards.png'), fullPage: false })
  console.log('Frame 5: ImportWizardDialog source selection captured')

  // Click "Import from URL" card
  await page.getByRole('button', { name: 'Import from URL' }).click()
  await page.waitForTimeout(1000)

  // Frame 6: ImportWizardDialog - URL entry (idle)
  await page.screenshot({ path: path.join(RUN_DIR, 'frame-06-import-wizard-url-idle.png'), fullPage: false })
  console.log('Frame 6: ImportWizardDialog URL entry captured')

  // Type a URL
  await page.getByLabel('Server URL').fill('https://example.com/courses')
  await page.waitForTimeout(500)

  // Frame 7: ImportWizardDialog - URL filled (scan button enabled)
  await page.screenshot({ path: path.join(RUN_DIR, 'frame-07-import-wizard-url-filled.png'), fullPage: false })
  console.log('Frame 7: ImportWizardDialog URL filled captured')

  await browser.close()
  console.log('All frames captured successfully!')
})()
