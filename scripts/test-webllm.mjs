import { chromium } from '@playwright/test'

async function testWebLLM() {
  console.log('Testing WebLLM integration...\n')

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-features=Vulkan,UseSkiaRenderer',
      '--enable-unsafe-webgpu',
    ],
  })

  const context = await browser.newContext({
    permissions: [],
  })

  const page = await context.newPage()

  // Capture console logs
  const logs = []
  page.on('console', msg => {
    logs.push(`${msg.type()}: ${msg.text()}`)
    console.log(`[Browser ${msg.type()}]`, msg.text())
  })

  // Capture errors
  page.on('pageerror', error => {
    console.error('[Browser Error]', error.message)
  })

  try {
    console.log('Navigating to WebLLM test page...')
    await page.goto('http://localhost:5173/webllm-test', {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    // Wait for page to load
    await page.waitForSelector('h1:has-text("WebLLM Integration Test")', {
      timeout: 10000,
    })
    console.log('✓ Page loaded successfully\n')

    // Check WebGPU support
    const webgpuSupported = await page.evaluate(() => {
      return !!navigator.gpu
    })

    console.log('Browser Compatibility:')
    console.log(`  WebGPU Support: ${webgpuSupported ? '✓' : '✗'}`)

    if (!webgpuSupported) {
      console.log('\n⚠️  WebGPU not supported in this browser environment')
      console.log('WebLLM requires WebGPU. This is expected in headless mode.')
      console.log('\nRecommendations:')
      console.log('  1. Test in headed Chrome: chromium.launch({ headless: false })')
      console.log('  2. Use Chrome Canary or Chrome Dev channel')
      console.log('  3. Test on actual hardware (not CI/Docker)')
      await browser.close()
      return {
        status: 'SKIPPED',
        reason: 'WebGPU not supported in headless Chromium',
        recommendation: 'Manual testing required in headed browser',
      }
    }

    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
      }
      return null
    })

    if (initialMemory) {
      console.log(`  Initial Memory: ${initialMemory} MB\n`)
    }

    // Try to load the model
    console.log('Attempting to load model...')
    const loadButton = page.locator('button:has-text("Load Model")')
    await loadButton.click()

    // Wait for either success or error (with long timeout for model download)
    const result = await Promise.race([
      page
        .locator('button:has-text("Model Loaded")')
        .waitFor({ timeout: 120000 })
        .then(() => 'success'),
      page
        .locator('h2:has-text("Error")')
        .waitFor({ timeout: 120000 })
        .then(() => 'error'),
    ])

    if (result === 'error') {
      const errorText = await page.locator('p.text-destructive').textContent()
      console.log(`✗ Model loading failed: ${errorText}\n`)
      await browser.close()
      return {
        status: 'ERROR',
        error: errorText,
      }
    }

    console.log('✓ Model loaded successfully!\n')

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const metricsCard = document.querySelector('h2:has-text("Performance Metrics")')
      if (!metricsCard) return null

      const container = metricsCard.closest('.p-6')
      const loadTime = container.querySelector('strong:has-text("Model Load Time")').nextElementSibling.textContent
      const memory = container.querySelector('strong:has-text("Memory Usage")').nextElementSibling.textContent

      return { loadTime, memory }
    })

    if (metrics) {
      console.log('Performance Metrics:')
      console.log(`  Model Load Time: ${metrics.loadTime}`)
      console.log(`  Memory Usage: ${metrics.memory}\n`)
    }

    // Test inference
    console.log('Testing inference...')
    const generateButton = page.locator('button:has-text("Generate Response")')
    await generateButton.click()

    // Wait for response with timeout
    await page.waitForSelector('strong:has-text("Response:")', {
      timeout: 60000,
    })

    const inferenceMetrics = await page.evaluate(() => {
      const metricsCard = document.querySelector('h2:has-text("Performance Metrics")')
      if (!metricsCard) return null

      const container = metricsCard.closest('.p-6')
      const firstToken = container.querySelector('strong:has-text("First Token Latency")').nextElementSibling.textContent
      const tokensPerSec = container.querySelector('strong:has-text("Tokens/Second")').nextElementSibling.textContent

      const response = document.querySelector('strong:has-text("Response:")').nextElementSibling.textContent

      return { firstToken, tokensPerSec, responseLength: response.length }
    })

    console.log('✓ Inference completed successfully!\n')
    console.log('Inference Metrics:')
    console.log(`  First Token Latency: ${inferenceMetrics.firstToken}`)
    console.log(`  Tokens/Second: ${inferenceMetrics.tokensPerSec}`)
    console.log(`  Response Length: ${inferenceMetrics.responseLength} characters\n`)

    await browser.close()

    return {
      status: 'SUCCESS',
      webgpuSupported,
      metrics: {
        ...metrics,
        ...inferenceMetrics,
      },
    }
  } catch (error) {
    // silent-catch-ok: error logged to console in CLI script
    console.error('Test failed:', error.message)
    await browser.close()
    return {
      status: 'ERROR',
      error: error.message,
    }
  }
}

// Run the test
// silent-catch-ok: error logged to console in CLI script
testWebLLM()
  .then(result => {
    console.log('\n' + '='.repeat(60))
    console.log('Test Result:', result.status)
    console.log('='.repeat(60))

    if (result.status === 'SKIPPED') {
      console.log('\nWebLLM validation skipped - headless testing not supported')
      console.log('Manual testing required in headed browser with WebGPU')
      process.exit(0)
    } else if (result.status === 'SUCCESS') {
      console.log('\nWebLLM integration validated successfully!')
      process.exit(0)
    } else {
      console.log('\nWebLLM integration test failed')
      process.exit(1)
    }
  })
  .catch(err => {
    console.error('Unexpected error:', err)
    process.exit(1)
  })
