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
import {
  Sparkles,
  Loader2,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Lock,
  FileText,
} from 'lucide-react'
import { AIUnavailableBadge } from './AIUnavailableBadge'
import { isFeatureEnabled, isAIAvailable, resolveFeatureModel } from '@/lib/aiConfiguration'
import { generateVideoSummary } from '@/lib/aiSummary'
import { trackAIUsage } from '@/lib/aiEventTracking'
import { ConsentError } from '@/ai/lib/ConsentError'
import { db } from '@/db/schema'
import { resolveLessonTranscript, type ResolvedLessonTranscript } from '@/lib/lessonTranscript'

type PanelState = 'idle' | 'generating' | 'completed' | 'error' | 'consent-required'

interface AISummaryPanelProps {
  courseId: string
  lessonId: string
  /** Incremented after transcript generation so cached summaries are revalidated. */
  transcriptVersion?: number
  onRequestTranscript?: () => void
}

export function AISummaryPanel({
  courseId,
  lessonId,
  transcriptVersion = 0,
  onRequestTranscript,
}: AISummaryPanelProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [summaryText, setSummaryText] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [wordCount, setWordCount] = useState(0)
  const [transcript, setTranscript] = useState<ResolvedLessonTranscript | null>(null)
  const [isOutdated, setIsOutdated] = useState(false)
  const [transcriptReloadKey, setTranscriptReloadKey] = useState(0)

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

  // Resolve the lesson transcript and restore a matching local summary.
  useEffect(() => {
    let cancelled = false
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setTranscript(null)
    setState('idle')
    setSummaryText('')
    setWordCount(0)
    setErrorMessage(undefined)
    setIsOutdated(false)

    const load = async () => {
      const resolved = await resolveLessonTranscript(courseId, lessonId)
      if (cancelled || controller.signal.aborted) return
      setTranscript(resolved)

      if (resolved.status !== 'ready') return

      try {
        const saved = await db.lessonSummaries.get([courseId, lessonId])
        if (cancelled || controller.signal.aborted) return

        if (saved?.transcriptFingerprint === resolved.fingerprint) {
          setSummaryText(saved.text)
          setWordCount(saved.wordCount)
          setState('completed')
        } else {
          setIsOutdated(Boolean(saved))
        }
      } catch (error) {
        // silent-catch-ok — the failure and retry action are rendered inline
        console.error('[AISummaryPanel] Failed to restore summary:', error)
        setErrorMessage('The saved summary could not be loaded. Please try again.')
        setState('error')
      }
    }

    void load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [courseId, lessonId, transcriptVersion, transcriptReloadKey])

  async function handleGenerate() {
    if (!aiAvailable || !consentEnabled || transcript?.status !== 'ready') return

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
      const resolvedModel = resolveFeatureModel('videoSummary')

      // Stream summary generation with cancellation support
      let fullText = ''
      const generator = generateVideoSummary(transcript.text, controller.signal)

      for await (const chunk of generator) {
        fullText += chunk
        setSummaryText(fullText)
        // Word count calculated once after streaming completes (avoid O(n*k) recalculation on every chunk)
      }

      // Display final word count (AC1 target: 100-300 words, prompt-enforced only)
      const completedText = fullText.trim()
      if (!completedText) throw new Error('The AI provider returned an empty summary.')

      const finalWordCount = completedText.split(/\s+/).filter(w => w.length > 0).length
      const now = new Date().toISOString()
      const existing = await db.lessonSummaries.get([courseId, lessonId])

      await db.lessonSummaries.put({
        courseId,
        lessonId,
        text: completedText,
        wordCount: finalWordCount,
        transcriptFingerprint: transcript.fingerprint,
        provider: resolvedModel.provider,
        model: resolvedModel.model,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })

      if (controller.signal.aborted) return

      setSummaryText(completedText)
      setWordCount(finalWordCount)
      setIsOutdated(false)
      setState('completed')

      trackAIUsage('summary', {
        courseId,
        durationMs: Date.now() - startTime,
      }).catch(() => {
        // silent-catch-ok — non-critical analytics tracking
      })
    } catch (error) {
      // Don't show error if request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      // Consent not granted — show informational state, not an error
      if (error instanceof ConsentError) {
        setState('consent-required')
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
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null
    }
  }

  if (transcript === null) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground" role="status">
        <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />
        Checking transcript…
      </div>
    )
  }

  if (transcript.status !== 'ready') {
    const isProcessing = transcript.status === 'processing'
    const isError = transcript.status === 'error'
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        {isProcessing ? (
          <Loader2
            className="size-9 text-muted-foreground motion-safe:animate-spin"
            aria-hidden="true"
          />
        ) : isError ? (
          <AlertCircle className="size-9 text-destructive" aria-hidden="true" />
        ) : (
          <FileText className="size-9 text-muted-foreground/60" aria-hidden="true" />
        )}
        <div className="space-y-1" role={isError ? 'alert' : 'status'}>
          <p className="text-sm font-medium text-foreground">
            {isProcessing ? 'Transcript generation is in progress' : 'Transcript required'}
          </p>
          <p className="text-sm text-muted-foreground">{transcript.reason}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {isError && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTranscriptReloadKey(key => key + 1)}
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Check Again
            </Button>
          )}
          {onRequestTranscript && (
            <Button variant="brand-outline" size="sm" onClick={onRequestTranscript}>
              {isProcessing ? 'Open Transcript' : 'Generate Transcript First'}
            </Button>
          )}
        </div>
      </div>
    )
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
        {isOutdated && (
          <div
            className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
            role="status"
          >
            The transcript changed since this summary was created. Generate a new summary to keep it
            accurate.
          </div>
        )}
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
          <Loader2 className="size-4 text-brand motion-safe:animate-spin" aria-hidden="true" />
          Generating summary…
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

  // Consent-required state: Show informational message pointing to Settings → Privacy
  if (state === 'consent-required') {
    return (
      <div
        className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border"
        role="status"
        data-testid="summary-consent-required"
      >
        <Lock className="size-4 flex-shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          AI features require your consent. Enable <strong>Video Summary</strong> in{' '}
          <a
            href="/settings?section=privacy"
            className="text-brand underline underline-offset-2 hover:text-brand-hover"
          >
            Settings → Privacy &amp; Consent
          </a>
          .
        </p>
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
