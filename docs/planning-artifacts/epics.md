---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - 'docs/planning-artifacts/prd.md'
  - 'docs/planning-artifacts/architecture.md'
  - 'docs/planning-artifacts/ux-design-specification.md'
---

# Elearningplatformwireframes - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Elearningplatformwireframes, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**Course Library Management (6 Requirements):**

- FR1: User can import course folders from local file system using folder selection
- FR2: User can view all imported courses in a course library
- FR3: User can organize courses by topic or subject categories
- FR4: User can view course metadata including title, video count, and PDF count
- FR5: User can categorize courses as Active, Completed, or Paused
- FR6: System can detect and display supported video formats (MP4, MKV, AVI) and PDF files

**Content Consumption (7 Requirements):**

- FR7: User can play video content using standard playback controls (play, pause, seek, volume)
- FR8: User can view PDF content with page navigation
- FR9: User can bookmark current position in video content
- FR10: User can resume video playback from last viewed position
- FR11: User can navigate between videos within a course
- FR12: User can view course structure showing sections, videos, and PDFs
- FR13: User can view content in a focused interface showing only the video/PDF player, note panel, and course navigation — no sidebar, dashboard widgets, or unrelated UI elements

**Progress & Session Tracking (6 Requirements):**

- FR14: User can mark videos and chapters as Not Started, In Progress, or Completed
- FR15: User can view completion percentage for each course
- FR16: System can automatically log study sessions with date, duration, and content covered
- FR17: User can view study session history
- FR18: User can see visual progress indicators using color coding (gray/blue/green)
- FR19: User can track total study time across all courses

**Note Management (10 Requirements):**

- FR20: User can create notes using Markdown syntax
- FR21: User can link notes to specific courses and videos
- FR22: User can add tags to notes for organization
- FR23: User can search notes using full-text search
- FR24: User can timestamp notes to exact video positions
- FR25: User can navigate to specific video position from timestamped note
- FR26: User can view all notes for a specific course
- FR27: System can automatically save notes without requiring manual save action
- FR76: User can insert current video timestamp into note via a configurable keyboard shortcut *(Derived from FR24)*
- FR77: User can view the note editor alongside the video player in a side-by-side layout on desktop (1024px+) and stacked layout on mobile (<1024px) *(Derived from UX Design Specification)*

**Motivation & Gamification (8 Requirements):**

- FR28: User can view daily study streak counter
- FR29: User can view visual calendar showing study history
- FR30: User can configure browser notifications as study reminders with selectable trigger conditions: daily at a chosen time, or when a streak is within 2 hours of breaking (no activity for 22+ hours)
- FR31: User can pause study streak without losing history
- FR32: User can create learning challenges by specifying a name, target metric (videos completed, study hours, or streak days), target value, and deadline
- FR33: User can track progress against active learning challenges
- FR34: User can create completion-based, time-based, or streak-based challenge types
- FR35: System can display a toast notification with milestone badge when a challenge reaches 25%, 50%, 75%, or 100% of its target value

**Learning Intelligence (5 Requirements):**

- FR36: User can view momentum score for each course displayed as hot/warm/cold indicator
- FR37: User can sort course list by momentum score
- FR38: System can calculate course momentum based on study recency, completion percentage, and study frequency
- FR39: User can view a "Recommended Next" section on the dashboard showing the top 3 courses ranked by momentum score, recency, and completion proximity
- FR40: After completing a course, system suggests the next course from the user's library ranked by shared tags (weighted 60%) and momentum score (weighted 40%)
- FR41: System flags courses with no study activity for 14+ days and momentum score below 20% as "at risk" with a visual indicator in the course library
- FR42: System suggests a daily study schedule based on the user's historical study times (the hour with the highest average session count over the past 30 days), active course count, and weekly goal
- FR79: System can display estimated completion time for each course based on remaining content and user's average study pace

**Analytics & Reporting (7 Requirements):**

- FR43: User can view study time analytics broken down by daily, weekly, and monthly periods
- FR44: User can track course completion rates over time
- FR45: User can view and manage bookmarked lessons on a dedicated Bookmarks page
- FR46: User can see retention insights comparing completed courses versus abandoned courses (no activity for 14+ days with <100% completion), showing average study frequency, time-to-completion, and notes-per-video ratio for each group
- FR47: User can view 3-5 actionable insights on the analytics dashboard derived from study patterns
- FR78: User can view learning velocity metrics — completion rate over time (videos completed per week), content consumed per hour, and progress acceleration/deceleration trends
- FR101: User can view weekly adherence percentage (study days / target days) on the dashboard and in analytics

**AI-Powered Assistance (6 Requirements):**

- FR48: User can request an AI-generated summary (100-300 words) of a video's content, displayed in a collapsible panel alongside the video
- FR49: User can ask questions in a chat-style panel and receive answers citing specific source notes (note title and linked video), generated from the user's own note corpus
- FR50: User can view an AI-generated learning path that orders their imported courses by inferred prerequisite relationships with a justification for each ordering decision and manual drag-to-reorder override
- FR51: System identifies topics with fewer than 1 note per 3 videos or skipped videos (marked complete without watching >50% duration) and suggests specific videos/sections to revisit
- FR52: User can request AI to auto-tag, categorize, and link related notes across courses, with a preview before applying changes
- FR53: System displays a "Related Concepts" panel showing notes from other courses that share 1+ tags or AI-determined topical overlap (minimum 2 shared key terms)

**Knowledge Retention & Review (5 Requirements — Domain-driven: Learning Science):**

- FR80: User can schedule notes for spaced review using a 3-grade rating system (Hard / Good / Easy) that adjusts the next review interval based on recall difficulty
- FR81: User can view a review queue showing notes due for review, sorted by predicted retention percentage (lowest retention first)
- FR82: User can view knowledge retention status per topic showing time since last review and estimated retention level: strong/fading/weak
- FR83: System detects engagement decay when study frequency drops below 50% of the user's 2-week rolling average, session duration declines more than 30% over 4 weeks, or completion velocity is negative for 3+ consecutive weeks
- FR84: System can score each study session on a 0-100 scale based on active time ratio (40%), interaction density (30%), session length (15%), and breaks taken (15%)

**Data Portability & Export (4 Requirements — Domain-driven: EdTech Standards):**

- FR85: User can export all learning data in three formats: JSON (with schema version), CSV (sessions, progress, streaks), and Markdown (notes with YAML frontmatter)
- FR86: System logs learning activities using an Actor + Verb + Object structure compatible with xAPI statement format
- FR87: User can export earned achievements as Open Badges v3.0 JSON files
- FR88: User can load SRT or WebVTT caption/subtitle files alongside local video content, with captions displayed synchronized to video playback

**Content Metadata (1 Requirement — Domain-driven: Content Standards):**

- FR89: System can store course metadata using standard fields: title, creator, subject, description, language, date added, estimated duration, and difficulty level

**Enhanced Motivation (2 Requirements — Domain-driven: Streak Psychology):**

- FR90: User can set specific daily or weekly study goals and view progress against those goals on the dashboard
- FR91: User can configure streak freeze days (1-3 per week) that count as rest days without breaking the study streak

**Advanced Analytics (2 Requirements — Domain-driven: Learning Analytics):**

- FR92: User can activate an interleaved review mode that surfaces notes from multiple courses in a mixed sequence, weighted by topic similarity and time since last review
- FR93: User can view a learning activity heatmap showing daily study activity over the past 12 months, with color intensity indicating session duration

**Traceability Gap Closures (8 Requirements — Validation-driven):**

- FR94: User can view feature usage statistics for AI features over daily, weekly, and monthly periods
- FR95: User can resume their last study session directly from a "Continue Learning" action on the dashboard
- FR96: System can display onboarding prompts during first use guiding the user through importing a course, starting a study session, and creating a first learning challenge
- FR97: System can proactively suggest AI-generated note links when a newly saved note shares 2+ tags or key terms with existing notes across other courses
- FR98: System can display a toast notification with streak milestone badge at 7-day, 30-day, 60-day, and 100-day streak milestones
- FR99: System can trigger AI analysis (summary generation, topic tagging) automatically when a new course is imported
- FR100: User can configure per-course study reminders with selectable days and times independent of the streak reminder
- FR101: User can view weekly adherence percentage (study days / target days) on the dashboard and in analytics

### Non-Functional Requirements

**Performance (7 Requirements):**

- NFR1: Initial app load completes in less than 2 seconds (cold start)
- NFR2: Route navigation completes in less than 200ms
- NFR3: Video playback starts within 500ms of user action for local files
- NFR4: Data queries (note search, progress loading) complete in less than 100ms
- NFR5: Note autosave completes in less than 50ms
- NFR6: Initial bundle size does not exceed 500KB (gzipped)
- NFR7: Memory usage does not increase by more than 50MB over a 2-hour session

**Reliability (9 Requirements):**

- NFR8: Zero data loss for notes, progress, or course metadata during standard workflows
- NFR9: All user data persists across browser sessions without requiring manual save actions
- NFR10: System detects storage write failures within 1 second and displays a user-visible error notification with retry option
- NFR11: File system errors display a toast notification within 2 seconds identifying the affected file
- NFR12: AI API failures fall back to non-AI workflows within 2 seconds
- NFR13: Invalid file formats detected within 1 second of import attempt
- NFR14: Notes autosaved every 3 seconds during editing with conflict resolution
- NFR15: Progress tracking data is atomic — completion state changes are all-or-nothing
- NFR16: Course metadata validated on import; validation errors display inline within 1 second

**Usability (9 Requirements):**

- NFR17: User can resume last study session within 1 click from app launch
- NFR18: Core workflows completable by a new user within 2 minutes without documentation
- NFR19: Primary tasks completable in under 3 clicks
- NFR20: Video resume loads to exact last position within 1 second
- NFR21: Search results appear as user types (< 100ms)
- NFR22: Navigation between courses, videos, and notes completes in under 200ms
- NFR23: Destructive actions require a confirmation dialog
- NFR24: System provides undo for the last destructive action for at least 10 seconds
- NFR25: Form validation provides inline feedback within 200ms

**Integration (8 Requirements):**

- NFR26: AI API requests timeout after 30 seconds with fallback error handling
- NFR27: AI API keys never present in source code, build output, or client-accessible storage
- NFR28: System supports at least 2 configurable AI providers with user-selectable active provider
- NFR29: When AI API unavailable, AI-dependent UI elements display "AI unavailable" status
- NFR30: Folder selection triggers browser-native permission prompt with retry on denial
- NFR31: System detects missing or relocated files on course load with "file not found" badge
- NFR32: Course import supports video formats (MP4, MKV, AVI, WEBM) and PDF files
- NFR33: File reading handles large files (2GB+) without exceeding 100MB additional memory

**Future Integration (2 Requirements):**

- NFR34: *(Consolidated into FR85)*
- NFR35: Notes exportable as individual Markdown files with frontmatter

**Accessibility (14 Requirements):**

- NFR36: All text maintains minimum 4.5:1 contrast ratio (3:1 for large text ≥18pt)
- NFR37: All interactive elements reachable via Tab key and operable via Enter/Space
- NFR38: Focus indicators visible on all interactive elements (2px outline minimum)
- NFR39: ARIA labels on all icon-only buttons and complex widgets
- NFR40: Semantic HTML for all structural and interactive roles
- NFR41: *(Consolidated into NFR58)*
- NFR42: Note editor supports Markdown shortcuts and keyboard-only editing
- NFR43: All dashboard widgets and navigation elements operable via keyboard
- NFR44: All images have alt text; decorative images use alt=""
- NFR45: ARIA landmarks for major page regions (navigation, main, complementary)
- NFR46: Dynamic content updates announced via ARIA live regions
- NFR47: Lighthouse accessibility audits score 100 (or documented exceptions)
- NFR48: All primary workflows completable using keyboard-only navigation
- NFR49: Screen reader users can navigate all page regions and operate interactive controls

**Security (7 Requirements):**

- NFR50: User-generated Markdown content sanitized to prevent XSS
- NFR51: Content Security Policy headers prevent script injection
- NFR52: AI API keys never exposed in client-side code or logs
- NFR53: All data remains local — no network requests except to configured AI API endpoints
- NFR54: AI API calls include only content being analyzed — no user metadata or file paths transmitted
- NFR55: Course content and notes never leave user's device (except explicit AI queries)
- NFR56: Application operates without authentication (personal single-user tool)

**EdTech Accessibility (6 Requirements — Domain-driven: WCAG 2.2):**

- NFR57: WCAG 2.2 Level AA including SC 2.4.11, SC 2.5.7, SC 2.5.8 (≥24×24 CSS px targets)
- NFR58: Video player full keyboard operation (Space, arrows, M, C, F, Escape)
- NFR59: Caption files display synchronized within 200ms
- NFR60: All progress indicators use role="progressbar" with aria attributes and text equivalent
- NFR61: Charts include alt text, data table alternatives, no color-only differentiation
- NFR62: Consistent navigation order, destructive action confirmations, pausable auto-updates

**Data Portability (6 Requirements — Domain-driven: GDPR/xAPI):**

- NFR63: Full data export completes within 30 seconds regardless of data volume
- NFR64: All learning data stored locally with no server-side transmission without per-feature consent
- NFR65: Data schemas include version identifier with non-destructive automatic migrations
- NFR66: Cloud AI features transmit only aggregated/anonymized data with per-feature consent toggles
- NFR67: Exported data re-importable with ≥95% semantic fidelity
- NFR68: All animations respect prefers-reduced-motion media query

### Additional Requirements

**From Architecture Document:**

- Brownfield project — existing React 18.3.1 + Vite 6.3.5 + Tailwind CSS v4 + React Router v7 + shadcn/ui foundation already established
- No starter template needed — build on existing codebase
- State Management: Zustand v5.0.11 for all global state (selector-based subscriptions, slice pattern)
- Data Persistence: Dexie.js v4.3.0 for IndexedDB abstraction (liveQuery, schema migrations, compound indexes)
- Video Player: react-player v3.4.0 with custom controls overlay (timestamp to notes, playback speed 0.5x-2x, WebVTT captions)
- PDF Viewer: react-pdf v10.3.0 (Mozilla PDF.js wrapper, page navigation, text search)
- Note Editor: @tiptap/react v3.20.0 (ProseMirror-based, Markdown serialization, XSS prevention by design, replaces react-markdown-editor)
- Full-Text Search: MiniSearch (sub-millisecond search, 50% smaller than Lunr.js, fuzzy + prefix search)
- AI Integration: Vercel AI SDK v2.0.31 with @ai-sdk/openai (streaming, multi-provider support)
- Animation: Framer Motion v12.34.0 with LazyMotion (code-split, 4.6 KB initial + 15 KB async)
- Testing: Vitest v4.0.18 + React Testing Library + fake-indexeddb + Playwright
- Analytics Engine: Custom TypeScript algorithms (momentum scoring, learning velocity, recommendations)
- File System: Native File System Access API (Chrome/Edge only, persist FileSystemHandles in IndexedDB)
- Implementation Phases: Phase 1 Foundation (months 1-2), Phase 2 Core Features (months 3-5), Phase 3 Intelligence & Polish (months 6-9)
- Bundle budget: ~487 KB / 500 KB target (13 KB headroom)
- Centralized types in src/data/types.ts
- Zustand stores follow use[Domain]Store naming pattern
- Dexie.js tables use lowercase plural nouns
- Test organization: unit tests in src/lib/__tests__/, component tests co-located, E2E in tests/
- Optimistic update pattern: Zustand first (immediate UI), Dexie.js second (async persistence)

**From UX Design Specification:**

- Desktop-first design (1440px+ primary viewport), tablet (640-1023px) secondary, mobile (375-639px) minimal
- "Continue Learning" button is the defining interaction — must load exact course, video, and playback position in <1 second
- Side-by-side layout: video player left, note editor right on desktop; stacked on mobile
- Celebration micro-moments: completed video checkmark animation, streak counter pulse, challenge milestone feedback
- Visual Progress Maps: gray (unwatched) → blue (in progress) → green (completed) color transitions
- Zero-decision study sessions via smart defaults and momentum-based course selection
- AI woven throughout experience (not segregated in menus) — study coach persona
- Streak mechanics inspired by Duolingo (🔥 emoji, daily accountability, supportive not guilt-inducing)
- Invisible autosave (Notion-inspired): 3-second debounce, no manual save button
- Instant search with context (sub-100ms, timestamp links to video positions)
- Onboarding flow: first-time import → first study session → first challenge creation
- Emotional design priorities: Motivated/Inspired, Empowered/In Control, Supported/Guided, Confident/Capable
- Anti-patterns to avoid: overwhelming dashboards, guilt-based motivation, hidden playback position, manual save buttons

### FR Coverage Map

FR1: Epic 1 - Import course folders from local file system
FR2: Epic 1 - View all imported courses in library
FR3: Epic 1 - Organize courses by topic/subject categories
FR4: Epic 1 - View course metadata (title, video count, PDF count)
FR5: Epic 1 - Categorize courses as Active/Completed/Paused
FR6: Epic 1 - Detect and display supported video/PDF formats
FR7: Epic 2 - Play video with standard playback controls
FR8: Epic 2 - View PDF content with page navigation
FR9: Epic 2 - Bookmark current video position
FR10: Epic 2 - Resume video from last viewed position
FR11: Epic 2 - Navigate between videos within a course
FR12: Epic 2 - View course structure (sections, videos, PDFs)
FR13: Epic 2 - Focused content interface (player + notes + nav only)
FR14: Epic 4 - Mark videos/chapters as Not Started/In Progress/Completed
FR15: Epic 4 - View completion percentage per course
FR16: Epic 4 - Auto-log study sessions (date, duration, content)
FR17: Epic 4 - View study session history
FR18: Epic 4 - Visual progress indicators (gray/blue/green)
FR19: Epic 4 - Track total study time across all courses
FR20: Epic 3 - Create notes using Markdown syntax
FR21: Epic 3 - Link notes to specific courses and videos
FR22: Epic 3 - Add tags to notes for organization
FR23: Epic 3 - Search notes using full-text search
FR24: Epic 3 - Timestamp notes to exact video positions
FR25: Epic 3 - Navigate to video position from timestamped note
FR26: Epic 3 - View all notes for a specific course
FR27: Epic 3 - Autosave notes without manual action
FR28: Epic 5 - View daily study streak counter
FR29: Epic 5 - View visual calendar showing study history
FR30: Epic 5 - Configure browser notification study reminders
FR31: Epic 5 - Pause study streak without losing history
FR32: Epic 6 - Create learning challenges (name, metric, target, deadline)
FR33: Epic 6 - Track progress against active challenges
FR34: Epic 6 - Create completion/time/streak challenge types
FR35: Epic 6 - Toast notification with milestone badge at 25/50/75/100%
FR36: Epic 7 - View momentum score (hot/warm/cold) per course
FR37: Epic 7 - Sort course list by momentum score
FR38: Epic 7 - Calculate momentum from recency, completion, frequency
FR39: Epic 7 - "Recommended Next" dashboard section (top 3 by momentum)
FR40: Epic 7 - Suggest next course after completion (tags 60% + momentum 40%)
FR41: Epic 7 - Flag "at risk" courses (14+ days idle, <20% momentum)
FR42: Epic 7 - Suggest daily study schedule from historical patterns
FR43: Epic 8 - Study time analytics (daily/weekly/monthly)
FR44: Epic 8 - Track course completion rates over time
FR45: Epic 2 - View and manage bookmarked lessons
FR46: Epic 8 - Retention insights (completed vs abandoned courses)
FR47: Epic 8 - 3-5 actionable insights from study patterns
FR48: Epic 9 - AI-generated video summary (100-300 words)
FR49: Epic 9 - Chat-style Q&A from user's note corpus
FR50: Epic 9 - AI-generated learning path with prerequisite ordering
FR51: Epic 9 - Identify under-noted/skipped topics, suggest revisits
FR52: Epic 9 - AI auto-tag, categorize, link related notes
FR53: Epic 9 - "Related Concepts" panel (shared tags/topical overlap)
FR76: Epic 3 - Insert video timestamp via keyboard shortcut
FR77: Epic 3 - Side-by-side video+notes (desktop) / stacked (mobile)
FR78: Epic 8 - Learning velocity metrics (completion rate, acceleration)
FR79: Epic 7 - Estimated completion time per course
FR80: Epic 11 - Spaced review with 3-grade rating (Hard/Good/Easy)
FR81: Epic 11 - Review queue sorted by predicted retention
FR82: Epic 11 - Knowledge retention status per topic
FR83: Epic 11 - Engagement decay detection
FR84: Epic 11 - Study session quality score (0-100)
FR85: Epic 11 - Export learning data (JSON, CSV, Markdown)
FR86: Epic 11 - xAPI-compatible activity logging
FR87: Epic 11 - Export achievements as Open Badges v3.0
FR88: Epic 2 - Load SRT/WebVTT captions synchronized to video
FR89: Epic 1 - Store course metadata with standard fields
FR90: Epic 5 - Set daily/weekly study goals with dashboard progress
FR91: Epic 5 - Configure streak freeze days (1-3 per week)
FR92: Epic 11 - Interleaved review mode across courses
FR93: Epic 8 - Learning activity heatmap (12 months)
FR94: Epic 9 - AI feature usage statistics
FR95: Epic 4 - Resume last session from "Continue Learning" action
FR96: Epic 10 - Onboarding prompts for first-time use
FR97: Epic 9 - Proactive AI note link suggestions
FR98: Epic 5 - Streak milestone toast notifications (7/30/60/100 days)
FR99: Epic 9 - Auto-trigger AI analysis on course import
FR100: Epic 11 - Per-course study reminders
FR101: Epic 5 - Weekly adherence percentage on dashboard/analytics

## Epic List

### Epic 1: Course Import & Library Management

Users can import local course folders, browse their library, organize by topic, and manage course status — establishing the content foundation for all learning activities.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR89
**Phase:** 1 (Foundation)

### Epic 2: Lesson Player & Content Consumption

Users can watch videos with full playback controls, view PDFs, bookmark positions, resume where they left off, load captions, and navigate course structure in a focused, distraction-free interface.

**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR45, FR88
**Phase:** 1 (Foundation)

### Epic 3: Smart Note System

Users can create Markdown notes linked to courses and videos, timestamp notes to exact playback positions, search across all notes with full-text search, and work in a side-by-side video+notes layout — all with invisible autosave.

**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR76, FR77
**Phase:** 1 (Foundation)

### Epic 4: Progress Tracking & Session History

Users can mark content completion status, view visual progress maps with color coding, track study time, review session history, and resume their last session directly from the dashboard.

**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19, FR95
**Phase:** 1 (Foundation)

### Epic 5: Study Streaks & Daily Goals

Users can build daily study streaks, set study goals, view a streak calendar, configure reminders and freeze days, and celebrate streak milestones — creating the daily accountability loop that drives consistent learning.

**FRs covered:** FR28, FR29, FR30, FR31, FR90, FR91, FR98, FR101
**Phase:** 1-2 (Foundation → Intelligence)

### Epic 6: Learning Challenges & Gamification

Users can create custom learning challenges with specific targets and deadlines, track progress, and receive milestone celebrations — adding goal-directed motivation beyond daily streaks.

**FRs covered:** FR32, FR33, FR34, FR35
**Phase:** 2 (Intelligence & Gamification)

### Epic 7: Course Momentum & Learning Intelligence

System calculates momentum scores for each course, recommends what to study next, flags at-risk courses, estimates completion times, and suggests optimal study schedules — providing smart, data-driven learning guidance.

**FRs covered:** FR36, FR37, FR38, FR39, FR40, FR41, FR42, FR79
**Phase:** 2 (Intelligence & Gamification)

### Epic 8: Analytics & Reports Dashboard

Users can view comprehensive study analytics (time breakdowns, completion rates, velocity metrics, retention insights, activity heatmaps) and receive actionable insights derived from their learning patterns.

**FRs covered:** FR43, FR44, FR46, FR47, FR78, FR93, FR101
**Phase:** 2-3 (Intelligence → AI & Analytics)

### Epic 9: AI-Powered Learning Assistant

Users can get AI-generated video summaries, ask questions answered from their notes, view AI-curated learning paths, receive smart note suggestions, and benefit from automatic content analysis — with AI woven throughout the experience as a study coach.

**FRs covered:** FR48, FR49, FR50, FR51, FR52, FR53, FR94, FR97, FR99
**Phase:** 3 (AI & Analytics)

### Epic 10: Onboarding & First-Use Experience

New users are guided through importing their first course, starting a study session, and creating their first learning challenge — ensuring immediate value discovery without documentation.

**FRs covered:** FR96
**Phase:** 1 (Foundation — deployed after Epics 1-2)

### Epic 11: Knowledge Retention, Export & Advanced Features (Post-MVP)

Users can schedule spaced reviews, export learning data in multiple formats, configure per-course reminders, and access advanced review modes — extending the platform for power users and data portability.

**FRs covered:** FR80, FR81, FR82, FR83, FR84, FR85, FR86, FR87, FR92, FR100
**Phase:** 4 (Post-MVP)

### Epic 19: Platform & Entitlement

Users can create accounts, subscribe to premium features via Stripe, and manage their subscription — enabling the open-core business model while preserving full functionality of the free core.

**FRs covered:** FR102, FR103, FR104, FR105, FR106, FR107
**Phase:** 4 (Post-MVP, before premium feature launch)
**Stories:** 19.1 Authentication Setup, 19.2 Stripe Subscription, 19.3 Entitlement & Offline Caching, 19.4 Subscription Management, 19.5 Feature Gating & Upgrade CTAs, 19.6 Code Boundary & Build Separation

---

## Epic 1: Course Import & Library Management

Users can import local course folders, browse their library, organize by topic, and manage course status — establishing the content foundation for all learning activities.

### Story 1.1: Import Course Folder from File System

As a learner,
I want to select a local folder containing course materials and have the system automatically scan and import it,
So that I can start studying without manually organizing files.

**Acceptance Criteria:**

**Given** the user is on the Course Library page
**When** the user clicks the "Import Course" button
**Then** the browser-native folder picker dialog opens (File System Access API)
**And** upon folder selection, the system recursively scans for supported files (MP4, MKV, AVI, WEBM, PDF)
**And** unsupported file types are silently ignored without error

**Given** a valid folder has been selected containing at least one supported file
**When** the scan completes
**Then** a new course entity is created in IndexedDB via Dexie.js with metadata fields: title (derived from folder name), creator (empty), subject (empty), description (empty), language (empty), date added (current timestamp), estimated duration (sum of video durations where detectable), and difficulty level (unset)
**And** each supported file is stored as a content item linked to the course with its relative path, type (video/pdf), and file name
**And** the FileSystemHandle is persisted in IndexedDB for future access
**And** the course appears in the library immediately via optimistic Zustand update

**Given** the user selects a folder containing zero supported files
**When** the scan completes
**Then** a toast notification displays "No supported files found (MP4, MKV, AVI, WEBM, PDF)" within 1 second
**And** no course entity is created

**Given** the user denies the browser file permission prompt
**When** the dialog closes
**Then** a toast notification explains the permission requirement with a "Try Again" action
**And** clicking "Try Again" re-triggers the folder picker

**Given** a folder contains nested subfolders
**When** the system scans the folder
**Then** subfolder names are used as section/chapter groupings in the course structure
**And** files within each subfolder are ordered alphabetically by default

### Story 1.2: View Course Library

As a learner,
I want to see all my imported courses in a browsable library view,
So that I can quickly find and access any course I've imported.

**Acceptance Criteria:**

**Given** the user has imported one or more courses
**When** the user navigates to the Course Library page
**Then** all courses are displayed as cards in a responsive grid layout
**And** each card shows: course title, video count, PDF count, and course status badge

**Given** a course card is displayed
**When** the user views the card
**Then** the video count reflects the total number of video files (MP4, MKV, AVI, WEBM)
**And** the PDF count reflects the total number of PDF files
**And** the course title matches the imported folder name (or user-edited title)

**Given** no courses have been imported
**When** the user visits the Course Library page
**Then** an empty state is displayed with a prominent "Import Your First Course" call-to-action
**And** brief helper text explains what types of folders can be imported

**Given** the user has many courses (10+)
**When** the library loads
**Then** all courses render without perceptible delay (data query <100ms per NFR4)
**And** course data persists across browser sessions without manual save (NFR9)

### Story 1.3: Manage Course Status

As a learner,
I want to categorize my courses as Active, Completed, or Paused,
So that I can focus on what I'm currently studying and track what I've finished.

**Acceptance Criteria:**

**Given** a course exists in the library
**When** the user views the course card
**Then** the current status is displayed as a badge (Active = blue, Completed = green, Paused = gray)
**And** newly imported courses default to "Active" status

**Given** a course card is displayed
**When** the user clicks the status badge or opens a course context menu
**Then** a dropdown/popover presents the three status options: Active, Completed, Paused
**And** selecting a status updates the badge immediately (optimistic Zustand update)
**And** the change is persisted to IndexedDB

**Given** the library contains courses with mixed statuses
**When** the user views the library
**Then** courses can be filtered by status (All, Active, Completed, Paused)
**And** the active filter is visually indicated

### Story 1.4: Organize Courses by Topic

As a learner,
I want to assign topic categories to my courses and filter by them,
So that I can keep my library organized as it grows.

**Acceptance Criteria:**

**Given** a course exists in the library
**When** the user opens the course details or context menu
**Then** an option to assign a topic/category is available
**And** the user can select from existing topics or create a new one

**Given** the user types a new topic name
**When** they confirm the creation
**Then** the topic is saved and immediately available for other courses
**And** the course is tagged with the new topic

**Given** topics have been assigned to courses
**When** the user views the library
**Then** a topic filter is available (dropdown or chip bar)
**And** selecting a topic shows only courses in that category
**And** selecting "All" shows all courses regardless of topic

**Given** a course has a topic assigned
**When** the user views the course card
**Then** the topic is displayed on the card as a subtle label or tag

**Given** a topic has no courses assigned to it
**When** the last course is removed from that topic
**Then** the empty topic remains available for future use (not auto-deleted)

### Story 1.5: Detect Missing or Relocated Files

As a learner,
I want the system to alert me when course files have been moved or deleted from my file system,
So that I know which content is unavailable and can take action.

**Acceptance Criteria:**

**Given** a course has been previously imported
**When** the user opens the course or the system loads course data
**Then** the system verifies each FileSystemHandle is still accessible
**And** verification completes without blocking the UI

**Given** a file's FileSystemHandle returns a permission error or file-not-found
**When** the verification completes
**Then** the affected content item displays a "File not found" badge
**And** a toast notification identifies the affected file within 2 seconds (NFR11)

**Given** some files in a course are missing but others are available
**When** the user views the course structure
**Then** available files are fully functional
**And** missing files show the "file not found" badge but remain in the structure
**And** the user can still navigate and access the available content

**Given** the user re-grants file permission or restores the file
**When** the system re-verifies the handle (on next course load)
**Then** the "file not found" badge is removed
**And** the content becomes accessible again

