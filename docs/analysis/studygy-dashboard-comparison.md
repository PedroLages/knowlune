# StudyGy-Dashboard Comprehensive Analysis & Comparison with LevelUp

**Analysis Date:** March 13, 2026
**Analyzed Version:** StudyGy-Dashboard (unversioned)
**LevelUp Version:** Current main branch

---

## Executive Summary

StudyGy-Dashboard is a modern React-based learning management platform built with a minimal tech stack (React 19, TypeScript, Vite, Lucide icons). It emphasizes **career-focused productivity tools** (Pomodoro, flashcards, career paths) with a clean, card-based UI design.

LevelUp is a comprehensive **learning analytics and AI platform** with advanced progress tracking, machine learning models, semantic search, and imported video support, built on a production-grade stack (React Router v7, shadcn/ui, IndexedDB, Zustand).

**Key Insight:** Both apps solve similar learning management problems but with different philosophical approaches:
- **StudyGy**: Productivity-first (study tools, career planning, skill visualization)
- **LevelUp**: Analytics-first (momentum scoring, AI summaries, session tracking)

---

## 1. Architecture Comparison

### Tech Stack

| Component | StudyGy-Dashboard | LevelUp |
|-----------|-------------------|---------|
| **React** | 19.2.4 (Latest) | 18.3.1 |
| **TypeScript** | ~5.8.2 | 5.x |
| **Build Tool** | Vite 6.2.0 (port 3000) | Vite 6.3.5 (port 5173) |
| **Routing** | Manual view switching | React Router v7 |
| **State** | useState + localStorage | Zustand + IndexedDB (dexie) |
| **UI Library** | None (custom components) | shadcn/ui (50+ components) |
| **Styling** | Tailwind CSS (inline) | Tailwind v4 + CSS variables |
| **Icons** | Lucide React 0.574.0 | Lucide React |
| **Charts** | Custom SVG | Recharts |
| **Animation** | CSS transitions | Framer Motion |
| **Data Persistence** | Mock data (constants.ts) | IndexedDB + localStorage |

### Code Organization

**StudyGy-Dashboard Structure:**
```
StudyGy-Dashboard/
├── App.tsx              (161 lines - state orchestration)
├── index.tsx            (entry point)
├── types.ts             (domain models)
├── constants.ts         (234 lines - all mock data)
├── vite.config.ts
└── components/          (16 components)
    ├── Dashboard.tsx    (340 lines)
    ├── LessonView.tsx   (866 lines - feature-complete)
    ├── Analytics.tsx    (420 lines)
    ├── Header.tsx       (255 lines)
    └── [12 more components]
```

**LevelUp Structure:**
```
src/
├── app/
│   ├── App.tsx
│   ├── routes.tsx       (17 routes)
│   ├── pages/           (17 page components)
│   └── components/
│       ├── ui/          (50+ shadcn/ui components)
│       └── figma/       (custom components)
├── lib/                 (utilities, stores, services)
└── styles/
    ├── theme.css        (50+ design tokens)
    └── tailwind.css
```

### Key Architectural Differences

#### 1. **Navigation Model**

**StudyGy:** State-based view switching
```typescript
const [currentView, setCurrentView] = useState('overview');

switch (currentView) {
  case 'overview': return <Dashboard />;
  case 'library': return <Library />;
  // ... 6 more views
}
```
- ❌ No URL-based routing
- ❌ Browser back button doesn't work
- ❌ Refresh loses navigation state
- ✅ Simple implementation, no router dependency

**LevelUp:** React Router v7 with nested routes
```typescript
// routes.tsx
export const routes = [
  { path: '/', element: <Overview /> },
  { path: '/courses', element: <Courses /> },
  // ... 15 more routes
]
```
- ✅ URL-based navigation with deep linking
- ✅ Browser back/forward works
- ✅ Shareable URLs
- ✅ Code splitting with lazy routes

#### 2. **State Management**

**StudyGy:** Component-level useState with props drilling
- Root state in App.tsx (5 useState hooks)
- Heavy callback props (`onCourseSelect`, `onNavigate`, `onBack`)
- LessonView.tsx has 23 useState hooks (video, notes, flashcards)
- No global state container

