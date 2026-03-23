import { useParams, Link } from 'react-router'
import { BookOpen, Clock, ExternalLink, GraduationCap, Award, Users } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb'
import { CourseCard } from '@/app/components/figma/CourseCard'
import { getAuthorById } from '@/data/authors'
import { getAuthorStats, getAvatarSrc } from '@/lib/authors'
import { getCourseCompletionPercent } from '@/lib/progress'
import { getInitials } from '@/lib/textUtils'

export function AuthorProfile() {
  const { authorId } = useParams<{ authorId: string }>()
  const author = getAuthorById(authorId!)

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

  const stats = getAuthorStats(author)
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
              <h1 className="text-2xl font-bold mb-1">{author.name}</h1>
              <p className="text-muted-foreground mb-3">{author.title}</p>

              {/* Featured Quote */}
              {author.featuredQuote && (
                <blockquote className="text-sm italic text-muted-foreground border-l-2 border-brand pl-3 mb-4">
                  &ldquo;{author.featuredQuote}&rdquo;
                </blockquote>
              )}

              {/* Specialty Badges */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mb-4">
                {author.specialties.map(specialty => (
                  <Badge key={specialty} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
              </div>

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
          value={stats.courseCount}
          label={stats.courseCount === 1 ? 'Course' : 'Courses'}
        />
        <StatCard icon={Clock} value={`${Math.round(stats.totalHours)}h`} label="Content" />
        <StatCard icon={GraduationCap} value={stats.totalLessons} label="Lessons" />
        <StatCard icon={Award} value={`${author.yearsExperience}y`} label="Experience" />
      </div>

      {/* Bio Section */}
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

      {/* Courses Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Courses by {author.name}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {stats.courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              variant="library"
              completionPercent={getCourseCompletionPercent(course.id, course.totalLessons)}
            />
          ))}
        </div>
      </div>
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
