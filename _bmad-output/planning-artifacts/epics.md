---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
updateMode: 'incremental'
updateDate: '2026-03-26'
updateReason: 'YouTube Course Builder promoted to MVP (Epic 23): FR112-FR123, NFR69-NFR74, architecture addendum with 3-tier BYOK infrastructure'
editHistory:
  - date: '2026-03-07'
    scope: 'Architecture + UX updated to local-first AI'
    changes:
      - 'Full epic breakdown for Epics 1-20'
  - date: '2026-03-26'
    scope: 'YouTube Course Builder (Epic 23) incremental addition'
    changes:
      - 'Added 12 YouTube FRs (FR112-FR123) to Requirements Inventory'
      - 'Added 6 YouTube NFRs (NFR69-NFR74) to Requirements Inventory'
      - 'Added 6 UX Design Requirements (UX-DR1 to UX-DR6) from YouTube UX specification'
      - 'Added YouTube Architecture requirements from architecture addendum'
      - 'Added Epic 23 with stories to Epic List and FR Coverage Map'
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

**Platform & Entitlement (6 Requirements — Epic 19):**

- FR102: User can create an account with email and password for premium features
- FR103: User can subscribe to premium tier via Stripe Checkout
- FR104: System validates premium entitlement on app launch with 7-day offline cache
- FR105: User can view subscription status, manage billing via Stripe Customer Portal
- FR106: System displays upgrade CTAs for free-tier users with feature previews
- FR107: Premium code isolation in src/premium/ with separate build config

**Learning Pathways & Knowledge Retention (4 Requirements — Epic 20):**

- FR108: User can browse curated multi-course learning paths (Career Paths)
- FR109: User can create flashcards from notes with SM-2 spaced repetition
- FR110: User can view 365-day activity heatmap with 5-level color intensity
- FR111: User can view skill proficiency radar chart (5-7 domains)

**YouTube Course Builder (12 Requirements — Epic 23):**

- FR112: User can paste a YouTube video URL or playlist URL to initiate course creation (Free)
- FR113: System fetches video metadata (title, duration, thumbnail, description, chapters) via YouTube Data API v3 (Free)
- FR114: System fetches playlist contents ordered by playlist position; individual URLs grouped by submission order (Free)
- FR115: System analyzes video metadata via AI provider and proposes chapter groupings with ordered lessons; user reviews, edits, and confirms (Premium)
- FR116: When no AI provider configured, system groups videos by keyword similarity from titles/descriptions using playlist order within groups (Free)
- FR117: System extracts video transcripts via youtube-transcript for caption-available videos; stored locally and indexed for full-text search (Free)
- FR118: For captionless videos, system queues audio for Whisper transcription via user-configured endpoint; async with progress indicator, ≤60s per video (Premium)
- FR119: User can edit course structure (drag-reorder, rename chapters, add/remove videos, split/merge chapters) during creation and after save (Free)
- FR120: YouTube-sourced courses have full feature parity with local courses: progress tracking, notes, streaks, momentum, challenges, analytics (Free)
- FR121: System caches YouTube video metadata in IndexedDB with configurable TTL (7-day default); subsequent views use cached data (Free)
- FR122: User can view synchronized transcript panel alongside YouTube video, search within transcripts, and click segments to seek video (Free)
- FR123: System generates AI-powered course and per-video summaries from transcript data (Premium — extends FR48 to YouTube content)

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

**YouTube Integration (6 Requirements — Epic 23):**

- NFR69: YouTube API quota usage remains under 500 units/day for typical single-user workflow
- NFR70: Video metadata fetch completes within 3s per video; playlist metadata within 5s for up to 200 videos
- NFR71: Transcript extraction completes within 2s per video for caption-available content
- NFR72: YouTube API key follows same security treatment as AI API keys (NFR27, NFR52)
- NFR73: When YouTube API unavailable, cached metadata and transcripts remain accessible offline
- NFR74: YouTube course data stored entirely in IndexedDB; no transmission except to configured AI/Whisper endpoints

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

**From Architecture Document (YouTube Course Builder Addendum — 2026-03-25):**

- 3-tier BYOK server architecture: Tier 1 (youtube-transcript, zero-config, ~90% coverage), Tier 2 (yt-dlp on user server), Tier 3 (faster-whisper on user GPU server)
- Vite middleware plugin `youtubeDevProxy()` following established `ollamaDevProxy()` pattern for transcript/subtitle/whisper API routes
- YouTube Data API v3 calls direct from browser (CORS supported, API key client-side)
- Client-side token bucket rate limiter at 3 req/s; quota tracking with midnight PT reset; oEmbed fallback for quota exhaustion
- Hybrid source discriminator on shared Dexie tables (`importedCourses`, `importedVideos`) with `source: 'local' | 'youtube'` field for zero-code-change feature parity
- New Dexie tables: `youtube_video_cache` (TTL-managed metadata), `youtube_transcripts` (cue storage + full-text index), `youtube_import_queue` (async job tracking)
- Schema migration to v24 with backward-compatible optional fields on existing tables
- `react-youtube` for IFrame Player API wrapper; COEP `credentialless` instead of `require-corp` for SharedArrayBuffer + YouTube IFrame coexistence
- New `useYouTubeImportStore` Zustand store (separate from course import — fundamentally different network-based flow)
- SSRF protection: generalized `isAllowedProxyUrl()` shared between Ollama and YouTube server endpoints
- Transcript cleanup via existing `getLLMClient()` factory (proper punctuation, paragraph breaks, ASR error correction)
- Existing `TranscriptCue`, `TranscriptPanel`, `parseVTT()`, `useCaptionLoader`, `Chapter` types reused directly

### UX Design Requirements

**From UX Design Specification (YouTube Course Builder — 2026-03-25):**

- UX-DR1: YouTube import wizard with 4-step flow: Paste URL → Preview metadata → AI/rule-based structuring → Review & Edit → Confirm. Progressive disclosure keeps each step focused.
- UX-DR2: Embedded YouTube player with `react-youtube` wrapper providing consistent UI controls, timestamp note integration, and synchronized transcript panel matching local video player experience.
- UX-DR3: Drag-and-drop course structure editor with chapter groupings, video reordering, rename/remove/split/merge operations; keyboard-accessible alternatives for all drag interactions (WCAG 2.5.7).
- UX-DR4: Transcript panel with real-time highlight during playback, click-to-seek interaction, full-text search within transcripts, and expandable/collapsible segments.
- UX-DR5: Free vs. Premium feature differentiation with clear tier badges, graceful degradation when AI/Whisper unavailable, and upgrade CTAs that preview (not block) premium capabilities.
- UX-DR6: Offline graceful degradation — cached metadata and transcripts available for notes/search/progress; playback requires network; clear "offline" indicators on unavailable actions.

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
FR102: Epic 19 - Create account with email and password for premium features
FR103: Epic 19 - Subscribe to premium tier via Stripe Checkout
FR104: Epic 19 - Validate premium entitlement on app launch with 7-day offline cache
FR105: Epic 19 - View subscription status, manage billing via Stripe Customer Portal
FR106: Epic 19 - Display upgrade CTAs for free-tier users with feature previews
FR107: Epic 19 - Premium code isolation in src/premium/ with separate build config
FR108: Epic 20 - Browse curated multi-course learning paths (Career Paths)
FR109: Epic 20 - Create flashcards from notes with SM-2 spaced repetition
FR110: Epic 20 - View 365-day activity heatmap with 5-level color intensity
FR111: Epic 20 - View skill proficiency radar chart (5-7 domains)
FR112: Epic 23 - Paste YouTube video URL or playlist URL to initiate course creation
FR113: Epic 23 - Fetch video metadata via YouTube Data API v3
FR114: Epic 23 - Fetch playlist contents ordered by playlist position
FR115: Epic 23 - AI-powered chapter groupings with ordered lessons (Premium)
FR116: Epic 23 - Rule-based keyword similarity grouping fallback (Free)
FR117: Epic 23 - Extract video transcripts via youtube-transcript for caption-available videos
FR118: Epic 23 - Whisper transcription fallback for captionless videos (Premium)
FR119: Epic 23 - Edit course structure (drag-reorder, rename, add/remove, split/merge)
FR120: Epic 23 - Full feature parity with local courses (progress, notes, streaks, momentum)
FR121: Epic 23 - Cache YouTube metadata in IndexedDB with configurable TTL (7-day default)
FR122: Epic 23 - Synchronized transcript panel with search and click-to-seek
FR123: Epic 23 - AI-powered course and per-video summaries from transcript data (Premium)

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

### Epic 19: Platform & Entitlement

Users can create accounts, subscribe to premium features via Stripe, and manage their subscription — enabling the open-core business model while preserving full functionality of the free core.

**FRs covered:** FR102, FR103, FR104, FR105, FR106, FR107
**Phase:** Post-MVP (Open-Core Business Model)

### Epic 20: Learning Pathways & Knowledge Retention

Provide structured multi-course learning journeys with prerequisites, skill progression tracking, and long-term knowledge retention tools to drive course completion rates.

**FRs covered:** FR108, FR109, FR110, FR111
**Phase:** Post-MVP (Learning Pathways)

### Epic 23: YouTube Course Builder

Users can paste YouTube video URLs or playlist URLs to create structured courses with AI-powered chapter organization, transcript extraction for notes and search, synchronized transcript panel during playback, and full feature parity with local courses — turning YouTube's "Watch Later" graveyard into a managed learning library.

**FRs covered:** FR112, FR113, FR114, FR115, FR116, FR117, FR118, FR119, FR120, FR121, FR122, FR123
**NFRs addressed:** NFR69, NFR70, NFR71, NFR72, NFR73, NFR74
**UX-DRs addressed:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR6
**Phase:** MVP (Feature 12 — promoted from Vision 2026-03-25)
**Depends on:** Epic 1 (course data model), Epic 2 (player infrastructure), Epic 9 (AI infrastructure — for Premium features only)
**Architecture:** 3-tier BYOK server (youtube-transcript → yt-dlp → Whisper), source discriminator on shared Dexie tables, react-youtube IFrame wrapper, new useYouTubeImportStore

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
**Then** sidebar auto-closes (`localStorage 'knowlune-sidebar-v1' = 'false'`), remains closed until completion, restores after

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

---

## Epic 19: Platform & Entitlement

Users can create accounts, subscribe to premium features via Stripe, and manage their subscription — enabling the open-core business model while preserving full functionality of the free core.

**FRs covered:** FR102, FR103, FR104, FR105, FR106, FR107
**Phase:** Post-MVP (Open-Core Business Model)

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

**Dependencies:** None (foundation story)

**Technical Details:**
- Auth provider: Supabase Auth (see Architecture ADR)
- Files: `src/lib/auth/supabase.ts`, `src/stores/useAuthStore.ts`
- Session management handled by Supabase SDK (localStorage)
- Password requirements: minimum 8 characters (Supabase default)

**Error State ACs:**

**Given** I attempt to sign up or sign in
**When** the network is unavailable or the auth provider is unreachable
**Then** I see an error message: "Unable to connect. Please check your internet connection and try again."
**And** a "Retry" button is available
**And** all core features remain accessible

**Given** I am using magic link sign-in
**When** I click a link that has expired (>10 minutes) or was already used
**Then** I see an error message: "This link has expired or was already used. Please request a new one."
**And** a "Send New Link" button is available

**Loading State ACs:**

**Given** I submit any authentication form
**When** the request is in progress
**Then** the submit button shows a loading spinner and is disabled
**And** form inputs are disabled to prevent duplicate submissions

**Given** the app launches and I was previously signed in
**When** the session is being restored
**Then** a brief loading indicator appears (not blocking — core features load immediately)

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

**Dependencies:** Story 19.1 (authentication — Supabase JWT required for checkout session creation)

**Technical Details:**
- Checkout via Supabase Edge Function `create-checkout` (see Architecture ADR)
- Webhook handler: `supabase/functions/stripe-webhook/index.ts`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Test strategy: Stripe test mode API keys + `stripe trigger` CLI for webhook simulation

**Error State ACs:**

**Given** I click "Upgrade to Premium"
**When** the checkout session creation fails (network error, server error)
**Then** I see an error message: "Unable to start checkout. Please try again."
**And** I remain on the current page with no charge applied

**Given** I complete payment on Stripe Checkout
**When** the payment fails (card declined, insufficient funds, 3DS abandonment)
**Then** Stripe displays the error on the Checkout page
**And** I can retry with a different payment method or return to LevelUp
**And** no subscription is created

**Loading State ACs:**

**Given** I click "Upgrade to Premium"
**When** the checkout session is being created
**Then** the button shows a loading spinner and is disabled

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

**Dependencies:** Story 19.1 (auth — user identity for entitlement lookup), Story 19.2 (Stripe — subscription creates entitlement)

**Technical Details:**
- Entitlement hook: `src/lib/entitlement/isPremium.ts` → `useIsPremium()`
- Returns: `{ isPremium: boolean, loading: boolean, tier: 'free' | 'trial' | 'premium' }`
- Dexie table: `entitlements` (schema v3, see Architecture)
- Cache TTL: 7 days (configurable via `ENTITLEMENT_CACHE_TTL_DAYS` constant)
- Test strategy: use `FIXED_DATE` pattern for cache expiry tests

**Error State ACs:**

**Given** the app launches and I am online
**When** the entitlement validation endpoint is unreachable (network error, server 500)
**Then** the existing cached entitlement is honored (if cache exists and is <7 days old)
**And** no error is shown to the user (silent retry on next launch)

**Given** the app launches and I am online
**When** the entitlement validation returns an explicit denial (subscription cancelled/expired)
**Then** premium features are disabled immediately
**And** the cached entitlement is cleared
**And** I see a message with an option to resubscribe

**Loading State ACs:**

**Given** the app launches with a stale entitlement cache
**When** re-validation is in progress
**Then** premium features show a brief skeleton/loading state (not blocked — core features load immediately)

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

**Dependencies:** Story 19.1 (auth), Story 19.2 (Stripe — Customer Portal), Story 19.3 (entitlement — subscription status display)

**Technical Details:**
- Subscription data sourced from entitlement cache (Dexie) + Supabase Edge Function for fresh data
- "Manage Billing" → Edge Function `create-portal` → Stripe Customer Portal redirect
- Feature comparison: reference canonical tier matrix from open-core strategy document

**Error State ACs:**

**Given** I click "Manage Billing" or "Cancel Subscription"
**When** the Stripe Portal session creation fails
**Then** I see an error message: "Unable to open billing management. Please try again."
**And** a "Retry" button is available

**Given** I navigate to Settings > Subscription
**When** the subscription data cannot be loaded (offline, server error)
**Then** I see the last cached subscription status with a note: "Last updated [date]"
**And** "Manage Billing" and "Cancel" buttons are disabled with tooltip: "Requires internet connection"

**Loading State ACs:**

**Given** I navigate to Settings > Subscription
**When** subscription data is being fetched
**Then** a skeleton loader appears for plan details
**And** action buttons are disabled until data loads

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

**Dependencies:** Story 19.1 (auth — unauthenticated upgrade flow), Story 19.2 (Stripe — checkout redirect), Story 19.3 (entitlement — `useIsPremium()` hook)

**Technical Details:**
- Gating scope (this story): AI Summary button, AI Q&A panel, Spaced Review entry point (3 features)
- Remaining premium features gated in follow-up stories
- CTA component: `src/app/components/figma/UpgradeCTA.tsx`
- Uses `useIsPremium()` to conditionally render premium vs CTA

**Error State ACs:**

**Given** I click an upgrade CTA
**When** the Stripe Checkout session creation fails
**Then** I see an inline error near the CTA: "Unable to start upgrade. Please try again."
**And** the CTA remains clickable for retry

**Given** I click an upgrade CTA while unauthenticated
**When** the auth flow fails or is cancelled
**Then** I return to the page with the CTA still visible
**And** no upgrade is initiated

**AC for premium users:**

**Given** I have an active premium subscription
**When** I view a page with premium features
**Then** the premium features render fully (no CTA, no lock icon)
**And** no upgrade prompts are shown

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

**Dependencies:** Story 19.3 (entitlement — `useIsPremium()` used by premium gate)

**Technical Details:**
- Core build: `npm run build` (uses `vite.config.ts`)
- Premium build: `npm run build:premium` (uses `vite.config.premium.ts`)
- Import guard: Vite plugin that errors on `@/premium/*` imports during core build
- License header: `// SPDX-License-Identifier: LicenseRef-LevelUp-Premium` + full proprietary notice
- CI: core-only build verified in CI pipeline (premium directory excluded)

**Testing Requirements:**
- CI runs `npm run build` (core-only) and verifies no errors
- CI runs `npm run build:premium` and verifies premium components are included
- ESLint rule or Vite plugin test: verify that importing from `@/premium/` in a core file produces a build error

### Story 19.7: Legal Pages & Compliance

As a learner,
I want to review the Privacy Policy and Terms of Service before creating an account,
So that I understand how my data is handled and what I agree to when using premium features.

**Acceptance Criteria:**

**Given** I am on the sign-up page or Stripe Checkout
**When** I look for legal information
**Then** I see links to the Privacy Policy and Terms of Service

**Given** I navigate to `/privacy` or `/terms`
**When** the page loads
**Then** I see the full legal document with a table of contents, effective date, and clear section headings
**And** the page is accessible without logging in

**Given** the Privacy Policy or Terms of Service has been updated
**When** I visit the app after the effective date changes
**Then** I see a notification that the legal documents have been updated
**And** the notification includes a link to view the changes

**Dependencies:** Story 19.1 (auth — sign-up form links to legal pages), Story 19.2 (Stripe — Checkout page links)

**Technical Details:**
- Routes: `/privacy` and `/terms` as public routes (no auth required)
- Content format: MDX files in `src/app/pages/legal/` (rendered at build time)
- Effective date tracked via frontmatter `effectiveDate` field
- Change notification: compare `effectiveDate` against `localStorage.getItem('legal-acknowledged-date')`
- Stripe disclosure: reference https://stripe.com/docs/checkout/compliance

**Additional ACs:**

**Given** I am not logged in
**When** I navigate to `/privacy` or `/terms`
**Then** I can view the full legal page without being redirected to login

**Given** a material change has been made to the Privacy Policy or Terms
**When** I visit the app for the first time after the change
**Then** an in-app banner appears at the top of the page with a link to the updated document
**And** the banner has a "Dismiss" button that updates `localStorage` with the new effective date

### Story 19.8: Free Trial Flow

As a learner,
I want to try premium features for free before committing to a subscription,
So that I can evaluate whether the premium tier is worth paying for.

**Acceptance Criteria:**

**Given** I am authenticated and have never used a free trial
**When** I click "Start Free Trial" from an upgrade CTA or Settings
**Then** I am taken to Stripe Checkout with a 14-day trial configured
**And** a payment method is collected but not charged until the trial ends

**Given** I have an active trial
**When** I use the app
**Then** I see a trial indicator in the header showing days remaining
**And** all premium features are fully available

**Given** my trial has 3 days or fewer remaining
**When** I open the app
**Then** I see a reminder banner encouraging me to subscribe
**And** the reminder can be dismissed (shows again the next calendar day)

**Given** my trial expires
**When** the trial period ends
**Then** Stripe automatically charges the payment method on file
**And** if the charge succeeds, my subscription converts to premium seamlessly

**Given** I want to cancel my trial
**When** I navigate to Settings > Subscription and click "Cancel Trial"
**Then** the trial ends and no charge is applied
**And** premium features revert to showing upgrade CTAs

**Dependencies:** Story 19.1 (auth), Story 19.2 (Stripe — trial checkout), Story 19.3 (entitlement — trial tier), Story 19.4 (subscription management — cancel trial)

**Technical Details:**
- Trial configured via Stripe Checkout `subscription_data.trial_period_days: 14`
- Trial status is an entitlement tier: `tier: 'trial'` (distinct from `'premium'`)
- Trial indicator component: `src/app/components/figma/TrialIndicator.tsx` (header bar, right-aligned before notification bell)
- Reminder state: `localStorage.getItem('trial-reminder-dismissed-date')` — show max once per calendar day
- Test strategy: Stripe test clocks for trial lifecycle; `FIXED_DATE` pattern for countdown UI tests
- One trial per Stripe customer: enforced by checking `customer.subscriptions` for prior trial history before creating checkout session

**Error State ACs:**

**Given** I click "Start Free Trial"
**When** the checkout session creation fails
**Then** I see an error message: "Unable to start trial. Please try again."
**And** no payment method is collected

**Given** my trial has expired
**When** Stripe attempts the first charge and payment fails
**Then** premium features are disabled
**And** I see a message: "Your payment could not be processed. Please update your payment method to continue using premium features."
**And** a "Update Payment Method" button opens Stripe Customer Portal

**Trial uniqueness AC:**

**Given** I have previously used a free trial (on this Stripe customer record)
**When** I click "Start Free Trial" or "Upgrade to Premium"
**Then** I am taken directly to a paid checkout (no trial option)
**And** the UI reflects "Subscribe" not "Start Free Trial"

**Grace period AC:**

**Given** my trial end date has passed
**When** Stripe is processing the first charge (up to 1 hour after trial end)
**Then** premium features remain active during this grace period
**And** if the charge succeeds, premium continues seamlessly
**And** if the charge fails, premium is disabled after the grace period

### Story 19.9: GDPR Compliance & Account Lifecycle

As a learner,
I want to delete my account and all associated data,
So that I can exercise my right to erasure and control my personal information.

**Acceptance Criteria:**

**Given** I navigate to Settings > Account
**When** I click "Delete My Account"
**Then** I see a confirmation dialog explaining the consequences (data deletion, subscription cancellation)
**And** I must type "DELETE" to confirm

**Given** I confirm account deletion
**When** the deletion is processed
**Then** my Stripe subscription is cancelled, my Stripe customer record is deleted, and my Supabase auth account is removed
**And** my local entitlement cache is cleared
**And** I am signed out and see a confirmation message

**Given** I navigate to Settings > Account > My Data
**When** the page loads
**Then** I see a summary of my account data (email, subscription history, account creation date)
**And** I can export this data alongside my learning data export

**Dependencies:** Story 19.1 (auth — account identity), Story 19.2 (Stripe — customer deletion), Story 19.3 (entitlement — cache clearing)

**Technical Details:**
- Deletion endpoint: Supabase Edge Function `delete-account`
- Sequence: (1) Cancel Stripe subscription, (2) Delete Stripe customer, (3) Delete Supabase auth user, (4) Clear local entitlement cache
- Stripe retention: `stripe.customers.del()` marks customer as deleted; Stripe retains records per legal obligations (7+ years for tax). The AC reflects "deleted from LevelUp's perspective" not "deleted from Stripe's servers"
- Re-authentication: require password re-entry (or recent OAuth) before deletion (session must be <5 minutes old)
- Grace period: 7-day soft-delete — account marked for deletion, actual deletion after 7 days. User can cancel during grace period by signing in.
- Data export: extends existing export (FR85) with account-specific data (email, subscription history)

**Error State ACs:**

**Given** I confirm account deletion
**When** the Stripe customer deletion fails (open invoice, API error)
**Then** the deletion is aborted — no partial state
**And** I see an error message: "Account deletion failed. Please resolve any open invoices and try again."
**And** my account and subscription remain active

**Given** I confirm account deletion
**When** the auth provider deletion fails after Stripe succeeds
**Then** the system retries auth deletion up to 3 times
**And** if all retries fail, the account is flagged for manual admin review
**And** I see a message: "Account deletion is being processed. You will receive confirmation within 48 hours."

**Loading State ACs:**

**Given** I confirm account deletion by typing "DELETE"
**When** the deletion is in progress
**Then** a progress indicator shows the current step: "Cancelling subscription..." → "Removing account data..." → "Complete"
**And** all actions are disabled during processing