**LevelUp:** Zustand stores + IndexedDB
- Persistent state in IndexedDB
- Global stores for courses, sessions, progress
- React Context for theme
- Time-series data tracking

#### 3. **Data Persistence**

**StudyGy:**
- All data in `constants.ts` (234 lines of mock data)
- Theme saved to localStorage only
- Session-only state (lost on refresh)
- No backend integration (README mentions GEMINI_API_KEY but unused)

**LevelUp:**
- IndexedDB for courses, sessions, notes, progress
- localStorage for theme + sidebar state
- Persistent study history (365 days tracked)
- OpenAI API integration for video summaries
- Vector embeddings for semantic search

---

## 2. Feature Comparison Matrix

### Shared Features (Both Apps)

| Feature | StudyGy | LevelUp | Notes |
|---------|---------|---------|-------|
| Dashboard/Overview | ✅ | ✅ | Both show greeting + stats |
| Course Catalog | ✅ Library | ✅ Courses | Browse/filter/search |
| Course Details | ✅ | ✅ | Metadata + syllabus |
| Video Player | ✅ Custom | ✅ Embedded + Custom | StudyGy has AB-loop |
| Progress Tracking | ✅ | ✅ | Per-course + per-lesson |
| Study Notes | ✅ Timestamped | ✅ Searchable | Both support markdown |
| Statistics | ✅ 4 metrics | ✅ 5 metrics | Courses, hours, streak |
| User Settings | ✅ | ✅ | Profile, notifications |
| Search | ✅ | ✅ | Courses + paths |
| Dark Mode | ✅ | ✅ | StudyGy: React state, LevelUp: CSS tokens |

### StudyGy-Exclusive Features (13 unique)

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Career Paths** | Curated multi-course learning journeys | Paths.tsx + PathDetail.tsx |
| **Analytics Dashboard** | Area/bar/donut charts for learning data | Analytics.tsx (420 lines) |
| **Pomodoro Timer** | 25min focus / 5min break with audio | Tools.tsx |
| **Flashcards** | Spaced repetition study cards | Tools.tsx + LessonView modal |
| **Study Tools Hub** | Combined Pomodoro + flashcards page | Tools.tsx |
| **Skill Radar Chart** | Spider chart showing 5 skill proficiencies | Dashboard.tsx (custom SVG) |
| **Activity Heatmap** | 365-day contribution graph (GitHub-style) | Dashboard.tsx |
| **Learning Feed** | In-progress courses view | Learning.tsx |
| **Course Reviews** | User ratings display | Dashboard.tsx |
| **Favorites** | Bookmarked courses with filter/sort | Favorites.tsx |
| **Watch Folders** | Local filesystem monitoring for courses | Library.tsx |
| **Balance/Currency** | In-app learning currency system | User model (1000 balance) |
| **Video AB-Loop** | Repeat specific video sections | LessonView.tsx |

### LevelUp-Exclusive Features (19 unique)

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Session History** | Complete study session tracking | SessionHistory.tsx |
| **Journal (Messages)** | Personal journal entries | Messages.tsx |
| **AI Video Summaries** | OpenAI-generated lesson summaries | OpenAI integration |
| **Challenges** | Course-based quizzes | Challenges.tsx |
| **Imported Courses** | External video import support | ImportedCourseDetail.tsx |
| **Achievement Badges** | Milestone badge system | AchievementBanner.tsx |
| **Study Streak Calendar** | 26-week streak visualization | StudyStreakCalendar.tsx |
| **Study Goals Widget** | Learning goal tracking UI | StudyGoalsWidget.tsx |
| **Study Schedule Widget** | Suggested study time planning | StudyScheduleWidget.tsx |
| **Recent Activity Feed** | Timeline of completed lessons | RecentActivity.tsx |
| **Study History Calendar** | Month/week study history view | StudyHistoryCalendar.tsx |
| **Momentum Scoring** | Algorithm: engagement + velocity + consistency | calculateMomentumScore() |
| **At-Risk Detection** | Identifies stalled courses | calculateAtRiskStatus() |
| **Completion Estimates** | Finish date prediction | calculateCompletionEstimate() |
| **Quick Actions Bar** | Resume last lesson + shortcuts | QuickActions.tsx |
| **WebLLM Integration** | On-device LLM inference | WebLLMTest.tsx |
| **Note Search with RAG** | Semantic note search | searchNotesWithContext() |
| **Vector Search** | Brute-force k-NN vector database | vectorStorePersistence.ts (Epic 9) |
| **Continue Learning** | Resume last course from Overview | ContinueLearning.tsx |

