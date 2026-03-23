import { Link } from 'react-router'
import { BookOpen, Clock, GraduationCap, Award } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import type { Author } from '@/data/types'
import { getAuthorStats, getAvatarSrc } from '@/lib/authors'

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
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

export function FeaturedAuthor({ author }: { author: Author }) {
  const stats = getAuthorStats(author)

  return (
    <Card className="rounded-3xl border-0 shadow-sm" data-testid="featured-author">
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
            <h2 className="text-xl font-semibold">{author.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">{author.title}</p>

            {/* Featured Quote */}
            {author.featuredQuote && (
              <blockquote className="text-sm italic text-muted-foreground border-l-2 border-brand pl-3 mt-3">
                &ldquo;{author.featuredQuote}&rdquo;
              </blockquote>
            )}

            {/* Specialty Badges */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3">
              {author.specialties.map(specialty => (
                <Badge key={specialty} variant="secondary" className="text-xs">
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <StatCard
            icon={BookOpen}
            value={stats.courseCount}
            label={stats.courseCount === 1 ? 'Course' : 'Courses'}
          />
          <StatCard icon={Clock} value={`${Math.round(stats.totalHours)}h`} label="Content" />
          <StatCard icon={GraduationCap} value={stats.totalLessons} label="Lessons" />
          <StatCard icon={Award} value={`${author.yearsExperience}y`} label="Experience" />
        </div>

        {/* Short bio + CTA */}
        <p className="text-muted-foreground leading-relaxed mt-6">{author.shortBio}</p>

        <div className="flex justify-end mt-4">
          <Button variant="brand" asChild>
            <Link to={`/authors/${author.id}`}>View Full Profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
