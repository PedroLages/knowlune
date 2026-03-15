import { AlertTriangle, TrendingDown, Pause, CheckCircle } from 'lucide-react'
import { Alert, AlertTitle, AlertDescription } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import type { EngagementDecayAlert as DecayAlert } from '@/lib/retentionMetrics'

interface EngagementDecayAlertsProps {
  alerts: DecayAlert[]
}

const ALERT_ICONS = {
  frequency: TrendingDown,
  duration: Pause,
  velocity: AlertTriangle,
} as const

const ALERT_TITLES = {
  frequency: 'Study Frequency Decline',
  duration: 'Session Duration Decline',
  velocity: 'Stalled Progress',
} as const

export function EngagementDecayAlerts({ alerts }: EngagementDecayAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2" data-testid="engagement-status-healthy" role="status" aria-live="polite">
        <CheckCircle className="size-4 text-success" aria-hidden="true" />
        <Badge
          variant="outline"
          className="bg-success-soft text-success border-success/20 font-semibold"
        >
          Engagement: Healthy
        </Badge>
      </div>
    )
  }

  return (
    <div className="space-y-3" aria-live="polite">
      {alerts.map(alert => {
        const Icon = ALERT_ICONS[alert.type]
        const isDestructive = alert.type === 'velocity'

        return (
          <Alert
            key={alert.type}
            variant={isDestructive ? 'destructive' : 'default'}
            data-testid="engagement-decay-alert"
            className="rounded-xl"
          >
            <Icon className="size-4" aria-hidden="true" />
            <AlertTitle>{ALERT_TITLES[alert.type]}</AlertTitle>
            <AlertDescription>
              <p>{alert.message}</p>
              {alert.suggestion && (
                <p className="mt-1 text-xs font-medium"><span aria-hidden="true">💡</span> {alert.suggestion}</p>
              )}
            </AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
