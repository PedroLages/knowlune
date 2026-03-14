---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - 'docs/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
updateMode: 'incremental'
updateDate: '2026-03-07'
updateReason: 'Architecture updated to local-first AI (WebLLM/whisper.cpp/3-tier fallback); UX updated with spaced repetition components, activity heatmap, onboarding system, streak freeze mechanic'
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
FR48: Epic 9B - AI-generated video summary (100-300 words)
FR49: Epic 9B - Chat-style Q&A from user's note corpus
FR50: Epic 9B - AI-generated learning path with prerequisite ordering
FR51: Epic 9B - Identify under-noted/skipped topics, suggest revisits
FR52: Epic 9B - AI auto-tag, categorize, link related notes
FR53: Epic 9B - "Related Concepts" panel (shared tags/topical overlap)
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
FR94: Epic 9B - AI feature usage statistics
FR95: Epic 4 - Resume last session from "Continue Learning" action
FR96: Epic 10 - Onboarding prompts for first-time use
FR97: Epic 9B - Proactive AI note link suggestions
FR98: Epic 5 - Streak milestone toast notifications (7/30/60/100 days)
FR99: Epic 9B - Auto-trigger AI analysis on course import
FR100: Epic 11 - Per-course study reminders
FR101: Epic 5 (primary) - Weekly adherence percentage: Epic 5 implements calculation + dashboard widget; Epic 8 displays it in analytics views

## Epic List

### Epic 1: Course Import & Library Management

Users can import local course folders, browse their library, organize by topic, and manage course status — establishing the content foundation for all learning activities.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR89
**Phase:** 1 (Foundation)

### Epic 1B: Library Enhancements

Users can import multiple courses simultaneously, see rich metadata (duration, thumbnails), receive transparent progress feedback during imports, and enjoy a visually engaging library experience — polishing the course management foundation established in Epic 1.

**FRs covered:** Enhancement epic (no new FRs, improves UX for FR1-FR6)
**Phase:** 1 (Foundation — Optional polish after Epic 1)
**Research basis:** Competitive analysis of Udemy, Coursera, Plex, Jellyfin (2026-03-14)

### Epic 1C: Course Library Management (Delete, Edit, Sort, Search)

Users can delete courses, edit course titles, manage tags globally, sort imported courses by momentum, search within course content, and navigate directly to detail pages — fixing all critical UX gaps found during real-world testing.

**FRs covered:** FR2, FR3, FR4 (gaps) — addresses BLOCKER B-1 and HIGH/MEDIUM findings from design review 2026-03-14
**Phase:** 1 (Foundation — Critical fix after Epic 1B)
**Stories:** 1C.1 (Delete + BLOCKER fix), 1C.2 (Edit title), 1C.3 (Touch targets + filters), 1C.4 (Tag management), 1C.5 (Momentum sort for imported), 1C.6 (In-page search)

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

### Epic 9: AI Infrastructure & Platform

Users can configure AI providers (local WebLLM, Ollama, or cloud API) with per-feature consent toggles, benefit from background AI processing via Web Workers without UI freezing, and have their notes automatically indexed for semantic search — establishing the AI foundation that powers all AI features in Epic 9B.

**FRs covered:** *(Infrastructure — enables FR48-FR53, FR94, FR97, FR99 implemented in Epic 9B)*
**Phase:** 3 (AI & Analytics)
**Architecture note:** 3-tier AI fallback (WebGPU local → Ollama localhost → Cloud API), 3 Web Workers (LLM, embeddings, transcription), MeMemo HNSW vector store, Web Crypto AES-GCM key encryption, 3GB memory ceiling with auto-downgrade

### Epic 9B: AI-Powered Learning Features

Users can get AI-generated video summaries, ask questions answered from their notes via RAG, view AI-curated learning paths, receive knowledge gap alerts, benefit from AI note organization and cross-course linking, and have new courses auto-analyzed on import — all powered by the AI infrastructure from Epic 9.

**FRs covered:** FR48, FR49, FR50, FR51, FR52, FR53, FR94, FR97, FR99
**Phase:** 3 (AI & Analytics)
**Depends on:** Epic 9 (AI Infrastructure)

### Epic 10: Onboarding & First-Use Experience

New users are guided through importing their first course, starting a study session, and creating their first learning challenge — ensuring immediate value discovery without documentation.

**FRs covered:** FR96
**Phase:** 1 (Foundation — deployed after Epics 1-2)

### Epic 11: Knowledge Retention, Export & Advanced Features (Post-MVP)

Users can schedule spaced reviews, export learning data in multiple formats, configure per-course reminders, and access advanced review modes — extending the platform for power users and data portability.

**FRs covered:** FR80, FR81, FR82, FR83, FR84, FR85, FR86, FR87, FR92, FR100
**Phase:** 4 (Post-MVP)

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

## Epic 1B: Library Enhancements

Users can import multiple courses simultaneously, see rich metadata (duration, thumbnails), receive transparent progress feedback during imports, and enjoy a visually engaging library experience — polishing the course management foundation established in Epic 1.

**Enhancement Epic:** Extends Epic 1 with industry-standard features based on competitive analysis of Udemy, Coursera, Plex, and Jellyfin (research: 2026-03-14).

### Story 1.6: Bulk Course Import

As a learner,
I want to select and import multiple course folders at once,
So that I can quickly set up my entire library without importing folders one by one.

**Acceptance Criteria:**

**Given** the user is on the Course Library page
**When** the user clicks the "Import Course" button
**Then** a dialog appears with options: "Import Single Folder" or "Import Multiple Folders"

**Given** the user selects "Import Multiple Folders"
**When** the folder picker dialog opens
**Then** the user can select multiple folders (browser-native multi-select behavior)
**And** confirmation shows the count of selected folders (e.g., "5 folders selected")

**Given** the user confirms multiple folder selection
**When** the import process begins
**Then** the system scans all folders in parallel (max 5 concurrent to avoid performance issues)
**And** each folder creates a separate course entity as it completes scanning
**And** courses appear in the library immediately via optimistic Zustand updates