---

## Epic 2: Lesson Player & Content Consumption

Users can watch videos with full playback controls, view PDFs, bookmark positions, resume where they left off, load captions, and navigate course structure in a focused, distraction-free interface.

### Story 2.1: Video Player with Standard Controls

As a learner,
I want to play course videos with standard playback controls,
So that I can watch content at my own pace with full control over playback.

**Acceptance Criteria:**

**Given** the user selects a video from the course structure
**When** the video loads
**Then** playback starts within 500ms of user action for local files (NFR3)
**And** the video player (react-player) renders with a custom controls overlay

**Given** the video player is displaying a video
**When** the user interacts with the controls
**Then** play/pause toggles playback (also via Space key)
**And** a seek bar allows scrubbing to any position in the video
**And** volume control adjusts audio level (also via M key to mute/unmute)
**And** playback speed can be set to 0.5x, 0.75x, 1x, 1.25x, 1.5x, or 2x
**And** a fullscreen toggle expands the player to fill the screen (also via F key)

**Given** the video player is active
**When** the user presses keyboard shortcuts
**Then** Space toggles play/pause
**And** Left/Right arrows seek backward/forward by 5 seconds
**And** M toggles mute
**And** F toggles fullscreen
**And** Escape exits fullscreen (NFR58)

**Given** the video finishes playing
**When** playback reaches the end
**Then** the player shows a completion state
**And** the next video in the course structure is suggested (if one exists)

### Story 2.2: Course Structure Navigation

As a learner,
I want to see the full structure of my course and navigate between videos and PDFs,
So that I can follow the course in order or jump to specific content.

**Acceptance Criteria:**

**Given** the user opens a course
**When** the course player view loads
**Then** a course structure panel displays all sections (from subfolder names) with their contained videos and PDFs
**And** items are listed in their original folder order
**And** the currently playing/viewing item is highlighted

**Given** the course structure panel is visible
**When** the user clicks on a different video or PDF
**Then** the player switches to that content within 200ms (NFR22)
**And** the structure panel updates to highlight the new active item

**Given** the user is watching a video
**When** the user clicks "Next" or "Previous" navigation controls
**Then** the player advances to the next or previous content item in sequence
**And** the transition is seamless with no full page reload

**Given** a course has sections (subfolders)
**When** the user views the structure panel
**Then** sections are collapsible/expandable
**And** each section shows the count of items within it

### Story 2.3: PDF Viewer

As a learner,
I want to view PDF course materials with page navigation,
So that I can read supplementary content alongside my video lessons.

**Acceptance Criteria:**

**Given** the user selects a PDF from the course structure
**When** the PDF loads
**Then** the PDF is rendered using react-pdf (Mozilla PDF.js wrapper)
**And** the first page is displayed by default

**Given** a PDF is displayed
**When** the user interacts with navigation controls
**Then** page forward/backward buttons navigate between pages
**And** a page number indicator shows "Page X of Y"
**And** the user can jump to a specific page by entering a page number

**Given** a PDF is displayed
**When** the user uses keyboard navigation
**Then** Left/Right arrow keys navigate between pages
**And** the current page number updates accordingly

**Given** a large PDF is loaded
**When** rendering completes
**Then** memory usage stays within bounds (NFR33 — no more than 100MB additional for 2GB+ files)
**And** pages render progressively without blocking the UI

### Story 2.4: Video Bookmarks & Bookmarks Page

As a learner,
I want to bookmark specific moments in videos and access all my bookmarks in one place,
So that I can quickly return to important sections across all my courses.

**Acceptance Criteria:**

**Given** the user is watching a video
**When** the user clicks the bookmark button on the player controls
**Then** the current video position (timestamp) is saved as a bookmark
**And** the bookmark is linked to the specific course and video
**And** a brief toast confirms "Bookmark added"

**Given** the user has created bookmarks
**When** the user navigates to the Bookmarks page
**Then** all bookmarks are listed with: course title, video title, timestamp, and date created
**And** bookmarks are sorted by most recent first

**Given** a bookmark entry is displayed
**When** the user clicks on it
**Then** the system navigates to the course player, loads the video, and seeks to the bookmarked timestamp
**And** playback resumes from that position

**Given** a bookmark exists for a video
**When** the user is watching that video and the playback position passes a bookmarked timestamp
**Then** a subtle visual indicator appears on the seek bar at the bookmark position

**Given** the user wants to remove a bookmark
**When** the user clicks the delete/remove action on a bookmark
**Then** a confirmation dialog appears (NFR23 — destructive actions require confirmation)
**And** upon confirmation, the bookmark is removed

### Story 2.5: Resume Video Playback Position

As a learner,
I want the system to remember where I stopped watching each video,
So that I can seamlessly pick up where I left off.

**Acceptance Criteria:**

**Given** the user is watching a video
**When** the user navigates away, closes the tab, or switches to another video
**Then** the current playback position is saved to IndexedDB automatically
**And** no manual save action is required

**Given** a video has a previously saved playback position
**When** the user returns to that video
**Then** playback resumes from the exact last position within 1 second (NFR20)
**And** a brief toast or overlay shows "Resuming from X:XX"

**Given** a video has been watched to completion
**When** the user returns to it
**Then** playback starts from the beginning (position is reset)

**Given** the user has multiple courses with saved positions
**When** resume positions are stored
**Then** each video's position is stored independently
**And** positions persist across browser sessions (NFR9)

### Story 2.6: Focused Content Interface

As a learner,
I want a distraction-free study mode that shows only the content I need,
So that I can concentrate on learning without UI clutter.

**Acceptance Criteria:**

**Given** the user opens a course and starts a study session
**When** the lesson player view loads
**Then** the interface shows only: the video/PDF player, the note panel (placeholder until Epic 3), and the course navigation panel
**And** the main app sidebar is hidden
**And** no dashboard widgets, unrelated navigation, or promotional elements are visible

**Given** the focused content interface is active
**When** the user wants to return to the main app
**Then** a clear "Back to Library" or close button is available
**And** clicking it returns to the course library or dashboard

**Given** the focused interface is displayed on desktop (1024px+)
**When** the layout renders
**Then** the video player occupies the primary area (left)
**And** the note panel area is positioned to the right
**And** the course navigation is accessible as a collapsible sidebar or panel

**Given** the focused interface is displayed on mobile (<1024px)
**When** the layout renders
**Then** the video player is stacked above the note panel area
**And** the course navigation is accessible via a toggle/drawer

### Story 2.7: Caption and Subtitle Support

As a learner,
I want to load subtitle files alongside my videos,
So that I can follow along with captions for better comprehension.

**Acceptance Criteria:**

**Given** the user has a video loaded in the player
**When** the user clicks a "Load Captions" button on the player controls
**Then** a file picker opens filtered for SRT and WebVTT files
**And** the user can select a caption file from their local file system

**Given** a valid SRT or WebVTT file has been loaded
**When** the video plays
**Then** captions are displayed synchronized to video playback
**And** synchronization accuracy is within 200ms (NFR59)
**And** captions are visually styled for readability (semi-transparent background, white text)

**Given** captions are active
**When** the user presses the C key
**Then** caption visibility toggles on/off (NFR58)

**Given** the user loads an invalid or malformed caption file
**When** parsing fails
**Then** a toast notification explains the error within 1 second (NFR13)
**And** the video continues to play without captions

**Given** a caption file has been successfully loaded for a video
**When** the user returns to that video later
**Then** the caption file association is persisted
**And** captions load automatically on subsequent visits

---

## Epic 3: Smart Note System

Users can create Markdown notes linked to courses and videos, timestamp notes to exact playback positions, search across all notes with full-text search, and work in a side-by-side video+notes layout — all with invisible autosave.

### Story 3.1: Create and Edit Notes with TipTap Editor

As a learner,
I want to write notes using a rich Markdown editor while studying,
So that I can capture ideas and key points in a structured, readable format.

**Acceptance Criteria:**

