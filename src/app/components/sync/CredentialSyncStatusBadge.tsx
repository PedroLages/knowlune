/**
 * CredentialSyncStatusBadge — E97-S05 Unit 3
 *
 * Reusable inline indicator for AI / OPDS / ABS rows showing one of four
 * credential status states with an icon, optional label, and tooltip
 * explaining the Vault broker model (AC3, AC4, AC5).
 *
 * Accessibility:
 * - aria-label on the root element ensures screen readers announce status
 *   even when the tooltip is collapsed.
 * - Tooltip is keyboard-accessible via the TooltipTrigger.
 *
 * @module CredentialSyncStatusBadge
 * @since E97-S05
 */

import { Cloud, Smartphone, CircleDashed, CheckCircle2 } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import type { CredentialStatus } from '@/lib/credentials/credentialStatus'

// ─── Status configuration ─────────────────────────────────────────────────

interface StatusConfig {
  Icon: typeof Cloud
  label: string
  className: string
  tooltipTitle: string
  tooltipBody: string
}

const STATUS_CONFIG: Record<CredentialStatus, StatusConfig> = {
  vault: {
    Icon: Cloud,
    label: 'Synced via Vault',
    className: 'text-success',
    tooltipTitle: 'Credential synced',
    tooltipBody:
      'This credential is stored in Supabase Vault and is available across all your devices automatically.',
  },
  local: {
    Icon: Smartphone,
    label: 'Local only',
    className: 'text-warning-foreground',
    tooltipTitle: 'Credential is device-local',
    tooltipBody:
      'This key is stored on this device only. Re-save it in Settings to sync it to Vault and make it available on all your devices. Ollama uses a server URL rather than a Vault credential.',
  },
  missing: {
    Icon: CircleDashed,
    label: 'Not configured',
    className: 'text-muted-foreground',
    tooltipTitle: 'Credential not configured',
    tooltipBody:
      'This credential is not available on this device. Open Settings and re-enter it to connect. Credentials are stored in Supabase Vault per device for security.',
  },
  anonymous: {
    Icon: CheckCircle2,
    label: 'No credential needed',
    className: 'text-success',
    tooltipTitle: 'Anonymous access',
    tooltipBody:
      'This catalog does not require authentication — it is publicly accessible.',
  },
}

// ─── Props ────────────────────────────────────────────────────────────────

interface CredentialSyncStatusBadgeProps {
  status: CredentialStatus
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
  'data-testid'?: string
}

// ─── Component ────────────────────────────────────────────────────────────

export function CredentialSyncStatusBadge({
  status,
  size = 'sm',
  showLabel = true,
  className,
  'data-testid': testId,
}: CredentialSyncStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const { Icon, label, className: statusClass, tooltipTitle, tooltipBody } = config

  const iconSize = size === 'sm' ? 'size-3' : 'size-4'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          // R1-L3: role="img" only when there is no visible text label.
          // When showLabel=true the child <span> renders `label` as visible
          // text, so the wrapper's implicit role already carries the
          // accessible name — emitting role="img" is redundant.
          role={showLabel ? undefined : 'img'}
          aria-label={label}
          data-testid={testId ?? `credential-status-badge-${status}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium select-none cursor-default',
            'focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none',
            statusClass,
            className
          )}
          tabIndex={0}
        >
          <Icon className={cn(iconSize, 'shrink-0')} aria-hidden="true" />
          {showLabel && (
            <span className={cn(textSize)}>{label}</span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-medium mb-0.5">{tooltipTitle}</p>
        <p className="text-muted-foreground">{tooltipBody}</p>
      </TooltipContent>
    </Tooltip>
  )
}
