import React, { Suspense } from 'react'
import { createBrowserRouter, Navigate, useParams } from 'react-router'
import { Layout } from './components/Layout'
import { DelayedFallback } from './components/DelayedFallback'
import { Skeleton } from './components/ui/skeleton'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { PremiumFeaturePage, PREMIUM_FEATURES } from './components/PremiumFeaturePage'
import { MessageSquare, Sparkles, Brain, RotateCcw, Shuffle, BarChart3, Layers } from 'lucide-react'

// Lazy-loaded page components (code-splitting)
// Named exports need .then(m => ({ default: m.ExportName }))
const Overview = React.lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })))
const Courses = React.lazy(() => import('./pages/Courses').then(m => ({ default: m.Courses })))
const UnifiedCourseDetail = React.lazy(() =>
  import('./pages/UnifiedCourseDetail').then(m => ({ default: m.UnifiedCourseDetail }))
)
const UnifiedLessonPlayer = React.lazy(() =>
  import('./pages/UnifiedLessonPlayer').then(m => ({ default: m.UnifiedLessonPlayer }))
)
const Notes = React.lazy(() => import('./pages/Notes').then(m => ({ default: m.Notes })))
const ChatQA = React.lazy(() => import('./pages/ChatQA').then(m => ({ default: m.ChatQA })))
const Authors = React.lazy(() => import('./pages/Authors').then(m => ({ default: m.Authors })))
const AuthorProfile = React.lazy(() =>
  import('./pages/AuthorProfile').then(m => ({ default: m.AuthorProfile }))
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
const LearningPaths = React.lazy(() =>
  import('./pages/LearningPaths').then(m => ({ default: m.LearningPaths }))
)
const LearningPathDetail = React.lazy(() =>
  import('./pages/LearningPathDetail').then(m => ({ default: m.LearningPathDetail }))
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
const Flashcards = React.lazy(() =>
  import('./pages/Flashcards').then(m => ({ default: m.Flashcards }))
)
const InterleavedReview = React.lazy(() =>
  import('./pages/InterleavedReview').then(m => ({ default: m.InterleavedReview }))
)
const Quiz = React.lazy(() => import('./pages/Quiz').then(m => ({ default: m.Quiz })))
const QuizResults = React.lazy(() =>
  import('./pages/QuizResults').then(m => ({ default: m.QuizResults }))
)
const QuizReview = React.lazy(() =>
  import('./pages/QuizReview').then(m => ({ default: m.QuizReview }))
)
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })))
const Notifications = React.lazy(() =>
  import('./pages/Notifications').then(m => ({ default: m.Notifications }))
)
const NotFound = React.lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })))
const LegalLayout = React.lazy(() =>
  import('./pages/legal/LegalLayout').then(m => ({ default: m.LegalLayout }))
)
const PrivacyPolicy = React.lazy(() =>
  import('./pages/legal/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy }))
)
const TermsOfService = React.lazy(() =>
  import('./pages/legal/TermsOfService').then(m => ({ default: m.TermsOfService }))
)

// Default exports work directly with React.lazy
const MyClass = React.lazy(() => import('./pages/MyClass'))
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
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </RouteErrorBoundary>
  )
}

/** Preserves :authorId param when redirecting /instructors/:authorId → /authors/:authorId */
function InstructorProfileRedirect() {
  const { authorId } = useParams()
  return <Navigate to={`/authors/${authorId}`} replace />
}

// TODO: Remove redirect after Epic E91+ — old imported-courses paths
/** Redirects /imported-courses/:courseId → /courses/:courseId */
function ImportedCourseRedirect() {
  const { courseId } = useParams()
  return <Navigate to={`/courses/${courseId}`} replace />
}

// TODO: Remove redirect after Epic E91+ — old imported-courses lesson paths
/** Redirects /imported-courses/:courseId/lessons/:lessonId → /courses/:courseId/lessons/:lessonId */
function ImportedLessonRedirect() {
  const { courseId, lessonId } = useParams()
  return <Navigate to={`/courses/${courseId}/lessons/${lessonId}`} replace />
}

// TODO: Remove redirect after Epic E91+ — old youtube-courses paths
/** Redirects /youtube-courses/:courseId → /courses/:courseId */
function YouTubeCourseRedirect() {
  const { courseId } = useParams()
  return <Navigate to={`/courses/${courseId}`} replace />
}

// TODO: Remove redirect after Epic E91+ — old youtube-courses lesson paths
/** Redirects /youtube-courses/:courseId/lessons/:lessonId → /courses/:courseId/lessons/:lessonId */
function YouTubeLessonRedirect() {
  const { courseId, lessonId } = useParams()
  return <Navigate to={`/courses/${courseId}/lessons/${lessonId}`} replace />
}

