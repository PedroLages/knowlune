import { cn } from './utils'

function Skeleton({
  className,
  shimmer = true,
  ...props
}: React.ComponentProps<'div'> & { shimmer?: boolean }) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'rounded-md bg-muted',
        shimmer && 'animate-shimmer',
        !shimmer && 'animate-pulse',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