**Re-authentication AC:**

**Given** I click "Delete My Account"
**When** my session is older than 5 minutes
**Then** I am prompted to re-enter my password (or re-authenticate via OAuth)
**Before** the deletion confirmation dialog appears

---

## Epic 20: Learning Pathways & Knowledge Retention

Provide structured multi-course learning journeys with prerequisites, skill progression tracking, and long-term knowledge retention tools to drive course completion rates.

**FRs covered:** FR108, FR109, FR110, FR111
**Phase:** Post-MVP (Learning Pathways)
**Total Effort:** 62 hours over 6-8 weeks

**Stories:**
1. **E20-S01**: Career Paths System (Multi-Course Journeys) - 16h
2. **E20-S02**: Flashcard System with Spaced Repetition - 12h
3. **E20-S03**: 365-Day Activity Heatmap - 4h
4. **E20-S04**: Skill Proficiency Radar Chart - 6h
5. **E20-S05**: FSRS Configuration & Learning Analytics Dashboard - 8h
6. **E20-S06**: Skill Development System (Gap Analysis & Recommendations) - 10h
7. **E20-S07**: Flashcard Management & Organization - 6h

### Story 20.1: Career Paths System (Multi-Course Journeys)

As a learner without a clear learning direction,
I want to enroll in curated multi-course learning paths (e.g., "Web Development", "Data Science"),
So that I have a structured journey with prerequisites and skill progression tracking.

**Acceptance Criteria:**

**AC1: Browse Career Paths**
**Given** I am on the Career Paths page
**When** The page loads
**Then** I see a list of 3-5 curated paths with title, description, course count, estimated hours, and progress %
**And** Each path card shows an overview of the learning journey

**AC2: View Path Detail**
**Given** I click on a career path card
**When** The detail page loads
**Then** I see staged progression (e.g., Stage 1: Foundations, Stage 2: Frameworks)
**And** Each stage shows course cards with title, duration, and completion status
**And** The overall path progress percentage is displayed at the top

**AC3: Enroll in a Path**
**Given** I am viewing a career path detail page
**When** I click the "Start Path" button
**Then** My enrollment is saved to IndexedDB (`path_enrollments` table)
**And** The button changes to "Continue Path"
**And** The path appears in my "Active Paths" section on Overview

**AC4: Track Progress**
**Given** I have enrolled in a career path
**When** I complete a course that is part of the path
**Then** The course shows a green checkmark in the path detail view
**And** The overall path progress percentage updates
**And** The course card visually indicates completion (green border/background)

**AC5: Prerequisite Enforcement**
**Given** I am viewing a career path with multiple stages
**When** Stage 1 is not 100% complete
**Then** Stage 2 courses are locked/disabled
**And** A clear message explains "Complete Stage 1 to unlock Stage 2"
**And** Locked courses have a visual indicator (lock icon, grayed out)

**AC6: Course Navigation**
**Given** I am viewing an unlocked course in a career path
**When** I click the course card
**Then** I navigate to the course detail page
**And** I can start the first lesson or resume where I left off

**AC7: Data Model Integrity**
**Given** The `career_paths` and `path_enrollments` tables exist in Dexie
**When** I enroll in a path
**Then** A record is created in `path_enrollments` with `pathId`, `userId` (or device ID), `enrolledAt`, `lastAccessedAt`
**And** Progress is calculated dynamically from course completion data

**Technical Notes:**
- **Files to Create:** `src/app/pages/CareerPaths.tsx`, `src/app/pages/CareerPathDetail.tsx`, `src/lib/services/careerPathService.ts`, `src/stores/useCareerPathStore.ts`
- **Files to Modify:** `src/db/schema.ts` (Dexie v7: `career_paths`, `path_enrollments`), `src/app/routes.tsx`, `src/app/components/Layout.tsx`

**Effort:** 16 hours

---

### Story 20.2: Flashcard System with Spaced Repetition

As a learner who forgets concepts after completing courses,
I want to create flashcards from my notes and review them using spaced repetition,
So that I retain knowledge long-term.

**Acceptance Criteria:**

**AC1: Create Flashcard from Note**
**Given** I am viewing the Notes page
**When** I select text in a note and click "Create Flashcard"
**Then** A dialog opens with "Front" and "Back" input fields
**And** The selected text is pre-filled in the "Front" field

**AC2: Save Flashcard**
**Given** I have filled in front and back content
**When** I click "Save Flashcard"
**Then** The flashcard is saved to IndexedDB (`flashcards` table)
**And** A review schedule is created using the FSRS algorithm (initial interval = 1 day)
**And** The flashcard is linked to the source note and course

**AC3: View Review Queue**
**Given** I have flashcards with scheduled reviews
**When** I navigate to the Flashcards page
**Then** I see a review queue showing cards due today sorted by retention prediction (lowest first)
**And** The queue shows a progress indicator: "3 of 12 cards reviewed"

**AC4: Review Flashcard**
**Given** I am viewing a flashcard in the review queue
**When** The card appears
**Then** I see the front content (question/prompt)
**And** I can reveal the back content by clicking "Show Answer"
**And** The card shows course context (course name, note title)

**AC5-AC7: Grade Flashcard (Hard/Good/Easy)**
**Given** I have revealed the back content
**When** I click Hard, Good, or Easy
**Then** The FSRS algorithm updates `easeFactor` and `interval`
**And** The card is rescheduled accordingly (1 day / normal / extended)
**And** The next card in the queue is shown

**AC8: Review Session Complete**
**Given** I have reviewed all cards in the queue
**When** The last card is graded
**Then** A completion summary appears with grade breakdown

**AC9: FSRS Algorithm Integration**
**Given** The `ts-fsrs` library is integrated
**When** A flashcard is graded
**Then** The FSRS algorithm calculates the next review date based on previous interval, ease factor, and grade

**Technical Notes:**
- **Files to Create:** `src/app/pages/Flashcards.tsx`, `src/lib/services/fsrsService.ts`, `src/app/components/figma/ReviewCard.tsx`, `src/app/components/figma/GradeButtons.tsx`, `src/stores/useSpacedRepStore.ts`
- **Files to Modify:** `src/db/schema.ts` (Dexie v8: `flashcards`, `review_schedule`), `src/app/pages/Notes.tsx`, `src/app/routes.tsx`

**Effort:** 12 hours

---

### Story 20.3: 365-Day Activity Heatmap

As a learner who values consistency,
I want to see a GitHub-style contribution graph of my study activity for the past year,
So that I can visualize my learning habits and identify gaps.

**Acceptance Criteria:**

**AC1: Heatmap Display**
**Given** I am on the Overview or Reports page
**When** The page loads
**Then** I see a 365-day calendar grid (52 weeks × 7 days) with 5-level warm color gradient

**AC2: Heatmap Data Aggregation**
**Given** I have study sessions logged
**When** The heatmap renders
**Then** Each cell's color intensity reflects total study time (0 min, 1-15, 16-30, 31-60, 60+)

**AC3: Hover Tooltip**
**Given** I hover over a heatmap cell
**Then** A tooltip shows date, study time, and notes taken count

**AC4: Responsive Heatmap**
Desktop (≥1024px): 12-month view; Tablet (640-1023px): 6-month view; Mobile (<640px): 3-month view

**AC5: Accessibility**
Heatmap has `role="img"` and `aria-label`, keyboard navigable with arrow keys, 3:1 contrast between levels

**AC6: Empty State**
All cells neutral gray with message: "Study for a few days and your heatmap will fill in!"

**Technical Notes:**
- **Files to Create:** `src/app/components/figma/ActivityHeatmap.tsx`
- **Files to Modify:** `src/app/pages/Reports.tsx`, `src/app/pages/Overview.tsx`

**Effort:** 4 hours

---

### Story 20.4: Skill Proficiency Radar Chart

As a learner tracking skill development,
I want to see a spider chart of my proficiency across different domains,
So that I can identify strengths and areas for improvement.

**Acceptance Criteria:**

**AC1: Radar Chart Display**
**Given** I am on the Overview dashboard
**When** The page loads
**Then** I see a radar chart with 5-7 skill axes using warm color fill with semi-transparency

**AC2: Proficiency Calculation**
Proficiency = (Completed courses in domain / Total courses in domain) × 100

**AC3: Chart Interaction**
Hover tooltip showing skill name, proficiency percentage, completed course count

**AC4: Skill Taxonomy**
Tags mapped to skill domains (Design, Coding, Marketing, Business, Soft Skills)

**AC5-AC6: Responsiveness & Accessibility**
Chart scales proportionally; `role="img"`, data table alternative, 3:1 contrast

**AC7: Empty State**
All axes at 0% with message: "Complete courses to build your skill profile!"

**Technical Notes:**
- **Files to Create:** `src/app/components/figma/SkillRadarChart.tsx` (uses Recharts)
- **Files to Modify:** `src/app/pages/Overview.tsx`

**Effort:** 6 hours

---

### Story 20.5: FSRS Configuration & Learning Analytics Dashboard

As a learner optimizing my knowledge retention,
I want to configure my spaced repetition parameters and view comprehensive learning analytics,
So that I can tune my review schedule and track my learning performance holistically.

**Acceptance Criteria:**

**AC1: FSRS Settings Page**
Slider for desired retention rate (70-97%) with explanations, optimization progress, reset button

**AC2: Save FSRS Configuration**
Persisted to IndexedDB, future intervals recalculated

**AC3: Unified Analytics Dashboard**
Activity Heatmap + Skill Radar + Learning Velocity Chart on single page

**AC4: Learning Velocity Trends (FR78)**
Three trend lines: completion rate, content per hour, week-over-week acceleration

**AC5: FSRS Performance Metrics Card**
Reviews saved, retention rate achieved, card difficulty distribution

**AC6: Review History Timeline**
Bar chart of reviews per day with retention prediction overlay (90 days)

**AC7-AC8: Data Export**
JSON/CSV export with schema version, completes in <30 seconds, ≥95% re-import fidelity

**Technical Notes:**
- **Files to Create:** `src/app/pages/Analytics.tsx`, `src/app/pages/Settings/FSRSSettings.tsx`, `src/app/components/figma/LearningVelocityChart.tsx`, `src/app/components/figma/FSRSMetricsCard.tsx`, `src/lib/services/analyticsExportService.ts`
- **Files to Modify:** `src/lib/services/fsrsService.ts`, `src/lib/services/analyticsService.ts`, `src/db/schema.ts` (Dexie v9), `src/app/routes.tsx`

**Effort:** 8 hours

---

### Story 20.6: Skill Development System (Gap Analysis & Recommendations)

As a learner with specific skill goals,
I want to set target proficiency levels, analyze skill gaps, and receive course recommendations,
So that I can systematically close skill gaps and track my growth over time.

**Acceptance Criteria:**

**AC1: Set Target Proficiency Goals**
Modal with slider to set target per skill domain, persisted to IndexedDB

**AC2: Radar Chart with Target Overlay**
Solid filled area (current) + dotted outline (target) with legend

**AC3: Skill Gap Analysis Summary**
Skills sorted by gap size, suggested actions, checkmark for achieved targets

**AC4: Course Recommendations**
Courses filtered by skill domain, sorted by proficiency improvement potential

**AC5: Historical Skill Progression**
12-month time-series line chart with monthly snapshots per skill domain

**AC6: Skill Progression Snapshots**
Monthly background task records proficiency snapshot to IndexedDB

**AC7: Proficiency Level Definitions**
Beginner (0-33%), Intermediate (34-66%), Expert (67-100%) with level-up notifications

**AC8: Prerequisite Validation for Career Paths**
Warning banner when skill prerequisites not met, recommended courses to reach level

**Technical Notes:**
- **Files to Create:** `src/app/pages/SkillDevelopment.tsx`, `src/app/components/figma/SkillGapAnalysis.tsx`, `src/app/components/figma/SkillProgressionChart.tsx`, `src/lib/services/skillRecommendationService.ts`, `src/lib/services/skillSnapshotService.ts`
- **Files to Modify:** `src/app/components/figma/SkillRadarChart.tsx` (target overlay), `src/lib/services/careerPathService.ts`, `src/db/schema.ts` (Dexie v10: `skill_targets`, `skill_snapshots`)

**Effort:** 10 hours

---

### Story 20.7: Flashcard Management & Organization

As a learner with a large flashcard collection,
I want to organize cards with tags, search/filter them, and import/export decks,
So that I can efficiently manage my flashcards and migrate data when needed.

**Acceptance Criteria:**

**AC1: Tag System for Flashcards**
Tag input on create dialog (reusing note tag system), badges on review screen

**AC2: Filter Review Queue by Tag**
Tag filter dropdown, filtered queue with updated progress indicator

**AC3: Search Flashcards by Content**
Full-text search on front/back with highlighted results

**AC4: Advanced Filters**
Filter by tag, course, difficulty, next review date (combinable)

**AC5: Bulk Import from CSV**
CSV validation, import summary, initial FSRS state

**AC6: Bulk Export to CSV/JSON**
Export with FSRS metadata, ≥95% semantic fidelity on re-import

**AC7: Card Templates**
Definition, Code Snippet, Question/Answer templates with pre-filled placeholders

**AC8: Card Difficulty Prediction**
Easy (≥7 days), Medium (2-6 days), Hard (≤1 day) badges based on FSRS interval

**Technical Notes:**
- **Files to Create:** `src/app/pages/FlashcardLibrary.tsx`, `src/app/components/figma/FlashcardSearch.tsx`, `src/app/components/figma/CardTemplateSelector.tsx`, `src/lib/services/flashcardImportService.ts`, `src/lib/services/flashcardExportService.ts`
- **Files to Modify:** `src/app/pages/Flashcards.tsx`, `src/db/schema.ts`, `src/lib/services/fsrsService.ts`, `src/app/components/figma/ReviewCard.tsx`

**Effort:** 6 hours

---

# Quiz & Assessment System


# Quiz & Assessment System - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for the **Quiz & Assessment System**, decomposing the requirements from the PRD, UX Design Specification, and Architecture requirements into implementable stories following the LevelUp story development workflow.

This is a brownfield integration extending the existing LevelUp learning platform with comprehensive formative assessment capabilities.

## Requirements Inventory

### Functional Requirements

**Quiz Taking & Navigation (QFR1-QFR8)**

- QFR1: Learners can start a quiz from a course lesson
- QFR2: Learners can navigate between questions in any order during quiz
- QFR3: Learners can mark questions for review before submitting
- QFR4: Learners can pause a quiz and resume later without losing progress
- QFR5: Learners can submit completed quiz for scoring
- QFR6: Learners can retake any quiz unlimited times with no cooldown period
- QFR7: Learners can review all questions and answers after quiz completion
- QFR8: Learners can exit quiz without submitting (progress auto-saved)

**Question Management & Presentation (QFR9-QFR15)**

- QFR9: System can present Multiple Choice questions with 2-6 answer options
- QFR10: System can present True/False questions
- QFR11: System can present Multiple Select questions (select all that apply)
- QFR12: System can present Fill-in-Blank questions with text input
- QFR13: System can randomize question order for each quiz attempt
- QFR14: System can display question progress indicator (e.g., "Question 5 of 12")
- QFR15: System can display question text with rich formatting (code blocks, lists, emphasis)

**Scoring & Feedback (QFR16-QFR23)**

- QFR16: System can calculate partial credit for each question (0-100% granular scoring)
- QFR17: System can calculate total quiz score as percentage of possible points
- QFR18: System can provide immediate explanatory feedback per question upon answer selection
- QFR19: System can display correct answer explanation for incorrect responses
- QFR20: System can provide performance summary after quiz completion
- QFR21: System can highlight learner's strongest topic areas in performance summary
- QFR22: System can identify growth opportunity topics in performance summary
- QFR23: System can display encouraging, non-judgmental messaging regardless of score

**Timer & Pacing (QFR24-QFR30)**

- QFR24: System can display countdown timer during quiz
- QFR25: Learners can configure timer duration before starting quiz
- QFR26: Learners can enable timer accommodations (150-200% time extensions)
- QFR27: System can provide timer warnings at configurable thresholds (default: 75%, 90%)
- QFR28: System can announce timer warnings for screen reader users
- QFR29: Learners can disable timer for untimed practice mode
- QFR30: System can track time-to-completion for each quiz attempt

**Performance Analytics & Tracking (QFR31-QFR40)**

- QFR31: System can store score history for all quiz attempts
- QFR32: System can calculate score improvement between first and most recent attempt
- QFR33: System can display improvement trajectory graph (score vs. attempt number)
- QFR34: System can calculate normalized gain using Hake's formula
- QFR35: System can track quiz completion rate (completed / started)
- QFR36: System can track average retake frequency per quiz
- QFR37: System can display time-on-task metrics per quiz attempt
- QFR38: System can identify learning trajectory patterns (exponential, linear, logarithmic)
- QFR39: System can calculate item difficulty (P-values) for each question
- QFR40: System can calculate discrimination indices (point-biserial correlation) for questions

**Accessibility & Accommodations (QFR41-QFR48)**

- QFR41: Learners can navigate entire quiz interface using keyboard only (Tab, Enter, Space, Arrow keys)
- QFR42: System can announce dynamic content updates via ARIA live regions for screen readers
- QFR43: Learners can configure accessibility settings before quiz starts
- QFR44: System can provide focus indicators with 4.5:1 contrast ratio on all interactive elements
- QFR45: System can maintain semantic HTML structure for assistive technology compatibility
- QFR46: System can support screen readers (NVDA, JAWS, VoiceOver)
- QFR47: Learners can export quiz results for external review
- QFR48: System can ensure 4.5:1 minimum contrast ratio for text, 3:1 for UI components

**Data Persistence & Recovery (QFR49-QFR54)**

- QFR49: System can auto-save quiz progress to localStorage every answer selection
- QFR50: System can recover incomplete quiz from localStorage after browser crash
- QFR51: System can store quiz history in IndexedDB for analytics queries
- QFR52: System can persist quiz state across browser sessions
- QFR53: System can handle localStorage quota exceeded errors gracefully
- QFR54: System can prevent data loss during quiz submission

**Platform Integration (QFR55-QFR61)**

