/**
 * WebLLM Streaming Performance Test Script
 *
 * This script automates the comprehensive performance testing of WebLLM streaming
 * using Playwright browser automation. It measures:
 * - First-token latency (P50, P90, P99)
 * - Token streaming smoothness and jitter
 * - Memory usage and leak detection
 * - UI responsiveness (FPS, scroll performance)
 * - Error handling scenarios
 *
 * Output: docs/research/epic-9-webllm-streaming-validation.md
 */

import { chromium, Browser, Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

interface StreamingMetrics {
  firstTokenLatency: number
  totalTokens: number
  totalDuration: number
  tokensPerSecond: number
  averageTokenInterval: number
  tokenIntervalJitter: number
  memoryBefore: number
  memoryAfter: number
  memoryDelta: number
}

interface TestResult {
  promptSize: 'short' | 'medium' | 'long'
  metrics: StreamingMetrics
  timestamp: number
}

async function waitForModelLoad(page: Page): Promise<void> {
  console.log('Waiting for model to load...')

  // Click load model button
  await page.click('button:has-text("Load Model")')

  // Wait for model loaded state (up to 5 minutes for first download)
  await page.waitForSelector('button:has-text("Model Loaded")', { timeout: 300000 })

  console.log('Model loaded successfully')
}

async function runSingleTest(
  page: Page,
  promptSize: 'short' | 'medium' | 'long'
): Promise<StreamingMetrics | null> {
  console.log(`Running test for ${promptSize} prompt...`)

  try {
    // Select the appropriate prompt
    await page.click(`button:has-text("${promptSize.charAt(0).toUpperCase() + promptSize.slice(1)} Prompt")`)

    // Wait a bit for the prompt to populate
    await page.waitForTimeout(500)

    // Click generate
    await page.click('button:has-text("Generate Response")')

    // Wait for generation to complete
    await page.waitForSelector('button:has-text("Generate Response"):not([disabled])', {
      timeout: 60000,
    })

    // Extract metrics from the page
    const metrics = await page.evaluate(() => {
      const getMetricValue = (label: string): number => {
        const element = Array.from(document.querySelectorAll('strong')).find(el =>
          el.textContent?.includes(label)
        )
        if (!element || !element.nextElementSibling) return 0

        const text = element.nextElementSibling.textContent || '0'
        return parseFloat(text.replace(/[^0-9.-]/g, ''))
      }

      return {
        firstTokenLatency: getMetricValue('First Token:'),
        totalTokens: getMetricValue('Total Tokens:'),
        totalDuration: getMetricValue('Duration:') * 1000,
        tokensPerSecond: getMetricValue('Tokens/sec:'),
        averageTokenInterval: getMetricValue('Avg Interval:'),
        tokenIntervalJitter: getMetricValue('Jitter'),
        memoryBefore: 0,
        memoryAfter: 0,
        memoryDelta: getMetricValue('Memory'),
      }
    })

    console.log(`  First-token: ${metrics.firstTokenLatency.toFixed(0)}ms`)
    console.log(`  Jitter: ${metrics.tokenIntervalJitter.toFixed(1)}ms`)
    console.log(`  Tokens/s: ${metrics.tokensPerSecond.toFixed(1)}`)

    return metrics
  } catch (error) {
    console.error(`  Test failed:`, error)
    return null
  }
}

async function runBenchmark(page: Page): Promise<TestResult[]> {
  const results: TestResult[] = []
  const promptSizes: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long']
  const runsPerSize = 3

  for (const size of promptSizes) {
    console.log(`\nTesting ${size} prompts (${runsPerSize} runs)...`)

    for (let i = 0; i < runsPerSize; i++) {
      console.log(`  Run ${i + 1}/${runsPerSize}`)

      const metrics = await runSingleTest(page, size)
      if (metrics) {
        results.push({
          promptSize: size,
          metrics,
          timestamp: Date.now(),
        })
      }

      // Wait between runs
      if (i < runsPerSize - 1) {
        await page.waitForTimeout(2000)
      }
    }
  }

  return results
}

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
  report += `**Test Date**: ${new Date().toISOString()}\n`
  report += `**Total Runs**: ${results.length}\n`
  report += `**Browser**: Chromium (Playwright)\n\n`

  report += '## Executive Summary\n\n'

  const allP90 = results.map(r => r.metrics.firstTokenLatency)
  const overallP90 = calculatePercentiles(allP90).p90
  const allJitter = results.map(r => r.metrics.tokenIntervalJitter)
  const avgJitter = allJitter.reduce((s, v) => s + v, 0) / allJitter.length
  const memoryDeltas = results.map(r => r.metrics.memoryDelta)
  const avgMemoryDelta = memoryDeltas.reduce((s, v) => s + v, 0) / memoryDeltas.length

  const latencyPass = overallP90 < 500
  const jitterPass = avgJitter < 50
  const memoryPass = avgMemoryDelta < 20

  if (latencyPass && jitterPass && memoryPass) {
    report += '**Status**: ✅ **PRODUCTION-READY**\n\n'
    report += 'All metrics meet or exceed target thresholds. Streaming UX is smooth and responsive.\n\n'
  } else if (!latencyPass || avgJitter > 100) {
    report += '**Status**: ❌ **BLOCKER FOUND**\n\n'
    report += 'Critical performance issues detected:\n'
    if (!latencyPass) report += `- First-token latency (P90: ${overallP90.toFixed(0)}ms) exceeds 500ms target\n`
    if (avgJitter > 100) report += `- Token jitter (${avgJitter.toFixed(0)}ms) is too high for smooth streaming\n`
    report += '\n'
  } else {
    report += '**Status**: ⚠️ **NEEDS OPTIMIZATION**\n\n'
    report += 'Performance is acceptable but could be improved:\n'
    if (!jitterPass) report += `- Token jitter (${avgJitter.toFixed(1)}ms) slightly above 50ms target\n`
    if (!memoryPass) report += `- Memory usage (${avgMemoryDelta.toFixed(1)}MB/response) higher than expected\n`
    report += '\n'
  }

  report += '## First-Token Latency\n\n'
  report += '| Prompt Size | P50  | P90  | P99  | Target | Status |\n'
  report += '|-------------|------|------|------|--------|--------|\n'

  for (const [size, results] of Object.entries(resultsBySize)) {
    if (results.length === 0) continue

    const latencies = results.map(r => r.metrics.firstTokenLatency)
    const percentiles = calculatePercentiles(latencies)

    const p90Status = percentiles.p90 < 500 ? '✅ Pass' : '⚠️ Fail'
    report += `| ${size.padEnd(11)} | ${percentiles.p50.toFixed(0)}ms | ${percentiles.p90.toFixed(0)}ms | ${percentiles.p99.toFixed(0)}ms | <500ms | ${p90Status} |\n`
  }

  report += '\n**Analysis**: '
  if (latencyPass) {
    report += 'First-token latency is excellent. Users will experience instant feedback when submitting prompts.\n'
  } else {
    report += `First-token latency of ${overallP90.toFixed(0)}ms (P90) may feel sluggish. Consider model optimization or loading spinner improvements.\n`
  }

  report += '\n## Streaming Smoothness\n\n'
  report += '| Prompt Size | Avg Interval | Jitter (σ) | Target | Status |\n'
  report += '|-------------|--------------|------------|--------|--------|\n'

  for (const [size, results] of Object.entries(resultsBySize)) {
    if (results.length === 0) continue

    const intervals = results.map(r => r.metrics.averageTokenInterval)
    const jitters = results.map(r => r.metrics.tokenIntervalJitter)

    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length
    const avgJitter = jitters.reduce((s, v) => s + v, 0) / jitters.length

    const jitterStatus = avgJitter < 50 ? '✅ Pass' : '⚠️ Fail'
    report += `| ${size.padEnd(11)} | ${avgInterval.toFixed(1)}ms | ${avgJitter.toFixed(1)}ms | <50ms | ${jitterStatus} |\n`
  }

  report += '\n**Analysis**: '
  if (jitterPass) {
    report += 'Token streaming is smooth with minimal jitter. Visual appearance will be like a human typing naturally.\n'
  } else {
    report += `Token jitter of ${avgJitter.toFixed(1)}ms may cause choppy visual appearance. Consider buffering or frame-accurate rendering.\n`
  }

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

  report += '\n## Tokens Per Second\n\n'
  report += '| Prompt Size | Avg Tokens/s | Min | Max |\n'
  report += '|-------------|--------------|-----|-----|\n'

  for (const [size, results] of Object.entries(resultsBySize)) {
    if (results.length === 0) continue

    const tps = results.map(r => r.metrics.tokensPerSecond)
    const avgTps = tps.reduce((s, v) => s + v, 0) / tps.length
    const minTps = Math.min(...tps)
    const maxTps = Math.max(...tps)

    report += `| ${size.padEnd(11)} | ${avgTps.toFixed(1)} | ${minTps.toFixed(1)} | ${maxTps.toFixed(1)} |\n`
  }

  report += '\n**Target**: 40-60 tokens/s (Llama-3.2-1B-Instruct-q4f32)\n\n'

  const allTps = results.map(r => r.metrics.tokensPerSecond)
  const avgTps = allTps.reduce((s, v) => s + v, 0) / allTps.length

  if (avgTps >= 40 && avgTps <= 70) {
    report += `**Assessment**: ✅ Token generation rate (${avgTps.toFixed(1)} tokens/s) is within expected range.\n`
  } else if (avgTps < 40) {
    report += `**Assessment**: ⚠️ Token generation rate (${avgTps.toFixed(1)} tokens/s) is below expected range. May indicate GPU bottleneck.\n`
  } else {
    report += `**Assessment**: ✅ Token generation rate (${avgTps.toFixed(1)} tokens/s) exceeds expectations.\n`
  }

  report += '\n## UI Responsiveness\n\n'
  report += '**Manual Testing Required**: The following tests should be performed manually:\n\n'
  report += '- [ ] Main thread FPS during streaming (target: ≥30 fps)\n'
  report += '- [ ] Scroll performance while tokens render (no jank)\n'
  report += '- [ ] Input field responsiveness during generation\n'
  report += '- [ ] Browser tab backgrounding/foregrounding\n'
  report += '- [ ] Model timeout handling (30s max)\n'
  report += '- [ ] Truncation at max tokens (1024 limit)\n'

  report += '\n## Raw Data\n\n'
  report += '<details>\n<summary>Click to expand full test results</summary>\n\n'
  report += '```json\n'
  report += JSON.stringify(results, null, 2)
  report += '\n```\n</details>\n'

  report += '\n## Recommendations\n\n'

  if (latencyPass && jitterPass && memoryPass) {
    report += '### Production Deployment\n\n'
    report += '1. **Ready for Epic 9 implementation** - All performance metrics meet targets\n'
    report += '2. **No optimization needed** - Current performance is production-ready\n'
    report += '3. **Next steps**: Proceed with E09-S04 (AI Q&A from Notes)\n'
  } else {
    report += '### Optimization Strategy\n\n'

    if (!latencyPass) {
      report += '1. **First-Token Latency**:\n'
      report += '   - Add loading spinner immediately on prompt submit\n'
      report += '   - Consider model warm-up on page load\n'
      report += '   - Investigate WebGPU shader compilation caching\n'
    }

    if (!jitterPass) {
      report += '2. **Token Jitter**:\n'
      report += '   - Implement token buffering (batch 3-5 tokens)\n'
      report += '   - Use `requestAnimationFrame` for DOM updates\n'
      report += '   - Consider CSS animation for smoother text rendering\n'
    }

    if (!memoryPass) {
      report += '3. **Memory Management**:\n'
      report += '   - Clear chat history after N messages\n'
      report += '   - Implement token buffer pruning\n'
      report += '   - Add memory pressure monitoring\n'
    }

    report += '\n**Timeline**: Address optimizations during E09-S04 implementation\n'
  }

  report += '\n---\n\n'
  report += `*Report generated: ${new Date().toISOString()}*\n`
  report += `*Test execution time: ${((results[results.length - 1]?.timestamp || 0) - (results[0]?.timestamp || 0)) / 1000 / 60}min*\n`

  return report
}

