/**
 * LessonHeaderCard — Displays lesson title, description, resource type badges,
 * and key topic tags below the video/PDF content.
 *
 * @see E91-S05
 */

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
}

export function LessonHeaderCard({
  title,
  description,
  resourceTypes,
  tags,
}: LessonHeaderCardProps) {
  return (
    <Card
      data-testid="lesson-header-card"
      className="rounded-[24px] p-6 mt-4"
    >
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>

      {description && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
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
