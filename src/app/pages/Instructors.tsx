import { Link } from 'react-router'
import { BookOpen, Clock, GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { allInstructors } from '@/data/instructors'
import { getInstructorStats } from '@/lib/instructors'

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function Instructors() {
  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Our Instructors</h1>
        <p className="text-muted-foreground">
          Meet the {allInstructors.length} experts behind your learning journey
        </p>
      </div>

      {/* Instructor Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {allInstructors.map(instructor => {
          const stats = getInstructorStats(instructor)
          return (
            <Link
              key={instructor.id}
              to={`/instructors/${instructor.id}`}
              className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-[24px]"
            >
              <Card className="h-full rounded-[24px] border-0 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                <CardContent className="flex flex-col items-center text-center p-6 pt-8">
                  {/* Avatar */}
                  <Avatar className="size-24 mb-4 ring-2 ring-border/50 group-hover:ring-brand/30 transition-all">
                    <AvatarImage
                      src={instructor.avatar}
                      alt={instructor.name}
                    />
                    <AvatarFallback className="text-lg font-semibold bg-blue-100 text-blue-700">
                      {getInitials(instructor.name)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Name & Title */}
                  <h2 className="text-lg font-semibold group-hover:text-brand transition-colors">
                    {instructor.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    {instructor.title}
                  </p>

                  {/* Specialty Badges */}
                  <div className="flex flex-wrap justify-center gap-1.5 mb-5">
                    {instructor.specialties.slice(0, 3).map(specialty => (
                      <Badge
                        key={specialty}
                        variant="secondary"
                        className="text-xs"
                      >
                        {specialty}
                      </Badge>
                    ))}
                    {instructor.specialties.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{instructor.specialties.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="size-4 text-brand" aria-hidden="true" />
                      <span className="tabular-nums font-medium">
                        {stats.courseCount}
                      </span>
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
                      <GraduationCap
                        className="size-4 text-brand"
                        aria-hidden="true"
                      />
                      <span className="tabular-nums font-medium">
                        {stats.totalLessons}
                      </span>
                      <span className="hidden sm:inline">lessons</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