**Given** one or more folders in a bulk import contain zero supported files
**When** those scans complete
**Then** a consolidated toast notification displays: "3 of 5 folders imported. 2 folders had no supported files."
**And** only valid courses are created in IndexedDB

**Given** some folders succeed and others fail during bulk import
**When** the import completes
**Then** successfully imported courses appear in the library
**And** failed imports show detailed error messages without blocking successful ones
**And** the user can retry failed imports individually

### Story 1.7: Auto-Extract Video Metadata

As a learner,
I want to see the total duration and file details for each course,
So that I can make informed decisions about which courses to start based on time commitment.

**Acceptance Criteria:**

**Given** a course folder is being imported
**When** the system scans video files
**Then** it extracts metadata: duration, file size, and resolution (e.g., 1080p, 720p) for each video
**And** metadata extraction happens in the background without blocking UI rendering

**Given** video metadata has been extracted
**When** the course card displays in the library
**Then** the card shows total duration in human-readable format (e.g., "8h 24m")
**And** the card shows video count (e.g., "24 videos")
**And** hovering over duration reveals additional details: total file size (e.g., "2.4 GB")

**Given** metadata extraction fails for one or more videos
**When** the extraction error occurs
**Then** the system gracefully skips that file and continues processing others
**And** the duration calculation uses only successfully extracted metadata
**And** no error toast is shown to the user (silent failure for metadata extraction)

**Given** a course contains videos of mixed resolutions (720p, 1080p, 4K)
**When** the course card displays
**Then** a resolution badge shows the highest resolution available (e.g., "4K")
**And** the badge is subtle and does not dominate the card design

### Story 1.8: Import Progress Indicator

As a learner,
I want to see real-time progress when importing large course folders,
So that I know the system is working and can estimate how long it will take.

**Acceptance Criteria:**

**Given** the user initiates a course import
**When** the folder scan begins
**Then** a progress modal or toast appears showing: "Scanning folder... 0 of ? files processed"
**And** the modal is non-blocking (user can navigate away, import continues in background)

**Given** the folder scan is in progress
**When** files are being processed
**Then** the progress indicator updates every 10 files (not per file to avoid UI jank)
**And** the display shows: "Scanning folder... 45 of 120 files processed (38%)"
**And** after processing 20 files, an estimated time remaining is shown (e.g., "~2 minutes remaining")

**Given** the user is importing multiple folders (bulk import)
**When** the scans are running
**Then** the progress indicator shows overall progress: "Importing 3 of 7 courses..."
**And** each course's individual status is visible (e.g., "Course 1: 80% complete, Course 2: 20% complete")

**Given** the user clicks "Cancel" on the progress indicator
**When** the cancellation is triggered
**Then** the import stops immediately without corrupting existing data
**And** partially scanned courses are not saved to IndexedDB
**And** a toast confirms: "Import canceled. No changes were made."

**Given** the import completes successfully
**When** all files are processed
**Then** the progress indicator shows: "Import complete! 3 courses added to your library."
**And** the modal auto-dismisses after 3 seconds or user clicks "Close"

### Story 1.9: Course Card Thumbnails

As a learner,
I want to see visual thumbnails on course cards,
So that I can quickly recognize courses at a glance and enjoy a more engaging library experience.

**Acceptance Criteria:**

**Given** a course is being imported and contains at least one video file
**When** the import scan completes
**Then** the system generates a thumbnail from the first video in the course
**And** the thumbnail is captured at the 10% mark of the video duration (to avoid black screens or intros)
**And** the thumbnail is saved to IndexedDB as a base64-encoded image or blob

**Given** a thumbnail has been generated
**When** the course card displays in the library
**Then** the thumbnail appears at the top of the card with 16:9 aspect ratio
**And** the thumbnail width is approximately 200px (responsive to card width)
**And** the thumbnail has subtle rounded corners matching the card's border-radius

**Given** thumbnail generation fails for a video (corrupted file, unsupported codec)
**When** the failure occurs
**Then** a default placeholder icon is displayed instead (e.g., video play icon or folder icon)
**And** no error toast is shown to the user
**And** the card layout remains consistent with other cards

**Given** a course has been imported and displayed
**When** the user refreshes the page or navigates away and returns
**Then** thumbnails load from IndexedDB cache without regenerating
**And** thumbnail loading does not block rendering of course titles or metadata

**Given** the library contains 50+ courses with thumbnails
**When** the library page loads
**Then** thumbnails display progressively (lazy loading for off-screen cards)
**And** the page remains responsive (<100ms query per NFR4)

---

## Epic 1C: Course Library Management (Delete, Edit, Sort, Search)

Users can delete courses, edit course titles, manage tags globally, sort imported courses by momentum, search within course content, and navigate directly to detail pages via URL — fixing all UX gaps and a navigation blocker identified during real-world testing.

**Enhancement Epic:** Addresses BLOCKER B-1 and HIGH/MEDIUM-severity findings from design review 2026-03-14.

### Story 1C.1: Delete Course + Direct Navigation Fix (BLOCKER)

As a learner,
I want to delete a course I no longer need and navigate directly to course detail pages,
So that I can keep my library tidy and not see a broken "Course not found" page on direct URL access.

**Acceptance Criteria:**

**Given** `ImportedCourseDetail` is loaded directly via URL (e.g., `/imported-courses/:id` on hard refresh)
**When** the component mounts
**Then** it calls `loadImportedCourses()` if the store is empty
**And** the course data loads and renders correctly
**And** no "Course not found" error appears for valid course IDs

**Given** the user is on the Course Library page
**When** the user opens a course card's action menu or detail page
**Then** a "Delete Course" option is visible

**Given** the user clicks "Delete Course"
**When** the confirmation dialog appears
**Then** the dialog displays the course name and asks for confirmation (NFR23)
**And** a destructive-style "Delete" button and a "Cancel" button are shown

**Given** the user confirms deletion
**When** the delete is processed
**Then** the course is removed from IndexedDB (videos, PDFs, thumbnail, and course record)
**And** the course disappears from the library immediately (optimistic update)
**And** a toast notification confirms: "Course deleted"
**And** if the user is on the course detail page, they are redirected to `/courses`

