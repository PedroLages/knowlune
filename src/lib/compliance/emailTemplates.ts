/**
 * Deletion email templates — E119-S04
 *
 * Pure functions that return plain-text and HTML email content for the two
 * account-deletion notification events:
 *   1. Deletion scheduled (sent at soft-delete request time)
 *   2. Deletion complete (sent after hard-delete finishes)
 *
 * Design decisions:
 *   - Pure functions — no side effects, no env var access, no network calls.
 *   - HTML uses inline styles only for email-client compatibility.
 *   - Cancel URL is a parameter (injected by the caller), not hard-coded.
 *   - Plain-text variants are complete, readable fallbacks with no HTML.
 */

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

/**
 * Email sent immediately after a user requests account deletion.
 *
 * Informs the user that their account is scheduled for deletion and provides
 * a cancel link (valid for 7 days, matching the SOFT_DELETE_GRACE_DAYS constant).
 *
 * @param cancelUrl - URL the user can visit to cancel the deletion (requires auth).
 *   Currently routes to the Settings page; a future story may add a one-time token.
 */
export function deletionScheduledEmail(cancelUrl: string): EmailTemplate {
  const subject = 'Your Knowlune account is scheduled for deletion'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#005bc1;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Knowlune</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">
                Your account deletion has been scheduled
              </h2>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                We received your request to permanently delete your Knowlune account and all associated data.
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                <strong>Your account will be permanently deleted in 7 days.</strong>
                Until then, you can still sign in and cancel the deletion.
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                To cancel, sign in to your account and visit Settings &gt; Account, or use the link below:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:6px;background:#005bc1;">
                    <a href="${cancelUrl}"
                       style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:6px;">
                      Cancel deletion
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#6b7280;font-size:14px;line-height:1.6;">
                If you did not request this deletion, please sign in immediately and cancel to secure your account.
              </p>
              <p style="margin:16px 0 0;color:#6b7280;font-size:14px;line-height:1.6;">
                After 7 days, your data will be permanently erased and cannot be recovered.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background:#f3f4f6;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                This email was sent because an account deletion was requested for this email address.
                Knowlune · <a href="https://knowlune.pedrolages.net" style="color:#9ca3af;">knowlune.pedrolages.net</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Your Knowlune account is scheduled for deletion
================================================

We received your request to permanently delete your Knowlune account and all associated data.

Your account will be permanently deleted in 7 days.

Until then, you can still sign in and cancel the deletion.

To cancel, sign in to your account and visit Settings > Account, or visit:
${cancelUrl}

If you did not request this deletion, please sign in immediately and cancel to secure your account.

After 7 days, your data will be permanently erased and cannot be recovered.

---
This email was sent because an account deletion was requested for this email address.
Knowlune · https://knowlune.pedrolages.net`

  return { subject, html, text }
}

/**
 * Email sent after hard-delete completes.
 *
 * Confirms to the user that all their data has been permanently erased.
 * Sent to the email address recorded at deletion-request time (from
 * pending_deletions table), since auth.users is no longer accessible.
 */
export function deletionCompleteEmail(): EmailTemplate {
  const subject = 'Your Knowlune data has been deleted'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#005bc1;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Knowlune</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">
                Your data has been permanently deleted
              </h2>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                Your Knowlune account and all associated data have been permanently erased in accordance
                with your deletion request.
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                The following data has been deleted:
              </p>
              <ul style="margin:0 0 16px;padding-left:24px;color:#374151;font-size:16px;line-height:1.8;">
                <li>Your account and profile information</li>
                <li>All course progress and study sessions</li>
                <li>Notes, bookmarks, flashcards, and highlights</li>
                <li>Imported content, books, and shelves</li>
                <li>All uploaded files and media</li>
              </ul>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                This action is permanent and cannot be reversed.
              </p>
              <p style="margin:0 0 0;color:#6b7280;font-size:14px;line-height:1.6;">
                If you change your mind in the future, you're welcome to create a new account at any time.
                We hope Knowlune was helpful during your time with us.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background:#f3f4f6;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                This is a confirmation that your deletion request has been processed.
                Knowlune · <a href="https://knowlune.pedrolages.net" style="color:#9ca3af;">knowlune.pedrolages.net</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Your Knowlune data has been deleted
=====================================

Your Knowlune account and all associated data have been permanently erased in accordance with your deletion request.

The following data has been deleted:
- Your account and profile information
- All course progress and study sessions
- Notes, bookmarks, flashcards, and highlights
- Imported content, books, and shelves
- All uploaded files and media

This action is permanent and cannot be reversed.

If you change your mind in the future, you're welcome to create a new account at any time.
We hope Knowlune was helpful during your time with us.

---
This is a confirmation that your deletion request has been processed.
Knowlune · https://knowlune.pedrolages.net`

  return { subject, html, text }
}

