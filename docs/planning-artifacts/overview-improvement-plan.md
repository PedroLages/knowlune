# Overview Page - Implementation Plan

**Project:** Operative Study Platform
**Goal:** Transform Overview page into an engaging, motivating learning dashboard
**Timeline:** 4 weeks
**Estimated Effort:** 60-80 hours

---

## Phase 1: Critical Fixes (Week 1) - 12 hours

### Task 1.1: Fix Visual Design Inconsistencies (4 hours)

**Files to modify:**
- [src/app/pages/Overview.tsx](src/app/pages/Overview.tsx)

**Changes:**

```tsx
// Stats cards - add hover and cursor
<Card key={stat.label} className="hover:shadow-xl transition-shadow duration-200 cursor-pointer rounded-2xl">
  <CardContent className="p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{stat.label}</p>
        <p className="text-3xl font-bold mt-1">{stat.value}</p>
      </div>
      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl flex items-center justify-center">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
    </div>
  </CardContent>
</Card>

// Continue Studying cards - enhance hover
<Card className="group hover:shadow-xl hover:scale-[1.01] transition-all duration-200 cursor-pointer rounded-2xl">
  {/* existing content */}
</Card>

// All Courses cards - enhance hover
<Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-200">
  {/* existing content */}
</Card>
```

**Testing:**
```bash
npm run dev
# Verify:
# - All cards have rounded corners
# - Hover effects are smooth
# - Cursor changes to pointer on interactive elements
```

---

### Task 1.2: Implement Loading States (4 hours)

**New file to create:**
- `src/app/components/ui/skeleton.tsx` (if not exists from shadcn)

**Files to modify:**
- [src/app/pages/Overview.tsx](src/app/pages/Overview.tsx)

**Changes:**

```tsx
import { Skeleton } from "@/app/components/ui/skeleton"
import { useState, useEffect } from "react"

export function Overview() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setIsLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const inProgress = getCoursesInProgress(allCourses)
  const completed = getCompletedCourses(allCourses)
  const completedLessons = getTotalCompletedLessons()
  const studyNotes = getTotalStudyNotes()

  const statsCards = [/* ... */]

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-32 mb-6" />

        {/* Stats Row Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>

        {/* Continue Studying Skeleton */}
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* All Courses Skeleton */}
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-2xl border overflow-hidden">
              <Skeleton className="w-full h-32" />
              <div className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    // Existing content
  )
}
```

**Testing:**
```bash
# Slow down network in DevTools to see skeleton
# Verify smooth transition from skeleton to content
```

---

### Task 1.3: Add Empty States (4 hours)

**New file to create:**
- `src/app/components/EmptyState.tsx`

```tsx
import { Button } from "@/app/components/ui/button"
import { Card, CardContent } from "@/app/components/ui/card"
import { LucideIcon } from "lucide-react"
import { Link } from "react-router"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">{description}</p>
        {actionLabel && actionHref && (
          <Button asChild size="lg">
            <Link to={actionHref}>{actionLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

**Files to modify:**
- [src/app/pages/Overview.tsx](src/app/pages/Overview.tsx)

```tsx
import { EmptyState } from "@/app/components/EmptyState"
import { BookOpen, GraduationCap } from "lucide-react"

// In Continue Studying section
{inProgress.length > 0 ? (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* Existing course cards */}
  </div>
) : (
  <EmptyState
    icon={BookOpen}
    title="No courses in progress"
    description="Start your learning journey today by exploring our course catalog!"
    actionLabel="Browse Courses"
    actionHref="/courses"
  />
)}

// Optional: Empty state for when NO courses exist at all
{allCourses.length === 0 && (
  <EmptyState
    icon={GraduationCap}
    title="Welcome to Your Learning Dashboard"
    description="It looks like we're still setting up your courses. Check back soon!"
  />
)}
```

---

## Phase 2: Engagement Features (Week 2) - 20 hours

### Task 2.1: Achievement Highlights (6 hours)

**New file to create:**
- `src/app/components/AchievementBanner.tsx`

```tsx
import { Card, CardContent } from "@/app/components/ui/card"
import { Trophy, Target } from "lucide-react"

interface AchievementBannerProps {
  completedLessons: number
}

