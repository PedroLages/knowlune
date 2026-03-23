import { Link } from 'react-router'
import { BookOpen, Clock, GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { allAuthors } from '@/data/authors'
import { getAuthorStats, getAvatarSrc } from '@/lib/authors'
import { FeaturedAuthor } from '@/app/components/figma/FeaturedAuthor'
import { getInitials } from '@/lib/textUtils'

export function Authors() {
  if (allAuthors.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 text-wrap-balance">Our Authors</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-lg">No authors available yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 text-wrap-balance">Our Authors</h1>
        <p className="text-muted-foreground">
          {allAuthors.length === 1
            ? 'Meet the expert behind your learning journey'
            : `Meet the ${allAuthors.length} experts behind your learning journey`}
        </p>
      </div>

      {/* Author content: featured layout for single author, grid for multiple */}
      {allAuthors.length === 1 ? (
        <FeaturedAuthor author={allAuthors[0]} />
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          data-testid="author-grid"
        >
          {allAuthors.map(author => {
            const stats = getAuthorStats(author)
            return (
              <Link
                key={author.id}
                to={`/authors/${author.id}`}
                className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-[24px]"
              >
                <Card className="h-full rounded-[24px] border-0 shadow-sm hover:shadow-xl motion-safe:hover:scale-[1.02] transition-shadow transition-transform duration-300">
                  <CardContent className="flex flex-col items-center text-center p-6 pt-8">
                    {/* Avatar */}
                    <Avatar className="size-24 mb-4 ring-2 ring-border/50 group-hover:ring-brand/30 transition-shadow transition-colors">
                      <AvatarImage {...getAvatarSrc(author.avatar, 96)} alt={author.name} />
                      <AvatarFallback className="text-lg font-semibold bg-brand/10 text-brand">
                        {getInitials(author.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name & Title */}
                    <h2 className="text-lg font-semibold group-hover:text-brand transition-colors text-wrap-balance">
                      {author.name}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">{author.title}</p>

                    {/* Specialty Badges */}
                    {author.specialties.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                        {author.specialties.slice(0, 3).map((specialty, index) => (
                          <Badge
                            key={`${specialty}-${index}`}
                            variant="secondary"
                            className="text-xs"
                          >
                            {specialty}
                          </Badge>
                        ))}
                        {author.specialties.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{author.specialties.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Stats Row */}
                    <div
                      className="flex items-center justify-center gap-6 text-sm text-muted-foreground"
                      aria-label={`${stats.courseCount} courses, ${Math.round(stats.totalHours)} hours, ${stats.totalLessons} lessons`}
                    >
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="size-4 text-brand" aria-hidden="true" />
                        <span className="tabular-nums font-medium">{stats.courseCount}</span>
                        <span className="hidden sm:inline">
                          {stats.courseCount === 1 ? 'course' : 'courses'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-4 text-brand" aria-hidden="true" />
                        <span className="tabular-nums font-medium">
                          {Math.round(stats.totalHours)}h
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="size-4 text-brand" aria-hidden="true" />
                        <span className="tabular-nums font-medium">{stats.totalLessons}</span>
                        <span className="hidden sm:inline">lessons</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
