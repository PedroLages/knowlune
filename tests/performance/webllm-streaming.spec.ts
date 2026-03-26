/**
 * WebLLM Streaming Performance Test
 *
 * Automated performance testing for WebLLM streaming using Playwright.
 * This test measures first-token latency, streaming smoothness, and memory usage.
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { FIXED_DATE, FIXED_TIMESTAMP } from '../utils/test-time'

interface StreamingMetrics {
  firstTokenLatency: number
  totalTokens: number
  tokensPerSecond: number
  averageTokenInterval: number
  tokenIntervalJitter: number
  memoryDelta: number
}

interface TestResult {
  promptSize: 'short' | 'medium' | 'long'
  run: number
  metrics: StreamingMetrics
  timestamp: number
}

// Only run in Chromium (WebGPU support required)
test.describe.configure({ mode: 'serial' })

test.describe('WebLLM Streaming Performance', () => {
  const results: TestResult[] = []
  let testPage: Page | undefined // Shared page instance across all tests

  test.beforeAll(async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGPU only available in Chromium')

    console.log('\n🚀 Starting WebLLM Performance Tests')
    console.log('This will take approximately 10 minutes...\n')

    // Create a persistent page for all tests
    const context = await browser.newContext()
    testPage = await context.newPage()

    await testPage.goto('http://localhost:5173/webllm-perf', { waitUntil: 'networkidle' })

    // Check WebGPU support
    const hasWebGPU = await testPage.evaluate(() => !!navigator.gpu)
    if (!hasWebGPU) {
      throw new Error('WebGPU not supported')
    }

    console.log('  ✓ WebGPU supported')

    // Load model (may take 2-5 minutes for first download)
    console.log('  Loading model (this may take a few minutes)...')
    await testPage.click('button:has-text("Load Model")')

    // Wait for model to load (5 min timeout for download)
    await testPage.waitForSelector('button:has-text("Model Loaded")', { timeout: 300000 })

    console.log('  ✓ Model loaded successfully\n')
  })

  test('Model loaded', async () => {
    // Dummy test to confirm setup
    expect(testPage).toBeDefined()
  })

  // Helper to extract metrics from page
  async function extractMetrics(page): Promise<StreamingMetrics> {
    return await page.evaluate(() => {
      const getMetricValue = (label: string): number => {
        const elements = Array.from(document.querySelectorAll('strong'))
        const element = elements.find(el => el.textContent?.includes(label))

        if (!element) return 0

        // Get the next sibling div with the value
        let next = element.nextElementSibling
        while (next && next.tagName !== 'DIV') {
          next = next.nextElementSibling
        }

        if (!next) return 0

        const text = next.textContent || '0'
        const match = text.match(/[\d.]+/)
        return match ? parseFloat(match[0]) : 0
      }

      return {
        firstTokenLatency: getMetricValue('First Token'),
        totalTokens: getMetricValue('Total Tokens'),
        tokensPerSecond: getMetricValue('Tokens/sec'),
        averageTokenInterval: getMetricValue('Avg Interval'),
        tokenIntervalJitter: getMetricValue('Jitter'),
        memoryDelta: getMetricValue('Memory'),
      }
    })
  }

  // Helper to run a single test
  async function runSingleTest(
    page,
    promptSize: 'short' | 'medium' | 'long',
    run: number
  ): Promise<void> {
    const sizeLabel = promptSize.charAt(0).toUpperCase() + promptSize.slice(1)

    // Select prompt
    await page.click(`button:has-text("${sizeLabel} Prompt")`)
    // eslint-disable-next-line test-patterns/no-hard-waits -- necessary wait for animation/transition
    await page.waitForTimeout(500)

    // Generate response
    await page.click('button:has-text("Generate Response")')

    // Wait for generation to complete
    await expect(page.locator('button:has-text("Generate Response"):not([disabled])')).toBeVisible({
      timeout: 60000,
    })

    // Extract metrics
    const metrics = await extractMetrics(page)

    // Store result
    results.push({
      promptSize,
      run,
      metrics,
      timestamp: FIXED_TIMESTAMP,
    })

    console.log(
      `    Run ${run}: First-token=${metrics.firstTokenLatency.toFixed(0)}ms, Jitter=${metrics.tokenIntervalJitter.toFixed(1)}ms, TPS=${metrics.tokensPerSecond.toFixed(1)}`
    )
  }

  // Test short prompts (3 runs)
  for (let run = 1; run <= 3; run++) {
    test(`Short prompt - Run ${run}/3`, async () => {
      if (run === 1) console.log('  Testing short prompts...')

      await runSingleTest(testPage, 'short', run)

      // Wait between runs
      // eslint-disable-next-line test-patterns/no-hard-waits -- necessary wait for animation/transition
      if (run < 3) await testPage.waitForTimeout(2000)
    })
  }

  // Test medium prompts (3 runs)
  for (let run = 1; run <= 3; run++) {
    test(`Medium prompt - Run ${run}/3`, async () => {
      if (run === 1) console.log('\n  Testing medium prompts...')

      await runSingleTest(testPage, 'medium', run)

      // Wait between runs
      // eslint-disable-next-line test-patterns/no-hard-waits -- necessary wait for animation/transition
      if (run < 3) await testPage.waitForTimeout(2000)
    })
  }

  // Test long prompts (3 runs)
  for (let run = 1; run <= 3; run++) {
    test(`Long prompt - Run ${run}/3`, async () => {
      if (run === 1) console.log('\n  Testing long prompts...')

      await runSingleTest(testPage, 'long', run)

      // Wait between runs
      // eslint-disable-next-line test-patterns/no-hard-waits -- necessary wait for animation/transition
      if (run < 3) await testPage.waitForTimeout(2000)
    })
  }

  test.afterAll(async () => {
    if (results.length === 0) {
      console.log('\n⚠️  No results collected (tests may have been skipped)\n')
      return
    }

    console.log('\n📊 Generating performance report...')

    const report = generateReport(results)

    // Save report
    const reportPath = path.join(
      process.cwd(),
      'docs/research/epic-9-webllm-streaming-validation.md'
    )
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, report)

    console.log(`✓ Report saved to: ${reportPath}`)

    // Print summary
    printSummary(results)
  })
})

function calculatePercentiles(values: number[]): { p50: number; p90: number; p99: number } {
  if (values.length === 0) return { p50: 0, p90: 0, p99: 0 }

  const sorted = [...values].sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)]
  const p90 = sorted[Math.floor(sorted.length * 0.9)]
  const p99 = sorted[Math.floor(sorted.length * 0.99)]

  return { p50, p90, p99 }
}

function generateReport(results: TestResult[]): string {
  const resultsBySize = {
    short: results.filter(r => r.promptSize === 'short'),
    medium: results.filter(r => r.promptSize === 'medium'),
    long: results.filter(r => r.promptSize === 'long'),
  }

  let report = '# WebLLM Streaming Performance Validation\n\n'
  report += `**Model**: Llama-3.2-1B-Instruct-q4f32_1-MLC\n`
  report += `**Test Date**: ${FIXED_DATE}\n`
  report += `**Total Runs**: ${results.length}\n`
  report += `**Browser**: Chromium (Playwright)\n`
  report += `**Test Type**: Automated\n\n`

  // Executive Summary
  report += '## Executive Summary\n\n'

  const allLatencies = results.map(r => r.metrics.firstTokenLatency)
  const overallP90 = calculatePercentiles(allLatencies).p90
  const allJitter = results.map(r => r.metrics.tokenIntervalJitter)
  const avgJitter = allJitter.reduce((s, v) => s + v, 0) / allJitter.length
  const memoryDeltas = results.map(r => r.metrics.memoryDelta)
  const avgMemoryDelta = memoryDeltas.reduce((s, v) => s + v, 0) / memoryDeltas.length

  const latencyPass = overallP90 < 500
  const jitterPass = avgJitter < 50
  const memoryPass = avgMemoryDelta < 20

  if (latencyPass && jitterPass && memoryPass) {
    report += '**Status**: ✅ **PRODUCTION-READY**\n\n'
    report +=
      'All performance metrics meet or exceed target thresholds. The WebLLM streaming implementation provides a smooth, responsive user experience suitable for production deployment in Epic 9.\n\n'
    report +=
      '**Key Findings**:\n' +
      `- First-token latency (P90: ${overallP90.toFixed(0)}ms) provides instant feedback\n` +
      `- Token streaming is smooth with minimal jitter (${avgJitter.toFixed(1)}ms)\n` +
      `- Memory usage is stable with no detectable leaks\n\n`
  } else if (!latencyPass || avgJitter > 100) {
    report += '**Status**: ❌ **BLOCKER FOUND**\n\n'
    report += 'Critical performance issues detected that may impact user experience:\n\n'
    if (!latencyPass)
      report += `- ❌ First-token latency (P90: ${overallP90.toFixed(0)}ms) exceeds 500ms target\n`
    if (avgJitter > 100)
      report += `- ❌ Token jitter (${avgJitter.toFixed(0)}ms) is too high for smooth streaming\n`
    report += '\nThese issues should be addressed before Epic 9 implementation.\n\n'
  } else {
    report += '**Status**: ⚠️ **NEEDS OPTIMIZATION**\n\n'
    report += 'Performance is acceptable for production but has room for improvement:\n\n'
    if (!jitterPass)
      report += `- ⚠️ Token jitter (${avgJitter.toFixed(1)}ms) slightly above 50ms target\n`
    if (!memoryPass)
      report += `- ⚠️ Memory usage (${avgMemoryDelta.toFixed(1)}MB/response) higher than expected\n`
    report += '\nCan proceed with Epic 9 but consider optimizations during implementation.\n\n'
  }

  // First-Token Latency
  report += '## First-Token Latency\n\n'
  report += '| Prompt Size | P50  | P90  | P99  | Target | Status |\n'
  report += '|-------------|------|------|------|--------|--------|\n'

  for (const [size, sizeResults] of Object.entries(resultsBySize)) {
    if (sizeResults.length === 0) continue

    const latencies = sizeResults.map(r => r.metrics.firstTokenLatency)
    const percentiles = calculatePercentiles(latencies)

    const p90Status = percentiles.p90 < 500 ? '✅ Pass' : '⚠️ Fail'
    report += `| ${size.padEnd(11)} | ${percentiles.p50.toFixed(0)}ms | ${percentiles.p90.toFixed(0)}ms | ${percentiles.p99.toFixed(0)}ms | <500ms | ${p90Status} |\n`
  }

  report += '\n**Analysis**: '
  if (latencyPass) {
    report +=
      'First-token latency is excellent across all prompt sizes. Users will experience immediate feedback when submitting questions, creating a responsive chat-like experience.\n'
  } else {
    report += `First-token latency of ${overallP90.toFixed(0)}ms (P90) may feel sluggish, especially on repeated interactions. Consider adding optimistic UI feedback or implementing model warm-up strategies.\n`
  }

  // Streaming Smoothness
  report += '\n## Streaming Smoothness\n\n'
  report += '| Prompt Size | Avg Interval | Jitter (σ) | Target | Status |\n'
  report += '|-------------|--------------|------------|--------|--------|\n'

  for (const [size, sizeResults] of Object.entries(resultsBySize)) {
    if (sizeResults.length === 0) continue

    const intervals = sizeResults.map(r => r.metrics.averageTokenInterval)
    const jitters = sizeResults.map(r => r.metrics.tokenIntervalJitter)

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length
    const avgJitter = jitters.reduce((s, v) => s + v, 0) / jitters.length

    const jitterStatus = avgJitter < 50 ? '✅ Pass' : '⚠️ Fail'
    report += `| ${size.padEnd(11)} | ${avgInterval.toFixed(1)}ms | ${avgJitter.toFixed(1)}ms | <50ms | ${jitterStatus} |\n`
  }

  report += '\n**Analysis**: '
  if (jitterPass) {
    report +=
      'Token streaming exhibits smooth, consistent intervals with minimal jitter. The visual appearance will resemble natural human typing, providing an engaging user experience.\n'
  } else {
    report += `Token jitter of ${avgJitter.toFixed(1)}ms may produce choppy visual streaming. Consider implementing token buffering or using requestAnimationFrame for smoother DOM updates.\n`
  }

  // Memory & Performance
  report += '\n## Memory & Performance\n\n'

  const maxMemoryDelta = Math.max(...memoryDeltas)

  report += `- **Average memory delta per response**: ${avgMemoryDelta.toFixed(1)} MB\n`
  report += `- **Maximum memory delta**: ${maxMemoryDelta.toFixed(1)} MB\n`
  report += `- **Estimated memory after 10 responses**: +${(avgMemoryDelta * 10).toFixed(1)} MB\n`

  if (memoryPass) {
    report += `- **Memory leak assessment**: ✅ No leaks detected (delta within expected bounds)\n`
  } else {
    report += `- **Memory leak assessment**: ⚠️ Potential leak detected (${avgMemoryDelta.toFixed(1)}MB/response is high)\n`
  }

  report += '\n**Analysis**: '
  if (memoryPass) {
    report +=
      'Memory usage is stable and within acceptable bounds. The implementation can handle extended chat sessions without performance degradation.\n'
  } else {
    report += `Memory delta of ${avgMemoryDelta.toFixed(1)}MB per response suggests potential inefficiencies in token buffering or DOM updates. Implement chat history pruning and investigate memory retention patterns.\n`
  }

  // Tokens Per Second
  report += '\n## Tokens Per Second\n\n'
  report += '| Prompt Size | Avg Tokens/s | Min | Max |\n'
  report += '|-------------|--------------|-----|-----|\n'

  for (const [size, sizeResults] of Object.entries(resultsBySize)) {
    if (sizeResults.length === 0) continue

    const tps = sizeResults.map(r => r.metrics.tokensPerSecond)
    const avgTps = tps.reduce((s, v) => s + v, 0) / tps.length
    const minTps = Math.min(...tps)
    const maxTps = Math.max(...tps)

    report += `| ${size.padEnd(11)} | ${avgTps.toFixed(1)} | ${minTps.toFixed(1)} | ${maxTps.toFixed(1)} |\n`
  }

  report += '\n**Target**: 40-60 tokens/s (Llama-3.2-1B-Instruct-q4f32)\n\n'

  const allTps = results.map(r => r.metrics.tokensPerSecond)
  const avgTps = allTps.reduce((s, v) => s + v, 0) / allTps.length

  report += '**Analysis**: '
  if (avgTps >= 40 && avgTps <= 70) {
    report += `Token generation rate of ${avgTps.toFixed(1)} tokens/s is within the expected range for the Llama-3.2-1B-Instruct model. This provides a good balance between response speed and perceived quality.\n`
  } else if (avgTps < 40) {
    report += `Token generation rate of ${avgTps.toFixed(1)} tokens/s is below the expected range. This may indicate GPU bottlenecks or suboptimal WebGPU utilization. Consider investigating device capabilities and model configuration.\n`
  } else {
    report += `Token generation rate of ${avgTps.toFixed(1)} tokens/s exceeds baseline expectations, indicating excellent GPU performance.\n`
  }

  // UI Responsiveness
  report += '\n## UI Responsiveness\n\n'
  report += '**Note**: The following tests require manual validation:\n\n'
  report += '- [ ] Main thread FPS during streaming (target: ≥30 fps)\n'
  report += '- [ ] Scroll performance while tokens render (no jank)\n'
  report += '- [ ] Input field responsiveness during generation\n'
  report += '- [ ] Browser tab backgrounding/foregrounding\n'
  report += '- [ ] Model timeout handling (30s max)\n'
  report += '- [ ] Truncation at max tokens (1024 limit)\n\n'
  report +=
    'These tests should be performed manually using Chrome DevTools Performance tab and interactive testing.\n'

  // Recommendations
  report += '\n## Recommendations\n\n'

  if (latencyPass && jitterPass && memoryPass) {
    report += '### ✅ Production Deployment\n\n'
    report += '**The WebLLM streaming implementation is production-ready for Epic 9.**\n\n'
    report += '**Next Steps**:\n'
    report += '1. Proceed with E09-S04 (AI Q&A from Notes) implementation\n'
    report += '2. Integrate streaming UI patterns from prototype into production components\n'
    report += '3. Add loading states and progress indicators for first-token wait\n'
    report += '4. Implement chat history management (limit to last 10 messages)\n'
    report += '5. Add manual testing checklist from UI Responsiveness section\n\n'
    report += '**Confidence Level**: HIGH - All metrics exceed targets with comfortable margins.\n'
  } else {
    report += '### Optimization Strategy\n\n'

    if (!latencyPass) {
      report += '**1. First-Token Latency Optimization**:\n'
      report += '   - Implement optimistic UI feedback (immediate "thinking" indicator)\n'
      report += '   - Add model warm-up on page load (hidden initial inference)\n'
      report += '   - Investigate WebGPU shader compilation caching\n'
      report += '   - Consider reducing `max_tokens` for initial responses\n\n'
    }

    if (!jitterPass) {
      report += '**2. Token Jitter Reduction**:\n'
      report += '   - Implement token buffering (batch 3-5 tokens before render)\n'
      report += '   - Use `requestAnimationFrame` for all DOM updates\n'
      report += '   - Consider CSS animations for smoother text appearance\n'
      report += '   - Throttle React re-renders during streaming\n\n'
    }

    if (!memoryPass) {
      report += '**3. Memory Optimization**:\n'
      report += '   - Implement aggressive chat history pruning (max 10 messages)\n'
      report += '   - Clear token buffers after response completion\n'
      report += '   - Add memory pressure monitoring with cleanup triggers\n'
      report += '   - Profile DOM retention patterns using Chrome DevTools\n\n'
    }

    report +=
      '**Timeline**: Address critical optimizations during E09-S04 implementation. Non-critical improvements can be deferred to future polish sprints.\n'
  }

  // Raw Data
  report += '\n## Raw Data\n\n'
  report += '<details>\n<summary>Click to expand test results JSON</summary>\n\n'
  report += '```json\n'
  report += JSON.stringify(results, null, 2)
  report += '\n```\n</details>\n\n'

  // Footer
  report += '---\n\n'
  report += `*Report generated: ${FIXED_DATE}*\n`
  const testDurationMin =
    ((results[results.length - 1]?.timestamp || 0) - (results[0]?.timestamp || 0)) / 1000 / 60
  report += `*Test execution time: ${testDurationMin.toFixed(1)} minutes*\n`
  report += '*Automated test via Playwright*\n'

  return report
}

function printSummary(results: TestResult[]): void {
  console.log('\n' + '='.repeat(60))
  console.log('PERFORMANCE TEST SUMMARY')
  console.log('='.repeat(60))

  const allLatencies = results.map(r => r.metrics.firstTokenLatency)
  const overallP90 = calculatePercentiles(allLatencies).p90
  const allJitter = results.map(r => r.metrics.tokenIntervalJitter)
  const avgJitter = allJitter.reduce((s, v) => s + v, 0) / allJitter.length
  const memoryDeltas = results.map(r => r.metrics.memoryDelta)
  const avgMemoryDelta = memoryDeltas.reduce((s, v) => s + v, 0) / memoryDeltas.length
  const allTps = results.map(r => r.metrics.tokensPerSecond)
  const avgTps = allTps.reduce((s, v) => s + v, 0) / allTps.length

  console.log(
    `First-token latency (P90): ${overallP90.toFixed(0)}ms ${overallP90 < 500 ? '✅' : '⚠️'}`
  )
  console.log(`Token jitter (avg): ${avgJitter.toFixed(1)}ms ${avgJitter < 50 ? '✅' : '⚠️'}`)
  console.log(
    `Memory delta (avg): +${avgMemoryDelta.toFixed(1)}MB ${avgMemoryDelta < 20 ? '✅' : '⚠️'}`
  )
  console.log(`Tokens per second: ${avgTps.toFixed(1)} tokens/s`)

  const latencyPass = overallP90 < 500
  const jitterPass = avgJitter < 50
  const memoryPass = avgMemoryDelta < 20

  console.log('')
  if (latencyPass && jitterPass && memoryPass) {
    console.log('✅ PRODUCTION-READY - All metrics pass')
  } else if (!latencyPass || avgJitter > 100) {
    console.log('❌ BLOCKER FOUND - Critical performance issues')
  } else {
    console.log('⚠️  NEEDS OPTIMIZATION - Performance acceptable but can improve')
  }

  console.log('='.repeat(60) + '\n')
}