function getNextMilestone(completed: number): {
  next: number
  remaining: number
  message: string
} {
  const milestones = [10, 25, 50, 100, 250, 500]
  const next = milestones.find((m) => m > completed)

  if (!next) {
    return {
      next: 0,
      remaining: 0,
      message: "You're a legend! 🏆",
    }
  }

  const remaining = next - completed
  return {
    next,
    remaining,
    message: `${remaining} more to reach ${next} lessons!`,
  }
}

export function AchievementBanner({ completedLessons }: AchievementBannerProps) {
  if (completedLessons === 0) return null

  const milestone = getNextMilestone(completedLessons)
  const progress = milestone.next
    ? (completedLessons / milestone.next) * 100
    : 100

  return (
    <Card className="mb-8 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border-2 border-blue-200 dark:border-blue-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold">Keep Going!</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              You've completed{" "}
              <span className="font-bold text-blue-600">{completedLessons}</span>{" "}
              {completedLessons === 1 ? "lesson" : "lessons"}.
            </p>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mt-1">
              {milestone.message}
            </p>

            {/* Progress bar to next milestone */}
            {milestone.next > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress to {milestone.next}</span>
                  <span className="font-semibold text-blue-600">
                    {Math.min(100, Math.round(progress))}%
                  </span>
                </div>
                <div className="h-2 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Trophy icon */}
          <div className="ml-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 flex items-center justify-center shadow-lg">
            <Trophy className="w-10 h-10 text-yellow-600 dark:text-yellow-500" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Files to modify:**
- [src/app/pages/Overview.tsx](src/app/pages/Overview.tsx)

```tsx
import { AchievementBanner } from "@/app/components/AchievementBanner"

// Add after stats row, before Continue Studying
<AchievementBanner completedLessons={completedLessons} />
```

---

### Task 2.2: Recent Activity Timeline (8 hours)

**New file to create:**
- `src/app/components/RecentActivity.tsx`

```tsx
import { Card, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Link } from "react-router"
import { formatDistanceToNow } from "date-fns"
import { Clock, ArrowRight } from "lucide-react"
import type { Course } from "@/data/types"
import type { CourseProgress } from "@/lib/progress"

interface RecentActivityProps {
  activities: (Course & { progress: CourseProgress })[]
}

export function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) return null

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <Link
          to="/my-progress"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View All
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className="flex items-center gap-4 p-4 border-b last:border-0 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
            >
              {/* Timeline indicator */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                {index < activities.length - 1 && (
                  <div className="w-0.5 h-full bg-blue-200 dark:bg-blue-800 mt-1" />
                )}
              </div>

              {/* Course thumbnail */}
              {activity.coverImage ? (
                <img
                  src={`${activity.coverImage}-320w.webp`}
                  alt={activity.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
              )}

              {/* Activity info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{activity.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatDistanceToNow(new Date(activity.progress.lastAccessedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              {/* Resume button */}
              <Button size="sm" variant="ghost" asChild>
                <Link to={`/courses/${activity.id}`}>
                  Resume
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
```

**Files to modify:**
- [src/app/pages/Overview.tsx](src/app/pages/Overview.tsx)

```tsx
import { RecentActivity } from "@/app/components/RecentActivity"
import { getRecentActivity } from "@/lib/progress"

export function Overview() {
  // ... existing code
  const recentActivity = getRecentActivity(allCourses, 5)

  return (
    <div>
      {/* ... stats, achievement banner */}

      <RecentActivity activities={recentActivity} />

      {/* ... continue studying, all courses */}
    </div>
  )
}
```

---

### Task 2.3: Enhanced Stats Cards with Trends (6 hours)

**New file to create:**
- `src/app/components/StatsCard.tsx`

```tsx
import { Card, CardContent } from "@/app/components/ui/card"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  label: string
  value: number
  icon: LucideIcon
  trend?: {
    value: number
    direction: "up" | "down"
    period: string
  }
  sparkline?: number[] // Last 7 days data
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  sparkline,
}: StatsCardProps) {
  return (
    <Card className="hover:shadow-xl transition-shadow duration-200 cursor-pointer rounded-2xl overflow-hidden group">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">{label}</p>
            <p className="text-3xl font-bold">{value}</p>

            {/* Trend indicator */}
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium mt-2",
                  trend.direction === "up" ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.direction === "up" ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>
                  {trend.direction === "up" ? "+" : ""}
                  {trend.value} {trend.period}
                </span>
              </div>
            )}
          </div>

          {/* Icon */}
          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        {/* Sparkline */}
        {sparkline && sparkline.length > 0 && (
          <div className="h-8 flex items-end gap-0.5">
            {sparkline.map((value, i) => {
              const max = Math.max(...sparkline)
              const height = max > 0 ? (value / max) * 100 : 0
              return (
                <div
                  key={i}
                  className="flex-1 bg-blue-200 dark:bg-blue-800 rounded-t transition-all hover:bg-blue-400"
                  style={{ height: `${height}%`, minHeight: "4px" }}
                />
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Files to modify:**
- [src/lib/progress.ts](src/lib/progress.ts)

```tsx
// Add helper functions
export function getLast7DaysLessonCompletions(): number[] {
  const logs = getAllStudyLogs()
  const last7Days = Array(7).fill(0)
  const now = new Date()

  logs.forEach((log) => {
    if (log.type === "lesson_complete") {
      const logDate = new Date(log.timestamp)
      const daysAgo = Math.floor(
        (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (daysAgo >= 0 && daysAgo < 7) {
        last7Days[6 - daysAgo]++
      }
    }
  })

  return last7Days
}

export function getWeeklyChange(metric: "lessons" | "courses" | "notes"): number {
  const logs = getAllStudyLogs()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  let thisWeek = 0
  let lastWeek = 0

  logs.forEach((log) => {
    const logDate = new Date(log.timestamp)
    const matchesMetric =
      (metric === "lessons" && log.type === "lesson_complete") ||
      (metric === "notes" && log.type === "note_saved")

    if (!matchesMetric) return

    if (logDate >= weekAgo) {
      thisWeek++
    } else if (logDate >= twoWeeksAgo) {
      lastWeek++
    }
  })

  return thisWeek - lastWeek
}
```

- [src/app/pages/Overview.tsx](src/app/pages/Overview.tsx)

```tsx
import { StatsCard } from "@/app/components/StatsCard"
import { getLast7DaysLessonCompletions, getWeeklyChange } from "@/lib/progress"

export function Overview() {
  const lessonSparkline = getLast7DaysLessonCompletions()
  const lessonsChange = getWeeklyChange("lessons")

  const statsCards = [
    {
      label: "Courses Started",
      value: inProgress.length + completed.length,
      icon: BookOpen,
    },
    {
      label: "Lessons Completed",
      value: completedLessons,
      icon: CheckCircle,
      trend: {
        value: lessonsChange,
        direction: lessonsChange >= 0 ? "up" : "down",
        period: "this week",
      },
      sparkline: lessonSparkline,
    },
    // ... other stats
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Overview</h1>

      {/* Stats Row with enhanced cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsCards.map((stat) => (
          <StatsCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ... rest of page */}
    </div>
  )
}
```

---

## Phase 3: Polish & Delight (Week 3) - 16 hours

### Task 3.1: Quick Actions Section (6 hours)

**New file to create:**
- `src/app/components/QuickActions.tsx`

```tsx
import { Button } from "@/app/components/ui/button"
import { Link } from "react-router"
import {
  BookOpen,
  FileText,
  Play,
  Download,
  TrendingUp,
} from "lucide-react"

interface QuickActionsProps {
  studyNotes: number
  lastWatchedCourse?: string
  lastWatchedLesson?: string
}

export function QuickActions({
  studyNotes,
  lastWatchedCourse,
  lastWatchedLesson,
}: QuickActionsProps) {
  const actions = [
    {
      icon: BookOpen,
      label: "Browse Courses",
      href: "/courses",
    },
    {
      icon: FileText,
      label: `My Notes${studyNotes > 0 ? ` (${studyNotes})` : ""}`,
      href: "/journal",
    },
  ]

  if (lastWatchedCourse && lastWatchedLesson) {
    actions.push({
      icon: Play,
      label: "Resume Video",
      href: `/courses/${lastWatchedCourse}/lessons/${lastWatchedLesson}`,
    })
  }

  actions.push({
    icon: TrendingUp,
    label: "View Progress",
    href: "/my-progress",
  })

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.label}
              variant="outline"
              className="h-24 flex-col gap-2 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 transition-all group"
              asChild
            >
              <Link to={action.href}>
                <Icon className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            </Button>
          )
        })}
      </div>
    </section>
  )
}
```

---

### Task 3.2: Improved Course Card Design (6 hours)

**New file to create:**
- `src/app/components/figma/EnhancedCourseCard.tsx`

```tsx
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Progress } from "@/app/components/ui/progress"
import { Link } from "react-router"
import { BookOpen, PlayCircle, CheckCircle, Clock } from "lucide-react"
import type { Course } from "@/data/types"

