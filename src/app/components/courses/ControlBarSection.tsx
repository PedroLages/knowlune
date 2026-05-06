import type { ReactNode } from 'react'
import { Separator } from '@/app/components/ui/separator'
import { cn } from '@/app/components/ui/utils'

export interface ControlBarSectionProps {
  label: string
  children: ReactNode
  showDivider?: boolean
  className?: string
}

/**
 * ControlBarSection — a labeled section wrapper for the Courses page control
 * bar. Provides consistent spacing, typography, and an optional vertical
 * divider between sections.
 *
 * The first section should use `showDivider={false}`; subsequent sections use
 * the default `showDivider={true}` to render a `Separator` before the label.
 */
export function ControlBarSection({
  label,
  children,
  showDivider = true,
  className,
}: ControlBarSectionProps) {
  return (
    <div className={cn('flex shrink-0 items-center gap-3', className)}>
      {showDivider && <Separator orientation="vertical" className="!h-6" />}
      <span className="text-xs text-muted-foreground uppercase tracking-wider shrink-0">
        {label}
      </span>
      {children}
    </div>
  )
}

export default ControlBarSection
