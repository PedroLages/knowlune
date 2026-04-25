import * as React from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'

/**
 * MoveUpDownButtons (E66-S01)
 *
 * Single-pointer alternative to drag-and-drop reorder, satisfying WCAG 2.5.7.
 *
 * Renders Move Up / Move Down icon buttons that work alongside (never replacing)
 * existing drag handles. Disabled state uses `aria-disabled` (not the HTML
 * `disabled` attribute) so screen readers can still focus the control and
 * announce why it's unavailable.
 *
 * Parents are responsible for focus restoration after a reorder — pass refs
 * via `upRef`/`downRef` and on the new index call `.focus()` inside a
 * `requestAnimationFrame` so the DOM has settled.
 */
export interface MoveUpDownButtonsProps {
  /** Zero-based index of this item within the list. */
  index: number
  /** Total number of items in the list. */
  total: number
  /** Human-readable label for the item, used to build the aria-label. */
  itemLabel: string
  /** Called when the active Move Up button is clicked. */
  onMoveUp: () => void
  /** Called when the active Move Down button is clicked. */
  onMoveDown: () => void
  /** Layout — vertical stack (default) or horizontal pair. */
  orientation?: 'vertical' | 'horizontal'
  /** Optional ref to the Move Up button (for parent-managed focus). */
  upRef?: React.Ref<HTMLButtonElement>
  /** Optional ref to the Move Down button (for parent-managed focus). */
  downRef?: React.Ref<HTMLButtonElement>
  /** Optional size variant — `sm` uses 28px buttons (legacy compact rows). Default 44px. */
  size?: 'default' | 'sm'
  /** Additional class names for the wrapping container. */
  className?: string
  /** Optional data-testid prefix; renders `${prefix}-up` / `${prefix}-down`. */
  testIdPrefix?: string
}

export function MoveUpDownButtons({
  index,
  total,
  itemLabel,
  onMoveUp,
  onMoveDown,
  orientation = 'vertical',
  upRef,
  downRef,
  size = 'default',
  className,
  testIdPrefix,
}: MoveUpDownButtonsProps) {
  const upDisabled = index <= 0
  const downDisabled = index >= total - 1

  const handleUp = React.useCallback(() => {
    if (upDisabled) return
    onMoveUp()
  }, [upDisabled, onMoveUp])

  const handleDown = React.useCallback(() => {
    if (downDisabled) return
    onMoveDown()
  }, [downDisabled, onMoveDown])

  const buttonSizeClass = size === 'sm' ? 'size-7' : 'size-11 min-w-11 min-h-11'
  const iconSizeClass = size === 'sm' ? 'size-4' : 'size-5'

  return (
    <div
      className={cn(
        'flex shrink-0 gap-0.5',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        className
      )}
    >
      <Button
        ref={upRef}
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          buttonSizeClass,
          upDisabled && 'text-muted-foreground/50 cursor-not-allowed hover:bg-transparent'
        )}
        onClick={handleUp}
        aria-disabled={upDisabled || undefined}
        aria-label={`Move ${itemLabel} up`}
        data-testid={testIdPrefix ? `${testIdPrefix}-up` : undefined}
      >
        <ChevronUp className={iconSizeClass} aria-hidden="true" />
      </Button>
      <Button
        ref={downRef}
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          buttonSizeClass,
          downDisabled && 'text-muted-foreground/50 cursor-not-allowed hover:bg-transparent'
        )}
        onClick={handleDown}
        aria-disabled={downDisabled || undefined}
        aria-label={`Move ${itemLabel} down`}
        data-testid={testIdPrefix ? `${testIdPrefix}-down` : undefined}
      >
        <ChevronDown className={iconSizeClass} aria-hidden="true" />
      </Button>
    </div>
  )
}
