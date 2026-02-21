import { Link } from 'react-router'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Badge } from '@/app/components/ui/badge'
import { allCourses } from '@/data/courses'

export function Instructors() {
  const categories = [...new Set(allCourses.map(c => c.category))]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">About</h1>

      <div className="max-w-3xl space-y-6">
        {/* Author Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-2">Chase Hughes</h2>
            <p className="text-muted-foreground mb-4">
              Chase Hughes is a leading expert in behavioral analysis, persuasion, and influence. He
              has trained law enforcement, intelligence professionals, and military personnel
              worldwide. The Operative Kit is his comprehensive training program covering the full
              spectrum of human behavior skills.
            </p>
            <a
              href="https://www.chasehughes.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
            >
              chasehughes.com <ExternalLink className="w-3 h-3" />
            </a>
          </CardContent>
        </Card>

        {/* Course Categories / Methodology */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              The Operative Kit covers {allCourses.length} courses across {categories.length}{' '}
              categories:
            </p>
            <div className="space-y-3">
              {categories.map(category => {
                const categoryCourses = allCourses.filter(c => c.category === category)
                return (
                  <div key={category} className="flex items-start gap-3">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {category}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      {categoryCourses.map(course => (
                        <Link
                          key={course.id}
                          to={`/courses/${course.id}`}
                          className="text-sm text-brand hover:underline"
                        >
                          {course.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* About this App */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About This App</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is a personal study companion for the Chase Hughes Operative Kit. It provides
              video lessons, PDF resources, progress tracking, and a study journal to help you
              master the material at your own pace.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