**Given** the user cancels the confirmation dialog
**When** the dialog closes
**Then** no changes are made to the course or library

**Given** the deletion fails (e.g., IndexedDB write error)
**When** the error occurs
**Then** the course reappears in the library (rollback)
**And** an error toast displays: "Failed to delete course. Please try again."

### Story 1C.2: Edit Course Title

As a learner,
I want to rename a course after importing it,
So that I can correct auto-detected names or give courses meaningful titles for my context.

**Acceptance Criteria:**

**Given** the user is on the course detail page
**When** the user clicks the course title or an "Edit title" icon next to it
**Then** the title becomes an inline editable text field
**And** the current title is pre-filled and selected

**Given** the title field is in edit mode
**When** the user types a new title and presses Enter or clicks outside the field
**Then** the title is saved (trimmed, non-empty) to IndexedDB
**And** the title updates immediately in the UI (optimistic update)
**And** the edit field returns to display mode

**Given** the user clears the title field entirely and tries to save
**When** the save action triggers
**Then** the original title is restored (empty title rejected)
**And** an inline validation message displays: "Title cannot be empty"

**Given** the user is editing the title
**When** the user presses Escape
**Then** the edit is cancelled and the original title is restored
**And** no changes are saved

**Given** the title has been renamed
**When** the user navigates to the Course Library
**Then** the course card shows the updated title

### Story 1C.3: Touch Target & Filter Accessibility Fix

As a learner using the Course Library,
I want to interact with filter pills and UI controls that meet WCAG touch target standards,
So that the interface is comfortable and accessible on all devices.

**Acceptance Criteria:**

**Given** the user views the Topic filter pills in the Course Library
**When** the filter area renders
**Then** each pill has a minimum height of 44px (WCAG 2.1 AA, NFR touch targets)
**And** the active filter pill is clearly distinguished from inactive pills
**And** keyboard focus is visible on each pill (focus ring)

**Given** the user views the Status filter pills
**When** the filter area renders
**Then** each status pill meets the 44px minimum height requirement
**And** clicking a status filter correctly filters the course grid

**Given** the library has search results with zero matches in a category tab
**When** the user switches to that tab
**Then** an empty state message displays instead of an empty tab with no content

**Given** the "Import Course" button appears in both the header and the empty state
**When** the library is empty
**Then** only the empty state CTA button is shown (no duplicate header button)
**And** when courses exist, the header button is the only import entry point

### Story 1C.4: Tag Management (Global Rename & Delete)

As a learner,
I want to rename or delete tags I've created across my courses,
So that I can fix typos, consolidate duplicate tags, and keep my library organized.

**Acceptance Criteria:**

**Given** the user is on the Course Library page
**When** the user opens the tag management panel (accessible via a "Manage Tags" button near the topic filters)
**Then** a list of all existing tags is shown, sorted alphabetically
**And** each tag shows a count of how many courses use it

**Given** the user clicks "Rename" on a tag
**When** the rename input appears with the current tag pre-filled
**Then** the user can type a new name and confirm with Enter
**And** all courses using the old tag are updated to the new tag
**And** the tag filter updates immediately

**Given** the user clicks "Delete" on a tag
**When** a confirmation prompt appears
**Then** confirming removes the tag from all courses that use it
**And** the tag disappears from the filter pills and tag lists

**Given** the user tries to rename a tag to a name that already exists
**When** the user confirms
**Then** the tags are merged (all courses now carry only the existing tag)
**And** an inline message confirms: "Merged into existing tag"

**Given** there are no tags in the library
**When** the user opens the tag management panel
**Then** an empty state message shows: "No tags yet. Add tags to your courses to organize them."

### Story 1C.5: Momentum Sort for Imported Courses

As a learner,
I want to sort my imported courses by momentum score,
So that I can quickly see which courses I should prioritise based on recent activity.

**Acceptance Criteria:**

**Given** the user is on the Course Library page and has imported courses with momentum scores
**When** the user selects "Sort by Momentum" from the sort dropdown
**Then** imported courses are sorted by momentum score (highest first)
**And** courses with no study activity appear at the end of the list

**Given** imported courses are sorted by momentum
**When** the sort is active
**Then** the sort applies to imported courses alongside any active topic/status filters
**And** removing filters retains the momentum sort order

**Given** the user switches from "Sort by Momentum" to "Most Recent"
**When** the sort changes
**Then** imported courses return to sort order by `importedAt` (newest first)

**Given** an imported course has momentum score zero (never studied)
**When** any sort mode is active
**Then** zero-momentum courses appear after all courses with scores > 0
**And** zero-momentum courses among themselves are sorted by `importedAt`

### Story 1C.6: Search & Filter Inside Course Detail Page

As a learner,
I want to search for a specific video or PDF within a course's content list,
So that I can quickly find a lesson in a large course without scrolling through all files.

**Acceptance Criteria:**

**Given** the user is on the course detail page for a course with 10+ content items
**When** the detail page renders
**Then** a search/filter input is shown above the content list

**Given** the user types in the search field
**When** characters are entered
**Then** the content list filters in real-time (< 100ms) to show only items whose filename contains the query (case-insensitive)
**And** matched characters in the filename are visually highlighted

**Given** the search query matches zero items
**When** no results are found
**Then** an empty state message displays: "No videos or PDFs match your search"
**And** a "Clear search" button resets the filter

**Given** the user clears the search field
**When** the field is emptied
**Then** all content items are shown again
**And** scroll position resets to the top of the list

**Given** a course has fewer than 10 items
**When** the detail page renders
**Then** the search input is hidden (not needed for small courses)

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
**Then** a StreakCounter component displays in one of 5 states: Active (flame icon, current count), At Risk (amber warning, "Study now to keep your streak!"), Frozen (snowflake icon, freeze day indicator), Broken (gray, "Start a new streak"), or Milestone (celebratory, badge display)
**And** a 7-day dot row shows the current week: filled dots for study days, empty for missed, snowflake for frozen
**And** the counter uses `aria-label="Study streak: N days"` with `role="status"` and live region updates
**And** the streak count uses Score typography (700 bold, 2.5rem, tabular-nums)