export const router = createBrowserRouter([
  // Public legal pages — outside Layout (no auth required)
  {
    element: (
      <Suspense fallback={<PageLoader />}>
        <LegalLayout />
      </Suspense>
    ),
    children: [
      {
        path: 'privacy',
        element: (
          <SuspensePage>
            <PrivacyPolicy />
          </SuspensePage>
        ),
      },
      {
        path: 'terms',
        element: (
          <SuspensePage>
            <TermsOfService />
          </SuspensePage>
        ),
      },
    ],
  },
  // Standalone login page — outside Layout (no sidebar/header)
  {
    path: 'login',
    element: (
      <SuspensePage>
        <Login />
      </SuspensePage>
    ),
  },
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
      // Dead regular course routes removed (E89-S01)
      // Quiz sub-routes kept alive — re-wired in E89-S09
      {
        path: 'courses/:courseId/lessons/:lessonId/quiz',
        element: (
          <SuspensePage>
            <Quiz />
          </SuspensePage>
        ),
      },
      {
        path: 'courses/:courseId/lessons/:lessonId/quiz/results',
        element: (
          <SuspensePage>
            <QuizResults />
          </SuspensePage>
        ),
      },
      {
        path: 'courses/:courseId/lessons/:lessonId/quiz/review/:attemptId',
        element: (
          <SuspensePage>
            <QuizReview />
          </SuspensePage>
        ),
      },
      // Unified course routes (E89-S03)
      {
        path: 'courses/:courseId',
        element: (
          <SuspensePage>
            <UnifiedCourseDetail />
          </SuspensePage>
        ),
      },
      {
        path: 'courses/:courseId/lessons/:lessonId',
        element: (
          <SuspensePage>
            <UnifiedLessonPlayer />
          </SuspensePage>
        ),
      },
      // TODO: Remove redirect after Epic E91+ — old imported-courses paths
      {
        path: 'imported-courses/:courseId',
        element: <ImportedCourseRedirect />,
      },
      // TODO: Remove redirect after Epic E91+ — old imported-courses lesson paths
      {
        path: 'imported-courses/:courseId/lessons/:lessonId',
        element: <ImportedLessonRedirect />,
      },
      // TODO: Remove redirect after Epic E91+ — old youtube-courses paths
      {
        path: 'youtube-courses/:courseId',
        element: <YouTubeCourseRedirect />,
      },
      // TODO: Remove redirect after Epic E91+ — old youtube-courses lesson paths
      {
        path: 'youtube-courses/:courseId/lessons/:lessonId',
        element: <YouTubeLessonRedirect />,
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
            <PremiumFeaturePage {...PREMIUM_FEATURES.chatQA} icon={MessageSquare}>
              <ChatQA />
            </PremiumFeaturePage>
          </SuspensePage>
        ),
      },
      {
        path: 'authors',
        element: (
          <SuspensePage>
            <Authors />
          </SuspensePage>
        ),
      },
      {
        path: 'authors/:authorId',
        element: (
          <SuspensePage>
            <AuthorProfile />
          </SuspensePage>
        ),
      },
      // Legacy redirects: /instructors → /authors (E23-S03 rename)
      {
        path: 'instructors',
        element: <Navigate to="/authors" replace />,
      },
      {
        path: 'instructors/:authorId',
        element: <InstructorProfileRedirect />,
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
      // Legacy path-based redirects → query-param tabs (E27-S02)
      {
        path: 'reports/study',
        element: <Navigate to="/reports?tab=study" replace />,
      },
      {
        path: 'reports/quizzes',
        element: <Navigate to="/reports?tab=quizzes" replace />,
      },
      {
        path: 'reports/ai',
        element: <Navigate to="/reports?tab=ai" replace />,
      },
      {
        path: 'notifications',
        element: (
          <SuspensePage>
            <Notifications />
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
        path: 'learning-paths',
        element: (
          <SuspensePage>
            <LearningPaths />
          </SuspensePage>
        ),
      },
      {
        path: 'learning-paths/:pathId',
        element: (
          <SuspensePage>
            <LearningPathDetail />
          </SuspensePage>
        ),
      },
      {
        path: 'ai-learning-path',
        element: (
          <SuspensePage>
            <PremiumFeaturePage {...PREMIUM_FEATURES.aiLearningPath} icon={Sparkles}>
              <AILearningPath />
            </PremiumFeaturePage>
          </SuspensePage>
        ),
      },
      {
        path: 'knowledge-gaps',
        element: (
          <SuspensePage>
            <PremiumFeaturePage {...PREMIUM_FEATURES.knowledgeGaps} icon={Brain}>
              <KnowledgeGaps />
            </PremiumFeaturePage>
          </SuspensePage>
        ),
      },
      {
        path: 'review',
        element: (
          <SuspensePage>
            <PremiumFeaturePage {...PREMIUM_FEATURES.reviewQueue} icon={RotateCcw}>
              <ReviewQueue />
            </PremiumFeaturePage>
          </SuspensePage>
        ),
      },
      {
        path: 'review/interleaved',
        element: (
          <SuspensePage>
            <PremiumFeaturePage {...PREMIUM_FEATURES.interleavedReview} icon={Shuffle}>
              <InterleavedReview />
            </PremiumFeaturePage>
          </SuspensePage>
        ),
      },
      {
        path: 'retention',
        element: (
          <SuspensePage>
            <PremiumFeaturePage {...PREMIUM_FEATURES.retentionDashboard} icon={BarChart3}>
              <RetentionDashboard />
            </PremiumFeaturePage>
          </SuspensePage>
        ),
      },
      {
        path: 'flashcards',
        element: (
          <SuspensePage>
            <PremiumFeaturePage {...PREMIUM_FEATURES.flashcards} icon={Layers}>
              <Flashcards />
            </PremiumFeaturePage>
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
      {
        path: '*',
        element: (
          <SuspensePage>
            <NotFound />
          </SuspensePage>
        ),
      },
    ],
  },
])
