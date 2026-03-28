import { Link } from 'react-router'
import { BookOpen, FileText, Play, TrendingUp, ArrowRight } from 'lucide-react'

interface QuickActionsProps {
  studyNotes: number
  lastWatchedCourse?: string
  lastWatchedLesson?: string
}

export function QuickActions({
  studyNotes,
  lastWatchedCourse,
  lastWatchedLesson,
}: QuickActionsProps) {
  const actions = [
    {
      icon: BookOpen,
      label: 'Browse Courses',
      href: '/courses',
    },
    {
      icon: FileText,
      label: `My Notes${studyNotes > 0 ? ` (${studyNotes})` : ''}`,
      href: '/journal',
    },
  ]

  if (lastWatchedCourse && lastWatchedLesson) {
    actions.push({
      icon: Play,
      label: 'Resume Video',
      href: `/courses/${lastWatchedCourse}/lessons/${lastWatchedLesson}`,
    })
  }

  actions.push({
    icon: TrendingUp,
    label: 'View Progress',
    href: '/my-progress',
  })

  return (
    <div>
      <h2 className="text-xl mb-4">Quick Actions</h2>
      <div className="space-y-2">
        {actions.map(action => {
          const Icon = action.icon
          return (
            <Link
              key={action.label}
              to={action.href}
              className="flex items-center gap-3 p-[var(--content-padding)] rounded-2xl bg-surface-elevated border border-border/50 hover:border-brand-muted hover:bg-brand-soft/30 dark:hover:bg-brand-soft/10 motion-safe:transition-[background-color,border-color] motion-safe:duration-200 group"
            >
              <div className="size-10 rounded-xl bg-brand-soft dark:bg-brand-soft flex items-center justify-center group-hover:bg-brand-muted motion-safe:transition-colors flex-shrink-0">
                <Icon className="size-5 text-brand" aria-hidden="true" />
              </div>
              <span className="flex-1 font-medium text-sm">{action.label}</span>
              <ArrowRight
                className="size-4 text-muted-foreground group-hover:text-brand group-hover:translate-x-1 motion-safe:transition-[color,transform] motion-safe:duration-200"
                aria-hidden="true"
              />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
