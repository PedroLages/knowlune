import { Link } from 'react-router'
import {
  MoreHorizontal,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Pencil,
  Image,
  Download,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Separator } from '@/app/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { PathCardHeader } from '@/app/components/figma/PathCardHeader'
import { PathProgressRing } from '@/app/components/figma/PathProgressRing'
import { cn } from '@/app/components/ui/utils'

export interface LearningPathCardAction {
  label: string
  to: string
  variant: 'brand' | 'outline'
  courseName?: string
}

export interface LearningPathCardProps {
  pathName: string
  description?: string | null
  completionPct: number
  courseCount: number
  courseThumbnails: string[]
  isAIGenerated?: boolean
  coverImageUrl?: string
  coverPreset?: string
  href: string
  action?: LearningPathCardAction | null
  /** Next course name to display as a one-line preview below the description. */
  nextCourseName?: string
  onEdit?: () => void
  onChangeCover?: () => void
  onImportCourse?: () => void
  onDelete?: () => void
  className?: string
}

export function LearningPathCard({
  pathName,
  description,
  completionPct,
  courseCount,
  courseThumbnails,
  isAIGenerated,
  coverImageUrl,
  coverPreset,
  href,
  action,
  nextCourseName,
  onEdit,
  onChangeCover,
  onImportCourse,
  onDelete,
  className,
}: LearningPathCardProps) {
  const isNotStarted = completionPct === 0 && courseCount > 0
  const isCompleted = completionPct >= 100
  const hasDropdownActions = onEdit || onChangeCover || onImportCourse || onDelete

  return (
    <article
      className={cn(
        'group relative bg-card border rounded-[var(--card-radius)] overflow-hidden shadow-sm hover:shadow-md motion-safe:transition-shadow motion-safe:duration-300',
        className
      )}
      data-purpose="learning-path-card"
    >
      {/* Gradient banner — dimmed when not started */}
      <div className={cn(isNotStarted && 'opacity-70')}>
        <PathCardHeader
          pathName={pathName}
          completionPct={completionPct}
          isAIGenerated={isAIGenerated}
          coverImageUrl={coverImageUrl}
          coverPreset={coverPreset}
        />
      </div>

      {/* Dropdown menu — over gradient */}
      {hasDropdownActions && (
        <div className="absolute top-4 right-4 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white rounded-full"
                aria-label={`Actions for ${pathName}`}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onSelect={() => onEdit()}>
                  <Pencil className="mr-2 size-4" aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
              )}
              {onChangeCover && (
                <DropdownMenuItem onSelect={() => onChangeCover()}>
                  <Image className="mr-2 size-4" aria-hidden="true" />
                  Change Cover
                </DropdownMenuItem>
              )}
              {onImportCourse && (
                <DropdownMenuItem onSelect={() => onImportCourse()}>
                  <Download className="mr-2 size-4" aria-hidden="true" />
                  Import Course
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onSelect={() => onDelete()}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Content area */}
      <div className="p-6 pt-12 relative">
        {/* Progress ring — overlaps banner/content boundary */}
        <div className="absolute left-6 bg-card rounded-full p-2 shadow-lg flex items-center justify-center w-20 h-20 -top-10">
          <PathProgressRing percentage={completionPct} size={64} strokeWidth={5}>
            {isCompleted ? (
              <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
            ) : (
              <span className="text-xl font-bold text-foreground">
                {Math.round(completionPct)}%
              </span>
            )}
          </PathProgressRing>
        </div>

        <div className="mt-4">
          <Link
            to={href}
            className="block focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-lg"
            aria-label={`${pathName} — ${courseCount} ${courseCount === 1 ? 'course' : 'courses'}, ${Math.round(completionPct)}% completed`}
          >
            {/* Course count badge */}
            <Badge
              variant="secondary"
              className={cn(
                'text-xs font-semibold uppercase tracking-wider',
                isCompleted && 'bg-success-soft text-success'
              )}
            >
              {courseCount} {courseCount === 1 ? 'course' : 'courses'}
            </Badge>

            {/* Title */}
            <h3 className="text-xl font-bold text-foreground mb-2">{pathName}</h3>

            {/* Description */}
            {description && (
              <p className="text-sm text-muted-foreground font-medium mb-6 leading-relaxed">
                {description}
              </p>
            )}

            {/* Next course preview */}
            {nextCourseName && (
              <p className="text-xs text-muted-foreground truncate mb-2">Next: {nextCourseName}</p>
            )}
          </Link>

          <Separator className="mb-6" />

          {/* Footer: avatar stack + action button */}
          <div className="flex items-center justify-between">
            {/* Avatar stack */}
            <div className="flex -space-x-3 overflow-hidden">
              {courseThumbnails.slice(0, 3).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="size-8 rounded-full ring-2 ring-card bg-muted object-cover"
                  loading="lazy"
                />
              ))}
              {courseCount === 0 && (
                <div className="size-8 rounded-full ring-2 ring-card bg-muted flex items-center justify-center">
                  <BookOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* Action button */}
            <div onClick={e => e.stopPropagation()}>
              {action ? (
                <Link to={action.to} tabIndex={-1}>
                  <Button
                    variant={action.variant}
                    className="px-6 has-[>svg]:px-6 py-2 rounded-xl text-sm font-bold group-hover:px-7 motion-safe:transition-[padding]"
                    aria-label={`${action.label}${action.courseName ? ' ' + action.courseName : ''}`}
                    asChild={false}
                  >
                    {action.label}
                    {action.variant === 'brand' && (
                      <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
                    )}
                  </Button>
                </Link>
              ) : isNotStarted ? (
                <span className="text-xs font-bold text-muted-foreground uppercase px-2">
                  Not Started
                </span>
              ) : (
                <ArrowRight
                  className="size-5 text-muted-foreground group-hover:text-brand transition-colors"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
