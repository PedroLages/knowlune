/**
 * Interactive star rating component with half-star support.
 *
 * Supports 1-5 star ratings in 0.5 increments. Click the left half of a star
 * for a half-star, the right half for a full star. Fully keyboard accessible.
 *
 * @since E113-S01
 */

import { useState, useCallback, useEffect, type KeyboardEvent } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

interface StarRatingProps {
  value: number // 0-5 (0 = no rating)
  onChange?: (rating: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
}

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0)
  const [keyboardValue, setKeyboardValue] = useState(0)
  const displayValue = hoverValue || keyboardValue || value
  const interactive = !readonly && !!onChange

  // Clear keyboard preview once parent confirms the new value
  useEffect(() => {
    setKeyboardValue(0)
  }, [value])

  const handleClick = useCallback(
    (starIndex: number, isHalf: boolean) => {
      if (!interactive) return
      const rating = isHalf ? starIndex - 0.5 : starIndex
      onChange(rating)
    },
    [interactive, onChange]
  )

  const handleMouseMove = useCallback(
    (starIndex: number, e: React.MouseEvent<HTMLSpanElement>) => {
      if (!interactive) return
      const rect = e.currentTarget.getBoundingClientRect()
      const isLeftHalf = e.clientX - rect.left < rect.width / 2
      setHoverValue(isLeftHalf ? starIndex - 0.5 : starIndex)
    },
    [interactive]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!interactive) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = Math.min(5, (value || 0) + 0.5)
        setKeyboardValue(next) // immediate local visual feedback
        onChange(next)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault()
        const prev = Math.max(0.5, (value || 1) - 0.5)
        setKeyboardValue(prev) // immediate local visual feedback
        onChange(prev)
      }
    },
    [interactive, value, onChange]
  )

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
      role={interactive ? 'slider' : 'img'}
      aria-label={`Rating: ${value} out of 5 stars`}
      aria-valuenow={interactive ? value : undefined}
      aria-valuemin={interactive ? 0.5 : undefined}
      aria-valuemax={interactive ? 5 : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onMouseLeave={interactive ? () => setHoverValue(0) : undefined}
      data-testid="star-rating"
    >
      {[1, 2, 3, 4, 5].map(starIndex => {
        const fillPercent =
          displayValue >= starIndex ? 100 : displayValue >= starIndex - 0.5 ? 50 : 0

        return (
          <span
            key={starIndex}
            className={cn('relative', interactive && 'cursor-pointer')}
            onMouseMove={interactive ? e => handleMouseMove(starIndex, e) : undefined}
            onClick={
              interactive
                ? e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const isLeftHalf = e.clientX - rect.left < rect.width / 2
                    handleClick(starIndex, isLeftHalf)
                  }
                : undefined
            }
          >
            {/* Background star (empty) */}
            <Star className={cn(sizeMap[size], 'text-muted-foreground/30')} aria-hidden="true" />
            {/* Filled overlay via clip-path */}
            {fillPercent > 0 && (
              <Star
                className={cn(sizeMap[size], 'absolute inset-0 fill-warning text-warning')}
                style={{ clipPath: `inset(0 ${100 - fillPercent}% 0 0)` }}
                aria-hidden="true"
              />
            )}
          </span>
        )
      })}
    </div>
  )
}