- QFR55: System can trigger study streak update upon quiz completion
- QFR56: System can display quiz performance data in Overview progress dashboard
- QFR57: System can surface quiz analytics in Reports section
- QFR58: Courses page can display quiz availability badges per lesson
- QFR59: Settings page can provide quiz preference configuration (timer defaults, accessibility options)
- QFR60: System can integrate quiz completion events with existing progress tracking
- QFR61: System can associate quizzes with specific course lessons in navigation

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
- Encouraging, non-judgmental tone in all UI copy (QFR23)
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
| QFR1 | Epic 12 | Start quiz from lesson |
| QFR2 | Epic 13 | Navigate between questions |
| QFR3 | Epic 13 | Mark questions for review |
| QFR4 | Epic 13 | Pause and resume quiz |
| QFR5 | Epic 12 | Submit quiz for scoring |
| QFR6 | Epic 13 | Unlimited retakes |
| QFR7 | Epic 13 | Review Q&A after completion |
| QFR8 | Epic 13 | Exit without submitting (auto-save) |
| QFR9 | Epic 12 | Multiple Choice questions |
| QFR10 | Epic 14 | True/False questions |
| QFR11 | Epic 14 | Multiple Select questions |
| QFR12 | Epic 14 | Fill-in-Blank questions |
| QFR13 | Epic 13 | Randomize question order |
| QFR14 | Epic 12 | Question progress indicator |
| QFR15 | Epic 14 | Rich text formatting |
| QFR16 | Epic 12 | Partial credit calculation |
| QFR17 | Epic 12 | Total score percentage |
| QFR18 | Epic 15 | Immediate explanatory feedback |
| QFR19 | Epic 15 | Correct answer explanation |
| QFR20 | Epic 15 | Performance summary |
| QFR21 | Epic 15 | Highlight strongest topics |
| QFR22 | Epic 15 | Identify growth opportunities |
| QFR23 | Epic 15 | Encouraging messaging |
| QFR24 | Epic 15 | Countdown timer display |
| QFR25 | Epic 15 | Configure timer duration |
| QFR26 | Epic 15 | Timer accommodations |
| QFR27 | Epic 15 | Timer warnings |
| QFR28 | Epic 15 | Timer announcements (screen reader) |
| QFR29 | Epic 15 | Disable timer (untimed mode) |
| QFR30 | Epic 15 | Time-to-completion tracking |
| QFR31 | Epic 16 | Store score history |
| QFR32 | Epic 16 | Calculate score improvement |
| QFR33 | Epic 16 | Improvement trajectory graph |
| QFR34 | Epic 16 | Normalized gain (Hake's formula) |
| QFR35 | Epic 17 | Quiz completion rate |
| QFR36 | Epic 17 | Average retake frequency |
| QFR37 | Epic 17 | Time-on-task metrics |
| QFR38 | Epic 17 | Learning trajectory patterns |
| QFR39 | Epic 17 | Item difficulty (P-values) |
| QFR40 | Epic 17 | Discrimination indices |
| QFR41 | Epic 18 | Keyboard-only navigation |
| QFR42 | Epic 18 | ARIA live regions |
| QFR43 | Epic 18 | Accessibility settings |
| QFR44 | Epic 18 | Focus indicators (4.5:1 contrast) |
| QFR45 | Epic 18 | Semantic HTML |
| QFR46 | Epic 18 | Screen reader support |
| QFR47 | Epic 18 | Export quiz results |
| QFR48 | Epic 18 | Contrast ratios (4.5:1 text, 3:1 UI) |
| QFR49 | Epic 12 | Auto-save to localStorage |
| QFR50 | Epic 12 | Crash recovery |
| QFR51 | Epic 12 | Store history in IndexedDB |
| QFR52 | Epic 12 | Persist across sessions |
| QFR53 | Epic 13 | Handle quota exceeded |
| QFR54 | Epic 12 | Prevent data loss on submit |
| QFR55 | Epic 18 | Study streak update |
| QFR56 | Epic 18 | Dashboard integration |
| QFR57 | Epic 18 | Reports section integration |
| QFR58 | Epic 18 | Courses page badges |
| QFR59 | Epic 18 | Settings preferences |
| QFR60 | Epic 18 | Progress tracking integration |
| QFR61 | Epic 18 | Lesson navigation links |

_Epics 12-18 merged from docs/planning-artifacts/epics.md on 2026-03-25._

## Epic List

### Epic 12: Take Basic Quizzes
Learners can start a quiz from a lesson, answer multiple-choice questions, submit for scoring, and see their results.
**FRs covered:** QFR1, QFR5, QFR9, QFR14, QFR16, QFR17, QFR49, QFR50, QFR51, QFR52, QFR54

### Epic 13: Navigate and Control Quiz Flow
Learners can navigate between questions in any order, pause and resume quizzes, mark questions for review, and safely exit without losing progress.
**FRs covered:** QFR2, QFR3, QFR4, QFR6, QFR7, QFR8, QFR13, QFR53

### Epic 14: Practice with Diverse Question Types
Learners can practice with True/False, Multiple Select, and Fill-in-Blank questions in addition to Multiple Choice.
**FRs covered:** QFR10, QFR11, QFR12, QFR15

### Epic 15: Timed Quizzes with Enhanced Feedback
Learners can take timed quizzes with countdown timers, configurable accommodations, warnings, and receive immediate explanatory feedback.
**FRs covered:** QFR18, QFR19, QFR20, QFR21, QFR22, QFR23, QFR24, QFR25, QFR26, QFR27, QFR28, QFR29, QFR30

### Epic 16: Review Performance and Track Improvement
Learners can review quiz results, see detailed performance summaries, track score improvement across attempts, and visualize learning trajectories.
**FRs covered:** QFR31, QFR32, QFR33, QFR34

### Epic 17: Analyze Quiz Data and Patterns
Learners can see detailed analytics including completion rates, retake frequency, time metrics, learning patterns, item difficulty, and discrimination indices.
**FRs covered:** QFR35, QFR36, QFR37, QFR38, QFR39, QFR40

### Epic 18: Accessible and Integrated Quiz Experience
All learners can access quiz features via keyboard and screen readers (WCAG 2.1 AA+). Quiz data integrates across the LevelUp platform.
**FRs covered:** QFR41, QFR42, QFR43, QFR44, QFR45, QFR46, QFR47, QFR48, QFR55, QFR56, QFR57, QFR58, QFR59, QFR60, QFR61

---

## Epic 12: Take Basic Quizzes

**Goal:** Learners can start a quiz from a lesson, answer multiple-choice questions, submit for scoring, and see their results.

**Technical Foundation:** This epic establishes the complete quiz infrastructure needed for all future epics (13-18) — type definitions, Dexie schema, Zustand store, routing, and a minimal working quiz experience.

**QFRs Covered:** QFR1, QFR2, QFR4, QFR5, QFR6, QFR9, QFR17, QFR23, QFR49, QFR50, QFR52, QFR55 (partial — quiz entry, MC questions, scoring, results, data persistence, basic progress integration)

**Note on QFR numbering:** Quiz functional requirements (QFR1-QFR61) are defined in `docs/planning-artifacts/quiz-ux-design-specification.md`, not the main PRD. All story traceability maps to QFR numbers.

### Story 12.1: Create Quiz Type Definitions

As a developer,
I want Quiz, Question, and QuizAttempt TypeScript interfaces with Zod validation,
So that I have type safety and runtime validation for quiz data throughout the application.

**FRs Fulfilled:** QFR9 (MC type), QFR10 (TF type), QFR11 (MS type), QFR12 (FIB type), QFR49 (data structure)

**Acceptance Criteria:**

**Given** quiz data requirements from the quiz UX design specification
**When** I create `src/types/quiz.ts`
**Then** it exports all required TypeScript interfaces (Quiz, Question, QuizAttempt, Answer, QuizProgress, QuestionMedia)
**And** all properties match the quiz UX specification
**And** Zod schemas are defined for runtime validation using `.safeParse()` (returns result objects, never throws)
**And** QuestionType enum includes all 4 types: 'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-in-blank'
**And** JSDoc comments document each interface and property
**And** types are importable from other modules using `@/types/quiz`

**Given** the Question interface
**When** defining the `correctAnswer` property
**Then** it supports both `string` and `string[]` types for polymorphic question handling
**And** the `options` property is optional (not needed for fill-in-blank)
**And** the `media` property uses the `QuestionMedia` type: `{ type: 'image' | 'video' | 'audio'; url: string; alt?: string }`

**Given** the QuizProgress interface
**When** defining progress state for crash recovery
**Then** it includes `markedForReview: string[]` for question flagging (per UX spec)
**And** it includes `questionOrder: string[]` to persist shuffled question sequence
**And** it includes `timerAccommodation: 'standard' | '150%' | '200%' | 'untimed'`

**Given** the Quiz interface
**When** defining the `passingScore` property
**Then** it is a percentage value constrained to 0-100 via Zod: `z.number().min(0).max(100)`

**Technical Details:**

Files to create:
- `src/types/quiz.ts` — New file justified because quiz types span 7 epics (12-18) with 61 QFRs. Keeping them separate from `src/data/types.ts` prevents bloating the existing types file and provides clear module boundaries for the quiz subsystem.

Type interfaces to define:
- `QuestionType` enum: 'multiple-choice' | 'true-false' | 'multiple-select' | 'fill-in-blank'
- `QuestionMedia` interface: `{ type: 'image' | 'video' | 'audio'; url: string; alt?: string }`
- `Question` interface: id, order, type, text, options (optional), correctAnswer (string | string[]), explanation, points, media (QuestionMedia, optional)
- `Quiz` interface: id, lessonId, title, description, questions, timeLimit (number | null), passingScore (0-100), allowRetakes, shuffleQuestions, shuffleAnswers, createdAt, updatedAt
- `Answer` interface: questionId, userAnswer (string | string[]), isCorrect, pointsEarned, pointsPossible
- `QuizAttempt` interface: id, quizId, answers, score, percentage, passed, timeSpent, completedAt, startedAt, timerAccommodation
- `QuizProgress` interface: quizId, currentQuestionIndex, answers (Record<string, string | string[]>), startTime, timeRemaining (number | null), isPaused, markedForReview (string[]), questionOrder (string[]), timerAccommodation

Zod schemas to create:
- `QuestionMediaSchema` for media validation
- `QuestionSchema` with type-specific refinement (MC/MS require non-empty options array; TF requires exactly 2 options)
- `QuizSchema` with nested QuestionSchema validation and `passingScore: z.number().min(0).max(100)`
- All schemas expose `.safeParse()` — never throw. Consumers handle `{ success: false, error }` results.
- Type inference: `export type Quiz = z.infer<typeof QuizSchema>`

Scoring convention (documented, not enforced in types):
- MC, TF, FIB: all-or-nothing (0% or 100% of question points)
- MS: Partial Credit Model — `max(0, (correct - incorrect) / total_correct)` (implemented in Epic 14)

**Testing Requirements:**

Unit tests:
- TypeScript compilation verification
- Zod schema `.safeParse()` for valid quiz data returns `{ success: true }`
- Zod schema `.safeParse()` for invalid data returns `{ success: false }` with descriptive errors
- MC/MS questions without options array fail validation
- passingScore outside 0-100 fails validation
- Type inference correctness

**Dependencies:** None (foundation story)

**Complexity:** Small (1-2 hours)

**Design Review Focus:** N/A (types only, no UI)

---

### Story 12.2: Set Up Dexie Schema v15 Migration

As a developer,
I want to add quiz tables to the Dexie schema (v14 → v15),
So that quiz data persists reliably in IndexedDB with proper indexes for efficient queries.

**FRs Fulfilled:** QFR49 (IndexedDB persistence), QFR50 (quiz data storage), QFR52 (attempt history)

**Acceptance Criteria:**

**Given** the existing Dexie schema at v14 (current version in `src/db/schema.ts` — v13 added reviewRecords, v14 added quality scoring fields to studySessions)
**When** I add version 15 with quiz tables
**Then** two new tables are created: `quizzes` and `quizAttempts`
**And** the `quizzes` table has indexes on: id (primary), lessonId, createdAt
**And** the `quizAttempts` table has indexes on: id (primary), quizId, [quizId+completedAt] (compound), completedAt
**And** all 15 existing v14 tables are redeclared with their current index definitions
**And** no data migration/backfill is needed (new feature, no existing data)
**And** the typed `db` instance declares `quizzes` and `quizAttempts` as EntityTable properties

**Given** a quiz attempt being queried
**When** querying for "most recent attempt for quiz X"
**Then** the compound index `[quizId+completedAt]` enables efficient retrieval without table scan

**Note:** Current quiz progress is stored in localStorage via Zustand persist middleware (per UX spec QFR49), NOT in IndexedDB. Only quiz definitions and completed attempts use IndexedDB.

**Technical Details:**

Files to modify:
- `src/db/schema.ts` — Add v15 stores block and typed table declarations
- `src/data/types.ts` or `src/types/quiz.ts` — Import Quiz/QuizAttempt types for Dexie typing (from Story 12.1)

Migration code (must redeclare ALL existing tables):
```typescript
// Add to typed db instance:
//   quizzes: EntityTable<Quiz, 'id'>
//   quizAttempts: EntityTable<QuizAttempt, 'id'>

db.version(15).stores({
  // ALL existing v14 tables (unchanged — must redeclare or Dexie deletes them)
  importedCourses: 'id, name, importedAt, status, *tags',
  importedVideos: 'id, courseId, filename',
  importedPdfs: 'id, courseId, filename',
  progress: '[courseId+videoId], courseId, videoId',
  bookmarks: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  notes: 'id, [courseId+videoId], courseId, *tags, createdAt, updatedAt',
  screenshots: 'id, [courseId+lessonId], courseId, lessonId, createdAt',
  studySessions: 'id, [courseId+contentItemId], courseId, contentItemId, startTime, endTime',
  contentProgress: '[courseId+itemId], courseId, itemId, status',
  challenges: 'id, type, deadline, createdAt',
  embeddings: 'noteId, createdAt',
  learningPath: 'courseId, position, generatedAt',
  courseThumbnails: 'courseId',
  aiUsageEvents: 'id, featureId, createdAt',
  reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',

  // NEW: Quiz tables
  quizzes: 'id, lessonId, createdAt',
  quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
})
```

**Testing Requirements:**

Unit tests:
- Schema v15 migration runs successfully from v14
- New tables created with correct indexes
- All 15 existing v14 tables remain intact with data preserved
- Can write and read quiz data from new tables
- Compound index `[quizId+completedAt]` returns results in correct order

Integration tests:
- Dexie upgrade from v14 to v15 executes without errors
- Typed `db.quizzes` and `db.quizAttempts` compile and work at runtime

**Dependencies:** Story 12.1 (needs Quiz types for TypeScript table typing)

**Complexity:** Small (1-2 hours)

**Design Review Focus:** N/A (database only)

---

### Story 12.3: Create useQuizStore with Zustand

As a developer,
I want a Zustand store for quiz state management following LevelUp patterns,
So that quiz state is managed consistently with individual selectors and optimistic updates.

**FRs Fulfilled:** QFR1 (quiz start), QFR2 (answer selection), QFR4 (resume), QFR6 (retake), QFR49 (crash recovery via localStorage persist), QFR55 (progress integration)

**Acceptance Criteria:**

**Given** the LevelUp Zustand patterns (individual selectors, optimistic updates)
**When** I create `src/stores/useQuizStore.ts`
**Then** it follows the `create<State>()(persist(...))` TypeScript pattern
**And** it exports individual selectors (never destructure full store)
**And** it implements optimistic update pattern (Zustand → Dexie → retry with backoff → rollback on exhaustion)
**And** persist middleware auto-saves `currentProgress` to localStorage with key `levelup-quiz-store`
**And** it includes actions: startQuiz, submitAnswer, submitQuiz, retakeQuiz, loadAttempts, resumeQuiz, clearQuiz, toggleReviewMark, clearError

**Given** the startQuiz action
**When** a learner starts a quiz
**Then** it loads the quiz from Dexie by lessonId (resolving the quiz associated with the lesson)
**And** applies Fisher-Yates shuffle if quiz.shuffleQuestions is true
**And** persists the shuffled question order in `currentProgress.questionOrder` (for deterministic crash recovery)
**And** initializes QuizProgress state (currentQuestionIndex=0, empty answers, start time, empty markedForReview)
**And** sets timeRemaining based on quiz.timeLimit × timerAccommodation multiplier

**Given** the submitAnswer action
**When** a learner selects an answer
**Then** it stores the answer in `currentProgress.answers[questionId]`
**And** updates Zustand state optimistically (instant UI feedback)
**And** localStorage auto-saves via persist middleware (debounced)
**And** does NOT write to Dexie (wait until quiz submission to avoid write amplification)

**Given** the submitQuiz action
**When** a learner submits the completed quiz
**Then** it calculates total score and percentage using `calculateQuizScore` from `src/lib/scoring.ts`
**And** creates QuizAttempt record with all answers and metrics
**And** writes attempt to Dexie `quizAttempts` table with retry (3 attempts: 1s, 2s, 4s backoff per Architecture convention)
**And** ONLY AFTER Dexie write succeeds: triggers cross-store updates
**And** clears `currentProgress` from localStorage
**And** on Dexie retry exhaustion: reverts Zustand state, shows error toast, preserves currentProgress for retry

**Given** cross-store communication on quiz submission
**When** the Dexie write succeeds and the quiz score meets the passing threshold
**Then** it calls `useContentProgressStore.getState().setItemStatus(courseId, lessonId, 'completed', modules)` to mark the lesson complete

**Given** the retakeQuiz action
**When** a learner chooses to retake a quiz
**Then** it calls `startQuiz` with the same lessonId, generating a fresh shuffle order and resetting all progress

**Given** the resumeQuiz action
**When** the store rehydrates from localStorage on page load
**Then** it restores `currentProgress` including answers, questionOrder, markedForReview, and timerAccommodation
**And** the quiz displays questions in the persisted `questionOrder` (NOT re-shuffled)

**Given** the toggleReviewMark action
**When** a learner marks/unmarks a question for review
**Then** it adds/removes the questionId from `currentProgress.markedForReview`

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
  startQuiz: (lessonId: string) => Promise<void>
  submitAnswer: (questionId: string, answer: string | string[]) => void
  submitQuiz: (courseId: string, modules: Module[]) => Promise<void>
  retakeQuiz: (lessonId: string) => Promise<void>
  loadAttempts: (quizId: string) => Promise<void>
  resumeQuiz: () => void  // no-op beyond persist rehydration
  clearQuiz: () => void
  toggleReviewMark: (questionId: string) => void
  clearError: () => void
}
```

Zustand persist configuration:
- name: 'levelup-quiz-store'
- partialize: only persist `currentProgress` (not full quiz or attempts)

Cross-store communication (AFTER successful Dexie write only):
- `useContentProgressStore.getState().setItemStatus(courseId, lessonId, 'completed', modules)` — if passing score met
- Session time is already tracked by useSessionStore's startSession/endSession lifecycle (no separate call needed)

Retry pattern (per Architecture convention):
- Use `persistWithRetry` from `src/lib/persistWithRetry.ts` for Dexie writes
- 3 attempts with exponential backoff (1s, 2s, 4s)
- On exhaustion: revert Zustand to pre-submission state, show error toast via Sonner, preserve currentProgress

**Testing Requirements:**

Unit tests:
- startQuiz loads quiz and initializes state with shuffled questionOrder persisted
- submitAnswer updates currentProgress.answers correctly
- submitQuiz creates attempt, writes to Dexie, triggers cross-store on success
- submitQuiz reverts state on Dexie failure after retries
- Cross-store calls only execute AFTER Dexie write succeeds
- Fisher-Yates shuffle applied when enabled, order persisted
- resumeQuiz restores exact question order from localStorage (no re-shuffle)
- persist middleware saves only currentProgress
- toggleReviewMark adds/removes from markedForReview array

Integration tests:
- localStorage persistence across page reloads preserves answers, questionOrder, markedForReview
- Error handling for missing quiz (lessonId with no associated quiz)

**Dependencies:**
- Story 12.1 (needs Quiz types)
- Story 12.2 (needs Dexie schema with quizzes/quizAttempts tables)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:** N/A (store only, no UI)

---

### Story 12.4: Create Quiz Route and QuizPage Component

As a learner,
I want to navigate to a quiz from a lesson and see the quiz start screen,
So that I can begin taking a quiz when I'm ready.

**FRs Fulfilled:** QFR1 (quiz entry from lesson), QFR4 (resume in-progress quiz), QFR8 (quiz metadata display), QFR50 (start screen)

**Acceptance Criteria:**

**Given** a course lesson with an associated quiz
**When** I click "Take Quiz" from the lesson page
**Then** I navigate to `/courses/:courseId/lessons/:lessonId/quiz`
**And** the quiz is resolved by looking up the quiz associated with the lessonId from Dexie
**And** I see the quiz title and description
**And** I see metadata badges: question count (e.g., "12 questions"), time limit or "Untimed", passing score (e.g., "70% to pass")
**And** I see a "Start Quiz" button (`bg-brand text-brand-foreground hover:bg-brand-hover rounded-xl h-12 px-8`)
**And** I do NOT see any questions yet (start screen only)

**Given** the quiz start screen
**When** I click "Start Quiz"
**Then** useQuizStore.startQuiz(lessonId) is called
**And** the first question loads and displays
**And** the quiz header shows progress (e.g., "Question 1 of 12") with a progress bar
**And** the timer starts counting down if quiz is timed (MM:SS format, right-aligned)

**Given** I have an incomplete quiz in progress (currentProgress exists in localStorage)
**When** I navigate to the quiz URL
**Then** I see a "Resume Quiz" button showing "Resume Quiz (5 of 12 answered)"
**And** clicking it restores my exact position, answers, and question order

**Given** I navigate to a quiz URL for a non-existent quiz or a lesson with no quiz
**When** the quiz lookup fails
**Then** I see an error message: "No quiz found for this lesson"
**And** I see a link back to the course page

**Out of scope (deferred):**
- Accessibility accommodations link on start screen (Epic 15 — timer stories)
- `<QuestionDisplay>` renders a stub/placeholder until Story 12.5 implements it

**Technical Details:**

Files to create:
- `src/app/pages/Quiz.tsx` (route-level page component — the QuizPage)
- `src/app/components/quiz/QuizHeader.tsx` (title, progress bar, timer placeholder)
- `src/app/components/quiz/QuizStartScreen.tsx` (pre-quiz metadata and start/resume buttons)

Files to modify:
- `src/app/routes.tsx` (add quiz route as nested route inside Layout)

Route configuration:
```typescript
{ path: '/courses/:courseId/lessons/:lessonId/quiz', element: <Quiz /> }
```

QuizPage component structure:
```tsx
<div className="bg-card rounded-[24px] p-8 max-w-2xl mx-auto shadow-sm">
  <QuizHeader quiz={currentQuiz} progress={currentProgress} />
  {!quizStarted && <QuizStartScreen quiz={currentQuiz} progress={currentProgress} onStart={handleStart} onResume={handleResume} />}
  {quizStarted && <QuestionDisplay question={currentQuestion} ... />}  {/* Stub until Story 12.5 */}
</div>
```

Start screen metadata badges (per UX spec):
- Question count: `bg-brand-soft text-brand rounded-full px-3 py-1 text-sm`
- Time limit: `bg-muted text-muted-foreground rounded-full px-3 py-1 text-sm`
- Passing score: same style as time limit

**Testing Requirements:**

Unit tests:
- QuizPage renders start screen with title, description, metadata badges
- Start button triggers useQuizStore.startQuiz(lessonId)
- Resume button appears when currentProgress exists, shows answer count
- Error state renders when quiz not found

E2E tests:
- Navigate to quiz URL → see start screen with all metadata
- Click "Start Quiz" → quiz header appears with progress bar
- Refresh page mid-quiz → can resume with preserved state
- Navigate to invalid quiz URL → see error with course link

Accessibility tests:
- Keyboard navigation (Tab to Start/Resume button, Enter to activate)
- Screen reader announces quiz title, question count, time limit, passing score
- Focus moves to first question after starting

**Dependencies:**
- Story 12.1 (needs Quiz types)
- Story 12.2 (needs Dexie for quiz loading)
- Story 12.3 (needs useQuizStore)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Quiz start screen layout at mobile (<640px), tablet (640-1023px), desktop (≥1024px)
- Start Quiz button: `h-12` touch target (48px), `rounded-xl`, brand colors
- Metadata badges inline display with proper spacing
- Container: `bg-card rounded-[24px] p-8 max-w-2xl mx-auto shadow-sm`
- Typography: title `text-2xl font-semibold`, description `text-base text-muted-foreground`

---

### Story 12.5: Display Multiple Choice Questions

As a learner,
I want to see multiple choice questions with selectable answer options,
So that I can answer quiz questions by selecting the correct option.

**FRs Fulfilled:** QFR9 (multiple choice display), QFR2 (question display), QFR14 (rich text in questions)

**Acceptance Criteria:**

**Given** a quiz with multiple choice questions
**When** I view a question
**Then** I see the question text rendered as Markdown (via `react-markdown` with `remark-gfm`)
**And** the question is wrapped in a card: `bg-card rounded-[24px] p-6 lg:p-8`
**And** I see 2-6 answer options as styled radio buttons below the question
**And** each option uses the label wrapper pattern from the UX spec
**And** all options are unselected initially (no default selection)
**And** I can select exactly one option at a time (radio group behavior)

**Given** I select an answer option
**When** I click or tap on a radio button or its label
**Then** the option becomes visually selected: `border-2 border-brand bg-brand-soft rounded-xl p-4`
**And** unselected options show: `border border-border bg-card hover:bg-accent rounded-xl p-4`
**And** any previously selected option becomes unselected
**And** `useQuizStore.submitAnswer(questionId, selectedOption)` is called
**And** the selection persists via Zustand store if I navigate away and return

**Given** the QuestionDisplay component API
**When** defining the component props
**Then** it accepts a `mode` prop: `'active' | 'review-correct' | 'review-incorrect' | 'review-disabled'`
**And** in 'active' mode (Epic 12): only unselected and selected states render
**And** review modes (Epic 16): correct (`border-success bg-success-soft`), incorrect (`border-warning`), disabled (`opacity-60`)
**And** this prop surface exists now to prevent API breakage when review mode ships

**Given** the question display on mobile (<640px)
**When** rendering answer options
**Then** options stack vertically with full-width labels
**And** each option has minimum height `h-12` (48px) for touch targets per UX spec

**Given** a question with fewer than 2 or more than 6 options
**When** rendering the question
**Then** it renders whatever options exist (graceful degradation)
**And** logs a warning to console for data quality monitoring

**Technical Details:**

Files to create:
- `src/app/components/quiz/QuestionDisplay.tsx` (polymorphic renderer with `mode` prop)
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`

Dependencies to verify (should already be in package.json):
- `react-markdown` and `remark-gfm` for question text rendering
- Syntax highlighting for code blocks: defer to implementation decision (explicit scope boundary — add if trivial, skip if significant bundle impact)

MultipleChoiceQuestion component (per UX spec styling):
```tsx
<fieldset className="space-y-3">
  <legend className="text-lg lg:text-xl text-foreground leading-relaxed mb-4">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{question.text}</ReactMarkdown>
  </legend>
  <RadioGroup value={selectedAnswer} onValueChange={handleAnswerChange}>
    {question.options.map(option => (
      <label key={option.id} className="flex items-start gap-3 p-4 rounded-xl border
                    hover:bg-accent cursor-pointer min-h-12
                    data-[state=checked]:border-brand data-[state=checked]:border-2
                    data-[state=checked]:bg-brand-soft">
        <RadioGroupItem value={option.id} />
        <span className="text-base text-foreground leading-relaxed">{option.text}</span>
      </label>
    ))}
  </RadioGroup>
</fieldset>
```

QuestionDisplay polymorphic rendering:
```tsx
// mode defaults to 'active' for Epic 12
switch (question.type) {
  case 'multiple-choice':
    return <MultipleChoiceQuestion question={question} value={userAnswer} onChange={onAnswerChange} mode={mode} />
  default:
    return <div>Unsupported question type: {question.type}</div>
}
```

**Testing Requirements:**

Unit tests:
- MultipleChoiceQuestion renders all options with correct UX spec styling
- Selecting an option calls onChange callback and updates visual state
- Only one option can be selected at a time
- Markdown rendering for question text (emphasis, code blocks, lists)
- `mode` prop correctly applies active vs review styles
- Options with < 2 or > 6 items render with console warning

E2E tests:
- Click each answer option → selection updates with brand styling
- Navigate to next question and back → selection persists via store
- Keyboard navigation (Tab to options, Space/Enter to select, Arrow keys between)

Accessibility tests:
- `<fieldset>/<legend>` semantic structure present
- RadioGroup has proper ARIA attributes (role="radiogroup", aria-labelledby)
- Screen reader announces question text and all options
- Focus indicators visible: `outline-2 outline-brand outline-offset-2`
- Touch targets ≥48px (`min-h-12`) on mobile