**Given** a learner completes a study session on a new calendar day
**When** the session is recorded
**Then** the streak count increments by one
**And** a pulse animation plays on the streak counter (respecting `prefers-reduced-motion`)
**And** the corresponding dot in the 7-day row fills in

**Given** a learner has not completed any study session for more than 24 hours
**When** the streak evaluation runs (excluding configured freeze days from Story 5.2)
**Then** the streak counter transitions to the "Broken" state (gray styling)
**And** the previous streak is preserved in history
**And** the counter shows an encouraging message (e.g., "Start a new streak today!")

**Given** a learner has 22+ hours of inactivity but the streak has not yet broken
**When** they view the dashboard
**Then** the streak counter transitions to the "At Risk" state (amber warning styling)

**Given** a learner has a streak of zero
**When** they complete their first study session
**Then** the streak counter transitions to the "Active" state displaying 1
**And** the flame icon and pulse animation appear

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
**Then** a WeeklyGoalRing component (animated SVG progress ring) shows current progress toward today's goal (e.g., "45 / 60 min")
**And** the ring state reflects progress: below target (blue), on target (green), exceeded (gold glow)

**Given** a learner has an active weekly study goal
**When** they view the Overview dashboard
**Then** the WeeklyGoalRing shows weekly cumulative progress (study days / target days) against the weekly target

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
I want to see a composite momentum score (0-100) for each course with a trend indicator,
So that I can instantly identify which courses have strong engagement momentum and prioritize my study time accordingly.

**Acceptance Criteria:**

**Given** a course exists in the user's library with recorded study sessions
**When** the system calculates the momentum score
**Then** the score is computed as a weighted composite: Streak contribution (40%) + Velocity (35%, videos completed per week) + Engagement (25%, session frequency and duration)
**And** the resulting score is a value between 0 and 100

**Given** a course has a calculated momentum score
**When** the course card is rendered in the course library
**Then** a MomentumScore component displays the numeric score (0-100) using Score typography (700 bold, tabular-nums)
**And** a trend arrow indicates direction: rising (↑ green), stable (→ gray), or declining (↓ amber) based on week-over-week comparison
**And** the component has `aria-label="Momentum score: N, [rising/stable/declining]"`
**And** a tooltip on hover/focus shows the weight breakdown (Streak 40% + Velocity 35% + Engagement 25%)
**And** hot (score >= 70), warm (score 30-69), or cold (score < 30) styling is applied using `--color-momentum` design token

**Given** a course has no recorded study sessions
**When** the momentum score is calculated
**Then** the score defaults to 0 with cold styling and no trend arrow

**Given** the course library is displayed
**When** the user selects "Sort by Momentum" from the sort options
**Then** courses are ordered from highest to lowest momentum score
**And** the MomentumScore component remains visible on each course card in the sorted view

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
**Then** an ActivityHeatmap component renders a GitHub-style 52-week × 7-row SVG grid with month labels and a 5-level color legend using `--color-heatmap-0` through `--color-heatmap-4` design tokens
**And** each cell represents one day, with color intensity proportional to the total session duration for that day
**And** hovering over or focusing on a cell shows a tooltip with the date, study duration, and notes taken (e.g., "45 min studied, 3 notes taken")
**And** cells are keyboard-navigable using arrow keys
**And** the component has `role="img"` with `aria-label="Study activity over the past 12 months"`

**Given** the user views the activity heatmap on different viewports
**When** the heatmap renders
**Then** it shows the full 12-month grid at desktop (1024px+), 6-month at tablet (640-1023px), and 3-month at mobile (<640px)

**Given** the user views the activity heatmap
**When** the heatmap renders
**Then** intensity levels are differentiated by both color shade and a pattern or opacity variation so they are distinguishable without color perception
**And** the heatmap includes alt text summarizing the overall activity pattern
**And** a "View as table" toggle is available showing monthly summary data in an accessible HTML table

**Given** the heatmap is displayed on the Overview page
**When** the page renders
**Then** the heatmap is persistently visible as motivational context (never demanding action)
**And** it appears below the insight cards in the Overview layout

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
**Then** between 3 and 5 InsightCard components are displayed, each with icon + title + description + CTA button + dismiss action
**And** cards use variants: priority (amber border), informational (blue border), or celebratory (violet border)
**And** insights are generated from the user's actual study data, not generic tips
**And** each card has `role="article"` with a focusable CTA button and `aria-label="Dismiss insight"` on the dismiss action

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

## Epic 9 Stories: AI Infrastructure & Platform

Users can configure AI providers (local WebLLM, Ollama, or cloud API) with per-feature consent toggles, benefit from background AI processing via Web Workers without UI freezing, and have their notes automatically indexed for semantic search.

### Story 9.1: AI Infrastructure & 3-Tier Provider Setup

As a learner,
I want the AI system to automatically detect and use the best available AI provider (local WebLLM, Ollama, or cloud API),
So that I can benefit from AI features with maximum privacy and minimal configuration.

**Acceptance Criteria:**

**Given** I am on the Settings page
**When** I navigate to the "AI Configuration" section
**Then** I see a 3-tier provider display showing: (1) Local WebLLM (WebGPU status), (2) Ollama (localhost:11434 connection status), (3) Cloud API (provider selector with at least 2 options: OpenAI and Anthropic)
**And** each tier shows a status badge: "Available", "Unavailable", or "Not Supported"
**And** I see per-feature consent toggles for each AI capability (summaries, Q&A, note organization, auto-analysis)
**And** each toggle shows a tier indicator badge ("Processed on your device" for local, "Processed on your network" for Ollama, "Cloud" for remote API)

**Given** my browser supports WebGPU
**When** the AI system initializes
**Then** the system detects WebGPU availability and reports local AI as "Available"
**And** WebLLM model download status is displayed (not downloaded / downloading / ready)
**And** the estimated model size is shown (e.g., "~900MB - 2.2GB")

**Given** my browser does not support WebGPU
**When** the AI system initializes
**Then** the local AI tier shows "Not Supported — WebGPU required (Chrome/Edge)"
**And** the system falls back to Ollama or Cloud tiers automatically

