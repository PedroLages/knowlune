import React, { Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './components/Layout'
import { DelayedFallback } from './components/DelayedFallback'
import { Skeleton } from './components/ui/skeleton'

// Lazy-loaded page components (code-splitting)
// Named exports need .then(m => ({ default: m.ExportName }))
const Overview = React.lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })))
const Courses = React.lazy(() => import('./pages/Courses').then(m => ({ default: m.Courses })))
const CourseDetail = React.lazy(() =>
  import('./pages/CourseDetail').then(m => ({ default: m.CourseDetail }))
)
const LessonPlayer = React.lazy(() =>
  import('./pages/LessonPlayer').then(m => ({ default: m.LessonPlayer }))
)
const ImportedCourseDetail = React.lazy(() =>
  import('./pages/ImportedCourseDetail').then(m => ({ default: m.ImportedCourseDetail }))
)
const ImportedLessonPlayer = React.lazy(() =>
  import('./pages/ImportedLessonPlayer').then(m => ({ default: m.ImportedLessonPlayer }))
)
const Notes = React.lazy(() => import('./pages/Notes').then(m => ({ default: m.Notes })))
const ChatQA = React.lazy(() => import('./pages/ChatQA').then(m => ({ default: m.ChatQA })))
const Instructors = React.lazy(() =>
  import('./pages/Instructors').then(m => ({ default: m.Instructors }))
)
const InstructorProfile = React.lazy(() =>
  import('./pages/InstructorProfile').then(m => ({ default: m.InstructorProfile }))
)
const SessionHistory = React.lazy(() =>
  import('./pages/SessionHistory').then(m => ({ default: m.SessionHistory }))
)
const Challenges = React.lazy(() =>
  import('./pages/Challenges').then(m => ({ default: m.Challenges }))
)
const WebLLMTest = React.lazy(() => import('../experiments/WebLLMTest'))
// Temporarily commented out - causing Mobile Safari module loading failures in CI
// const WebLLMPerformanceTest = React.lazy(() => import('../experiments/WebLLMPerformanceTest'))
const AILearningPath = React.lazy(() =>
  import('./pages/AILearningPath').then(m => ({ default: m.AILearningPath }))
)
const KnowledgeGaps = React.lazy(() =>
  import('./pages/KnowledgeGaps').then(m => ({ default: m.KnowledgeGaps }))
)
const ReviewQueue = React.lazy(() =>
  import('./pages/ReviewQueue').then(m => ({ default: m.ReviewQueue }))
)
const RetentionDashboard = React.lazy(() =>
  import('./pages/RetentionDashboard').then(m => ({ default: m.RetentionDashboard }))
)
const InterleavedReview = React.lazy(() =>
  import('./pages/InterleavedReview').then(m => ({ default: m.InterleavedReview }))
)
const Quiz = React.lazy(() => import('./pages/Quiz').then(m => ({ default: m.Quiz })))

// Default exports work directly with React.lazy
const MyClass = React.lazy(() => import('./pages/MyClass'))
const Messages = React.lazy(() => import('./pages/Messages'))
const Reports = React.lazy(() => import('./pages/Reports'))
const Settings = React.lazy(() => import('./pages/Settings'))

function PageLoader() {
  return (
    <DelayedFallback>
      <div role="status" className="space-y-6 p-1" aria-busy="true" aria-label="Loading page">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-[24px]" />
      </div>
    </DelayedFallback>
  )
}

function SuspensePage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      {
        index: true,
        element: (
          <SuspensePage>
            <Overview />
          </SuspensePage>
        ),
      },
      {
        path: 'my-class',
        element: (
          <SuspensePage>
            <MyClass />
          </SuspensePage>
        ),
      },
      {
        path: 'courses',
        element: (
          <SuspensePage>
            <Courses />
          </SuspensePage>
        ),
      },
      {
        path: 'courses/:courseId',
        element: (
          <SuspensePage>
            <CourseDetail />
          </SuspensePage>
        ),
      },
      {
        path: 'courses/:courseId/:lessonId',
        element: (
          <SuspensePage>
            <LessonPlayer />
          </SuspensePage>
        ),
      },
      {
        path: 'courses/:courseId/lessons/:lessonId/quiz',
        element: (
          <SuspensePage>
            <Quiz />
          </SuspensePage>
        ),
      },
      {
        path: 'imported-courses/:courseId',
        element: (
          <SuspensePage>
            <ImportedCourseDetail />
          </SuspensePage>
        ),
      },
      {
        path: 'imported-courses/:courseId/lessons/:lessonId',
        element: (
          <SuspensePage>
            <ImportedLessonPlayer />
          </SuspensePage>
        ),
      },
      {
        path: 'library',
        element: <Navigate to="/notes?tab=bookmarks" replace />,
      },
      {
        path: 'notes',
        element: (
          <SuspensePage>
            <Notes />
          </SuspensePage>
        ),
      },
      {
        path: 'notes/chat',
        element: (
          <SuspensePage>
            <ChatQA />
          </SuspensePage>
        ),
      },
      {
        path: 'messages',
        element: (
          <SuspensePage>
            <Messages />
          </SuspensePage>
        ),
      },
      {
        path: 'instructors',
        element: (
          <SuspensePage>
            <Instructors />
          </SuspensePage>
        ),
      },
      {
        path: 'instructors/:instructorId',
        element: (
          <SuspensePage>
            <InstructorProfile />
          </SuspensePage>
        ),
      },
      {
        path: 'challenges',
        element: (
          <SuspensePage>
            <Challenges />
          </SuspensePage>
        ),
      },
      {
        path: 'session-history',
        element: (
          <SuspensePage>
            <SessionHistory />
          </SuspensePage>
        ),
      },
      {
        path: 'reports',
        element: (
          <SuspensePage>
            <Reports />
          </SuspensePage>
        ),
      },
      {
        path: 'settings',
        element: (
          <SuspensePage>
            <Settings />
          </SuspensePage>
        ),
      },
      {
        path: 'ai-learning-path',
        element: (
          <SuspensePage>
            <AILearningPath />
          </SuspensePage>
        ),
      },
      {
        path: 'knowledge-gaps',
        element: (
          <SuspensePage>
            <KnowledgeGaps />
          </SuspensePage>
        ),
      },
      {
        path: 'review',
        element: (
          <SuspensePage>
            <ReviewQueue />
          </SuspensePage>
        ),
      },
      {
        path: 'review/interleaved',
        element: (
          <SuspensePage>
            <InterleavedReview />
          </SuspensePage>
        ),
      },
      {
        path: 'retention',
        element: (
          <SuspensePage>
            <RetentionDashboard />
          </SuspensePage>
        ),
      },
      {
        path: 'webllm-test',
        element: (
          <SuspensePage>
            <WebLLMTest />
          </SuspensePage>
        ),
      },
      // Temporarily commented out - WebLLMPerformanceTest causing Mobile Safari failures
      // {
      //   path: 'webllm-perf',
      //   element: (
      //     <SuspensePage>
      //       <WebLLMPerformanceTest />
      //     </SuspensePage>
      //   ),
      // },
    ],
  },
])