**Dependencies:**
- Story 12.1 (needs Question type with options)
- Story 12.3 (needs useQuizStore.submitAnswer for answer persistence)
- Story 12.4 (needs QuizPage to render QuestionDisplay)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Question card: `bg-card rounded-[24px] p-6 lg:p-8`
- Option styling matches UX spec 5 states (only active/selected rendered in Epic 12)
- Touch targets: `min-h-12` (48px) per UX spec
- Responsive: stacked single column on all viewports (two-column deferred — threshold undefined)
- Markdown rendering: code blocks, lists, emphasis render cleanly
- Focus states: `outline-2 outline-brand outline-offset-2`

---

### Story 12.6: Calculate and Display Quiz Score

As a learner,
I want to submit my quiz and immediately see my score,
So that I know how well I performed.

**FRs Fulfilled:** QFR5 (results display), QFR17 (scoring calculation), QFR23 (non-judgmental messaging), QFR6 (retake)

**Acceptance Criteria:**

**Given** I have answered all required questions in a quiz
**When** I click "Submit Quiz"
**Then** the quiz is submitted to useQuizStore.submitQuiz()
**And** my score is calculated as a percentage of total possible points
**And** I am navigated to `/courses/:courseId/lessons/:lessonId/quiz/results`
**And** I see an animated circular SVG score indicator with my percentage in `text-5xl font-bold text-foreground`
**And** I see the number of questions correct (e.g., "10 of 12 correct")
**And** I see pass/fail status: "Congratulations! You passed!" or "Keep Going! You got X of Y correct"
**And** the word "Failed" MUST NOT appear anywhere on the results screen (QFR23)
**And** I see the total time spent (e.g., "Completed in 8m 32s") — sourced from `QuizAttempt.timeSpent`

**Given** I have NOT answered all questions
**When** I click "Submit Quiz"
**Then** I see a confirmation dialog (shadcn/ui AlertDialog): "You have N unanswered questions. Submit anyway?"
**And** I can click "Continue Reviewing" (outline variant) to return to the quiz
**And** I can click "Submit Anyway" (default variant) to submit with unanswered questions scored as 0

**Given** the quiz results screen
**When** I view my score
**Then** I see a "Retake Quiz" button (`variant="outline" rounded-xl`)
**And** I see a "Review Answers" button (`variant="default" bg-brand rounded-xl`)
**And** I see a "Back to Lesson" text link below the buttons

**Given** the submitQuiz store action fails (Dexie write error after retries)
**When** the error occurs
**Then** I see an error toast via Sonner: "Failed to save quiz results. Your answers are preserved — try again."
**And** I remain on the quiz page with my answers intact (currentProgress preserved)

**Given** a question of type 'multiple-select' exists in a quiz during Epic 12
**When** scoring that question
**Then** `calculatePartialCredit` returns `{ pointsEarned: 0, isCorrect: false }` as a safe fallback
**And** logs a console warning: "multiple-select scoring not yet implemented (Epic 14)"

**Technical Details:**

Files to create:
- `src/app/pages/QuizResults.tsx` (results page with animated score circle)
- `src/app/components/quiz/ScoreSummary.tsx` (animated circular SVG + score text + pass/fail message)
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
      const isCorrect = userAnswer === question.correctAnswer
      return { pointsEarned: isCorrect ? question.points : 0, isCorrect }

    case 'fill-in-blank':
      // Case-insensitive, whitespace-trimmed comparison per UX spec
      const userStr = String(userAnswer).trim().toLowerCase()
      const correctStr = String(question.correctAnswer).trim().toLowerCase()
      const fibCorrect = userStr === correctStr
      return { pointsEarned: fibCorrect ? question.points : 0, isCorrect: fibCorrect }

    case 'multiple-select':
      // Safe fallback until Epic 14 implements PCM scoring
      console.warn('multiple-select scoring not yet implemented (Epic 14)')
      return { pointsEarned: 0, isCorrect: false }
  }
}

export function calculateQuizScore(answers: Answer[]): {
  score: number; percentage: number; totalPoints: number
} {
  const score = answers.reduce((sum, a) => sum + a.pointsEarned, 0)
  const totalPoints = answers.reduce((sum, a) => sum + a.pointsPossible, 0)
  const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0
  return { score, percentage, totalPoints }
}
```

Results route:
```typescript
{ path: '/courses/:courseId/lessons/:lessonId/quiz/results', element: <QuizResults /> }
```

Note: `/quiz/review/:attemptId` route for detailed answer review is a separate page (Epic 16). The "Review Answers" button navigates there but the route/page is out of scope for Epic 12 — button links to a placeholder or the route is added in Epic 16.

Encouraging messages (per UX spec QFR23):
- Pass: "Congratulations! You passed!"
- Not pass: "Keep Going! You got X of Y correct."
- Never use: "Failed", "Wrong", "Incorrect"

**Testing Requirements:**

Unit tests:
- calculatePartialCredit for MC/TF (all-or-nothing, exact match)
- calculatePartialCredit for FIB (case-insensitive, whitespace-trimmed)
- calculatePartialCredit for MS returns safe fallback `{ pointsEarned: 0, isCorrect: false }`
- calculateQuizScore with various answer combinations
- Zero-division handling (empty answers array)
- Percentage rounding accuracy

E2E tests:
- Submit quiz with all answered → see animated score, pass/fail, time
- Submit quiz with unanswered → AlertDialog confirmation, can cancel or submit
- Results page shows Retake, Review Answers buttons and Back to Lesson link
- "Retake Quiz" navigates to fresh quiz start screen
- Pass/fail message never contains the word "Failed"

Accessibility tests:
- Score announced via `aria-live="polite"` region on results page load
- Keyboard navigation to all three action buttons/links
- AlertDialog traps focus correctly

**Dependencies:**
- Story 12.1 (needs Answer, QuizAttempt, Question types)
- Story 12.3 (needs useQuizStore.submitQuiz)
- Story 12.4 (needs QuizPage for submit flow)
- Story 12.5 (needs question answering to produce data to score)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Animated circular SVG score: `text-5xl font-bold`, brand color ring
- Pass: green checkmark icon; Not pass: orange neutral icon (never red X)
- Non-judgmental message copy exactly matching UX spec
- Three actions: Retake (outline), Review (brand), Back to Lesson (text link)
- Responsive layout at <640px, 640-1023px, ≥1024px
- Time formatting: "8m 32s" (not "512 seconds")
- AlertDialog for unanswered questions confirmation

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
  <div className="text-sm text-muted-foreground">
    Previous best: {previousBestScore}%
    {currentScore > previousBestScore && (
      <span className="text-success font-semibold">
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

**FRs Fulfilled: QFR10**

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

**Given** responsive layout
**When** the question renders on desktop (≥1024px)
**Then** True/False options render in a 2-column grid
**When** the question renders on mobile (<640px)
**Then** options stack vertically at full width

**Given** accessibility requirements
**When** the component renders
**Then** it uses `<fieldset>/<legend>` with `role="radiogroup"` and supports keyboard arrow navigation within the group
**And** touch targets are ≥44px (`h-12`) per UX spec

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
  <RadioGroup value={selectedAnswer} onValueChange={handleAnswerChange} role="radiogroup">
    <RadioGroupItem value="true" label="True" className="h-12" />
    <RadioGroupItem value="false" label="False" className="h-12" />
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
- fieldset/legend semantic structure with `role="radiogroup"`
- Radio group keyboard navigation (Tab, Arrow keys, Space/Enter)
- Screen reader announces question and two options
- Focus indicators visible (4.5:1 contrast)
- Touch targets ≥44px

**Dependencies:**
- Story 12.1 (needs Question type with 'true-false')
- Story 12.3 (needs useQuizStore)
- Story 12.5 (extends QuestionDisplay polymorphic pattern)

**Complexity:** Small (1-2 hours)

**Design Review Focus:**
- True/False option layout (2-column on desktop, stacked on mobile)
- Radio button styling consistent with Multiple Choice
- Touch targets ≥44px on mobile

---

### Story 14.2: Display Multiple Select Questions with Partial Credit

As a learner,
I want to answer Multiple Select ("select all that apply") questions,
So that I can demonstrate knowledge of multiple correct answers.

**FRs Fulfilled: QFR11, QFR16**

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

**Given** zero selections on submit
**When** the quiz is submitted with no options selected for a Multiple Select question
**Then** the score for that question is 0 (no credit awarded)
**And** the question is marked as answered with an empty selection

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

**Given** feedback display after submission
**When** the quiz results are shown
**Then** Multiple Select questions show "X of Y correct" with per-option indicators (correct selected, correct missed, incorrect selected)

**Given** accessibility requirements
**When** the component renders
**Then** it uses `<fieldset>/<legend>` structure with each checkbox individually labeled
**And** the user can press Space to toggle a checkbox and Tab between checkboxes

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
    <span className="text-sm text-muted-foreground italic block mt-1">Select all that apply</span>
  </legend>
  <div className="space-y-2">
    {question.options.map((option, index) => (
      <Checkbox
        key={index}
        checked={selectedAnswers.includes(option)}
        onCheckedChange={() => handleToggle(option)}
        label={option}
        className="h-12"
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
- Submit with zero selections → 0 points awarded

Accessibility tests:
- fieldset/legend semantic structure
- Checkboxes have proper individual labels
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

**FRs Fulfilled: QFR12**

**Acceptance Criteria:**

**Given** a quiz with Fill-in-Blank questions
**When** I view a Fill-in-Blank question
**Then** I see the question text clearly displayed
**And** I see a text input field with a placeholder (e.g., "Type your answer here")
**And** the input field is appropriately sized (not too small)
**And** I can type my answer freely

**Given** I type an answer
**When** I enter text into the input field
**Then** my input is saved to quiz state with a 300ms debounce
**And** my answer persists if I navigate away and return
**And** the input enforces a maximum of 500 characters
**And** a character counter displays the current count (e.g., "42 / 500")
**And** input is prevented beyond 500 characters

**Given** Fill-in-Blank scoring
**When** the quiz is submitted
**Then** my answer is compared to the correct answer
**And** the comparison is case-insensitive (e.g., "React" = "react" = "REACT")
**And** leading/trailing whitespace is trimmed before comparison
**And** the score is all-or-nothing (0% or 100%)

**Given** semantic HTML structure
**When** the component renders
**Then** it uses `<fieldset>/<legend>` structure to associate the question text with the input field

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
    onBlur={() => /* trigger immediate save */}
    placeholder="Type your answer here"
    className="w-full max-w-md"
    maxLength={500}
  />
  <span className="text-sm text-muted-foreground mt-1 block">
    {(userAnswer || '').length} / 500
  </span>
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
- Typing updates state with 300ms debounce
- Scoring compares case-insensitively with trimming
- Edge cases: empty string, whitespace only, exact match
- Character limit enforced at 500

E2E tests:
- Type answer → input updates
- Navigate away and back → answer persists
- Submit quiz → fill-in-blank scored correctly
- Case variations ("React" vs "react") treated as correct
- Character counter updates as user types

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
- Character counter visibility
- Responsive width on mobile vs. desktop

---

### Story 14.4: Support Rich Text Formatting in Questions

As a learner,
I want to see questions with code blocks, lists, and emphasis,
So that technical content is clearly formatted and readable.

**FRs Fulfilled: QFR15**

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
**Then** the code block scrolls horizontally if too wide (no line wrapping)
**And** the background color contrasts well with code text (≥4.5:1)
**And** code blocks and inline code render correctly in both light and dark themes using design tokens

**Given** long question text
**When** rendering on mobile (375px)
**Then** text wraps naturally without horizontal scroll
**And** code blocks scroll independently
**And** all content remains readable

**Given** Markdown in question legends
**When** rendering question text inside `<legend>` elements
**Then** Markdown content is rendered outside `<legend>` using `aria-labelledby` to maintain HTML validity
**And** the visual association between question text and input controls is preserved

**Note on syntax highlighting:** Syntax highlighting for fenced code blocks (e.g., ` ```javascript `) is deferred to a future story. This story provides unstyled monospace code blocks with `bg-surface-sunken` background. When syntax highlighting is added, evaluate `rehype-highlight` (lightweight, ~40KB) vs `rehype-prism-plus` (heavier, more languages) and note the bundle size impact.

**Technical Details:**

Files to create:
- `src/app/components/quiz/MarkdownRenderer.tsx` (shared component)

Files to modify:
- All question components (MultipleChoiceQuestion, TrueFalseQuestion, MultipleSelectQuestion, FillInBlankQuestion) — replace inline `<ReactMarkdown>` with shared `<MarkdownRenderer>`
- Install and configure `react-markdown` with `remark-gfm` for GitHub Flavored Markdown

Package installation:
```bash
npm install react-markdown remark-gfm
```

Shared MarkdownRenderer component:
```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const markdownComponents = {
  code: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <code className="bg-surface-sunken text-foreground px-1.5 py-0.5 rounded font-mono text-sm">
      {children}
    </code>
  ),
  pre: ({ children }: { children: React.ReactNode }) => (
    <pre className="bg-surface-sunken rounded-lg p-4 overflow-x-auto my-4">
      {children}
    </pre>
  ),
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul className="ml-6 space-y-1 list-disc">{children}</ul>
  ),
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol className="ml-6 space-y-1 list-decimal">{children}</ol>
  ),
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}
```

Integration in question components (example — TrueFalseQuestion):
```tsx
<fieldset>
  <div id={questionLabelId}>
    <MarkdownRenderer content={question.text} />
  </div>
  <RadioGroup aria-labelledby={questionLabelId} value={selectedAnswer} onValueChange={handleAnswerChange}>
    <RadioGroupItem value="true" label="True" />
    <RadioGroupItem value="false" label="False" />
  </RadioGroup>
</fieldset>
```

**Testing Requirements:**

Unit tests:
- MarkdownRenderer renders code blocks with `bg-surface-sunken` background
- Inline code styling applied with design tokens
- Lists render with indentation
- Bold and italic text render correctly
- Component is reusable across all question types

E2E tests:
- View question with code block → monospace font and background visible
- View question with list → proper indentation
- Mobile view → text wraps, code scrolls
- Dark mode → code blocks use correct token colors

Accessibility tests:
- Code block contrast ≥4.5:1 in both light and dark themes
- Screen reader announces lists correctly (`<ul>`/`<ol>` semantic HTML)
- Emphasis (bold/italic) conveyed via screen reader
- `aria-labelledby` correctly associates question text with input controls

**Dependencies:**
- Story 12.5 (modifies MultipleChoiceQuestion)
- Story 14.1 (modifies TrueFalseQuestion)
- Story 14.2 (modifies MultipleSelectQuestion)
- Story 14.3 (modifies FillInBlankQuestion)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Code block background uses `bg-surface-sunken` (works in light and dark themes)
- Inline code styling (distinct but not distracting)
- List indentation and spacing
- Mobile responsiveness (text wrapping, code scrolling)
- Light/dark mode rendering of all Markdown elements

---
## Epic 15: Timed Quizzes with Enhanced Feedback

**Goal:** Learners can take timed quizzes with countdown timers, configurable accommodations, warnings, and receive immediate explanatory feedback on each answer.

**Technical Focus:** This epic implements the useQuizTimer hook with Date.now() accuracy pattern, immediate feedback components, and performance summary generation.

### Story 15.1: Display Countdown Timer with Accuracy

As a learner,
I want to see an accurate countdown timer during timed quizzes,
So that I know exactly how much time remains.

**FRs Fulfilled: QFR24, QFR30**

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

Note: `initialSeconds` is always in seconds (converted from minutes by the caller).

useQuizTimer hook implementation:
```typescript
export function useQuizTimer(initialSeconds: number, onExpire: () => void) {
  const [timeRemaining, setTimeRemaining] = useState(initialSeconds)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  
  useEffect(() => {
    const startTime = Date.now()
    const endTime = startTime + (initialSeconds * 1000)
    
    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeRemaining(remaining)
      
      if (remaining === 0) {
        clearInterval(interval)
        onExpireRef.current()
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
  }, [initialSeconds])
  
  return timeRemaining
}
```

QuizTimer component:
```tsx
<div
  role="timer"
  aria-label="Time remaining"
  className={cn(
    "font-mono text-lg font-semibold text-foreground",
    timeRemaining < totalTime * 0.1 && "text-destructive",
    timeRemaining < totalTime * 0.25 && timeRemaining >= totalTime * 0.1 && "text-warning"
  )}
>
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
- Color transitions (default → amber → red)
- Font size and readability
- MM:SS format clarity

---

### Story 15.2: Configure Timer Duration and Accommodations

As a learner,
I want to configure the quiz timer duration before starting,
So that I can adjust time limits to my needs (including accessibility accommodations).

**FRs Fulfilled: QFR25, QFR26, QFR29**

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
**And** time-to-completion is still tracked internally (not displayed)

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

Note: Validate accommodation value from localStorage at runtime (Zod or manual guard) to prevent corrupted/tampered values from producing invalid timer durations.

TimerAccommodationsModal:
```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button variant="link">Accessibility Accommodations</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogTitle>Timer Accommodations</DialogTitle>
    <DialogDescription>
      Choose a time accommodation that suits your learning needs.
    </DialogDescription>
    <RadioGroup value={accommodation} onValueChange={setAccommodation}>
      <RadioGroupItem value="1.0" label="Standard time (15 minutes)" />
      <RadioGroupItem value="1.5" label="150% extended time (22 minutes 30 seconds)" />
      <RadioGroupItem value="2.0" label="200% extended time (30 minutes)" />
      <RadioGroupItem value="untimed" label="Untimed (no time limit)" />
    </RadioGroup>
    <p className="text-sm text-muted-foreground">
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
- Select "150%" → start quiz → timer shows extended time with "(Extended Time)" annotation
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

**FRs Fulfilled: QFR27, QFR28**

**Acceptance Criteria:**

**Given** a timed quiz is in progress
**When** the timer reaches 25% of original time remaining (75% elapsed) (e.g., 3:45 of 15:00)
**Then** a subtle toast notification appears: "3 minutes 45 seconds remaining"
**And** the toast auto-dismisses after 3 seconds
**And** the warning does NOT disrupt my quiz-taking flow

**When** the timer reaches 10% of original time remaining (e.g., 1:30 of 15:00)
**Then** a more prominent toast appears: "Only 1 minute 30 seconds remaining!"
**And** the toast auto-dismisses after 5 seconds

**When** the timer reaches 1 minute remaining
**Then** a persistent warning appears: "1 minute remaining"
**And** this warning remains visible until time expires

**Given** I am in untimed mode
**When** taking the quiz
**Then** no timer warnings are displayed (all warning logic is skipped)

**Given** I am using a screen reader
**When** each warning threshold is reached
**Then** the warning is announced via ARIA live region (`aria-live="polite"` for 25% remaining, `aria-live="assertive"` for 10% and 1 min)
**And** the announcement does NOT interrupt my current question reading

**Given** I have configured timer accommodations
**When** warnings are triggered
**Then** they are based on the adjusted time, not the original time
**And** 25% of 22:30 (extended time) = 5:37, not based on original 15:00

**Technical Details:**

Files to create:
- `src/app/components/quiz/TimerWarnings.tsx` (warning display logic)

Files to modify:
- `src/hooks/useQuizTimer.ts` (emit warning events at thresholds via `onWarning` callback)
- `src/app/pages/Quiz.tsx` (integrate warnings)

useQuizTimer with warnings (uses `onWarning` callback pattern — no internal warning `useState`):
```typescript
// In the timer interval callback:

// Guard: skip all warning logic when in untimed mode
if (initialSeconds === null) return

// Check thresholds
const percentRemaining = remaining / initialSeconds

if (percentRemaining <= 0.25 && !warningsFiredRef.current.twentyFivePercent) {
  warningsFiredRef.current.twentyFivePercent = true
  onWarning?.('25%', remaining)
}

if (percentRemaining <= 0.10 && !warningsFiredRef.current.tenPercent) {
  warningsFiredRef.current.tenPercent = true
  onWarning?.('10%', remaining)
}

if (remaining === 60 && !warningsFiredRef.current.oneMinute) {
  warningsFiredRef.current.oneMinute = true
  onWarning?.('1min', remaining)
}
```

TimerWarnings component:
```tsx
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {warning25 && `${formatTime(timeRemaining)} remaining`}
</div>
<div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
  {warning10 && `Only ${formatTime(timeRemaining)} remaining!`}
</div>
```

Toast notifications using Sonner:
```tsx
toast.info(formatTime(timeRemaining) + ' remaining', { duration: 3000 })  // 25% remaining
toast.warning('Only ' + formatTime(timeRemaining) + ' remaining!', { duration: 5000 })  // 10%
toast.warning(formatTime(timeRemaining) + ' remaining', { duration: Infinity })  // 1 min (persistent)
```

**Testing Requirements:**

Unit tests:
- Warning thresholds trigger at correct times
- ARIA live regions update correctly
- Warnings triggered only once per threshold
- No warnings fire in untimed mode

E2E tests:
- Start quiz → wait for 25% remaining threshold → toast appears
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
- Toast notification styling (subtle for 25% remaining, prominent for 10%, urgent for 1 min)
- Toast auto-dismiss timing (3s, 5s, persistent)
- ARIA live region announcements (not disruptive)

---

### Story 15.4: Provide Immediate Explanatory Feedback per Question

As a learner,
I want to see immediate feedback after answering each question,
So that I can learn from my mistakes right away.

**FRs Fulfilled: QFR18, QFR19, QFR23**

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

**Given** the timer expires before I answer a question
**When** the quiz auto-submits
**Then** unanswered/skipped questions show feedback with the correct answer and explanation
**And** the feedback indicates the question was not answered in time

**Technical Details:**

Files to create:
- `src/app/components/quiz/AnswerFeedback.tsx`

Files to modify:
- `src/app/pages/Quiz.tsx` (display feedback after answer submission)
- `src/stores/useQuizStore.ts` (calculate feedback data)

Note: `react-markdown` dependency is already installed (added in Story 14.4).