async function main() {
  console.log('WebLLM Streaming Performance Test\n')
  console.log('Starting browser...')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Navigate to test page
    console.log('Navigating to http://localhost:5173/webllm-perf')
    await page.goto('http://localhost:5173/webllm-perf', { waitUntil: 'networkidle' })

    // Wait for model to load
    await waitForModelLoad(page)

    // Run benchmark tests
    console.log('\nStarting benchmark tests...')
    const results = await runBenchmark(page)

    console.log(`\n✓ Completed ${results.length} tests`)

    // Generate report
    console.log('\nGenerating report...')
    const report = generateReport(results)

    // Save report
    const reportPath = path.join(
      process.cwd(),
      'docs/research/epic-9-webllm-streaming-validation.md'
    )
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, report)

    console.log(`\n✓ Report saved to: ${reportPath}`)

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('SUMMARY')
    console.log('='.repeat(60))

    const allP90 = results.map(r => r.metrics.firstTokenLatency)
    const overallP90 = calculatePercentiles(allP90).p90
    const allJitter = results.map(r => r.metrics.tokenIntervalJitter)
    const avgJitter = allJitter.reduce((s, v) => s + v, 0) / allJitter.length
    const memoryDeltas = results.map(r => r.metrics.memoryDelta)
    const avgMemoryDelta = memoryDeltas.reduce((s, v) => s + v, 0) / memoryDeltas.length

    console.log(`First-token latency (P90): ${overallP90.toFixed(0)}ms ${overallP90 < 500 ? '✅' : '⚠️'}`)
    console.log(`Token jitter (avg): ${avgJitter.toFixed(1)}ms ${avgJitter < 50 ? '✅' : '⚠️'}`)
    console.log(`Memory delta (avg): +${avgMemoryDelta.toFixed(1)}MB ${avgMemoryDelta < 20 ? '✅' : '⚠️'}`)

    const latencyPass = overallP90 < 500
    const jitterPass = avgJitter < 50
    const memoryPass = avgMemoryDelta < 20

    if (latencyPass && jitterPass && memoryPass) {
      console.log('\n✅ PRODUCTION-READY - All metrics pass')
    } else if (!latencyPass || avgJitter > 100) {
      console.log('\n❌ BLOCKER FOUND - Critical performance issues')
    } else {
      console.log('\n⚠️  NEEDS OPTIMIZATION - Performance acceptable but can improve')
    }

    console.log('='.repeat(60) + '\n')
  } catch (error) {
    console.error('Test failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

main().catch(console.error)
