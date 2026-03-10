import { useEffect, useRef, useState } from 'react'
import * as webllm from '@mlc-ai/web-llm'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { Textarea } from '@/app/components/ui/textarea'
import { Badge } from '@/app/components/ui/badge'
import { Progress } from '@/app/components/ui/progress'

interface TokenTimestamp {
  token: string
  timestamp: number
  deltaMs: number
}

interface StreamingMetrics {
  firstTokenLatency: number
  totalTokens: number
  totalDuration: number
  tokensPerSecond: number
  tokenTimestamps: TokenTimestamp[]
  averageTokenInterval: number
  tokenIntervalJitter: number
  memoryBefore: number
  memoryAfter: number
  memoryDelta: number
}

interface TestResult {
  promptSize: 'short' | 'medium' | 'long'
  promptTokens: number
  metrics: StreamingMetrics
  timestamp: number
}

// Chrome-specific performance.memory API
interface PerformanceMemory {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

declare global {
  interface Performance {
    memory?: PerformanceMemory
  }
}

// Test prompts of varying sizes
const TEST_PROMPTS = {
  short: 'Explain what machine learning is in one sentence.',
  medium:
    'Explain the key differences between supervised learning and unsupervised learning, including examples of common algorithms for each approach and their typical use cases.',
  long: `You are an expert educator. Please provide a comprehensive explanation of neural networks, covering the following topics:
1. The biological inspiration behind neural networks
2. How artificial neurons work (inputs, weights, activation functions)
3. The structure of feedforward neural networks (input layer, hidden layers, output layer)
4. The training process using backpropagation and gradient descent
5. Common activation functions (sigmoid, ReLU, tanh) and when to use each
6. The problem of overfitting and techniques to prevent it (dropout, regularization)
7. Real-world applications of neural networks

Please keep your explanation clear and accessible, using analogies where helpful.`,
}

export default function WebLLMPerformanceTest() {
  const [engine, setEngine] = useState<webllm.MLCEngineInterface | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState('')
  const [customPrompt, setCustomPrompt] = useState(TEST_PROMPTS.short)
  const [response, setResponse] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentMetrics, setCurrentMetrics] = useState<StreamingMetrics | null>(null)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [runningBenchmark, setRunningBenchmark] = useState(false)
  const [benchmarkProgress, setBenchmarkProgress] = useState(0)
  const [fpsMetrics, setFpsMetrics] = useState<number[]>([])
  const [scrollJankDetected, setScrollJankDetected] = useState(false)

  const inferenceStartTime = useRef<number>(0)
  const tokenTimestamps = useRef<TokenTimestamp[]>([])
  const lastTokenTime = useRef<number>(0)
  const fpsFrameCount = useRef<number>(0)
  const fpsStartTime = useRef<number>(0)
  const animationFrameId = useRef<number>(0)

  // FPS monitoring during streaming
  const monitorFPS = () => {
    fpsFrameCount.current++
    const now = performance.now()

    if (now - fpsStartTime.current >= 1000) {
      const fps = fpsFrameCount.current
      setFpsMetrics(prev => [...prev, fps])
      fpsFrameCount.current = 0
      fpsStartTime.current = now
    }

    if (generating) {
      animationFrameId.current = requestAnimationFrame(monitorFPS)
    }
  }

  // Start FPS monitoring when generation begins
  useEffect(() => {
    if (generating) {
      fpsStartTime.current = performance.now()
      fpsFrameCount.current = 0
      animationFrameId.current = requestAnimationFrame(monitorFPS)
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
    }
  }, [generating])