interface EnhancedCourseCardProps {
  course: Course & { completionPercent?: number }
}

function formatCategory(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function EnhancedCourseCard({ course }: EnhancedCourseCardProps) {
  const totalLessons = course.modules.reduce(
    (sum, m) => sum + m.lessons.length,
    0
  )
  const isInProgress = course.completionPercent && course.completionPercent > 0
  const isCompleted = course.completionPercent === 100

  return (
    <Link to={`/courses/${course.id}`}>
      <Card className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-200">
        <CardContent className="p-0">
          {/* Cover Image */}
          <div className="relative">
            {course.coverImage ? (
              <img
                src={`${course.coverImage}-640w.webp`}
                alt={course.title}
                className="w-full h-32 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                <BookOpen className="w-12 h-12 text-blue-600" />
              </div>
            )}

            {/* Progress Badge Overlay */}
            {isInProgress && !isCompleted && (
              <div className="absolute top-2 right-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-bold text-blue-600 shadow-lg">
                {course.completionPercent}%
              </div>
            )}

            {/* Completed Badge */}
            {isCompleted && (
              <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full px-3 py-1 text-xs font-bold shadow-lg flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Completed
              </div>
            )}
          </div>

          {/* Card Content */}
          <div className="p-4">
            {/* Category Badge */}
            <Badge
              variant="secondary"
              className="mb-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
            >
              {formatCategory(course.category)}
            </Badge>

            {/* Title */}
            <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
              {course.title}
            </h3>

            {/* Metadata */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <PlayCircle className="w-3 h-3" />
                {totalLessons} {totalLessons === 1 ? "lesson" : "lessons"}
              </span>

              {isInProgress && !isCompleted && (
                <span className="flex items-center gap-1 text-blue-600 font-medium">
                  <Clock className="w-3 h-3" />
                  In Progress
                </span>
              )}

              {!isInProgress && !isCompleted && (
                <span className="text-muted-foreground">Not Started</span>
              )}
            </div>

            {/* Progress Bar for In Progress */}
            {isInProgress && !isCompleted && (
              <div className="mt-3">
                <Progress value={course.completionPercent} className="h-1.5" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
```

---

### Task 3.3: Study Streak Widget (4 hours)

**New file to create:**
- `src/app/components/StudyStreak.tsx`
- `src/lib/studyStreak.ts`

```tsx
// studyStreak.ts
import { getAllStudyLogs } from "./studyLog"

export function getStudyStreak(): {
  current: number
  longest: number
  lastStudyDate: string | null
} {
  const logs = getAllStudyLogs()
  if (logs.length === 0) {
    return { current: 0, longest: 0, lastStudyDate: null }
  }

  // Get unique study dates
  const studyDates = new Set(
    logs.map((log) => new Date(log.timestamp).toDateString())
  )

  const sortedDates = Array.from(studyDates)
    .map((d) => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime())

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 1

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Check if studied today or yesterday for current streak
  const lastStudy = sortedDates[0]
  lastStudy.setHours(0, 0, 0, 0)

  if (
    lastStudy.getTime() === today.getTime() ||
    lastStudy.getTime() === yesterday.getTime()
  ) {
    currentStreak = 1

    // Count consecutive days
    for (let i = 1; i < sortedDates.length; i++) {
      const current = new Date(sortedDates[i])
      current.setHours(0, 0, 0, 0)

      const prev = new Date(sortedDates[i - 1])
      prev.setHours(0, 0, 0, 0)

      const diffDays = (prev.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)

      if (diffDays === 1) {
        currentStreak++
      } else {
        break
      }
    }
  }

  // Calculate longest streak
  for (let i = 1; i < sortedDates.length; i++) {
    const current = new Date(sortedDates[i])
    current.setHours(0, 0, 0, 0)

    const prev = new Date(sortedDates[i - 1])
    prev.setHours(0, 0, 0, 0)

    const diffDays = (prev.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)

    if (diffDays === 1) {
      tempStreak++
    } else {
      longestStreak = Math.max(longestStreak, tempStreak)
      tempStreak = 1
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak, currentStreak)

  return {
    current: currentStreak,
    longest: longestStreak,
    lastStudyDate: sortedDates[0]?.toISOString() || null,
  }
}
```

```tsx
// StudyStreak.tsx
import { Card, CardContent } from "@/app/components/ui/card"
import { Flame } from "lucide-react"

interface StudyStreakProps {
  current: number
  longest: number
}

export function StudyStreak({ current, longest }: StudyStreakProps) {
  const getMessage = () => {
    if (current === 0) return "Start your streak today!"
    if (current === 1) return "Great start!"
    if (current < 7) return "Keep it up!"
    if (current < 30) return "You're on fire!"
    return "Unstoppable! 🏆"
  }

  const getFlameSize = () => {
    if (current >= 30) return "w-12 h-12"
    if (current >= 7) return "w-10 h-10"
    return "w-8 h-8"
  }

  return (
    <Card className="bg-gradient-to-r from-orange-50 via-red-50 to-pink-50 dark:from-orange-950/30 dark:via-red-950/30 dark:to-pink-950/30 border-2 border-orange-200 dark:border-orange-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center justify-center transition-all duration-300 ${getFlameSize()}`}
          >
            <Flame className="w-full h-full text-orange-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-muted-foreground">
              Study Streak
            </p>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-500">
              {current} {current === 1 ? "day" : "days"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {getMessage()}
            </p>
            {longest > current && (
              <p className="text-xs text-muted-foreground">
                Longest: {longest} days
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Phase 4: Advanced Features (Week 4) - 12 hours

### Task 4.1: Progress Chart (6 hours)

Install chart library:
```bash
npm install recharts
```

**New file to create:**
- `src/app/components/charts/ProgressChart.tsx`

```tsx
import { Card, CardContent } from "@/app/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface ProgressChartProps {
  data: { date: string; lessons: number }[]
}

export function ProgressChart({ data }: ProgressChartProps) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Learning Progress</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
              />
              <YAxis stroke="#6b7280" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="lessons"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Testing Checklist

After each phase, verify:

### Visual Testing
- [ ] All cards have consistent rounded corners (16-24px)
- [ ] Hover effects are smooth (200-300ms)
- [ ] Cursor changes to pointer on interactive elements
- [ ] Colors have sufficient contrast (4.5:1 minimum)
- [ ] Gradients render correctly in light and dark mode
- [ ] Icons are properly sized and aligned

### Functional Testing
- [ ] Loading states show before content
- [ ] Empty states display when appropriate
- [ ] Links navigate to correct pages
- [ ] Stats update when progress changes
- [ ] Trends show correct direction (up/down)
- [ ] Sparklines reflect actual data
- [ ] Streak calculates correctly

### Accessibility Testing
- [ ] Keyboard navigation works (Tab through all elements)
- [ ] Screen reader announces content correctly
- [ ] Focus states are visible
- [ ] Color is not the only indicator
- [ ] All images have alt text
- [ ] ARIA labels on icon buttons

### Performance Testing
- [ ] Page loads in < 3 seconds
- [ ] No layout shift (CLS < 0.1)
- [ ] Images lazy load
- [ ] Animations respect prefers-reduced-motion

### Responsive Testing
Verify at breakpoints:
- [ ] 375px (mobile)
- [ ] 768px (tablet)
- [ ] 1024px (laptop)
- [ ] 1440px (desktop)

---

## Deployment Checklist

Before deploying to production:

- [ ] Run Playwright tests: `npx playwright test`
- [ ] Check Lighthouse score (aim for > 90)
- [ ] Verify dark mode works
- [ ] Test on multiple browsers (Chrome, Safari, Firefox)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Review accessibility with axe DevTools
- [ ] Ensure all console errors are resolved
- [ ] Verify no broken images or links
- [ ] Test with slow 3G network
- [ ] Confirm localStorage works correctly

---

## Success Metrics

Track these metrics before and after implementation:

**User Engagement:**
- Daily Active Users (DAU)
- Average session duration
- Pages per session
- Return visit rate

**Learning Metrics:**
- Course completion rate
- Lessons completed per week
- Study streak average
- Notes created per course

**Technical Metrics:**
- Page load time (aim < 2s)
- Time to Interactive (aim < 3s)
- Cumulative Layout Shift (aim < 0.1)
- First Contentful Paint (aim < 1.5s)

---

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Recharts Documentation](https://recharts.org)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web.dev Performance Guide](https://web.dev/performance/)

---

**Last Updated:** February 13, 2026
**Status:** Ready for Implementation
