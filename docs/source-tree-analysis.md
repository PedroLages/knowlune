# LevelUp - Source Tree Analysis

> Generated: 2026-02-15 | Scan Level: Quick

## Project Root Structure

```
levelup/
├── .claude/                    # Claude Code configuration
│   └── workflows/
│       └── design-review/      # Automated design review workflow
│           ├── agent-config.md
│           └── design-principles.md
├── .github/
│   └── workflows/              # CI/CD pipelines
│       ├── ci.yml              # Main CI pipeline
│       ├── test.yml            # E2E test pipeline
│       └── design-review.yml   # Automated design review
├── .storybook/                 # Storybook configuration
├── _bmad/                      # BMAD workflow framework
│   ├── core/                   # Core workflow engine
│   ├── bmb/                    # BMAD Builder modules
│   └── bmm/                    # BMAD Manager modules
├── docs/                       # Project documentation
│   ├── planning-artifacts/     # PRD, Architecture, Epics, UX
│   ├── implementation-artifacts/ # Sprint status, story files
│   ├── analysis/               # Brainstorming and analysis docs
│   └── excalidraw-diagrams/    # Visual diagrams
├── public/                     # Static assets served at /
│   ├── mockServiceWorker.js    # MSW service worker
│   └── design-tokens.source.json
├── scripts/                    # Build and utility scripts
├── src/                        # Application source code (see below)
├── tests/                      # Playwright E2E tests
│   ├── screenshots/            # Visual regression screenshots
│   ├── accessibility.spec.ts   # Accessibility tests
│   ├── design-review.spec.ts   # Design review tests
│   └── overview-design-analysis.spec.ts
├── index.html                  # SPA entry point
├── package.json                # Dependencies and scripts
├── vite.config.ts              # Vite configuration (+ media serving plugin)
├── tsconfig.json               # TypeScript configuration
├── eslint.config.js            # ESLint flat config
├── playwright.config.ts        # Playwright E2E config
├── postcss.config.mjs          # PostCSS configuration
├── .prettierrc                 # Prettier formatting rules
├── components.json             # shadcn/ui configuration
├── Dockerfile                  # Production Docker image
├── Dockerfile.dev              # Development Docker image
├── Makefile                    # Build automation shortcuts
├── mockoon-data.json           # Mock API data (Mockoon)
├── lighthouserc.cjs            # Lighthouse CI configuration
├── CLAUDE.md                   # Claude Code instructions
└── README.md                   # Project README
```

## Source Directory (`src/`)