**Given** the user is in the focused content interface (lesson player)
**When** the user clicks into the note panel area
**Then** a TipTap editor (@tiptap/react) renders with full editing capabilities
**And** the editor supports Markdown syntax: headings (#, ##, ###), bold (**), italic (*), lists (-, 1.), code blocks (```), blockquotes (>), and links

**Given** the TipTap editor is active
**When** the user types Markdown shortcuts
**Then** the editor converts them to rich text in real-time (e.g., typing "# " at line start creates a heading)
**And** keyboard shortcuts work: Ctrl/Cmd+B for bold, Ctrl/Cmd+I for italic, Ctrl/Cmd+Shift+L for bullet list (NFR42)

**Given** the user has typed content into the editor
**When** the content is serialized
**Then** the output is clean Markdown text stored in IndexedDB
**And** all user-generated content is sanitized to prevent XSS (NFR50 — TipTap's ProseMirror handles this by design)

**Given** the user opens the editor for an existing note
**When** the editor loads
**Then** the previously saved Markdown content renders correctly with formatting preserved

**Given** the editor is active
**When** the user navigates away without any explicit save action
**Then** no "unsaved changes" warning appears (persistence is handled by autosave, implemented in a subsequent story within this epic)

### Story 3.2: Link Notes to Courses and Videos

As a learner,
I want my notes to be automatically linked to the course and video I'm watching,
So that I can always find my notes in the right context.

**Acceptance Criteria:**

**Given** the user is watching a specific video in a course
**When** the user creates or edits a note in the note panel
**Then** the note is automatically associated with the current course ID and video/content item ID
**And** no manual linking action is required from the user

**Given** a note is linked to a specific video
**When** the user views the note
**Then** the note displays the course title and video title it's linked to

**Given** the user navigates to a different video within the same course
**When** the note panel loads
**Then** it shows any existing notes linked to the newly active video
**And** a "New Note" action is available to create a fresh note for this video

**Given** the user wants to see all notes for a course
**When** the user opens the course notes view (accessible from course structure or course card)
**Then** all notes across all videos in that course are listed
**And** each note shows the linked video title and a preview of its content
**And** notes are sorted by most recently modified

### Story 3.3: Tag Notes for Organization

As a learner,
I want to add tags to my notes,
So that I can categorize and find related notes across different courses.

**Acceptance Criteria:**

**Given** a note is open in the editor
**When** the user clicks an "Add Tag" action (below the editor or in a toolbar)
**Then** a tag input appears where the user can type a tag name
**And** existing tags from the user's tag library are suggested as the user types (autocomplete)

**Given** the user types a new tag name that doesn't exist
**When** they confirm (Enter key or click)
**Then** the new tag is created and added to the note
**And** the tag is available for future notes

**Given** a note has one or more tags
**When** the user views the note
**Then** tags are displayed as removable chips/badges below the note title
**And** clicking the X on a tag removes it from that note (without deleting the tag itself)

**Given** the user is browsing notes (course notes view or global notes)
**When** the user clicks on a tag
**Then** the view filters to show only notes with that tag
**And** the active tag filter is visually indicated

### Story 3.4: Timestamp Notes to Video Positions

As a learner,
I want to insert the current video timestamp into my notes and click timestamps to jump to that moment,
So that I can create precise references between my notes and the video content.

**Acceptance Criteria:**

**Given** the user is watching a video and the note editor is active
**When** the user presses the configurable timestamp keyboard shortcut (default: Ctrl/Cmd+Shift+T)
**Then** the current video playback position is inserted into the note as a formatted timestamp link (e.g., [02:34])
**And** the timestamp is visually distinct from regular text (styled as a clickable link)

**Given** a note contains a timestamp link
**When** the user clicks on the timestamp
**Then** the video player seeks to that exact position
**And** playback resumes from the timestamp position

**Given** the user wants to change the timestamp keyboard shortcut
**When** the user opens settings/preferences
**Then** a configurable shortcut input allows rebinding the timestamp insertion key combination

**Given** the video is paused
**When** the user inserts a timestamp
**Then** the timestamp reflects the current paused position accurately
**And** the video remains paused after insertion

**Given** a note with timestamps is viewed outside the video context (e.g., in course notes list)
**When** the user clicks a timestamp
**Then** the system navigates to the course player, loads the linked video, and seeks to the timestamp position

### Story 3.5: Autosave Notes

As a learner,
I want my notes to save automatically without any manual action,
So that I never lose my work and don't have to think about saving.

**Acceptance Criteria:**

**Given** the user is editing a note
**When** the user pauses typing for 3 seconds (debounce)
**Then** the note content is automatically saved to IndexedDB
**And** no save button, save confirmation, or save indicator interrupts the user (invisible autosave)

**Given** autosave triggers
**When** the save operation executes
**Then** it completes in less than 50ms (NFR5)
**And** the Zustand store is updated first (optimistic), then Dexie.js persists asynchronously

**Given** the user is rapidly editing (typing continuously)
**When** the 3-second debounce has not elapsed
**Then** no save operation is triggered
**And** once the user pauses for 3 seconds, the latest content is saved

**Given** a storage write failure occurs during autosave
**When** the error is detected
**Then** a user-visible error notification appears within 1 second with a retry option (NFR10)
**And** the note content remains in the Zustand store so no data is lost

**Given** the user closes the browser tab or navigates away while editing
**When** the beforeunload event fires
**Then** any pending unsaved changes are flushed to IndexedDB immediately
**And** zero data loss occurs for notes during standard workflows (NFR8)

### Story 3.6: Full-Text Note Search

As a learner,
I want to search across all my notes instantly,
So that I can find information I've written regardless of which course it's in.

**Acceptance Criteria:**

**Given** the user has created notes across multiple courses
**When** the user opens the note search interface (accessible from the main navigation or a search bar)
**Then** a search input is displayed with placeholder text indicating full-text search capability

**Given** the user types a query into the search input
**When** characters are entered
**Then** results appear in real-time as the user types (< 100ms per NFR21)
**And** search is powered by MiniSearch with fuzzy matching and prefix search
**And** results show: note title/preview, matched snippet with highlighted terms, linked course title, and linked video title

**Given** search results are displayed
**When** the user clicks on a result
**Then** the note opens in context (within its linked course/video view)

**Given** the user searches for a term that appears in timestamps or tags
**When** results are returned
**Then** tag matches and timestamp-adjacent text are included in results

**Given** the search index needs to stay current
**When** a note is created, updated, or deleted
**Then** the MiniSearch index is updated incrementally (not rebuilt from scratch)
**And** subsequent searches immediately reflect the change

### Story 3.7: Side-by-Side Video and Notes Layout

As a learner,
I want to see the video player and my notes side by side on desktop,
So that I can take notes while watching without switching between views.

**Acceptance Criteria:**

**Given** the user is in the focused content interface on desktop (1024px+)
**When** the layout renders
**Then** the video player occupies the left portion of the screen
**And** the note editor occupies the right portion
**And** both are visible simultaneously without scrolling

**Given** the side-by-side layout is active
**When** the user resizes the browser window to below 1024px
**Then** the layout switches to a stacked arrangement (video on top, notes below)
**And** the transition is smooth without content loss

**Given** the layout is in stacked mode (< 1024px)
**When** the user resizes the window to 1024px or wider
**Then** the layout returns to side-by-side arrangement

**Given** the side-by-side layout is active
**When** the user drags the divider between video and notes
**Then** the panels resize proportionally
**And** minimum widths are enforced so neither panel becomes unusable

**Given** the user has adjusted the panel proportions
**When** they return to the focused content interface later
**Then** the previous panel proportions are restored from stored preferences

---

## Epic 4: Progress Tracking & Session History

Users can mark content completion status, view visual progress maps with color coding, track study time, review session history, and resume their last session directly from the dashboard.

### Story 4.1: Mark Content Completion Status

As a learner,
I want to mark videos and chapters as Not Started, In Progress, or Completed with clear color-coded indicators,
So that I can visually track my progress through course content at a glance.

**Acceptance Criteria:**

**Given** a user is viewing a course's content structure panel
**When** they click on a video or chapter's status indicator
**Then** a status selector appears with three options: Not Started, In Progress, and Completed
**And** each option displays its corresponding color: gray for Not Started, blue for In Progress, green for Completed

**Given** a user selects a new completion status for a content item
**When** the status change is confirmed
**Then** the state change is atomic — the UI updates optimistically via the Zustand store and persists to Dexie.js IndexedDB
**And** if the IndexedDB write fails, the Zustand state rolls back to the previous value
**And** no partial or inconsistent state is ever visible to the user

**Given** a content item has a completion status
**When** the course structure panel renders
**Then** the item displays a color-coded visual indicator: gray circle for Not Started, blue circle for In Progress, green circle with checkmark for Completed
**And** each indicator uses sufficient color contrast (WCAG 2.1 AA) and includes a text label or tooltip for accessibility

**Given** a user marks the last incomplete item in a chapter as Completed
**When** the state updates
**Then** the parent chapter status automatically updates to Completed
**And** the chapter's visual indicator changes to green

**Given** a user changes a Completed item back to In Progress or Not Started
**When** the state updates
**Then** any parent chapter that was auto-completed reverts to In Progress
**And** dependent progress calculations update immediately

### Story 4.2: Course Completion Percentage

As a learner,
I want to see an accurate completion percentage for each course based on my content progress,
So that I can understand how far I am through each course and prioritize my study time.

**Acceptance Criteria:**

**Given** a course contains multiple content items with completion statuses
**When** the course card or course detail page renders
**Then** a progress bar displays the completion percentage calculated as (Completed items / Total items) x 100
**And** the progress bar uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, and `aria-valuemax="100"` attributes
**And** a text equivalent (e.g., "65% complete") is visible alongside the progress bar

**Given** a user marks a content item as Completed
**When** the completion status changes
**Then** the course completion percentage recalculates and updates in real-time without requiring a page refresh
**And** the progress bar animates smoothly to the new value

**Given** a course has zero content items marked as Completed
**When** the progress bar renders
**Then** the progress bar shows 0% with an empty state
**And** the aria-valuenow attribute is set to 0

**Given** a course has all content items marked as Completed
**When** the progress bar renders
**Then** the progress bar shows 100% with a full/completed visual state
**And** the course card displays a completion badge or indicator

**Given** a user is browsing the course library
**When** multiple course cards are visible
**Then** each card displays its individual completion percentage progress bar
**And** progress bars are consistent in size, position, and styling across all cards

### Story 4.3: Automatic Study Session Logging

As a learner,
I want my study sessions to be automatically tracked with date, duration, and content covered,
So that I can understand my study habits without manual effort and see my total study time across all courses.

**Acceptance Criteria:**

**Given** a user navigates into a course's focused content interface
**When** the content interface mounts
**Then** a new study session record is created in the Zustand session store with the current date, start timestamp, course ID, and content item ID
**And** the session is persisted to Dexie.js IndexedDB

**Given** an active study session is in progress
**When** the user navigates away from the content interface, closes the tab, or the browser fires a visibilitychange event to hidden
**Then** the session end timestamp is recorded and the duration is calculated
**And** the session record is updated with: total duration, list of videos watched, and pages viewed during the session

**Given** an active study session is in progress
**When** the user is idle for more than 5 minutes (no mouse, keyboard, or touch events)
**Then** the session is automatically paused
**And** idle time is excluded from the session duration
**And** when the user resumes activity, the session continues without creating a new record

**Given** multiple study sessions have been logged across different courses
**When** the user views their total study time
**Then** the system displays an aggregate total study time calculated from all session durations across all courses
**And** per-course study time totals are also available

**Given** the user's browser crashes or is force-closed during an active session
**When** the application next loads
**Then** the system detects any orphaned session records (sessions with a start time but no end time)
**And** closes them with the last known activity timestamp as the end time

### Story 4.4: View Study Session History

As a learner,
I want to view a chronological history of my study sessions with details about what I studied,
So that I can reflect on my learning patterns and verify my study activity.

**Acceptance Criteria:**

**Given** a user has logged study sessions
**When** they navigate to the session history view
**Then** sessions are displayed in reverse chronological order (most recent first)
**And** each entry shows: date, duration (formatted as hours and minutes), course title, and a summary of content covered (video titles and/or chapter names)

**Given** a user is viewing the session history
**When** they select a course filter
**Then** only sessions for the selected course are displayed
**And** the filter selection persists until cleared

**Given** a user is viewing the session history
**When** they select a date range filter
**Then** only sessions within the selected start and end dates are displayed
**And** both course and date range filters can be applied simultaneously

**Given** a user has no study sessions recorded
**When** they navigate to the session history view
**Then** an empty state is displayed with a message encouraging them to start learning
**And** a call-to-action links to the Courses page

**Given** a user has many study sessions
**When** the session history list exceeds the viewport
**Then** the list is virtualized or paginated to maintain smooth scrolling performance
**And** sessions load progressively without blocking the UI

**Given** a user is viewing a session entry
**When** they click or tap on the entry
**Then** an expanded view shows additional details: exact start and end times, individual content items accessed with timestamps, and a link to resume that course

### Story 4.5: Continue Learning Dashboard Action

As a learner,
I want a prominent "Continue Learning" action on the dashboard that resumes my last study session,
So that I can pick up exactly where I left off within one click of launching the app.

**Acceptance Criteria:**

**Given** a user has at least one previous study session
**When** they land on the Overview (dashboard) page
**Then** a "Continue Learning" card is prominently displayed near the top of the page
**And** the card shows: course title, video/chapter title, a thumbnail or icon, and a progress indicator showing how far through the content they are

**Given** the "Continue Learning" card is displayed
**When** the user clicks the "Continue Learning" action
**Then** the app navigates directly to the course content interface, loads the exact video or chapter, and resumes playback at the last known position
**And** the transition from click to content ready takes less than 1 second (NFR17)

**Given** a user has sessions across multiple courses
**When** the dashboard renders
**Then** the "Continue Learning" card shows the most recently active session
**And** optionally, a secondary row or carousel shows other recently accessed courses for quick access

**Given** a user has never started any course
**When** they land on the dashboard
**Then** the "Continue Learning" section displays a discovery state suggesting courses to start
**And** no broken or empty card is shown

**Given** a user clicks "Continue Learning"
**When** the target course or content item has been deleted or is no longer available
**Then** a graceful fallback message is displayed explaining the content is unavailable
**And** the user is offered alternative courses or redirected to the Courses page

**Given** the dashboard is rendered on a mobile viewport
**When** the "Continue Learning" card is visible
**Then** the card is fully responsive with touch-friendly tap targets (minimum 44x44px)
**And** the card maintains its prominence as the first actionable element on the page

---

## Epic 5: Study Streaks & Daily Goals

Users can build daily study streaks, set study goals, view a streak calendar, configure reminders and freeze days, and celebrate streak milestones — creating the daily accountability loop that drives consistent learning.

### Story 5.1: Daily Study Streak Counter

As a learner,
I want to see my current daily study streak prominently on the dashboard,
So that I feel motivated to maintain consistent study habits.

**Acceptance Criteria:**

**Given** a learner has completed study sessions on consecutive days
**When** they view the Overview dashboard
**Then** a streak counter widget displays the current streak count with a fire emoji
**And** the counter is visually prominent within the dashboard layout

**Given** a learner completes a study session on a new calendar day
**When** the session is recorded
**Then** the streak count increments by one
**And** a pulse animation plays on the streak counter (respecting prefers-reduced-motion)

**Given** a learner has not completed any study session for more than 24 hours
**When** the streak evaluation runs (excluding configured freeze days from Story 5.2)
**Then** the streak counter resets to zero
**And** the previous streak is preserved in history

**Given** a learner has a streak of zero
**When** they complete their first study session
**Then** the streak counter displays 1
**And** the fire emoji and pulse animation appear

### Story 5.2: Streak Pause & Freeze Days

As a learner,
I want to pause my streak or configure weekly freeze days,
So that I can take planned rest days without losing my streak progress.

**Acceptance Criteria:**

**Given** a learner has an active study streak
**When** they toggle the streak pause control
**Then** the streak enters a paused state
**And** the dashboard streak counter displays a paused indicator (e.g., pause icon or "Paused" label)
**And** the streak count is preserved and does not reset while paused

**Given** a learner has a paused streak
**When** they resume the streak
**Then** the paused state is cleared
**And** the streak counter resumes from its previous value
**And** the 24-hour inactivity window resets from the moment of resumption

**Given** a learner wants to configure freeze days
**When** they open the freeze day settings
**Then** they can select 1 to 3 days of the week as freeze days
**And** the selected days are visually indicated

**Given** a learner has configured freeze days
**When** a freeze day passes with no study activity
**Then** the streak does not reset
**And** the freeze day is recorded distinctly in the study history
**And** the streak counter from Story 5.1 respects freeze days in its 24-hour evaluation

**Given** a learner studies on a configured freeze day
**When** the session is recorded
**Then** the day counts as a regular study day (not consumed as a freeze)
**And** the streak increments normally

**Given** a learner attempts to select more than 3 freeze days
**When** they try to toggle a fourth day
**Then** the selection is prevented
**And** a validation message explains the maximum of 3 freeze days per week

**Given** a learner has both a paused streak and configured freeze days
**When** the streak is paused
**Then** freeze day logic is suspended until the streak is resumed

### Story 5.3: Study Goals & Weekly Adherence

As a learner,
I want to set daily or weekly study goals and see my progress against them,
So that I can hold myself accountable to a consistent study schedule.

**Acceptance Criteria:**

**Given** a learner has not configured any study goals
**When** they view the goals widget on the dashboard
**Then** an empty state prompts them to set their first goal with a clear call-to-action

**Given** a learner wants to configure a study goal
**When** they open the goal configuration form
**Then** they can choose between a daily goal or a weekly goal
**And** they can select goal type as time-based (minutes per day/week) or session-based (sessions per day/week)
**And** they can set a numeric target value

**Given** a learner has an active daily study goal
**When** they view the Overview dashboard
**Then** a progress widget shows current progress toward today's goal (e.g., "45 / 60 min")
**And** a visual progress indicator (progress bar or ring) reflects the percentage completed

**Given** a learner has an active weekly study goal
**When** they view the Overview dashboard
**Then** the widget shows weekly cumulative progress against the weekly target

**Given** a learner has been active for at least one week with a goal configured
**When** they view the dashboard or analytics
**Then** a weekly adherence percentage is displayed calculated as (actual study days / target study days) x 100
**And** the adherence percentage updates in real time as sessions are completed

**Given** a learner meets their daily or weekly goal
**When** the goal threshold is reached
**Then** the progress widget visually indicates completion (e.g., filled ring, checkmark)

### Story 5.4: Study History Calendar

As a learner,
I want to view a visual calendar showing my study history,
So that I can see patterns in my study habits and identify gaps.

**Acceptance Criteria:**

**Given** a learner navigates to the study history calendar
**When** the calendar renders
**Then** a month-view calendar is displayed for the current month
**And** days with recorded study sessions are visually highlighted (distinct background or dot indicator)
**And** days without study activity use the default styling

**Given** a learner wants to view a different month
**When** they use the previous/next month navigation controls
**Then** the calendar updates to show the selected month with correct study highlights

**Given** a learner sees a highlighted day on the calendar
**When** they click on that day
**Then** a detail panel or popover displays the study sessions for that date
**And** each session shows the course name, duration, and timestamp

**Given** a learner clicks on a day with no study sessions
**When** the detail panel opens
**Then** it displays an empty state message such as "No study sessions on this day"

**Given** the learner has configured freeze days (Story 5.2)
**When** the calendar renders
**Then** freeze days are visually distinguished from regular no-activity days (e.g., different color or icon)

**Given** the learner views the calendar on a mobile viewport
**When** the calendar renders
**Then** it remains usable with appropriately sized touch targets (minimum 44x44px)

### Story 5.5: Study Reminders & Notifications

As a learner,
I want to configure browser notification reminders for studying,
So that I receive timely nudges that help me maintain my streak and study habits.

**Acceptance Criteria:**

**Given** a learner wants to enable study reminders
**When** they toggle reminders on for the first time
**Then** the browser Notifications API permission prompt is triggered
**And** if permission is granted, the reminder configuration options become available
**And** if permission is denied, a helpful message explains how to enable notifications in browser settings

**Given** a learner has granted notification permission
**When** they configure a daily reminder
**Then** they can select a specific time of day for the reminder
**And** the reminder is saved and scheduled

**Given** a learner has granted notification permission
**When** they enable the streak-at-risk reminder
**Then** the system monitors for 22+ hours of inactivity
**And** a notification is sent when the streak is within 2 hours of breaking

**Given** a daily reminder is scheduled and the chosen time arrives
**When** the browser is open (or service worker is active)
**Then** a browser notification is displayed with a motivating message and the current streak count

**Given** the learner has not studied for 22+ hours and streak-at-risk is enabled
**When** the 22-hour inactivity threshold is crossed
**Then** a browser notification warns that the streak will break in approximately 2 hours
**And** the notification tone is supportive, not guilt-inducing

**Given** a learner wants to disable reminders
**When** they toggle reminders off
**Then** all scheduled notifications are cancelled
**And** the toggle state is persisted

**Given** the learner has a paused streak (Story 5.2)
**When** the streak is paused
**Then** streak-at-risk notifications are suppressed until the streak is resumed

### Story 5.6: Streak Milestone Celebrations

As a learner,
I want to receive celebratory notifications when I hit streak milestones,
So that I feel rewarded for my consistency and motivated to keep going.

**Acceptance Criteria:**

**Given** a learner's streak count reaches 7 days
**When** the milestone is triggered
**Then** a Sonner toast notification appears with a 7-day milestone badge
**And** a celebratory animation plays (confetti, sparkle, or equivalent)
**And** the badge is saved to the learner's milestone collection

**Given** a learner's streak count reaches 30 days
**When** the milestone is triggered
**Then** a toast notification appears with a 30-day milestone badge and celebration animation

**Given** a learner's streak count reaches 60 days
**When** the milestone is triggered
**Then** a toast notification appears with a 60-day milestone badge and celebration animation

**Given** a learner's streak count reaches 100 days
**When** the milestone is triggered
**Then** a toast notification appears with a 100-day milestone badge and celebration animation

**Given** a learner has the prefers-reduced-motion media query active
**When** any milestone celebration triggers
**Then** the celebratory animation is suppressed or replaced with a static badge display
**And** the toast notification still appears with the badge

**Given** a learner has earned milestone badges
**When** they view their milestone collection (accessible from the streak widget or profile)
**Then** all earned badges are displayed with the date achieved
**And** unearned milestones are shown as locked or dimmed placeholders

**Given** a learner's streak resets and they reach a milestone again
**When** the repeated milestone is triggered
**Then** the celebration toast appears again
**And** the new achievement date is recorded alongside the previous one

---

## Epic 6: Learning Challenges & Gamification

Users can create custom learning challenges with specific targets and deadlines, track progress against them, and receive milestone celebrations — adding goal-directed motivation beyond daily streaks.

### Story 6.1: Create Learning Challenges

As a learner,
I want to create custom learning challenges by specifying a name, type, target metric, and deadline,
So that I can set concrete goals that motivate me beyond daily streaks.

**Acceptance Criteria:**

**Given** the user navigates to the challenges section
**When** they open the "Create Challenge" form
**Then** the form displays fields for challenge name, challenge type, target value, and deadline

**Given** the create challenge form is open
**When** the user selects a challenge type
**Then** they can choose from three types: completion-based (videos completed), time-based (study hours), or streak-based (streak days)
**And** the target metric label updates to reflect the selected type (e.g., "videos", "hours", "days")

**Given** the user has filled in the challenge form
**When** they submit with a valid name (1-60 characters), a target value greater than zero, and a deadline in the future
**Then** the challenge is saved to IndexedDB with a unique ID, creation timestamp, and initial progress of zero
**And** a success toast confirms the challenge was created

**Given** the user submits the form with invalid inputs
**When** the name is empty, the target value is zero or negative, or the deadline is in the past
**Then** inline validation errors are shown for each invalid field
**And** the form is not submitted

**Given** a screen reader user interacts with the create challenge form
**When** they navigate through the fields
**Then** all inputs have associated labels, error messages are announced via aria-live, and the form is fully keyboard-navigable

### Story 6.2: Track Challenge Progress

As a learner,
I want to see my active challenges with real-time progress indicators,
So that I can understand how close I am to achieving each goal.

**Acceptance Criteria:**

**Given** the user has one or more active challenges saved in IndexedDB
**When** they view the challenges section
**Then** a dashboard widget displays each active challenge with its name, type icon, progress bar, percentage complete, and remaining time until deadline

**Given** a completion-based challenge exists with a target of N videos
**When** the progress is calculated
**Then** the system counts the user's completed videos from session/completion data since the challenge creation date
**And** the progress bar reflects (completed / target) as a percentage capped at 100%

**Given** a time-based challenge exists with a target of N study hours
**When** the progress is calculated
**Then** the system sums the user's logged study session durations since the challenge creation date
**And** the progress bar reflects (hours logged / target hours) as a percentage capped at 100%

**Given** a streak-based challenge exists with a target of N streak days
**When** the progress is calculated
**Then** the system reads the user's current or longest streak count since the challenge creation date
**And** the progress bar reflects (streak days / target days) as a percentage capped at 100%

**Given** a challenge's deadline has passed and the target was not reached
**When** the user views the challenges section
**Then** the challenge is visually marked as expired with a muted style
**And** it is separated from active challenges (e.g., shown in an "Expired" group or collapsed section)

**Given** no active challenges exist
**When** the user views the challenges section
**Then** an empty state is displayed with a message encouraging the user to create their first challenge
**And** a prominent call-to-action links to the create challenge form

### Story 6.3: Challenge Milestone Celebrations

As a learner,
I want to receive celebratory feedback when I reach 25%, 50%, 75%, and 100% of a challenge target,
So that I feel recognized and motivated as I make progress toward my goals.

**Acceptance Criteria:**

**Given** a challenge's progress crosses the 25% threshold for the first time
**When** the milestone is detected
**Then** a Sonner toast notification appears with a milestone badge showing "25% Complete" and the challenge name
**And** the milestone is recorded in IndexedDB so it is not triggered again for the same threshold

**Given** a challenge's progress crosses the 50% threshold for the first time
**When** the milestone is detected
**Then** a toast notification appears with a "Halfway There" milestone badge and a supportive message

**Given** a challenge's progress crosses the 75% threshold for the first time
**When** the milestone is detected
**Then** a toast notification appears with a "Almost There" milestone badge and an encouraging message

**Given** a challenge's progress reaches 100%
**When** the milestone is detected
**Then** a toast notification appears with a celebratory "Challenge Complete" badge
**And** the challenge card in the dashboard transitions to a completed state with a distinct visual treatment (e.g., confetti animation, checkmark overlay, gold accent)
**And** the completed challenge is moved to a "Completed" section

**Given** the user has enabled prefers-reduced-motion in their OS settings
**When** a milestone celebration is triggered
**Then** all animations (confetti, badge entrance, card transitions) are suppressed or replaced with instant/static alternatives
**And** the toast and badge content remain fully visible and accessible

**Given** multiple milestones are crossed simultaneously (e.g., progress jumps from 20% to 80%)
**When** the milestones are detected
**Then** the system triggers toasts sequentially for each uncelebrated threshold (25%, 50%, 75%) with a brief stagger delay
**And** each milestone is individually recorded as celebrated in IndexedDB

---

## Epic 7: Course Momentum & Learning Intelligence

System calculates momentum scores for each course, recommends what to study next, flags at-risk courses, estimates completion times, and suggests optimal study schedules — providing smart, data-driven learning guidance.

### Story 7.1: Momentum Score Calculation & Display

As a learner,
I want to see a momentum score for each course displayed as a hot, warm, or cold indicator and be able to sort my course list by momentum,
So that I can instantly identify which courses have strong engagement momentum and prioritize my study time accordingly.

**Acceptance Criteria:**

**Given** a course exists in the user's library with recorded study sessions
**When** the system calculates the momentum score
**Then** the score is computed as a weighted function of study recency (days since last session, normalized inversely), completion percentage, and study frequency (sessions per week over the past 30 days)
**And** the resulting score is a value between 0 and 100

**Given** a course has a calculated momentum score
**When** the course card is rendered in the course library
**Then** a visual indicator is displayed showing hot (score >= 70), warm (score 30-69), or cold (score < 30) using distinct colors and iconography (e.g., flame for hot, sun for warm, snowflake for cold)

**Given** a course has no recorded study sessions
**When** the momentum score is calculated
**Then** the score defaults to 0 and the indicator displays as cold

**Given** the course library is displayed
**When** the user selects "Sort by Momentum" from the sort options
**Then** courses are ordered from highest to lowest momentum score
**And** the hot/warm/cold indicator remains visible on each course card in the sorted view

**Given** the user completes a study session for a course
**When** the session is recorded
**Then** the momentum score for that course recalculates within the same page session without requiring a full page reload

### Story 7.2: Recommended Next Dashboard Section

As a learner,
I want to see a "Recommended Next" section on my dashboard showing the top 3 courses I should study next,
So that I can quickly resume learning without having to manually decide which course to focus on.

**Acceptance Criteria:**

**Given** the user has 3 or more active courses in their library
**When** the dashboard loads
**Then** a "Recommended Next" section displays exactly 3 course cards ranked by a composite score of momentum score, study recency (most recent first), and completion proximity (courses closest to completion weighted higher)

**Given** the user has fewer than 3 active courses
**When** the dashboard loads
**Then** the "Recommended Next" section displays all available active courses without padding empty slots

**Given** a course appears in the "Recommended Next" section
**When** the user clicks on the course card
**Then** the user is navigated directly to that course's detail or player page

**Given** the user has no active courses in their library
**When** the dashboard loads
**Then** the "Recommended Next" section displays an empty state with a message encouraging the user to import courses

**Given** the user completes a study session from the dashboard
**When** they return to the dashboard
**Then** the "Recommended Next" rankings recalculate to reflect the updated momentum and recency data

### Story 7.3: Next Course Suggestion After Completion

As a learner,
I want the system to suggest the next best course from my library when I complete a course,
So that I can maintain my learning momentum without a gap between courses.

**Acceptance Criteria:**

**Given** the user completes 100% of a course's content
**When** the completion state is confirmed
**Then** the system displays a suggestion card recommending the next course from the user's library, ranked by shared tags with the completed course (weighted 60%) and momentum score (weighted 40%)

**Given** the suggestion algorithm runs
**When** multiple courses share the same number of tags with the completed course
**Then** courses are further ranked by momentum score as the tiebreaker

**Given** the next course suggestion is displayed
**When** the user clicks the suggested course card
**Then** the user is navigated to that course's detail or player page

**Given** the next course suggestion is displayed
**When** the user clicks a dismiss button on the suggestion
**Then** the suggestion is hidden and does not reappear for that completed course

**Given** the user has no remaining active courses in their library
**When** they complete a course
**Then** the system displays a congratulatory message instead of a course suggestion

**Given** the completed course has no tags
**When** the suggestion algorithm runs
**Then** courses are ranked entirely by momentum score (100% weight)

### Story 7.4: At-Risk Course Detection & Completion Estimates

As a learner,
I want courses with no activity for 14 or more days to be flagged as "at risk" and to see estimated completion times for all my courses,
So that I can identify neglected courses before I fall too far behind and plan my study time around realistic completion estimates.

**Acceptance Criteria:**

**Given** a course has had no study activity for 14 or more consecutive days
**And** the course's momentum score is below 20
**When** the course library is rendered
**Then** the course card displays a visible "At Risk" badge or indicator using a warning color that is distinct from the hot/warm/cold momentum indicator

**Given** a course was previously flagged as at risk
**When** the user records a new study session for that course
**And** the momentum score recalculates to 20 or above
**Then** the "At Risk" indicator is removed from the course card

**Given** a course has remaining uncompleted content
**When** the course card is rendered
**Then** an estimated completion time is displayed, calculated as remaining content duration divided by the user's average study pace (average session duration over the past 30 days)

**Given** the user has no recorded study sessions (new user)
**When** the estimated completion time is calculated
**Then** the system uses a default average pace of 30 minutes per session as the baseline estimate

**Given** a course is both at risk and has an estimated completion time
**When** the course card is rendered
**Then** both the "At Risk" indicator and the estimated completion time are visible simultaneously without overlapping or conflicting visually

**Given** the user views the course library with at-risk courses present
**When** the user sorts by momentum
**Then** at-risk courses naturally appear at the bottom of the list due to their low momentum scores

### Story 7.5: Smart Study Schedule Suggestion

As a learner,
I want the system to suggest an optimal daily study schedule based on my historical study patterns, active course count, and weekly goals,
So that I can build consistent study habits aligned with when I'm most likely to study successfully.

**Acceptance Criteria:**

**Given** the user has at least 7 days of recorded study session history
**When** the dashboard loads
**Then** a "Suggested Study Time" widget displays the user's optimal study hour, determined by the hour of day with the highest average session count over the past 30 days

**Given** the user has fewer than 7 days of study history
**When** the dashboard loads
**Then** the "Suggested Study Time" widget displays a message indicating that more data is needed and encourages the user to keep studying to unlock personalized recommendations

**Given** the optimal study hour has been calculated
**When** the widget renders
**Then** it also displays the recommended daily study duration, calculated as the user's weekly goal hours divided by the number of days per week the user has historically studied (rounded to the nearest 15 minutes)
**And** the number of active courses is shown alongside the schedule as context

**Given** the user has set a weekly study goal
**When** the suggested schedule is computed
**Then** the schedule distributes study time across active courses proportionally weighted by momentum score (higher momentum courses get proportionally more time)

**Given** the user has not set a weekly study goal
**When** the widget renders
**Then** the widget prompts the user to set a weekly goal in Settings before a full schedule can be generated
**And** a default suggestion of the optimal study hour is still displayed

**Given** the user's historical peak study hour changes over time
**When** the 30-day rolling window updates with new session data
**Then** the suggested study time adjusts to reflect the updated peak hour without requiring manual intervention

---

## Epic 8: Analytics & Reports Dashboard

Users can view comprehensive study analytics (time breakdowns, completion rates, velocity metrics, retention insights, activity heatmaps) and receive actionable insights derived from their learning patterns.

### Story 8.1: Study Time Analytics

As a learner,
I want to view my study time broken down by daily, weekly, and monthly periods along with my weekly adherence percentage,
So that I can understand how consistently I study and adjust my schedule to meet my goals.

**Acceptance Criteria:**

**Given** the user has recorded study sessions in the platform
**When** the user navigates to the Reports page and views the Study Time Analytics section
**Then** a chart displays total study time aggregated by day for the current week
**And** the user can toggle the chart view between daily, weekly, and monthly period breakdowns
**And** the weekly breakdown shows each week's total study hours for the past 12 weeks
**And** the monthly breakdown shows each month's total study hours for the past 12 months

**Given** the user has a configured weekly study target (defaulting to 5 days if not set)
**When** the Study Time Analytics section loads
**Then** a weekly adherence percentage is displayed calculated as (days studied this week / target days) x 100
**And** the adherence percentage updates in real time as new sessions are recorded
**And** the display includes a visual indicator (progress ring or bar) showing adherence against the target

**Given** the user views any study time chart
**When** the chart renders
**Then** each chart includes descriptive alt text summarizing the data trend
**And** a "View as table" toggle is available that renders the same data in an accessible HTML table
**And** data series are differentiated by pattern or label in addition to color, never by color alone

**Given** the user has no recorded study sessions
**When** the user views the Study Time Analytics section
**Then** an empty state is displayed with a message explaining that data will appear once study sessions are recorded

### Story 8.2: Course Completion Tracking

As a learner,
I want to track my course completion rates over time and see a history of completed courses,
So that I can measure my progress and stay motivated by seeing how many courses I have finished.

**Acceptance Criteria:**

**Given** the user has enrolled in one or more courses with progress data
**When** the user navigates to the Reports page and views the Course Completion Tracking section
**Then** a line or area chart displays overall completion rate over time (percentage of enrolled courses completed, plotted weekly)
**And** the chart x-axis shows weeks and the y-axis shows completion rate percentage from 0 to 100

**Given** the user has completed at least one course
**When** the Course Completion Tracking section loads
**Then** a per-course completion history list is displayed showing each course name, enrollment date, completion date, and total time spent
**And** the list is sorted by completion date descending (most recent first)

**Given** the user views the completion tracking chart
**When** the user hovers over or focuses on a data point
**Then** a tooltip displays the exact completion rate and the number of courses completed out of total enrolled for that period

**Given** the user has completed courses over multiple months
**When** the section renders
**Then** a visual timeline shows course completion milestones plotted chronologically
**And** each milestone shows the course name and completion date
**And** the timeline is keyboard navigable with each milestone focusable

**Given** the user has no completed courses
**When** the user views the Course Completion Tracking section
**Then** an empty state is displayed encouraging the user to continue their in-progress courses
**And** if the user has in-progress courses, a summary of current progress percentages is shown

### Story 8.3: Learning Velocity & Trends

As a learner,
I want to see how quickly I am progressing through content and whether my pace is accelerating or decelerating,
So that I can identify when I am losing momentum and take corrective action before falling behind.

**Acceptance Criteria:**

**Given** the user has watched videos across multiple weeks
**When** the user navigates to the Reports page and views the Learning Velocity section
**Then** a chart displays the number of videos completed per week for the past 12 weeks
**And** the current week's count updates as additional videos are completed

**Given** the user has recorded study sessions with content consumption data
**When** the Learning Velocity section loads
**Then** a metric card displays the average content consumed per study hour (calculated as total video minutes watched / total study hours)
**And** the metric shows the current value alongside the previous period's value for comparison

**Given** the user has at least 4 weeks of velocity data
**When** the trend analysis renders
**Then** a trend indicator shows whether learning velocity is accelerating, stable, or decelerating
**And** acceleration is determined by comparing the average velocity of the most recent 4 weeks against the prior 4 weeks
**And** the indicator uses an upward arrow for acceleration (>10% increase), a flat arrow for stable (within +/-10%), and a downward arrow for deceleration (>10% decrease)
**And** the trend indicator includes a text label (e.g., "Accelerating +15%") so the meaning is not conveyed by icon alone

**Given** the user has fewer than 2 weeks of data
**When** the Learning Velocity section loads
**Then** available metrics are displayed with a note that trend analysis requires at least 4 weeks of data
**And** no trend indicator is shown until sufficient data exists

**Given** the user views the velocity chart
**When** the chart renders
**Then** the chart includes alt text describing the overall velocity trend
**And** a "View as table" toggle is available showing weekly video counts in tabular format

### Story 8.4: Retention Insights & Activity Heatmap

As a learner,
I want to compare my study habits between completed and abandoned courses and see a heatmap of my daily learning activity,
So that I can identify patterns that lead to successful completion and maintain consistent study habits.

**Acceptance Criteria:**

**Given** the user has both completed courses and abandoned courses (no activity for 14+ days with less than 100% completion)
**When** the user navigates to the Reports page and views the Retention Insights section
**Then** a side-by-side comparison displays metrics for completed courses versus abandoned courses
**And** the metrics shown include average study frequency (sessions per week), average time-to-completion (or time before abandonment), and average notes-per-video ratio
**And** each metric is clearly labeled with the group it belongs to (Completed vs Abandoned)

**Given** the user has only completed courses and no abandoned courses
**When** the Retention Insights section loads
**Then** the completed courses metrics are displayed
**And** the abandoned courses column shows a positive message such as "No abandoned courses — keep it up!"

**Given** the user has only abandoned courses and no completed courses
**When** the Retention Insights section loads
**Then** the abandoned courses metrics are displayed
**And** the completed courses column shows an encouraging message with a suggestion to revisit a course

**Given** the user has study session data spanning at least one month
**When** the user views the Activity Heatmap section
**Then** a GitHub-style heatmap grid displays the past 12 months of daily study activity
**And** each cell represents one day, with color intensity proportional to the total session duration for that day
**And** the heatmap uses at least 4 intensity levels (no activity, light, moderate, heavy) plus a legend explaining the scale
**And** hovering over or focusing on a cell shows a tooltip with the date and total study duration

**Given** the user views the activity heatmap
**When** the heatmap renders
**Then** intensity levels are differentiated by both color shade and a pattern or opacity variation so they are distinguishable without color perception
**And** the heatmap includes alt text summarizing the overall activity pattern
**And** a "View as table" toggle is available showing monthly summary data in an accessible HTML table

**Given** the user has no study session data
**When** the Retention Insights and Activity Heatmap sections load
**Then** both sections display appropriate empty states explaining what data is needed

### Story 8.5: Actionable Study Insights

As a learner,
I want to receive 3 to 5 actionable insights derived from my study patterns,
So that I can make informed adjustments to improve my learning outcomes without manually analyzing my data.

**Acceptance Criteria:**

**Given** the user has at least 2 weeks of study session data across multiple courses
**When** the user navigates to the Reports page and views the Actionable Insights section
**Then** between 3 and 5 insight cards are displayed, each containing a concise observation and a specific recommendation
**And** insights are generated from the user's actual study data, not generic tips

**Given** the insight generation engine analyzes the user's data
**When** insights are produced
**Then** the engine evaluates at minimum the following pattern categories: optimal study day/time (e.g., "You study most effectively on Tuesdays — consider scheduling focused sessions then"), course momentum alerts (e.g., "Course X has had no activity for 10 days — it may be at risk of abandonment"), and behavioral correlations (e.g., "Courses where you take notes have a 3x higher completion rate")
**And** each insight includes a relevance indicator showing which data points informed it

**Given** insights were previously generated
**When** the user accumulates 7 or more days of new study data since the last generation
**Then** insights are refreshed to reflect the latest patterns
**And** the section displays a "Last updated" timestamp showing when insights were last recalculated

**Given** the user has fewer than 2 weeks of study data
**When** the Actionable Insights section loads
**Then** a message is displayed explaining that insights require at least 2 weeks of study activity
**And** a progress indicator shows how much more data is needed

**Given** the user views an insight card
**When** the card renders
**Then** each card uses semantic markup with a heading for the observation and body text for the recommendation
**And** cards are keyboard navigable and screen reader accessible
**And** no insight relies solely on color or iconography to convey its meaning

---

## Epic 9: AI-Powered Learning Assistant

Users can get AI-generated video summaries, ask questions answered from their notes, view AI-curated learning paths, receive smart note suggestions, and benefit from automatic content analysis — with AI woven throughout the experience as a study coach.

### Story 9.1: AI Provider Configuration & Security

As a learner,
I want to configure my preferred AI provider and API key in a secure settings panel,
So that I can enable AI-powered features while maintaining control over my credentials and data privacy.

**Acceptance Criteria:**

**Given** I am on the Settings page
**When** I navigate to the "AI Configuration" section
**Then** I see a provider selector listing at least 2 AI providers (OpenAI and Anthropic)
**And** I see a masked API key input field for the selected provider
**And** I see per-feature consent toggles for AI data transmission

**Given** I enter a valid API key and select a provider
**When** I save the configuration
**Then** the API key is stored securely in encrypted local storage
**And** the key is never written to source code, build output, console logs, or client-accessible plain-text storage
**And** a connection test confirms the provider is reachable with a success indicator

**Given** I enter an invalid or empty API key
**When** I attempt to save
**Then** the system displays a validation error and does not persist the invalid key

**Given** no API key is configured or the configured provider is unreachable
**When** I navigate to any page with AI-dependent UI elements
**Then** those elements display an "AI unavailable" status badge
**And** the status badge includes a link to the AI Configuration settings

**Given** I have a working AI configuration
**When** the AI provider becomes unreachable during a session
**Then** AI-dependent elements transition to "AI unavailable" status within 2 seconds
**And** non-AI workflows remain fully functional

**Given** I have consent toggles visible in the AI Configuration section
**When** I disable a specific feature's consent toggle
**Then** that AI feature no longer transmits any data to the external provider
**And** the feature UI indicates it is disabled due to consent settings

**Given** the AI system makes any API call
**When** the request payload is constructed
**Then** only the content being analyzed is included — no user metadata, file paths, or personally identifiable information is transmitted

### Story 9.2: AI Video Summary

As a learner,
I want to generate an AI-powered summary of a video's content displayed alongside the player,
So that I can quickly review key concepts without rewatching the entire video.

**Acceptance Criteria:**

**Given** I am viewing a video in the video player
**When** I click the "Generate Summary" button
**Then** a collapsible panel opens alongside the video player
**And** the AI-generated summary streams into the panel in real time
**And** the summary is between 100 and 300 words

**Given** the summary panel is open with a completed summary
**When** I click the collapse toggle on the panel
**Then** the panel collapses to a minimal bar showing "AI Summary" with an expand button
**And** clicking expand restores the full summary without regenerating

**Given** I click "Generate Summary"
**When** the AI provider takes longer than 30 seconds to respond
**Then** the request is cancelled with a timeout
**And** a fallback message is displayed: "Summary generation timed out. Please try again."
**And** the "Generate Summary" button becomes active again for retry

**Given** I click "Generate Summary"
**When** the AI provider is unavailable or returns an error
**Then** the system falls back gracefully within 2 seconds
**And** displays a non-blocking error message with a retry option
**And** the video player remains fully functional

**Given** the system constructs the summary request payload
**When** the API call is sent
**Then** only the video transcript or content text and associated notes are included
**And** no user metadata, file paths, or storage locations are transmitted

**Given** I have previously generated a summary for this video
**When** I return to the same video later
**Then** the cached summary is available without regeneration
**And** a "Regenerate" option is visible to request a fresh summary

### Story 9.3: Chat-Style Q&A from Notes

As a learner,
I want to ask questions in a chat panel and receive answers sourced from my own notes,
So that I can quickly find information across my study materials without manual searching.

**Acceptance Criteria:**

**Given** I open the AI Q&A chat panel
**When** the panel loads
**Then** I see a chat interface with a text input field and a message history area
**And** a welcome message explains that answers are generated from my personal note corpus

**Given** I type a question and submit it
**When** the AI processes my query
**Then** the answer streams into the chat in real time
**And** each answer cites specific source notes by note title
**And** each citation includes a link to the associated video where the note was taken

**Given** the AI generates a response
**When** the response references multiple notes
**Then** each citation is displayed as a clickable reference (e.g., "[1] Note Title — Video Name")
**And** clicking a citation navigates to the corresponding note or video

**Given** I ask a question that has no relevant notes in my corpus
**When** the AI processes the query
**Then** the response clearly states that no matching notes were found
**And** suggests I add notes on the topic or rephrase the question

**Given** I have an ongoing conversation
**When** I ask a follow-up question
**Then** the AI maintains context from previous messages in the session
**And** the full conversation history is visible and scrollable

**Given** the AI provider is unavailable
**When** I attempt to send a question
**Then** the chat displays an "AI unavailable" message
**And** suggests using the manual full-text note search as a fallback
**And** the transition to fallback occurs within 2 seconds

**Given** the AI constructs a query against my notes
**When** the API call is made
**Then** only note content and the user's question are transmitted
**And** no user metadata, file paths, or personally identifiable information is included

### Story 9.4: AI Learning Path Generation

As a learner,
I want the AI to generate a recommended learning path that orders my courses by inferred prerequisites,
So that I can study topics in the most logical sequence and build knowledge progressively.

**Acceptance Criteria:**

**Given** I have 2 or more imported courses
**When** I navigate to the AI Learning Path section
**Then** I see a "Generate Learning Path" button

**Given** I click "Generate Learning Path"
**When** the AI analyzes my course catalog
**Then** a sequenced list of courses is displayed in recommended order
**And** each course shows a justification explaining why it is placed at that position (e.g., "Prerequisite: covers foundational algebra needed for calculus")

**Given** a generated learning path is displayed
**When** I drag a course to a different position in the list
**Then** the course reorders to the new position
**And** the reordered path is saved as my custom sequence
**And** a visual indicator distinguishes AI-suggested order from manual overrides

**Given** I have manually reordered the learning path
**When** I click "Regenerate"
**Then** the AI produces a fresh ordering based on current course data
**And** a confirmation dialog warns that manual overrides will be replaced
**And** the previous ordering is discarded only after I confirm

**Given** I have fewer than 2 courses
**When** I navigate to the AI Learning Path section
**Then** I see a message explaining that at least 2 courses are needed to generate a learning path
**And** the "Generate Learning Path" button is disabled

**Given** the AI provider is unavailable
**When** I attempt to generate a learning path
**Then** the system displays an "AI unavailable" status with retry option
**And** falls back within 2 seconds without disrupting other page functionality

### Story 9.5: Knowledge Gap Detection

As a learner,
I want the system to identify gaps in my study coverage and suggest content to revisit,
So that I can strengthen weak areas and ensure comprehensive understanding.

**Acceptance Criteria:**

**Given** I have courses with videos and notes
**When** the system analyzes my study patterns
**Then** it identifies topics where I have fewer than 1 note per 3 videos
**And** flags these as "under-noted topics" in a Knowledge Gaps panel

**Given** the system detects a video marked as complete
**When** my watch progress for that video is less than 50% of its total duration
**Then** it flags the video as "skipped" in the Knowledge Gaps panel
**And** displays the actual watch percentage alongside the flag

**Given** the Knowledge Gaps panel is displayed
**When** I view the flagged items
**Then** each gap shows the specific videos or sections recommended to revisit
**And** each recommendation includes a direct link to the video
**And** gaps are sorted by severity (least notes per video ratio first)

**Given** I save a new note
**When** the note shares 2 or more tags or key terms with existing notes in other courses
**Then** the system proactively suggests linking the new note to the related existing notes
**And** the suggestion appears as a non-blocking notification with a preview of the related notes

**Given** the system suggests note links
**When** I accept a suggested link
**Then** the notes are linked bidirectionally
**And** the link is immediately visible in both notes' metadata

**Given** the system suggests note links
**When** I dismiss a suggestion
**Then** the suggestion is removed and not re-shown for that specific note pair
**And** future suggestions for other note pairs are unaffected

**Given** the AI provider is unavailable
**When** the system attempts gap analysis
**Then** it falls back to rule-based detection (note count ratios and watch percentage thresholds) without AI enrichment
**And** the fallback activates within 2 seconds

### Story 9.6: AI Note Organization

As a learner,
I want the AI to auto-tag, categorize, and link my notes across courses while showing me related concepts,
So that my notes are well-organized and I can discover connections between different subjects.

**Acceptance Criteria:**

**Given** I have notes across one or more courses
**When** I click "Organize Notes with AI" in the notes management area
**Then** the AI analyzes all my notes and generates proposed tags, categories, and cross-course links

**Given** the AI has generated organization proposals
**When** the results are displayed
**Then** I see a preview panel showing each proposed change (new tags, category assignments, and note links)
**And** each change includes a brief AI rationale
**And** I can accept or reject each individual change before applying

**Given** I am reviewing proposed changes in the preview panel
**When** I click "Apply Selected Changes"
**Then** only the changes I accepted are applied to my notes
**And** rejected changes are discarded
**And** a summary toast confirms the number of changes applied

**Given** I am viewing a note
**When** the note shares 1 or more tags or the AI determines topical overlap (minimum 2 shared key terms) with notes from other courses
**Then** a "Related Concepts" panel is displayed alongside the note
**And** each related note shows its title, source course, and the shared tags or overlapping terms

**Given** the "Related Concepts" panel lists related notes
**When** I click on a related note
**Then** I am navigated to that note's detail view
**And** a back-link to my original note is visible

**Given** the AI provider is unavailable
**When** I attempt to organize notes with AI
**Then** the system displays an "AI unavailable" message with retry option
**And** the "Related Concepts" panel falls back to tag-based matching only (no AI topical overlap)
**And** the fallback activates within 2 seconds

**Given** the AI constructs the note organization request
**When** the API call is made
**Then** only note content, existing tags, and course context are transmitted
**And** no user metadata, file paths, or personally identifiable information is included

### Story 9.7: AI Feature Analytics & Auto-Analysis

As a learner,
I want to see usage statistics for AI features and have new courses automatically analyzed on import,
So that I can track my AI-assisted study habits and benefit from immediate AI insights on new content.

**Acceptance Criteria:**

**Given** I navigate to the AI Analytics section
**When** the dashboard loads
**Then** I see usage statistics for each AI feature (summaries generated, Q&A questions asked, learning paths created, notes organized, gaps detected)
**And** statistics are viewable over daily, weekly, and monthly time periods via a toggle
**And** each metric includes a trend indicator (up, down, or stable compared to the previous period)

**Given** I am viewing AI feature statistics
**When** I switch between daily, weekly, and monthly views
**Then** the statistics update to reflect the selected time period
**And** the transition is smooth with no layout shift

**Given** I import a new course
**When** the import completes successfully
**Then** the system automatically triggers AI analysis on the course content
**And** summary generation and topic tagging begin in the background
**And** a progress indicator shows the auto-analysis status on the course card

**Given** auto-analysis is running on a newly imported course
**When** the analysis completes
**Then** AI-generated topic tags are applied to the course
**And** a preliminary content summary is available on the course detail page
**And** a notification informs me that auto-analysis is complete

**Given** auto-analysis is running
**When** the AI provider fails or becomes unavailable
**Then** the system falls back to non-AI workflows within 2 seconds
**And** the course import is preserved without AI enrichment
**And** a status message indicates auto-analysis could not complete and offers manual retry

**Given** I have the AI consent toggle for auto-analysis disabled
**When** I import a new course
**Then** no automatic AI analysis is triggered
**And** the course imports normally without any data sent to the AI provider

---

## Epic 11: Knowledge Retention, Export & Advanced Features (Post-MVP)

Users can schedule spaced reviews, export learning data in multiple formats, configure per-course reminders, and access advanced review modes — extending the platform for power users and data portability.

### Story 11.1: Spaced Review System

As a learner,
I want to schedule notes for spaced review using a difficulty rating and see a prioritized review queue,
So that I can retain knowledge more effectively by reviewing material at optimal intervals.

**Acceptance Criteria:**

**Given** a learner has completed reviewing a note
**When** they rate the note using the 3-grade system (Hard / Good / Easy)
**Then** the system records the rating and calculates the next review interval based on recall difficulty
**And** Hard shortens the interval, Good maintains a moderate interval, and Easy extends the interval

**Given** a learner has notes scheduled for spaced review
**When** they open the review queue
**Then** notes due for review are displayed sorted by predicted retention percentage, lowest retention first
**And** each note shows the predicted retention percentage, course name, topic, and time until due

**Given** a learner rates a note that was previously reviewed
**When** the new rating is submitted
**Then** the system updates the review interval based on the cumulative review history and latest rating
**And** the review queue re-sorts to reflect the updated retention predictions

**Given** a learner has no notes due for review
**When** they open the review queue
**Then** the system displays an empty state indicating no reviews are currently due
**And** shows the date and time of the next upcoming review

### Story 11.2: Knowledge Retention Dashboard

As a learner,
I want to see my knowledge retention status per topic and be alerted when my engagement is declining,
So that I can identify weak areas and re-engage before knowledge fades.

**Acceptance Criteria:**

**Given** a learner has reviewed notes across multiple topics
**When** they view the knowledge retention dashboard
**Then** each topic displays a retention level of strong, fading, or weak based on review history
**And** each topic shows the time elapsed since the last review

**Given** a topic has not been reviewed within the expected interval
**When** the retention dashboard is rendered
**Then** the topic's retention level degrades from strong to fading to weak as time passes
**And** the visual indicator (color and label) updates to reflect the current retention state

**Given** a learner's study frequency drops below 50% of their 2-week rolling average
**When** the system evaluates engagement metrics
**Then** an engagement decay alert is displayed on the dashboard
**And** the alert identifies frequency decline as the contributing factor

**Given** a learner's session duration declines more than 30% over 4 weeks
**When** the system evaluates engagement metrics
**Then** an engagement decay alert is displayed indicating declining session duration

**Given** a learner's completion velocity is negative for 3 or more consecutive weeks
**When** the system evaluates engagement metrics
**Then** an engagement decay alert is displayed indicating stalled progress
**And** the alert includes a suggestion to revisit incomplete material

**Given** no engagement decay conditions are met
**When** the learner views the dashboard
**Then** no decay alerts are shown and the engagement status displays as healthy

### Story 11.3: Study Session Quality Scoring

As a learner,
I want to receive a quality score after each study session based on my engagement,
So that I can understand how effectively I studied and improve my habits over time.

**Acceptance Criteria:**

**Given** a learner completes a study session
**When** the session ends
**Then** the system calculates a quality score from 0 to 100 based on active time ratio (40% weight), interaction density (30% weight), session length (15% weight), and breaks taken (15% weight)
**And** the score is displayed to the learner with a breakdown of each factor's contribution

**Given** a study session has a high active time ratio and frequent interactions
**When** the score is calculated
**Then** the score reflects strong engagement with values in the upper range
**And** the active time and interaction density factors show high individual scores

**Given** a study session is very short with minimal interaction
**When** the score is calculated
**Then** the score reflects low engagement
**And** the breakdown clearly shows which factors contributed to the low score

**Given** a learner has completed multiple sessions
**When** they view their session history
**Then** each session displays its quality score alongside date, duration, and course name
**And** a trend indicator shows whether session quality is improving, stable, or declining

**Given** a learner is in an active study session
**When** the session is ongoing
**Then** the system tracks active time, interactions, and breaks in real time without displaying the score until the session concludes

### Story 11.4: Data Export

As a learner,
I want to export all my learning data in JSON, CSV, and Markdown formats and export achievements as Open Badges,
So that I own my data, can use it in other tools, and can share verifiable credentials.

**Acceptance Criteria:**

**Given** a learner initiates a full data export in JSON format
**When** the export completes
**Then** the exported JSON file includes all sessions, progress, streaks, notes, and achievements
**And** the file contains a schema version identifier at the root level
**And** the export completes within 30 seconds regardless of data volume

**Given** a learner initiates a full data export in CSV format
**When** the export completes
**Then** separate CSV files are generated for sessions, progress, and streaks
**And** each file includes column headers and all associated records
**And** the export completes within 30 seconds

**Given** a learner initiates a notes export in Markdown format
**When** the export completes
**Then** each note is exported as an individual Markdown file with YAML frontmatter containing title, course, topic, tags, created date, and last reviewed date
**And** the export completes within 30 seconds

**Given** the system logs a learning activity
**When** the activity is recorded
**Then** the log entry follows an Actor plus Verb plus Object structure compatible with xAPI statement format
**And** the actor identifies the learner, the verb describes the action, and the object identifies the learning resource

**Given** a learner has earned achievements
**When** they export achievements as Open Badges
**Then** each achievement is exported as an Open Badges v3.0 compliant JSON file
**And** the badge contains issuer information, criteria, and evidence fields

**Given** a learner has previously exported their data
**When** they re-import the exported JSON data
**Then** the system restores the data with 95% or greater semantic fidelity
**And** any schema version differences are handled through non-destructive automatic migrations

**Given** a learner initiates an export with a large dataset
**When** the export process is running
**Then** a progress indicator shows the current export status
**And** the learner can continue using the application while the export runs in the background

### Story 11.5: Interleaved Review Mode

As a learner,
I want to review notes from multiple courses in a mixed sequence weighted by relevance,
So that I can strengthen cross-topic connections and improve long-term retention through varied practice.

**Acceptance Criteria:**

**Given** a learner activates interleaved review mode
**When** the review session begins
**Then** notes from multiple enrolled courses are surfaced in a mixed sequence
**And** the sequence is weighted by topic similarity and time since last review, prioritizing notes with longer gaps and related topics

**Given** an interleaved review session is in progress
**When** a note is presented to the learner
**Then** the note is displayed in a card-flip style interface with the prompt on the front and the content on the back
**And** the learner can flip the card to reveal the answer

**Given** a learner flips a card during interleaved review
**When** the answer is revealed
**Then** the learner can rate their recall using the same 3-grade system (Hard / Good / Easy) from the spaced review system
**And** the rating updates the note's review interval and retention prediction

**Given** a learner has notes from only one course
**When** they activate interleaved review mode
**Then** the system informs the learner that interleaved review works best with multiple courses
**And** offers to proceed with single-course review or return to the standard review queue

**Given** an interleaved review session is in progress
**When** the learner completes all queued notes or chooses to end the session
**Then** the system displays a session summary showing total notes reviewed, ratings distribution, courses covered, and an estimated retention improvement

### Story 11.6: Per-Course Study Reminders

As a learner,
I want to configure study reminders for each course with specific days and times,
So that I can maintain a consistent study schedule tailored to each course independently of my streak reminders.

**Acceptance Criteria:**

**Given** a learner navigates to a course's settings
**When** they configure a study reminder
**Then** they can select one or more days of the week and a specific time for each selected day
**And** the reminder is saved independently from the global streak reminder

**Given** a learner has configured a per-course study reminder
**When** the scheduled day and time arrives
**Then** a browser notification is delivered identifying the specific course
**And** the notification includes a direct link to resume studying that course

**Given** a learner has both a streak reminder and per-course reminders configured
**When** reminders are scheduled
**Then** each reminder fires independently at its configured time
**And** per-course reminders do not interfere with or suppress the streak reminder

**Given** a learner has not granted browser notification permissions
**When** they attempt to configure a per-course reminder
**Then** the system prompts them to grant notification permissions
**And** explains that notifications are required for reminders to function
**And** the reminder configuration is saved regardless of permission status so it activates once permissions are granted

**Given** a learner wants to modify or remove a per-course reminder
**When** they edit the reminder settings for that course
**Then** they can change the days, times, or disable the reminder entirely
**And** changes take effect immediately for all future scheduled notifications

**Given** a learner has configured reminders for multiple courses
**When** they view their reminder settings overview
**Then** all per-course reminders are listed with their schedules, organized by course
**And** each reminder shows its enabled or disabled status


---

## Epic 19: Platform & Entitlement

Users can create accounts, subscribe to premium features via Stripe, and manage their subscription — enabling the open-core business model while preserving full functionality of the free core.

### Story 19.1: Authentication Setup

As a learner,
I want to create an account with email and password,
So that I can access premium features while keeping my core learning experience fully functional without an account.

**Acceptance Criteria:**

**Given** I am using LevelUp without an account
**When** I use any core feature (import, playback, notes, streaks, analytics)
**Then** all core features work identically to a logged-in user
**And** no login prompt or account requirement blocks any core workflow

**Given** I want to access premium features
**When** I click "Sign Up" or any premium feature's upgrade CTA
**Then** I see a sign-up form with email and password fields
**And** the form includes a "Sign in" link for existing accounts

**Given** I submit a valid email and password
**When** the account is created
**Then** the authentication completes in less than 3 seconds
**And** my auth token is stored locally in IndexedDB
**And** I am redirected back to where I was before sign-up

**Given** I have an existing account
**When** I click "Sign In" and enter my credentials
**Then** I am authenticated and my premium entitlement status is loaded
**And** my existing local learning data is preserved (not overwritten)

**Given** I am logged in
**When** I click "Sign Out" in Settings
**Then** my auth token is removed
**And** I continue using all core features without interruption
**And** premium features revert to showing upgrade CTAs

**Given** I attempt to sign up with an already-registered email
**When** I submit the form
**Then** I see a clear error message suggesting I sign in instead
**And** no duplicate account is created

### Story 19.2: Stripe Subscription Integration

As a learner,
I want to subscribe to the premium tier via a secure checkout flow,
So that I can unlock AI-powered features and advanced learning tools.

**Acceptance Criteria:**

**Given** I am authenticated and on the free tier
**When** I click "Upgrade to Premium" in Settings or from any upgrade CTA
**Then** I am redirected to a Stripe Checkout hosted payment page
**And** no credit card data is entered on or transmitted through LevelUp

**Given** I complete payment on Stripe Checkout
**When** Stripe redirects me back to LevelUp
**Then** my subscription status is updated to "Premium"
**And** I see a confirmation message with my plan details
**And** all premium features become immediately available

**Given** Stripe Checkout redirects me back
**When** the subscription webhook has not yet been processed
**Then** the system polls for entitlement status for up to 10 seconds
**And** shows a "Activating your subscription..." loading state
**And** premium access activates as soon as the webhook completes

**Given** I cancel the Stripe Checkout flow
**When** I return to LevelUp without completing payment
**Then** my account remains on the free tier
**And** no charge is applied
**And** I see a message that the upgrade was not completed

**Given** the Stripe webhook fires for a new subscription
**When** the serverless function receives the event
**Then** the entitlement record is updated with subscription status, plan ID, and expiry date
**And** the entitlement is cached locally with a 7-day TTL for offline access

### Story 19.3: Entitlement System & Offline Caching

As a learner,
I want my premium status to be validated and cached locally,
So that premium features work even when I'm offline or have intermittent connectivity.

**Acceptance Criteria:**

**Given** I have an active premium subscription
**When** the app launches and I am online
**Then** the system validates my entitlement against the server
**And** caches the result in IndexedDB with a 7-day expiry timestamp

**Given** I have a cached entitlement that is less than 7 days old
**When** the app launches and I am offline
**Then** the cached entitlement is honored
**And** all premium features are available

**Given** my cached entitlement is older than 7 days
**When** the app launches and I am offline
**Then** premium features are temporarily disabled
**And** a message explains that premium features require a periodic online check
**And** all core features remain fully functional

**Given** my cached entitlement has expired
**When** I come back online
**Then** the system automatically re-validates my entitlement
**And** premium features are restored if the subscription is still active
**And** no manual action is required

**Given** my subscription has been cancelled or expired
**When** the system validates my entitlement
**Then** premium features are disabled
**And** all my data (including data created with premium features) remains accessible and exportable
**And** I see a clear message about my subscription status with an option to resubscribe

**Given** the `isPremium()` guard function is called
**When** I am not entitled to premium features
**Then** the premium component is not rendered
**And** an upgrade CTA is shown in its place
**And** no error or broken UI state occurs

### Story 19.4: Subscription Management

As a learner,
I want to view my subscription status and manage billing through Stripe,
So that I can update my payment method, cancel, or resubscribe without leaving the app.

**Acceptance Criteria:**

**Given** I am authenticated and have an active subscription
**When** I navigate to Settings > Subscription
**Then** I see my current plan name, billing period, next billing date, and subscription status
**And** I see buttons for "Manage Billing" and "Cancel Subscription"

**Given** I click "Manage Billing"
**When** the Stripe Customer Portal opens
**Then** I can update my payment method, view invoices, and download receipts
**And** I am redirected back to LevelUp after making changes

**Given** I click "Cancel Subscription"
**When** a confirmation dialog appears
**Then** the dialog explains what I'll lose (premium features) and what I keep (all data, core features)
**And** cancellation is processed through Stripe Customer Portal
**And** premium access continues until the end of the current billing period

**Given** I am on the free tier
**When** I navigate to Settings > Subscription
**Then** I see a "Free" plan indicator
**And** an "Upgrade to Premium" button with a feature comparison summary

**Given** I previously cancelled and want to resubscribe
**When** I click "Upgrade to Premium"
**Then** I am directed to Stripe Checkout to create a new subscription
**And** the flow is identical to a first-time subscription

### Story 19.5: Premium Feature Gating & Upgrade CTAs

As a learner on the free tier,
I want to see what premium features offer before upgrading,
So that I can make an informed decision about subscribing based on real feature previews.

**Acceptance Criteria:**

**Given** I am on the free tier
**When** I navigate to a page containing premium features (AI summaries, Q&A, spaced review)
**Then** the premium feature area shows an "Upgrade to Premium" CTA
**And** the CTA includes a brief description or preview of what the feature does
**And** the rest of the page functions normally with all core features visible

**Given** I click an upgrade CTA from any premium feature location
**When** I am authenticated
**Then** I am taken directly to the Stripe Checkout flow
**And** after completing, I return to the exact feature I was trying to access

**Given** I click an upgrade CTA from any premium feature location
**When** I am not authenticated
**Then** I am shown the sign-up/sign-in flow first
**And** after authentication, I continue to the Stripe Checkout flow

**Given** I am on the free tier and AI features are premium
**When** I view the video player
**Then** the "Generate Summary" button is replaced by an upgrade CTA
**And** the AI Q&A panel shows a locked state with feature preview

**Given** I am on the free tier
**When** I view the dashboard or navigation
**Then** premium features are visually indicated (e.g., subtle lock icon or "Premium" badge)
**And** clicking them shows the upgrade CTA — not an error or blank page

**Given** premium features are gated
**When** the app loads
**Then** premium components are not lazy-loaded or bundled for free-tier users
**And** the app bundle size is not increased by unused premium code

### Story 19.6: Premium Code Boundary & Build Separation

As a developer,
I want premium code to live in an isolated directory with a separate build configuration,
So that the open-source AGPL distribution never includes proprietary premium code.

**Acceptance Criteria:**

**Given** the project has a `src/premium/` directory
**When** the open-source build is produced
**Then** no files from `src/premium/` are included in the output bundle
**And** the build completes successfully without premium dependencies

**Given** the premium build is produced
**When** the `src/premium/index.ts` entrypoint is included
**Then** premium components are lazy-loaded via dynamic imports
**And** they only load when `isPremium()` returns true

**Given** a file in `src/premium/`
**When** it is inspected
**Then** it contains a proprietary license header (not AGPL)
**And** it does not import from or depend on other premium files in a circular manner

**Given** a core component needs to reference a premium feature
**When** it checks for premium availability
**Then** it uses the `isPremium()` guard from the entitlement system
**And** it does not import premium modules directly — only through lazy loading

**Given** the CI pipeline runs
**When** the core-only build is tested
**Then** all tests pass without `src/premium/` present
**And** no import errors or missing module warnings occur

---

# Quiz & Assessment System


# Quiz & Assessment System - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the **Quiz & Assessment System**, decomposing the requirements from the PRD, UX Design Specification, and Architecture requirements into implementable stories following the LevelUp story development workflow.

This is a brownfield integration extending the existing LevelUp learning platform with comprehensive formative assessment capabilities.

## Requirements Inventory

### Functional Requirements

**Quiz Taking & Navigation (FR1-FR8)**

- FR1: Learners can start a quiz from a course lesson
- FR2: Learners can navigate between questions in any order during quiz
- FR3: Learners can mark questions for review before submitting
- FR4: Learners can pause a quiz and resume later without losing progress
- FR5: Learners can submit completed quiz for scoring
- FR6: Learners can retake any quiz unlimited times with no cooldown period
- FR7: Learners can review all questions and answers after quiz completion
- FR8: Learners can exit quiz without submitting (progress auto-saved)

**Question Management & Presentation (FR9-FR15)**

- FR9: System can present Multiple Choice questions with 2-6 answer options
- FR10: System can present True/False questions
- FR11: System can present Multiple Select questions (select all that apply)
- FR12: System can present Fill-in-Blank questions with text input
- FR13: System can randomize question order for each quiz attempt
- FR14: System can display question progress indicator (e.g., "Question 5 of 12")
- FR15: System can display question text with rich formatting (code blocks, lists, emphasis)

**Scoring & Feedback (FR16-FR23)**

- FR16: System can calculate partial credit for each question (0-100% granular scoring)
- FR17: System can calculate total quiz score as percentage of possible points
- FR18: System can provide immediate explanatory feedback per question upon answer selection
- FR19: System can display correct answer explanation for incorrect responses
- FR20: System can provide performance summary after quiz completion
- FR21: System can highlight learner's strongest topic areas in performance summary
- FR22: System can identify growth opportunity topics in performance summary
- FR23: System can display encouraging, non-judgmental messaging regardless of score

**Timer & Pacing (FR24-FR30)**

- FR24: System can display countdown timer during quiz
- FR25: Learners can configure timer duration before starting quiz
- FR26: Learners can enable timer accommodations (150-200% time extensions)
- FR27: System can provide timer warnings at configurable thresholds (default: 75%, 90%)
- FR28: System can announce timer warnings for screen reader users
- FR29: Learners can disable timer for untimed practice mode
- FR30: System can track time-to-completion for each quiz attempt

**Performance Analytics & Tracking (FR31-FR40)**

- FR31: System can store score history for all quiz attempts
- FR32: System can calculate score improvement between first and most recent attempt
- FR33: System can display improvement trajectory graph (score vs. attempt number)
- FR34: System can calculate normalized gain using Hake's formula
- FR35: System can track quiz completion rate (completed / started)
- FR36: System can track average retake frequency per quiz
- FR37: System can display time-on-task metrics per quiz attempt
- FR38: System can identify learning trajectory patterns (exponential, linear, logarithmic)
- FR39: System can calculate item difficulty (P-values) for each question
- FR40: System can calculate discrimination indices (point-biserial correlation) for questions

**Accessibility & Accommodations (FR41-FR48)**

- FR41: Learners can navigate entire quiz interface using keyboard only (Tab, Enter, Space, Arrow keys)
- FR42: System can announce dynamic content updates via ARIA live regions for screen readers
- FR43: Learners can configure accessibility settings before quiz starts
- FR44: System can provide focus indicators with 4.5:1 contrast ratio on all interactive elements
- FR45: System can maintain semantic HTML structure for assistive technology compatibility
- FR46: System can support screen readers (NVDA, JAWS, VoiceOver)
- FR47: Learners can export quiz results for external review
- FR48: System can ensure 4.5:1 minimum contrast ratio for text, 3:1 for UI components

**Data Persistence & Recovery (FR49-FR54)**

- FR49: System can auto-save quiz progress to localStorage every answer selection
- FR50: System can recover incomplete quiz from localStorage after browser crash
- FR51: System can store quiz history in IndexedDB for analytics queries
- FR52: System can persist quiz state across browser sessions
- FR53: System can handle localStorage quota exceeded errors gracefully
- FR54: System can prevent data loss during quiz submission

**Platform Integration (FR55-FR61)**

- FR55: System can trigger study streak update upon quiz completion
- FR56: System can display quiz performance data in Overview progress dashboard
- FR57: System can surface quiz analytics in Reports section
- FR58: Courses page can display quiz availability badges per lesson
- FR59: Settings page can provide quiz preference configuration (timer defaults, accessibility options)
- FR60: System can integrate quiz completion events with existing progress tracking
- FR61: System can associate quizzes with specific course lessons in navigation

### NonFunctional Requirements

**NFR1: Accessibility Compliance**
- WCAG 2.1 AA+ compliance required for all quiz components
- Keyboard navigation (Tab, Enter, Space, Arrow keys) for all functionality
- ARIA live regions for dynamic content updates (timer, score, feedback)
- Screen reader support for NVDA, JAWS, VoiceOver
- 4.5:1 minimum contrast ratio for text, 3:1 for UI components
- Timer accommodations (150-200% time extensions)
- ≥44px touch targets on mobile
- Support for `prefers-reduced-motion`

**NFR2: Performance Requirements**
- Quiz loading ≤500ms (from localStorage retrieval to initial render)
- Score calculation ≤50ms per question (real-time feedback requirement)
- Real-time feedback display with no perceived lag
- Debounced auto-save to prevent excessive writes
- Optimized rendering with React memoization where appropriate

**NFR3: Privacy & Data Locality**
- All data stored locally (localStorage + IndexedDB)
- No backend server or API calls
- No user accounts or authentication
- No data transmission to external services
- Browser-only storage architecture

**NFR4: Psychometric Validity**
- Fisher-Yates shuffle for unbiased question/answer randomization
- Item difficulty tracking (P-values: proportion correct)
- Discrimination indices (point-biserial correlation)
- Unbiased randomization (every permutation equally likely)
- Foundation for future IRT calibration (PCM/GPCM models)

**NFR5: Scoring Accuracy**
- Partial credit scoring (0-100% granular per question)
- Immediate score calculation (no async delays)
- Support for Partial Credit Model (PCM) for multiple-select questions
- Foundation for Generalized Partial Credit Model (GPCM)
- Future compatibility with IRT-based scoring

**NFR6: Timer Accuracy**
- Prevent JavaScript setInterval drift using Date.now() pattern
- Handle background tab throttling via Page Visibility API
- Recalculate timer on tab focus to correct for throttling
- Accurate countdown even during browser sleep/wake
- Timer state recovery after browser crash

**NFR7: Data Integrity**
- Zero data loss guarantee for quiz attempts
- Schema-versioned Dexie migrations (v2 → v3+)
- Auto-save every answer selection (debounced)
- Optimistic update pattern with rollback on failure
- Robust crash recovery from localStorage

**NFR8: Brownfield Integration**
- Seamless integration with existing LevelUp architecture
- Follow Zustand patterns (individual selectors, never destructure)
- Follow Dexie patterns (optimistic updates, schema migrations)
- Use existing shadcn/ui components and design tokens
- Extend existing component library (#FAF5EE background, blue-600 primary, rounded-[24px] cards)

**NFR9: Responsive Design**
- Mobile (375px), Tablet (768px), Desktop (1440px) support
- ≥44px touch targets on mobile and tablet
- Sidebar behavior: persistent on desktop, collapsible Sheet on tablet/mobile
- Mobile-first Tailwind utilities
- Single-column layout on mobile, multi-column where appropriate on desktop

### Additional Requirements

**From Architecture - Technical Implementation:**

**Data Model Requirements:**
- TypeScript interfaces with Zod validation for runtime safety
- Quiz, Question, QuizAttempt, Answer, QuizProgress types
- Polymorphic question type support (multiple-choice, true-false, multiple-select, fill-in-blank)
- Support for future question types (extensible design)
- IMS QTI compatibility for potential future import/export

**Dexie Schema v3 Migration:**
- Add `quizzes` table with indexes: id (primary), lessonId, title, createdAt
- Add `quizAttempts` table with indexes: id (primary), quizId, completedAt, passed
- Add `quizProgress` table with quizId as primary key (single active quiz state)
- No backfill needed (new feature, no existing data)
- On-demand analytics computation (no pre-computed cache table)

**Zustand Store Requirements:**
- New `useQuizStore` in `src/stores/useQuizStore.ts`
- Follow individual selector pattern (never destructure full store)
- Optimistic update pattern (Zustand first → Dexie persist → rollback on failure)
- Dual-layer persistence: localStorage for current quiz state, IndexedDB for history
- Cross-store communication via `getState()` for platform integration
- Zustand persist middleware for auto-debounced localStorage writes

**Component Architecture:**
- Route-level pages: `/courses/:courseId/lessons/:lessonId/quiz` and `/quiz/results`
- QuizContainer page component orchestrating quiz lifecycle
- Polymorphic QuestionDisplay component with type-specific renderers
- Controlled component pattern for all form inputs
- Feature-specific components in `src/app/components/quiz/`
- Extend existing shadcn/ui components (Button, Card, Progress, etc.)

**Algorithm Requirements:**
- Fisher-Yates shuffle implementation in `src/lib/shuffle.ts` (O(n) time, immutable)
- Partial Credit Model (PCM) scoring in `src/lib/scoring.ts`
- All-or-nothing scoring for single-answer questions
- Date.now() accuracy pattern in `src/hooks/useQuizTimer.ts`
- Analytics service in `src/lib/analytics.ts` (P-values, discrimination indices, normalized gain)

**Testing Requirements:**
- Unit tests for services (shuffle, scoring, analytics) co-located with source files
- Store tests in `src/stores/__tests__/useQuizStore.test.ts`
- E2E tests in `tests/e2e/` (one spec per story, Chromium local + full matrix in CI)
- Test factories in `tests/support/factories/` (makeQuiz, makeQuestion, makeAttempt)
- Playwright + axe-core integration for automated accessibility testing

**File Structure:**
```
src/
├── app/
│   ├── pages/
│   │   ├── Quiz.tsx                    # Main quiz container page
│   │   └── QuizResults.tsx             # Results/review page
│   └── components/
│       └── quiz/
│           ├── QuizHeader.tsx          # Title, timer, progress
│           ├── QuizNavigation.tsx      # Question pagination
│           ├── QuestionDisplay.tsx     # Polymorphic renderer
│           ├── questions/
│           │   ├── MultipleChoiceQuestion.tsx
│           │   ├── TrueFalseQuestion.tsx
│           │   ├── MultipleSelectQuestion.tsx
│           │   └── FillInBlankQuestion.tsx
│           ├── AnswerFeedback.tsx      # Immediate feedback
│           ├── QuizActions.tsx         # Submit/next/prev buttons
│           ├── ScoreSummary.tsx        # Score display
│           ├── PerformanceInsights.tsx # Strengths/growth areas
│           ├── ImprovementChart.tsx    # Score trajectory viz
│           └── QuizReview.tsx          # Review all Q&A pairs
├── stores/
│   └── useQuizStore.ts                 # Quiz state management
├── types/
│   └── quiz.ts                         # Quiz TypeScript types + Zod schemas
├── lib/
│   ├── shuffle.ts                      # Fisher-Yates algorithm
│   ├── scoring.ts                      # Partial credit calculation
│   └── analytics.ts                    # Analytics computations
└── hooks/
    └── useQuizTimer.ts                 # Timer with Date.now() accuracy
```

**From UX Design - Design System:**

**Component Styling:**
- Extend existing shadcn/ui + Tailwind v4 foundation
- Use established design tokens: #FAF5EE background, blue-600 primary, rounded-[24px] cards
- Warm color palette, system font stack
- 8px base spacing grid (multiples of 0.5rem)
- CSS custom properties in `src/styles/theme.css`

**Interaction Patterns:**
- Resume-where-left-off pattern (quiz state persists across sessions)
- Progressive disclosure (show quiz interface, hide other UI during quiz)
- Immediate feedback on answer selection
- Encouraging, non-judgmental tone in all UI copy (FR23)
- Clean session closure with performance summary

**Animation Philosophy:**
- Micro-interactions: 150-200ms ease-out (button hover, toggle)
- State transitions: 200-350ms ease-in-out (question navigation, feedback appear)
- No celebration animations for quiz (maintain focus)
- Respect `prefers-reduced-motion: reduce` (0ms all animations)
- Smooth progress bar updates

**Accessibility Patterns (WCAG 2.1 AA+):**
- Semantic HTML structure (fieldset/legend for radio groups)
- ARIA live regions (`aria-live="polite"` for timer, `"assertive"` for critical warnings)
- Keyboard navigation: Tab, Enter, Space, Arrow keys
- Focus indicators with 4.5:1 contrast ratio
- Screen reader announcements for dynamic content
- Timer warnings at 75%, 90% announced to screen readers
- Error identification with `aria-invalid` and text (not color alone)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 12 | Start quiz from lesson |
| FR2 | Epic 13 | Navigate between questions |
| FR3 | Epic 13 | Mark questions for review |
| FR4 | Epic 13 | Pause and resume quiz |
| FR5 | Epic 12 | Submit quiz for scoring |
| FR6 | Epic 13 | Unlimited retakes |
| FR7 | Epic 13 | Review Q&A after completion |
| FR8 | Epic 13 | Exit without submitting (auto-save) |
| FR9 | Epic 12 | Multiple Choice questions |
| FR10 | Epic 14 | True/False questions |
| FR11 | Epic 14 | Multiple Select questions |
| FR12 | Epic 14 | Fill-in-Blank questions |
| FR13 | Epic 13 | Randomize question order |
| FR14 | Epic 12 | Question progress indicator |
| FR15 | Epic 14 | Rich text formatting |
| FR16 | Epic 12 | Partial credit calculation |
| FR17 | Epic 12 | Total score percentage |
| FR18 | Epic 15 | Immediate explanatory feedback |
| FR19 | Epic 15 | Correct answer explanation |
| FR20 | Epic 15 | Performance summary |
| FR21 | Epic 15 | Highlight strongest topics |
| FR22 | Epic 15 | Identify growth opportunities |
| FR23 | Epic 15 | Encouraging messaging |
| FR24 | Epic 15 | Countdown timer display |
| FR25 | Epic 15 | Configure timer duration |
| FR26 | Epic 15 | Timer accommodations |
| FR27 | Epic 15 | Timer warnings |
| FR28 | Epic 15 | Timer announcements (screen reader) |
| FR29 | Epic 15 | Disable timer (untimed mode) |
| FR30 | Epic 15 | Time-to-completion tracking |
| FR31 | Epic 16 | Store score history |
| FR32 | Epic 16 | Calculate score improvement |
| FR33 | Epic 16 | Improvement trajectory graph |
| FR34 | Epic 16 | Normalized gain (Hake's formula) |
| FR35 | Epic 17 | Quiz completion rate |
| FR36 | Epic 17 | Average retake frequency |
| FR37 | Epic 17 | Time-on-task metrics |
| FR38 | Epic 17 | Learning trajectory patterns |
| FR39 | Epic 17 | Item difficulty (P-values) |
| FR40 | Epic 17 | Discrimination indices |
| FR41 | Epic 18 | Keyboard-only navigation |
| FR42 | Epic 18 | ARIA live regions |
| FR43 | Epic 18 | Accessibility settings |
| FR44 | Epic 18 | Focus indicators (4.5:1 contrast) |
| FR45 | Epic 18 | Semantic HTML |
| FR46 | Epic 18 | Screen reader support |
| FR47 | Epic 18 | Export quiz results |
| FR48 | Epic 18 | Contrast ratios (4.5:1 text, 3:1 UI) |
| FR49 | Epic 12 | Auto-save to localStorage |
| FR50 | Epic 12 | Crash recovery |
| FR51 | Epic 12 | Store history in IndexedDB |
| FR52 | Epic 12 | Persist across sessions |
| FR53 | Epic 13 | Handle quota exceeded |
| FR54 | Epic 12 | Prevent data loss on submit |
| FR55 | Epic 18 | Study streak update |
| FR56 | Epic 18 | Dashboard integration |
| FR57 | Epic 18 | Reports section integration |
| FR58 | Epic 18 | Courses page badges |
| FR59 | Epic 18 | Settings preferences |
| FR60 | Epic 18 | Progress tracking integration |
| FR61 | Epic 18 | Lesson navigation links |

## Epic List

### Epic 12: Take Basic Quizzes
Learners can start a quiz from a lesson, answer multiple-choice questions, submit for scoring, and see their results.
**FRs covered:** FR1, FR5, FR9, FR14, FR16, FR17, FR49, FR50, FR51, FR52, FR54

### Epic 13: Navigate and Control Quiz Flow
Learners can navigate between questions in any order, pause and resume quizzes, mark questions for review, and safely exit without losing progress.
**FRs covered:** FR2, FR3, FR4, FR6, FR7, FR8, FR13, FR53

### Epic 14: Practice with Diverse Question Types
Learners can practice with True/False, Multiple Select, and Fill-in-Blank questions in addition to Multiple Choice.
**FRs covered:** FR10, FR11, FR12, FR15

### Epic 15: Timed Quizzes with Enhanced Feedback
Learners can take timed quizzes with countdown timers, configurable accommodations, warnings, and receive immediate explanatory feedback.
**FRs covered:** FR18, FR19, FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR28, FR29, FR30

### Epic 16: Review Performance and Track Improvement
Learners can review quiz results, see detailed performance summaries, track score improvement across attempts, and visualize learning trajectories.
**FRs covered:** FR31, FR32, FR33, FR34

### Epic 17: Analyze Quiz Data and Patterns
Learners can see detailed analytics including completion rates, retake frequency, time metrics, learning patterns, item difficulty, and discrimination indices.
**FRs covered:** FR35, FR36, FR37, FR38, FR39, FR40

### Epic 18: Accessible and Integrated Quiz Experience
All learners can access quiz features via keyboard and screen readers (WCAG 2.1 AA+). Quiz data integrates across the LevelUp platform.
**FRs covered:** FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR55, FR56, FR57, FR58, FR59, FR60, FR61

---

## Epic 12: Take Basic Quizzes

**Goal:** Learners can start a quiz from a lesson, answer multiple-choice questions, submit for scoring, and see their results.

**Technical Foundation:** This epic establishes the complete quiz infrastructure needed for all future epics - type definitions, Dexie schema, Zustand store, routing, and a minimal working quiz experience.

### Story 12.1: Create Quiz Type Definitions

As a developer,
I want Quiz, Question, and QuizAttempt TypeScript interfaces with Zod validation,
So that I have type safety and runtime validation for quiz data throughout the application.

**Acceptance Criteria:**

**Given** quiz data requirements from PRD and Architecture
**When** I create `src/types/quiz.ts`
**Then** it exports all required TypeScript interfaces (Quiz, Question, QuizAttempt, Answer, QuizProgress)
**And** all properties match the architecture specification exactly
**And** Zod schemas are defined for runtime validation
**And** QuestionType enum includes all 4 types (multiple-choice, true-false, multiple-select, fill-in-blank)
**And** JSDoc comments document each interface and property
**And** types are importable from other modules using `@/types/quiz`

**Given** the Question interface
**When** defining the `correctAnswer` property
**Then** it supports both `string` and `string[]` types for polymorphic question handling
**And** the `options` property is optional (not needed for fill-in-blank)
**And** the `media` property supports image, video, and audio types

**Technical Details:**

Files to create:
- `src/types/quiz.ts`

Type interfaces to define:
- `QuestionType` enum: 'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-in-blank'
- `Question` interface: id, order, type, text, options, correctAnswer, explanation, points, media
- `Quiz` interface: id, lessonId, title, description, questions, timeLimit, passingScore, allowRetakes, shuffleQuestions, shuffleAnswers, createdAt, updatedAt
- `Answer` interface: questionId, userAnswer, isCorrect, pointsEarned, pointsPossible
- `QuizAttempt` interface: id, quizId, answers, score, percentage, passed, timeSpent, completedAt, startedAt
- `QuizProgress` interface: quizId, currentQuestionIndex, answers, startTime, timeRemaining, isPaused

Zod schemas to create:
- `QuestionSchema` with type-specific validation (MC/MS require options array)
- `QuizSchema` with nested QuestionSchema validation
- Type inference: `export type Quiz = z.infer<typeof QuizSchema>`

**Testing Requirements:**

Unit tests:
- TypeScript compilation verification
- Zod schema validation for valid quiz data
- Zod schema rejection for invalid data (missing required fields, wrong types)
- Type inference correctness

**Dependencies:** None (foundation story)

**Complexity:** Small (1-2 hours)

**Design Review Focus:** N/A (types only, no UI)

---

### Story 12.2: Set Up Dexie Schema v3 Migration

As a developer,
I want to migrate Dexie schema from v2 to v3 with quiz tables,
So that quiz data persists reliably in IndexedDB with proper indexes for efficient queries.

**Acceptance Criteria:**

**Given** the existing Dexie schema at v2
**When** I run the schema migration
**Then** version 3 is created with three new tables: `quizzes`, `quizAttempts`, `quizProgress`
**And** the `quizzes` table has indexes on: id (primary), lessonId, title, createdAt
**And** the `quizAttempts` table has indexes on: id (primary), quizId, completedAt, passed
**And** the `quizProgress` table has quizId as primary key (only one active quiz at a time)
**And** no data migration/backfill is needed (new feature, no existing data)
**And** existing v2 tables remain unchanged

**Given** a quiz being stored
**When** querying quizzes by lessonId
**Then** the query uses the lessonId index for efficient retrieval
**And** compound queries (e.g., "all passed attempts for quiz X") use the appropriate indexes

**Technical Details:**

Files to modify:
- `src/db/schema.ts`

Migration code:
```typescript
db.version(3)
  .stores({
    // Existing v2 tables (unchanged)
    courses: 'id, name, category',
    progress: 'id, courseId, lessonId, completedAt',
    bookmarks: 'id, lessonId, timestamp',
    notes: 'id, lessonId, createdAt',
    sessions: 'id, startTime, endTime',
    
    // NEW: Quiz tables
    quizzes: 'id, lessonId, title, createdAt',
    quizAttempts: 'id, quizId, completedAt, passed',
    quizProgress: 'quizId'
  })
  .upgrade(tx => {
    // No backfill needed - new feature
    return Promise.resolve()
  })
```

**Testing Requirements:**

Unit tests:
- Schema migration runs successfully
- Tables created with correct indexes
- Existing v2 data remains intact
- Can write and read quiz data from new tables

Integration tests:
- Query performance using indexes (measure with large dataset)
- Dexie upgrade callback executes without errors

**Dependencies:** Story 12.1 (needs Quiz types for TypeScript)

**Complexity:** Small (1-2 hours)

**Design Review Focus:** N/A (database only)

---

### Story 12.3: Create useQuizStore with Zustand

As a developer,
I want a Zustand store for quiz state management following LevelUp patterns,
So that quiz state is managed consistently with individual selectors and optimistic updates.

**Acceptance Criteria:**

**Given** the LevelUp Zustand patterns (individual selectors, optimistic updates)
**When** I create `src/stores/useQuizStore.ts`
**Then** it follows the `create<State>()(persist(...))` TypeScript pattern
**And** it exports individual selectors (never destructure full store)
**And** it implements optimistic update pattern (Zustand → Dexie → rollback on failure)
**And** persist middleware auto-saves `currentProgress` to localStorage with key `levelup-quiz-store`
**And** it includes actions: startQuiz, submitAnswer, submitQuiz, retakeQuiz, loadAttempts, resumeQuiz, clearQuiz

**Given** the startQuiz action
**When** a learner starts a quiz
**Then** it loads the quiz from Dexie by quizId
**And** applies Fisher-Yates shuffle if quiz.shuffleQuestions is true
**And** initializes QuizProgress state (currentQuestionIndex=0, empty answers, start time)
**And** sets timeRemaining if quiz has a timeLimit

**Given** the submitAnswer action
**When** a learner selects an answer
**Then** it calculates partial credit immediately (≤50ms)
**And** updates Zustand state optimistically (instant UI feedback)
**And** localStorage auto-saves via persist middleware (debounced)
**And** does NOT write to Dexie (wait until quiz submission to avoid write amplification)

**Given** the submitQuiz action
**When** a learner submits the completed quiz
**Then** it calculates total score and percentage
**And** creates QuizAttempt record with all answers and metrics
**And** writes attempt to Dexie `quizAttempts` table
**And** clears `currentProgress` from localStorage
**And** triggers cross-store updates (useProgressStore.markLessonComplete, useSessionStore.recordStudyActivity)
**And** rolls back on Dexie write failure

**Technical Details:**

Files to create:
- `src/stores/useQuizStore.ts`

Store structure:
```typescript
interface QuizState {
  currentQuiz: Quiz | null
  currentProgress: QuizProgress | null
  attempts: QuizAttempt[]
  isLoading: boolean
  error: string | null
  startQuiz: (quizId: string) => Promise<void>
  submitAnswer: (questionId: string, answer: string | string[]) => void
  submitQuiz: () => Promise<void>
  retakeQuiz: (quizId: string) => void
  loadAttempts: (quizId: string) => Promise<void>
  resumeQuiz: (quizId: string) => void
  clearQuiz: () => void
}
```

Zustand persist configuration:
- name: 'levelup-quiz-store'
- partialize: only persist `currentProgress` (not full quiz or attempts)

Cross-store communication:
- useProgressStore.getState().markLessonComplete(lessonId)
- useSessionStore.getState().recordStudyActivity('quiz', timeSpent)

**Testing Requirements:**

Unit tests:
- startQuiz loads quiz and initializes state
- submitAnswer updates state optimistically
- submitQuiz creates attempt and persists to Dexie
- Fisher-Yates shuffle applied when enabled
- persist middleware saves only currentProgress
- Rollback on Dexie failure

Integration tests:
- localStorage persistence across page reloads
- Cross-store communication triggers correctly
- Error handling for missing quiz

**Dependencies:** 
- Story 12.1 (needs Quiz types)
- Story 12.2 (needs Dexie schema)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:** N/A (store only, no UI)

---

### Story 12.4: Create Quiz Route and Basic QuizPlayer Component

As a learner,
I want to navigate to a quiz from a lesson and see the quiz start screen,
So that I can begin taking a quiz when I'm ready.

**Acceptance Criteria:**

**Given** a course lesson with an associated quiz
**When** I click "Take Quiz" from the lesson page
**Then** I navigate to `/courses/:courseId/lessons/:lessonId/quiz`
**And** I see the quiz title and description
**And** I see the number of questions (e.g., "12 questions")
**And** I see the time limit if configured (e.g., "15 minutes") or "Untimed" if no limit
**And** I see a "Start Quiz" button prominently displayed
**And** I do NOT see any questions yet (start screen only)

**Given** the quiz start screen
**When** I click "Start Quiz"
**Then** useQuizStore.startQuiz() is called
**And** the first question loads and displays
**And** the quiz header shows progress (e.g., "Question 1 of 12")
**And** the timer starts counting down if quiz is timed

**Given** I am on a different page
**When** I navigate directly to a quiz URL
**Then** the quiz loads from the quizId route parameter
**And** if I have an incomplete quiz in progress, I see a "Resume Quiz" option
**And** if no progress exists, I see the normal start screen

**Technical Details:**

Files to create:
- `src/app/pages/Quiz.tsx` (route-level page component)
- `src/app/components/quiz/QuizHeader.tsx` (title, progress indicator)
- `src/app/components/quiz/QuizStartScreen.tsx` (pre-quiz info and start button)

Files to modify:
- `src/app/routes.tsx` (add quiz route)

Route configuration:
```typescript
{
  path: '/courses/:courseId/lessons/:lessonId/quiz',
  element: <Quiz />
}
```

QuizPlayer component structure:
```tsx
<QuizContainer>
  <QuizHeader quiz={currentQuiz} currentIndex={0} />
  {!quizStarted && <QuizStartScreen quiz={currentQuiz} onStart={handleStart} />}
  {quizStarted && <QuestionDisplay ... />}
</QuizContainer>
```

Components:
- QuizHeader: displays title, question progress (1 of 12), timer (if applicable)
- QuizStartScreen: quiz metadata, start button, resume button if progress exists

**Testing Requirements:**

Unit tests:
- QuizPlayer renders start screen correctly
- Start button triggers useQuizStore.startQuiz()
- Resume button appears when currentProgress exists

E2E tests:
- Navigate to quiz URL → see start screen
- Click "Start Quiz" → first question displays
- Refresh page mid-quiz → can resume
- Browser back button returns to lesson (quiz state preserved)

Accessibility tests:
- Keyboard navigation (Tab to Start button, Enter to activate)
- Screen reader announces quiz title, question count, time limit
- Focus moves to first question after starting

**Dependencies:**
- Story 12.1 (needs Quiz types)
- Story 12.2 (needs Dexie for quiz loading)
- Story 12.3 (needs useQuizStore)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Quiz start screen layout at 375px, 768px, 1440px
- "Start Quiz" button prominence and touch target size (≥44px)
- Warm color scheme (#FAF5EE background, blue-600 CTA)
- Typography hierarchy (quiz title, metadata, button text)

---

### Story 12.5: Display Multiple Choice Questions

As a learner,
I want to see multiple choice questions with selectable answer options,
So that I can answer quiz questions by selecting the correct option.

**Acceptance Criteria:**

**Given** a quiz with multiple choice questions
**When** I start the quiz
**Then** I see the question text displayed clearly with proper typography
**And** I see 2-6 answer options as radio buttons below the question
**And** each option has a visible label with the answer text
**And** all options are unselected initially (no default selection)
**And** I can select exactly one option at a time (radio group behavior)

**Given** a question with rich formatting
**When** the question text contains code blocks, lists, or emphasis
**Then** the formatting renders correctly using Markdown
**And** code blocks have syntax highlighting (if applicable)
**And** lists display with proper indentation

**Given** I select an answer option
**When** I click or tap on a radio button or its label
**Then** the option becomes visually selected (filled radio button)
**And** any previously selected option becomes unselected
**And** the selection state persists if I navigate away and return to this question

**Given** the question display component
**When** rendering on mobile (375px)
**Then** answer options stack vertically with full-width labels
**And** touch targets are ≥44px tall for easy selection
**When** rendering on desktop (1440px)
**Then** answer options may display in a single column or two columns based on content length

**Technical Details:**

Files to create:
- `src/app/components/quiz/QuestionDisplay.tsx` (polymorphic renderer)
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`

MultipleChoiceQuestion component:
```tsx
<fieldset className="space-y-3">
  <legend className="text-lg font-semibold mb-4">
    <ReactMarkdown>{question.text}</ReactMarkdown>
  </legend>
  <RadioGroup value={selectedAnswer} onValueChange={handleAnswerChange}>
    {question.options.map((option, index) => (
      <RadioGroupItem key={index} value={option} label={option} />
    ))}
  </RadioGroup>
</fieldset>
```

QuestionDisplay polymorphic rendering:
```tsx
switch (question.type) {
  case 'multiple-choice':
    return <MultipleChoiceQuestion question={question} value={userAnswer} onChange={onAnswerChange} />
  // Future question types...
}
```

**Testing Requirements:**

Unit tests:
- MultipleChoiceQuestion renders all options correctly
- Selecting an option calls onChange callback
- Only one option can be selected at a time
- Markdown rendering for question text

E2E tests:
- Click each answer option → selection updates
- Navigate away and back → selection persists
- Keyboard navigation (Tab to options, Space/Enter to select)

Accessibility tests:
- fieldset/legend semantic structure
- Radio group has proper ARIA attributes
- Screen reader announces question text and all options
- Focus indicators visible on all options (4.5:1 contrast)
- Touch targets ≥44px on mobile

**Dependencies:**
- Story 12.1 (needs Question type)
- Story 12.3 (needs useQuizStore for answer submission)
- Story 12.4 (needs QuizPlayer to render questions)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Question text typography and spacing
- Radio button styling and selection state
- Responsive layout (stacked on mobile, potentially multi-column on desktop)
- Touch target sizes on mobile (≥44px)
- Markdown rendering quality (code blocks, lists)
- Focus states on radio buttons

---

### Story 12.6: Calculate and Display Quiz Score

As a learner,
I want to submit my quiz and immediately see my score,
So that I know how well I performed.

**Acceptance Criteria:**

**Given** I have answered all required questions in a quiz
**When** I click "Submit Quiz"
**Then** the quiz is submitted to useQuizStore.submitQuiz()
**And** my score is calculated as a percentage of total possible points
**And** I am redirected to `/courses/:courseId/lessons/:lessonId/quiz/results`
**And** I see my score displayed prominently (e.g., "85%")
**And** I see the number of questions I answered correctly (e.g., "10 of 12 correct")
**And** I see whether I passed or failed based on the quiz's passing score
**And** I see the total time I spent on the quiz (e.g., "Completed in 8m 32s")

**Given** I have NOT answered all questions
**When** I attempt to submit the quiz
**Then** I see a warning message: "You have N unanswered questions. Submit anyway?"
**And** I can choose to continue reviewing or submit with unanswered questions
**And** unanswered questions are scored as 0 points

**Given** the quiz has partial credit scoring enabled
**When** my score is calculated
**Then** each question receives 0-100% of possible points based on correctness
**And** the total score is the sum of all question scores
**And** the percentage is calculated as (total score / total possible points) * 100

**Given** the quiz results screen
**When** I view my score
**Then** I see a "Retake Quiz" button to start over
**And** I see a "Review Answers" button to see all questions and correct answers
**And** I see an encouraging message regardless of score (e.g., "Great effort!" or "You're making progress!")

**Technical Details:**

Files to create:
- `src/app/pages/QuizResults.tsx` (results page)
- `src/app/components/quiz/ScoreSummary.tsx` (score display component)
- `src/lib/scoring.ts` (scoring utility functions)

Files to modify:
- `src/app/routes.tsx` (add results route)

Scoring algorithm (src/lib/scoring.ts):
```typescript
export function calculatePartialCredit(
  question: Question,
  userAnswer: string | string[]
): { pointsEarned: number; isCorrect: boolean } {
  switch (question.type) {
    case 'multiple-choice':
    case 'true-false':
    case 'fill-in-blank':
      // All-or-nothing
      const isCorrect = userAnswer === question.correctAnswer
      return { pointsEarned: isCorrect ? question.points : 0, isCorrect }
    
    case 'multiple-select':
      // Partial Credit Model (PCM)
      // (correct selections - incorrect selections) / total correct
      // Implementation in Story 14.2
  }
}

export function calculateQuizScore(answers: Answer[]): {
  score: number
  percentage: number
  totalPoints: number
} {
  const score = answers.reduce((sum, a) => sum + a.pointsEarned, 0)
  const totalPoints = answers.reduce((sum, a) => sum + a.pointsPossible, 0)
  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0
  return { score, percentage, totalPoints }
}
```

Results route:
```typescript
{
  path: '/courses/:courseId/lessons/:lessonId/quiz/results',
  element: <QuizResults />
}
```

**Testing Requirements:**

Unit tests:
- calculatePartialCredit for multiple-choice (all-or-nothing)
- calculateQuizScore with various answer combinations
- Percentage calculation accuracy
- Passed/failed determination

E2E tests:
- Submit quiz with all questions answered → see results
- Submit quiz with unanswered questions → see warning, can submit anyway
- Results page displays score, percentage, time, pass/fail status
- "Retake Quiz" button navigates to quiz start screen
- "Review Answers" button shows question review mode

Accessibility tests:
- Screen reader announces score and pass/fail status
- Keyboard navigation to Retake and Review buttons
- Focus moves to score on results page load (aria-live region)

**Dependencies:**
- Story 12.1 (needs Answer, QuizAttempt types)
- Story 12.3 (needs useQuizStore.submitQuiz)
- Story 12.4 (needs QuizPlayer for submit flow)
- Story 12.5 (needs question answering to have data to score)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Score display prominence and typography (large, bold percentage)
- Pass/fail visual indicator (green checkmark vs. orange neutral icon)
- Encouraging message tone (non-judgmental language)
- Button spacing and touch targets (Retake, Review)
- Responsive layout at 375px, 768px, 1440px
- Time display formatting (8m 32s, not 512 seconds)

---

## Epic 13: Navigate and Control Quiz Flow

**Goal:** Learners can navigate between questions in any order, pause and resume quizzes, mark questions for review, and safely exit without losing progress.

**Technical Focus:** This epic extends Epic 1 with flexible navigation controls, robust state management, and Fisher-Yates randomization.

### Story 13.1: Navigate Between Questions

As a learner,
I want to navigate between quiz questions in any order,
So that I can skip difficult questions and return to them later.

**Acceptance Criteria:**

**Given** I am taking a quiz with multiple questions
**When** I am viewing any question
**Then** I see "Previous" and "Next" buttons (or "Start Over" on Q1, "Submit Quiz" on last Q)
**And** I can click "Next" to advance to the next question
**And** I can click "Previous" to return to the previous question
**And** my answer to the current question is auto-saved before navigating
**And** previously answered questions display my selected answer when I return

**Given** I am on the first question
**When** viewing the navigation controls
**Then** the "Previous" button is disabled or hidden
**And** I see only "Next" button (or "Submit Quiz" if single-question quiz)

**Given** I am on the last question
**When** viewing the navigation controls
**Then** the "Next" button changes to "Submit Quiz"
**And** I can still use "Previous" to review earlier questions

**Given** I want to jump to a specific question
**When** I view the quiz navigation component
**Then** I see a question list/grid showing all question numbers (1, 2, 3, ... 12)
**And** answered questions are visually indicated (e.g., blue dot)
**And** unanswered questions are visually indicated (e.g., gray outline)
**And** the current question is highlighted (e.g., blue filled circle)
**And** I can click any question number to jump directly to that question

**Technical Details:**

Files to create:
- `src/app/components/quiz/QuizNavigation.tsx` (pagination + question grid)
- `src/app/components/quiz/QuizActions.tsx` (Previous/Next/Submit buttons)

Files to modify:
- `src/app/pages/Quiz.tsx` (integrate navigation)
- `src/stores/useQuizStore.ts` (add navigateToQuestion action)

QuizNavigation component:
```tsx
<nav className="flex items-center justify-between">
  <QuizActions 
    onPrevious={handlePrevious} 
    onNext={handleNext} 
    onSubmit={handleSubmit}
    isFirst={currentIndex === 0}
    isLast={currentIndex === totalQuestions - 1}
  />
  <QuestionGrid 
    questions={quiz.questions}
    answers={currentProgress.answers}
    currentIndex={currentIndex}
    onQuestionClick={handleQuestionClick}
  />
</nav>
```

useQuizStore navigation actions:
```typescript
navigateToQuestion: (index: number) => {
  set({ currentProgress: { ...currentProgress, currentQuestionIndex: index } })
}
```

**Testing Requirements:**

Unit tests:
- QuizNavigation renders correct buttons based on current question
- navigateToQuestion updates currentQuestionIndex
- Question grid displays answered/unanswered states correctly

E2E tests:
- Click "Next" → advances to next question
- Click "Previous" → returns to previous question
- Click question number in grid → jumps to that question
- Navigate away and back → current question restored
- Answer persists when navigating away and returning

Accessibility tests:
- Keyboard navigation (Tab to buttons, Enter to activate)
- Arrow keys to navigate questions (optional enhancement)
- Screen reader announces "Question 3 of 12" when navigating
- Focus moves to question text after navigation

**Dependencies:**
- Story 12.1 (needs QuizProgress type)
- Story 12.3 (needs useQuizStore)
- Story 12.4 (needs QuizPlayer)
- Story 12.5 (needs question display to navigate between)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Previous/Next button placement and size (≥44px touch targets)
- Question grid layout (responsive: single row on mobile, grid on desktop)
- Visual indicators for answered/unanswered/current questions
- Button states (disabled Previous on Q1, "Submit" on last Q)
- Spacing and alignment of navigation controls

---

### Story 13.2: Mark Questions for Review

As a learner,
I want to mark questions for later review,
So that I can quickly find questions I'm uncertain about before submitting.

**Acceptance Criteria:**

**Given** I am viewing any question
**When** I see the question interface
**Then** I see a "Mark for Review" checkbox or toggle
**And** the control is clearly labeled and easy to find
**And** I can toggle it on/off by clicking or tapping

**Given** I mark a question for review
**When** I toggle the "Mark for Review" control
**Then** the question is marked in the quiz state
**And** the question number in the navigation grid displays a visual indicator (e.g., yellow star or flag icon)
**And** the mark persists if I navigate away and return

**Given** I have marked multiple questions for review
**When** I view the question navigation grid
**Then** all marked questions display the review indicator
**And** I can quickly identify which questions need attention
**And** I can jump to any marked question by clicking its number

**Given** I want to clear a review mark
**When** I toggle the "Mark for Review" control off
**Then** the question is unmarked
**And** the review indicator disappears from the navigation grid

**Given** I am on the quiz final review screen (before submit)
**When** I view the "Questions Marked for Review" section
**Then** I see a list of all marked question numbers
**And** I can click each to jump back to that question
**And** I see the total count (e.g., "3 questions marked for review")

**Technical Details:**

Files to create:
- `src/app/components/quiz/MarkForReview.tsx` (checkbox/toggle component)
- `src/app/components/quiz/ReviewSummary.tsx` (pre-submit review list)

Files to modify:
- `src/stores/useQuizStore.ts` (add markForReview action)
- `src/types/quiz.ts` (add markedForReview to QuizProgress)
- `src/app/components/quiz/QuizNavigation.tsx` (display review indicators)

QuizProgress type extension:
```typescript
interface QuizProgress {
  // ... existing fields
  markedForReview: string[]  // array of question IDs
}
```

useQuizStore action:
```typescript
toggleMarkForReview: (questionId: string) => {
  set(state => {
    const marked = state.currentProgress?.markedForReview || []
    const newMarked = marked.includes(questionId)
      ? marked.filter(id => id !== questionId)
      : [...marked, questionId]
    return {
      currentProgress: {
        ...state.currentProgress!,
        markedForReview: newMarked
      }
    }
  })
}
```

**Testing Requirements:**

Unit tests:
- toggleMarkForReview adds/removes question ID from array
- MarkForReview component toggles state correctly
- Navigation grid displays review indicator for marked questions

E2E tests:
- Click "Mark for Review" → question marked, indicator appears in grid
- Click again → question unmarked, indicator disappears
- Mark multiple questions → all show indicators
- Navigate away and back → marks persist
- Submit warning shows marked questions count

Accessibility tests:
- Keyboard toggle (Space to check/uncheck)
- Screen reader announces "Marked for review" / "Unmarked" on toggle
- Review indicator visible with 3:1 contrast
- Focus on toggle control has visible indicator

**Dependencies:**
- Story 12.3 (needs useQuizStore)
- Story 13.1 (needs question navigation to see marked questions)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- "Mark for Review" control placement (near question, not obtrusive)
- Visual indicator design (star, flag, or colored dot)
- Indicator visibility in navigation grid
- Toggle interaction feel (immediate visual feedback)

---

### Story 13.3: Pause and Resume Quiz

As a learner,
I want to pause a quiz and resume later without losing my progress,
So that I can handle interruptions without starting over.

**Acceptance Criteria:**

**Given** I am taking a quiz
**When** I close the browser tab or navigate away
**Then** my quiz progress auto-saves to localStorage
**And** my current question index, all answers, and timer state are preserved
**And** no data is lost even if the browser crashes

**Given** I return to the quiz after closing the browser
**When** I navigate to the quiz URL
**Then** I see a "Resume Quiz" button on the start screen
**And** the button shows how many questions I've answered (e.g., "Resume Quiz (5 of 12 answered)")
**And** clicking "Resume Quiz" loads me to the exact question I was on
**And** all my previous answers are restored

**Given** I intentionally want to pause
**When** I see the quiz interface
**Then** I can click the browser back button to exit safely
**Or** I can close the tab/window
**And** my progress auto-saves via Zustand persist middleware (no explicit "Pause" button needed)

**Given** the quiz has a timer
**When** I pause and resume
**Then** the timer state is restored correctly
**And** time spent paused does NOT count toward quiz time
**And** the timer resumes counting down from where it left off

**Given** I have completed a quiz
**When** I navigate back to the quiz URL
**Then** I do NOT see a "Resume Quiz" button
**And** I see only "Start New Attempt" (retake functionality from Story 13.4)

**Technical Details:**

Files to modify:
- `src/app/pages/Quiz.tsx` (detect and display resume option)
- `src/app/components/quiz/QuizStartScreen.tsx` (add Resume button)
- `src/stores/useQuizStore.ts` (ensure persist middleware configured correctly)

QuizStartScreen component:
```tsx
{currentProgress && (
  <Button onClick={handleResume} variant="primary">
    Resume Quiz ({answeredCount} of {totalQuestions} answered)
  </Button>
)}
{!currentProgress && (
  <Button onClick={handleStart} variant="primary">
    Start Quiz
  </Button>
)}
```

Zustand persist middleware (already in Story 12.3):
- Persists `currentProgress` to localStorage
- Auto-saves on every answer selection (debounced)
- Key: 'levelup-quiz-store'

**Testing Requirements:**

Unit tests:
- currentProgress persists to localStorage
- Resume button appears when currentProgress exists
- Resume loads correct question index and answers

E2E tests:
- Answer 5 questions → close tab → reopen → see "Resume" button
- Click "Resume" → land on question 6 with previous answers intact
- Complete quiz → return → no "Resume" button
- Browser crash simulation → reopen → progress intact

Accessibility tests:
- "Resume Quiz" button has focus on page load if present
- Screen reader announces button with answer count

**Dependencies:**
- Story 12.3 (needs useQuizStore with persist middleware)
- Story 12.4 (needs QuizPlayer and start screen)
- Story 13.1 (needs navigation to resume at correct question)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- "Resume Quiz" button prominence (primary action if progress exists)
- Answer count display ("5 of 12 answered")
- Start screen layout with Resume vs. Start button

---

### Story 13.4: Unlimited Quiz Retakes

As a learner,
I want to retake quizzes as many times as needed without cooldown or limits,
So that I can practice until I achieve mastery.

**Acceptance Criteria:**

**Given** I have completed a quiz
**When** I view the quiz results screen
**Then** I see a "Retake Quiz" button prominently displayed
**And** there is no message about attempt limits or cooldowns
**And** clicking "Retake Quiz" immediately starts a new attempt

**Given** I start a quiz retake
**When** the quiz loads
**Then** all my previous answers are cleared (fresh attempt)
**And** the questions are re-randomized if shuffleQuestions is enabled
**And** the timer resets to the original time limit
**And** my previous attempt scores remain stored in Dexie for history tracking

**Given** I have taken a quiz multiple times
**When** I view the results screen after any attempt
**Then** I see my current attempt score
**And** I see a summary of improvement (e.g., "Previous best: 75%, Current: 85% (+10%)")
**And** I can click "View All Attempts" to see full history (Story 16.1)

**Given** I want to retake from the lesson page
**When** I navigate to a lesson with a quiz I've already completed
**Then** I see "Retake Quiz" instead of "Take Quiz"
**And** clicking it starts a new attempt immediately (no confirmation dialog needed)

**Technical Details:**

Files to modify:
- `src/app/pages/QuizResults.tsx` (add Retake button)
- `src/app/components/quiz/ScoreSummary.tsx` (show improvement vs. previous best)
- `src/stores/useQuizStore.ts` (implement retakeQuiz action)

useQuizStore.retakeQuiz action:
```typescript
retakeQuiz: (quizId: string) => {
  // Clear current progress
  set({ currentProgress: null, currentQuiz: null })
  
  // Start fresh attempt (reuses startQuiz logic)
  get().startQuiz(quizId)
}
```

ScoreSummary improvement display:
```tsx
{previousBestScore && (
  <div className="text-sm text-gray-600">
    Previous best: {previousBestScore}%
    {currentScore > previousBestScore && (
      <span className="text-green-600 font-semibold">
        (+{currentScore - previousBestScore}%)
      </span>
    )}
  </div>
)}
```

**Testing Requirements:**

Unit tests:
- retakeQuiz clears currentProgress and starts new attempt
- Previous attempts remain in Dexie
- Improvement calculation (current vs. previous best)

E2E tests:
- Complete quiz → click "Retake Quiz" → quiz restarts with cleared answers
- Complete quiz 3 times → see improvement on each attempt
- Questions re-randomize on retake if shuffle enabled
- All attempts stored in history

Accessibility tests:
- "Retake Quiz" button keyboard accessible
- Screen reader announces improvement message
- Focus on "Retake Quiz" button after results load

**Dependencies:**
- Story 12.3 (needs useQuizStore.startQuiz)
- Story 12.6 (needs QuizResults page)
- Story 13.1 (needs navigation for retake flow)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- "Retake Quiz" button prominence on results screen
- Improvement message styling (+10% in green, visually positive)
- No discouraging language about limits or cooldowns

---

### Story 13.5: Randomize Question Order with Fisher-Yates Shuffle

As a learner,
I want quiz questions to appear in random order on each attempt,
So that I cannot rely on memorizing question positions.

**Acceptance Criteria:**

**Given** a quiz with `shuffleQuestions: true`
**When** I start the quiz
**Then** the questions are randomized using Fisher-Yates shuffle algorithm
**And** every permutation of question order has equal probability (1/n!)
**And** the randomization is unbiased (no position bias)

**Given** I retake the same quiz
**When** starting a new attempt
**Then** the questions are shuffled again in a different order
**And** the shuffle is independent of previous attempts (new random seed each time)

**Given** a quiz with `shuffleQuestions: false`
**When** I start the quiz
**Then** questions appear in their original `order` property sequence
**And** no shuffling is applied

**Given** the shuffling algorithm
**When** implemented in `src/lib/shuffle.ts`
**Then** it uses Fisher-Yates shuffle with O(n) time complexity
**And** it creates a new array (does not mutate the original)
**And** it works with any array type (generic implementation)

**Technical Details:**

Files to create:
- `src/lib/shuffle.ts` (Fisher-Yates implementation)

Files to modify:
- `src/stores/useQuizStore.ts` (apply shuffle in startQuiz)

Fisher-Yates shuffle implementation:
```typescript
export function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array]  // Immutability
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  
  return shuffled
}
```

Usage in useQuizStore.startQuiz:
```typescript
if (quiz.shuffleQuestions) {
  quiz.questions = fisherYatesShuffle(quiz.questions)
}
```

**Testing Requirements:**

Unit tests:
- fisherYatesShuffle produces valid permutations
- All elements present after shuffle (no loss/duplication)
- Original array not mutated (immutability)
- Distribution test (run 10,000 times, verify uniform distribution)

E2E tests:
- Start quiz with shuffle enabled → questions in random order
- Retake quiz → different order on each attempt
- Start quiz with shuffle disabled → original order preserved

**Dependencies:**
- Story 12.1 (needs Quiz type with shuffleQuestions property)
- Story 12.3 (needs useQuizStore.startQuiz to apply shuffle)

**Complexity:** Small (1-2 hours)

**Design Review Focus:** N/A (algorithm only, no UI)

---

### Story 13.6: Handle localStorage Quota Exceeded Gracefully

As a learner,
I want the quiz to continue working even if localStorage is full,
So that I don't lose progress due to storage limitations.

**Acceptance Criteria:**

**Given** localStorage is near or at quota limit
**When** the quiz attempts to save progress
**Then** it catches `QuotaExceededError` exceptions
**And** it attempts to free space by clearing old data (if possible)
**Or** it falls back to sessionStorage (temporary, page-session only)
**And** it displays a non-blocking warning toast: "Storage limit reached. Quiz progress will be saved for this session only."

**Given** localStorage quota is exceeded
**When** I complete and submit the quiz
**Then** the attempt is still saved to IndexedDB (Dexie)
**And** only the `currentProgress` state is affected (attempt history intact)
**And** I can still complete the quiz successfully

**Given** I am using sessionStorage fallback
**When** I close the browser tab
**Then** I lose in-progress state (expected behavior for sessionStorage)
**And** submitted attempts remain in IndexedDB (permanent storage)

**Given** the quota exceeded warning
**When** displayed to the user
**Then** it suggests clearing browser data or using a different browser
**And** it does NOT block quiz functionality (non-modal toast)

**Technical Details:**

Files to modify:
- `src/stores/useQuizStore.ts` (add quota handling to persist middleware)

Quota handling in Zustand persist:
```typescript
persist(
  (set, get) => ({ ...state }),
  {
    name: 'levelup-quiz-store',
    storage: {
      getItem: (name) => {
        try {
          return localStorage.getItem(name)
        } catch {
          return sessionStorage.getItem(name)
        }
      },
      setItem: (name, value) => {
        try {
          localStorage.setItem(name, value)
        } catch (e) {
          if (e instanceof DOMException && e.name === 'QuotaExceededError') {
            // Fallback to sessionStorage
            sessionStorage.setItem(name, value)
            
            // Show warning toast
            toast.warning(
              'Storage limit reached. Quiz progress will be saved for this session only.',
              { duration: 5000 }
            )
          }
        }
      },
      removeItem: (name) => {
        localStorage.removeItem(name)
        sessionStorage.removeItem(name)
      }
    }
  }
)
```

**Testing Requirements:**

Unit tests:
- QuotaExceededError caught and handled
- Falls back to sessionStorage
- Toast warning displayed

E2E tests:
- Simulate quota exceeded → quiz continues working
- Submit quiz with fallback storage → attempt saved to Dexie
- Close tab after fallback → progress lost (expected)

**Dependencies:**
- Story 12.3 (needs useQuizStore with persist middleware)
- Story 13.3 (affects pause/resume behavior)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Toast warning message clarity and tone
- Non-blocking notification (doesn't interrupt quiz taking)

---

## Epic 14: Practice with Diverse Question Types

**Goal:** Learners can practice with True/False, Multiple Select, and Fill-in-Blank questions in addition to Multiple Choice.

**Technical Focus:** This epic adds polymorphic question renderers with type-specific scoring logic and rich text formatting support.

### Story 14.1: Display True/False Questions

As a learner,
I want to answer True/False questions,
So that I can practice with binary choice assessments.

**Acceptance Criteria:**

**Given** a quiz with True/False questions
**When** I view a True/False question
**Then** I see the question text clearly displayed
**And** I see exactly two options: "True" and "False"
**And** the options are displayed as radio buttons (only one selectable)
**And** I can select either "True" or "False" by clicking or tapping

**Given** I select an answer
**When** I choose "True" or "False"
**Then** my selection is visually indicated (filled radio button)
**And** the selection is saved to quiz state immediately
**And** I can change my answer by selecting the other option

**Given** True/False question scoring
**When** the quiz is submitted
**Then** True/False questions are scored all-or-nothing (0% or 100%)
**And** the correct answer is compared to my selection
**And** points are awarded only if my answer matches the correct answer exactly

**Technical Details:**

Files to create:
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`

Files to modify:
- `src/app/components/quiz/QuestionDisplay.tsx` (add case for 'true-false')

TrueFalseQuestion component:
```tsx
<fieldset>
  <legend className="text-lg font-semibold mb-4">
    <ReactMarkdown>{question.text}</ReactMarkdown>
  </legend>
  <RadioGroup value={selectedAnswer} onValueChange={handleAnswerChange}>
    <RadioGroupItem value="true" label="True" />
    <RadioGroupItem value="false" label="False" />
  </RadioGroup>
</fieldset>
```

QuestionDisplay update:
```tsx
case 'true-false':
  return <TrueFalseQuestion question={question} value={userAnswer} onChange={onAnswerChange} />
```

Scoring (src/lib/scoring.ts, already in Story 12.6):
```typescript
case 'true-false':
  const isCorrect = userAnswer === question.correctAnswer
  return { pointsEarned: isCorrect ? question.points : 0, isCorrect }
```

**Testing Requirements:**

Unit tests:
- TrueFalseQuestion renders "True" and "False" options
- Selection triggers onChange callback
- Scoring calculates correctly (all-or-nothing)

E2E tests:
- Click "True" → selection updates
- Click "False" → selection changes
- Submit quiz → True/False questions scored correctly

Accessibility tests:
- fieldset/legend semantic structure
- Radio group keyboard navigation (Tab, Arrow keys, Space/Enter)
- Screen reader announces question and two options
- Focus indicators visible (4.5:1 contrast)

**Dependencies:**
- Story 12.1 (needs Question type with 'true-false')
- Story 12.3 (needs useQuizStore)
- Story 12.5 (extends QuestionDisplay polymorphic pattern)

**Complexity:** Small (1-2 hours)

**Design Review Focus:**
- True/False option layout (stacked or side-by-side)
- Radio button styling consistent with Multiple Choice
- Touch targets ≥44px on mobile

---

### Story 14.2: Display Multiple Select Questions with Partial Credit

As a learner,
I want to answer Multiple Select ("select all that apply") questions,
So that I can demonstrate knowledge of multiple correct answers.

**Acceptance Criteria:**

**Given** a quiz with Multiple Select questions
**When** I view a Multiple Select question
**Then** I see the question text with an indicator: "Select all that apply"
**And** I see multiple answer options displayed as checkboxes (not radio buttons)
**And** I can select zero, one, or multiple options by clicking or tapping
**And** all selected options are visually indicated (checked checkboxes)

**Given** I select multiple answers
**When** I check and uncheck options
**Then** each selection toggles independently
**And** I can have any combination of selected/unselected options
**And** my selections are saved to quiz state immediately

**Given** Multiple Select scoring with partial credit
**When** the quiz is submitted
**Then** my score is calculated using Partial Credit Model (PCM)
**And** the formula is: (correct selections - incorrect selections) / total correct answers
**And** incorrect selections reduce my score (penalize guessing)
**And** the score is clamped to minimum 0 (no negative points)

**Given** a question with 3 correct answers
**When** I select 2 correct and 1 incorrect
**Then** my raw score is (2 - 1) / 3 = 0.33 (33% of points)
**When** I select all 3 correct and 0 incorrect
**Then** my score is (3 - 0) / 3 = 1.0 (100% of points)
**When** I select 1 correct and 2 incorrect
**Then** my raw score is (1 - 2) / 3 = -0.33, clamped to 0 (0% of points)

**Technical Details:**

Files to create:
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`

Files to modify:
- `src/app/components/quiz/QuestionDisplay.tsx` (add case for 'multiple-select')
- `src/lib/scoring.ts` (add PCM scoring logic)

MultipleSelectQuestion component:
```tsx
<fieldset>
  <legend className="text-lg font-semibold mb-4">
    <ReactMarkdown>{question.text}</ReactMarkdown>
    <span className="text-sm text-gray-600 block mt-1">Select all that apply</span>
  </legend>
  <div className="space-y-2">
    {question.options.map((option, index) => (
      <Checkbox
        key={index}
        checked={selectedAnswers.includes(option)}
        onCheckedChange={() => handleToggle(option)}
        label={option}
      />
    ))}
  </div>
</fieldset>
```

PCM scoring in src/lib/scoring.ts:
```typescript
case 'multiple-select':
  const correctSet = new Set(question.correctAnswer as string[])
  const userSet = new Set(userAnswer as string[])
  
  const correctSelections = [...userSet].filter(a => correctSet.has(a)).length
  const incorrectSelections = [...userSet].filter(a => !correctSet.has(a)).length
  
  const rawScore = (correctSelections - incorrectSelections) / correctSet.size
  const pointsEarned = Math.max(0, Math.round(rawScore * question.points * 100) / 100)
  
  return {
    pointsEarned,
    isCorrect: correctSelections === correctSet.size && incorrectSelections === 0
  }
```

**Testing Requirements:**

Unit tests:
- MultipleSelectQuestion renders all options as checkboxes
- Multiple options can be selected simultaneously
- PCM scoring formula calculates correctly
- Edge cases: 0 selections, all correct, all incorrect, mixed

E2E tests:
- Check multiple options → all remain checked
- Uncheck option → checkbox unchecks
- Submit quiz → partial credit awarded correctly

Accessibility tests:
- Checkboxes have proper labels
- "Select all that apply" instruction announced by screen reader
- Keyboard navigation (Tab to each checkbox, Space to toggle)
- Focus indicators visible on all checkboxes

**Dependencies:**
- Story 12.1 (needs Question type with 'multiple-select' and correctAnswer as string[])
- Story 12.3 (needs useQuizStore)
- Story 12.5 (extends QuestionDisplay)
- Story 12.6 (extends scoring.ts)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- "Select all that apply" instruction prominence
- Checkbox layout (stacked vertically for clarity)
- Checkbox styling consistent with overall quiz theme
- Touch targets ≥44px on mobile
- Visual distinction from radio buttons (Multiple Choice)

---

### Story 14.3: Display Fill-in-Blank Questions

As a learner,
I want to answer Fill-in-Blank questions by typing text,
So that I can demonstrate recall without multiple choice hints.

**Acceptance Criteria:**

**Given** a quiz with Fill-in-Blank questions
**When** I view a Fill-in-Blank question
**Then** I see the question text clearly displayed
**And** I see a text input field with a placeholder (e.g., "Type your answer here")
**And** the input field is appropriately sized (not too small)
**And** I can type my answer freely

**Given** I type an answer
**When** I enter text into the input field
**Then** my input is saved to quiz state immediately (on blur or debounced)
**And** my answer persists if I navigate away and return
**And** there is no character limit (or a generous limit like 500 characters)

**Given** Fill-in-Blank scoring
**When** the quiz is submitted
**Then** my answer is compared to the correct answer
**And** the comparison is case-insensitive by default (e.g., "React" = "react" = "REACT")
**And** leading/trailing whitespace is trimmed before comparison
**And** the score is all-or-nothing (0% or 100%)

**Given** case-sensitive questions (optional enhancement)
**When** the question is configured as case-sensitive
**Then** "React" ≠ "react" (exact match required)
**And** this is clearly indicated to the learner (e.g., "Case-sensitive answer")

**Technical Details:**

Files to create:
- `src/app/components/quiz/questions/FillInBlankQuestion.tsx`

Files to modify:
- `src/app/components/quiz/QuestionDisplay.tsx` (add case for 'fill-in-blank')
- `src/lib/scoring.ts` (add fill-in-blank scoring logic)

FillInBlankQuestion component:
```tsx
<fieldset>
  <legend className="text-lg font-semibold mb-4">
    <ReactMarkdown>{question.text}</ReactMarkdown>
  </legend>
  <Input
    type="text"
    value={userAnswer || ''}
    onChange={(e) => handleAnswerChange(e.target.value)}
    onBlur={() => /* trigger save */}
    placeholder="Type your answer here"
    className="w-full max-w-md"
    maxLength={500}
  />
</fieldset>
```

Scoring in src/lib/scoring.ts:
```typescript
case 'fill-in-blank':
  const userAnswerNormalized = (userAnswer as string).trim().toLowerCase()
  const correctAnswerNormalized = (question.correctAnswer as string).trim().toLowerCase()
  
  const isCorrect = userAnswerNormalized === correctAnswerNormalized
  return { pointsEarned: isCorrect ? question.points : 0, isCorrect }
```

**Testing Requirements:**

Unit tests:
- FillInBlankQuestion renders text input
- Typing updates state
- Scoring compares case-insensitively with trimming
- Edge cases: empty string, whitespace only, exact match

E2E tests:
- Type answer → input updates
- Navigate away and back → answer persists
- Submit quiz → fill-in-blank scored correctly
- Case variations ("React" vs "react") treated as correct

Accessibility tests:
- Input field has associated label (fieldset/legend)
- Keyboard focus visible on input (4.5:1 contrast outline)
- Screen reader announces question and input purpose
- Placeholder text not relied upon for instructions

**Dependencies:**
- Story 12.1 (needs Question type with 'fill-in-blank')
- Story 12.3 (needs useQuizStore)
- Story 12.5 (extends QuestionDisplay)
- Story 12.6 (extends scoring.ts)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Input field sizing (not too narrow, not too wide)
- Placeholder text clarity
- Input border and focus states
- Responsive width on mobile vs. desktop

---

### Story 14.4: Support Rich Text Formatting in Questions

As a learner,
I want to see questions with code blocks, lists, and emphasis,
So that technical content is clearly formatted and readable.

**Acceptance Criteria:**

**Given** a question with Markdown formatting
**When** I view the question
**Then** code blocks are displayed with monospace font and background highlighting
**And** inline code is distinguished from regular text (e.g., `variable`)
**And** ordered and unordered lists display with proper indentation
**And** bold and italic text render correctly
**And** all formatting is responsive and readable on mobile

**Given** a question with a code block
**When** rendering the code
**Then** it uses syntax highlighting (if language specified, e.g., ```javascript)
**And** the code block scrolls horizontally if too wide (no line wrapping)
**And** the background color contrasts well with code text (≥4.5:1)

**Given** long question text
**When** rendering on mobile (375px)
**Then** text wraps naturally without horizontal scroll
**And** code blocks scroll independently
**And** all content remains readable

**Technical Details:**

Files to modify:
- All question components (MultipleChoiceQuestion, TrueFalseQuestion, etc.)
- Install and configure `react-markdown` with `remark-gfm` for GitHub Flavored Markdown

Package installation:
```bash
npm install react-markdown remark-gfm
```

Question text rendering (all question components):
```tsx
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {question.text}
</ReactMarkdown>
```

Custom Markdown styles (in Tailwind or theme.css):
```css
.markdown-content code {
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}

.markdown-content pre {
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
}

.markdown-content ul,
.markdown-content ol {
  margin-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}
```

**Testing Requirements:**

Unit tests:
- react-markdown renders code blocks correctly
- Inline code styling applied
- Lists render with indentation

E2E tests:
- View question with code block → syntax highlighting visible
- View question with list → proper indentation
- Mobile view → text wraps, code scrolls

Accessibility tests:
- Code block contrast ≥4.5:1
- Screen reader announces lists correctly (<ul>/<ol> semantic HTML)
- Emphasis (bold/italic) conveyed via screen reader

**Dependencies:**
- Story 12.5 (modifies MultipleChoiceQuestion)
- Story 14.1 (modifies TrueFalseQuestion)
- Story 14.2 (modifies MultipleSelectQuestion)
- Story 14.3 (modifies FillInBlankQuestion)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Code block background color and contrast
- Inline code styling (distinct but not distracting)
- List indentation and spacing
- Mobile responsiveness (text wrapping, code scrolling)
- Syntax highlighting readability

---


## Epic 15: Timed Quizzes with Enhanced Feedback

**Goal:** Learners can take timed quizzes with countdown timers, configurable accommodations, warnings, and receive immediate explanatory feedback on each answer.

**Technical Focus:** This epic implements the useQuizTimer hook with Date.now() accuracy pattern, immediate feedback components, and performance summary generation.

### Story 15.1: Display Countdown Timer with Accuracy

As a learner,
I want to see an accurate countdown timer during timed quizzes,
So that I know exactly how much time remains.

**Acceptance Criteria:**

**Given** a quiz with a time limit configured
**When** I start the quiz
**Then** I see a countdown timer in the quiz header
**And** the timer displays time in MM:SS format (e.g., "14:32")
**And** the timer counts down accurately without drift
**And** the timer updates every second

**Given** the timer is running
**When** I switch browser tabs or minimize the window
**Then** the timer continues counting down accurately
**And** when I return to the tab, the time reflects actual elapsed time (no drift from `setInterval` throttling)

**Given** the timer reaches specific thresholds
**When** 25% time remains (e.g., 3:45 of 15:00)
**Then** the timer text color changes to amber (warning state)
**When** 10% time remains (e.g., 1:30 of 15:00)
**Then** the timer text color changes to red (urgent state)

**Given** the timer reaches zero
**When** time expires
**Then** the quiz auto-submits immediately
**And** I see a message: "Time's up! Your quiz has been submitted."
**And** my current answers are scored (unanswered questions = 0 points)

**Technical Details:**

Files to create:
- `src/hooks/useQuizTimer.ts` (Date.now() accuracy pattern)
- `src/app/components/quiz/QuizTimer.tsx` (timer display component)

Files to modify:
- `src/app/components/quiz/QuizHeader.tsx` (integrate timer)
- `src/stores/useQuizStore.ts` (add timer state management)

useQuizTimer hook implementation:
```typescript
export function useQuizTimer(initialSeconds: number, onExpire: () => void) {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds)
  
  useEffect(() => {
    const startTime = Date.now()
    const endTime = startTime + (initialSeconds * 1000)
    
    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeRemaining(remaining)
      
      if (remaining === 0) {
        clearInterval(interval)
        onExpire()
      }
    }, 1000)
    
    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now()
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
        setTimeRemaining(remaining)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [initialSeconds, onExpire])
  
  return timeRemaining
}
```

QuizTimer component:
```tsx
<div className={cn(
  "font-mono text-lg font-semibold",
  timeRemaining < totalTime * 0.1 && "text-red-600",
  timeRemaining < totalTime * 0.25 && timeRemaining >= totalTime * 0.1 && "text-amber-600"
)}>
  {formatTime(timeRemaining)}
</div>
```

**Testing Requirements:**

Unit tests:
- useQuizTimer counts down accurately
- formatTime converts seconds to MM:SS correctly
- onExpire callback fires when time reaches 0

E2E tests:
- Start timed quiz → timer counts down
- Switch tabs for 10 seconds → return → time accurate (no drift)
- Timer reaches 0 → quiz auto-submits

**Dependencies:**
- Story 12.3 (needs useQuizStore to track timer state)
- Story 12.4 (needs QuizHeader to display timer)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Timer visibility and placement (top-right of header)
- Color transitions (green → amber → red)
- Font size and readability
- MM:SS format clarity

---

### Story 15.2: Configure Timer Duration and Accommodations

As a learner,
I want to configure the quiz timer duration before starting,
So that I can adjust time limits to my needs (including accessibility accommodations).

**Acceptance Criteria:**

**Given** a quiz with a configurable time limit
**When** I view the quiz start screen
**Then** I see the default time limit (e.g., "15 minutes")
**And** I see an "Accessibility Accommodations" link or button
**And** I can click it to open a settings modal

**Given** the accessibility accommodations modal
**When** I open it
**Then** I see options to extend time:
  - Standard time (e.g., 15 minutes)
  - 150% extended time (e.g., 22 minutes 30 seconds)
  - 200% extended time (e.g., 30 minutes)
  - Untimed (no time limit)
**And** I can select one option via radio buttons
**And** I see an explanation: "Extended time is available for learners who need additional time due to disabilities or other needs."

**Given** I select an accommodation
**When** I choose "150% extended time" and start the quiz
**Then** the timer is initialized to 150% of the default time
**And** the timer header indicates the accommodation (e.g., "22:30 (Extended Time)")

**Given** I select "Untimed"
**When** I start the quiz
**Then** no timer is displayed
**And** I can take as long as needed to complete the quiz

**Given** I have set an accommodation preference
**When** I retake the quiz later
**Then** my preference persists (saved to Settings or localStorage)
**And** I don't need to re-configure on every attempt

**Technical Details:**

Files to create:
- `src/app/components/quiz/TimerAccommodationsModal.tsx`

Files to modify:
- `src/app/components/quiz/QuizStartScreen.tsx` (add accommodations button)
- `src/stores/useQuizStore.ts` (apply accommodation multiplier)
- `src/stores/useSettingsStore.ts` (persist timer preferences) (if not created yet, defer to Story 18.6)

TimerAccommodationsModal:
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="link">Accessibility Accommodations</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogTitle>Timer Accommodations</DialogTitle>
    <RadioGroup value={accommodation} onValueChange={setAccommodation}>
      <RadioGroupItem value="1.0" label="Standard time (15 minutes)" />
      <RadioGroupItem value="1.5" label="150% extended time (22 minutes 30 seconds)" />
      <RadioGroupItem value="2.0" label="200% extended time (30 minutes)" />
      <RadioGroupItem value="untimed" label="Untimed (no time limit)" />
    </RadioGroup>
    <p className="text-sm text-gray-600">
      Extended time is available for learners who need additional time.
    </p>
  </DialogContent>
</Dialog>
```

Apply accommodation in useQuizStore.startQuiz:
```typescript
const accommodation = useSettingsStore.getState().timerAccommodation || 1.0
const timeLimit = quiz.timeLimit
const adjustedTime = accommodation === 'untimed' ? null : timeLimit * accommodation
```

**Testing Requirements:**

Unit tests:
- Accommodation modal renders options correctly
- Time calculation applies multiplier accurately
- Preference persists to settings

E2E tests:
- Click "Accessibility Accommodations" → modal opens
- Select "150%" → start quiz → timer shows extended time
- Select "Untimed" → start quiz → no timer displayed
- Retake quiz → previous accommodation pre-selected

Accessibility tests:
- Modal keyboard accessible (Esc to close, Tab to navigate)
- Screen reader announces all accommodation options
- Focus traps in modal while open

**Dependencies:**
- Story 12.4 (needs QuizStartScreen)
- Story 15.1 (needs timer to apply accommodations to)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- "Accessibility Accommodations" button placement and discoverability
- Modal layout and radio button styling
- Explanation text clarity and tone (supportive, not clinical)
- Extended time indicator in timer header

---

### Story 15.3: Display Timer Warnings at Key Thresholds

As a learner,
I want to receive warnings when time is running low,
So that I can manage my pacing and avoid running out of time unexpectedly.

**Acceptance Criteria:**

**Given** a timed quiz is in progress
**When** the timer reaches 75% of original time remaining (e.g., 11:15 of 15:00)
**Then** a subtle toast notification appears: "11 minutes remaining"
**And** the toast auto-dismisses after 3 seconds
**And** the warning does NOT disrupt my quiz-taking flow

**When** the timer reaches 10% of original time remaining (e.g., 1:30 of 15:00)
**Then** a more prominent toast appears: "Only 1 minute 30 seconds remaining!"
**And** the toast auto-dismisses after 5 seconds

**When** the timer reaches 1 minute remaining
**Then** a persistent warning appears: "1 minute remaining"
**And** this warning remains visible until time expires

**Given** I am using a screen reader
**When** each warning threshold is reached
**Then** the warning is announced via ARIA live region (`aria-live="polite"` for 75%, `aria-live="assertive"` for 10% and 1 min)
**And** the announcement does NOT interrupt my current question reading

**Given** I have configured timer accommodations
**When** warnings are triggered
**Then** they are based on the adjusted time, not the original time
**And** 75% of 22:30 (extended time) = 16:52, not based on original 15:00

**Technical Details:**

Files to create:
- `src/app/components/quiz/TimerWarnings.tsx` (warning display logic)

Files to modify:
- `src/hooks/useQuizTimer.ts` (emit warning events at thresholds)
- `src/app/pages/Quiz.tsx` (integrate warnings)

useQuizTimer with warnings:
```typescript
const [warnings, setWarnings] = useState({
  seventyFivePercent: false,
  tenPercent: false,
  oneMinute: false
})

useEffect(() => {
  // ... existing timer logic
  
  // Check thresholds
  const percentRemaining = remaining / initialSeconds
  
  if (percentRemaining <= 0.75 && !warnings.seventyFivePercent) {
    setWarnings(prev => ({ ...prev, seventyFivePercent: true }))
    onWarning?.('75%', remaining)
  }
  
  if (percentRemaining <= 0.10 && !warnings.tenPercent) {
    setWarnings(prev => ({ ...prev, tenPercent: true }))
    onWarning?.('10%', remaining)
  }
  
  if (remaining === 60 && !warnings.oneMinute) {
    setWarnings(prev => ({ ...prev, oneMinute: true }))
    onWarning?.('1min', remaining)
  }
}, [remaining])
```

TimerWarnings component:
```tsx
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {warning75 && `${formatTime(timeRemaining)} remaining`}
</div>
<div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
  {warning10 && `Only ${formatTime(timeRemaining)} remaining!`}
</div>
```

Toast notifications using Sonner:
```tsx
toast.info(formatTime(timeRemaining) + ' remaining', { duration: 3000 })  // 75%
toast.warning('Only ' + formatTime(timeRemaining) + ' remaining!', { duration: 5000 })  // 10%
toast.error(formatTime(timeRemaining) + ' remaining', { duration: Infinity })  // 1 min (persistent)
```

**Testing Requirements:**

Unit tests:
- Warning thresholds trigger at correct times
- ARIA live regions update correctly
- Warnings triggered only once per threshold

E2E tests:
- Start quiz → wait for 75% threshold → toast appears
- Continue → 10% threshold → different toast appears
- Continue → 1 min → persistent warning appears
- Screen reader test → warnings announced

Accessibility tests:
- ARIA live regions have correct politeness levels
- Screen reader announces at thresholds without interrupting question
- Warnings visible to sighted users (toast) and announced to screen reader users

**Dependencies:**
- Story 15.1 (needs useQuizTimer)
- Story 15.2 (warnings based on adjusted time)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Toast notification styling (subtle for 75%, prominent for 10%, urgent for 1 min)
- Toast auto-dismiss timing (3s, 5s, persistent)
- ARIA live region announcements (not disruptive)

---

### Story 15.4: Provide Immediate Explanatory Feedback per Question

As a learner,
I want to see immediate feedback after answering each question,
So that I can learn from my mistakes right away.

**Acceptance Criteria:**

**Given** I answer a question correctly
**When** I select the correct answer
**Then** I see a green checkmark icon with "Correct!" message
**And** I see the explanation for why this answer is correct
**And** the explanation helps reinforce my understanding

**Given** I answer a question incorrectly
**When** I select an incorrect answer
**Then** I see an orange "Not quite" icon (not a red X - non-judgmental)
**And** I see an explanation of why my answer is incorrect
**And** I see an explanation of why the correct answer is right
**And** the correct answer is highlighted or indicated

**Given** I receive partial credit (Multiple Select)
**When** I submit a partially correct answer
**Then** I see how many I got correct (e.g., "2 of 3 correct")
**And** I see which selections were correct and which were incorrect
**And** I see an explanation for the overall question

**Given** feedback is displayed
**When** viewing the feedback component
**Then** it appears immediately after I answer (no loading delay)
**And** it does NOT block me from continuing to the next question
**And** I can dismiss it by clicking "Next Question" or navigating away

**Technical Details:**

Files to create:
- `src/app/components/quiz/AnswerFeedback.tsx`

Files to modify:
- `src/app/pages/Quiz.tsx` (display feedback after answer submission)
- `src/stores/useQuizStore.ts` (calculate feedback data)

AnswerFeedback component:
```tsx
<Card className={cn(
  "mt-4 p-4 border-l-4",
  isCorrect ? "border-l-green-500 bg-green-50" : "border-l-orange-500 bg-orange-50"
)}>
  <div className="flex items-start gap-3">
    {isCorrect ? (
      <CheckCircle className="h-6 w-6 text-green-600" />
    ) : (
      <AlertCircle className="h-6 w-6 text-orange-600" />
    )}
    <div className="flex-1">
      <h4 className="font-semibold text-lg">
        {isCorrect ? 'Correct!' : 'Not quite'}
      </h4>
      <p className="text-sm text-gray-700 mt-2">
        <ReactMarkdown>{explanation}</ReactMarkdown>
      </p>
      {!isCorrect && (
        <p className="text-sm text-gray-700 mt-2">
          <strong>Correct answer:</strong> {correctAnswer}
        </p>
      )}
      {pointsEarned < pointsPossible && (
        <p className="text-sm text-gray-600 mt-2">
          You earned {pointsEarned} of {pointsPossible} points.
        </p>
      )}
    </div>
  </div>
</Card>
```

**Testing Requirements:**

Unit tests:
- AnswerFeedback renders correct/incorrect states
- Explanation text displays from question data
- Partial credit points displayed correctly

E2E tests:
- Answer correctly → green feedback with explanation
- Answer incorrectly → orange feedback with correct answer
- Answer partially correct (MS) → points earned shown

Accessibility tests:
- Feedback announced via ARIA live region
- Color not sole indicator (icon + text)
- Keyboard can dismiss or navigate to next question

**Dependencies:**
- Story 12.5 (needs question answering flow)
- Story 12.6 (needs scoring for feedback data)
- Story 14.2 (needs partial credit for MS questions)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Feedback card styling (green for correct, orange for incorrect)
- Border and background color contrast
- Icon choice (checkmark, alert circle)
- Explanation text readability
- Non-judgmental tone ("Not quite" vs "Wrong" or "Incorrect")

---

### Story 15.5: Display Performance Summary After Quiz

As a learner,
I want to see a detailed performance summary after completing a quiz,
So that I understand my strengths and areas for improvement.

**Acceptance Criteria:**

**Given** I complete a quiz
**When** I view the results screen
**Then** I see my overall score prominently (percentage and points)
**And** I see a breakdown of questions by correctness: "10 correct, 2 incorrect, 0 skipped"
**And** I see my strongest topic areas highlighted (e.g., "Arrays & Loops: 100%")
**And** I see growth opportunity topics highlighted (e.g., "Functions: 50%")

**Given** the performance summary identifies topics
**When** questions are tagged with topics (e.g., "arrays", "functions", "objects")
**Then** the summary groups my performance by topic
**And** shows percentage correct per topic
**And** ranks topics from strongest to weakest

**Given** I want to understand my performance
**When** viewing the summary
**Then** I see an encouraging message based on my score:
  - ≥90%: "Excellent work! You've mastered this material."
  - 70-89%: "Great job! You're on the right track."
  - 50-69%: "Good effort! Review the growth areas below."
  - <50%: "Keep practicing! Focus on the topics below."

**Given** the summary displays growth areas
**When** I see "Growth Opportunities"
**Then** it lists 1-3 specific topics where I scored <70%
**And** it suggests actions: "Review questions 3, 7, 11 on Functions"

**Technical Details:**

Files to create:
- `src/app/components/quiz/PerformanceInsights.tsx`

Files to modify:
- `src/app/pages/QuizResults.tsx` (integrate insights)
- `src/lib/analytics.ts` (add topic analysis function)

PerformanceInsights component:
```tsx
<div className="space-y-6">
  <div>
    <h3 className="text-lg font-semibold text-green-700">Your Strengths</h3>
    <ul className="mt-2 space-y-1">
      {strengths.map(topic => (
        <li key={topic.name} className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span>{topic.name}: {topic.percentage}%</span>
        </li>
      ))}
    </ul>
  </div>
  
  {growthAreas.length > 0 && (
    <div>
      <h3 className="text-lg font-semibold text-orange-700">Growth Opportunities</h3>
      <ul className="mt-2 space-y-2">
        {growthAreas.map(topic => (
          <li key={topic.name}>
            <span className="font-medium">{topic.name}: {topic.percentage}%</span>
            <p className="text-sm text-gray-600">Review questions {topic.questionNumbers.join(', ')}</p>
          </li>
        ))}
      </ul>
    </div>
  )}
</div>
```

Topic analysis (src/lib/analytics.ts):
```typescript
export function analyzeTopicPerformance(
  questions: Question[],
  answers: Answer[]
): { strengths: Topic[], growthAreas: Topic[] } {
  // Group questions by topic (assume questions have a 'topic' or 'tags' property)
  const topicScores = new Map<string, { correct: number, total: number, questionNumbers: number[] }>()
  
  questions.forEach((q, index) => {
    const topic = q.topic || 'General'
    const answer = answers.find(a => a.questionId === q.id)
    const isCorrect = answer?.isCorrect || false
    
    if (!topicScores.has(topic)) {
      topicScores.set(topic, { correct: 0, total: 0, questionNumbers: [] })
    }
    
    const score = topicScores.get(topic)!
    score.total++
    if (isCorrect) score.correct++
    score.questionNumbers.push(index + 1)
  })
  
  // Calculate percentages and categorize
  const topics = Array.from(topicScores.entries()).map(([name, score]) => ({
    name,
    percentage: Math.round((score.correct / score.total) * 100),
    questionNumbers: score.questionNumbers
  }))
  
  const strengths = topics.filter(t => t.percentage >= 70).sort((a, b) => b.percentage - a.percentage)
  const growthAreas = topics.filter(t => t.percentage < 70).sort((a, b) => a.percentage - b.percentage)
  
  return { strengths, growthAreas }
}
```

**Testing Requirements:**

Unit tests:
- analyzeTopicPerformance groups questions correctly
- Strengths and growth areas categorized correctly
- Encouraging messages based on score ranges

E2E tests:
- Complete quiz with mixed performance → see strengths and growth areas
- Complete quiz with perfect score → see all strengths, no growth areas
- Complete quiz with low score → see growth areas with question numbers

Accessibility tests:
- Headings have proper hierarchy (h3 for sections)
- List semantics for topics
- Color not sole indicator (icons + text)

**Dependencies:**
- Story 12.6 (needs QuizResults page)
- Story 15.4 (needs per-question correctness data)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Section headings (Strengths vs Growth Opportunities)
- Encouraging message tone and placement
- Topic list styling and icons
- Question number references (clickable to review?)

---

### Story 15.6: Track Time-to-Completion for Each Attempt

As a learner,
I want to see how long I spent on each quiz attempt,
So that I can understand my pacing and efficiency improvements.

**Acceptance Criteria:**

**Given** I start a quiz
**When** the quiz initializes
**Then** the start time is recorded (ISO 8601 timestamp)

**Given** I complete a quiz
**When** I submit the quiz
**Then** the completion time is recorded
**And** the time spent is calculated as (completion time - start time)
**And** the time spent is stored in the QuizAttempt record in seconds

**Given** I view the quiz results screen
**When** the results load
**Then** I see my time-to-completion displayed in a human-readable format (e.g., "8m 32s" or "1h 15m 45s")
**And** the time display is prominent but not overwhelming

**Given** I have multiple attempts on the same quiz
**When** I view my attempt history
**Then** I see the time spent for each attempt
**And** I can compare my speed across attempts (e.g., "Previous: 10m 15s, Current: 8m 32s")

**Given** I paused the quiz or switched tabs
**When** calculating time-to-completion
**Then** only active time is counted (based on timer state if timed)
**Or** total elapsed time is counted if untimed (including pauses)

**Technical Details:**

Files to modify:
- `src/stores/useQuizStore.ts` (track start/completion times)
- `src/app/components/quiz/ScoreSummary.tsx` (display time)
- `src/types/quiz.ts` (ensure QuizAttempt has startedAt and timeSpent)

Time tracking in useQuizStore:
```typescript
startQuiz: async (quizId) => {
  // ... existing logic
  const progress: QuizProgress = {
    quizId,
    currentQuestionIndex: 0,
    answers: [],
    startTime: new Date().toISOString(),  // Record start
    timeRemaining: quiz.timeLimit ? quiz.timeLimit * 60 : undefined,
    isPaused: false
  }
  set({ currentProgress: progress })
},

submitQuiz: async () => {
  const { currentProgress } = get()
  const timeSpent = Math.floor(
    (Date.now() - new Date(currentProgress!.startTime).getTime()) / 1000
  )
  
  const attempt: QuizAttempt = {
    // ... existing fields
    timeSpent,
    startedAt: currentProgress!.startTime,
    completedAt: new Date().toISOString()
  }
  // ... persist to Dexie
}
```

Time display formatting:
```typescript
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  } else {
    return `${secs}s`
  }
}
```

**Testing Requirements:**

Unit tests:
- Time calculation accuracy (start to completion)
- formatDuration handles various time ranges correctly

E2E tests:
- Complete quiz → see time-to-completion on results
- Wait 2 minutes during quiz → time accurately reflects delay

**Dependencies:**
- Story 12.3 (needs useQuizStore)
- Story 12.6 (needs QuizResults page)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Time display formatting and placement
- Comparison to previous attempts (if applicable)
- Typography for time value (consider monospace for consistency)

---

## Epic 16: Review Performance and Track Improvement

**Goal:** Learners can review quiz results, see detailed performance summaries, track score improvement across attempts, and visualize learning trajectories.

**Technical Focus:** This epic implements attempt history retrieval, score improvement calculations, normalized gain (Hake's formula), and trajectory visualization.

### Story 16.1: Review All Questions and Answers After Completion

As a learner,
I want to review all quiz questions with correct answers after completion,
So that I can learn from my mistakes and understand the material better.

**Acceptance Criteria:**

**Given** I complete a quiz
**When** I click "Review Answers" on the results screen
**Then** I navigate to a review mode showing all questions sequentially
**And** each question displays my answer and the correct answer
**And** I see whether I got each question right or wrong (color-coded)

**Given** I am in review mode
**When** viewing a question
**Then** I see the full question text and all answer options
**And** my selected answer is highlighted in blue
**And** the correct answer is highlighted in green (if I was incorrect)
**And** I see the explanation for the correct answer

**Given** I want to navigate through reviewed questions
**When** in review mode
**Then** I can use "Previous" and "Next" buttons to navigate
**And** I can jump to any question via the question grid
**And** the grid shows correct (green checkmark) and incorrect (orange dot) indicators

**Given** I finish reviewing all questions
**When** I reach the end
**Then** I see a "Back to Results" button
**And** clicking it returns me to the results summary page

**Technical Details:**

Files to create:
- `src/app/pages/QuizReview.tsx` (review mode page)
- `src/app/components/quiz/QuizReview.tsx` (reviewed question display)

Files to modify:
- `src/app/routes.tsx` (add review route)
- `src/app/pages/QuizResults.tsx` (add "Review Answers" button)

Review route:
```typescript
{
  path: '/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId',
  element: <QuizReview />
}
```

QuizReview component structure:
```tsx
<div className="space-y-6">
  <QuizHeader quiz={quiz} currentIndex={currentIndex} showTimer={false} />
  
  <Card>
    <QuestionDisplay question={currentQuestion} value={userAnswer} readOnly />
    
    <div className="mt-4 space-y-2">
      <div className={cn(
        "p-3 rounded-lg",
        isCorrect ? "bg-green-100" : "bg-orange-100"
      )}>
        <strong>Your answer:</strong> {userAnswer}
        {!isCorrect && (
          <div className="mt-2">
            <strong>Correct answer:</strong> {correctAnswer}
          </div>
        )}
      </div>
      
      <div className="p-3 bg-gray-50 rounded-lg">
        <strong>Explanation:</strong>
        <ReactMarkdown>{currentQuestion.explanation}</ReactMarkdown>
      </div>
    </div>
  </Card>
  
  <QuizActions onPrevious={handlePrevious} onNext={handleNext} />