**Given** I configure a cloud API key
**When** I save the configuration
**Then** the API key is encrypted using Web Crypto API (AES-GCM with PBKDF2-derived non-extractable CryptoKey)
**And** the key is never stored in plain text, source code, build output, console logs, or client-accessible storage
**And** a connection test confirms the provider is reachable with a success indicator

**Given** I enter an invalid or empty API key
**When** I attempt to save
**Then** the system displays a validation error and does not persist the invalid key

**Given** an AI feature is invoked
**When** the system selects a provider
**Then** it uses the highest-priority available tier: WebGPU local → Ollama → Cloud API
**And** if a higher-priority tier fails, it automatically falls back to the next tier within 2 seconds

**Given** no AI provider is available (no WebGPU, no Ollama, no cloud key)
**When** I navigate to any page with AI-dependent UI elements
**Then** those elements display an "AI unavailable" status badge with a link to AI Configuration settings
**And** all non-AI features remain fully functional

**Given** I disable a specific feature's consent toggle
**When** that AI feature is invoked
**Then** no data is transmitted to any external provider for that feature
**And** the feature UI indicates it is disabled due to consent settings

**Given** the AI system makes any API call (Ollama or Cloud)
**When** the request payload is constructed
**Then** only the content being analyzed is included — no user metadata, file paths, or personally identifiable information is transmitted

### Story 9.2: Web Worker Architecture & Memory Management

As a learner,
I want AI processing to happen in background threads without freezing the UI,
So that I can continue studying while AI features process in the background.

**Acceptance Criteria:**

**Given** the AI system is initialized
**When** an AI feature is invoked for the first time
**Then** the corresponding Web Worker is lazily instantiated (LLM worker, embeddings worker, or transcription worker)
**And** worker initialization does not block the main thread or cause visible UI lag
**And** a loading indicator shows worker startup progress

**Given** the LLM worker is active
**When** the total memory usage approaches the 3GB ceiling (measured via `performance.measureUserAgentSpecificMemory()`)
**Then** the memory monitoring service triggers an auto-downgrade: evicts the largest idle model first
**And** a non-blocking notification informs me that AI capabilities have been temporarily reduced
**And** the UI continues to function without interruption

**Given** a Web Worker is processing an AI request
**When** I navigate to a different page or close the panel
**Then** the worker continues processing in the background
**And** results are available when I return to the relevant view

**Given** multiple AI features are requested simultaneously
**When** workers are dispatched
**Then** each worker type (LLM, embeddings, transcription) operates independently
**And** typed discriminated union messages (`WorkerRequest` / `WorkerResponse`) ensure type-safe communication
**And** errors in one worker do not crash other workers

**Given** a worker encounters an unhandled error
**When** the error is caught
**Then** the worker posts an error message to the main thread
**And** the corresponding UI element displays a user-friendly error with retry option
**And** no unhandled exceptions propagate to the main thread

**Given** the application has been idle for an extended period
**When** no AI features have been used for 5+ minutes
**Then** idle workers are terminated to free memory
**And** workers are re-instantiated on next AI feature use

### Story 9.3: Embedding Pipeline & Vector Store

As a learner,
I want my notes to be automatically indexed for semantic search,
So that AI Q&A can find relevant answers even when my question doesn't use the exact same words as my notes.

**Acceptance Criteria:**

**Given** I have notes in my note corpus
**When** the embedding pipeline initializes (triggered by first AI Q&A use or note save)
**Then** the embeddings Web Worker processes notes into vector embeddings using Transformers.js
**And** embeddings are stored in a MeMemo HNSW vector index
**And** processing happens in the background via `requestIdleCallback()` without blocking UI

**Given** I save a new note or edit an existing note
**When** the autosave completes
**Then** the note's embedding is updated in the vector index within 5 seconds
**And** the updated embedding is immediately available for subsequent AI queries

**Given** the vector index is being built for the first time
**When** I have a large note corpus (100+ notes)
**Then** a progress indicator shows indexing progress (e.g., "Indexing notes: 45/120")
**And** partial results are available for queries even before indexing completes

**Given** an AI Q&A query is submitted
**When** the RAG pipeline retrieves relevant context
**Then** the vector store returns the top-K most semantically similar note chunks
**And** retrieved chunks are passed as context to the LLM with source metadata (note title, course, video timestamp)
**And** the LLM is instructed with low temperature (0.3) and "respond with 'I don't know' if context is insufficient"

**Given** the embeddings worker encounters memory pressure
**When** the memory monitor signals the 3GB ceiling is approaching
**Then** the embedding model (90-200MB) is evicted before the larger LLM model
**And** the vector index remains in IndexedDB for persistence across sessions

**Given** I delete a note
**When** the deletion completes
**Then** the corresponding embedding is removed from the vector index
**And** subsequent queries no longer return the deleted note as a result

## Epic 9B Stories: AI-Powered Learning Features

### Story 9B.1: AI Video Summary

As a learner,
I want to generate an AI-powered summary of a video's content displayed alongside the player,
So that I can quickly review key concepts without rewatching the entire video.

**Acceptance Criteria:**

**Given** I am viewing a video in the video player
**When** I click the "Generate Summary" button
**Then** a collapsible panel opens alongside the video player
**And** the system routes the request through the 3-tier AI fallback (WebGPU local → Ollama → Cloud)
**And** the AI-generated summary streams into the panel in real time
**And** the summary is between 100 and 300 words
**And** the panel shows an "AI-generated" label and a tier badge ("Processed on your device" / "Processed on your network" / "Cloud")

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

### Story 9B.2: Chat-Style Q&A from Notes (RAG)

As a learner,
I want to ask questions in a chat panel and receive answers sourced from my own notes,
So that I can quickly find information across my study materials without manual searching.

**Acceptance Criteria:**

**Given** I open the AI Q&A chat panel
**When** the panel loads
**Then** I see a chat-style Sheet interface with a text input field and message history area
**And** a welcome message explains that answers are generated from my personal note corpus
**And** a "Processed on your device" badge is visible when using local AI (WebLLM)
**And** responses are clearly labeled as "AI-generated"

