import * as React from 'react'
import { Button } from './button'
import { cn } from './utils'

type ButtonProps = React.ComponentProps<typeof Button>

interface InteractiveButtonProps extends Omit<ButtonProps, 'size'> {
  size?: 'default' | 'icon'
  active?: boolean
}

/**
 * Touch-safe button wrapper that enforces WCAG 2.5.5 minimum 44×44px tap targets.
 *
 * Maps `size="icon"` → Button `touch-icon` (44px square)
 * Maps `size="default"` → Button `touch` (44px height)
 *
 * Use this instead of raw `<Button>` or `<button>` when the element must be
 * accessible on touch devices (toolbars, action buttons, mobile controls).
 */
const InteractiveButton = React.forwardRef<HTMLButtonElement, InteractiveButtonProps>(
  ({ size = 'default', active, className, ...props }, ref) => {
    const buttonSize = size === 'icon' ? ('touch-icon' as const) : ('touch' as const)

    return (
      <Button
        ref={ref}
        size={buttonSize}
        aria-pressed={active}
        className={cn('min-h-11 min-w-11', active && 'bg-accent text-accent-foreground', className)}
        {...props}
      />
    )
  }
)
InteractiveButton.displayName = 'InteractiveButton'

export { InteractiveButton }
