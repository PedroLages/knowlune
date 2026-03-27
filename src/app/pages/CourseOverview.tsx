import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  Clock,
  BookOpen,
  Play,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Lock,
  PlayCircle,
} from 'lucide-react'
import { motion, MotionConfig } from 'motion/react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { useCourseStore } from '@/stores/useCourseStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { getAvatarSrc } from '@/lib/authors'

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'behavioral-analysis': { bg: 'bg-success-soft', text: 'text-success', label: 'Behavioral Analysis' },
  'influence-authority': { bg: 'bg-brand-soft', text: 'text-brand-soft-foreground', label: 'Influence & Authority' },
  'confidence-mastery': { bg: 'bg-gold-muted', text: 'text-gold-soft-foreground', label: 'Confidence Mastery' },
  'operative-training': {
    bg: 'bg-accent-violet-muted',
    text: 'text-accent-violet',
    label: 'Operative Training',
  },
  'research-library': { bg: 'bg-secondary', text: 'text-secondary-foreground', label: 'Research Library' },
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: 'bg-success-soft text-success',
  intermediate: 'bg-gold-muted text-gold-soft-foreground',
  advanced: 'bg-accent-violet-muted text-accent-violet',
}

export function CourseOverview() {
  const { courseId } = useParams<{ courseId: string }>()
  const navigate = useNavigate()
  const { courses, isLoaded, loadCourses } = useCourseStore()
  const { loadAuthors, getAuthorById } = useAuthorStore()
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isLoaded) loadCourses()
  }, [isLoaded, loadCourses])

  useEffect(() => {
    loadAuthors()
  }, [loadAuthors])

  // Auto-expand first module
  const course = courses.find(c => c.id === courseId)
  useEffect(() => {
    if (course?.modules[0]) {
      setExpandedModules(new Set([course.modules[0].id]))
    }
  }, [course?.modules])

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <BookOpen className="mb-4 size-16 text-muted-foreground/50" />
        <h2 className="font-display text-xl font-semibold mb-2">Course Not Found</h2>
        <p className="text-muted-foreground mb-6">The course you are looking for does not exist.</p>
        <Button variant="brand" asChild>
          <Link to="/courses">Back to Courses</Link>
        </Button>
      </div>
    )
  }

  const category = CATEGORY_COLORS[course.category] ?? CATEGORY_COLORS['research-library']
  const difficultyStyle = DIFFICULTY_COLORS[course.difficulty] ?? DIFFICULTY_COLORS['beginner']
  const firstLesson = course.modules[0]?.lessons[0]
  const author = getAuthorById(course.authorId)
  const authorInitials = author
    ? author.name
        .split(' ')
        .map(n => n[0])
        .join('')
    : course.authorId
        .split('-')
        .map(w => w[0]?.toUpperCase())
        .join('')
  const authorName = author
    ? author.name
    : course.authorId
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')

  const totalLessonsCount = course.modules.reduce((sum, m) => sum + m.lessons.length, 0)

  function toggleModule(moduleId: string) {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
      }
      return next
    })
  }

  const formatTag = (tag: string) =>
    tag
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')

  return (
    <MotionConfig reducedMotion="user">
      <div className="max-w-6xl mx-auto">
        {/* Back navigation */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>
        </motion.div>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="relative rounded-[24px] overflow-hidden shadow-studio mb-6"
          // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
          style={{
            background:
              'linear-gradient(160deg, var(--brand-soft) 0%, var(--accent-violet-muted) 50%, var(--card) 100%)',
            minHeight: 280,
          }}
        >
          {course.coverImage && (
            <img
              src={`${course.coverImage}-640w.webp`}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}

          {/* Gradient overlay for text readability */}
          <div
            className="absolute inset-0"
            // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
            style={{
              background:
                'linear-gradient(to top, var(--card) 0%, transparent 60%), linear-gradient(160deg, var(--brand-soft) 0%, var(--accent-violet-muted) 50%, transparent 100%)',
              opacity: 0.85,
            }}
          />

          <div
            className="relative z-10 p-8 md:p-10 flex flex-col justify-end h-full"
            // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
            style={{ minHeight: 280 }}
          >
            {/* Badges */}
            <div className="flex items-center gap-2.5 mb-4">
              <span
                className={`${category.bg} ${category.text} px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.12em]`}
              >
                {category.label}
              </span>
              <span
                className={`${difficultyStyle} px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.12em] capitalize`}
              >
                {course.difficulty}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground leading-tight max-w-3xl">
              {course.title}
            </h1>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          {[
            { icon: Clock, value: `${course.estimatedHours}h`, label: 'Duration' },
            { icon: BookOpen, value: `${course.totalLessons}`, label: 'Lessons' },
            { icon: Play, value: `${course.totalVideos}`, label: 'Videos' },
            { icon: BarChart3, value: course.difficulty, label: 'Level' },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-card rounded-xl p-4 text-center shadow-studio border border-border/50"
            >
              <stat.icon className="size-5 text-muted-foreground mx-auto mb-2" />
              <p className="font-semibold text-foreground capitalize">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column (2/3) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* About */}
            <div className="bg-card rounded-[24px] p-6 md:p-8 shadow-studio border border-border/50">
              <h2 className="font-display text-lg font-semibold text-foreground mb-4">About This Course</h2>
              <p className="text-muted-foreground leading-relaxed">{course.description}</p>
            </div>

            {/* Author Card */}
            <Link
              to={`/authors/${course.authorId}`}
              className="block bg-card rounded-[24px] p-6 shadow-studio border border-border/50 hover:shadow-studio-hover hover:-translate-y-px transition-all duration-200 group"
            >
              <div className="flex items-center gap-4">
                <Avatar className="size-14 ring-2 ring-border">
                  {author?.photoUrl && (
                    <AvatarImage {...getAvatarSrc(author.photoUrl, 56)} alt={authorName} />
                  )}
                  <AvatarFallback className="bg-brand-soft text-brand-soft-foreground text-lg font-semibold">
                    {authorInitials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">Instructor</p>
                  <p className="font-semibold text-foreground group-hover:text-brand-soft-foreground transition-colors">
                    {authorName}
                  </p>
                  {author && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                      {author.bio ?? 'View full profile'}
                    </p>
                  )}
                </div>
                <ChevronRight className="size-5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </motion.div>

          {/* Right Column (1/3) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="space-y-6"
          >
            {/* What You'll Learn */}
            {course.tags.length > 0 && (
              <div className="bg-card rounded-[24px] p-6 shadow-studio border border-border/50">
                <h2 className="font-display text-lg font-semibold text-foreground mb-4">What You'll Learn</h2>
                <ul className="space-y-3">
                  {course.tags.map(tag => (
                    <li key={tag} className="flex items-start gap-3">
                      <span className="mt-0.5 flex-shrink-0 size-5 rounded-full bg-success-soft flex items-center justify-center">
                        <Check className="size-3 text-success" />
                      </span>
                      <span className="text-sm text-foreground leading-snug">{formatTag(tag)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA Card */}
            <div
              className="rounded-[24px] p-6 shadow-studio text-center"
              // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
              style={{
                background: 'linear-gradient(135deg, var(--brand) 0%, var(--accent-violet) 100%)',
              }}
            >
              <h3 className="font-display text-lg font-semibold text-brand-foreground mb-1">Ready to Start?</h3>
              <p className="text-brand-foreground/80 text-sm mb-5">Start your learning journey</p>
              {firstLesson ? (
                <Button
                  variant="outline"
                  className="w-full bg-brand-foreground/10 border-brand-foreground/30 text-brand-foreground hover:bg-brand-foreground/20"
                  asChild
                >
                  <Link to={`/courses/${course.id}/${firstLesson.id}`}>
                    <Play className="mr-2 size-4" />
                    Start First Lesson
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full bg-brand-foreground/10 border-brand-foreground/30 text-brand-foreground hover:bg-brand-foreground/20"
                  asChild
                >
                  <Link to={`/courses/${course.id}`}>
                    <Play className="mr-2 size-4" />
                    View Course
                  </Link>
                </Button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Curriculum Section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="bg-card rounded-[24px] p-6 md:p-8 shadow-studio border border-border/50 mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <h2 className="font-display text-lg font-semibold text-foreground">Curriculum</h2>
            <Badge variant="secondary" className="text-xs">
              {totalLessonsCount} lessons
            </Badge>
          </div>

          <div className="space-y-2">
            {course.modules.map((mod, moduleIndex) => {
              const isExpanded = expandedModules.has(mod.id)
              const isFirstModule = moduleIndex === 0
              const isLocked = course.isSequential && !isFirstModule

              return (
                <div key={mod.id} className="rounded-xl border border-border/50 overflow-hidden">
                  {/* Module header */}
                  <button
                    onClick={() => toggleModule(mod.id)}
                    aria-expanded={isExpanded}
                    aria-controls={isExpanded ? `module-content-${mod.id}` : undefined}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="flex-shrink-0 size-8 rounded-lg bg-brand-soft flex items-center justify-center">
                      {isLocked ? (
                        <Lock className="size-3.5 text-muted-foreground" />
                      ) : (
                        <span className="text-sm font-semibold text-brand-soft-foreground">{moduleIndex + 1}</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{mod.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {mod.lessons.length} lesson{mod.lessons.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronDown
                      className={`size-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Lessons */}
                  {isExpanded && (
                    <div id={`module-content-${mod.id}`} className="border-t border-border/50">
                      {mod.lessons.map((lesson, lessonIndex) => (
                        <div
                          key={lesson.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0"
                        >
                          {isLocked ? (
                            <Lock className="size-4 text-muted-foreground/50 flex-shrink-0" />
                          ) : (
                            <PlayCircle className="size-4 text-brand flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                              Lesson {lessonIndex + 1}
                            </span>
                            <p
                              className={`text-sm truncate ${isLocked ? 'text-muted-foreground/50' : 'text-foreground'}`}
                            >
                              {lesson.title}
                            </p>
                          </div>
                          {lesson.duration && (
                            <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                              {lesson.duration}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  )
}
