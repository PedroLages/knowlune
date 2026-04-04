/**
 * LessonHeaderCard — Displays lesson title, description, resource type badges,
 * key topic tags, and optional action buttons below the video/PDF content.
 *
 * The `actions` slot allows the parent to inject controls (e.g. Notes toggle)
 * without making this component aware of player state.
 *
 * @see E91-S05
 */

import { forwardRef, type ReactNode } from 'react'
import { Card } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'

interface LessonHeaderCardProps {
  /** Lesson title (h2) */
  title: string
  /** Optional lesson description */
  description?: string
  /** Resource type labels (e.g., "Video", "PDF", "YouTube") */
  resourceTypes: string[]
  /** Optional key topic tags */
  tags?: string[]
  /** Optional action buttons rendered in the title row (e.g. Notes toggle) */
  actions?: ReactNode
}

export const LessonHeaderCard = forwardRef<HTMLHeadingElement, LessonHeaderCardProps>(
  function LessonHeaderCard({ title, description, resourceTypes, tags, actions }, ref) {
    return (
      <Card data-testid="lesson-header-card" className="rounded-[24px] p-6 mt-4">
        <div className="flex items-start justify-between gap-3">
          <h2
            ref={ref}
            tabIndex={-1}
            className="text-xl font-semibold text-foreground outline-none"
          >
            {title}
          </h2>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>

        {description && (
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
        )}

        {resourceTypes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1" data-testid="resource-type-badges">
            {resourceTypes.map(type => (
              <Badge key={type} variant="secondary">
                {type}
              </Badge>
            ))}
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1" data-testid="lesson-tags">
            {tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </Card>
    )
  }
)
