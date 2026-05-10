import { Link } from 'react-router'
import { motion } from 'motion/react'
import { BookOpen, Clock, TrendingUp, Eye } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { fadeUp } from '@/lib/motion'
import type { LearningPath } from '@/data/types'

interface TemplateCardProps {
  template: LearningPath
  courseCount: number
  matchCount: number
  className?: string
}

export function TemplateCard({ template, courseCount, matchCount, className }: TemplateCardProps) {
  return (
    <motion.div variants={fadeUp} className={className}>
      <Card className="rounded-2xl overflow-hidden border-2 border-brand-soft/50 hover:border-brand-soft transition-colors focus-within:ring-2 focus-within:ring-brand">
        <CardContent className="p-5">
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-xs border-brand-soft text-brand-soft-foreground">
              Template
            </Badge>
            {template.difficultyLabel && (
              <Badge variant="secondary" className="text-xs">
                <TrendingUp className="w-3 h-3 mr-1" />
                {template.difficultyLabel}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-base mb-1 line-clamp-1">{template.name}</h3>

          {template.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{template.description}</p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {courseCount} courses
            </span>
            {template.estimatedHours && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                ~{template.estimatedHours}h
              </span>
            )}
          </div>

          {/* Match indicator */}
          <div className="mb-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
              <span>
                {matchCount} of {courseCount} courses in your library
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  matchCount === 0
                    ? 'bg-warning'
                    : matchCount === courseCount
                      ? 'bg-success'
                      : 'bg-brand'
                )}
                style={{ width: `${courseCount > 0 ? (matchCount / courseCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Preview button */}
          <Button
            variant="brand-outline"
            size="sm"
            className="w-full"
            asChild
          >
            <Link to={`/learning-tracks`}>
              <Eye className="w-4 h-4 mr-1.5" />
              Preview
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
