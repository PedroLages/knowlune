'use client'

import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from './utils'

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  value?: number
  showLabel?: boolean
  labelFormat?: (value: number) => string
}

function Progress({
  className,
  value = 0,
  showLabel = false,
  labelFormat = v => `${v}% complete`,
  ...props
}: ProgressProps) {
  // Handle NaN explicitly before normalization
  const safeValue = Number.isNaN(value) ? 0 : value
  const normalizedValue = Math.min(100, Math.max(0, safeValue))

  return (
    <div className="flex items-center gap-2">
      <ProgressPrimitive.Root
        value={normalizedValue}
        data-slot="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={normalizedValue}
        aria-label={labelFormat(normalizedValue)}
        className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="bg-primary h-full w-full flex-1 motion-reduce:transition-none motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out"
          style={{ transform: `translateX(-${100 - normalizedValue}%)` }}
        />
      </ProgressPrimitive.Root>
      {showLabel && (
        <span className="text-muted-foreground text-sm tabular-nums" aria-hidden="true">
          {labelFormat(normalizedValue)}
        </span>
      )}
    </div>
  )
}

export { Progress }
