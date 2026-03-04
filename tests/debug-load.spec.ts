import { test } from '@playwright/test'

test('debug page load with network', async ({ page }) => {
  // Listen for failed requests
  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText)
  })

  // Listen for response errors
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('HTTP ERROR:', response.status(), response.url())
    }
  })

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()))

  // Listen for page errors
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

  // Navigate and wait
  await page.goto('http://localhost:5173')
  await page.waitForTimeout(3000) // Wait 3 seconds

  // Get HTML content
  const html = await page.content()
  console.log('HTML length:', html.length)
  console.log('Has React root:', html.includes('id="root"'))

  // Check if root has content
  const rootContent = await page.locator('#root').innerHTML().catch(() => 'ERROR')
  console.log('Root content length:', rootContent.length)
  console.log('Root has children:', await page.locator('#root > *').count())
})
