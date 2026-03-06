import { useParams, Link } from 'react-router'
import { Clock, Video, FileText, BookOpen, Play, CheckCircle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb'
import { Progress } from '@/app/components/ui/progress'
import { Separator } from '@/app/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { ModuleAccordion } from '@/app/components/figma/ModuleAccordion'
import { CourseNotesTab } from '@/app/components/notes/CourseNotesTab'
import { categoryLabels, categoryColors } from '@/app/components/figma/CourseCard'
import { allCourses } from '@/data/courses'
import { getProgress, getCourseCompletionPercent } from '@/lib/progress'
import { useContentProgressStore } from '@/stores/useContentProgressStore'

export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const course = allCourses.find(c => c.id === courseId)
  // Subscribe to statusMap changes to trigger re-render when content status updates
  // This ensures the progress bar reflects changes made via StatusSelector
  useContentProgressStore(s => s.statusMap)

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <BookOpen className="mb-4 h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">Course Not Found</h2>
        <p className="text-muted-foreground mb-6">The course you're looking for doesn't exist.</p>
        <Button asChild>
          <Link to="/courses">Back to Courses</Link>
        </Button>
      </div>
    )
  }

  const progress = getProgress(course.id)
  const completionPercent = getCourseCompletionPercent(course.id, course.totalLessons)

  const firstLesson = course.modules[0]?.lessons[0]
  const lastWatchedLesson = progress.lastWatchedLesson
  const resumeLesson = lastWatchedLesson || firstLesson?.id

  return (
    <div>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/courses">Courses</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{course.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Course Header */}
      <div className="bg-card rounded-3xl shadow-sm p-8 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge className={`border-0 text-xs ${categoryColors[course.category]}`}>
                {categoryLabels[course.category]}
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {course.difficulty}
              </Badge>
            </div>

            <h1 className="text-2xl font-bold mb-2">{course.title}</h1>
            <p className="text-muted-foreground mb-5">{course.description}</p>

            <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                {course.totalLessons} lessons
              </span>
              <span className="flex items-center gap-1.5">
                <Video className="h-4 w-4" />
                {course.totalVideos} videos
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                {course.totalPDFs} documents
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />~{course.estimatedHours} hours
              </span>
            </div>

            {resumeLesson && (
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link to={`/courses/${course.id}/${resumeLesson}`}>
                  <Play className="mr-2 h-4 w-4" />
                  {lastWatchedLesson ? 'Continue Learning' : 'Start Course'}
                </Link>
              </Button>
            )}
          </div>

          {/* Progress sidebar */}
          <div className="w-full lg:w-64 bg-muted rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">Your Progress</h3>
            {completionPercent === 100 ? (
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="size-6 text-success" data-testid="completion-badge" />
                <div className="text-2xl font-bold text-success">Complete!</div>
              </div>
            ) : (
              <div className="text-3xl font-bold text-brand mb-1">{completionPercent}%</div>
            )}
            <Progress value={completionPercent} showLabel className="mb-3" />
            <p className="text-xs text-muted-foreground">
              {progress.completedLessons.length} of {course.totalLessons} lessons completed
            </p>
          </div>
        </div>
      </div>

      {/* Tags */}
      {course.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {course.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs bg-accent">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <Separator className="mb-6" />

      <Tabs defaultValue="content">
        <TabsList className="mb-4">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <h2 className="text-lg font-semibold mb-4">Course Content</h2>
          <ModuleAccordion modules={course.modules} courseId={course.id} />
        </TabsContent>

        <TabsContent value="notes">
          <CourseNotesTab courseId={course.id} modules={course.modules} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
