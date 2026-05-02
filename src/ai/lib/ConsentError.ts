/**
 * ConsentError — E119-S08
 *
 * Thrown by AI entry points when the user has not granted consent for the
 * required purpose. Callers should `instanceof ConsentError` to distinguish
 * this from infrastructure errors and show appropriate UI (not an error toast,
 * but an informational consent-required message).
 *
 * @example
 *   try {
 *     const client = await getLLMClient('videoSummary')
 *   } catch (err) {
 *     if (err instanceof ConsentError) {
 *       // Show: "AI features require your consent. Enable in Settings → Privacy."
 *     }
 *   }
 */
import type { ConsentPurpose } from '@/lib/compliance/consentService'

export class ConsentError extends Error {
  constructor(public readonly purpose: ConsentPurpose) {
    super(
      `Consent required for purpose "${purpose}". Enable it in Settings → Privacy & Consent.`,
    )
    this.name = 'ConsentError'
  }
}
