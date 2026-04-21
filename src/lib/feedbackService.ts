/**
 * Feedback service for in-app bug reporting and feedback submission.
 *
 * Submissions route to GitHub Issues on PedroLages/Knowlune via REST API
 * using VITE_GITHUB_FEEDBACK_TOKEN.
 *
 * SECURITY NOTE: VITE_GITHUB_FEEDBACK_TOKEN is bundled into client assets.
 * This is acceptable while PedroLages/Knowlune is a private repo at beta scale,
 * using a fine-grained PAT with `Issues: write` scope only.
 * TODO (before public launch): migrate to a server-side proxy
 * (Cloudflare Worker or Supabase Edge Function) that holds the token server-side.
 */

import * as Sentry from '@sentry/react'
import type { User } from '@supabase/supabase-js'

export type FeedbackMode = 'bug' | 'feedback'

export interface FeedbackContext {
  url: string
  userId?: string
  email?: string
  version: string
  ua: string
  sentryEventId?: string
  timestamp: string
}

export interface BugReportFields {
  mode: 'bug'
  title: string
  description: string
  stepsToReproduce?: string
}

export interface FeedbackFields {
  mode: 'feedback'
  title?: string
  message: string
}

export type FeedbackFormFields = BugReportFields | FeedbackFields

export interface SubmitResult {
  ok: true
}

export interface SubmitError {
  ok: false
  error: string
}

/**
 * Email used as fallback mailto recipient.
 * Defined here (not an env var) — centralises the address for future updates.
 */
export const FEEDBACK_FALLBACK_EMAIL = 'mindsetspheremail@gmail.com'

const GITHUB_API_URL = 'https://api.github.com/repos/PedroLages/Knowlune/issues'
const SUBMIT_TIMEOUT_MS = 10_000

/**
 * Assemble auto-attached context from the current browser environment.
 * Null user is handled gracefully (userId/email omitted).
 */
export function buildFeedbackContext(user: User | null, mode: FeedbackMode): FeedbackContext {
  let sentryEventId: string | undefined
  if (mode === 'bug') {
    try {
      // Guarded: Sentry may not be initialized (VITE_SENTRY_DSN absent)
      const id = Sentry.lastEventId()
      if (id) sentryEventId = id
    } catch {
      // silent-catch-ok: Sentry not initialized — omit sentryEventId gracefully
    }
  }

  const ctx: FeedbackContext = {
    url: window.location.href,
    version: __APP_VERSION__,
    ua: navigator.userAgent,
    timestamp: new Date().toISOString(),
  }

  if (user?.id) ctx.userId = user.id
  if (user?.email) ctx.email = user.email
  if (sentryEventId) ctx.sentryEventId = sentryEventId

  return ctx
}

/**
 * Build the GitHub Issue body — user-supplied fields first,
 * then a <details> block with auto-attached context.
 */
export function buildIssueBody(fields: FeedbackFormFields, ctx: FeedbackContext): string {
  const lines: string[] = []

  if (fields.mode === 'bug') {
    lines.push('## Description', '', fields.description, '')
    if (fields.stepsToReproduce?.trim()) {
      lines.push('## Steps to Reproduce', '', fields.stepsToReproduce, '')
    }
  } else {
    if (fields.message) {
      lines.push('## Message', '', fields.message, '')
    }
  }

  // Auto-attached context block
  const ctxLines: string[] = ['| Field | Value |', '|-------|-------|']
  ctxLines.push(`| URL | \`${ctx.url}\` |`)
  ctxLines.push(`| App version | \`${ctx.version}\` |`)
  ctxLines.push(`| Timestamp | \`${ctx.timestamp}\` |`)
  if (ctx.userId) ctxLines.push(`| User ID | \`${ctx.userId}\` |`)
  // Email omitted from issue body to avoid persisting PII; GitHub token attribution is sufficient
  if (ctx.sentryEventId) ctxLines.push(`| Sentry event | \`${ctx.sentryEventId}\` |`)
  ctxLines.push(`| User agent | \`${ctx.ua}\` |`)

  lines.push('<details>')
  lines.push('<summary>Auto-attached context</summary>')
  lines.push('')
  lines.push(...ctxLines)
  lines.push('')
  lines.push('</details>')

  return lines.join('\n')
}

/**
 * Derive the issue title from the user-supplied fields.
 * Centralises title logic used by both buildIssuePayload and useFeedbackSubmit (mailto subject).
 */
export function getIssueTitle(fields: FeedbackFormFields): string {
  return fields.mode === 'bug' ? fields.title : (fields.title?.trim() || 'User feedback')
}

/**
 * Build the issue payload for the GitHub API (title + body + labels).
 */
export function buildIssuePayload(
  fields: FeedbackFormFields,
  ctx: FeedbackContext
): { title: string; body: string; labels: string[] } {
  const title = getIssueTitle(fields)
  const labels =
    fields.mode === 'bug' ? ['bug', 'beta-feedback'] : ['enhancement', 'beta-feedback']

  return {
    title,
    body: buildIssueBody(fields, ctx),
    labels,
  }
}

/**
 * Submit a feedback report to GitHub Issues.
 * Uses a 10-second AbortController timeout.
 * Returns { ok: true } on 201, or { ok: false, error } on failure/timeout.
 */
export async function submitToGitHub(
  payload: { title: string; body: string; labels: string[] },
  token: string
): Promise<SubmitResult | SubmitError> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS)

  try {
    const response = await fetch(GITHUB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        error: `GitHub returned ${response.status}. Please use the copy option below.`,
      }
    }

    return { ok: true }
  } catch (err) {
    const isTimeout =
      err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
    return {
      ok: false,
      error: isTimeout
        ? 'Request timed out after 10 seconds. Please use the copy option below.'
        : 'Could not reach GitHub. Please use the copy option below.',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Build plain-text representation of the report for the fallback copyable textarea.
 */
export function buildFallbackText(fields: FeedbackFormFields, ctx: FeedbackContext): string {
  const lines: string[] = []

  if (fields.mode === 'bug') {
    lines.push(`Title: ${fields.title}`)
    lines.push(`Description: ${fields.description}`)
    if (fields.stepsToReproduce?.trim()) {
      lines.push(`Steps to reproduce: ${fields.stepsToReproduce}`)
    }
  } else {
    if (fields.title?.trim()) lines.push(`Title: ${fields.title}`)
    lines.push(`Message: ${fields.message}`)
  }

  lines.push('')
  lines.push('--- Auto-attached context ---')
  lines.push(`URL: ${ctx.url}`)
  lines.push(`App version: ${ctx.version}`)
  lines.push(`Timestamp: ${ctx.timestamp}`)
  if (ctx.userId) lines.push(`User ID: ${ctx.userId}`)
  if (ctx.email) lines.push(`Email: ${ctx.email}`)
  if (ctx.sentryEventId) lines.push(`Sentry event: ${ctx.sentryEventId}`)
  lines.push(`User agent: ${ctx.ua}`)

  return lines.join('\n')
}

/**
 * Build a mailto: href for the fallback "Open in Mail" link.
 */
export function buildMailtoHref(subject: string, body: string): string {
  return `mailto:${FEEDBACK_FALLBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
