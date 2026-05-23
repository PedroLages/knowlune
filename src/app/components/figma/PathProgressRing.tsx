import { cn } from '@/app/components/ui/utils'

const SIZES = {
  sm: { size: 48, stroke: 3, fontSize: 'text-[10px]' },
  md: { size: 72, stroke: 3, fontSize: 'text-xs' },
  lg: { size: 96, stroke: 4, fontSize: 'text-lg' },
  xl: { size: 128, stroke: 6, fontSize: 'text-2xl' },
} as const

// Static mapping to avoid Tailwind v4 JIT purging of runtime-constructed class strings
const DURATION_CLASSES = {
  500: 'duration-500',
  1000: 'duration-1000',
} as const

interface PathProgressRingProps {
  /** Completion percentage 0-100 */
  percentage: number
  /** Ring size preset or custom SVG size in px */
  size?: keyof typeof SIZES | number
  /** Override the default stroke width (defaults to 3 for numeric sizes, or SIZES preset) */
  strokeWidth?: number
  /** Override the stroke color className (defaults to semantic color logic) */
  strokeColor?: string
  /** Transition duration in ms for stroke-dashoffset animation (defaults to 500). Use static mapping. */
  transitionDurationMs?: number
  /** Additional className for the container */
  className?: string
  /** Override the center content (defaults to percentage text) */
  children?: React.ReactNode
}

/**
 * SVG circular progress ring for learning path cards.
 * Uses stroke-dasharray/dashoffset for the fill animation.
 */
export function PathProgressRing({
  percentage,
  size = 'md',
  strokeWidth,
  strokeColor,
  transitionDurationMs = 500,
  className,
  children,
}: PathProgressRingProps) {
  // Resolve config: numeric size computes directly, string preset uses SIZES lookup
  const config =
    typeof size === 'number'
      ? { size, stroke: strokeWidth ?? 3, fontSize: 'text-xs' }
      : SIZES[size]
  const radius = (config.size - config.stroke * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference

  const isCompleted = percentage >= 100

  // Pick stroke color: explicit strokeColor prop overrides semantic logic
  const strokeClass = strokeColor ?? (isCompleted
    ? 'stroke-success'
    : percentage > 0
      ? 'stroke-brand'
      : 'stroke-muted-foreground/30')

  // Use butt linecap for very low percentages to avoid a floating-dot appearance
  const lineCap = percentage > 0 && percentage < 3 ? 'butt' : 'round'

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic size from config prop
      style={{ width: config.size, height: config.size }}
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(percentage)}% completed`}
    >
      <svg
        className="w-full h-full -rotate-90"
        viewBox={`0 0 ${config.size} ${config.size}`}
        fill="none"
      >
        {/* Background track */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          strokeWidth={config.stroke}
          className="stroke-muted"
        />
        {/* Progress arc */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          strokeWidth={config.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap={lineCap}
          className={cn(strokeClass, 'transition-[stroke-dashoffset]', DURATION_CLASSES[transitionDurationMs as keyof typeof DURATION_CLASSES] ?? 'duration-500')}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? (
          <span className={cn('font-bold text-foreground', config.fontSize)}>
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    </div>
  )
}
