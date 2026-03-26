// E19-S08: Trial Reminder Banner — shown when trial has <=3 days remaining
// Dismissible per calendar day via localStorage.

import { useState } from 'react'
import { Clock, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useTrialStatus } from '@/app/hooks/useTrialStatus'
import { useNavigate } from 'react-router'

/**
 * AC3: Trial with <=3 days remaining shows a reminder banner.
 * Dismissible — shows again next calendar day.
 */
export function TrialReminderBanner() {
  const { showReminder, daysRemaining, dismissReminder } = useTrialStatus()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)

  if (!showReminder || dismissed) return null

  const message =
    daysRemaining === 0
      ? 'Your free trial ends today.'
      : daysRemaining === 1
        ? 'Your free trial ends tomorrow.'
        : `Your free trial ends in ${daysRemaining} days.`

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm animate-in fade-in slide-in-from-top-1 duration-300"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Clock className="size-4 text-warning shrink-0" aria-hidden="true" />
        <p className="text-foreground">
          {message}{' '}
          <span className="text-muted-foreground">
            Subscribe now to keep your premium features.
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="brand"
          size="sm"
          className="min-h-[36px]"
          onClick={() => navigate('/settings')}
          aria-label="Subscribe to keep premium features"
        >
          Subscribe
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => {
            dismissReminder()
            setDismissed(true)
          }}
          aria-label="Dismiss trial reminder"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
