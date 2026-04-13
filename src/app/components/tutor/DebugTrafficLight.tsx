/**
 * DebugTrafficLight Badge (E73-S04)
 *
 * Inline badge showing traffic light assessment on assistant messages
 * in Debug mode. Uses semantic design tokens for colors.
 */

type DebugAssessment = 'green' | 'yellow' | 'red'

interface DebugTrafficLightProps {
  assessment: DebugAssessment
}

const ASSESSMENT_CONFIG: Record<DebugAssessment, { label: string; className: string }> = {
  green: {
    label: 'Solid',
    className: 'bg-success/10 text-success border-success/20',
  },
  yellow: {
    label: 'Gaps found',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  red: {
    label: 'Misconception',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
}

/**
 * Traffic light assessment badge for Debug mode messages.
 *
 * Renders inline at the start of assistant MessageBubble.
 * Pill-shaped with semantic color tokens and sr-only accessibility label.
 */
export function DebugTrafficLight({ assessment }: DebugTrafficLightProps) {
  const config = ASSESSMENT_CONFIG[assessment]
  if (!config) return null

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${config.className}`}
    >
      {config.label}
      <span className="sr-only">Assessment: {config.label}</span>
    </span>
  )
}
