# Reference Tables

## Route Map

Map changed files to routes for design review context:

| Source file pattern | Route | Page |
|---|---|---|
| `pages/Overview.tsx` | `/` | Dashboard overview |
| `pages/MyClass.tsx` | `/my-class` | Current class |
| `pages/Courses.tsx` | `/courses` | Course library |
| `pages/CourseDetail.tsx` | `/courses/:courseId` | Course detail |
| `pages/LessonPlayer.tsx` | `/courses/:courseId/:lessonId` | Lesson player |
| `pages/Library.tsx` | `/library` | Content library |
| `pages/Messages.tsx` | `/messages` | Messages |
| `pages/Instructors.tsx` | `/instructors` | Instructors |
| `pages/Reports.tsx` | `/reports` | Reports & analytics |
| `pages/Settings.tsx` | `/settings` | Settings |

## LevelUp Stack Patterns

| Story content | Pattern |
|---|---|
| UI pages/routes | React Router v7 + lazy loading in `routes.tsx` |
| Local storage | Dexie.js (IndexedDB) — `${PATHS.db}/` |
| State management | Zustand stores — `${PATHS.stores}/` |
| UI components | shadcn/ui (Radix) — `${PATHS.components}/ui/` |
| Custom components | `${PATHS.components}/figma/` |
| Styling | Tailwind CSS v4 utilities + `theme.css` tokens |
| Icons | Lucide React |
| File access | File System Access API — `${PATHS.lib}/fileSystem.ts` |

## Branch Naming

| Story ID | Branch |
|---|---|
| E01-S03 | `feature/e01-s03-organize-courses-by-topic` |
| E02-S01 | `feature/e02-s01-lesson-player-page-video-playback` |