AnswerFeedback component:
```tsx
<Card
  role="status"
  aria-live="polite"
  className={cn(
    "mt-4 p-4 border-l-4",
    isCorrect ? "border-l-success bg-success-soft" : "border-l-warning bg-warning-soft"
  )}
>
  <div className="flex items-start gap-3">
    {isCorrect ? (
      <CheckCircle className="h-6 w-6 text-success" />
    ) : (
      <AlertCircle className="h-6 w-6 text-warning" />
    )}
    <div className="flex-1">
      <h4 className="font-semibold text-lg">
        {isCorrect ? 'Correct!' : 'Not quite'}
      </h4>
      <p className="text-sm text-foreground mt-2">
        <ReactMarkdown>{explanation}</ReactMarkdown>
      </p>
      {!isCorrect && (
        <p className="text-sm text-foreground mt-2">
          <strong>Correct answer:</strong> {correctAnswer}
        </p>
      )}
      {pointsEarned < pointsPossible && (
        <p className="text-sm text-muted-foreground mt-2">
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
- Timer expires → skipped questions show feedback with correct answer

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

**FRs Fulfilled: QFR20, QFR21, QFR22, QFR23**

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

**Given** questions have no topic tags
**When** viewing the performance summary
**Then** all questions are grouped under a "General" topic
**And** the strengths/growth areas section is hidden (single-topic breakdown is not useful)

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

Note: The `Question` type must include `topic?: string` (coordinate with Epic 12.1 to add this field).

Files to create:
- `src/app/components/quiz/PerformanceInsights.tsx`
- `src/lib/analytics.ts` (NEW file — topic analysis function)

Files to modify:
- `src/app/pages/QuizResults.tsx` (integrate insights)

PerformanceInsights component:
```tsx
<div className="space-y-6">
  <div>
    <h3 className="text-lg font-semibold text-success">Your Strengths</h3>
    <ul className="mt-2 space-y-1">
      {strengths.map(topic => (
        <li key={topic.name} className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-success" />
          <span>{topic.name}: {topic.percentage}%</span>
        </li>
      ))}
    </ul>
  </div>
  
  {growthAreas.length > 0 && (
    <div>
      <h3 className="text-lg font-semibold text-warning">Growth Opportunities</h3>
      <ul className="mt-2 space-y-2">
        {growthAreas.map(topic => (
          <li key={topic.name}>
            <span className="font-medium">{topic.name}: {topic.percentage}%</span>
            <p className="text-sm text-muted-foreground">Review questions {topic.questionNumbers.join(', ')}</p>
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
  // Group questions by topic (requires Question.topic field — see Epic 12.1)
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
    if (isCorrect) {
      score.correct++
    } else {
      // Only track question numbers for incorrect answers (used in growth area suggestions)
      score.questionNumbers.push(index + 1)
    }
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
- Growth area questionNumbers only contain indices of incorrect answers
- Encouraging messages based on score ranges
- Questions without topic tags fall back to "General"

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

**FRs Fulfilled: QFR37**

**Acceptance Criteria:**

**Given** I start a quiz
**When** the quiz initializes
**Then** the start time is recorded (ISO 8601 timestamp)

**Given** I complete a quiz
**When** I submit the quiz
**Then** the completion time is recorded
**And** the time spent is calculated as elapsed wall-clock time (completion time - start time)
**And** the time spent is stored in the QuizAttempt record in seconds

**Given** I view the quiz results screen
**When** the results load
**Then** I see my time-to-completion displayed in a human-readable format (e.g., "8m 32s" or "1h 15m 45s")
**And** the time display is prominent but not overwhelming

**Given** I completed an untimed quiz
**When** viewing the results screen
**Then** time-to-completion is tracked but NOT displayed on the results per UX spec

**Given** I have multiple attempts on the same quiz
**When** I view my attempt history
**Then** I see the time spent for each attempt
**And** I can compare my speed across attempts (e.g., "Previous: 10m 15s, Current: 8m 32s")

Note: This story tracks elapsed wall-clock time (including tab switches, pauses, etc.). Active-time tracking (excluding idle periods) is deferred to a future enhancement.

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
  if (!currentProgress?.startTime) {
    throw new Error('Cannot submit quiz: no start time recorded')
  }
  const timeSpent = Math.floor(
    (Date.now() - new Date(currentProgress.startTime).getTime()) / 1000
  )
  
  const attempt: QuizAttempt = {
    // ... existing fields
    timeSpent,
    startedAt: currentProgress.startTime,
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
- Null guard prevents crash when startTime is missing

E2E tests:
- Complete quiz → see time-to-completion on results
- Verify time tracking accuracy using Playwright clock mocking (`page.clock`) rather than real waits

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

**FRs Fulfilled: QFR5, QFR17**

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

**Given** I am reviewing a Multiple Select question
**When** viewing my answer
**Then** I see all options with checkboxes indicating which I selected and which are correct
**And** partially correct answers show which selections were right and which were wrong

**Given** I am reviewing a Fill-in-the-Blank question
**When** viewing my answer
**Then** I see my typed answer alongside the accepted correct answer(s)
**And** case-insensitive matching is indicated if applicable

**Given** the attemptId in the URL is invalid or not found
**When** the review page loads
**Then** I see an error message: "Quiz attempt not found"
**And** a link back to the quiz is displayed

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

Dependencies (npm):
- `react-markdown` (shared with Story 14.4 — renders explanation Markdown)

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
        isCorrect ? "bg-success-soft" : "bg-warning-soft"
      )}>
        <strong>Your answer:</strong> {userAnswer}
        {!isCorrect && (
          <div className="mt-2">
            <strong>Correct answer:</strong> {correctAnswer}
          </div>
        )}
      </div>
      
      <div className="p-3 bg-surface-sunken rounded-lg">
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
- Invalid attemptId displays error with back link
- Multiple Select questions render selected/correct checkboxes
- Fill-in-the-Blank questions display typed vs accepted answers

E2E tests:
- Click "Review Answers" → navigate to review mode
- Navigate through questions → see answers and explanations
- Click "Back to Results" → return to results page
- Navigate to invalid attemptId → see error message

Accessibility tests:
- Review mode keyboard navigable
- Color coding supplemented with icons/text
- Screen reader announces correct/incorrect status

**Dependencies:**
- Story 12.6 (needs QuizResults page)
- Story 14.4 (react-markdown dependency)
- Story 15.4 (needs explanations)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Answer highlighting (user answer vs correct answer)
- Explanation display clarity
- Navigation between reviewed questions
- Read-only question display (no interaction needed)
- Multi-question-type review rendering (MS checkboxes, FIB text comparison)

---

### Story 16.2: Display Score History Across All Attempts

As a learner,
I want to see my score history for all quiz attempts,
So that I can track my improvement over time.

**FRs Fulfilled: QFR31**

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

**Given** only one attempt exists
**When** viewing the trigger button
**Then** I see "(1 attempt)" with correct singular form

**Given** multiple attempts exist
**When** viewing the trigger button
**Then** I see "(N attempts)" with correct plural form

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
    <Button variant="link">
      View Attempt History ({attempts.length} attempt{attempts.length !== 1 ? 's' : ''})
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* On mobile (<640px), use stacked cards instead of table */}
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
          <TableRow key={attempt.id} className={attempt.id === currentAttemptId ? 'bg-brand-soft' : ''}>
            <TableCell>#{attempts.length - index}</TableCell>
            <TableCell>{formatDate(attempt.completedAt)}</TableCell>
            <TableCell>{attempt.percentage}%</TableCell>
            <TableCell>{formatDuration(attempt.timeSpent)}</TableCell>
            <TableCell>
              {attempt.passed ? (
                <span className="bg-success-soft text-success rounded-full px-2 py-0.5 text-xs font-medium">Passed</span>
              ) : (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">Not Passed</span>
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

Note: On viewports below 640px, consider rendering attempts as stacked cards rather than a horizontal table to avoid horizontal scrolling.

useQuizStore.loadAttempts:
```typescript
loadAttempts: async (quizId: string) => {
  const attempts = await db.quizAttempts
    .where('quizId').equals(quizId)
    .sortBy('completedAt')
  
  attempts.reverse()  // Most recent first
  
  set({ attempts })
}
```

**Testing Requirements:**

Unit tests:
- loadAttempts retrieves attempts sorted correctly
- Attempt table renders all attempt data
- Singular/plural label renders correctly for 1 vs N attempts

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
- Table layout and responsive design (stacked cards on mobile)
- Collapsible expand/collapse interaction
- Current attempt highlighting
- Passed/not-passed badge styling

---

### Story 16.3: Calculate and Display Score Improvement

As a learner,
I want to see how much my score improved between attempts,
So that I can measure my learning progress.

**FRs Fulfilled: QFR32**

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
**And** I see an encouraging message with a trophy icon: "New personal best!"

**Given** my current score is lower than my previous best
**When** viewing the comparison
**Then** I see my best score with attempt number: "Your best: 90% (attempt #3)"
**And** I see the current score: "Current: 75%"
**And** there is NO negative messaging (no "You did worse" or red colors)
**And** I see neutral encouragement: "Keep practicing to beat your best!"

**Given** this is my first attempt
**When** viewing the results
**Then** no comparison is shown (nothing to compare against)
**And** I see a message: "First attempt complete! Retake to track improvement."

**Technical Details:**

Files to create:
- `src/lib/analytics.ts` (improvement calculation function)

Files to modify:
- `src/app/components/quiz/ScoreSummary.tsx` (add improvement display)

Improvement calculation:
```typescript
export function calculateImprovement(attempts: QuizAttempt[]): {
  firstScore: number | null
  bestScore: number | null
  bestAttemptNumber: number | null
  currentScore: number
  improvement: number | null
  isNewBest: boolean
} {
  if (attempts.length === 0) return { firstScore: null, bestScore: null, bestAttemptNumber: null, currentScore: 0, improvement: null, isNewBest: false }
  
  const sortedByDate = [...attempts].sort((a, b) => 
    new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )
  
  const firstAttempt = sortedByDate[0]
  const currentAttempt = sortedByDate[sortedByDate.length - 1]
  
  // Find the best attempt among all previous attempts (excluding current)
  const previousAttempts = sortedByDate.slice(0, -1)
  const bestPrevious = previousAttempts.length > 0
    ? previousAttempts.reduce((best, current) => 
        current.percentage > best.percentage ? current : best
      )
    : null
  
  const bestAttempt = attempts.reduce((best, current, idx) => 
    current.percentage > best.item.percentage ? { item: current, index: idx } : best,
    { item: attempts[0], index: 0 }
  )
  
  const improvement = currentAttempt.percentage - firstAttempt.percentage
  const isNewBest = bestPrevious === null || currentAttempt.percentage > bestPrevious.percentage
  
  return {
    firstScore: firstAttempt.percentage,
    bestScore: bestAttempt.item.percentage,
    bestAttemptNumber: bestAttempt.index + 1,
    currentScore: currentAttempt.percentage,
    improvement,
    isNewBest
  }
}
```

ScoreSummary improvement display:
```tsx
{attempts.length > 1 && (
  <div className="mt-4 p-4 bg-surface-sunken rounded-lg">
    <h4 className="font-semibold text-sm text-muted-foreground">Progress</h4>
    <div className="mt-2 space-y-1 text-sm">
      <div>First attempt: {improvement.firstScore}%</div>
      <div>Current attempt: {improvement.currentScore}%</div>
      <div className={improvement.improvement > 0 ? "text-success font-semibold" : "text-muted-foreground"}>
        {improvement.improvement > 0 && '+'}{improvement.improvement}%
      </div>
      {improvement.isNewBest && (
        <div className="text-success font-semibold">
          <Trophy className="h-4 w-4 text-success inline" /> New personal best!
        </div>
      )}
      {!improvement.isNewBest && attempts.length > 1 && (
        <div className="text-muted-foreground">
          Your best: {improvement.bestScore}% (attempt #{improvement.bestAttemptNumber})
          <br />
          Keep practicing to beat your best!
        </div>
      )}
    </div>
  </div>
)}
```

**Testing Requirements:**

Unit tests:
- calculateImprovement with various attempt histories
- Handles first attempt (no comparison)
- Correctly identifies new personal best (strict greater than)
- Returns bestAttemptNumber correctly
- Regression case shows best score with attempt number

E2E tests:
- First attempt → no improvement shown
- Second attempt with improvement → see +X%
- Third attempt as new best → see "New personal best!" with trophy icon
- Attempt lower than best → see "Your best: X% (attempt #N)" and "Keep practicing" message

**Dependencies:**
- Story 16.2 (needs attempt history)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Improvement percentage styling (green for positive, neutral for negative)
- "New personal best" celebration with trophy icon (not over-the-top)
- Regression case UI (best score with attempt number, encouraging message)
- Layout within results summary
- Encouraging, non-judgmental tone

---

### Story 16.4: Calculate Normalized Gain (Hake's Formula)

As a learner,
I want to see my normalized learning gain,
So that I understand my learning efficiency beyond just raw score improvement.

**FRs Fulfilled: QFR34**

**Acceptance Criteria:**

**Given** I have multiple quiz attempts
**When** viewing my improvement metrics
**Then** I see my normalized gain calculated using Hake's formula:
  - Formula: (final score - initial score) / (100 - initial score)
  - "Initial" = first attempt score, "final" = most recent attempt score
  - Example: (85 - 60) / (100 - 60) = 25 / 40 = 0.625 (62.5% gain)

**Given** my normalized gain is calculated
**When** displayed to the learner
**Then** I see it as a percentage with interpretation:
  - <0 (negative): "Regression" (neutral, encouraging tone)
  - 0-0.3 (0-30%): "Low gain" (neutral tone)
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
  level: 'regression' | 'low' | 'medium' | 'high'
  message: string
} {
  if (gain < 0) {
    return {
      level: 'regression',
      message: 'Score decreased — review the material and try again!'
    }
  } else if (gain < 0.3) {
    return {
      level: 'low',
      message: 'You\'re making progress. Keep practicing!'
    }
  } else if (gain < 0.7) {
    return {
      level: 'medium',
      message: 'Good learning progress!'
    }
  } else {
    return {
      level: 'high',
      message: 'Excellent learning efficiency!'
    }
  }
}
```

UI maps `level` to design tokens in the component (not in the utility):
```tsx
const gainColorMap: Record<string, string> = {
  regression: 'text-muted-foreground',
  low: 'text-muted-foreground',
  medium: 'text-brand',
  high: 'text-success',
}
```

Display in ScoreSummary:
```tsx
{normalizedGain !== null && (
  <div className="mt-2">
    <span className="text-sm text-muted-foreground">Normalized Gain: </span>
    <span className={cn("font-semibold", gainColorMap[interpretation.level])}>
      {Math.round(normalizedGain * 100)}%
    </span>
    <p className="text-sm text-muted-foreground mt-1">{interpretation.message}</p>
  </div>
)}
```

**Testing Requirements:**

Unit tests:
- calculateNormalizedGain with various score pairs
- Edge cases: initial=100, final < initial (negative gain)
- interpretNormalizedGain categories correct (including regression tier)

E2E tests:
- Complete quiz twice → see normalized gain displayed
- High initial score → correct gain calculation
- Score regression → see encouraging regression message

**Dependencies:**
- Story 16.2 (needs attempt history)
- Story 16.3 (extends improvement calculations)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Normalized gain percentage display
- Interpretation message tone (educational, encouraging)
- Regression case handled with neutral, non-judgmental messaging
- Tooltip explaining Hake's formula (optional)

---

### Story 16.5: Display Score Improvement Trajectory Chart

As a learner,
I want to see a visual chart of my score trajectory across quiz attempts,
So that I can quickly understand my improvement trend at a glance.

**FRs Fulfilled: QFR33**

**Acceptance Criteria:**

**Given** I have completed a quiz at least 2 times
**When** I view the quiz results or attempt history
**Then** I see a line chart showing my score trajectory
**And** the x-axis shows attempt number (1, 2, 3, ...)
**And** the y-axis shows score percentage (0-100%)

**Given** the trajectory chart is displayed
**When** viewing the chart
**Then** I see a horizontal dashed line indicating the passing score threshold
**And** the line is labeled (e.g., "Passing: 70%")
**And** data points above the line are visually distinguished from those below

**Given** I have only 1 attempt
**When** viewing the results
**Then** the trajectory chart is not displayed (requires at least 2 data points)

**Given** I am on a mobile device
**When** viewing the trajectory chart
**Then** the chart height is 200px (vs 300px on desktop)
**And** the chart remains readable and interactive

**Technical Details:**

Files to create:
- `src/app/components/quiz/ScoreTrajectoryChart.tsx`

Files to modify:
- `src/app/pages/QuizResults.tsx` (integrate chart below attempt history)

Dependencies (npm):
- `recharts` (already available in project)

ScoreTrajectoryChart component:
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface ScoreTrajectoryChartProps {
  attempts: Array<{ attemptNumber: number; percentage: number }>
  passingScore: number
}

export function ScoreTrajectoryChart({ attempts, passingScore }: ScoreTrajectoryChartProps) {
  if (attempts.length < 2) return null

  return (
    <div className="mt-4">
      <h4 className="font-semibold text-sm text-muted-foreground mb-2">Score Trajectory</h4>
      <ResponsiveContainer width="100%" height={{ desktop: 300, mobile: 200 }}>
        <LineChart data={attempts}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="attemptNumber"
            label={{ value: 'Attempt', position: 'insideBottom', offset: -5 }}
            tick={{ fill: 'var(--color-muted-foreground)' }}
          />
          <YAxis
            domain={[0, 100]}
            label={{ value: 'Score %', angle: -90, position: 'insideLeft' }}
            tick={{ fill: 'var(--color-muted-foreground)' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          />
          <ReferenceLine
            y={passingScore}
            stroke="var(--color-success)"
            strokeDasharray="5 5"
            label={{ value: `Passing: ${passingScore}%`, fill: 'var(--color-success)' }}
          />
          <Line
            type="monotone"
            dataKey="percentage"
            stroke="var(--color-brand)"
            strokeWidth={2}
            dot={{ fill: 'var(--color-brand)', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

Note: Use `useMediaQuery` or a container query to toggle between 300px (desktop) and 200px (mobile at <640px) chart heights.

**Testing Requirements:**

Unit tests:
- Chart renders with 2+ attempts
- Chart does not render with fewer than 2 attempts
- Passing score reference line positioned correctly

E2E tests:
- Complete quiz 3 times → see trajectory chart with 3 data points
- Passing threshold line visible and labeled

Accessibility tests:
- Chart has descriptive aria-label
- Data is available in table form via attempt history (Story 16.2) for screen readers

**Dependencies:**
- Story 16.2 (needs attempt history data)
- Story 16.3 (needs score improvement context)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Chart readability at different viewport sizes
- Design token usage for all chart colors (no hardcoded values)
- Passing threshold line visibility
- Tooltip styling consistency with app theme

---

## Epic 17: Analyze Quiz Data and Patterns

**Goal:** Learners can see detailed analytics including completion rates, retake frequency, time metrics, learning patterns, item difficulty, and discrimination indices.

**Technical Focus:** This epic implements psychometric calculations (P-values, discrimination indices), trajectory pattern detection, and analytics visualization.

### Story 17.1: Track and Display Quiz Completion Rate

As a learner,
I want to see my quiz completion rate,
So that I can understand how often I finish quizzes I start.

**FRs Fulfilled: QFR35**

**Acceptance Criteria:**

**Given** I have started and completed multiple quizzes
**When** I view the analytics or reports section
**Then** I see my overall quiz completion rate as a percentage
**And** the calculation is: (unique quizzes completed / unique quizzes started) * 100

**Given** I have started a quiz but not completed it
**When** that quiz is still in progress (tracked in localStorage quiz store)
**Then** it counts as "started" but not "completed"

**Given** I have completed a quiz multiple times
**When** calculating completion rate
**Then** completion rate uses unique quizzes, not raw attempts (3 attempts of same quiz = 1 completed quiz)

**Given** no quiz data exists
**When** I view the analytics section
**Then** I see a "No quizzes started yet" empty state message

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
  const completedQuizIds = new Set(allAttempts.map(a => a.quizId))
  const completedCount = completedQuizIds.size
  
  // Parse localStorage to count actual in-progress quizzes
  const quizStoreData = localStorage.getItem('levelup-quiz-store')
  let inProgressCount = 0
  if (quizStoreData) {
    try {
      const parsed = JSON.parse(quizStoreData)
      inProgressCount = parsed?.state?.inProgressQuizIds?.length ?? (parsed?.state?.currentProgress ? 1 : 0)
    } catch { inProgressCount = 0 }
  }
  
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
    <p className="text-sm text-muted-foreground mt-2">
      {completedCount} of {startedCount} started quizzes completed
    </p>
  </CardContent>
</Card>
```

**Testing Requirements:**

Unit tests:
- calculateCompletionRate with various attempt counts
- Handles zero attempts (0%) — shows empty state
- In-progress quizzes counted in started (parsed from localStorage JSON)
- Multiple attempts of same quiz count as 1 completed quiz

E2E tests:
- Complete 3 quizzes, start 1 → completion rate 75%
- View in Reports section → see metric displayed
- No quiz data → see "No quizzes started yet" message

**Dependencies:**
- Story 12.2 (needs quizAttempts table)
- Story 12.3 (needs localStorage quiz state)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Progress bar styling
- Percentage display size and emphasis
- Raw numbers clarity
- Empty state message styling

---

### Story 17.2: Track Average Retake Frequency

As a learner,
I want to see how often I retake quizzes on average,
So that I can understand my learning persistence.

**FRs Fulfilled: QFR36**

**Acceptance Criteria:**

**Given** I have completed multiple quizzes
**When** I view the analytics section
**Then** I see my average retake frequency per quiz
**And** the calculation is: total attempts / unique quizzes

**Given** I completed Quiz A 3 times and Quiz B 2 times
**When** calculating average retake frequency
**Then** the result is (3 + 2) / 2 = 2.5 attempts per quiz

**Given** the retake frequency is 1.0
**When** viewing the metric
**Then** I see the interpretation: "No retakes yet — each quiz taken once."

**Given** the retake frequency is between 1.1 and 2.0
**When** viewing the metric
**Then** I see the interpretation: "Light review — you occasionally revisit quizzes."

**Given** the retake frequency is between 2.1 and 3.0
**When** viewing the metric
**Then** I see the interpretation: "Active practice — you retake quizzes 2-3 times on average for mastery."

**Given** the retake frequency is above 3.0
**When** viewing the metric
**Then** I see the interpretation: "Deep practice — strong commitment to mastery through repetition."

**Given** the retake frequency is displayed
**When** viewing the metric
**Then** I see it rounded to 1 decimal place (e.g., "2.5 attempts per quiz")

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

export function interpretRetakeFrequency(avg: number): string {
  if (avg <= 1.0) return 'No retakes yet — each quiz taken once.'
  if (avg <= 2.0) return 'Light review — you occasionally revisit quizzes.'
  if (avg <= 3.0) return 'Active practice — you retake quizzes 2-3 times on average for mastery.'
  return 'Deep practice — strong commitment to mastery through repetition.'
}
```

Display in Reports page:
```tsx
<Card>
  <CardHeader><CardTitle>Average Retake Frequency</CardTitle></CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">{averageRetakes.toFixed(1)}</div>
    <p className="text-sm text-muted-foreground mt-1">attempts per quiz</p>
    <p className="text-sm text-muted-foreground mt-2">{interpretRetakeFrequency(averageRetakes)}</p>
  </CardContent>
</Card>
```

**Testing Requirements:**

Unit tests:
- calculateRetakeFrequency with various attempt distributions
- Handles single quiz with multiple attempts
- Zero attempts returns 0
- interpretRetakeFrequency returns correct text for each range (1.0, 1.5, 2.5, 4.0)

E2E tests:
- Complete same quiz 3 times → retake frequency = 3.0
- Complete 2 different quizzes → retake frequency = 1.0

**Dependencies:**
- Story 12.2 (needs quizAttempts table)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Metric display (number + dynamic interpretation)
- Encouraging tone for retakes (persistence is good!)

---

### Story 17.3: Calculate Item Difficulty (P-Values)

As a learner,
I want to see which quiz questions are easiest and hardest based on my performance,
So that I can understand which concepts need more practice.

**FRs Fulfilled: QFR39**

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
  - P >= 0.8: "Easy"
  - 0.5 <= P < 0.8: "Medium"
  - P < 0.5: "Difficult"

**Given** a question has zero attempts (never encountered)
**When** calculating difficulty
**Then** the question is excluded from the analysis or shown as "Not enough data"

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
  
  // Calculate P-values (exclude questions with zero attempts)
  return quiz.questions
    .map(q => {
      const stats = questionStats.get(q.id) || { correct: 0, total: 0 }
      if (stats.total === 0) return null  // Skip questions with no attempts
      const pValue = stats.correct / stats.total
      
      let difficulty = 'Medium'
      if (pValue >= 0.8) difficulty = 'Easy'
      else if (pValue < 0.5) difficulty = 'Difficult'
      
      return {
        questionId: q.id,
        questionText: q.text,
        pValue,
        difficulty
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.pValue - a.pValue)  // Easiest first
}
```

Display component skeleton:
```tsx
// src/app/components/quiz/ItemDifficultyAnalysis.tsx
export function ItemDifficultyAnalysis({ quiz, attempts }: {
  quiz: Quiz
  attempts: QuizAttempt[]
}) {
  const items = calculateItemDifficulty(quiz, attempts)
  
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough data to analyze difficulty.</p>
  }
  
  return (
    <Card>
      <CardHeader><CardTitle>Question Difficulty Analysis</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map(item => (
            <li key={item.questionId} className="flex justify-between items-center">
              <span className="text-sm truncate flex-1">{item.questionText}</span>
              <Badge>{item.difficulty} (P={item.pValue.toFixed(2)})</Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
```

**Testing Requirements:**

Unit tests:
- calculateItemDifficulty with various attempt patterns
- P-value calculation accuracy
- Difficulty categorization correct (boundary: P=0.8 is "Easy", P=0.5 is "Medium")
- Questions with zero attempts excluded from results

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

**FRs Fulfilled: QFR40**

**Acceptance Criteria:**

**Given** I have multiple attempts on a quiz (minimum 5 attempts for meaningful results)
**When** calculating discrimination for each question
**Then** the system uses point-biserial correlation between question correctness and total score

**Given** I have fewer than 5 attempts on a quiz
**When** viewing discrimination indices
**Then** I see a message: "Need at least 5 attempts for meaningful discrimination analysis"

**Given** a question is highly discriminating
**When** viewing its discrimination index
**Then** I see a high value (>0.3)
**And** this indicates: "You tend to get this question right on high-scoring attempts and wrong on low-scoring attempts."

**Given** a question has medium discrimination (0.2 to 0.3)
**When** viewing the metric
**Then** I see an indicator: "Moderate discriminator — this question partially differentiates strong and weak attempts."

**Given** a question has low discrimination (<0.2)
**When** viewing the metric
**Then** I see an indicator: "This question doesn't correlate well with overall performance - might be ambiguous or overly easy/hard."

**Technical Details:**

Files to modify:
- `src/lib/analytics.ts` (add discrimination calculation)

Files to create:
- `src/app/components/quiz/DiscriminationAnalysis.tsx` (display component)

Discrimination calculation (point-biserial correlation):
```typescript
export function calculateDiscriminationIndices(
  quiz: Quiz,
  attempts: QuizAttempt[]
): Array<{ questionId: string, discriminationIndex: number, interpretation: string }> | null {
  // Require minimum 5 attempts for meaningful results
  if (attempts.length < 5) return null
  
  // For each question, calculate correlation between:
  // X = question correctness (0 or 1)
  // Y = total quiz score
  
  return quiz.questions.map(question => {
    const dataPoints = attempts.map(attempt => {
      const answer = attempt.answers.find(a => a.questionId === question.id)
      const questionCorrect = answer?.isCorrect ? 1 : 0
      const totalScore = attempt.score
      
      return { x: questionCorrect, y: totalScore }
    })
    
    // Point-biserial correlation formula
    const n = dataPoints.length
    if (n < 2) return { questionId: question.id, discriminationIndex: 0, interpretation: 'Not enough data' }
    
    const group1 = dataPoints.filter(d => d.x === 1).map(d => d.y)  // Correct
    const group0 = dataPoints.filter(d => d.x === 0).map(d => d.y)  // Incorrect
    
    if (group1.length === 0 || group0.length === 0) {
      return { questionId: question.id, discriminationIndex: 0, interpretation: 'Not enough data' }
    }
    
    const mean1 = group1.reduce((sum, val) => sum + val, 0) / group1.length
    const mean0 = group0.reduce((sum, val) => sum + val, 0) / group0.length
    
    // Sample standard deviation of all scores (n-1 for sample)
    const allScores = dataPoints.map(d => d.y)
    const meanAll = allScores.reduce((sum, val) => sum + val, 0) / allScores.length
    const variance = allScores.reduce((sum, val) => sum + Math.pow(val - meanAll, 2), 0) / (n - 1)
    const sd = Math.sqrt(variance)
    
    // Guard against zero standard deviation (all scores identical)
    if (sd === 0) {
      return { questionId: question.id, discriminationIndex: 0, interpretation: 'All scores identical — cannot discriminate' }
    }
    
    // Point-biserial formula
    const p = group1.length / n
    const pComplement = 1 - p
    const rpb = ((mean1 - mean0) / sd) * Math.sqrt(p * pComplement)
    
    // Interpret the discrimination index
    let interpretation: string
    if (rpb > 0.3) {
      interpretation = 'High discriminator — you tend to get this right on strong attempts and wrong on weak ones.'
    } else if (rpb >= 0.2) {
      interpretation = 'Moderate discriminator — this question partially differentiates strong and weak attempts.'
    } else {
      interpretation = "Low discriminator — doesn't correlate well with overall performance. Might be ambiguous or overly easy/hard."
    }
    
    return { questionId: question.id, discriminationIndex: rpb, interpretation }
  })
}
```

Display component:
```tsx
// src/app/components/quiz/DiscriminationAnalysis.tsx
export function DiscriminationAnalysis({ quiz, attempts }: {
  quiz: Quiz
  attempts: QuizAttempt[]
}) {
  const results = calculateDiscriminationIndices(quiz, attempts)
  
  if (!results) {
    return <p className="text-sm text-muted-foreground">Need at least 5 attempts for meaningful discrimination analysis.</p>
  }
  
  return (
    <Card>
      <CardHeader><CardTitle>Question Discrimination Analysis</CardTitle></CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {results.map(item => (
            <li key={item.questionId}>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Question {item.questionId}</span>
                <span className="text-sm font-bold">{item.discriminationIndex.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.interpretation}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
```

**Testing Requirements:**

Unit tests:
- calculateDiscriminationIndices with known data
- Handles edge cases (all correct, all incorrect)
- Returns null when fewer than 5 attempts
- Returns discriminationIndex: 0 when sd === 0 (all scores identical)
- Uses sample standard deviation (n-1)
- Correct interpretation text for high (>0.3), medium (0.2-0.3), and low (<0.2) values

**Dependencies:**
- Story 16.2 (needs attempt history)
- Story 17.3 (extends item analysis)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Discrimination index display (rounded to 2 decimals)
- Interpretation text (high/medium/low discrimination)
- Display component placement within Reports or QuizResults page

---

### Story 17.5: Identify Learning Trajectory Patterns

As a learner,
I want to see if my scores follow a linear, exponential, or logarithmic improvement pattern,
So that I can understand my learning curve.

**FRs Fulfilled: QFR38**

**Acceptance Criteria:**

**Given** I have 3+ attempts on a quiz
**When** viewing the improvement visualization
**Then** I see a line chart with attempt number (x-axis) vs. score (y-axis)
**And** I see a detected pattern label: "Linear growth", "Exponential growth", or "Logarithmic growth"
**And** the chart has an `aria-label` describing the trajectory (e.g., "Learning trajectory chart showing linear growth over 5 attempts")

**Given** my scores improve rapidly at first then plateau (e.g., 50%, 70%, 80%, 82%)
**When** the pattern is detected
**Then** it is labeled "Logarithmic - Strong early gains, then plateauing"

**Given** my scores improve steadily (e.g., 60%, 70%, 80%, 90%)
**When** the pattern is detected
**Then** it is labeled "Linear - Consistent improvement"

**Given** my scores improve slowly then rapidly (e.g., 60%, 62%, 68%, 85%)
**When** the pattern is detected
**Then** it is labeled "Exponential - Accelerating mastery"

**Given** my scores decline overall (e.g., 85%, 75%, 70%, 65%)
**When** the pattern is detected
**Then** it is labeled "Declining — consider reviewing material"

**Given** my scores remain flat (e.g., 70%, 72%, 69%, 71%)
**When** the pattern is detected
**Then** it is labeled "Plateau — consistent performance"

**Given** a pattern is detected
**When** viewing the confidence indicator
**Then** the confidence value is computed from R² (coefficient of determination) of the best-fit model
**And** displayed as a percentage (e.g., "85% confidence")

**Technical Details:**

Files to create:
- `src/app/components/quiz/ImprovementChart.tsx` (visualization)

Files to modify:
- `src/lib/analytics.ts` (add pattern detection)

Pattern detection:
```typescript
export function detectLearningTrajectory(
  attempts: QuizAttempt[]
): { pattern: 'linear' | 'exponential' | 'logarithmic' | 'declining' | 'plateau', confidence: number, summary: string } {
  if (attempts.length < 3) return { pattern: 'linear', confidence: 0, summary: 'Not enough data to detect a pattern.' }
  
  const sortedAttempts = [...attempts].sort((a, b) => 
    new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )
  
  const scores = sortedAttempts.map(a => a.percentage)
  const n = scores.length
  
  // Calculate rate of change between consecutive attempts
  const changes: number[] = []
  for (let i = 1; i < n; i++) {
    changes.push(scores[i] - scores[i-1])
  }
  
  const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length
  
  // Check for declining trajectory (overall negative trend)
  if (avgChange < -2) {
    const r2 = calculateLinearR2(scores)
    return { pattern: 'declining', confidence: r2, summary: 'Declining — consider reviewing material.' }
  }
  
  // Check for flat trajectory (very small average change)
  const variance = changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length
  if (Math.abs(avgChange) <= 2 && variance < 5) {
    const r2 = calculateLinearR2(scores)
    return { pattern: 'plateau', confidence: r2, summary: 'Plateau — consistent performance.' }
  }
  
  // Fit three growth models and compare R² values
  const linearR2 = calculateLinearR2(scores)
  
  // Check if changes are trending up or down to distinguish exp vs log
  const firstHalfAvg = changes.slice(0, Math.floor(changes.length / 2)).reduce((sum, c) => sum + c, 0) / Math.floor(changes.length / 2)
  const secondHalfAvg = changes.slice(Math.floor(changes.length / 2)).reduce((sum, c) => sum + c, 0) / Math.ceil(changes.length / 2)
  
  if (variance < 5) {
    return { pattern: 'linear', confidence: linearR2, summary: 'Linear — consistent improvement.' }
  }
  
  if (secondHalfAvg > firstHalfAvg) {
    const r2 = calculateLinearR2(scores) // Approximate; exponential R² would be more precise
    return { pattern: 'exponential', confidence: r2, summary: 'Exponential — accelerating mastery.' }
  } else {
    const r2 = calculateLinearR2(scores)
    return { pattern: 'logarithmic', confidence: r2, summary: 'Logarithmic — strong early gains, then plateauing.' }
  }
}

/** Calculate R² (coefficient of determination) for a linear fit of scores indexed 0..n-1 */
function calculateLinearR2(scores: number[]): number {
  const n = scores.length
  if (n < 2) return 0
  
  const xMean = (n - 1) / 2
  const yMean = scores.reduce((s, v) => s + v, 0) / n
  
  let ssXY = 0, ssXX = 0, ssTot = 0
  for (let i = 0; i < n; i++) {
    ssXY += (i - xMean) * (scores[i] - yMean)
    ssXX += (i - xMean) ** 2
    ssTot += (scores[i] - yMean) ** 2
  }
  
  if (ssTot === 0 || ssXX === 0) return 0
  
  const slope = ssXY / ssXX
  const intercept = yMean - slope * xMean
  
  let ssRes = 0
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept
    ssRes += (scores[i] - predicted) ** 2
  }
  
  return Math.max(0, 1 - ssRes / ssTot)
}
```

Chart visualization (using recharts):
```tsx
<div aria-label={`Learning trajectory chart showing ${trajectory.pattern} pattern over ${chartData.length} attempts`}>
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={chartData}>
      <XAxis dataKey="attempt" label={{ value: 'Attempt', position: 'insideBottom' }} />
      <YAxis label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }} />
      <Tooltip />
      <Line type="monotone" dataKey="score" stroke="var(--color-brand)" strokeWidth={2} />
    </LineChart>
  </ResponsiveContainer>
  <p className="text-sm text-muted-foreground mt-2 text-center">
    {trajectory.summary} ({Math.round(trajectory.confidence * 100)}% confidence)
  </p>
</div>
```

**Testing Requirements:**

Unit tests:
- detectLearningTrajectory with known patterns
- Pattern classification accuracy (linear, exponential, logarithmic, declining, plateau)
- Declining scores detected correctly
- Flat scores detected as plateau
- Confidence computed from R² (not hardcoded)
- calculateLinearR2 returns values between 0 and 1

E2E tests:
- Complete quiz 5 times with improving scores → see trajectory chart and pattern label
- Chart has accessible aria-label

**Dependencies:**
- Story 16.2 (needs attempt history)
- Story 16.3 (improvement calculations)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Chart styling and responsiveness
- Pattern label placement and clarity
- Axis labels and legend
- Chart accessibility (aria-label, text summary)

---

## Epic 18: Accessible and Integrated Quiz Experience

**Goal:** All learners can access quiz features via keyboard and screen readers (WCAG 2.1 AA+). Quiz data integrates across the LevelUp platform.

**Technical Focus:** This epic implements comprehensive accessibility compliance and cross-platform integration points.

### Story 18.1: Implement Complete Keyboard Navigation

As a learner using only a keyboard,
I want to navigate and complete quizzes without using a mouse,
So that I can access quiz features independently.

**FRs Fulfilled: QFR41**

**Acceptance Criteria:**

**Given** I am navigating the quiz using only keyboard
**When** I press Tab
**Then** focus moves sequentially through all interactive elements in logical order:
  - Answer options (radio buttons or checkboxes)
  - "Mark for Review" toggle
  - Navigation buttons (Previous, Next, Submit)
  - Question grid

**Given** the quiz starts or I navigate to a new question
**When** the question renders
**Then** the question text container (with `tabindex="-1"`) receives programmatic focus via `useEffect` keyed on `currentQuestionIndex`
**And** screen readers announce the question text
**But** the question text is NOT reachable via Tab (it is not in the tab order)

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
**Then** I can use Arrow Left/Right to move between question numbers
**And** I can press Enter to jump to that question

**Given** I press Escape anywhere in the quiz
**When** a modal or dialog is open
**Then** it closes and focus returns to the trigger element
**And** focus is trapped within the modal while it is open (Tab and Shift+Tab cycle within modal boundaries)

**Technical Details:**

Files to modify:
- `src/app/components/quiz/QuizContainer.tsx` (tab order orchestration, focus management)
- `src/app/components/quiz/QuestionGrid.tsx` (Arrow Left/Right keyboard navigation)
- `src/app/components/quiz/questions/MultipleChoice.tsx` (radio group keyboard pattern)
- `src/app/components/quiz/questions/MultipleSelect.tsx` (checkbox keyboard pattern)
- `src/app/components/quiz/QuizHeader.tsx` (navigation button keyboard handling)
- `src/app/components/quiz/SubmitConfirmDialog.tsx` (focus trap in modal)

Keyboard patterns to implement:
- Radio groups: Arrow key navigation, Space to select
- Checkboxes: Space to toggle
- Buttons: Enter or Space to activate
- Question grid: Arrow Left/Right to navigate, Enter to jump
- Modal dialogs: Esc to close, focus trap while open

Focus management:
```tsx
// Programmatic focus on question change — useEffect keyed on index, not setTimeout
const questionRef = useRef<HTMLHeadingElement>(null)

useEffect(() => {
  questionRef.current?.focus()
}, [currentQuestionIndex])

// Question text container — programmatically focused, not Tab-reachable
<h2 ref={questionRef} tabIndex={-1} className="outline-none">
  {question.text}
</h2>
```

**Testing Requirements:**

E2E tests (keyboard only):
- Tab through entire quiz without mouse → all interactive elements reachable
- Answer all questions using only keyboard
- Navigate with Arrow keys in radio groups
- Navigate question grid with Arrow Left/Right
- Submit quiz using Enter key
- Open modal → verify focus trap → Escape closes and restores focus

Accessibility tests:
- Focus visible on all interactive elements (4.5:1 contrast)
- Tab order is logical (top to bottom, left to right)
- No keyboard traps (can always Tab out, except within open modals)

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

**FRs Fulfilled: QFR42, QFR46**

**Acceptance Criteria:**

**Given** I am using a screen reader
**When** I answer a question
**Then** the feedback (Correct/Incorrect) is announced immediately
**And** the announcement uses `aria-live="polite"` (doesn't interrupt current reading)

**Given** I select or deselect an answer option
**When** the selection changes
**Then** the screen reader announces the selected answer (e.g., "Option B selected")

**Given** I toggle "Mark for Review" on a question
**When** the toggle changes
**Then** the screen reader announces the new state (e.g., "Question 3 marked for review" or "Question 3 unmarked for review")

**Given** the quiz timer is running normally (above 75% time remaining)
**When** each second ticks
**Then** the timer uses `aria-live="off"` (no announcements during normal countdown)

**Given** the quiz timer reaches the 75% elapsed threshold (25% time remaining)
**When** the warning triggers
**Then** the time remaining is announced via `aria-live="polite"`
**And** the announcement does not interrupt current reading

**Given** the quiz timer reaches the 10% remaining or 1-minute remaining threshold
**When** the critical warning triggers
**Then** the time remaining is announced via `aria-live="assertive"`
**And** the announcement interrupts current reading (urgent warning)

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
- `src/app/components/quiz/QuizTimer.tsx` (add tiered ARIA live for warnings)
- `src/app/components/quiz/ScoreSummary.tsx` (add ARIA live for score)
- `src/app/components/quiz/QuizHeader.tsx` (add ARIA live for navigation, answer selection, review toggle)

ARIA live region implementation:
```tsx
// Feedback (polite)
<div role="status" aria-live="polite" aria-atomic="true">
  {answerFeedback && `${isCorrect ? 'Correct' : 'Incorrect'}. ${explanation}`}
</div>

// Answer selection announcement (polite)
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {selectedAnswer && `Option ${selectedAnswer} selected`}
</div>

// Review toggle announcement (polite)
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {reviewAnnouncement}
</div>

// Timer — tiered politeness levels with debouncing
// Normal ticking: aria-live="off" (no announcements)
// 75% elapsed: aria-live="polite" (non-interrupting)
// 10% remaining or 1 minute: aria-live="assertive" (interrupting)
const timerPoliteness = useMemo(() => {
  if (percentRemaining > 25) return 'off'
  if (percentRemaining > 10 && timeRemaining > 60) return 'polite'
  return 'assertive'
}, [percentRemaining, timeRemaining])

// Debounce: only update live region text at warning thresholds, not every second
<div role="timer" aria-live={timerPoliteness} aria-atomic="true" className="sr-only">
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

**Note on debouncing:** Live region text should only change at threshold boundaries (75% elapsed, 10% remaining, 1 minute remaining), not on every timer tick. Updating the live region every second causes screen reader verbosity. Use a ref to track the last announced threshold and only update when crossing a new boundary.

**Testing Requirements:**

Accessibility tests (VoiceOver primary + axe-core automated):
- Answer question → feedback announced
- Select answer option → selection announced
- Toggle "Mark for Review" → state change announced
- Timer normal ticking → no announcements (aria-live="off")
- Timer 75% elapsed warning → polite announcement
- Timer 10% remaining → assertive announcement
- Submit quiz → score announced
- Navigate questions → question number announced

**Dependencies:**
- Story 15.3 (timer warnings)
- Story 15.4 (answer feedback)
- Story 12.6 (score calculation)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- ARIA live announcements not verbose (concise)
- Politeness levels appropriate (off → polite → assertive)
- Screen reader only content (sr-only class)
- Debouncing prevents announcement flooding

---

### Story 18.3: Ensure Semantic HTML and Proper ARIA Attributes

As a screen reader user,
I want quiz components to use proper semantic HTML,
So that I can understand the structure and navigate efficiently.

**FRs Fulfilled: QFR45**

**Acceptance Criteria:**

**Given** quiz components use form controls
**When** rendering questions
**Then** radio button groups use `<fieldset>` and `<legend>`
**And** all inputs have associated `<label>` elements
**And** related controls are grouped logically

**Given** quiz pages render
**When** inspecting the document structure
**Then** headings follow a logical hierarchy (h1 for quiz title, h2 for question, h3 for subsections)
**And** a `<nav>` landmark wraps the question grid navigation
**And** the quiz content area uses `<main>` with `<section>` for distinct regions (question area, navigation, timer)

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
**Then** `role="timer"` is used for the countdown display with `aria-live="off"` (warning announcements are handled separately by Story 18.2's tiered live region)
**And** `role="progressbar"` is used for question progress
**And** `aria-valuenow`, `aria-valuemin`, `aria-valuemax` are set correctly

**Technical Details:**

Files to modify:
- All question components (ensure semantic HTML)
- All quiz UI components (add proper ARIA attributes)

Semantic HTML patterns:
```tsx
// Question with radio group — fieldset/legend provides the accessible name
<fieldset>
  <legend>{question.text}</legend>
  <RadioGroup>
    {options.map(option => (
      <label key={option}>
        <RadioGroupItem name="answer" value={option} />
        {option}
      </label>
    ))}
  </RadioGroup>
</fieldset>

// Progress indicator
<div role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={totalQuestions} aria-label="Quiz progress">
  Question {currentIndex + 1} of {totalQuestions}
</div>

// Timer — role="timer" with aria-live="off"
// Note: Warning announcements at thresholds are handled by Story 18.2's
// separate live region with tiered politeness (polite at 75%, assertive at 10%/1min)
<div role="timer" aria-live="off" aria-label="Time remaining">
  {formatTime(timeRemaining)}
</div>

// Quiz structure with landmarks
<main aria-label="Quiz">
  <section aria-label="Question area">
    <h1>{quiz.title}</h1>
    <h2>Question {currentIndex + 1}</h2>
    {/* question content */}
  </section>
  <nav aria-label="Question navigation">
    {/* question grid */}
  </nav>
</main>

// Icon button
<button aria-label="Next question">
  <ArrowRight aria-hidden="true" />
</button>
```

**Testing Requirements:**

Accessibility tests:
- Automated axe-core scan → zero violations
- Manual screen reader test → all controls announced correctly
- Landmark navigation → proper structure (main, nav, sections)
- Heading hierarchy check → logical h1 > h2 > h3 nesting

**Dependencies:**
- All previous stories (applies to all components)

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Semantic HTML structure
- ARIA attributes correctness
- Heading hierarchy
- Landmark regions
- Screen reader announcement quality

---

### Story 18.4: Verify Contrast Ratios and Touch Targets

As a learner with visual impairments or using a mobile device,
I want sufficient color contrast and large touch targets,
So that I can see and interact with quiz elements easily.

**FRs Fulfilled: QFR44, QFR48**

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

**Given** dark mode is enabled
**When** viewing quiz components
**Then** all contrast ratios still meet WCAG 2.1 AA minimum requirements
**And** focus indicators remain visible against dark backgrounds

**Technical Details:**

Use the contrast ratios table from the UX specification (lines 886-906) as the reference for all color combinations. All colors must use design tokens from `src/styles/theme.css` — no hardcoded hex values.

Focus indicator and touch target implementation using Tailwind utilities and theme tokens:
```tsx
{/* Focus indicator — uses theme tokens */}
<style>{`
  .quiz-focus:focus-visible {
    outline: 2px solid var(--color-brand);
    outline-offset: 2px;
  }
`}</style>

{/* Touch targets — Tailwind utilities */}
<RadioGroupItem className="min-h-[44px] min-w-[44px] sm:min-h-[40px]" />
<Button className="min-h-[44px] sm:min-h-[40px]" />
```

**Testing Requirements:**

Accessibility tests:
- axe-core automated contrast audit integrated in E2E spec → zero violations
- Manual spot checks with contrast checker for edge cases
- Mobile testing (375px) → all targets ≥44px
- Dark mode contrast audit → zero violations

**Dependencies:**
- All previous stories (applies to all UI components)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Text contrast (especially on colored backgrounds)
- Button/link contrast
- Focus indicator visibility
- Mobile touch target sizes
- Dark mode contrast compliance

---

### Story 18.5: Integrate Quiz Completion with Study Streaks

As a learner,
I want quiz completions to count toward my study streak,
So that taking quizzes contributes to my daily learning activity.

**FRs Fulfilled: QFR55**

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

**Given** the streak recording fails (e.g., Dexie write error)
**When** submitting a quiz
**Then** the quiz submission still succeeds (streak failure must not block submission)
**And** the error is logged but not shown to the user

**Technical Details:**

Files to modify:
- `src/stores/useQuizStore.ts` (trigger streak update on submit)
- `src/stores/useStreakStore.ts` (ensure quiz activity counts — prerequisite: must exist from Epic 5 or be created as part of this story)

**Prerequisite note:** `useStreakStore` and a `streaks` Dexie table do not currently exist. Either Epic 5 must implement them first, or this story's scope must include creating both. Add `streaks: 'date, activityType'` to the Dexie schema.

Cross-store integration in useQuizStore.submitQuiz:
```typescript
submitQuiz: async () => {
  // ... existing quiz submission logic
  
  try {
    await db.quizAttempts.add(attempt)
    
    // Trigger study streak update (QFR55)
    // Fire-and-forget: streak failure must not block quiz submission
    try {
      useStreakStore.getState().recordActivity('quiz', attempt.timeSpent)
    } catch (streakError) {
      console.error('Streak recording failed (non-blocking):', streakError)
    }
    
    // ... rest of submission logic
  } catch (error) {
    // ... error handling
  }
}
```

useStreakStore.recordActivity (if not already implemented):
```typescript
recordActivity: (activityType: string, duration: number) => {
  // Timezone-safe local date
  const today = new Intl.DateTimeFormat('en-CA').format(new Date()) // YYYY-MM-DD in local timezone
  
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
- Streak recording failure does not prevent quiz submission

Integration tests:
- Complete quiz → streak updated
- Complete 2 quizzes same day → streak updated once

E2E tests:
- Complete quiz → view streak calendar → today marked active

**Dependencies:**
- Story 12.3 (needs useQuizStore.submitQuiz)
- Epic 5 or new subtask (needs useStreakStore and `streaks` Dexie table)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- N/A (integration logic only)

---

### Story 18.6: Display Quiz Performance in Overview Dashboard

As a learner,
I want to see my quiz performance summary on the Overview dashboard,
So that I can quickly see my quiz activity alongside other learning metrics.

**FRs Fulfilled: QFR56**

**Acceptance Criteria:**

**Given** I have completed quizzes
**When** I view the Overview dashboard
**Then** I see a "Quiz Performance" card or section
**And** it displays my total quizzes completed
**And** it displays my average quiz score across all attempts
**And** it displays my quiz completion rate

**Given** the Quiz Performance card is loading data
**When** Dexie queries are running
**Then** I see a skeleton loading state (not a blank card)

**Given** I click on the Quiz Performance card
**When** interacting with it
**Then** I navigate to the Reports section quiz tab (`/reports?tab=quizzes`)
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

**Metric definitions:**
- `completionRate`: percentage of started quizzes that were submitted (not abandoned). Calculated as `(submittedAttempts / totalAttempts) * 100` where `totalAttempts` includes both submitted and abandoned attempts.

QuizPerformanceCard component:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Quiz Performance</CardTitle>
  </CardHeader>
  <CardContent>
    {isLoading ? (
      <QuizPerformanceSkeleton />
    ) : totalQuizzes > 0 ? (
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Quizzes Completed</span>
          <span className="font-semibold">{totalQuizzes}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Average Score</span>
          <span className="font-semibold">{Math.round(averageScore)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Completion Rate</span>
          <span className="font-semibold">{Math.round(completionRate)}%</span>
        </div>
      </div>
    ) : (
      <div className="text-center py-4">
        <p className="text-muted-foreground mb-2">No quizzes completed yet.</p>
        <Button variant="link">Find Quizzes</Button>
      </div>
    )}
  </CardContent>
  <CardFooter>
    <Link to="/reports?tab=quizzes" className="text-sm text-brand hover:underline">
      View Detailed Analytics →
    </Link>
  </CardFooter>
</Card>
```

Calculate metrics:
```typescript
const calculateQuizMetrics = async () => {
  const allAttempts = await db.quizAttempts.toArray()
  const submittedAttempts = allAttempts.filter(a => a.status === 'submitted')
  const totalQuizzes = submittedAttempts.length
  const averageScore = totalQuizzes > 0
    ? submittedAttempts.reduce((sum, a) => sum + a.percentage, 0) / totalQuizzes
    : 0
  const completionRate = allAttempts.length > 0
    ? (submittedAttempts.length / allAttempts.length) * 100
    : 0
  
  return { totalQuizzes, averageScore, completionRate }
}
```

**Testing Requirements:**

Unit tests:
- calculateQuizMetrics with various attempt counts
- completionRate calculation with mixed submitted/abandoned attempts

E2E tests:
- Complete quiz → view Overview → see Quiz Performance card
- Click card → navigate to Reports quiz tab
- Loading state renders skeleton before data loads

**Dependencies:**
- Story 12.2 (needs quizAttempts table)
- Story 17.1 (uses completion rate calculation)
- Epic from main LevelUp (needs Overview page) - assume exists

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Card layout and metrics display
- Loading skeleton state
- Empty state messaging and CTA
- Link to detailed analytics

---

### Story 18.7: Surface Quiz Analytics in Reports Section

As a learner,
I want to see detailed quiz analytics in the Reports section,
So that I can understand my quiz performance alongside other learning metrics.

**FRs Fulfilled: QFR57**

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

**Given** I have no quiz data
**When** the Quiz Analytics tab loads
**Then** I see an empty state with a message: "No quiz data yet. Complete a quiz to see your analytics."
**And** I see a CTA linking to available quizzes

**Given** I want to see details for a specific quiz
**When** I click on a quiz in the list
**Then** I navigate to that quiz's detailed analytics at `/reports/quiz/:quizId`:
  - All attempt history
  - Score improvement trajectory
  - Item difficulty analysis
  - Discrimination indices
  - Normalized gain

**Given** I view the Quiz Analytics on a mobile viewport
**When** the page renders
**Then** the metric cards display in a single column (responsive: 3-col → 1-col on mobile)

**Technical Details:**

Files to modify:
- `src/app/pages/Reports.tsx` (add Quiz Analytics section)
- `src/app/routes.tsx` (add `/reports/quiz/:quizId` route)

Files to create (if needed):
- `src/app/components/reports/QuizAnalyticsDashboard.tsx`
- `src/app/pages/QuizDetailAnalytics.tsx` (detailed view per quiz, route: `/reports/quiz/:quizId`)

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
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
  
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
- Click quiz in list → see detailed analytics at `/reports/quiz/:quizId`
- Empty state displays when no quiz data exists
- Mobile viewport → metric cards stack to single column

**Dependencies:**
- Stories 17.1-17.5 (analytics calculations)
- Epic from main LevelUp (needs Reports page) - assume exists

**Complexity:** Medium (4-5 hours)

**Design Review Focus:**
- Tab integration in Reports page
- Metric card styling
- Table/list layouts for quiz data
- Navigation to detailed view
- Empty state design
- Responsive grid (3-col → 1-col)

---

### Story 18.8: Display Quiz Availability Badges on Courses Page

As a learner,
I want to see which lessons have quizzes available,
So that I can easily find and take quizzes while browsing courses.

**FRs Fulfilled: QFR58, QFR61**

**Acceptance Criteria:**

**Given** I view the Courses page or Course Detail page
**When** browsing lessons
**Then** I see a "Quiz" badge or icon on lessons that have quizzes
**And** the badge is visually distinct (e.g., quiz icon or "Quiz Available" label)

**Given** I have NOT completed a quiz for a lesson
**When** viewing the quiz badge
**Then** it displays as "Take Quiz" or shows as available (not completed)
**And** the text color uses `text-muted-foreground`

**Given** I HAVE completed a quiz for a lesson
**When** viewing the quiz badge
**Then** it displays my best score (e.g., "Quiz: 85%")
**And** the text color uses `text-success` to indicate completion
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

**Performance note:** When rendering a page with many lessons, batch the Dexie queries to avoid N+1 performance issues. Fetch all quiz records for the current course in a single query, then match to lessons in memory.

QuizBadge component:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`)}
  className="flex items-center gap-2"
  aria-label={`${bestScore ? `Quiz score: ${bestScore}%` : 'Take quiz'} for ${lessonTitle}`}
>
  <ClipboardCheck className="h-4 w-4" />
  {bestScore ? (
    <span className="text-success">Quiz: {bestScore}%</span>
  ) : (
    <span className="text-muted-foreground">Take Quiz</span>
  )}
</Button>
```

Fetch best scores (batched):
```typescript
// Batch fetch: one query per course, not per lesson
const getQuizScoresForCourse = async (courseId: string, lessonIds: string[]) => {
  const quizzes = await db.quizzes.where('lessonId').anyOf(lessonIds).toArray()
  if (quizzes.length === 0) return new Map<string, number>()
  
  const quizIds = quizzes.map(q => q.id)
  const attempts = await db.quizAttempts.where('quizId').anyOf(quizIds).toArray()
  
  // Group by lessonId, find best score per lesson
  const scoreMap = new Map<string, number>()
  for (const quiz of quizzes) {
    const quizAttempts = attempts.filter(a => a.quizId === quiz.id)
    if (quizAttempts.length > 0) {
      const best = Math.max(...quizAttempts.map(a => a.percentage))
      scoreMap.set(quiz.lessonId, best)
    }
  }
  
  return scoreMap
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
- Icon choice (ClipboardCheck per UX spec)
- Badge interaction (button with aria-label)
- Score display formatting
- Color tokens for completed vs available states

---

### Story 18.9: Configure Quiz Preferences in Settings

As a learner,
I want to configure my quiz preferences in the Settings page,
So that quizzes adapt to my preferred defaults without manual adjustment each time.

**FRs Fulfilled: QFR43, QFR59**

**Acceptance Criteria:**

**Given** I navigate to the Settings page
**When** the page loads
**Then** I see a "Quiz Preferences" section with configurable options:
  - Timer accommodation default (1x, 1.5x, 2x time multiplier)
  - Immediate feedback toggle (show correct/incorrect after each question)
  - Shuffle questions toggle (randomize question order)

**Given** I change a quiz preference
**When** I toggle or select a new value
**Then** the preference is persisted to localStorage
**And** a confirmation toast appears: "Quiz preferences saved"

**Given** I start a new quiz
**When** the quiz initializes
**Then** the quiz reads my saved preferences and applies them as defaults
**And** I can still override preferences per-quiz if the quiz UI allows it

**Given** I have not configured any preferences
**When** I start a quiz
**Then** defaults are used: 1x timer, feedback off, shuffle off

**Technical Details:**

Files to modify:
- `src/app/pages/Settings.tsx` (add Quiz Preferences section)

Files to create (if needed):
- `src/app/components/settings/QuizPreferencesForm.tsx`

Preferences storage key: `levelup-quiz-preferences`

```typescript
interface QuizPreferences {
  timerMultiplier: 1 | 1.5 | 2
  showImmediateFeedback: boolean
  shuffleQuestions: boolean
}

const DEFAULT_QUIZ_PREFERENCES: QuizPreferences = {
  timerMultiplier: 1,
  showImmediateFeedback: false,
  shuffleQuestions: false,
}
```

**Testing Requirements:**

E2E tests:
- Navigate to Settings → see Quiz Preferences section
- Change timer multiplier → verify persisted to localStorage
- Start quiz → verify preferences applied as defaults

**Dependencies:**
- Story 15.2 (timer accommodation system)
- All quiz stories (preferences consumed by quiz components)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- Settings section layout and grouping
- Form control labeling and accessibility
- Toast confirmation UX

---

### Story 18.10: Export Quiz Results

As a learner,
I want to export my quiz attempt history,
So that I can review my performance offline or share it with instructors.

**FRs Fulfilled: QFR47**

**Acceptance Criteria:**

**Given** I am viewing quiz analytics in the Reports section
**When** I click "Export Results"
**Then** I can choose between CSV and PDF format

**Given** I export as CSV
**When** the export completes
**Then** a CSV file downloads containing:
  - Quiz name, date, time spent, score (%), pass/fail status
  - Per-question breakdown (question text, selected answer, correct answer, result)

**Given** I export as PDF
**When** the export completes
**Then** a formatted PDF downloads with the same data as CSV
**And** it includes summary statistics (average score, total attempts, best score)

**Given** I have no quiz attempts
**When** I try to export
**Then** the export button is disabled with tooltip: "Complete a quiz to enable export"

**Technical Details:**

Files to modify:
- `src/app/components/reports/QuizAnalyticsDashboard.tsx` (add export button)

Files to create (if needed):
- `src/lib/quizExport.ts` (CSV/PDF generation logic)

Use browser-native CSV generation (no library needed). For PDF, use existing project PDF solution or `jsPDF` if needed.

**Testing Requirements:**

Unit tests:
- CSV generation produces valid format with correct columns
- PDF generation includes all required fields
- Empty attempts → disabled export button

E2E tests:
- Navigate to Reports → Quiz Analytics → click Export → verify file download

**Dependencies:**
- Story 16.2 (needs quiz attempt history data)

**Complexity:** Medium (3-4 hours)

**Design Review Focus:**
- Export button placement and styling
- Format selection UX (dropdown vs modal)
- Disabled state with tooltip

---

### Story 18.11: Track Quiz Progress in Content Completion

As a learner,
I want quiz completion to mark the associated lesson as complete,
So that my content progress accurately reflects quiz-based learning activities.

**FRs Fulfilled: QFR60**

**Acceptance Criteria:**

**Given** I complete a quiz with a passing score
**When** the quiz results are saved
**Then** `useContentProgressStore.setItemStatus(lessonId, 'completed')` is called
**And** the associated lesson shows as completed in the course progress UI

**Given** I complete a quiz but do NOT achieve a passing score
**When** the quiz results are saved
**Then** the lesson is NOT marked as complete
**And** the lesson progress remains unchanged

**Given** I retake a quiz and achieve a passing score
**When** the quiz results are saved
**Then** the lesson is marked as complete (if not already)

**Given** the content progress update fails
**When** the quiz submission completes
**Then** the quiz result is still saved successfully (progress failure is non-blocking)
**And** the error is logged

**Technical Details:**

Files to modify:
- `src/stores/useQuizStore.ts` (add content progress integration in submitQuiz)

Integration in submitQuiz (after scoring):
```typescript
// Mark lesson complete if passing score achieved (QFR60)
if (attempt.passed && quiz.lessonId) {
  try {
    useContentProgressStore.getState().setItemStatus(quiz.lessonId, 'completed')
  } catch (progressError) {
    console.error('Content progress update failed (non-blocking):', progressError)
  }
}
```

**Testing Requirements:**

Unit tests:
- Pass quiz → setItemStatus called with 'completed'
- Fail quiz → setItemStatus NOT called
- Progress update failure → quiz result still saved

E2E tests:
- Complete quiz with passing score → lesson shows as completed in course view

**Dependencies:**
- Story 18.5 (quiz submission flow)
- Epic 1 content progress store (needs useContentProgressStore)

**Complexity:** Small (2-3 hours)

**Design Review Focus:**
- N/A (integration logic only)

---

## Epic 23: YouTube Course Builder

Users can paste YouTube video URLs or playlist URLs to create structured courses with AI-powered chapter organization, transcript extraction for notes and search, synchronized transcript panel during playback, and full feature parity with local courses — turning YouTube's "Watch Later" graveyard into a managed learning library.

**FRs covered:** FR112, FR113, FR114, FR115, FR116, FR117, FR118, FR119, FR120, FR121, FR122, FR123
**NFRs addressed:** NFR69, NFR70, NFR71, NFR72, NFR73, NFR74
**UX-DRs addressed:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR5, UX-DR6
**Phase:** MVP (Feature 12 — promoted from Vision 2026-03-25)
**Depends on:** Epic 1 (course data model), Epic 2 (player infrastructure), Epic 9 (AI infrastructure — for Premium features only)

### Story 23.1: Dexie v24 Schema Migration & YouTube Types

As a developer,
I want the database schema extended with YouTube-specific tables and a source discriminator on shared tables,
So that YouTube courses can be stored alongside local courses with full feature parity and zero changes to existing code paths.

**Acceptance Criteria:**

**Given** the application is running on Dexie schema v23
**When** the app initializes for the first time after the upgrade
**Then** Dexie automatically migrates to v24
**And** all existing courses in `importedCourses` gain `source: 'local'` via the `upgrade()` callback
**And** no existing course data is lost or modified (titles, progress, notes, tags all intact)

**Given** schema v24 is active
**When** inspecting the IndexedDB via DevTools
**Then** three new tables exist: `youtubeVideoCache` (PK: `videoId`, index: `expiresAt`), `youtubeTranscripts` (compound PK: `[courseId+videoId]`, indexes: `courseId`, `videoId`), `youtubeChapters` (PK: `id`, indexes: `courseId`, `order`)
**And** `importedCourses` has a new index on `source`
**And** `importedVideos` has a new index on `youtubeVideoId`

**Given** the TypeScript types in `src/data/types.ts`
**When** a developer creates an `ImportedCourse` with `source: 'youtube'`
**Then** the optional YouTube fields (`youtubePlaylistId`, `youtubeChannelId`, `youtubeChannelName`, `lastRefreshedAt`) are available
**And** `source` is typed as `'local' | 'youtube'`

**Given** the TypeScript types in `src/data/types.ts`
**When** a developer creates an `ImportedVideo` with YouTube fields
**Then** the optional fields (`youtubeVideoId`, `youtubeUrl`, `thumbnailUrl`, `description`, `chapters`) are available
**And** existing code that reads `ImportedVideo` without YouTube fields continues to compile

**Given** the new YouTube-specific types
**When** a developer imports `YouTubeVideoCache`, `YouTubeTranscriptRecord`, or `YouTubeCourseChapter`
**Then** each type includes all fields defined in the architecture document
**And** `CourseSource` type is exported from `src/data/types.ts`

**Technical Notes:**
- Architecture reference: YouTube Dexie Schema (v24) section
- Must redeclare all 27 existing v23 table store definitions in v24 declaration
- `source` field is optional on `ImportedCourse` — `undefined` treated as `'local'` for backward compatibility
- Key files: `src/db/schema.ts`, `src/data/types.ts`

---

### Story 23.2: YouTube URL Parser & Configuration Settings

As a learner,
I want to configure my YouTube API key and server endpoints in Settings,
So that I can use the YouTube Course Builder with my own credentials and infrastructure.

**Acceptance Criteria:**

**Given** a user is on the Settings page
**When** they navigate to a "YouTube" configuration section
**Then** they see fields for: YouTube Data API v3 key, yt-dlp server URL (optional), Whisper endpoint URL (optional), and metadata cache TTL (default 7 days)
**And** the API key field uses the same encrypted storage pattern as AI API keys (Web Crypto AES-GCM via `src/lib/crypto.ts`)

**Given** a user enters a YouTube API key
**When** they save the configuration
**Then** the key is encrypted and stored in IndexedDB (never plaintext)
**And** the key is never visible in source code, build output, or client-accessible storage (NFR72)

**Given** a user enters a yt-dlp or Whisper server URL
**When** they save the configuration
**Then** the URL is validated against `isAllowedProxyUrl()` (SSRF protection)
**And** loopback and metadata addresses are blocked
**And** private LAN ranges (192.168.x, 10.x, 172.16-31.x) are allowed for home servers

**Given** the `youtubeUrlParser` module
**When** a user pastes `https://youtube.com/watch?v=abc123`
**Then** it is detected as a single video URL with videoId `abc123`

**Given** the `youtubeUrlParser` module
**When** a user pastes `https://youtube.com/playlist?list=PLxyz`
**Then** it is detected as a playlist URL with playlistId `PLxyz`

**Given** the `youtubeUrlParser` module
**When** a user pastes `https://youtu.be/abc123`
**Then** it is detected as a single video URL with videoId `abc123`

**Given** the `youtubeUrlParser` module
**When** a user pastes `https://youtube.com/watch?v=abc123&list=PLxyz`
**Then** it is detected as a video URL within a playlist, returning both videoId and playlistId

**Given** the `youtubeUrlParser` module
**When** a user pastes an invalid URL (e.g., `https://example.com`)
**Then** it returns an invalid result with no videoId or playlistId

**Given** the `youtubeUrlParser` module
**When** a user pastes multiple URLs (one per line), some valid and some invalid
**Then** it returns an array of parsed results, each marked as valid or invalid

**Technical Notes:**
- Architecture reference: YouTube Data API v3 Integration, YouTube Security sections
- Follows `src/lib/aiConfiguration.ts` pattern for encrypted key management
- Extract `isAllowedProxyUrl()` from existing `isAllowedOllamaUrl()` in `vite.config.ts` into shared `src/lib/ssrfProtection.ts`
- Key files: `src/lib/youtubeUrlParser.ts`, `src/lib/youtubeConfiguration.ts`, `src/lib/ssrfProtection.ts`

---

### Story 23.3: YouTube Data API v3 Client with Rate Limiting

As a learner,
I want the app to fetch video metadata and playlist contents from YouTube efficiently,
So that I can preview videos before creating a course without hitting API quota limits.

**Acceptance Criteria:**

**Given** a valid YouTube API key is configured
**When** requesting metadata for a single video ID
**Then** the client returns title, duration, thumbnail URL, description, chapter markers, channel ID, channel name, and published date
**And** the response is cached in `youtubeVideoCache` with the configured TTL (default 7 days)

**Given** a valid YouTube API key is configured
**When** requesting metadata for multiple video IDs (e.g., 25 videos)
**Then** the client batches requests into groups of up to 50 video IDs per API call (1 quota unit per batch)
**And** the total response completes within 3 seconds per video (NFR70)

**Given** a valid YouTube API key is configured
**When** requesting a playlist's contents
**Then** the client paginates through all pages (50 items per page, 1 quota unit per page)
**And** videos are returned in playlist order
**And** the total response completes within 5 seconds for playlists of up to 200 videos (NFR70)

**Given** the rate limiter is active
**When** multiple API calls are made in rapid succession
**Then** the client-side token bucket limits requests to 3 per second
**And** excess requests queue and execute when tokens become available
**And** 429 responses trigger exponential backoff

**Given** the quota tracker
**When** API calls are made throughout the day
**Then** daily quota usage is tracked in localStorage with midnight PT reset
**And** a warning is surfaced when usage exceeds 400 of the 500-unit daily target (NFR69)

**Given** the API quota is exhausted or the API key is invalid
**When** a metadata request is made
**Then** the client falls back to YouTube oEmbed (`youtube.com/oembed?url=...`) for basic metadata (title, author, thumbnail)
**And** a toast notification warns: "YouTube API quota exceeded — showing limited metadata"

**Given** video metadata was previously cached
**When** requesting the same video within the TTL period
**Then** the cached data is returned without making an API call

**Given** video metadata was previously cached
**When** the TTL has expired
**Then** the client fetches fresh metadata from the API
**And** updates the cache with the new data

**Technical Notes:**
- Architecture reference: YouTube Data API v3 Integration, daily quota budget table
- Key files: `src/lib/youtubeApi.ts`, `src/lib/youtubeRateLimiter.ts`, `src/lib/youtubeQuotaTracker.ts`
- YouTube API calls go direct from browser (CORS supported) — not proxied through Vite middleware

---

### Story 23.4: Transcript Pipeline — Tier 1 (youtube-transcript)

As a learner,
I want transcripts automatically extracted from YouTube videos,
So that I can search within video content, read along during playback, and use transcripts for AI features.

**Acceptance Criteria:**

**Given** a YouTube video with available captions (auto-generated or manual)
**When** the transcript pipeline is invoked for that video
**Then** the transcript is fetched via `youtube-transcript` npm library through a Vite middleware endpoint (`POST /api/youtube/transcript`)
**And** the transcript is returned as an array of `TranscriptCue` objects (reusing existing type from `src/data/types.ts:24-28`)
**And** extraction completes within 2 seconds per video (NFR71)

**Given** a successfully fetched transcript
**When** it is processed for storage
**Then** the cues are stored in `youtubeTranscripts` table with `courseId`, `videoId`, `cues`, `fullText` (concatenated for search), `source: 'youtube-transcript'`, `language`, and `fetchedAt`
**And** the `fullText` field is indexed for full-text search

**Given** a YouTube video without available captions
**When** the Tier 1 transcript pipeline is invoked
**Then** the pipeline returns a failure result with reason `'no-captions-available'`
**And** the video is marked with `status: 'failed'` in the transcript store (not silently ignored)

**Given** the Vite dev server is running
**When** a `POST /api/youtube/transcript` request is made with a valid video ID
**Then** the middleware uses `youtube-transcript` npm to fetch the transcript server-side (avoiding CORS issues)
**And** the middleware follows the established `ollamaDevProxy()` pattern in `vite.config.ts`

**Given** a network error or YouTube API issue during transcript fetch
**When** the pipeline encounters the error
**Then** it returns a `Result<T>` failure with error code and message
**And** a user-visible message is displayed within 3 seconds (NFR71)

**Given** multiple videos in a newly created course
**When** the user confirms course creation
**Then** transcripts are batch-fetched in the background (not blocking the wizard)
**And** the `useYouTubeTranscriptStore` tracks per-video status (`pending`, `fetching`, `done`, `failed`)
**And** a progress indicator shows "Fetching transcripts... 12 of 20"

**Technical Notes:**
- Architecture reference: YouTube Transcript Pipeline, Transcript Fallback Chain
- `youtube-transcript` runs server-side in Vite middleware to bypass CORS restrictions
- Tier 2 (yt-dlp) and Tier 3 (Whisper) are handled in Story 23.11
- Key files: `vite.config.ts` (middleware), `src/lib/youtubeTranscriptPipeline.ts`, `src/stores/useYouTubeTranscriptStore.ts`

---

### Story 23.5: Import Wizard — Steps 1 & 2 (URL Input + Metadata Preview)

As a learner,
I want to paste YouTube URLs and preview the detected videos before creating a course,
So that I can verify the content is correct and remove unwanted videos before proceeding.

**Acceptance Criteria:**

**Given** the user is on the Courses page
**When** they click the "Add Course" button
**Then** a dropdown menu appears with two options: "Import from Folder" (existing) and "Build from YouTube"
**And** "Import from Folder" opens the existing `ImportWizardDialog`
**And** "Build from YouTube" opens a new `YouTubeImportDialog`

**Given** the Courses page shows the empty state
**When** there are no imported courses
**Then** both import options are shown as separate action buttons below the empty state illustration

**Given** the `YouTubeImportDialog` is open on Step 1
**When** the user pastes a valid playlist URL
**Then** the URL is parsed and validated within 500ms (debounced)
**And** feedback text shows "Playlist detected — N videos" in success color
**And** the "Next" button becomes enabled

**Given** the user pastes a video URL that includes a `&list=` parameter
**When** the URL is detected
**Then** the dialog shows a choice: "This video is part of a playlist (N videos). [Import full playlist] [Import this video only]"

**Given** the user pastes multiple video URLs (one per line)
**When** some URLs are valid and some are invalid
**Then** feedback shows "N videos detected, M invalid URLs skipped" in warning color
**And** the "Next" button enables if at least 1 valid URL exists

**Given** the user pastes an invalid URL
**When** no YouTube URL pattern matches
**Then** feedback shows "Not a valid YouTube URL" in destructive color
**And** the textarea border becomes `border-destructive`
**And** the "Next" button remains disabled

**Given** the user clicks "Next" from Step 1 with valid URLs
**When** Step 2 (Preview) loads
**Then** skeleton loading placeholders appear matching the video list layout (thumbnail + text lines + duration badge)
**And** a determinate progress bar shows "Fetching video info... N of M" with percentage

**Given** metadata is loaded for all videos in Step 2
**When** the preview renders
**Then** each video row shows: thumbnail (80px, 16:9, rounded-lg), title (truncated at 2 lines), duration badge (tabular-nums), and channel name
**And** unavailable videos (private/deleted) show dimmed with strikethrough title and AlertTriangle icon
**And** a summary banner shows unavailable count if any
**And** the list is scrollable with `max-h-[50vh]` and scroll shadows

**Given** the user hovers over a video row in the preview
**When** they click the X button
**Then** the video is removed from the import list
**And** the count updates accordingly

**Given** the 4-step wizard dialog
**When** displayed
**Then** the step indicator shows: 1 Paste URLs > 2 Preview > 3 Organize > 4 Details
**And** the dialog uses `sm:max-w-3xl` width (768px)
**And** all interactive elements are keyboard accessible (WCAG 2.5.8: targets >= 24x24px)

**Technical Notes:**
- Architecture reference: YouTube Component Architecture, YouTube Store Architecture
- UX reference: UX-DR1 (4-step wizard), UX-DR5 (free/premium differentiation)
- The dialog is a separate component from `ImportWizardDialog` (architecture rationale: fundamentally different flows)
- Key files: `YouTubeImportDialog.tsx`, `YouTubeUrlInput.tsx`, `YouTubeMetadataPreview.tsx`, `useYouTubeImportStore.ts`

---

### Story 23.6: Rule-Based Video Grouping & Chapter Editor

As a learner,
I want videos automatically grouped into chapters by keyword similarity, with the ability to drag-and-drop to reorganize,
So that my YouTube course has a logical structure even without AI, and I can customize it to match my learning goals.

**Acceptance Criteria:**

**Given** the user reaches wizard Step 3 (Organize) without an AI provider configured
**When** the grouping algorithm runs
**Then** videos are clustered by keyword similarity extracted from titles and descriptions (TF-IDF + cosine similarity)
**And** original playlist order is preserved within each cluster
**And** chapters are named by top keywords from the cluster
**And** each chapter displays a badge: "[Rule-based]"

**Given** the grouping algorithm processes fewer than 3 videos
**When** clustering produces poor results (single cluster or each video in its own cluster)
**Then** all videos are placed in a single flat chapter titled "All Videos"

**Given** an informational banner is shown for rule-based grouping
**When** no AI provider is configured
**Then** a banner reads: "Videos grouped by keyword similarity from titles. Set up an AI provider in Settings for smarter organization."
**And** the banner links to the Settings page YouTube configuration section

**Given** the chapter editor is displayed (Step 3)
**When** the user views the chapter structure
**Then** chapters are shown as collapsible accordion sections with: chapter title, video count, total duration
**And** each video row within a chapter shows: drag handle, video title, duration
**And** the first chapter is expanded by default; others are collapsed

**Given** the user wants to reorder videos
**When** they drag a video within the same chapter
**Then** the video moves to the new position within that chapter

**Given** the user wants to move a video between chapters
**When** they drag a video from one chapter to another
**Then** the video is removed from the source chapter and inserted at the drop position in the target chapter

**Given** the user wants to reorder chapters
**When** they drag a chapter header
**Then** the entire chapter (with all its videos) moves to the new position

**Given** the user clicks on a chapter title
**When** the title becomes editable (inline edit)
**Then** the user can rename the chapter
**And** pressing Enter or clicking away saves the new name

**Given** the user clicks "+ Add Chapter"
**When** a new empty chapter is created
**Then** it appears at the bottom with a default name "New Chapter"
**And** the title is immediately editable

**Given** the user clicks "Remove" on a chapter
**When** the chapter has videos
**Then** a confirmation dialog asks whether to delete the chapter and move videos to an "Uncategorized" chapter, or delete the chapter and its videos from the import

**Given** the chapter editor
**When** keyboard navigation is used
**Then** all drag interactions have single-pointer alternatives (WCAG 2.5.7)
**And** chapters can be reordered via keyboard (arrow keys + Enter)
**And** videos can be moved via keyboard (context menu with "Move to chapter..." option)

**Technical Notes:**
- Architecture reference: Rule-Based Fallback, YouTube Component Architecture
- Uses `@dnd-kit/core` + `@dnd-kit/sortable` for nested chapter/video reordering
- `YouTubeChapterEditor` is a shared component — used in wizard Step 3 AND as a post-import edit dialog (FR119)
- Key files: `YouTubeChapterEditor.tsx`, `src/lib/youtubeRuleBasedGrouping.ts`

---

### Story 23.7: AI-Powered Course Structuring (Premium)

As a learner with an AI provider configured,
I want AI to analyze my YouTube videos and propose an intelligent chapter structure,
So that my course is organized by pedagogical progression rather than just keyword similarity.

**Acceptance Criteria:**

**Given** the user reaches wizard Step 3 (Organize) with an AI provider configured and consent granted
**When** the AI structuring begins
**Then** a loading state shows: "AI is analyzing video metadata and organizing your course..." with a Sparkles icon animation on `bg-brand-soft` background
**And** the loading matches the existing `ImportWizardDialog` AI analysis pattern

**Given** the AI structuring completes successfully
**When** the result is displayed
**Then** a banner shows "AI organized N videos into M chapters"
**And** each chapter displays an "AI Suggested" badge
**And** each chapter includes a rationale explaining why those videos were grouped together (visible on expand)

**Given** the AI structuring input
**When** the LLM is invoked via `getLLMClient()` factory
**Then** it receives video titles, descriptions, chapter markers, and durations
**And** it returns a `CourseStructureProposal` with chapters (title, videoIds, rationale), suggested course title, description, and tags
**And** structured output uses Zod schema validation (existing pattern)

**Given** an AI provider is configured but consent is denied for AI features
**When** Step 3 loads
**Then** the rule-based fallback (Story 23.6) is used instead
**And** no AI call is made

**Given** an AI provider is configured but the LLM call times out (30s) or errors
**When** the AI structuring fails
**Then** the system automatically falls back to rule-based grouping
**And** a toast notification warns: "AI structuring unavailable — using keyword-based grouping"
**And** the chapter badges show "[Rule-based]" instead of "[AI Suggested]"

**Given** the AI has proposed a chapter structure
**When** the user views Step 3
**Then** the same `YouTubeChapterEditor` from Story 23.6 is displayed with AI-generated chapters
**And** the user can freely modify the AI proposal (drag, rename, add/remove chapters)
**And** modifications change the chapter `source` from `'ai'` to `'manual'`

**Given** fewer than 3 videos or a single video
**When** AI structuring is attempted
**Then** the system skips AI and places all videos in a single chapter
**And** no unnecessary LLM call is made

**Technical Notes:**
- Architecture reference: YouTube AI Course Structuring section
- Uses existing `getLLMClient()` factory from `src/ai/llm/factory.ts`
- Follows BYOK philosophy — works with any provider (Ollama, OpenAI, Anthropic)
- Key files: `src/ai/youtube/courseStructurer.ts`

---

### Story 23.8: Import Wizard Step 4 — Course Details & Save

As a learner,
I want to finalize my YouTube course with a name, description, tags, and thumbnail before saving,
So that the course appears in my library with proper metadata and is immediately available for study.

**Acceptance Criteria:**

**Given** the user reaches wizard Step 4 (Details)
**When** the form renders
**Then** it pre-fills: course name (from playlist title or AI suggestion), description (from playlist description or AI suggestion), tags (from AI suggestion or empty), and thumbnail (from first video or user-selectable)
**And** all fields are editable

**Given** the user modifies the course name
**When** they clear the name field
**Then** the "Create Course" button is disabled
**And** inline validation shows "Course name is required" (within 200ms per NFR25)

**Given** the user clicks "Create Course"
**When** the save flow executes
**Then** a new `ImportedCourse` record is created in `importedCourses` with `source: 'youtube'`, the YouTube-specific fields (`youtubePlaylistId`, `youtubeChannelId`, `youtubeChannelName`, `lastRefreshedAt`), and user-provided metadata
**And** `ImportedVideo` records are created for each video with YouTube-specific fields (`youtubeVideoId`, `youtubeUrl`, `thumbnailUrl`, `description`, `chapters`)
**And** `YouTubeCourseChapter` records are created in `youtubeChapters` with the finalized chapter structure
**And** video metadata is written to `youtubeVideoCache` with the configured TTL

**Given** the course is saved successfully
**When** the dialog closes
**Then** the new course appears in the course library alongside local courses
**And** a success toast shows: "Course created — N videos ready to study"
**And** the `useYouTubeImportStore` resets to initial state
**And** background transcript fetching begins (Story 23.4) without blocking the UI

**Given** the course is saved
**When** viewing the course library
**Then** YouTube courses are visually distinguishable with a small YouTube icon badge on the course card
**And** YouTube courses can be filtered, sorted, and managed identically to local courses
**And** all existing course operations (categorize, tag, search, momentum sort) work for YouTube courses (FR120)

**Given** a save operation fails (e.g., IndexedDB write error)
**When** the error occurs
**Then** a toast notification displays the error with a retry option
**And** the wizard stays open with the user's data intact (no data loss)

**Technical Notes:**
- Architecture reference: useYouTubeImportStore `saveCourse()` action, YouTube Store Architecture
- After `saveCourse()`, data is in shared tables — `useCourseImportStore.loadImportedCourses()` picks it up
- Key files: `YouTubeCourseDetailsForm.tsx`, `useYouTubeImportStore.ts`

---

### Story 23.9: YouTube IFrame Player & Progress Tracking

As a learner,
I want to watch YouTube videos within Knowlune with the same progress tracking as local videos,
So that my study streaks, session logging, and completion tracking work seamlessly for YouTube courses.

**Acceptance Criteria:**

**Given** a YouTube course exists in the library
**When** the user navigates to a YouTube lesson
**Then** the `YouTubeLessonPlayer` page loads at route `youtube-courses/:courseId/lessons/:lessonId`
**And** the YouTube video plays via an embedded `react-youtube` IFrame player
**And** the player UI matches the local video player layout (video left/top, notes right/bottom)

**Given** the YouTube player is active
**When** the video is playing
**Then** the player polls `getCurrentTime()` every 1 second
**And** the current position is stored in the `progress` table (same table as local videos) using the compound key `[courseId+videoId]`
**And** the user can resume from the last position on their next visit (FR120 parity with FR10)

**Given** the user watches more than 90% of a video's duration
**When** they navigate away or the video ends
**Then** the video is automatically marked as "Completed" in the `progress` table
**And** the course completion percentage updates accordingly

**Given** the user marks a YouTube video as complete manually
**When** they click the completion toggle
**Then** the progress state updates identically to local videos (Not Started / In Progress / Completed)
**And** study session logging captures the duration and content covered (FR16 parity)

**Given** the COEP header conflict
**When** the YouTube IFrame and WebLLM SharedArrayBuffer coexist
**Then** the `Cross-Origin-Embedder-Policy` is set to `credentialless` (not `require-corp`)
**And** YouTube IFrame embeds render correctly
**And** WebLLM model loading still works with SharedArrayBuffer support

**Given** CSP headers need updating
**When** YouTube content is embedded
**Then** `frame-src` includes `https://www.youtube.com` and `https://www.youtube-nocookie.com`
**And** `img-src` includes `https://i.ytimg.com` and `https://img.youtube.com`
**And** `connect-src` includes `https://www.googleapis.com/youtube/`

**Given** the user is offline
**When** they navigate to a YouTube lesson
**Then** a placeholder appears: "Connect to the internet to watch" with a WifiOff icon
**And** the notes panel, progress indicators, and transcript (if cached) remain accessible

**Given** the YouTube course detail page
**When** the user views the course at route `youtube-courses/:courseId`
**Then** the page shows the chapter structure with expandable sections, per-video progress indicators, and overall course completion percentage
**And** the layout matches the existing course detail page pattern

**Technical Notes:**
- Architecture reference: YouTube IFrame Player section, COEP/YouTube IFrame Conflict resolution
- Progress polling at 1s matches `ImportedLessonPlayer` interval
- COEP change from `require-corp` to `credentialless` in `vite.config.ts:370`
- Key files: `YouTubePlayer.tsx`, `YouTubeLessonPlayer.tsx`, `YouTubeCourseDetail.tsx`, `vite.config.ts`

---

### Story 23.10: Transcript Panel with Search & Click-to-Seek

As a learner,
I want to see synchronized transcripts alongside YouTube videos, search within them, and click to jump to specific moments,
So that I can study video content more efficiently and find specific information without rewatching.

**Acceptance Criteria:**

**Given** a YouTube video with a successfully fetched transcript
**When** the lesson player page renders
**Then** the `TranscriptPanel` (existing shared component) displays the transcript cues alongside the video
**And** the currently active cue is highlighted based on the player's current time
**And** the panel auto-scrolls to keep the active cue visible

**Given** the transcript panel is visible during playback
**When** the user clicks on any transcript segment
**Then** the YouTube player seeks to that segment's timestamp
**And** playback continues from the new position

**Given** the transcript panel has a search input
**When** the user types a search query
**Then** matching segments are highlighted in the transcript
**And** results appear within 100ms (NFR21 parity)
**And** the search filters/highlights matching cues while preserving the full transcript context

**Given** a video's transcript was fetched and stored
**When** the user searches across all notes and transcripts (global search)
**Then** YouTube transcript `fullText` matches appear in search results
**And** each result links to the specific video at the matching timestamp

**Given** a YouTube video without a transcript (fetch failed or no captions)
**When** the lesson player renders
**Then** the transcript panel shows an empty state: "No transcript available for this video"
**And** if Whisper is not configured: "Set up a Whisper endpoint in Settings to transcribe videos without captions"

**Given** transcripts are being fetched in the background for a newly created course
**When** the user opens a video whose transcript is still pending
**Then** the transcript panel shows a loading skeleton with "Fetching transcript..."
**And** once the transcript is ready, it appears without requiring a page refresh (reactive via `useYouTubeTranscriptStore`)

**Given** the transcript panel
**When** navigated via keyboard
**Then** transcript segments are focusable via Tab
**And** pressing Enter on a focused segment seeks the video to that timestamp
**And** all interactions meet WCAG 2.2 AA requirements

**Technical Notes:**
- Architecture reference: YouTube Transcript Pipeline (storage format), Existing Infrastructure Reused
- The existing `TranscriptPanel` component already supports `TranscriptCue` format — YouTube cues match directly
- `parseVTT()` function can parse yt-dlp VTT output if needed
- Key files: `TranscriptPanel.tsx` (extend), `useYouTubeTranscriptStore.ts`

---

### Story 23.11: Transcript Fallback — Tier 2 (yt-dlp) & Tier 3 (Whisper)

As a learner with a home server,
I want transcripts for videos that don't have YouTube captions,
So that I can search and study all my YouTube course content, not just the ~90% with auto-generated captions.

**Acceptance Criteria:**

**Given** the Tier 1 transcript fetch (youtube-transcript) fails with `no-captions-available`
**When** the user has a yt-dlp server URL configured in Settings
**Then** the pipeline automatically falls back to Tier 2: `POST /api/youtube/ytdlp/subtitles` to the user's server
**And** the Vite middleware proxies the request to the configured server URL
**And** SSRF validation runs via `isAllowedProxyUrl()` before proxying

**Given** yt-dlp successfully extracts subtitles (VTT format)
**When** the subtitles are returned
**Then** the VTT is parsed using the existing `parseVTT()` function
**And** cues are stored in `youtubeTranscripts` with `source: 'ytdlp'`

**Given** Tier 1 and Tier 2 both fail
**When** the user has a Whisper endpoint URL configured in Settings
**Then** the pipeline falls back to Tier 3: `POST /api/youtube/whisper/transcribe`
**And** the request is proxied to the user's faster-whisper Docker container
**And** processing runs asynchronously with a progress indicator
**And** transcription completes within 60 seconds per video (FR118)

**Given** Whisper transcription completes
**When** the result is returned
**Then** cues are stored in `youtubeTranscripts` with `source: 'whisper'`
**And** the transcript panel updates reactively without requiring page refresh

**Given** all three tiers fail
**When** no transcript can be obtained
**Then** the video is marked with `status: 'unavailable'` and `reason` string
**And** the transcript panel shows "No transcript available" (handled in Story 23.10)

**Given** the yt-dlp server is also used for enriched metadata
**When** `POST /api/youtube/ytdlp/metadata` is called
**Then** additional metadata (chapter markers, cleaned descriptions) is returned from the user's server
**And** the response enhances existing YouTube API data

**Given** a Vite middleware proxy request
**When** the target URL fails SSRF validation
**Then** the request is rejected with a 403 error
**And** no network request is made to the target

**Given** the user does NOT have yt-dlp or Whisper configured
**When** Tier 1 fails
**Then** the fallback chain terminates gracefully
**And** no error is thrown for unconfigured tiers (they are optional)

**Technical Notes:**
- Architecture reference: Transcript Fallback Chain, SSRF Protection, YouTube Server-Side Architecture
- Tier 2 and Tier 3 are Premium features — require user-provided infrastructure
- Vite middleware follows established `ollamaDevProxy()` pattern
- SSRF protection shared between Ollama and YouTube endpoints via `src/lib/ssrfProtection.ts`
- Key files: `src/lib/youtubeTranscriptPipeline.ts`, `src/lib/ssrfProtection.ts`, `vite.config.ts`

---

### Story 23.12: Offline Support, Metadata Refresh & Security Hardening

As a learner,
I want my YouTube course data available offline and my metadata kept fresh per YouTube's terms,
So that I can study notes and transcripts without internet and remain compliant with YouTube API Terms of Service.

**Acceptance Criteria:**

**Given** the user has previously imported a YouTube course
**When** the device is offline
**Then** the course detail page shows full chapter structure with progress bars
**And** cached transcript text is available for reading and searching
**And** notes, progress, bookmarks, streaks, and flashcards work normally
**And** the video player area shows "Connect to the internet to watch" with WifiOff icon (UX-DR6)
**And** the "Refresh metadata" button is disabled with tooltip "Requires internet connection"

**Given** a YouTube course's `lastRefreshedAt` is older than 30 days
**When** the app starts with internet connectivity
**Then** the metadata refresh service queues a background refresh (non-blocking)
**And** the refresh is rate-limited and does not interfere with user activity
**And** refreshed metadata updates in `youtubeVideoCache` and `importedVideos` (title, duration, thumbnail changes)

**Given** the 30-day refresh runs
**When** a video has been removed from YouTube (deleted/private)
**Then** the video is marked with a "removed from YouTube" badge in the course view
**And** the user's progress, notes, and transcript for that video are preserved (not deleted)

**Given** the app has YouTube features enabled
**When** CSP headers are evaluated
**Then** `frame-src` allows `https://www.youtube.com` and `https://www.youtube-nocookie.com`
**And** `img-src` allows `https://i.ytimg.com` and `https://img.youtube.com`
**And** `connect-src` allows `https://www.googleapis.com/youtube/`
**And** no other YouTube-related domains are permitted

**Given** a user has AI configured (Premium)
**When** they create a YouTube course
**Then** AI-powered course and per-video summaries can be generated from transcript data (FR123)
**And** summaries follow the same pattern as local video summaries (FR48) — displayed in collapsible panels alongside the video
**And** the AI summary uses only transcript text as input (NFR54 — no user metadata transmitted)

**Given** all YouTube data
**When** evaluating data locality (NFR74)
**Then** YouTube course data (metadata, transcripts, structure, user edits) is stored entirely in IndexedDB
**And** no YouTube content is transmitted to any server other than: YouTube API (Google), user's configured AI provider (for structuring/summaries), and user's configured Whisper endpoint (for transcription)

**Technical Notes:**
- Architecture reference: YouTube Offline-First Design, 30-Day Metadata Refresh, YouTube Security, CSP Updates
- `refreshStaleMetadata()` runs on app startup, queries courses where `lastRefreshedAt < 30 days ago`
- FR123 (AI summaries) extends FR48 pattern to YouTube transcript data — reuses existing AI summary UI
- Key files: `src/lib/youtubeMetadataRefresh.ts`, `vite.config.ts` (CSP headers)

---