### Feature Philosophy Comparison

**StudyGy Focus Areas:**
1. **Productivity Tools** - Pomodoro, flashcards, study goals
2. **Career Development** - Career paths, skill tracking, prerequisites
3. **Activity Visualization** - Heatmaps, radar charts, analytics

**LevelUp Focus Areas:**
1. **Learning Analytics** - Momentum scoring, at-risk detection, completion estimates
2. **AI Capabilities** - Summaries, semantic search, vector embeddings
3. **Progress Visualization** - Calendars, streaks, history timelines

---

## 3. Design System Analysis

### Color Palette

**StudyGy-Dashboard:**
- Background: `#F3F6F9` (light blue-gray)
- Dark background: `gray-900` (Tailwind default)
- Primary: Uses `bg-primary`/`text-primary` (no explicit definition)
- Chart colors: `#5F62E2` (indigo), `#F4C464` (yellow), `#10B981` (teal)
- ❌ No design token system
- ❌ Hardcoded hex values scattered across components
- ❌ Inconsistent dark mode color coordination

**LevelUp:**
- Background: `#FAF5EE` (warm off-white)
- 50+ CSS custom properties in `theme.css`
- Token examples:
  ```css
  --brand: #2563eb;
  --brand-hover: #1d4ed8;
  --success: #16a34a;
  --warning: #d97706;
  --destructive: #d4183d;
  ```
- ✅ Centralized token system
- ✅ OKLCH color space for dark mode consistency
- ✅ Paired light/dark definitions

### Typography

**StudyGy-Dashboard:**
- System fonts only (`font-sans`)
- Tailwind default sizes (xs, sm, base, lg, xl, 2xl, 3xl, 5xl)
- No explicit font definitions
- Inconsistent line-heights

**LevelUp:**
- Custom fonts: DM Sans (body), DM Serif Display (headings)
- Semantic typography hierarchy:
  ```css
  h1 { font-size: 2xl; line-height: 1.2; }
  h2 { font-size: xl; line-height: 1.3; }
  h3 { font-size: lg; line-height: 1.4; }
  ```
- Consistent 1.5-1.7 line-height for body text

### Spacing & Layout

**StudyGy-Dashboard:**
- Border radius: `rounded-xl` (8px), `rounded-2xl` (16px), `rounded-3xl` (24px), `rounded-full`
- Main card: `rounded-[40px]` (App.tsx)
- Arbitrary spacing (no systematic grid)

**LevelUp:**
- Calculated radius system:
  ```css
  --radius: 0.625rem;  /* 10px */
  --radius-sm: calc(var(--radius) - 4px);  /* 6px */
  --radius-lg: var(--radius);  /* 10px */
  ```
- Main cards: `rounded-[24px]`
- 8px spacing grid (multiples of 0.5rem)

### Dark Mode Implementation

**StudyGy-Dashboard:**
```typescript
// React state + localStorage
const [theme, setTheme] = useState<'light' | 'dark'>(() => {
  return localStorage.getItem('theme') ||
         (window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light');
});

useEffect(() => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
}, [theme]);
```
- Uses Tailwind `dark:` prefix throughout
- Manual color adjustments per component
- No centralized token redefinition

**LevelUp:**
```css
:root { /* Light mode tokens */ }
.dark { /* All tokens redefined */ }
```
- CSS-based with automatic application
- No manual `dark:` variants needed
- System-level color coordination

---

## 4. Component Architecture

### Component Complexity

**StudyGy-Dashboard:**
- **LessonView.tsx** (866 lines) - Monolithic feature component
  - Video player with custom controls
  - AB-loop functionality
  - Notes system with markdown
  - Flashcard creation modal
  - Screenshot capture
  - Keyboard shortcuts
  - Lesson playlist
