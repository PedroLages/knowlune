import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import {
  BookOpen,
  Clock,
  ExternalLink,
  GraduationCap,
  Award,
  Users,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
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
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useCourseStore } from '@/stores/useCourseStore'
import { getMergedAuthors, getAvatarSrc, getInitials, type AuthorView } from '@/lib/authors'
import { getCourseCompletionPercent } from '@/lib/progress'
import { AuthorFormDialog } from '@/app/components/authors/AuthorFormDialog'
import { DeleteAuthorDialog } from '@/app/components/authors/DeleteAuthorDialog'

export function AuthorProfile() {
  const { authorId } = useParams<{ authorId: string }>()
  const navigate = useNavigate()
  const { authors: storeAuthors, isLoaded, isLoading, loadAuthors } = useAuthorStore()
  const courses = useCourseStore(s => s.courses)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    loadAuthors()
  }, [loadAuthors])

  // Merge pre-seeded + store authors and find the one matching the URL param
  const allAuthors = useMemo(() => getMergedAuthors(storeAuthors), [storeAuthors])
  const author: AuthorView | undefined = allAuthors.find(a => a.id === authorId)

  // Get courses by this author
  const authorCourses = useMemo(
    () => courses.filter(c => c.authorId === authorId),
    [courses, authorId]
  )

  if (isLoading && !isLoaded) {
    return (
      <div>
        <Skeleton className="h-5 w-48 mb-4" />
        <Skeleton className="h-48 rounded-3xl mb-6" />
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
      <div className="flex flex-col items-center justify-center py-24">
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
      <Card className="rounded-3xl border-0 shadow-sm mb-6">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6">
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
                    >
                      {platform}
                      <ExternalLink className="size-3" />
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
          value={authorCourses.length}
          label={authorCourses.length === 1 ? 'Course' : 'Courses'}
        />
        <StatCard
          icon={Clock}
          value={`${Math.round(authorCourses.reduce((sum, c) => sum + c.estimatedHours, 0))}h`}
          label="Content"
        />
        <StatCard
          icon={GraduationCap}
          value={authorCourses.reduce((sum, c) => sum + c.totalLessons, 0)}
          label="Lessons"
        />
        <StatCard
          icon={Award}
          value={author.yearsExperience > 0 ? `${author.yearsExperience}y` : '\u2014'}
          label="Experience"
        />
      </div>

      {/* Bio Section */}
      {author.bio && (
        <Card className="rounded-3xl border-0 shadow-sm mb-6">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-lg font-semibold mb-4">About</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              {author.bio.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            {author.education && (
              <>
                <Separator className="my-5" />
                <div className="flex items-center gap-2 text-sm">
                  <Award className="size-4 text-brand" aria-hidden="true" />
                  <span className="font-medium">Education:</span>
                  <span className="text-muted-foreground">{author.education}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Courses Section */}
      {authorCourses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Courses by {author.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {authorCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                variant="library"
                completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
              />
            ))}
          </div>
        </div>
      )}

      {authorCourses.length === 0 && (
        <Card className="rounded-3xl border-0 shadow-sm">
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
  value: string | number
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-card p-4 shadow-sm">
      <Icon className="size-5 text-brand mb-1" aria-hidden="true" />
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