**Given** I type a question and submit it
**When** the AI processes my query via the RAG pipeline (vector search → context retrieval → LLM generation)
**Then** the answer streams into the chat in real time
**And** each answer cites specific source notes by note title with clickable citation links (indigo-colored `[Note Title]` and `[12:34]` timestamp links)
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

### Story 9B.3: AI Learning Path Generation

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

### Story 9B.4: Knowledge Gap Detection

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

### Story 9B.5: AI Note Organization & Cross-Course Links

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

### Story 9B.6: AI Feature Analytics & Auto-Analysis

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

## Epic 10: Onboarding & First-Use Experience

**Epic Goal:** Guide new users through importing their first course, starting a study session, taking notes, viewing their dashboard, and creating a learning challenge — ensuring immediate value discovery without documentation while providing full accessibility and mobile support.

**Research-Validated:** ✅ Based on 5 specialized research agents (Onboarding Best Practices, WCAG 2.2 AA, Empty States, Mobile UX, Analytics)
**Total Stories:** 4 (2 enhanced + 2 new)
**Effort Estimate:** 28-35 hours (~4-5 days)

**Key Enhancements:**
- ✅ 5-step onboarding (added "Create challenge" per FR96)
- ✅ WCAG 2.2 AA compliance (14 accessibility ACs added)
- ✅ Mobile support (9 mobile ACs + demo course fallback for File System API blocker)
- ✅ Analytics instrumentation (track completion rate, time-to-first-value, activation)

---

### Story 10.1: First-Use Onboarding Flow ⭐ ENHANCED

**Effort:** 12-15 hours (was 5-8 hours)
**Priority:** P0 (Critical)
**Enhancements:** +Step 5 (challenge), +14 accessibility ACs, +9 mobile ACs, +performance ACs

As a first-time user,
I want a guided onboarding flow that walks me through importing a course, starting a study session, taking a note, viewing my dashboard, and creating a learning challenge,
So that I discover the platform's core value immediately without needing documentation and feel confident using all key features.

**Acceptance Criteria:**

**AC1: Onboarding Trigger & Modal Structure (WCAG 2.2 AA)**

