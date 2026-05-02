import { useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  buildFeedbackContext,
  buildIssuePayload,
  buildFallbackText,
  buildMailtoHref,
  submitToGitHub,
} from '@/lib/feedbackService'
import type { FeedbackFormFields } from '@/lib/feedbackService'

export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error' | 'fallback'

export interface UseFeedbackSubmitReturn {
  submit: (fields: FeedbackFormFields) => Promise<void>
  status: SubmitStatus
  error: string | null
  fallbackText: string
  mailtoHref: string
  reset: () => void
}

export function useFeedbackSubmit(): UseFeedbackSubmitReturn {
  const user = useAuthStore(s => s.user)
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fallbackText, setFallbackText] = useState('')
  const [mailtoHref, setMailtoHref] = useState('')

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setFallbackText('')
    setMailtoHref('')
  }, [])

  const submit = useCallback(
    async (fields: FeedbackFormFields) => {
      const token = import.meta.env.VITE_GITHUB_FEEDBACK_TOKEN

      // Build context now (captures current URL, Sentry event id, etc.)
      const ctx = buildFeedbackContext(user, fields.mode)
      const fallback = buildFallbackText(fields, ctx)
      const title =
        fields.mode === 'bug' ? fields.title : (fields.title?.trim() || 'User feedback')
      const mailto = buildMailtoHref(
        `[Knowlune ${fields.mode === 'bug' ? 'Bug' : 'Feedback'}] ${title}`,
        fallback
      )

      // No token → go directly to fallback (no network call)
      if (!token) {
        setFallbackText(fallback)
        setMailtoHref(mailto)
        setStatus('fallback')
        return
      }

      setStatus('submitting')
      setError(null)

      const payload = buildIssuePayload(fields, ctx)
      const result = await submitToGitHub(payload, token)

      if (result.ok) {
        setStatus('success')
      } else {
        setFallbackText(fallback)
        setMailtoHref(mailto)
        setError(result.error)
        setStatus('error')
      }
    },
    [user]
  )

  return { submit, status, error, fallbackText, mailtoHref, reset }
}
