/**
 * AIConsentDeclinedBanner — E119-S09
 *
 * Inline informational notice rendered when the user declines provider
 * re-consent. Does not affect other features.
 *
 * Accessibility: role="status" so screen readers announce the message;
 * the Settings link is keyboard-reachable.
 */

import { Info } from 'lucide-react'
import { getProviderMeta } from '@/lib/compliance/providerMeta'
import { Link } from 'react-router'

export interface AIConsentDeclinedBannerProps {
  /** The provider_id the user declined consent for. */
  providerId: string
}

export function AIConsentDeclinedBanner({ providerId }: AIConsentDeclinedBannerProps) {
  const { displayName } = getProviderMeta(providerId)

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-muted text-muted-foreground flex items-start gap-2 rounded-lg px-4 py-3 text-sm"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        AI features require consent for{' '}
        <span className="text-foreground font-medium">{displayName}</span>.{' '}
        <Link
          to="/settings/privacy"
          className="text-brand-soft-foreground underline underline-offset-2"
        >
          Enable in Settings → Privacy &amp; Consent
        </Link>
        .
      </span>
    </div>
  )
}
