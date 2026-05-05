import { useState, useMemo, useEffect, type ReactNode } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router'
import { recordVisit } from '@/lib/searchFrecency'
import {
  BookOpen,
  Clock,
  ExternalLink,
  GraduationCap,
  Users,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { ImportedCourseCard } from '@/app/components/figma/ImportedCourseCard'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useCourseStore } from '@/stores/useCourseStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useLazyStore } from '@/hooks/useLazyStore'
import {
  getMergedAuthors,
  getAvatarSrc,
  getInitials,
  withAuthorCourseCounts,
  type AuthorView,
} from '@/lib/authors'
import { getCourseCompletionPercent } from '@/lib/progress'
import { AuthorFormDialog } from '@/app/components/authors/AuthorFormDialog'
import { AuthorAboutSection } from '@/app/components/authors/AuthorAboutSection'
import { AuthorsSyncErrorBanner } from '@/app/components/authors/AuthorsSyncErrorBanner'
import { DeleteAuthorDialog } from '@/app/components/authors/DeleteAuthorDialog'
import type { Difficulty } from '@/data/types'

export function AuthorProfile() {
  const { authorId } = useParams<{ authorId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // R19: record visit on direct navigation. Skipped for palette-initiated
  // navigations to avoid openCount double-counting.
  useEffect(() => {
    if (!authorId || authorId === 'undefined') return
    const state = location.state as { __viaPalette?: boolean } | null
    if (state?.__viaPalette === true) return
    void recordVisit('author', authorId)
  }, [authorId, location.state])
  const storeAuthors = useAuthorStore(s => s.authors)
  const isLoaded = useAuthorStore(s => s.isLoaded)
  const isLoading = useAuthorStore(s => s.isLoading)
  const loadAuthors = useAuthorStore(s => s.loadAuthors)
  const courses = useCourseStore(s => s.courses)
  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const loadImportedCourses = useCourseImportStore(state => state.loadImportedCourses)
  const getAllTags = useCourseImportStore(state => state.getAllTags)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // Lazy-load author + imported course stores on mount (deferred — not critical for initial app load)
  useLazyStore(loadAuthors)
  useLazyStore(loadImportedCourses)

  // Merge store authors; course counts match Authors grid / featured (canonical + imported).
  const allAuthors = useMemo(
    () => withAuthorCourseCounts(getMergedAuthors(storeAuthors), courses, importedCourses),
    [storeAuthors, courses, importedCourses]
  )
  const author: AuthorView | undefined = allAuthors.find(a => a.id === authorId)

  // Get courses by this author (pre-seeded + imported)
  const authorCourses = useMemo(
    () => courses.filter(c => c.authorId === authorId),
    [courses, authorId]
  )

  const authorImportedCourses = useMemo(
    () => importedCourses.filter(c => c.authorId === authorId),
    [importedCourses, authorId]
  )

  const allTags = useMemo(() => getAllTags(), [getAllTags])
  const totalCourseCount = authorCourses.length + authorImportedCourses.length

  if (isLoading && !isLoaded) {
    return (
      <div>
        <AuthorsSyncErrorBanner />
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-48 rounded-2xl mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!author) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-24">
        <AuthorsSyncErrorBanner />
        <Users className="mb-4 size-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">Author Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The author you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link to="/authors">Back to Authors</Link>
        </Button>
      </div>
    )
  }

  const socialEntries = Object.entries(author.socialLinks).filter(([, url]) => url)

  return (
    <div>
      <AuthorsSyncErrorBanner />
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/authors">Authors</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{author.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero Section */}
      <Card className="rounded-2xl border-0 shadow-sm mb-6">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-[var(--content-gap)]">
            {/* Avatar */}
            <Avatar className="size-28 sm:size-32 shrink-0 ring-2 ring-border/50 self-center sm:self-start">
              <AvatarImage {...getAvatarSrc(author.avatar, 128)} alt={author.name} />
              <AvatarFallback className="text-2xl font-semibold bg-brand/10 text-brand">
                {getInitials(author.name)}
              </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-start gap-3 justify-center sm:justify-start">
                <h1 className="text-2xl font-bold mb-1">{author.name}</h1>
                {author.importedAuthor && (
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setEditOpen(true)}
                      aria-label={`Edit ${author.name}`}
                      data-testid="profile-edit-button"
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                      aria-label={`Delete ${author.name}`}
                      data-testid="profile-delete-button"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
              {author.title && <p className="text-muted-foreground mb-3">{author.title}</p>}

              {/* Featured Quote */}
              {author.featuredQuote && (
                <blockquote className="text-sm italic text-muted-foreground border-l-2 border-brand pl-3 mb-4">
                  &ldquo;{author.featuredQuote}&rdquo;
                </blockquote>
              )}

              {/* Specialty Badges */}
              {author.specialties.length > 0 && (
                <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mb-4">
                  {author.specialties.map(specialty => (
                    <Badge key={specialty} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Social Links */}
              {socialEntries.length > 0 && (
                <div className="flex justify-center sm:justify-start gap-2">
                  {socialEntries.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-brand hover:underline capitalize"
                      aria-label={`${platform} — ${author.name}`}
                    >
                      {platform}
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={BookOpen}
          value={totalCourseCount}
          label={totalCourseCount === 1 ? 'Course' : 'Courses'}
        />
        <StatCard
          icon={Clock}
          value={`${Math.round(authorCourses.reduce((sum, c) => sum + c.estimatedHours, 0))}h`}
          label="Hours of content"
        />
        <StatCard
          icon={GraduationCap}
          value={authorCourses.reduce((sum, c) => sum + c.totalLessons, 0)}
          label="Number of lessons"
        />
        <StatCard
          icon={Users}
          value={
            <DifficultyChips
              difficulties={[
                ...authorCourses.map(c => c.difficulty),
                ...authorImportedCourses.map(c => c.difficulty).filter(Boolean),
              ]}
            />
          }
          label="Difficulty"
        />
      </div>

      {/* Bio Section */}
      <AuthorAboutSection author={author} headingLevel="h2" educationIcon="award" />

      {/* Courses Section */}
      {totalCourseCount > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Courses by {author.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-[var(--content-gap)]">
            {authorCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                variant="library"
                completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
              />
            ))}
            {authorImportedCourses.map(course => (
              <ImportedCourseCard key={course.id} course={course} allTags={allTags} />
            ))}
          </div>
        </div>
      )}

      {totalCourseCount === 0 && (
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="size-12 text-muted-foreground/50 mb-3" aria-hidden="true" />
            <p className="text-muted-foreground">No courses linked to this author yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {author.importedAuthor && (
        <AuthorFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          author={author.importedAuthor}
        />
      )}

      {/* Delete Dialog */}
      {author.importedAuthor && (
        <DeleteAuthorDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          author={author.importedAuthor}
          onDeleted={() => navigate('/authors')}
        />
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BookOpen
  value: ReactNode
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 shadow-sm">
      <Icon className="size-5 text-brand mb-1" aria-hidden="true" />
      {typeof value === 'string' || typeof value === 'number' ? (
        <span className="text-xl font-bold tabular-nums">{value}</span>
      ) : (
        <div className="min-h-[1.75rem] flex items-center justify-center">{value}</div>
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function DifficultyChips({ difficulties }: { difficulties: Array<Difficulty | undefined> }) {
  const chips = useMemo(() => {
    const order: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'expert']
    const set = new Set<Difficulty>()
    for (const d of difficulties) {
      if (!d) continue
      set.add(d)
    }
    const unique = order.filter(d => set.has(d))
    return unique.slice(0, 3)
  }, [difficulties])

  if (chips.length === 0) {
    return <span className="text-xs text-muted-foreground">Not set</span>
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {chips.map(chip => (
        <Badge
          key={chip}
          variant={difficultyBadgeVariant(chip)}
          className={`text-[11px] px-2 py-0.5 capitalize ${difficultyBadgeClass(chip)}`}
        >
          {chip}
        </Badge>
      ))}
    </div>
  )
}

function difficultyBadgeVariant(d: Difficulty): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (d) {
    case 'beginner':
      return 'secondary'
    case 'intermediate':
      return 'default'
    case 'advanced':
      return 'destructive'
    case 'expert':
      return 'outline'
  }
}

function difficultyBadgeClass(d: Difficulty): string {
  switch (d) {
    case 'beginner':
      return 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-900'
    case 'intermediate':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-amber-900'
    case 'advanced':
      return 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100 hover:bg-red-100 dark:hover:bg-red-900'
    case 'expert':
      return 'bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100 hover:bg-purple-100 dark:hover:bg-purple-900'
  }
}