**Given** I am a new user with no courses imported and no onboarding completion flag in IndexedDB
**When** I land on the dashboard for the first time
**Then** an onboarding modal appears with:
- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` pointing to heading "Welcome to LevelUp"
- Keyboard focus moves to first interactive element
- 5-step progress indicator with `role="progressbar"`, `aria-valuenow="1"`, `aria-valuemin="1"`, `aria-valuemax="5"`
- Steps: (1) Import course, (2) Watch lesson, (3) Take note, (4) Check dashboard, (5) Create challenge
- Checklist has `role="list"` with `aria-label="Setup progress: 0 of 5 complete"`

---

**AC2: Step 1 - Import First Course**

**Given** onboarding is on step 1
**When** I view the prompt
**Then** a ContextualTooltip highlights the import UI element with:
- `role="tooltip"`
- Highlighted element has `aria-describedby` pointing to tooltip
- Appears on hover AND keyboard focus
- "Got it" dismiss button
- Escape key dismisses tooltip

**Given** I complete step 1 by importing a course
**When** import finishes
**Then** micro-celebration plays (respecting `prefers-reduced-motion`)
**And** progress updates to step 2 with `aria-valuenow="2"`, `aria-label="Setup progress: 1 of 5 complete"`
**And** `role="status"` announces "Step 1 complete. Moving to step 2: Watch a lesson"

---

**AC3-AC6: Steps 2-5** *(Condensed - see full document for complete ACs)*

- **Step 2:** Watch lesson (5 seconds min) → advance to step 3
- **Step 3:** Create note → advance to step 4
- **Step 4:** View dashboard with minimal data handling:
  - "You've started your learning journey!" message
  - Show 1 day streak, course progress, "Continue Learning" CTA
  - Placeholder for empty charts: "Your analytics will appear here as you study"
  - Advance to step 5
- **Step 5:** Create learning challenge (NEW - satisfies FR96)
  - Guide to challenge creation workflow
  - Award onboarding completion badge on completion
  - Persist completion flag to IndexedDB

---

**AC7: Skip Functionality & Focus Management**

**Given** onboarding is active
**When** I click "Skip" or press Escape
**Then** modal dismisses, flag saved as "skipped", focus returns to trigger element
**And** onboarding doesn't reappear

**Given** modal is open
**When** I press Tab
**Then** focus is trapped within modal (cycles through elements)

---

**AC8-AC9: Returning Users & Tooltip Positioning**

- Completed/skipped users see no modal on return
- Tooltips follow elements on scroll/layout shift
- Tooltips not obscured by sticky content (WCAG 2.4.11)

---

**Accessibility ACs (WCAG 2.2 AA)**

**AC-A1: Reduced Motion Support**

**Given** `prefers-reduced-motion: reduce` is enabled
**When** onboarding transitions between steps
**Then** animations disabled/replaced with fades, no confetti, static checkmark instead

---

**AC-A2: Focus Visibility**

**Given** spotlight is highlighting an element
**When** I focus it with keyboard
**Then** focus indicator visible, not obscured, 2px outline with 3:1 contrast

---

**AC-A3: Screen Reader Compatibility**

**Given** using screen reader (NVDA/JAWS/VoiceOver)
**When** navigating onboarding
**Then** progress updates announced via `role="status"`, tooltips announced on focus, all elements have clear labels

---

**Mobile/Responsive ACs**

**AC-M1: Mobile Breakpoint (<640px)**

**Given** on mobile device
**When** onboarding is active
**Then** full-screen bottom sheet (Material Design 3), vertical dots progress indicator (bottom-right), "Skip" button in bottom-left (thumb zone)

---

**AC-M2: Touch Target Sizing**

**Given** on mobile/tablet (<1024px)
**When** interactive elements displayed
**Then** all buttons ≥44x44px, ≥8px spacing, primary CTA in bottom 30% (thumb zone)

---

**AC-M3: Mobile Tooltip Replacement**

**Given** on mobile (<640px)
**When** tooltip should appear
**Then** modal bottom sheet with screenshot, instructions, "Got it" button (≥44x44px)

---

**AC-M4: File System API Fallback** ⚠️ **BLOCKER FIX**

**Given** on mobile OR non-Chromium browser
**When** step 1 (Import course) is reached
**Then** message: "Course import requires Chrome/Edge on desktop. Try our demo course instead!"
**And** "Load Demo Course" button imports sample course automatically
**And** onboarding advances to step 2
**And** demo course labeled "Demo Course (Sample)" in library

---

**AC-M5: Tablet Sidebar Handling (640-1023px)**

**Given** on tablet
**When** onboarding starts
**Then** sidebar auto-closes (`localStorage 'eduvi-sidebar-v1' = 'false'`), remains closed until completion, restores after

---

**AC-M6: Haptic Feedback (Progressive Enhancement)**

**Given** on mobile with vibration support
**When** step completed
**Then** short vibration (~50ms), graceful degradation if unsupported

---

**Performance ACs**

**AC-P1: Component Load Time**

**Given** modal triggered
**When** first appears
**Then** renders <200ms, first tooltip <100ms

---

**AC-P2: Celebration Performance**

**Given** micro-celebration plays
**When** step completed
**Then** animation <500ms, doesn't block UI, static checkmark <50ms if `prefers-reduced-motion`

---

### Story 10.2: Empty State Guidance ⭐ ENHANCED

**Effort:** 6-8 hours (was 4-6 hours)
**Priority:** P1 (High)
**Enhancements:** +2 empty states (bookmarks, calendar), +3 accessibility ACs, +3 mobile ACs

As a new or returning user viewing a section with no content,
I want contextual empty states that explain what belongs here, provide clear next steps, and are accessible to all users,
So that I always know my next action and can complete core workflows within 2 minutes without documentation.

**Acceptance Criteria:**

**AC1-AC6: Core Empty States**

1. **Empty Course Library:** Icon (Folder/Book), heading "No courses yet", description "Import your first course to get started", CTA "Import Course" → import workflow
2. **Empty Notes:** Icon (NotebookPen), heading "No notes yet", description "Start taking notes while watching lessons", CTA "Start Learning" → course library
3. **Empty Challenges:** Icon (Trophy), heading "No challenges yet", description "Create your first learning challenge to set goals", CTA "Create Challenge" → challenge creation
4. **Empty Study Sessions:** Icon (BarChart), heading "No study sessions yet", description "Your analytics will appear as you study", CTA "Browse Courses" → library
5. **Empty Bookmarks** (NEW): Icon (Bookmark), heading "No bookmarks yet", description "Bookmark important lessons to revisit later", CTA "Start Learning" → library
6. **Empty Calendar/Streak** (NEW): Icon (Calendar/Flame), heading "No study history yet", description "Complete first session to track streak", CTA "Start Studying" → library

All use design tokens (`bg-brand-soft`, `text-brand`), sentence case, "you/your" voice, semantic `<h2>` headings

---

**AC7: CTA Direct Navigation**

**Given** empty state displayed
**When** I click CTA
**Then** navigated to destination without intermediate steps, <200ms transition (tightened from 300ms per NFR2)

---

**Accessibility ACs**

**AC-A1: Semantic HTML**

**Given** empty state displayed
**When** screen reader navigates
**Then** uses `<section aria-labelledby="heading-id">`, `<h2>` heading (not `<div>`), `<button>` or `<a>` CTA (not `<div>` with `onClick`), decorative icons have `alt=""` or `aria-hidden="true"`

---

**AC-A2: Keyboard-Accessible CTAs**

**Given** empty state CTA displayed
**When** navigating with keyboard
**Then** reachable via Tab, Enter/Space activates, visible focus with 4.5:1 contrast, descriptive `aria-label` if needed

---

**AC-A3: Keyboard-Only Workflow**

**Given** new user, no courses
**When** completing workflow with keyboard only
**Then** all actions (import, session, challenge) completable without mouse, within 2 minutes (NFR18)

---

**Mobile ACs**

**AC-M1: Mobile CTA Sizing**

**Given** on mobile/tablet (<1024px)
**When** empty state CTA displayed
**Then** button ≥44x44px, ≥8px spacing from adjacent elements

---

**AC-M2: Thumb Zone Placement**

**Given** on mobile (<640px)
**When** empty state with primary CTA displayed
**Then** CTA in bottom 30% (thumb zone) OR bottom sheet layout with CTA at bottom

---

**AC-M3: File System API Variant (Mobile)**

**Given** on mobile OR non-Chromium browser
**When** viewing "no courses" empty state
**Then** message: "Import courses from Chrome/Edge on desktop, or try our demo course"
**And** CTA text: "Load Demo Course" (not "Import Course")
**And** clicking loads sample course without File System Access

---

### Story 10.3: Onboarding Analytics & Instrumentation 🆕 NEW

**Effort:** 3-4 hours
**Priority:** P1 (High)
**Research:** Industry standard - 80% of non-completers churn day 1. Can't optimize without data.

As a product manager,
I want to track onboarding metrics and user activation,
So that I can measure onboarding effectiveness, identify drop-off points, and optimize the flow for higher completion and retention rates.

**Acceptance Criteria:**

**AC1: Core Onboarding Events Tracked**

**Given** user starts onboarding
**When** they interact with steps
**Then** events logged with timestamps:
- `onboarding_started`
- `onboarding_step_viewed` (properties: `step_number`, `step_name`)
- `onboarding_step_completed` (properties: `step_number`, `step_name`, `time_spent_seconds`)
- `onboarding_step_skipped` (properties: `step_number`, `step_name`)
- `onboarding_completed` (properties: `total_time_seconds`, `completion_timestamp`)
- `onboarding_abandoned` (properties: `last_step_number`, `time_elapsed_seconds`)

---

**AC2: Activation Events Tracked**

**Given** user completes onboarding
**When** they perform core actions within 7 days
**Then** activation events logged:
- `first_course_enrolled` (properties: `course_id`, `days_since_signup`)
- `first_study_session` (properties: `session_duration_seconds`, `days_since_signup`)
- `first_streak_milestone` (properties: `streak_days`, `days_since_signup`)
- `dashboard_customized` (properties: `customization_type`, `days_since_signup`)
- `profile_completed` (properties: `fields_completed`, `days_since_signup`)

---

**AC3: Rich Event Properties**

**Given** any event logged
**When** stored
**Then** includes:
- User: `user_id`, `signup_date`, `user_segment`
- Event: `timestamp`, `device_type`, `browser`, `viewport_size`
- Step-specific: As defined in AC1/AC2

---

**AC4: IndexedDB Event Storage**

**Given** event occurs
**When** logged
**Then** stored in IndexedDB `analytics_events` object store:
```typescript
{
  event_id: string // UUID
  event_name: string
  timestamp: number
  user_id: string
  user_properties: { signup_date, user_segment }
  event_properties: { step_number, device_type, etc. }
}
```
**And** duplicate prevention via event_id + timestamp

---

**AC5: Analytics Dashboard (Reports Page)**

**Given** I navigate to Reports page (or admin analytics)
**When** viewing onboarding analytics tab
**Then** see metrics:
- Onboarding completion rate (7/30 days)
- Average time-to-complete (median, p50/p90)
- Step-by-step funnel (completion rate per step, drop-off viz)
- Activation rate (users with ≥1 activation event within 7 days)
- Top abandonment points (steps with highest exit rate)

---

**AC6: Privacy & Opt-Out**

**Given** user opts out of tracking (future enhancement)
**When** interacting with onboarding
**Then** no events logged (respect `do_not_track`), existing events deletable on request

---

### Story 10.4: Mobile Onboarding Adaptation 🆕 NEW

**Effort:** 6-8 hours
**Priority:** P0 (Blocker) - File System API doesn't work on mobile
**Research:** 77% of mobile users abandon apps without good onboarding

As a mobile user,
I want a fully functional onboarding experience that works without desktop-only features,
So that I can discover the platform's core value and complete onboarding on any device.

**Acceptance Criteria:**

**AC1: Demo Course Auto-Creation**

**Given** platform detects mobile device OR non-Chromium browser
**When** onboarding starts
**Then** sample "Demo Course" auto-created with:
- Title: "LevelUp Demo Course"
- 3-5 sample videos (or placeholders)
- 1-2 sample PDFs
- Sample structure (sections/chapters)
- "Demo Course" badge (clearly labeled)
- Deletable like any other course

---

**AC2: Step 1 Auto-Completion (Mobile)**

**Given** on mobile
**When** onboarding reaches step 1 (Import)
**Then** step auto-completed using demo course
**And** message: "Demo course loaded! On desktop, you can import your own courses."
**And** advance to step 2 (Watch)

---

**AC3: Full Flow Completion (Mobile)**

**Given** on mobile
**When** completing all 5 steps with demo course
**Then** receive same completion badge as desktop users
**And** all features work normally with demo course (watch, note, dashboard, challenge)

---

**AC4: Desktop Prompt After Mobile Onboarding**

**Given** completed onboarding on mobile
**When** later visit on desktop browser
**Then** one-time prompt: "Import your own courses on desktop for the full experience!"
**And** "Import Courses" CTA
**And** dismissible permanently

---

**AC5: Demo Course Indicators**

**Given** viewing demo course in library
**When** see course card
**Then** displays "Demo Course" badge
**And** description: "This is a sample course. Import your own courses on desktop."

---

## Epic 11: Knowledge Retention, Export & Advanced Features (Post-MVP)

Users can schedule spaced reviews, export learning data in multiple formats, configure per-course reminders, and access advanced review modes — extending the platform for power users and data portability.

### Story 11.1: Spaced Review System

As a learner,
I want to schedule notes for spaced review using a difficulty rating and see a prioritized review queue,
So that I can retain knowledge more effectively by reviewing material at optimal intervals.

**Acceptance Criteria:**

**Given** a learner has completed reviewing a note
**When** they rate the note using the GradeButtons component (Hard / Good / Easy as a `role="radiogroup"` with `aria-label="Rate your recall"`, keyboard navigable with arrow keys)
**Then** the system records the rating and calculates the next review interval using the ts-fsrs library (Free Spaced Repetition Scheduler)
**And** each grade button shows the next review interval preview (e.g., "Hard — 1 day", "Good — 3 days", "Easy — 7 days")
**And** pressing a grade button shows color-coded flash feedback (red/blue/green) before advancing
**And** button states include default, hover (color intensifies), pressed (scale down), and disabled (during animation)

**Given** a learner has notes scheduled for spaced review
**When** they navigate to the ReviewQueue page (lazy-loaded route)
**Then** ReviewCard components display in a card stack with session progress indicator
**And** each ReviewCard shows the full note content (note-first philosophy, NOT flashcard Q&A), retention prediction badge, course name, and time since last review
**And** each card has `role="article"` with `aria-label="Review note: [title], retention: N%"`
**And** notes are sorted by predicted retention percentage (lowest retention first)

**Given** a learner rates a note that was previously reviewed
**When** the new rating is submitted
**Then** the system updates the FSRS parameters based on the cumulative review history and latest rating
**And** the review queue re-sorts to reflect the updated retention predictions
**And** a session summary appears after all due cards are reviewed

**Given** a learner has no notes due for review
**When** they open the review queue
**Then** the system displays an EmptyState component indicating no reviews are currently due
**And** shows the date and time of the next upcoming review

### Story 11.2: Knowledge Retention Dashboard

As a learner,
I want to see my knowledge retention status per topic and be alerted when my engagement is declining,
So that I can identify weak areas and re-engage before knowledge fades.

**Acceptance Criteria:**

**Given** a learner has reviewed notes across multiple topics
**When** they view the knowledge retention dashboard
**Then** each topic displays a retention level using design tokens: strong (`--color-review-easy`, ≤100% of review interval elapsed), fading (`--color-review-good`, 100-200% elapsed), or weak (`--color-review-hard`, >200% elapsed)
**And** each topic shows the time elapsed since the last review and estimated retention percentage from FSRS

**Given** a topic has not been reviewed within the expected interval
**When** the retention dashboard is rendered
**Then** the topic's retention level degrades from strong to fading to weak as time passes
**And** the visual indicator (color and label) updates to reflect the current retention state
**And** retention status is accessible with `aria-label` describing the state

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
