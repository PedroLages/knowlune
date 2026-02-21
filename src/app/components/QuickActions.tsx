import { Button } from '@/app/components/ui/button'
import { Link } from 'react-router'
import { BookOpen, FileText, Play, TrendingUp } from 'lucide-react'

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
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map(action => {
          const Icon = action.icon
          return (
            <Button
              key={action.label}
              variant="outline"
              className="h-24 flex-col gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 transition-all group"
              asChild
            >
              <Link to={action.href}>
                <Icon className="w-6 h-6 text-brand group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            </Button>
          )
        })}
      </div>
    </section>
  )
}
