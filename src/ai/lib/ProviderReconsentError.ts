/**
 * ProviderReconsentError — E119-S09
 *
 * Thrown by AI entry points when the user has granted consent for the
 * requested purpose but the configured provider identity differs from the
 * one captured in their consent evidence. Callers should `instanceof
 * ProviderReconsentError` to distinguish this from a base `ConsentError`
 * (purpose not granted at all) and surface the `ProviderReconsentModal`
 * instead of a generic error toast.
 *
 * @example
 *   try {
 *     const client = await getLLMClient('videoSummary')
 *   } catch (err) {
 *     if (err instanceof ProviderReconsentError) {
 *       // Show ProviderReconsentModal for err.providerId
 *     }
 *   }
 */
import type { ConsentPurpose } from '@/lib/compliance/consentService'

export class ProviderReconsentError extends Error {
  constructor(
    public readonly purpose: ConsentPurpose,
    public readonly providerId: string,
  ) {
    super(
      `Consent required for provider "${providerId}" on purpose "${purpose}". ` +
        `The AI provider has changed since your last consent. Please review and accept the updated provider in Settings → Privacy & Consent.`,
    )
    this.name = 'ProviderReconsentError'
    // Restore prototype chain for instanceof checks across compilation targets.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