// ── E119-S06: Export email templates ─────────────────────────────────────────

/**
 * Email sent when an async large-data export is ready for download.
 *
 * Provides the signed Storage URL and the expiry date. The link is valid for
 * 7 days (matching the Storage signed URL TTL of 604800 seconds).
 *
 * @param downloadUrl - Supabase Storage signed URL for the ZIP archive.
 * @param expiresAt   - ISO 8601 date-time string when the link expires (UTC).
 */
export function exportReadyEmail(downloadUrl: string, expiresAt: string): EmailTemplate {
  const subject = 'Your Knowlune data export is ready'
  const expiryDisplay = expiresAt.length >= 10 ? expiresAt.slice(0, 10) : expiresAt

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#005bc1;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Knowlune</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">
                Your data export is ready
              </h2>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                Your Knowlune data export has been prepared and is ready to download.
                The archive contains all your personal data in compliance with GDPR Articles 15 and 20.
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                <strong>This link expires on ${expiryDisplay}.</strong>
                Download your archive before then — it will not be available after the expiry date.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:6px;background:#005bc1;">
                    <a href="${downloadUrl}"
                       style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:6px;">
                      Download your data
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;color:#6b7280;font-size:14px;line-height:1.6;">
                If the button above doesn&apos;t work, copy and paste this URL into your browser:
              </p>
              <p style="margin:8px 0 0;color:#6b7280;font-size:12px;line-height:1.6;word-break:break-all;">
                ${downloadUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background:#f3f4f6;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                This email was sent because you requested a data export from your Knowlune account.
                Knowlune · <a href="https://knowlune.pedrolages.net" style="color:#9ca3af;">knowlune.pedrolages.net</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `Your Knowlune data export is ready
====================================

Your Knowlune data export has been prepared and is ready to download.
The archive contains all your personal data in compliance with GDPR Articles 15 and 20.

This link expires on ${expiryDisplay}. Download your archive before then.

Download your data:
${downloadUrl}

---
This email was sent because you requested a data export from your Knowlune account.
Knowlune · https://knowlune.pedrolages.net`

  return { subject, html, text }
}

/**
 * Email sent when an async large-data export fails after all retry attempts.
 *
 * Instructs the user to contact support. No technical details are included —
 * they are logged server-side in the export-worker function.
 */
export function exportFailedEmail(): EmailTemplate {
  const subject = "We couldn't build your data export"

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr>
      <td style="padding:40px 20px;">
        <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="background:#005bc1;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">Knowlune</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">
                We couldn't build your data export
              </h2>
              <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
                We attempted to prepare your Knowlune data export but were unable to complete it.
                We apologise for the inconvenience.
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
                Please contact support and we'll help you obtain your data as soon as possible.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:6px;background:#005bc1;">
                    <a href="mailto:privacy@pedrolages.net?subject=Data+export+failed"
                       style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:6px;">
                      Contact support
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background:#f3f4f6;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                This email was sent because a data export was requested for your Knowlune account.
                Knowlune · <a href="https://knowlune.pedrolages.net" style="color:#9ca3af;">knowlune.pedrolages.net</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = `We couldn't build your data export
=====================================

We attempted to prepare your Knowlune data export but were unable to complete it.
We apologise for the inconvenience.

Please contact support and we'll help you obtain your data as soon as possible:
privacy@pedrolages.net

---
This email was sent because a data export was requested for your Knowlune account.
Knowlune · https://knowlune.pedrolages.net`

  return { subject, html, text }
}
