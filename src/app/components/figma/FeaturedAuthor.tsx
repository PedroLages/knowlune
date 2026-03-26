import { Link } from 'react-router'
import { BookOpen, Clock, GraduationCap, Award } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import type { Author } from '@/data/types'
import { getAuthorStats, getAvatarSrc } from '@/lib/authors'
import { getInitials } from '@/lib/textUtils'

function formatHours(h: number): string {
  if (!Number.isFinite(h) || h === 0) return '0h'
  return `${Math.max(1, Math.round(h))}h`
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
    <div className="flex flex-col items-center gap-1 rounded-xl bg-muted ring-1 ring-border/20 p-4 shadow-sm">
      <Icon className="size-5 text-brand mb-1" aria-hidden="true" />
      <span className="text-xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function FeaturedAuthor({ author }: { author: Author }) {
  const stats = getAuthorStats(author)
  const bioText = author.shortBio || author.bio
  const yearsExp = Number.isFinite(author.yearsExperience) ? Math.max(0, author.yearsExperience) : 0

  return (
    <Card className="rounded-[24px] border-0 shadow-sm" data-testid="featured-author">
      <CardContent className="p-6 sm:p-8">
        {/* Hero section: avatar + info */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avatar */}
          <Avatar className="size-24 sm:size-28 shrink-0 ring-2 ring-border/50 self-center sm:self-start">
            <AvatarImage {...getAvatarSrc(author.avatar, 112)} alt={author.name} />
            <AvatarFallback className="text-2xl font-semibold bg-brand/10 text-brand">
              {getInitials(author.name)}
            </AvatarFallback>
          </Avatar>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-semibold text-wrap-balance">{author.name}</h2>
            <p className="text-sm text-muted-foreground mt-1 text-wrap-balance">{author.title}</p>

            {/* Featured Quote */}
            {author.featuredQuote && (
              <blockquote
                className="text-sm italic text-muted-foreground text-left border-l-2 border-brand pl-3 mt-3"
                data-testid="featured-quote"
              >
                &ldquo;{author.featuredQuote}&rdquo;
              </blockquote>
            )}

            {/* Specialty Badges */}
            {author.specialties.length > 0 && (
              <div
                className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3"
                data-testid="specialty-badges"
              >
                {author.specialties.slice(0, 5).map((specialty, index) => (
                  <Badge key={`${specialty}-${index}`} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
                {author.specialties.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{author.specialties.length - 5}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6"
          aria-label={`${stats.courseCount} courses, ${formatHours(stats.totalHours).replace('h', '')} hours, ${stats.totalLessons} lessons`}
        >
          <StatCard
            icon={BookOpen}
            value={stats.courseCount}
            label={stats.courseCount === 1 ? 'Course' : 'Courses'}
          />
          <StatCard icon={Clock} value={formatHours(stats.totalHours)} label="Content" />
          <StatCard icon={GraduationCap} value={stats.totalLessons} label="Lessons" />
          <StatCard icon={Award} value={`${yearsExp}y`} label="Experience" />
        </div>

        {/* Short bio + CTA */}
        {bioText && (
          <p
            className="max-w-prose text-muted-foreground leading-relaxed mt-6 line-clamp-6"
            data-testid="featured-bio"
          >
            {bioText}
          </p>
        )}

        <div className="flex justify-end mt-4">
          <Button
            variant="brand"
            asChild
            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Link to={`/authors/${author.id}`}>View Full Profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