```
src/
├── main.tsx                    # ★ App entry point - renders React root
├── vite-env.d.ts               # Vite type declarations
│
├── app/                        # Application layer
│   ├── App.tsx                 # Root component with RouterProvider
│   ├── routes.tsx              # React Router v7 route configuration
│   │
│   ├── components/             # Reusable components
│   │   ├── Layout.tsx          # ★ Main layout (sidebar + header + outlet)
│   │   ├── AchievementBanner.tsx
│   │   ├── BookmarksList.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ProgressCourseCard.tsx
│   │   ├── ProgressStats.tsx
│   │   ├── ProgressWidget.tsx
│   │   ├── QuickActions.tsx
│   │   ├── RecentActivity.tsx
│   │   ├── StatsCard.tsx
│   │   ├── StudyStreak.tsx
│   │   ├── StudyStreakCalendar.tsx
│   │   │
│   │   ├── celebrations/       # Gamification components
│   │   │   └── CompletionModal.tsx
│   │   │
│   │   ├── charts/             # Data visualization
│   │   │   └── ProgressChart.tsx
│   │   │
│   │   ├── examples/           # Example/demo components
│   │   │   └── ApiExample.tsx
│   │   │
│   │   ├── figma/              # Custom Figma-derived components
│   │   │   ├── CourseCard.tsx           # Course display card
│   │   │   ├── CourseCard.stories.tsx   # Storybook story
│   │   │   ├── EnhancedCourseCard.tsx   # Enhanced version with progress
│   │   │   ├── ImageWithFallback.tsx    # Image with error fallback
│   │   │   ├── KeyboardShortcutsDialog.tsx
│   │   │   ├── LessonList.tsx           # Lesson listing
│   │   │   ├── ModuleAccordion.tsx      # Course module accordion
│   │   │   ├── PdfViewer.tsx            # PDF content viewer
│   │   │   ├── ProgressRing.tsx         # Circular progress indicator
│   │   │   ├── ResourceBadge.tsx        # Resource type badge
│   │   │   ├── SearchCommandPalette.tsx # Command palette search
│   │   │   ├── VideoPlayer.tsx          # Video player component
│   │   │   └── VideoPlayer.stories.tsx  # Storybook story
│   │   │
│   │   ├── navigation/         # Navigation components
│   │   │   └── BottomNav.tsx   # Mobile bottom navigation
│   │   │
│   │   ├── notes/              # Note-taking components
│   │   │   └── NoteEditor.tsx  # Markdown note editor
│   │   │
│   │   └── ui/                 # shadcn/ui component library (46 components)
│   │       ├── accordion.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── alert.tsx
│   │       ├── aspect-ratio.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input-otp.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toggle-group.tsx
│   │       ├── toggle.tsx
│   │       ├── tooltip.tsx
│   │       ├── use-mobile.ts   # Mobile detection hook
│   │       └── utils.ts        # cn() utility function
│   │
│   ├── config/                 # App configuration
│   │   └── navigation.ts      # Navigation menu config
│   │
│   ├── hooks/                  # Custom React hooks
│   │   └── useMediaQuery.ts   # Responsive breakpoint hook
│   │
│   └── pages/                  # Route page components
│       ├── Overview.tsx        # Dashboard (/)
│       ├── MyClass.tsx         # Active courses (/my-class)
│       ├── Courses.tsx         # Course library (/courses)
│       ├── CourseDetail.tsx    # Course detail (/courses/:id)
│       ├── LessonPlayer.tsx   # Lesson player (/courses/:id/lessons/:lessonId)
│       ├── Library.tsx         # Personal library (/library)
│       ├── Instructors.tsx     # Instructors (/instructors)
│       ├── Reports.tsx         # Reports (/reports)
│       └── Settings.tsx        # Settings (/settings)
│
├── data/                       # Data layer
│   ├── types.ts               # TypeScript type definitions
│   └── courses/               # Course data definitions
│       ├── index.ts           # Course data exports
│       ├── 6mx.ts
│       ├── authority.ts
│       ├── behavior-skills.ts
│       ├── confidence-reboot.ts
│       ├── nci-access.ts
│       ├── operative-six.ts
│       ├── ops-manual.ts
│       └── study-materials.ts
│
├── db/                         # Database layer (Dexie/IndexedDB)
│   ├── index.ts               # Database instance and configuration
│   ├── schema.ts              # Database schema definition
│   └── __tests__/
│       └── schema.test.ts     # Schema tests
│
├── lib/                        # Library/utility functions
│   ├── api.ts                 # API client (fetch wrapper)
│   ├── bookmarks.ts           # Bookmark management
│   ├── courseImport.ts        # Course folder import logic
│   ├── fileSystem.ts          # File system access (File System Access API)
│   ├── media.ts               # Media file utilities
│   ├── progress.ts            # Progress tracking logic
│   ├── settings.ts            # Settings persistence
│   ├── studyLog.ts            # Study session logging
│   ├── studyStreak.ts         # Streak calculation logic
│   └── __tests__/             # Unit tests
│       ├── courseImport.test.ts
│       ├── courseImport.integration.test.ts
│       ├── fileSystem.test.ts
│       ├── progress.test.ts
│       ├── settings.test.ts
│       └── studyLog.test.ts
│
├── stores/                     # Zustand state stores
│   ├── useCourseImportStore.ts # Course import state
│   └── __tests__/
│       └── useCourseImportStore.test.ts
│
├── stories/                    # Storybook stories
│   ├── Button.tsx / Button.stories.ts
│   ├── Header.tsx / Header.stories.ts
│   ├── Page.tsx / Page.stories.ts
│   ├── assets/                # Story assets
│   └── pages/                 # Page-level stories
│       ├── _PageLayout.tsx
│       ├── Dashboard.stories.tsx
│       ├── LessonPlayer.stories.tsx
│       ├── CourseLibrary.stories.tsx
│       ├── CourseDetail.stories.tsx
│       ├── Library.stories.tsx
│       ├── MyProgress.stories.tsx
│       ├── Reports.stories.tsx
│       └── StudyJournal.stories.tsx
│
├── styles/                     # Global styles
│   ├── index.css              # Main CSS entry (imports all)
│   ├── tailwind.css           # Tailwind v4 config and @source
│   ├── theme.css              # CSS custom properties (OKLCH color space)
│   ├── fonts.css              # Font definitions
│   └── animations.css         # Custom animation definitions
│
├── test/                       # Test configuration
│   └── setup.ts               # Vitest setup file
│
└── types/                      # Shared TypeScript types
    └── api.ts                 # API response types
```

## Critical Folders Summary

| Folder | Purpose | Key Files |
|--------|---------|-----------|
| `src/app/pages/` | Route-level page components (10 pages) | Overview.tsx, Courses.tsx, LessonPlayer.tsx |
| `src/app/components/ui/` | shadcn/ui primitives (46 components) | button.tsx, card.tsx, dialog.tsx |
| `src/app/components/figma/` | Custom Figma-derived components (11) | VideoPlayer.tsx, CourseCard.tsx, PdfViewer.tsx |
| `src/db/` | Dexie IndexedDB database layer | schema.ts, index.ts |
| `src/stores/` | Zustand state management | useCourseImportStore.ts |
| `src/lib/` | Business logic and utilities (11 modules) | courseImport.ts, progress.ts, studyStreak.ts |
| `src/data/` | Static data and type definitions | types.ts, courses/index.ts |
| `src/styles/` | Global CSS and theme configuration | theme.css, tailwind.css |
| `tests/` | Playwright E2E tests | accessibility.spec.ts, design-review.spec.ts |

## Entry Points

| Entry Point | Path | Purpose |
|-------------|------|---------|
| HTML Shell | `index.html` | SPA entry, loads `src/main.tsx` |
| React Root | `src/main.tsx` | React DOM render, mounts `<App />` |
| Router Config | `src/app/routes.tsx` | All route definitions |
| Layout | `src/app/components/Layout.tsx` | Wraps all pages with sidebar + header |
| DB Init | `src/db/index.ts` | Dexie database initialization |
| Vite Config | `vite.config.ts` | Build config + custom media plugin |