</div>
```

**Testing Requirements:**

Unit tests:
- QuizReview loads attempt data correctly
- Correct/incorrect highlighting applied correctly

E2E tests:
- Click "Review Answers" → navigate to review mode
- Navigate through questions → see answers and explanations
- Click "Back to Results" → return to results page

Accessibility tests:
- Review mode keyboard navigable
- Color coding supplemented with icons/text
- Screen reader announces correct/incorrect status

**Dependencies:**
- Story 12.6 (needs QuizResults page)
- Story 15.4 (needs explanations)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Answer highlighting (user answer vs correct answer)
- Explanation display clarity
- Navigation between reviewed questions
- Read-only question display (no interaction needed)

---

### Story 16.2: Display Score History Across All Attempts

As a learner,
I want to see my score history for all quiz attempts,
So that I can track my improvement over time.

**Acceptance Criteria:**

**Given** I have completed a quiz multiple times
**When** I view the quiz results screen
**Then** I see a "View Attempt History" link or button
**And** clicking it expands a section showing all my past attempts

**Given** the attempt history is displayed
**When** viewing the list
**Then** I see each attempt with: attempt number, date/time, score percentage, time spent, passed/failed status
**And** attempts are sorted by date (most recent first)
**And** the current attempt is highlighted or marked as "Current"

**Given** I want to review a past attempt
**When** I click on any attempt in the history
**Then** I navigate to the review mode for that specific attempt
**And** I see the questions/answers from that attempt (not current)

**Technical Details:**

Files to create:
- `src/app/components/quiz/AttemptHistory.tsx`

Files to modify:
- `src/app/pages/QuizResults.tsx` (integrate attempt history)
- `src/stores/useQuizStore.ts` (add loadAttempts action if not present)

AttemptHistory component:
```tsx
<Collapsible>
  <CollapsibleTrigger asChild>
    <Button variant="link">View Attempt History ({attempts.length} attempts)</Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Attempt</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {attempts.map((attempt, index) => (
          <TableRow key={attempt.id} className={attempt.id === currentAttemptId ? 'bg-blue-50' : ''}>
            <TableCell>#{attempts.length - index}</TableCell>
            <TableCell>{formatDate(attempt.completedAt)}</TableCell>
            <TableCell>{attempt.percentage}%</TableCell>
            <TableCell>{formatDuration(attempt.timeSpent)}</TableCell>
            <TableCell>
              {attempt.passed ? (
                <Badge variant="success">Passed</Badge>
              ) : (
                <Badge variant="secondary">Not Passed</Badge>
              )}
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="sm" onClick={() => reviewAttempt(attempt.id)}>
                Review
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CollapsibleContent>
</Collapsible>
```

useQuizStore.loadAttempts:
```typescript
loadAttempts: async (quizId: string) => {
  const attempts = await db.quizAttempts
    .where('quizId').equals(quizId)
    .reverse()  // Most recent first
    .sortBy('completedAt')
  
  set({ attempts })
}
```

**Testing Requirements:**

Unit tests:
- loadAttempts retrieves attempts sorted correctly
- Attempt table renders all attempt data

E2E tests:
- Complete quiz 3 times → click "View Attempt History" → see 3 attempts
- Click "Review" on past attempt → see that attempt's Q&A

Accessibility tests:
- Table has proper headers
- Collapsible toggle keyboard accessible
- Screen reader announces table structure

**Dependencies:**
- Story 12.2 (needs quizAttempts table)
- Story 12.6 (needs QuizResults page)
- Story 16.1 (review past attempts)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Table layout and responsive design
- Collapsible expand/collapse interaction
- Current attempt highlighting
- Badge styling for passed/not passed

---

### Story 16.3: Calculate and Display Score Improvement

As a learner,
I want to see how much my score improved between attempts,
So that I can measure my learning progress.

**Acceptance Criteria:**

**Given** I have taken a quiz multiple times
**When** I view my current attempt results
**Then** I see a comparison to my first attempt:
  - "First attempt: 60%"
  - "Current attempt: 85%"
  - "Improvement: +25%"

**Given** my current score is higher than my previous best
**When** viewing the improvement
**Then** the improvement is displayed in green with a positive indicator (+25%)
**And** I see an encouraging message: "New personal best!"

**Given** my current score is lower than my previous best
**When** viewing the comparison
**Then** I see my best score: "Your best: 90% (attempt #3)"
**And** I see the current score: "Current: 75%"
**And** there is NO negative messaging (no "You did worse" or red colors)
**And** I see neutral encouragement: "Keep practicing to beat your best!"

**Given** this is my first attempt
**When** viewing the results
**Then** no comparison is shown (nothing to compare against)
**And** I see a message: "First attempt complete! Retake to track improvement."

**Technical Details:**

Files to modify:
- `src/app/components/quiz/ScoreSummary.tsx` (add improvement display)
- `src/lib/analytics.ts` (add improvement calculation function)

Improvement calculation:
```typescript
export function calculateImprovement(attempts: QuizAttempt[]): {
  firstScore: number | null
  bestScore: number | null
  currentScore: number
  improvement: number | null
  isNewBest: boolean
} {
  if (attempts.length === 0) return { firstScore: null, bestScore: null, currentScore: 0, improvement: null, isNewBest: false }
  
  const sortedByDate = [...attempts].sort((a, b) => 
    new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )
  
  const firstAttempt = sortedByDate[0]
  const currentAttempt = sortedByDate[sortedByDate.length - 1]
  const bestAttempt = attempts.reduce((best, current) => 
    current.percentage > best.percentage ? current : best
  )
  
  const improvement = currentAttempt.percentage - firstAttempt.percentage
  const isNewBest = currentAttempt.percentage >= bestAttempt.percentage
  
  return {
    firstScore: firstAttempt.percentage,
    bestScore: bestAttempt.percentage,
    currentScore: currentAttempt.percentage,
    improvement,
    isNewBest
  }
}
```

ScoreSummary improvement display:
```tsx
{attempts.length > 1 && (
  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
    <h4 className="font-semibold text-sm text-gray-700">Progress</h4>
    <div className="mt-2 space-y-1 text-sm">
      <div>First attempt: {improvement.firstScore}%</div>
      <div>Current attempt: {improvement.currentScore}%</div>
      <div className={improvement.improvement > 0 ? "text-green-600 font-semibold" : "text-gray-600"}>
        {improvement.improvement > 0 && '+'}{improvement.improvement}%
      </div>
      {improvement.isNewBest && (
        <div className="text-green-600 font-semibold">🎉 New personal best!</div>
      )}
    </div>
  </div>
)}
```

**Testing Requirements:**

Unit tests:
- calculateImprovement with various attempt histories
- Handles first attempt (no comparison)
- Correctly identifies new personal best

E2E tests:
- First attempt → no improvement shown
- Second attempt with improvement → see +X%
- Third attempt as new best → see "New personal best!"
- Attempt lower than best → see neutral message

**Dependencies:**
- Story 16.2 (needs attempt history)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Improvement percentage styling (green for positive, neutral for negative)
- "New personal best" celebration (not over-the-top)
- Layout within results summary
- Encouraging, non-judgmental tone

---

### Story 16.4: Calculate Normalized Gain (Hake's Formula)

As a learner,
I want to see my normalized learning gain,
So that I understand my learning efficiency beyond just raw score improvement.

**Acceptance Criteria:**

**Given** I have multiple quiz attempts
**When** viewing my improvement metrics
**Then** I see my normalized gain calculated using Hake's formula:
  - Formula: (final score - initial score) / (100 - initial score)
  - Example: (85 - 60) / (100 - 60) = 25 / 40 = 0.625 (62.5% gain)

**Given** my normalized gain is calculated
**When** displayed to the learner
**Then** I see it as a percentage with interpretation:
  - <0.3 (30%): "Low gain" (neutral tone)
  - 0.3-0.7 (30-70%): "Medium gain" (positive tone)
  - >0.7 (70%): "High gain" (very positive tone)

**Given** my initial score was very high (e.g., 95%)
**When** calculating normalized gain
**Then** the denominator is small (100 - 95 = 5)
**And** even small improvements result in high normalized gain (correct behavior - little room for improvement)

**Given** this is my first attempt or only one attempt
**When** viewing normalized gain
**Then** it is not displayed (requires at least 2 attempts)

**Technical Details:**

Files to modify:
- `src/lib/analytics.ts` (add normalizedGain calculation)
- `src/app/components/quiz/ScoreSummary.tsx` (display normalized gain)

Normalized gain calculation:
```typescript
export function calculateNormalizedGain(
  initialScore: number,
  finalScore: number
): number | null {
  if (initialScore >= 100) return null  // Already perfect, no room for improvement
  
  const actualGain = finalScore - initialScore
  const possibleGain = 100 - initialScore
  
  return actualGain / possibleGain
}

export function interpretNormalizedGain(gain: number): {
  level: 'low' | 'medium' | 'high'
  message: string
  color: string
} {
  if (gain < 0.3) {
    return {
      level: 'low',
      message: 'You\'re making progress. Keep practicing!',
      color: 'text-gray-700'
    }
  } else if (gain < 0.7) {
    return {
      level: 'medium',
      message: 'Good learning progress!',
      color: 'text-blue-700'
    }
  } else {
    return {
      level: 'high',
      message: 'Excellent learning efficiency!',
      color: 'text-green-700'
    }
  }
}
```

Display in ScoreSummary:
```tsx
{normalizedGain !== null && (
  <div className="mt-2">
    <span className="text-sm text-gray-600">Normalized Gain: </span>
    <span className={cn("font-semibold", interpretation.color)}>
      {Math.round(normalizedGain * 100)}%
    </span>
    <p className="text-sm text-gray-600 mt-1">{interpretation.message}</p>
  </div>
)}
```

**Testing Requirements:**

Unit tests:
- calculateNormalizedGain with various score pairs
- Edge cases: initial=100, final < initial (negative gain)
- interpretNormalizedGain categories correct

E2E tests:
- Complete quiz twice → see normalized gain displayed
- High initial score → correct gain calculation

**Dependencies:**
- Story 16.2 (needs attempt history)
- Story 16.3 (extends improvement calculations)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Normalized gain percentage display
- Interpretation message tone (educational, encouraging)
- Tooltip explaining Hake's formula (optional)

---

## Epic 17: Analyze Quiz Data and Patterns

**Goal:** Learners can see detailed analytics including completion rates, retake frequency, time metrics, learning patterns, item difficulty, and discrimination indices.

**Technical Focus:** This epic implements psychometric calculations (P-values, discrimination indices), trajectory pattern detection, and analytics visualization.

### Story 17.1: Track and Display Quiz Completion Rate

As a learner,
I want to see my quiz completion rate,
So that I can understand how often I finish quizzes I start.

**Acceptance Criteria:**

**Given** I have started and completed multiple quizzes
**When** I view the analytics or reports section
**Then** I see my overall quiz completion rate as a percentage
**And** the calculation is: (completed quizzes / started quizzes) * 100

**Given** I have started a quiz but not completed it
**When** that quiz is still in progress (currentProgress exists in localStorage)
**Then** it counts as "started" but not "completed"

**Given** I have completed a quiz multiple times
**When** calculating completion rate
**Then** each attempt counts separately (3 attempts = 3 completions)

**Given** the completion rate is displayed
**When** viewing the metric
**Then** I see a visual indicator (progress bar or circular progress)
**And** I see the raw numbers (e.g., "12 of 15 started quizzes completed")

**Technical Details:**

Files to create:
- `src/lib/analytics.ts` (add completion rate function)

Files to modify:
- `src/app/pages/Reports.tsx` (display completion rate)

Completion rate calculation:
```typescript
export async function calculateCompletionRate(): Promise<{
  completionRate: number
  completedCount: number
  startedCount: number
}> {
  // Get all quizzes that have at least one attempt
  const allAttempts = await db.quizAttempts.toArray()
  const completedCount = allAttempts.length
  
  // Estimate started count: completed + in-progress (from localStorage)
  const inProgressCount = localStorage.getItem('levelup-quiz-store') ? 1 : 0
  const startedCount = completedCount + inProgressCount
  
  const completionRate = startedCount > 0 ? (completedCount / startedCount) * 100 : 0
  
  return { completionRate, completedCount, startedCount }
}
```

Display in Reports page:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Quiz Completion Rate</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-4">
      <Progress value={completionRate} className="flex-1" />
      <span className="text-2xl font-bold">{Math.round(completionRate)}%</span>
    </div>
    <p className="text-sm text-gray-600 mt-2">
      {completedCount} of {startedCount} started quizzes completed
    </p>
  </CardContent>
</Card>
```

**Testing Requirements:**

Unit tests:
- calculateCompletionRate with various attempt counts
- Handles zero attempts (0%)
- In-progress quiz counted in started

E2E tests:
- Complete 3 quizzes, start 1 → completion rate 75%
- View in Reports section → see metric displayed

**Dependencies:**
- Story 12.2 (needs quizAttempts table)
- Story 12.3 (needs localStorage quiz state)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Progress bar styling
- Percentage display size and emphasis
- Raw numbers clarity

---

### Story 17.2: Track Average Retake Frequency

As a learner,
I want to see how often I retake quizzes on average,
So that I can understand my learning persistence.

**Acceptance Criteria:**

**Given** I have completed multiple quizzes
**When** I view the analytics section
**Then** I see my average retake frequency per quiz
**And** the calculation is: total attempts / unique quizzes

**Given** I completed Quiz A 3 times and Quiz B 2 times
**When** calculating average retake frequency
**Then** the result is (3 + 2) / 2 = 2.5 attempts per quiz

**Given** the retake frequency is displayed
**When** viewing the metric
**Then** I see it rounded to 1 decimal place (e.g., "2.5 attempts per quiz")
**And** I see an interpretation: "You retake quizzes 2-3 times on average for mastery."

**Technical Details:**

Files to modify:
- `src/lib/analytics.ts` (add retake frequency function)
- `src/app/pages/Reports.tsx` (display retake frequency)

Retake frequency calculation:
```typescript
export async function calculateRetakeFrequency(): Promise<{
  averageRetakes: number
  totalAttempts: number
  uniqueQuizzes: number
}> {
  const allAttempts = await db.quizAttempts.toArray()
  const uniqueQuizIds = new Set(allAttempts.map(a => a.quizId))
  
  const totalAttempts = allAttempts.length
  const uniqueQuizzes = uniqueQuizIds.size
  const averageRetakes = uniqueQuizzes > 0 ? totalAttempts / uniqueQuizzes : 0
  
  return { averageRetakes, totalAttempts, uniqueQuizzes }
}
```

**Testing Requirements:**

Unit tests:
- calculateRetakeFrequency with various attempt distributions
- Handles single quiz with multiple attempts
- Zero attempts returns 0

E2E tests:
- Complete same quiz 3 times → retake frequency = 3.0
- Complete 2 different quizzes → retake frequency = 1.0

**Dependencies:**
- Story 12.2 (needs quizAttempts table)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Metric display (number + interpretation)
- Encouraging tone for retakes (persistence is good!)

---

### Story 17.3: Calculate Item Difficulty (P-Values)

As a learner,
I want to see which quiz questions are easiest and hardest based on my performance,
So that I can understand which concepts need more practice.

**Acceptance Criteria:**

**Given** I have completed a quiz multiple times
**When** viewing the quiz analytics
**Then** I see a list of questions ranked by difficulty (easiest to hardest)
**And** each question shows its P-value (proportion of attempts where I answered correctly)

**Given** a question's P-value is calculated
**When** I answered it correctly 3 out of 4 times
**Then** the P-value is 0.75 (75% - relatively easy for me)

**Given** the questions are categorized by difficulty
**When** viewing the list
**Then** I see difficulty labels:
  - P > 0.8: "Easy"
  - 0.5 ≤ P ≤ 0.8: "Medium"
  - P < 0.5: "Difficult"

**Given** I view difficult questions (P < 0.5)
**When** the analytics display
**Then** I see suggestions: "Review questions 3, 7 on [topic] - you answer correctly only 40% of the time."

**Technical Details:**

Files to create:
- `src/app/components/quiz/ItemDifficultyAnalysis.tsx`

Files to modify:
- `src/lib/analytics.ts` (add item difficulty function)
- `src/app/pages/QuizResults.tsx` or Reports page (display analysis)

Item difficulty calculation:
```typescript
export function calculateItemDifficulty(
  quiz: Quiz,
  attempts: QuizAttempt[]
): Array<{ questionId: string, questionText: string, pValue: number, difficulty: string }> {
  const questionStats = new Map<string, { correct: number, total: number }>()
  
  // Aggregate across all attempts
  attempts.forEach(attempt => {
    attempt.answers.forEach(answer => {
      if (!questionStats.has(answer.questionId)) {
        questionStats.set(answer.questionId, { correct: 0, total: 0 })
      }
      const stats = questionStats.get(answer.questionId)!
      stats.total++
      if (answer.isCorrect) stats.correct++
    })
  })
  
  // Calculate P-values
  return quiz.questions.map(q => {
    const stats = questionStats.get(q.id) || { correct: 0, total: 0 }
    const pValue = stats.total > 0 ? stats.correct / stats.total : 0
    
    let difficulty = 'Medium'
    if (pValue > 0.8) difficulty = 'Easy'
    else if (pValue < 0.5) difficulty = 'Difficult'
    
    return {
      questionId: q.id,
      questionText: q.text,
      pValue,
      difficulty
    }
  }).sort((a, b) => b.pValue - a.pValue)  // Easiest first
}
```

**Testing Requirements:**

Unit tests:
- calculateItemDifficulty with various attempt patterns
- P-value calculation accuracy
- Difficulty categorization correct

E2E tests:
- Complete quiz 3 times with varied performance → see item difficulty analysis

**Dependencies:**
- Story 16.2 (needs attempt history)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Question list layout (truncate long question text)
- P-value display (percentage or decimal?)
- Difficulty label styling (color-coded?)

---

### Story 17.4: Calculate Discrimination Indices

As a learner,
I want to see which questions effectively distinguish between my strong and weak attempts,
So that I can understand which questions are most indicative of my knowledge.

**Acceptance Criteria:**

**Given** I have multiple attempts on a quiz
**When** calculating discrimination for each question
**Then** the system uses point-biserial correlation between question correctness and total score

**Given** a question is highly discriminating
**When** viewing its discrimination index
**Then** I see a high value (>0.3)
**And** this indicates: "You tend to get this question right on high-scoring attempts and wrong on low-scoring attempts."

**Given** a question has low discrimination (<0.2)
**When** viewing the metric
**Then** I see an indicator: "This question doesn't correlate well with overall performance - might be ambiguous or overly easy/hard."

**Technical Details:**

Files to modify:
- `src/lib/analytics.ts` (add discrimination calculation)

Discrimination calculation (point-biserial correlation):
```typescript
export function calculateDiscriminationIndices(
  quiz: Quiz,
  attempts: QuizAttempt[]
): Array<{ questionId: string, discriminationIndex: number }> {
  // For each question, calculate correlation between:
  // X = question correctness (0 or 1)
  // Y = total quiz score
  
  return quiz.questions.map(q => {
    const dataPoints = attempts.map(attempt => {
      const answer = attempt.answers.find(a => a.questionId === q.id)
      const questionCorrect = answer?.isCorrect ? 1 : 0
      const totalScore = attempt.score
      
      return { x: questionCorrect, y: totalScore }
    })
    
    // Point-biserial correlation formula
    const n = dataPoints.length
    if (n < 2) return { questionId: q.id, discriminationIndex: 0 }
    
    const group1 = dataPoints.filter(d => d.x === 1).map(d => d.y)  // Correct
    const group0 = dataPoints.filter(d => d.x === 0).map(d => d.y)  // Incorrect
    
    if (group1.length === 0 || group0.length === 0) {
      return { questionId: q.id, discriminationIndex: 0 }
    }
    
    const mean1 = group1.reduce((sum, val) => sum + val, 0) / group1.length
    const mean0 = group0.reduce((sum, val) => sum + val, 0) / group0.length
    
    // Standard deviation of all scores
    const allScores = dataPoints.map(d => d.y)
    const meanAll = allScores.reduce((sum, val) => sum + val, 0) / allScores.length
    const variance = allScores.reduce((sum, val) => sum + Math.pow(val - meanAll, 2), 0) / n
    const sd = Math.sqrt(variance)
    
    // Point-biserial formula
    const p = group1.length / n
    const q = 1 - p
    const rpb = ((mean1 - mean0) / sd) * Math.sqrt(p * q)
    
    return { questionId: q.id, discriminationIndex: rpb }
  })
}
```

**Testing Requirements:**

Unit tests:
- calculateDiscriminationIndices with known data
- Handles edge cases (all correct, all incorrect)

**Dependencies:**
- Story 16.2 (needs attempt history)
- Story 17.3 (extends item analysis)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Discrimination index display (rounded to 2 decimals)
- Interpretation text (high/medium/low discrimination)

---

### Story 17.5: Identify Learning Trajectory Patterns

As a learner,
I want to see if my scores follow a linear, exponential, or logarithmic improvement pattern,
So that I can understand my learning curve.

**Acceptance Criteria:**

**Given** I have 3+ attempts on a quiz
**When** viewing the improvement visualization
**Then** I see a line chart with attempt number (x-axis) vs. score (y-axis)
**And** I see a detected pattern label: "Linear growth", "Exponential growth", or "Logarithmic growth"

**Given** my scores improve rapidly at first then plateau (e.g., 50%, 70%, 80%, 82%)
**When** the pattern is detected
**Then** it is labeled "Logarithmic - Strong early gains, then plateauing"

**Given** my scores improve steadily (e.g., 60%, 70%, 80%, 90%)
**When** the pattern is detected
**Then** it is labeled "Linear - Consistent improvement"

**Given** my scores improve slowly then rapidly (e.g., 60%, 62%, 68%, 85%)
**When** the pattern is detected
**Then** it is labeled "Exponential - Accelerating mastery"

**Technical Details:**

Files to create:
- `src/app/components/quiz/ImprovementChart.tsx` (visualization)

Files to modify:
- `src/lib/analytics.ts` (add pattern detection)

Pattern detection:
```typescript
export function detectLearningTrajectory(
  attempts: QuizAttempt[]
): { pattern: 'linear' | 'exponential' | 'logarithmic', confidence: number } {
  if (attempts.length < 3) return { pattern: 'linear', confidence: 0 }
  
  const sortedAttempts = [...attempts].sort((a, b) => 
    new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )
  
  const scores = sortedAttempts.map(a => a.percentage)
  const n = scores.length
  
  // Fit three models and calculate R² for each
  // Linear: y = mx + b
  // Exponential: y = a * e^(bx)
  // Logarithmic: y = a + b * ln(x)
  
  // Simplified: calculate rate of change between consecutive attempts
  const changes = []
  for (let i = 1; i < n; i++) {
    changes.push(scores[i] - scores[i-1])
  }
  
  // If changes are relatively constant: Linear
  // If changes are increasing: Exponential
  // If changes are decreasing: Logarithmic
  
  const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length
  const variance = changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length
  
  if (variance < 5) {
    return { pattern: 'linear', confidence: 0.8 }
  }
  
  // Check if changes are trending up or down
  const firstHalfAvg = changes.slice(0, Math.floor(changes.length / 2)).reduce((sum, c) => sum + c, 0) / Math.floor(changes.length / 2)
  const secondHalfAvg = changes.slice(Math.floor(changes.length / 2)).reduce((sum, c) => sum + c, 0) / Math.ceil(changes.length / 2)
  
  if (secondHalfAvg > firstHalfAvg) {
    return { pattern: 'exponential', confidence: 0.7 }
  } else {
    return { pattern: 'logarithmic', confidence: 0.7 }
  }
}
```

Chart visualization (using recharts):
```tsx
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={chartData}>
    <XAxis dataKey="attempt" label={{ value: 'Attempt', position: 'insideBottom' }} />
    <YAxis label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }} />
    <Tooltip />
    <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} />
  </LineChart>
</ResponsiveContainer>
```

**Testing Requirements:**

Unit tests:
- detectLearningTrajectory with known patterns
- Pattern classification accuracy

E2E tests:
- Complete quiz 5 times with improving scores → see trajectory chart and pattern label

**Dependencies:**
- Story 16.2 (needs attempt history)
- Story 16.3 (improvement calculations)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Chart styling and responsiveness
- Pattern label placement and clarity
- Axis labels and legend

---

## Epic 18: Accessible and Integrated Quiz Experience

**Goal:** All learners can access quiz features via keyboard and screen readers (WCAG 2.1 AA+). Quiz data integrates across the LevelUp platform.

**Technical Focus:** This epic implements comprehensive accessibility compliance and cross-platform integration points.

### Story 18.1: Implement Complete Keyboard Navigation

As a learner using only a keyboard,
I want to navigate and complete quizzes without using a mouse,
So that I can access quiz features independently.

**Acceptance Criteria:**

**Given** I am navigating the quiz using only keyboard
**When** I press Tab
**Then** focus moves sequentially through all interactive elements in logical order:
  - Question text (focusable with tabindex="-1" for screen reader navigation)
  - Answer options (radio buttons or checkboxes)
  - "Mark for Review" toggle
  - Navigation buttons (Previous, Next, Submit)
  - Question grid

**Given** I am answering a multiple choice question
**When** using keyboard controls
**Then** I can Tab to the first radio button
**And** I can use Arrow keys (Up/Down) to select different options
**And** I can press Space to select the focused option

**Given** I am answering a multiple select question
**When** using keyboard controls
**Then** I can Tab to each checkbox independently
**And** I can press Space to toggle each checkbox

**Given** I want to navigate to a specific question
**When** the question grid has focus
**Then** I can Tab to each question number
**And** I can press Enter to jump to that question

**Given** I press Escape anywhere in the quiz
**When** a modal or dialog is open
**Then** it closes and focus returns to the trigger element

**Technical Details:**

Files to modify:
- All quiz components (ensure proper tab order and keyboard handlers)
- `src/app/components/quiz/questions/*.tsx` (implement keyboard patterns)

Keyboard patterns to implement:
- Radio groups: Arrow key navigation, Space to select
- Checkboxes: Space to toggle
- Buttons: Enter or Space to activate
- Question grid: Tab + Enter
- Modal dialogs: Esc to close, focus trap while open

Focus management:
```tsx
// Focus first question on quiz start
useEffect(() => {
  if (quizStarted) {
    questionRef.current?.focus()
  }
}, [quizStarted])

// Restore focus after navigation
const handleNext = () => {
  navigateToNextQuestion()
  setTimeout(() => questionRef.current?.focus(), 0)
}
```

**Testing Requirements:**

E2E tests (keyboard only):
- Tab through entire quiz without mouse → all elements reachable
- Answer all questions using only keyboard
- Navigate with Arrow keys in radio groups
- Submit quiz using Enter key

Accessibility tests:
- Focus visible on all interactive elements (4.5:1 contrast)
- Tab order is logical (top to bottom, left to right)
- No keyboard traps (can always Tab out)

**Dependencies:**
- All previous stories (touches all quiz components)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Focus indicator visibility and styling
- Tab order logic
- Keyboard shortcuts documented (optional)

---

### Story 18.2: Implement ARIA Live Regions for Dynamic Content

As a screen reader user,
I want dynamic content updates announced automatically,
So that I'm aware of timer warnings, score calculations, and feedback without visual cues.

**Acceptance Criteria:**

**Given** I am using a screen reader
**When** I answer a question
**Then** the feedback (Correct/Incorrect) is announced immediately
**And** the announcement uses `aria-live="polite"` (doesn't interrupt current reading)

**Given** the quiz timer reaches a warning threshold
**When** the warning triggers
**Then** the time remaining is announced via `aria-live="assertive"`
**And** the announcement interrupts less important content (urgent warning)

**Given** I submit the quiz
**When** my score is calculated
**Then** the score and pass/fail status are announced
**And** the announcement uses `aria-live="polite"`

**Given** I navigate to a new question
**When** the question changes
**Then** the question number is announced (e.g., "Question 3 of 12")
**And** the question text is read by screen reader focus

**Technical Details:**

Files to modify:
- `src/app/components/quiz/AnswerFeedback.tsx` (add ARIA live for feedback)
- `src/app/components/quiz/QuizTimer.tsx` (add ARIA live for warnings)
- `src/app/components/quiz/ScoreSummary.tsx` (add ARIA live for score)
- `src/app/components/quiz/QuizHeader.tsx` (add ARIA live for navigation)

ARIA live region implementation:
```tsx
// Feedback (polite)
<div role="status" aria-live="polite" aria-atomic="true">
  {answerFeedback && `${isCorrect ? 'Correct' : 'Incorrect'}. ${explanation}`}
</div>

// Timer warnings (assertive)
<div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
  {timerWarning && `${formatTime(timeRemaining)} remaining`}
</div>

// Score announcement (polite)
<div role="status" aria-live="polite" aria-atomic="true">
  {scoreCalculated && `Quiz complete. Your score is ${percentage} percent. ${passed ? 'Passed' : 'Not passed'}.`}
</div>

// Question navigation (polite)
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {`Question ${currentIndex + 1} of ${totalQuestions}`}
</div>
```

**Testing Requirements:**

Accessibility tests (NVDA, JAWS, VoiceOver):
- Answer question → feedback announced
- Timer warning → announcement interrupts
- Submit quiz → score announced
- Navigate questions → question number announced

**Dependencies:**
- Story 15.3 (timer warnings)
- Story 15.4 (answer feedback)
- Story 12.6 (score calculation)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- ARIA live announcements not verbose (concise)
- Politeness levels appropriate (polite vs assertive)
- Screen reader only content (sr-only class)

---

### Story 18.3: Ensure Semantic HTML and Proper ARIA Attributes

As a screen reader user,
I want quiz components to use proper semantic HTML,
So that I can understand the structure and navigate efficiently.

**Acceptance Criteria:**

**Given** quiz components use form controls
**When** rendering questions
**Then** radio button groups use `<fieldset>` and `<legend>`
**And** all inputs have associated `<label>` elements
**And** related controls are grouped logically

**Given** quiz displays dynamic content
**When** content changes (feedback, score, warnings)
**Then** appropriate ARIA roles are used (`role="status"`, `role="alert"`)
**And** `aria-atomic="true"` ensures full message is read

**Given** quiz has navigation controls
**When** rendering buttons and links
**Then** all have descriptive accessible names
**And** icon-only buttons have `aria-label` (e.g., aria-label="Next question")

**Given** quiz displays timer or progress
**When** showing countdown or progress bar
**Then** `role="timer"` or `role="progressbar"` is used
**And** `aria-valuenow`, `aria-valuemin`, `aria-valuemax` are set correctly

**Technical Details:**

Files to modify:
- All question components (ensure semantic HTML)
- All quiz UI components (add proper ARIA attributes)

Semantic HTML patterns:
```tsx
// Question with radio group
<fieldset>
  <legend>{question.text}</legend>
  <div role="radiogroup" aria-labelledby="question-text">
    {options.map(option => (
      <label key={option}>
        <input type="radio" name="answer" value={option} />
        {option}
      </label>
    ))}
  </div>
</fieldset>

// Progress indicator
<div role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={totalQuestions} aria-label="Quiz progress">
  Question {currentIndex + 1} of {totalQuestions}
</div>

// Timer
<div role="timer" aria-live="off" aria-label="Time remaining">
  {formatTime(timeRemaining)}
</div>

// Icon button
<button aria-label="Next question">
  <ArrowRight aria-hidden="true" />
</button>
```

**Testing Requirements:**

Accessibility tests:
- Automated axe-core scan → zero violations
- Manual screen reader test → all controls announced correctly
- Landmark navigation → proper structure

**Dependencies:**
- All previous stories (applies to all components)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Semantic HTML structure
- ARIA attributes correctness
- Screen reader announcement quality

---

### Story 18.4: Verify Contrast Ratios and Touch Targets

As a learner with visual impairments or using a mobile device,
I want sufficient color contrast and large touch targets,
So that I can see and interact with quiz elements easily.

**Acceptance Criteria:**

**Given** any text in the quiz interface
**When** measuring contrast against background
**Then** normal text has ≥4.5:1 contrast ratio
**And** large text (≥18pt or ≥14pt bold) has ≥3:1 contrast ratio

**Given** UI components (buttons, inputs, focus indicators)
**When** measuring contrast
**Then** non-text elements have ≥3:1 contrast ratio against adjacent colors

**Given** interactive elements on mobile
**When** measuring touch target size
**Then** all buttons, links, and form controls are ≥44px tall
**And** ≥44px wide (or full width on mobile)

**Given** focus indicators on interactive elements
**When** an element receives keyboard focus
**Then** the focus indicator has ≥3:1 contrast against the background
**And** the indicator is at least 2px thick

**Technical Details:**

Manual testing and fixes:
- Use WebAIM Contrast Checker or browser DevTools
- Measure all text/background combinations
- Ensure focus indicators meet contrast requirements
- Test touch target sizes on mobile (375px viewport)

Common fixes:
```css
/* Insufficient contrast fix */
.quiz-button {
  /* Before: #999 on #fff (2.85:1) */
  /* After: #666 on #fff (5.74:1) */
  color: #666;
}

/* Focus indicator */
.quiz-button:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
  /* 2563eb (blue-600) on #fff has 8.6:1 contrast */
}

/* Touch targets */
@media (max-width: 768px) {
  .quiz-answer-option {
    min-height: 44px;
    padding: 12px 16px;
  }
}
```

**Testing Requirements:**

Accessibility tests:
- Run axe-core contrast audit → zero violations
- Manual spot checks with contrast checker
- Mobile testing (375px) → all targets ≥44px

**Dependencies:**
- All previous stories (applies to all UI components)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Text contrast (especially on colored backgrounds)
- Button/link contrast
- Focus indicator visibility
- Mobile touch target sizes

---

### Story 18.5: Integrate Quiz Completion with Study Streaks

As a learner,
I want quiz completions to count toward my study streak,
So that taking quizzes contributes to my daily learning activity.

**Acceptance Criteria:**

**Given** I complete a quiz
**When** I submit the quiz
**Then** useStreakStore is updated with today's activity
**And** my current streak continues or increments
**And** if I hadn't studied today yet, today's date is marked as active

**Given** I complete multiple quizzes in one day
**When** submitting each quiz
**Then** the streak is updated only once per day (idempotent)
**And** additional quizzes don't create duplicate streak entries

**Given** I view my streak calendar after completing a quiz
**When** the calendar displays
**Then** today's date shows as active (filled dot or color)
**And** the streak counter reflects the quiz completion

**Technical Details:**

Files to modify:
- `src/stores/useQuizStore.ts` (trigger streak update on submit)
- `src/stores/useStreakStore.ts` (ensure quiz activity counts)

Cross-store integration in useQuizStore.submitQuiz:
```typescript
submitQuiz: async () => {
  // ... existing quiz submission logic
  
  try {
    await db.quizAttempts.add(attempt)
    
    // Trigger study streak update (FR55)
    useStreakStore.getState().recordActivity('quiz', attempt.timeSpent)
    
    // ... rest of submission logic
  } catch (error) {
    // ... error handling
  }
}
```

useStreakStore.recordActivity (if not already implemented):
```typescript
recordActivity: (activityType: string, duration: number) => {
  const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD
  
  // Check if today already has activity
  const existingActivity = get().activeDays.includes(today)
  if (existingActivity) return  // Idempotent
  
  // Add today to active days
  set(state => ({
    activeDays: [...state.activeDays, today],
    currentStreak: calculateCurrentStreak([...state.activeDays, today]),
    longestStreak: Math.max(state.longestStreak, calculateCurrentStreak([...state.activeDays, today]))
  }))
  
  // Persist to Dexie
  db.streaks.put({ date: today, activityType, duration })
}
```

**Testing Requirements:**

Unit tests:
- submitQuiz calls useStreakStore.recordActivity
- recordActivity is idempotent (multiple calls same day = one entry)

Integration tests:
- Complete quiz → streak updated
- Complete 2 quizzes same day → streak updated once

E2E tests:
- Complete quiz → view streak calendar → today marked active

**Dependencies:**
- Story 12.3 (needs useQuizStore.submitQuiz)
- Epic 1 from main LevelUp (needs useStreakStore) - assume exists

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- N/A (integration logic only)

---

### Story 18.6: Display Quiz Performance in Overview Dashboard

As a learner,
I want to see my quiz performance summary on the Overview dashboard,
So that I can quickly see my quiz activity alongside other learning metrics.

**Acceptance Criteria:**

**Given** I have completed quizzes
**When** I view the Overview dashboard
**Then** I see a "Quiz Performance" card or section
**And** it displays my total quizzes completed
**And** it displays my average quiz score across all attempts
**And** it displays my quiz completion rate

**Given** I click on the Quiz Performance card
**When** interacting with it
**Then** I navigate to a detailed quiz analytics page (Reports section)
**Or** it expands to show more detail (recent quizzes, improvement trends)

**Given** I have NOT completed any quizzes
**When** viewing the Overview dashboard
**Then** I see an empty state: "No quizzes completed yet. Start a quiz to track your progress!"
**And** I see a CTA: "Find Quizzes"

**Technical Details:**

Files to modify:
- `src/app/pages/Overview.tsx` (add Quiz Performance card)

Files to create (if needed):
- `src/app/components/dashboard/QuizPerformanceCard.tsx`

QuizPerformanceCard component:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Quiz Performance</CardTitle>
  </CardHeader>
  <CardContent>
    {totalQuizzes > 0 ? (
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Quizzes Completed</span>
          <span className="font-semibold">{totalQuizzes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Average Score</span>
          <span className="font-semibold">{Math.round(averageScore)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Completion Rate</span>
          <span className="font-semibold">{Math.round(completionRate)}%</span>
        </div>
      </div>
    ) : (
      <div className="text-center py-4">
        <p className="text-gray-600 mb-2">No quizzes completed yet.</p>
        <Button variant="link">Find Quizzes</Button>
      </div>
    )}
  </CardContent>
  <CardFooter>
    <Link to="/reports" className="text-sm text-blue-600 hover:underline">
      View Detailed Analytics →
    </Link>
  </CardFooter>
</Card>
```

Calculate metrics:
```typescript
const calculateQuizMetrics = async () => {
  const allAttempts = await db.quizAttempts.toArray()
  const totalQuizzes = allAttempts.length
  const averageScore = totalQuizzes > 0
    ? allAttempts.reduce((sum, a) => sum + a.percentage, 0) / totalQuizzes
    : 0
  const completionRate = await calculateCompletionRate()
  
  return { totalQuizzes, averageScore, completionRate: completionRate.completionRate }
}
```

**Testing Requirements:**

Unit tests:
- calculateQuizMetrics with various attempt counts

E2E tests:
- Complete quiz → view Overview → see Quiz Performance card
- Click card → navigate to Reports (or expand details)

**Dependencies:**
- Story 12.2 (needs quizAttempts table)
- Story 17.1 (uses completion rate calculation)
- Epic from main LevelUp (needs Overview page) - assume exists

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Card layout and metrics display
- Empty state messaging and CTA
- Link to detailed analytics

---

### Story 18.7: Surface Quiz Analytics in Reports Section

As a learner,
I want to see detailed quiz analytics in the Reports section,
So that I can understand my quiz performance alongside other learning metrics.

**Acceptance Criteria:**

**Given** I navigate to the Reports section
**When** the page loads
**Then** I see a "Quiz Analytics" tab or section
**And** it displays all quiz-related metrics:
  - Total quizzes completed
  - Average score
  - Completion rate
  - Average retake frequency
  - Recent quiz attempts (last 5)
  - Top performing quizzes (highest average scores)
  - Quizzes needing improvement (lowest scores)

**Given** I want to see details for a specific quiz
**When** I click on a quiz in the list
**Then** I navigate to that quiz's detailed analytics:
  - All attempt history
  - Score improvement trajectory
  - Item difficulty analysis
  - Discrimination indices
  - Normalized gain

**Technical Details:**

Files to modify:
- `src/app/pages/Reports.tsx` (add Quiz Analytics section)

Files to create (if needed):
- `src/app/components/reports/QuizAnalyticsDashboard.tsx`
- `src/app/pages/QuizDetailAnalytics.tsx` (detailed view per quiz)

Reports page structure:
```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="quizzes">Quiz Analytics</TabsTrigger>
    {/* Other tabs */}
  </TabsList>
  
  <TabsContent value="quizzes">
    <QuizAnalyticsDashboard />
  </TabsContent>
</Tabs>
```

QuizAnalyticsDashboard component:
```tsx
<div className="space-y-6">
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <MetricCard title="Total Quizzes" value={totalQuizzes} />
    <MetricCard title="Average Score" value={`${avgScore}%`} />
    <MetricCard title="Completion Rate" value={`${completionRate}%`} />
  </div>
  
  <Card>
    <CardHeader><CardTitle>Recent Quizzes</CardTitle></CardHeader>
    <CardContent>
      <Table>
        {/* Recent attempts list */}
      </Table>
    </CardContent>
  </Card>
  
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <Card>
      <CardHeader><CardTitle>Top Performing Quizzes</CardTitle></CardHeader>
      {/* Quizzes with highest avg scores */}
    </Card>
    
    <Card>
      <CardHeader><CardTitle>Quizzes Needing Practice</CardTitle></CardHeader>
      {/* Quizzes with lowest scores */}
    </Card>
  </div>
</div>
```

**Testing Requirements:**

E2E tests:
- Complete multiple quizzes → navigate to Reports → see Quiz Analytics
- Click quiz in list → see detailed analytics

**Dependencies:**
- Stories 6.1-6.5 (analytics calculations)
- Epic from main LevelUp (needs Reports page) - assume exists

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Tab integration in Reports page
- Metric card styling
- Table/list layouts for quiz data
- Navigation to detailed view

---

### Story 18.8: Display Quiz Availability Badges on Courses Page

As a learner,
I want to see which lessons have quizzes available,
So that I can easily find and take quizzes while browsing courses.

**Acceptance Criteria:**

**Given** I view the Courses page or Course Detail page
**When** browsing lessons
**Then** I see a "Quiz" badge or icon on lessons that have quizzes
**And** the badge is visually distinct (e.g., blue quiz icon or "Quiz Available" label)

**Given** I have NOT completed a quiz for a lesson
**When** viewing the quiz badge
**Then** it displays as "Take Quiz" or shows as available (not completed)

**Given** I HAVE completed a quiz for a lesson
**When** viewing the quiz badge
**Then** it displays my best score (e.g., "Quiz: 85%")
**And** I can click it to retake or review

**Given** I click on a quiz badge
**When** interacting with it
**Then** I navigate directly to the quiz start screen for that lesson

**Technical Details:**

Files to modify:
- `src/app/pages/Courses.tsx` (add quiz badges to lesson list)
- `src/app/pages/CourseDetail.tsx` (add quiz badges to lesson detail)

Files to create (if needed):
- `src/app/components/courses/QuizBadge.tsx`

QuizBadge component:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`)}
  className="flex items-center gap-2"
>
  <GraduationCap className="h-4 w-4" />
  {bestScore ? (
    <span>Quiz: {bestScore}%</span>
  ) : (
    <span>Take Quiz</span>
  )}
</Button>
```

Fetch best score:
```typescript
const getBestQuizScore = async (lessonId: string) => {
  const quiz = await db.quizzes.where('lessonId').equals(lessonId).first()
  if (!quiz) return null
  
  const attempts = await db.quizAttempts.where('quizId').equals(quiz.id).toArray()
  if (attempts.length === 0) return null
  
  const bestAttempt = attempts.reduce((best, current) => 
    current.percentage > best.percentage ? current : best
  )
  
  return bestAttempt.percentage
}
```

**Testing Requirements:**

E2E tests:
- Navigate to Courses page → see quiz badges on lessons with quizzes
- Click quiz badge → navigate to quiz
- Complete quiz → return to Courses → see updated score on badge

**Dependencies:**
- Story 12.2 (needs quizzes table with lessonId)
- Epic from main LevelUp (needs Courses page) - assume exists

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Quiz badge styling and placement
- Icon choice (graduation cap, document with checkmark, etc.)
- Badge interaction (button, link, or card)
- Score display formatting

---

## Epic 10: Onboarding & First-Use Experience

New users are guided through importing their first course, starting a study session, and creating their first learning challenge — ensuring immediate value discovery without documentation.

### Story 10.1: First-Use Onboarding Flow

As a first-time user,
I want a guided onboarding flow that walks me through importing a course, starting a study session, and creating a learning challenge,
So that I discover the platform's core value immediately without needing documentation.

**Acceptance Criteria:**

**Given** I am a new user with no courses imported and no onboarding completion flag in local storage
**When** I land on the dashboard for the first time
**Then** an onboarding overlay appears with a welcome message and a progress indicator showing 3 steps
**And** the first step "Import your first course" is highlighted as active

**Given** the onboarding flow is active on step 1 (Import a course)
**When** I view the prompt
**Then** the relevant UI element for course import is visually highlighted with a spotlight/tooltip
**And** I see a clear call-to-action directing me to the import workflow
**And** a "Skip onboarding" option is visible and accessible

**Given** I have completed step 1 by importing a course
**When** the import finishes successfully
**Then** the onboarding advances to step 2 "Start studying"
**And** the progress indicator updates to show step 2 of 3 as active
**And** the video player or course content area is highlighted with a guiding tooltip

**Given** I have completed step 2 by starting a study session (playing a video for at least 5 seconds)
**When** the session registers
**Then** the onboarding advances to step 3 "Create a learning challenge"
**And** the progress indicator updates to show step 3 of 3 as active
**And** the challenge creation UI element is highlighted with a guiding tooltip

**Given** I have completed step 3 by creating a learning challenge
**When** the challenge is saved
**Then** a congratulatory message appears confirming onboarding is complete
**And** the onboarding completion flag is persisted to local storage
**And** the onboarding overlay dismisses and does not reappear on subsequent visits

**Given** the onboarding flow is active on any step
**When** I click "Skip onboarding"
**Then** the onboarding overlay dismisses immediately
**And** the onboarding completion flag is persisted to local storage
**And** the onboarding does not reappear on subsequent visits

**Given** I previously completed or skipped onboarding
**When** I return to the dashboard
**Then** no onboarding overlay appears
**And** the app loads directly into the normal dashboard view

**Given** the onboarding flow is active
**When** I interact with the highlighted UI element for the current step
**Then** the spotlight follows the element correctly even if the layout shifts or scrolls
**And** the rest of the UI remains accessible but visually de-emphasized

### Story 10.2: Empty State Guidance

As a new or returning user viewing a section with no content,
I want contextual empty states that explain what belongs here and link me to the relevant action,
So that I always know my next step and can complete core workflows within 2 minutes without documentation.

**Acceptance Criteria:**

**Given** I have no courses imported
**When** I view the dashboard overview
**Then** an empty state is displayed with the message "Import your first course to get started"
**And** a prominent call-to-action button links directly to the course import workflow
**And** the empty state includes a supportive illustration or icon that matches the app's visual style

**Given** I have no notes recorded
**When** I view the notes section or notes panel
**Then** an empty state is displayed with the message "Start a video and take your first note"
**And** a call-to-action links to the course library or most recent course so I can begin a session
**And** the empty state briefly describes what notes are for (e.g., "Capture key moments while you study")

**Given** I have no learning challenges created
**When** I view the challenges section
**Then** an empty state is displayed with the message "Create your first learning challenge"
**And** a call-to-action button opens the challenge creation flow directly
**And** the empty state briefly describes the value of challenges

**Given** I have no study sessions recorded
**When** I view the reports or activity section
**Then** an empty state is displayed with a message guiding me to start studying
**And** a call-to-action links to available courses or the course import flow

**Given** any empty state is displayed
**When** I click the call-to-action button
**Then** I am navigated to the correct destination for that action without intermediate steps
**And** the transition completes within 300ms

**Given** I complete the action prompted by an empty state (e.g., import a course)
**When** I return to the previously empty section
**Then** the empty state is replaced with the actual content
**And** no residual empty state messaging is visible

**Given** I am a new user following empty state prompts without any prior training
**When** I complete the sequence of importing a course, starting a study session, and creating a challenge
**Then** the entire sequence is completable within 2 minutes
**And** no external documentation or help pages are required to understand the prompts

---