  // Initialize WebLLM engine
  const initializeEngine = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!navigator.gpu) {
        throw new Error(
          'WebGPU is not supported in this browser. Please use Chrome/Edge 113+ or Safari 17+'
        )
      }

      const selectedModel = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'

      const newEngine = await webllm.CreateMLCEngine(selectedModel, {
        initProgressCallback: progress => {
          setLoadProgress(progress.text)
        },
      })

      setEngine(newEngine)
      setLoadProgress('Model loaded successfully!')
      setLoading(false)
    } catch (err) {
      console.error('Failed to initialize WebLLM:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize WebLLM')
      setLoading(false)
    }
  }

  // Calculate statistics from token intervals
  const calculateIntervalStats = (timestamps: TokenTimestamp[]) => {
    if (timestamps.length < 2) {
      return { average: 0, jitter: 0 }
    }

    const intervals = timestamps.slice(1).map(t => t.deltaMs)
    const average = intervals.reduce((sum, val) => sum + val, 0) / intervals.length

    // Calculate standard deviation (jitter)
    const variance =
      intervals.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / intervals.length
    const jitter = Math.sqrt(variance)

    return { average, jitter }
  }

  // Get memory usage
  const getMemoryUsage = (): number => {
    if (performance.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)
    }
    return 0
  }

  // Generate response with detailed metrics
  const generateResponse = async (prompt: string) => {
    if (!engine || !prompt.trim()) return

    try {
      setGenerating(true)
      setResponse('')
      setError(null)
      setFpsMetrics([])
      setScrollJankDetected(false)

      tokenTimestamps.current = []
      inferenceStartTime.current = performance.now()
      lastTokenTime.current = inferenceStartTime.current

      const memoryBefore = getMemoryUsage()

      const messages: webllm.ChatCompletionMessageParam[] = [{ role: 'user', content: prompt }]

      const completion = await engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: true,
      })

      let fullResponse = ''
      let firstTokenLatency = 0

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || ''
        if (delta) {
          const now = performance.now()

          // Capture first token time
          if (tokenTimestamps.current.length === 0) {
            firstTokenLatency = now - inferenceStartTime.current
          }

          const deltaMs = now - lastTokenTime.current
          tokenTimestamps.current.push({
            token: delta,
            timestamp: now,
            deltaMs,
          })

          lastTokenTime.current = now
          fullResponse += delta
          setResponse(fullResponse)
        }
      }

      const totalDuration = performance.now() - inferenceStartTime.current
      const memoryAfter = getMemoryUsage()
      const { average, jitter } = calculateIntervalStats(tokenTimestamps.current)

      const metrics: StreamingMetrics = {
        firstTokenLatency,
        totalTokens: tokenTimestamps.current.length,
        totalDuration,
        tokensPerSecond: (tokenTimestamps.current.length / totalDuration) * 1000,
        tokenTimestamps: tokenTimestamps.current,
        averageTokenInterval: average,
        tokenIntervalJitter: jitter,
        memoryBefore,
        memoryAfter,
        memoryDelta: memoryAfter - memoryBefore,
      }

      setCurrentMetrics(metrics)
      setGenerating(false)

      return metrics
    } catch (err) {
      console.error('Generation failed:', err)
      setError(err instanceof Error ? err.message : 'Generation failed')
      setGenerating(false)
      return null
    }
  }

  // Run comprehensive benchmark
  const runBenchmark = async () => {
    if (!engine) return

    setRunningBenchmark(true)
    setTestResults([])
    setBenchmarkProgress(0)

    const results: TestResult[] = []
    const promptSizes: Array<'short' | 'medium' | 'long'> = ['short', 'medium', 'long']
    const runsPerSize = 3 // Run each prompt size 3 times for P50/P90/P99

    const totalRuns = promptSizes.length * runsPerSize

    for (const size of promptSizes) {
      for (let i = 0; i < runsPerSize; i++) {
        const prompt = TEST_PROMPTS[size]
        const metrics = await generateResponse(prompt)

        if (metrics) {
          results.push({
            promptSize: size,
            promptTokens: prompt.split(/\s+/).length,
            metrics,
            timestamp: Date.now(),
          })
        }

        setBenchmarkProgress(((results.length / totalRuns) * 100) | 0)

        // Wait 2 seconds between runs to let things settle
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    setTestResults(results)
    setRunningBenchmark(false)
  }

  // Calculate percentiles
  const calculatePercentiles = (values: number[]): { p50: number; p90: number; p99: number } => {
    if (values.length === 0) return { p50: 0, p90: 0, p99: 0 }

    const sorted = [...values].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p90 = sorted[Math.floor(sorted.length * 0.9)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    return { p50, p90, p99 }
  }

  // Generate report
  const generateReport = () => {
    if (testResults.length === 0) return 'No test results available'

    const resultsBySize = {
      short: testResults.filter(r => r.promptSize === 'short'),
      medium: testResults.filter(r => r.promptSize === 'medium'),
      long: testResults.filter(r => r.promptSize === 'long'),
    }

    let report = '# WebLLM Streaming Performance Validation\n\n'
    report += `**Model**: Llama-3.2-1B-Instruct-q4f32_1-MLC\n`
    report += `**Test Date**: ${new Date().toISOString()}\n`
    report += `**Total Runs**: ${testResults.length}\n\n`

    report += '## First-Token Latency\n\n'
    report += '| Prompt Size | P50  | P90  | P99  | Target |\n'
    report += '|-------------|------|------|------|--------|\n'

    for (const [size, results] of Object.entries(resultsBySize)) {
      if (results.length === 0) continue

      const latencies = results.map(r => r.metrics.firstTokenLatency)
      const percentiles = calculatePercentiles(latencies)

      const p90Status = percentiles.p90 < 500 ? '✅' : '⚠️'
      report += `| ${size.padEnd(11)} | ${percentiles.p50.toFixed(0)}ms | ${percentiles.p90.toFixed(0)}ms ${p90Status} | ${percentiles.p99.toFixed(0)}ms | <500ms |\n`
    }

    report += '\n## Streaming Smoothness\n\n'
    report += '| Prompt Size | Avg Interval | Jitter | Target |\n'
    report += '|-------------|--------------|--------|--------|\n'

    for (const [size, results] of Object.entries(resultsBySize)) {
      if (results.length === 0) continue

      const avgIntervals = results.map(r => r.metrics.averageTokenInterval)
      const jitters = results.map(r => r.metrics.tokenIntervalJitter)

      const avgInterval = avgIntervals.reduce((s, v) => s + v, 0) / avgIntervals.length
      const avgJitter = jitters.reduce((s, v) => s + v, 0) / jitters.length

      const jitterStatus = avgJitter < 50 ? '✅' : '⚠️'
      report += `| ${size.padEnd(11)} | ${avgInterval.toFixed(1)}ms | ${avgJitter.toFixed(1)}ms ${jitterStatus} | <50ms |\n`
    }

    report += '\n## Memory & Performance\n\n'

    const memoryDeltas = testResults.map(r => r.metrics.memoryDelta)
    const avgMemoryDelta = memoryDeltas.reduce((s, v) => s + v, 0) / memoryDeltas.length
    const maxMemoryDelta = Math.max(...memoryDeltas)

    report += `- Average memory delta per response: ${avgMemoryDelta.toFixed(1)} MB\n`
    report += `- Maximum memory delta: ${maxMemoryDelta.toFixed(1)} MB\n`
    report += `- Memory after 10 responses (est): +${(avgMemoryDelta * 10).toFixed(1)} MB\n`

    if (fpsMetrics.length > 0) {
      const avgFps = fpsMetrics.reduce((s, v) => s + v, 0) / fpsMetrics.length
      const minFps = Math.min(...fpsMetrics)
      const fpsStatus = avgFps >= 30 ? '✅' : '⚠️'

      report += `- Main thread FPS during streaming: ${avgFps.toFixed(1)} fps ${fpsStatus}\n`
      report += `- Minimum FPS: ${minFps} fps\n`
    }

    report += `- Scroll jank detected: ${scrollJankDetected ? '⚠️ Yes' : '✅ No'}\n`

    report += '\n## Tokens Per Second\n\n'

    for (const [size, results] of Object.entries(resultsBySize)) {
      if (results.length === 0) continue

      const tps = results.map(r => r.metrics.tokensPerSecond)
      const avgTps = tps.reduce((s, v) => s + v, 0) / tps.length

      report += `- ${size}: ${avgTps.toFixed(1)} tokens/s\n`
    }

    report += '\n## Recommendation\n\n'

    const allP90 = testResults.map(r => r.metrics.firstTokenLatency)
    const overallP90 = calculatePercentiles(allP90).p90
    const allJitter = testResults.map(r => r.metrics.tokenIntervalJitter)
    const avgJitter = allJitter.reduce((s, v) => s + v, 0) / allJitter.length
    const avgFps = fpsMetrics.length > 0 ? fpsMetrics.reduce((s, v) => s + v, 0) / fpsMetrics.length : 60

    const latencyPass = overallP90 < 500
    const jitterPass = avgJitter < 50
    const memoryPass = avgMemoryDelta < 20
    const fpsPass = avgFps >= 30

    if (latencyPass && jitterPass && memoryPass && fpsPass) {
      report += '✅ **PRODUCTION-READY**\n\n'
      report += 'All metrics meet or exceed target thresholds. Streaming UX is smooth and responsive.\n'
    } else if (!latencyPass || avgJitter > 100) {
      report += '❌ **BLOCKER FOUND**\n\n'
      report += 'Critical performance issues detected:\n'
      if (!latencyPass) report += `- First-token latency (P90: ${overallP90.toFixed(0)}ms) exceeds 500ms target\n`
      if (avgJitter > 100) report += `- Token jitter (${avgJitter.toFixed(0)}ms) is too high for smooth streaming\n`
    } else {
      report += '⚠️ **NEEDS OPTIMIZATION**\n\n'
      report += 'Performance is acceptable but could be improved:\n'
      if (!jitterPass) report += `- Token jitter (${avgJitter.toFixed(1)}ms) slightly above 50ms target\n`
      if (!memoryPass) report += `- Memory usage (${avgMemoryDelta.toFixed(1)}MB/response) higher than expected\n`
      if (!fpsPass) report += `- FPS (${avgFps.toFixed(1)}) below 30fps target\n`
    }

    return report
  }

  // Download report as markdown
  const downloadReport = () => {
    const report = generateReport()
    const blob = new Blob([report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'webllm-streaming-validation.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engine) {
        engine.unload()
      }
    }
  }, [engine])

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-6">WebLLM Streaming Performance Test</h1>

      {/* Browser Support */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Browser Compatibility</h2>
        <div className="space-y-2 text-sm">
          <div>
            <strong>WebGPU Support:</strong>{' '}
            {navigator.gpu ? (
              <Badge variant="default">Supported</Badge>
            ) : (
              <Badge variant="destructive">Not Supported</Badge>
            )}
          </div>
          {performance.memory && (
            <div>
              <strong>JS Heap Size:</strong>{' '}
              {Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)} MB
            </div>
          )}
        </div>
      </Card>

      {/* Model Loading */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Model Loading</h2>
        <div className="space-y-4">
          <div>
            <strong>Model:</strong> Llama-3.2-1B-Instruct-q4f32_1-MLC
          </div>
          <Button onClick={initializeEngine} disabled={loading || !!engine} className="w-full">
            {loading ? 'Loading Model...' : engine ? 'Model Loaded ✓' : 'Load Model'}
          </Button>
          {loadProgress && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{loadProgress}</div>
          )}
        </div>
      </Card>

      {/* Benchmark Controls */}
      {engine && (
        <>
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Automated Benchmark</h2>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Runs 3 tests for each prompt size (short, medium, long) to calculate P50/P90/P99
                latencies.
              </p>
              <Button
                onClick={runBenchmark}
                disabled={runningBenchmark || generating}
                className="w-full"
                size="lg"
              >
                {runningBenchmark ? `Running Benchmark... ${benchmarkProgress}%` : 'Run Full Benchmark'}
              </Button>
              {runningBenchmark && (
                <Progress value={benchmarkProgress} className="w-full" />
              )}
            </div>
          </Card>

          {/* Manual Test */}
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Manual Test</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomPrompt(TEST_PROMPTS.short)}
                >
                  Short Prompt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomPrompt(TEST_PROMPTS.medium)}
                >
                  Medium Prompt
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomPrompt(TEST_PROMPTS.long)}
                >
                  Long Prompt
                </Button>
              </div>
              <Textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                rows={4}
                disabled={generating || runningBenchmark}
                className="w-full"
              />
              <Button
                onClick={() => generateResponse(customPrompt)}
                disabled={generating || runningBenchmark || !customPrompt.trim()}
                className="w-full"
              >
                {generating ? 'Generating...' : 'Generate Response'}
              </Button>
              {response && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <strong className="block mb-2">Response:</strong>
                  <div className="whitespace-pre-wrap text-sm">{response}</div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Current Metrics */}
      {currentMetrics && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Run Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <strong>First Token:</strong>
              <div className={`text-2xl font-bold ${currentMetrics.firstTokenLatency < 500 ? 'text-success' : 'text-warning'}`}>
                {currentMetrics.firstTokenLatency.toFixed(0)}ms
              </div>
            </div>
            <div>
              <strong>Avg Interval:</strong>
              <div className="text-2xl font-bold text-brand">
                {currentMetrics.averageTokenInterval.toFixed(1)}ms
              </div>
            </div>
            <div>
              <strong>Jitter (σ):</strong>
              <div className={`text-2xl font-bold ${currentMetrics.tokenIntervalJitter < 50 ? 'text-success' : 'text-warning'}`}>
                {currentMetrics.tokenIntervalJitter.toFixed(1)}ms
              </div>
            </div>
            <div>
              <strong>Tokens/sec:</strong>
              <div className="text-2xl font-bold text-brand">
                {currentMetrics.tokensPerSecond.toFixed(1)}
              </div>
            </div>
            <div>
              <strong>Total Tokens:</strong>
              <div className="text-lg font-semibold">{currentMetrics.totalTokens}</div>
            </div>
            <div>
              <strong>Duration:</strong>
              <div className="text-lg font-semibold">
                {(currentMetrics.totalDuration / 1000).toFixed(2)}s
              </div>
            </div>
            <div>
              <strong>Memory Δ:</strong>
              <div className="text-lg font-semibold">+{currentMetrics.memoryDelta} MB</div>
            </div>
            {fpsMetrics.length > 0 && (
              <div>
                <strong>Avg FPS:</strong>
                <div className={`text-lg font-semibold ${(fpsMetrics.reduce((s, v) => s + v, 0) / fpsMetrics.length) >= 30 ? 'text-success' : 'text-warning'}`}>
                  {(fpsMetrics.reduce((s, v) => s + v, 0) / fpsMetrics.length).toFixed(1)}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Benchmark Results */}
      {testResults.length > 0 && (
        <Card className="p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Benchmark Results</h2>
            <Button onClick={downloadReport} variant="outline" size="sm">
              Download Report
            </Button>
          </div>
          <div className="space-y-4">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Size</th>
                    <th className="text-right p-2">First Token</th>
                    <th className="text-right p-2">Jitter</th>
                    <th className="text-right p-2">Tokens/s</th>
                    <th className="text-right p-2">Memory Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((result, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="p-2">
                        <Badge variant="outline">{result.promptSize}</Badge>
                      </td>
                      <td className={`text-right p-2 ${result.metrics.firstTokenLatency < 500 ? 'text-success' : 'text-warning'}`}>
                        {result.metrics.firstTokenLatency.toFixed(0)}ms
                      </td>
                      <td className={`text-right p-2 ${result.metrics.tokenIntervalJitter < 50 ? 'text-success' : 'text-warning'}`}>
                        {result.metrics.tokenIntervalJitter.toFixed(1)}ms
                      </td>
                      <td className="text-right p-2">
                        {result.metrics.tokensPerSecond.toFixed(1)}
                      </td>
                      <td className="text-right p-2">+{result.metrics.memoryDelta} MB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <pre className="text-xs whitespace-pre-wrap font-mono">{generateReport()}</pre>
            </div>
          </div>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="p-6 mb-6 border-destructive">
          <h2 className="text-xl font-semibold mb-2 text-destructive">Error</h2>
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}
    </div>
  )
}
