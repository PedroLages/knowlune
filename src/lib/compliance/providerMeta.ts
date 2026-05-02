/**
 * Provider Metadata — E119-S09
 *
 * Single runtime source of truth for AI provider display names, legal entities,
 * and data categories. Sourced from docs/compliance/consent-inventory.md,
 * AI Provider Registry section.
 *
 * Used by:
 *   - ProviderReconsentModal: display provider name and data categories
 *   - AIConsentDeclinedBanner: display provider name in inline disabled state
 *
 * IMPORTANT: When a new provider is added to the DPA sub-processor list and
 * consent-inventory.md, a corresponding entry must be added here. The parity
 * is not automatically enforced but the types make omissions visible at compile time.
 */

export interface ProviderMetaEntry {
  /** Human-readable display name shown to the user. */
  displayName: string
  /** Legal entity name matching the DPA sub-processor agreement. */
  legalEntity: string
  /** Data categories transferred to this provider (prose, shown in modal). */
  dataCategories: string
}

/**
 * Registered AI providers.
 *
 * Keys match the `provider_id` values in `docs/compliance/consent-inventory.md`.
 * Provider identity is defined as the legal entity, not the model version.
 * A model bump (GPT-4 → GPT-5) within the same legal entity does NOT change the key.
 *
 * The `unknown` entry is a safe fallback for future providers not yet listed here.
 */
export const PROVIDER_META: Record<string, ProviderMetaEntry> = {
  openai: {
    displayName: 'OpenAI',
    legalEntity: 'OpenAI, L.L.C.',
    dataCategories: 'Prompt text, context window',
  },
  anthropic: {
    displayName: 'Anthropic',
    legalEntity: 'Anthropic, PBC',
    dataCategories: 'Prompt text, context window',
  },
  ollama: {
    displayName: 'Ollama (self-hosted)',
    legalEntity: 'Self-hosted — no data transfer',
    dataCategories: 'None (processed locally on your device)',
  },
  speaches: {
    displayName: 'Speaches (self-hosted Whisper)',
    legalEntity: 'Self-hosted Whisper — no data transfer',
    dataCategories: 'Audio fragments (processed locally)',
  },
  /** Fallback for providers added to the registry but not yet reflected here. */
  unknown: {
    displayName: 'AI Provider',
    legalEntity: 'Unknown',
    dataCategories: 'Please review the updated privacy notice for details.',
  },
}

/**
 * Look up provider metadata by provider_id, falling back to `unknown`.
 * Always returns a valid entry; never throws.
 */
export function getProviderMeta(providerId: string): ProviderMetaEntry {
  return PROVIDER_META[providerId] ?? PROVIDER_META['unknown']
}