- **Dashboard.tsx** (340 lines) - Multiple features in one
- **Analytics.tsx** (420 lines) - Custom SVG charts
- **Header.tsx** (255 lines) - Search + notifications + profile

**Pattern:** Feature-complete components (everything in one file)

**LevelUp:**
- **VideoPlayer.tsx** (~200 lines) - Focused video component
- **NotesPanel.tsx** (~150 lines) - Separate notes component
- **CourseCard.tsx** (~100 lines) - Reusable card
- Modular components from shadcn/ui library

**Pattern:** Single-responsibility components (composition-based)

### State Management Patterns

**StudyGy-Dashboard:**
- Deep props drilling:
  ```typescript
  <Dashboard onCourseSelect={handleCourseSelect} />
  <CourseDetail
    course={course}
    onBack={handleBack}
    onLessonSelect={handleLessonSelect}
  />
  ```
- LessonView has 23 useState hooks
- No Context API usage

**LevelUp:**
- Zustand stores for global state
- React Context for theme
- Minimal prop drilling (stores accessible anywhere)

---

## 5. Unique Implementations & Innovations

### StudyGy Innovations

#### 1. **Custom SVG Charts** (No library dependency)
```typescript
// Analytics.tsx - Custom area chart
const AreaChart = ({ data }) => {
  const pathData = data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`
  ).join(' ');

  return (
    <svg viewBox="0 0 800 300">
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5F62E2" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#5F62E2" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={pathData} fill="url(#gradient)" />
    </svg>
  );
};
```

#### 2. **AB-Loop Video Player**
```typescript
// LessonView.tsx - Video loop functionality
const handleTimeUpdate = () => {
  if (loopStart !== null && loopEnd !== null) {
    if (currentTime >= loopEnd) {
      videoRef.current.currentTime = loopStart;
    }
  }
};
```

#### 3. **Keyboard Shortcuts System**
```typescript
// LessonView.tsx
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.code === 'Space') togglePlayPause();
    if (e.key === 'j') seekBackward();
    if (e.key === 'l') seekForward();
    if (e.key === 'f') toggleFullscreen();
    if (e.key === 'n') focusNoteInput();
  };
  window.addEventListener('keydown', handleKeyPress);
}, []);
```

#### 4. **Text Selection → Flashcard Creation**
```typescript
// LessonView.tsx - Create flashcard from selected text
const handleTextSelection = () => {
  const selection = window.getSelection();
  if (selection && selection.toString().length > 0) {
    setShowFlashcardButton(true);
    setSelectedText(selection.toString());
  }
};
```

### LevelUp Innovations

#### 1. **Momentum Scoring Algorithm**
```typescript
// lib/analytics/momentumScore.ts
export function calculateMomentumScore(sessions: StudySession[]): number {
  const engagementScore = calculateEngagement(sessions);
  const velocityScore = calculateVelocity(sessions);
  const consistencyScore = calculateConsistency(sessions);

  return (engagementScore * 0.4) + (velocityScore * 0.3) + (consistencyScore * 0.3);
}
```

#### 2. **At-Risk Course Detection**
```typescript
// lib/analytics/atRiskDetection.ts
export function calculateAtRiskStatus(courseId: string): boolean {
  const daysSinceLastSession = getDaysSinceLastActivity(courseId);
  const progressRate = getProgressRate(courseId);
  const completionLikelihood = predictCompletion(courseId);

  return daysSinceLastSession > 14 && progressRate < 0.1 && completionLikelihood < 0.3;
}
```

#### 3. **Vector Search with Brute Force k-NN**
```typescript
// lib/vectorSearch.ts (Epic 9)
export class BruteForceVectorStore {
  search(queryVector: number[], k: number): SearchResult[] {
    const distances = this.vectors.map((v, i) => ({
      index: i,
      distance: this.cosineSimilarity(queryVector, v.embedding)
    }));

    return distances
      .sort((a, b) => b.distance - a.distance)
      .slice(0, k);
  }
}
```

#### 4. **OpenAI Integration for Video Summaries**
```typescript
// lib/ai/videoSummary.ts
export async function generateVideoSummary(
  videoId: string,
  transcript: string
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Summarize this lesson...' },
      { role: 'user', content: transcript }
    ]
  });
  return response.choices[0].message.content;
}
```

---

## 6. User Experience Comparison

### Navigation Experience

| Aspect | StudyGy | LevelUp |
|--------|---------|---------|
| **Back button** | ❌ Doesn't work | ✅ Works (React Router) |
| **Refresh** | ❌ Loses state | ✅ Preserves route |
| **Deep links** | ❌ Not possible | ✅ Shareable URLs |
| **Breadcrumbs** | Manual "Back" buttons | Route-based breadcrumbs |

### Learning Experience

**StudyGy Strengths:**
- ✅ Pomodoro timer for focused study
- ✅ Flashcard creation directly from video content
- ✅ AB-loop for repetitive learning
- ✅ Keyboard shortcuts (Space, J, L, F, N)
- ✅ Career path progression visualization

**LevelUp Strengths:**
- ✅ AI-generated lesson summaries
- ✅ Momentum tracking shows learning velocity
- ✅ At-risk detection prevents course abandonment
- ✅ Completion estimates motivate goal achievement
- ✅ Semantic note search finds related content

### Analytics & Insights

**StudyGy:**
- Activity heatmap (365 days)
- Skill radar chart (5 skills)
- Learning time charts (area, bar, donut)
- Focus distribution breakdown

**LevelUp:**
- Study streak calendar (26 weeks)
- Session history with analytics
- Course momentum scoring
- Progress velocity tracking
- At-risk course warnings

---

## 7. Code Quality Assessment

### TypeScript Usage

**Both apps:**
- ✅ Full TypeScript coverage
- ✅ Explicit interface definitions
- ✅ Type-safe props

**StudyGy:**
- Interfaces in `types.ts` (88 lines)
- Some `any` types (e.g., `icon: any` for Lucide components)

**LevelUp:**
- Distributed types across modules
- Stricter typing (no `any` usage in core code)

### Testing

**StudyGy:**
- ❌ No visible E2E tests
- ❌ No unit tests
- ❌ No CI/CD configuration

**LevelUp:**
- ✅ Playwright E2E tests (95/100 Grade A isolation)
- ✅ Test factories for data independence
- ✅ Burn-in testing for flakiness detection
- ✅ CI/CD with GitHub Actions

### Scalability

**StudyGy:**
- Works well for <10 pages
- Would require refactoring for 50+ pages
- No code splitting
- Single bundle build

**LevelUp:**
- Scales to 100+ pages with lazy loading
- Route-based code splitting
- Optimized bundle chunks
- Production-grade architecture

---

## 8. Performance Characteristics

### Bundle Size (Estimated)

**StudyGy-Dashboard:**
- Minimal dependencies = smaller bundle
- Single bundle (no splitting)
- Estimated: ~150-200KB gzipped

**LevelUp:**
- Heavy dependencies (Router, shadcn/ui, Radix, etc.)
- Route-based splitting
- Estimated: ~300-400KB gzipped (initial), lazy routes add ~50KB each

### Runtime Performance

**StudyGy:**
- ✅ Fast initial load (minimal deps)
- ⚠️ Custom SVG charts may lag with large datasets
- ⚠️ LessonView has 23 useState hooks (potential re-render issues)

**LevelUp:**
- ⚠️ Slower initial load (larger bundle)
- ✅ IndexedDB queries optimized with indexes
- ✅ React Router code splitting reduces per-page size
- ✅ Zustand prevents unnecessary re-renders

---

## 9. Accessibility Comparison

### WCAG Compliance

**StudyGy:**
- ⚠️ Some focus states missing
- ⚠️ Inconsistent focus indicators
- ✅ Semantic HTML elements
- ⚠️ Limited ARIA labeling

**LevelUp:**
- ✅ WCAG 2.1 AA+ compliance goal
- ✅ Global focus-visible styling
- ✅ Keyboard navigation throughout
- ✅ Proper ARIA labels (shadcn/ui components)
- ✅ 4.5:1 text contrast ratio enforced

### Keyboard Navigation

**StudyGy:**
- ✅ Video player shortcuts (Space, J, L, F, N)
- ⚠️ Limited tab navigation support
- ⚠️ Dropdowns may lose focus

**LevelUp:**
- ✅ Full keyboard navigation
- ✅ Tab order optimized
- ✅ Escape to close modals
- ✅ Arrow key navigation in menus

---

## 10. Recommendations

### For StudyGy-Dashboard

#### Critical Improvements
1. **Add React Router** - Implement URL-based navigation
2. **Extract LessonView** - Split 866-line component into smaller modules
3. **Implement Design Tokens** - Move from hardcoded colors to CSS variables
4. **Add Testing** - Playwright E2E tests for critical flows
5. **Improve Accessibility** - Add focus-visible states, ARIA labels

#### Feature Enhancements
6. **Integrate Real Backend** - Replace mock data with API calls
7. **Add Chart Library** - Consider Recharts for maintainability
8. **Implement Context API** - Reduce props drilling
9. **Add Code Splitting** - Lazy load routes for better performance
10. **Document Design System** - Create design token reference

### For LevelUp

#### Feature Additions (from StudyGy)
1. **Pomodoro Timer** - Add focus/break timer to study tools
2. **Flashcard System** - Implement spaced repetition learning
3. **Career Paths** - Add curated learning journey feature
4. **AB-Loop Video** - Add loop functionality to video player
5. **Keyboard Shortcuts** - Add Space, J, L, F shortcuts to player

#### UI/UX Improvements
6. **Activity Heatmap** - Add GitHub-style contribution calendar
7. **Skill Radar Chart** - Visualize proficiency across domains
8. **Watch Folders** - Consider local file monitoring (if relevant)

---

## 11. Conclusion

### When to Choose StudyGy Approach
- ✅ Rapid prototyping (minimal dependencies)
- ✅ Simple learning platforms (<10 pages)
- ✅ Focus on productivity tools (Pomodoro, flashcards)
- ✅ Custom chart implementations acceptable
- ✅ Single-page app experience desired

### When to Choose LevelUp Approach
- ✅ Production applications (URL routing essential)
- ✅ Complex learning platforms (>20 pages)
- ✅ AI/ML integration required
- ✅ Advanced analytics needed
- ✅ Long-term maintenance expected
- ✅ Scalability critical

### Hybrid Approach Recommendation

**Combine the best of both:**
1. Use LevelUp's **architecture** (React Router, design tokens, testing)
2. Add StudyGy's **productivity tools** (Pomodoro, flashcards, AB-loop)
3. Implement LevelUp's **AI features** (summaries, semantic search)
4. Adopt StudyGy's **keyboard shortcuts** for video player
5. Use LevelUp's **component library** (shadcn/ui for consistency)
6. Add StudyGy's **career paths** feature to LevelUp

This creates a **comprehensive learning platform** with both productivity tools and advanced analytics.

---

## Appendix: File References

### StudyGy-Dashboard Key Files
- `App.tsx` - Root component (161 lines)
- `components/LessonView.tsx` - Feature-complete video player (866 lines)
- `components/Dashboard.tsx` - Main landing page (340 lines)
- `components/Analytics.tsx` - Custom SVG charts (420 lines)
- `constants.ts` - All mock data (234 lines)
- `types.ts` - TypeScript interfaces (88 lines)

### LevelUp Key Files
- `src/app/routes.tsx` - Route definitions (17 routes)
- `src/styles/theme.css` - Design token system (50+ tokens)
- `src/lib/vectorSearch.ts` - Brute force k-NN implementation
- `src/lib/analytics/momentumScore.ts` - Learning velocity algorithm
- `CLAUDE.md` - Development standards and conventions
- `playwright.config.ts` - E2E test configuration

---

**Report Generated By:** Claude Code Swarm Analysis
**Agents Used:** 4 (Architecture, Components, Features, Design)
**Analysis Duration:** ~5 minutes
**Total Lines Analyzed:** ~3,500+ lines across both codebases
