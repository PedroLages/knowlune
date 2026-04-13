import React, { Suspense } from 'react'
import { createBrowserRouter, Navigate, useParams, useLocation } from 'react-router'
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
const CourseOverview = React.lazy(() =>
  import('./pages/CourseOverview').then(m => ({ default: m.CourseOverview }))
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
const LibraryPage = React.lazy(() => import('./pages/Library').then(m => ({ default: m.Library })))
const CollectionDetail = React.lazy(() =>
  import('./pages/CollectionDetail').then(m => ({ default: m.CollectionDetail }))
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

// E84: EPUB Reader — code-split, outside Layout (full-viewport)
const BookReader = React.lazy(() =>
  import('./pages/BookReader').then(m => ({ default: m.BookReader }))
)

// E86-S02: Highlight Review — daily highlight surfacing page
const HighlightReview = React.lazy(() =>
  import('./pages/HighlightReview').then(m => ({ default: m.HighlightReview }))
)

// E109-S01: Vocabulary Builder — word list and flashcard-style review
const Vocabulary = React.lazy(() =>
  import('./pages/Vocabulary').then(m => ({ default: m.Vocabulary }))
)

// E109-S04: Annotation Summary — per-book highlight/note summary view
const AnnotationSummary = React.lazy(() =>
  import('./pages/AnnotationSummary').then(m => ({ default: m.AnnotationSummary }))
)

// E109-S05: Cross-book Search — search highlights and vocabulary across all books
const SearchAnnotations = React.lazy(() =>
  import('./pages/SearchAnnotations').then(m => ({ default: m.SearchAnnotations }))
)

// E56-S04: Knowledge Map — dedicated full-page knowledge map
const KnowledgeMap = React.lazy(() =>
  import('./pages/KnowledgeMap').then(m => ({ default: m.KnowledgeMap }))
)

// E57-S01: AI Tutor — standalone tutor page
const Tutor = React.lazy(() => import('./pages/Tutor').then(m => ({ default: m.Tutor })))

function PageLoader() {
  return (
    <DelayedFallback>
      <div role="status" className="space-y-6 p-1" aria-busy="true" aria-label="Loading page">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
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
  const { search, hash } = useLocation()
  return <Navigate to={`/authors/${authorId}${search}${hash}`} replace />
}

// TODO: Remove redirect after Epic E91+ — old imported-courses paths
/** Redirects /imported-courses/:courseId → /courses/:courseId */
function ImportedCourseRedirect() {
  const { courseId } = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={`/courses/${courseId}${search}${hash}`} replace />
}

// TODO: Remove redirect after Epic E91+ — old imported-courses lesson paths
/** Redirects /imported-courses/:courseId/lessons/:lessonId → /courses/:courseId/lessons/:lessonId */
function ImportedLessonRedirect() {
  const { courseId, lessonId } = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={`/courses/${courseId}/lessons/${lessonId}${search}${hash}`} replace />
}

// TODO: Remove redirect after Epic E91+ — old youtube-courses paths
/** Redirects /youtube-courses/:courseId → /courses/:courseId */
function YouTubeCourseRedirect() {
  const { courseId } = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={`/courses/${courseId}${search}${hash}`} replace />
}

// TODO: Remove redirect after Epic E91+ — old youtube-courses lesson paths
/** Redirects /youtube-courses/:courseId/lessons/:lessonId → /courses/:courseId/lessons/:lessonId */
function YouTubeLessonRedirect() {
  const { courseId, lessonId } = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={`/courses/${courseId}/lessons/${lessonId}${search}${hash}`} replace />
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
  // E84: EPUB Reader — full-viewport, outside Layout (no sidebar/header)
  {
    path: 'library/:bookId/read',
    element: (
      <SuspensePage>
        <BookReader />
      </SuspensePage>
    ),
  },
  // E86-S02: Highlight Review — daily highlight review page (inside Layout for nav access)
  {
    path: 'highlight-review',
    Component: Layout,
    children: [
      {
        index: true,
        element: (
          <SuspensePage>
            <HighlightReview />
          </SuspensePage>
        ),
      },
    ],
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
      // Course overview page (E91-S10)
      {
        path: 'courses/:courseId/overview',
        element: (
          <SuspensePage>
            <CourseOverview />
          </SuspensePage>
        ),
      },
      // Course detail — rich overview with cinematic hero (replaces flat UnifiedCourseDetail)
      {
        path: 'courses/:courseId',
        element: (
          <SuspensePage>
            <CourseOverview />
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
        element: (
          <SuspensePage>
            <LibraryPage />
          </SuspensePage>
        ),
      },
      {
        path: 'library/collection/:collectionId',
        element: (
          <SuspensePage>
            <CollectionDetail />
          </SuspensePage>
        ),
      },
      {
        path: 'library/:bookId',
        element: (
          <SuspensePage>
            <LibraryPage />
          </SuspensePage>
        ),
      },
      {
        path: 'library/:bookId/annotations',
        element: (
          <SuspensePage>
            <AnnotationSummary />
          </SuspensePage>
        ),
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
        path: 'knowledge-map',
        element: (
          <SuspensePage>
            <KnowledgeMap />
          </SuspensePage>
        ),
      },
      {
        path: 'tutor',
        element: (
          <SuspensePage>
            <Tutor />
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
        path: 'search-annotations',
        element: (
          <SuspensePage>
            <SearchAnnotations />
          </SuspensePage>
        ),
      },
      {
        path: 'vocabulary',
        element: (
          <SuspensePage>
            <Vocabulary />
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
