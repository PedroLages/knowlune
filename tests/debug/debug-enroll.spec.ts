import { test, expect } from '../support/fixtures'

test('debug enrollment', async ({ page }) => {
  // Capture all console messages
  const messages: string[] = []
  page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', err => messages.push(`[pageerror] ${err.message}`))

  await page.goto('/career-paths')
  await page.waitForLoadState('networkidle')

  const cards = page.getByRole('list', { name: 'Career paths' }).getByRole('listitem')
  await cards.first().locator('a').first().click()
  await page.waitForLoadState('networkidle')

  console.log('=== BEFORE CLICK ===')
  const enrollBtn = await page.getByTestId('enroll-button').isVisible()
  console.log('Enroll button visible:', enrollBtn)

  await page.getByTestId('enroll-button').click()
  await page.waitForTimeout(3000)

  console.log('=== AFTER CLICK ===')
  const leaveBtn = await page.getByRole('button', { name: /Leave path/i }).isVisible()
  console.log('Leave path button visible:', leaveBtn)
  const enrollBtnAfter = await page.getByTestId('enroll-button').isVisible()
  console.log('Enroll button visible after:', enrollBtnAfter)

  console.log('=== CONSOLE MESSAGES ===')
  for (const msg of messages) {
    console.log(msg)
  }
})
