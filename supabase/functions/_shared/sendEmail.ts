// E119-S04: Shared email dispatch helper
//
// Sends transactional emails via a configurable HTTP provider (default: Resend).
// Used by delete-account (deletion-scheduled notification) and retention-tick
// (hard-delete receipt).
//
// Configuration (Supabase Edge Function env vars):
//   EMAIL_PROVIDER_URL  — POST endpoint (default: https://api.resend.com/emails)
//   EMAIL_API_KEY       — Bearer token for the provider API
//   EMAIL_FROM          — Sender address (e.g. "Knowlune <noreply@knowlune.com>")
//
// Design decisions:
//   - Never throws — all errors are caught and returned as { sent: false, error }.
//   - If any required env var is absent, returns { sent: false, skipped: true }
//     with a console.warn. This prevents misconfigured environments from
//     blocking the deletion flow.
//   - Provider is fully swappable via env vars — no code change needed.

export interface SendEmailPayload {
  to: string
  subject: string
  html: string
  text: string
}

export type SendEmailResult =
  | { sent: true }
  | { sent: false; skipped: true }
  | { sent: false; error: string }

/**
 * Send a transactional email via the configured HTTP provider.
 *
 * Always returns a result — never throws. Callers should log the result
 * at console.error level if sent === false and skipped is not true.
 */
export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const providerUrl =
    Deno.env.get('EMAIL_PROVIDER_URL') || 'https://api.resend.com/emails'
  const apiKey = Deno.env.get('EMAIL_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')

  // Graceful skip when credentials are not configured (dev/test environments).
  if (!apiKey || !from) {
    console.warn(
      '[sendEmail] EMAIL_API_KEY or EMAIL_FROM not set — skipping email send. ' +
        'Set these env vars in the Supabase Edge Function environment to enable emails.'
    )
    return { sent: false, skipped: true }
  }

  try {
    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    })

    if (!response.ok) {
      const statusText = await response.text().catch(() => response.statusText)
      console.error(
        `[sendEmail] provider returned ${response.status}: ${statusText}`
      )
      return { sent: false, error: `HTTP ${response.status}: ${statusText}` }
    }

    return { sent: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[sendEmail] fetch failed:', message)
    return { sent: false, error: message }
  }
}
