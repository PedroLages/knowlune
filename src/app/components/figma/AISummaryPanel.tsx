/**
 * AI Summary Panel Component
 *
 * Displays AI-generated video summaries with streaming support.
 * Features: Generate button, real-time streaming, collapse/expand, error handling
 *
 * States:
 * - idle: Initial state with Generate button
 * - generating: Streaming summary in progress
 * - completed: Summary ready with collapse/expand controls
 * - error: Error message with retry button
 */

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { Sparkles, Loader2, AlertCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { AIUnavailableBadge } from './AIUnavailableBadge'
import {
  getAIConfiguration,
  getDecryptedApiKey,
  isFeatureEnabled,
  isAIAvailable,
} from '@/lib/aiConfiguration'
import { fetchAndParseTranscript, generateVideoSummary } from '@/lib/aiSummary'
import { trackAIUsage } from '@/lib/aiEventTracking'

type PanelState = 'idle' | 'generating' | 'completed' | 'error'

interface AISummaryPanelProps {
  /** URL to VTT transcript file */
  transcriptSrc: string
}

export function AISummaryPanel({ transcriptSrc }: AISummaryPanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [summaryText, setSummaryText] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [wordCount, setWordCount] = useState(0)

  // AbortController ref for cancelling in-flight requests on unmount or re-invocation
  const abortControllerRef = useRef<AbortController | null>(null)

  // Check AI availability on mount and configuration changes
  const [aiAvailable, setAiAvailable] = useState(isAIAvailable)
  const [consentEnabled, setConsentEnabled] = useState(() => isFeatureEnabled('videoSummary'))

  useEffect(() => {
    function checkConfiguration() {
      setAiAvailable(isAIAvailable())
      setConsentEnabled(isFeatureEnabled('videoSummary'))
    }

    checkConfiguration()

    window.addEventListener('ai-configuration-updated', checkConfiguration)
    return () => {
      window.removeEventListener('ai-configuration-updated', checkConfiguration)
    }
  }, [])

  // Cancel in-flight request on component unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  async function handleGenerate() {
    if (!aiAvailable || !consentEnabled) return

    // Cancel any existing in-flight request (handles rapid re-invocation)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new AbortController for this request
    const controller = new AbortController()
    abortControllerRef.current = controller

    setState('generating')
    setSummaryText('')
    setErrorMessage(undefined)
    setWordCount(0)

    const startTime = Date.now()

    try {
      // Fetch and parse transcript (with cancellation support)
      const transcript = await fetchAndParseTranscript(transcriptSrc, controller.signal)

      // Get API configuration
      const config = getAIConfiguration()
      const apiKey = await getDecryptedApiKey()

      if (!apiKey) {
        throw new Error('API key not found. Please configure AI provider in Settings.')
      }

      // Stream summary generation with cancellation support
      let fullText = ''
      const generator = generateVideoSummary(transcript, config.provider, apiKey, controller.signal)

      for await (const chunk of generator) {
        fullText += chunk
        setSummaryText(fullText)
        // Word count calculated once after streaming completes (avoid O(n*k) recalculation on every chunk)
      }

      // Display final word count (AC1 target: 100-300 words, prompt-enforced only)
      const finalWordCount = fullText.split(/\s+/).filter(w => w.length > 0).length
      setWordCount(finalWordCount)

      setState('completed')

      trackAIUsage('summary', { durationMs: Date.now() - startTime }).catch(() => {
        // silent-catch-ok — non-critical analytics tracking
      })
    } catch (error) {
      // Don't show error if request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      console.error('Failed to generate video summary:', error)
      trackAIUsage('summary', {
        status: 'error',
        durationMs: Date.now() - startTime,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
      }).catch(() => {
        // silent-catch-ok — non-critical analytics tracking
      })

      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage('Failed to generate summary. Please try again.')
      }

      setState('error')
    }
  }

  // Idle state: Show generate button
  if (state === 'idle') {
    if (!aiAvailable) {
      return (
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            AI video summaries require an active AI provider connection.
          </p>
          <AIUnavailableBadge />
        </div>
      )
    }

    if (!consentEnabled) {
      return (
        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            Video summary generation is disabled in your AI settings. Enable it in Settings to use
            this feature.
          </p>
        </div>
      )
    }

    return (
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Generate an AI-powered summary of this video's content to quickly understand key concepts
          and main takeaways.
        </p>
        <Button
          onClick={handleGenerate}
          variant="brand"
          className="gap-2"
          data-testid="generate-summary-button"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Generate Summary
        </Button>
      </div>
    )
  }

  // Generating state: Show loading and streaming text
  if (state === 'generating') {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" />
          Generating summary...
        </div>
        {summaryText && (
          <div
            className="text-sm leading-relaxed text-foreground"
            data-testid="summary-text"
            aria-live="polite"
            aria-busy="true"
          >
            {summaryText}
          </div>
        )}
      </div>
    )
  }

  // Error state: Show error message with retry
  if (state === 'error') {
    return (
      <div className="p-4 space-y-3">
        <div
          className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive"
          role="alert"
          data-testid="summary-error"
        >
          <AlertCircle className="size-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm">{errorMessage}</p>
        </div>
        <Button
          onClick={handleGenerate}
          variant="outline"
          className="gap-2"
          data-testid="retry-summary-button"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Retry
        </Button>
      </div>
    )
  }

  // Completed state: Show collapsible summary
  return (
    <Collapsible open={!isCollapsed} onOpenChange={open => setIsCollapsed(!open)}>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">AI Summary</h3>
            <Badge
              className="bg-brand-soft text-brand-soft-foreground"
              data-testid="summary-word-count"
            >
              {wordCount} words
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleGenerate()}
              variant="ghost"
              size="sm"
              className="gap-1.5"
              data-testid="regenerate-summary-button"
            >
              <Sparkles className="size-3" aria-hidden="true" />
              Regenerate
            </Button>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                aria-label={isCollapsed ? 'Expand summary' : 'Collapse summary'}
                aria-expanded={!isCollapsed}
                data-testid="toggle-summary-button"
              >
                {isCollapsed ? (
                  <>
                    <ChevronUp className="size-4" aria-hidden="true" />
                    Expand
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" aria-hidden="true" />
                    Collapse
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div
            className="text-sm leading-relaxed text-foreground"
            data-testid="summary-text"
            aria-live="off"
          >
            {summaryText}
          </div>
        </CollapsibleContent>

        {/* Collapsed minimal bar */}
        {isCollapsed && (
          <div className="text-xs text-muted-foreground" data-testid="summary-collapsed-message">
            Summary collapsed — click Expand to view
          </div>
        )}
      </div>
    </Collapsible>
  )
}
