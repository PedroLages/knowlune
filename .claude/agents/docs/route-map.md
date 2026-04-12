# Knowlune Route Map

Canonical reference for all agents that need route-to-file mapping.

| File Pattern | Route | Key Features |
|-------------|-------|-------------|
| `Overview.tsx` | `/` | Dashboard cards, streak tracker, recent activity, quick actions |
| `MyClass.tsx` | `/my-class` | Enrolled courses, progress bars, continue learning |
| `Courses.tsx` | `/courses` | Course catalog, filtering, search, category tabs |
| `CourseDetail.tsx` | `/courses/:id` | Course info, module accordion, enrollment, syllabus |
| `LearningPathDetail.tsx` | `/learning-path/:id` | Path overview, course sequence, progress |
| `LessonPlayer.tsx` | `/lesson/:id` | Video player, notes, quiz, completion |
| `Authors.tsx` | `/authors` | Author cards, filtering, search |
| `AuthorDetail.tsx` | `/authors/:id` | Author bio, courses by author |
| `Reports.tsx` | `/reports` | Analytics charts, study time, achievements |
| `Settings.tsx` | `/settings` | Profile, preferences, API keys, theme |

**Dev server:** `http://localhost:5173`
**Performance baseline:** `docs/reviews/performance/baseline.json`