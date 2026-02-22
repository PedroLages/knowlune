import React, { Suspense } from 'react'
import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'

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
const Library = React.lazy(() => import('./pages/Library').then(m => ({ default: m.Library })))
const Instructors = React.lazy(() =>
  import('./pages/Instructors').then(m => ({ default: m.Instructors }))
)

// Default exports work directly with React.lazy
const MyClass = React.lazy(() => import('./pages/MyClass'))
const Messages = React.lazy(() => import('./pages/Messages'))
const Reports = React.lazy(() => import('./pages/Reports'))
const Settings = React.lazy(() => import('./pages/Settings'))

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
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
        element: (
          <SuspensePage>
            <Library />
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
    ],
  },
])
