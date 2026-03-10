import { useEffect, useRef, useState } from 'react'
import * as webllm from '@mlc-ai/web-llm'
import { Button } from '@/app/components/ui/button'
import { Card } from '@/app/components/ui/card'
import { Textarea } from '@/app/components/ui/textarea'

interface PerformanceMetrics {
  modelLoadTime: number
  firstTokenLatency: number
  tokensPerSecond: number
  memoryUsage: number
}

export default function WebLLMTest() {
  const [engine, setEngine] = useState<webllm.MLCEngineInterface | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState('')
  const [prompt, setPrompt] = useState('Explain what machine learning is in 2 sentences.')
  const [response, setResponse] = useState('')
  const [generating, setGenerating] = useState(false)
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadStartTime = useRef<number>(0)
  const inferenceStartTime = useRef<number>(0)
  const firstTokenTime = useRef<number>(0)
  const tokenCount = useRef<number>(0)

  // Initialize WebLLM engine
  const initializeEngine = async () => {
    try {
      setLoading(true)
      setError(null)
      loadStartTime.current = performance.now()

      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error(
          'WebGPU is not supported in this browser. Please use Chrome/Edge 113+ or Safari 17+'
        )
      }

      // Create engine with progress callback
      // Use q4f32 variant for better compatibility (doesn't require f16)
      const selectedModel = 'Llama-3.2-1B-Instruct-q4f32_1-MLC'

      const newEngine = await webllm.CreateMLCEngine(selectedModel, {
        initProgressCallback: progress => {
          setLoadProgress(progress.text)
          console.log('Load progress:', progress)
        },
      })

      const loadTime = performance.now() - loadStartTime.current

      setEngine(newEngine)
      setMetrics(prev => ({ ...prev!, modelLoadTime: loadTime }))
      setLoadProgress('Model loaded successfully!')

      // Get memory usage estimate
      if (performance.memory) {
        const memoryMB = Math.round((performance.memory as any).usedJSHeapSize / 1024 / 1024)
        setMetrics(prev => ({ ...prev!, memoryUsage: memoryMB }))
      }

      setLoading(false)
    } catch (err) {
      console.error('Failed to initialize WebLLM:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize WebLLM')
      setLoading(false)
    }
  }

  // Generate response
  const generateResponse = async () => {
    if (!engine || !prompt.trim()) return

    try {
      setGenerating(true)
      setResponse('')
      setError(null)
      inferenceStartTime.current = performance.now()
      firstTokenTime.current = 0
      tokenCount.current = 0

      const messages: webllm.ChatCompletionMessageParam[] = [{ role: 'user', content: prompt }]

      const completion = await engine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 256,
        stream: true,
      })

      let fullResponse = ''

      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || ''
        if (delta) {
          // Capture first token time
          if (firstTokenTime.current === 0) {
            firstTokenTime.current = performance.now() - inferenceStartTime.current
          }

          tokenCount.current++
          fullResponse += delta
          setResponse(fullResponse)
        }
      }

      // Calculate final metrics
      const totalTime = performance.now() - inferenceStartTime.current
      const tokensPerSec = (tokenCount.current / totalTime) * 1000

      setMetrics(prev => ({
        ...prev!,
        firstTokenLatency: firstTokenTime.current,
        tokensPerSecond: tokensPerSec,
      }))

      setGenerating(false)
    } catch (err) {
      console.error('Generation failed:', err)
      setError(err instanceof Error ? err.message : 'Generation failed')
      setGenerating(false)
    }
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
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">WebLLM Integration Test</h1>

      {/* Browser Support Check */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Browser Compatibility</h2>
        <div className="space-y-2 text-sm">
          <div>
            <strong>WebGPU Support:</strong>{' '}
            {navigator.gpu ? (
              <span className="text-success">✓ Supported</span>
            ) : (
              <span className="text-destructive">✗ Not Supported</span>
            )}
          </div>
          <div>
            <strong>User Agent:</strong> {navigator.userAgent}
          </div>
          {performance.memory && (
            <div>
              <strong>JS Heap Size:</strong>{' '}
              {Math.round((performance.memory as any).usedJSHeapSize / 1024 / 1024)} MB
            </div>
          )}
        </div>
      </Card>

      {/* Model Loading */}
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Model Loading</h2>
        <div className="space-y-4">
          <div>
            <strong>Model:</strong> Llama-3.2-1B-Instruct (quantized 4-bit)
          </div>
          <Button onClick={initializeEngine} disabled={loading || !!engine} className="w-full">
            {loading ? 'Loading Model...' : engine ? 'Model Loaded' : 'Load Model'}
          </Button>
          {loadProgress && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{loadProgress}</div>
          )}
        </div>
      </Card>

      {/* Inference Test */}
      {engine && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Inference Test</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Prompt</label>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={3}
                disabled={generating}
                className="w-full"
              />
            </div>
            <Button
              onClick={generateResponse}
              disabled={generating || !prompt.trim()}
              className="w-full"
            >
              {generating ? 'Generating...' : 'Generate Response'}
            </Button>
            {response && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <strong className="block mb-2">Response:</strong>
                <div className="whitespace-pre-wrap">{response}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Model Load Time:</strong>
              <div className="text-2xl font-bold text-brand">
                {(metrics.modelLoadTime / 1000).toFixed(2)}s
              </div>
            </div>
            {metrics.firstTokenLatency > 0 && (
              <div>
                <strong>First Token Latency:</strong>
                <div className="text-2xl font-bold text-brand">
                  {metrics.firstTokenLatency.toFixed(0)}ms
                </div>
              </div>
            )}
            {metrics.tokensPerSecond > 0 && (
              <div>
                <strong>Tokens/Second:</strong>
                <div className="text-2xl font-bold text-brand">
                  {metrics.tokensPerSecond.toFixed(1)}
                </div>
              </div>
            )}
            {metrics.memoryUsage > 0 && (
              <div>
                <strong>Memory Usage:</strong>
                <div className="text-2xl font-bold text-brand">{metrics.memoryUsage} MB</div>
              </div>
            )}
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

      {/* Documentation */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Test Notes</h2>
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>Model used: Llama-3.2-1B-Instruct (4-bit quantized, ~1.3GB download)</li>
          <li>Requires WebGPU support (Chrome 113+, Edge 113+, Safari 17+)</li>
          <li>First load downloads model and caches it in browser (IndexedDB)</li>
          <li>Subsequent loads use cached model (instant)</li>
          <li>Memory usage depends on model size and browser implementation</li>
        </ul>
      </Card>
    </div>
  )
}
