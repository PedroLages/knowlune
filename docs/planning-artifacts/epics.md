---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - '/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/docs/planning-artifacts/prd.md'
  - '/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/docs/planning-artifacts/architecture.md'
  - '/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/docs/planning-artifacts/ux-design-specification.md'
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
- FR13: User can access content viewing interface optimized for minimal distractions
- FR79: User can skip forward/backward 10 seconds using visible UI buttons and keyboard shortcuts (J/L keys)
- FR80: User can activate Picture-in-Picture mode to watch video while taking notes or browsing
- FR81: User can view a keyboard shortcuts help overlay within the video player by pressing ?
- FR82: User can see chapter markers on the video progress bar for content navigation
- FR83: User can view a synchronized, scrollable transcript panel alongside the video with click-to-seek
- FR84: User can continue watching via a floating mini-player when scrolling past the main video
- FR85: User can toggle theater mode for a wider, distraction-free viewing experience
- FR86: Lesson Player page has a single content scrollbar with thin, themed styling (no double scrollbar)

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
- FR76: User can insert current video timestamp into note via keyboard shortcut (Alt+T in editor). *(Derived from FR24.)*
- FR77: Note editor displays in side-by-side layout with video player on desktop, stacked on mobile. *(Derived from UX Design Specification.)*

**Motivation & Gamification (8 Requirements):**

- FR28: User can view daily study streak counter
- FR29: User can view visual calendar showing study history
- FR30: User can configure reminders to maintain study streak
- FR31: User can pause study streak without losing history
- FR32: User can create learning challenges with specific goals
- FR33: User can track progress against active learning challenges
- FR34: User can create completion-based, time-based, or streak-based challenge types
- FR35: System can provide visual feedback when challenge milestones are achieved

**Learning Intelligence (7 Requirements):**

- FR36: User can view momentum score for each course displayed as hot/warm/cold indicator
- FR37: User can sort course list by momentum score
- FR38: System can calculate course momentum based on study recency, completion percentage, and study frequency
- FR39: User can receive course recommendations based on current study patterns
- FR40: User can receive suggestions for next course to study
- FR41: System can identify courses at risk of abandonment
- FR42: User can receive adaptive study scheduling suggestions

**Analytics & Reporting (6 Requirements):**

- FR43: User can view study time analytics broken down by daily, weekly, and monthly periods
- FR44: User can track course completion rates over time
- FR45: User can view and manage bookmarked lessons on a dedicated Bookmarks page *(reassigned from velocity metrics during epic decomposition; see FR78)*
- FR46: User can see retention insights comparing completed versus abandoned courses
- FR47: User can receive personalized insights and recommendations based on study patterns
- FR78: User can view learning velocity metrics — completion rate over time (videos completed per week), content consumed per hour, and progress acceleration/deceleration trends. *(Preserves original FR45 velocity intent after FR45 was reassigned to bookmarks. Implemented in Epic 7 Story 7.3.)*

**AI-Powered Assistance (6 Requirements):**

- FR48: User can request AI-generated summaries of video content
- FR49: User can ask questions and receive answers based on their own notes
- FR50: User can receive AI-suggested optimal learning paths
- FR51: System can identify knowledge gaps and suggest reinforcement activities
- FR52: User can receive AI assistance with note organization and enhancement
- FR53: System can suggest connections between concepts across different courses

### Non-Functional Requirements

**Performance (NFR1-NFR7):**

- NFR1: Initial app load completes in less than 2 seconds (cold start)
- NFR2: Route navigation completes in less than 200ms (instant feel)
- NFR3: Video playback starts instantly with no buffering for local files
- NFR4: IndexedDB queries complete in less than 100ms (note search, progress loading)
- NFR5: Note autosave completes in less than 50ms (invisible to user)
- NFR6: Initial bundle size does not exceed 500KB (gzipped)
- NFR7: Memory footprint remains stable during extended use (no memory leaks)

**Reliability (NFR8-NFR16):**

- NFR8: Zero data loss for notes, progress, or course metadata under normal operation
- NFR9: All user data persists in IndexedDB with automatic save (no manual save required)
- NFR10: System recovers gracefully from IndexedDB write failures with error notification
- NFR11: File system errors (moved/renamed courses) display clear user messages with recovery options
- NFR12: AI API failures degrade gracefully without blocking core functionality
- NFR13: Invalid file formats are detected and reported with helpful error messages
- NFR14: Notes are autosaved every 3 seconds during editing with conflict resolution
- NFR15: Progress tracking data is atomic (completion state changes are all-or-nothing)
- NFR16: Course metadata is validated on import with clear feedback on issues

**Usability (NFR17-NFR25):**

- NFR17: No barriers to opening app and starting study session (zero-click resume)
- NFR18: Core workflows (import course, watch video, take notes) require no documentation
- NFR19: User can complete primary tasks (mark complete, add note, create challenge) in under 3 clicks
- NFR20: Video resume functionality loads user to exact last position within 1 second
- NFR21: Search results appear as user types with no perceptible delay (< 100ms)
- NFR22: Navigation between courses, videos, and notes is instant (no loading states)
- NFR23: Destructive actions (delete course, clear progress) require confirmation
- NFR24: System prevents accidental data loss through autosave and undo capabilities
- NFR25: Form validation provides immediate inline feedback on invalid input

**Integration (NFR26-NFR35):**

- NFR26: AI API requests timeout after 30 seconds with fallback error handling
- NFR27: AI API keys are stored securely in environment variables (not in code)
- NFR28: System supports multiple AI providers (OpenAI, Anthropic) with configurable selection
- NFR29: AI features degrade gracefully when API is unavailable (core features remain functional)
- NFR30: Web File System Access API handles folder selection with clear permission prompts
- NFR31: System detects and handles file system changes (moved/renamed files) without crashing
- NFR32: Course import supports video formats (MP4, MKV, AVI, WEBM) and PDF files
- NFR33: File reading operations handle large files (2GB+ videos) without memory issues
- NFR34: Data export functionality supports standard formats (JSON, Markdown) for migration
- NFR35: Note storage structure allows future integration with external tools (Notion, Obsidian)

**Accessibility (NFR36-NFR49):**

- NFR36: All text maintains minimum 4.5:1 contrast ratio (3:1 for large text >=18pt)
- NFR37: All interactive elements are keyboard accessible (tab navigation, keyboard shortcuts)
- NFR38: Focus indicators are visible on all interactive elements (2px outline minimum)
- NFR39: ARIA labels are present on all icon-only buttons and complex widgets
- NFR40: Semantic HTML is used throughout (nav, main, button vs div elements)
- NFR41: Video player supports keyboard controls (Space = play/pause, Arrow keys = seek +/-5s)
- NFR42: Note editor supports Markdown shortcuts and keyboard-only editing
- NFR43: All dashboard widgets and navigation are fully keyboard accessible
- NFR44: All images and icons have meaningful alt text or ARIA labels
- NFR45: ARIA landmarks are present for major page regions (navigation, main, complementary)
- NFR46: Dynamic content updates are announced to screen readers via ARIA live regions
- NFR47: Lighthouse accessibility audits score 100 (or identify and document exceptions)
- NFR48: Manual keyboard navigation testing confirms all workflows are keyboard-accessible
- NFR49: Screen reader testing (VoiceOver/NVDA) validates meaningful navigation

**Security (NFR50-NFR56):**

- NFR50: User-generated Markdown content is sanitized to prevent XSS attacks
- NFR51: Content Security Policy headers prevent script injection
- NFR52: AI API keys are never exposed in client-side code or logs
- NFR53: All data remains local (no data transmitted to remote servers except AI API calls)
- NFR54: AI API calls include only necessary data (no personal identifiable information)
- NFR55: Course content and notes never leave user's device (except explicit AI queries)
- NFR56: No authentication required (personal single-user tool on local device)

### Additional Requirements

**From Architecture Document:**

- Brownfield project: existing React + Vite wireframe foundation to evolve, not greenfield setup
- State Management: Zustand v5.0.11 with selector-based subscriptions and slice pattern for domain stores
- Data Persistence: Dexie.js v4.3.0 as IndexedDB abstraction with liveQuery(), schema migrations, compound indexes, and bulk operations
- Video Player: react-player v3.4.0 with custom controls overlay (playback speed 0.5x-2x, WebVTT captions with toggle/language/font-size, keyboard shortcuts, auto-mark complete at 95%)
- PDF Viewer: react-pdf v10.3.0 with progressive page loading, text selection, zoom controls, and bookmark persistence
- Note Editor: @uiw/react-md-editor + react-markdown + rehype-sanitize (XSS prevention mandatory) with custom timestamp link format `[MM:SS](video://id#t=seconds)`
- Tag Management: Explicit tag management UI (not automatic hashtag extraction from markdown content)
- Search Engine: MiniSearch for full-text search with fuzzy matching, prefix search, field boosting (tags 2x, courseName 1.5x), 150ms debounce, sub-1ms execution
- AI Integration: Vercel AI SDK v2.0.31 with @ai-sdk/openai provider; streaming responses; 30-second timeout with AbortController; RAG pattern using MiniSearch for Q&A context retrieval
- Animation: Framer Motion v12.34.0 with LazyMotion (4.6 KB initial + 15 KB async); automatic prefers-reduced-motion support; hybrid CSS + Framer Motion strategy
- Testing: Vitest v4.0.18 + React Testing Library v16.3.2 + fake-indexeddb + Playwright; 80%+ coverage for stores/utilities/algorithms
- Analytics Engine: Custom TypeScript algorithms for momentum scoring (40% recency, 30% completion, 30% frequency), study time aggregation, learning velocity, recommendation algorithm
- File System: Native File System Access API with FileSystemHandle persistence in IndexedDB, permission re-request on app load, error recovery for moved/deleted files
- Bundle budget: < 500KB gzipped (~487KB estimated total)
- Centralized types in `src/data/types.ts`
- ID generation: `crypto.randomUUID()` for all IDs
- Date format: ISO 8601 strings via `new Date().toISOString()`
- Optimistic update pattern: Zustand first (UI), Dexie.js second (persistence)
- Error handling: Domain-prefixed log messages `[Domain]`, safe fallback values, user-friendly toast notifications

**From UX Design Specification:**

- Zero-decision "Continue Learning" resume flow: algorithm determines hot course, next video, exact playback position in < 1 second
- Celebration micro-moments: completed video checkmark (scale bounce, 300ms), streak counter pulse, challenge milestone confetti, progress bar fill (500ms)
- Side-by-side study layout: video player 60% + note editor 40% on desktop; stacked on mobile
- Dashboard-centric analytics layout: stats row (4 metrics), achievement + streak, recent activity, quick actions, progress chart, continue studying, course catalog
- Mobile bottom navigation bar (< 640px) with 5 main routes
- Keyboard shortcuts: Cmd+K/Ctrl+K (global search), Cmd+,/Ctrl+, (settings), ? (shortcuts dialog), Space (play/pause), Arrow keys (seek), T (timestamp), C (captions), F (fullscreen), M (mute)
- Streak visualization: flame icon scales from w-8 (1-6 days) to w-12 (30+ days), dynamic messages per tier
- Achievement milestones: 10, 25, 50, 100, 250, 500 lessons with progress bars
- Progressive disclosure: show advanced features (tags, search) after first video completion
- Error recovery: file picker for moved files, permission re-prompt for denied access, empty state CTA for no courses
- Responsive breakpoints: mobile < 640px (single column, bottom nav), tablet 640-1023px (collapsible sidebar, 2-column), desktop >= 1024px (persistent sidebar, 4-column)
- Hover interactions: scale 1.01-1.02 + elevated shadow on interactive cards, 300ms transition
- Loading states: skeleton placeholders matching final content structure
- Visual progress as primary navigation: progress maps are the main interface, not hidden in analytics
- Smart defaults: pre-populate challenge suggestions, auto-select hottest course, rank search results by relevance

### FR Coverage Map

- FR1: Epic 1 - Import course folders from local file system
- FR2: Epic 1 - View all imported courses in library
- FR3: Epic 1 - Organize courses by topic/subject
- FR4: Epic 1 - View course metadata (title, video count, PDF count)
- FR5: Epic 1 - Categorize courses as Active/Completed/Paused
- FR6: Epic 1 - Detect supported video formats and PDFs
- FR7: Epic 2 - Play video with standard playback controls
- FR8: Epic 2 - View PDF content with page navigation
- FR9: Epic 2 - Bookmark current position in video
- FR10: Epic 2 - Resume video from last viewed position
- FR11: Epic 2 - Navigate between videos within a course
- FR12: Epic 2 - View course structure (sections, videos, PDFs)
- FR13: Epic 2 - Distraction-free content viewing interface
- FR14: Epic 4 - Mark videos as Not Started/In Progress/Completed
- FR15: Epic 4 - View completion percentage per course
- FR16: Epic 4 - Auto-log study sessions (date, duration, content)
- FR17: Epic 4 - View study session history
- FR18: Epic 4 - Visual progress indicators (gray/blue/green)
- FR19: Epic 4 - Track total study time across all courses
- FR20: Epic 3 - Create notes using Markdown syntax
- FR21: Epic 3 - Link notes to specific courses and videos
- FR22: Epic 3 - Add tags to notes for organization
- FR23: Epic 3 - Search notes using full-text search
- FR24: Epic 3 - Timestamp notes to exact video positions
- FR25: Epic 3 - Navigate to video position from timestamped note
- FR26: Epic 3 - View all notes for a specific course
- FR27: Epic 3 - Auto-save notes without manual action
- FR28: Epic 5 - View daily study streak counter
- FR29: Epic 5 - View visual calendar showing study history
- FR30: Epic 5 - Configure reminders for study streak
- FR31: Epic 5 - Pause study streak without losing history
- FR32: Epic 5 - Create learning challenges with goals
- FR33: Epic 5 - Track progress against learning challenges
- FR34: Epic 5 - Create completion/time/streak-based challenges
- FR35: Epic 5 - Visual feedback on challenge milestones
- FR36: Epic 6 - View momentum score (hot/warm/cold)
- FR37: Epic 6 - Sort course list by momentum score
- FR38: Epic 6 - Calculate momentum (recency + completion + frequency)
- FR39: Epic 6 - Receive course recommendations from patterns
- FR40: Epic 6 - Receive suggestions for next course
- FR41: Epic 6 - Identify courses at risk of abandonment
- FR42: Epic 6 - Receive adaptive scheduling suggestions
- FR43: Epic 7 - Study time analytics (daily/weekly/monthly)
- FR44: Epic 7 - Track completion rates over time
- FR45: Epic 3 - View and manage bookmarked lessons (Bookmarks page, Story 3.7)
- FR46: Epic 7 - Retention insights (completed vs abandoned)
- FR47: Epic 7 - Personalized insights and recommendations
- FR48: Epic 8 - AI-generated video summaries
- FR49: Epic 8 - Q&A based on own notes
- FR50: Epic 8 - AI-suggested optimal learning paths
- FR51: Epic 8 - Identify knowledge gaps and suggest reinforcement
- FR52: Epic 8 - AI note organization and enhancement
- FR53: Epic 8 - Suggest concept connections across courses
- FR76: Epic 3 - Insert video timestamp via keyboard shortcut
- FR77: Epic 3 - Side-by-side layout (video + notes)
- NFR34: Epic 3 - Data export in standard formats (JSON, Markdown) for migration (Story 3.10)
- NFR35: Epic 3 - Note storage structure compatible with Notion/Obsidian (Story 3.10)
- NFR42: Epic 3 - Note editor keyboard shortcuts and keyboard-only editing (Story 3.1)
- FR78: Epic 7 - Learning velocity (completion rate, content/hour, trends)

## Epic List

### Epic 1: Course Import & Library Management

User can import course folders from disk and browse an organized course library with metadata, categories, and filtering.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6

**Implementation notes:** Includes foundational data layer setup (Dexie.js schema, Zustand stores, TypeScript types). File System Access API integration for Chrome/Edge. Course scanning extracts video/PDF metadata. Establishes the Courses and Library pages.

---

### Epic 2: Video & PDF Content Playback

User can watch course videos and view PDFs with full playback controls, bookmarking, resume functionality, and keyboard shortcuts in a distraction-free Lesson Player.

**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13

**Implementation notes:** react-player v3.4.0 with custom controls overlay (playback speed 0.5x-2x, WebVTT captions, keyboard shortcuts). react-pdf v10.3.0 for PDF viewing. Course structure navigation via ModuleAccordion. Auto-mark complete at 95% watched. Establishes Lesson Player page.

---

### Epic 3: Note-Taking & Knowledge Capture

User can take Markdown notes linked to specific videos with timestamps, capture video frames, organize via tags, search across all notes, export for external tools, and auto-save without manual action.

**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25, FR26, FR27, FR45, FR76, FR77 | **NFRs:** NFR34, NFR35, NFR42

**Implementation notes:** @uiw/react-md-editor + react-markdown + rehype-sanitize. MiniSearch for full-text search with fuzzy matching. Custom timestamp link format `[MM:SS](video://id#t=seconds)`. Side-by-side layout (60/40) on desktop, stacked on mobile. 3-second debounced autosave with 10-second max wait. Video frame capture via canvas API. Note export in Markdown/JSON. Data migration from localStorage to Dexie.js. Global Notes dashboard page.

---

### Epic 4: Progress Tracking & Visual Maps

User can track completion across courses with color-coded visual progress indicators, study session logging, and comprehensive progress visualization.

**FRs covered:** FR14, FR15, FR16, FR17, FR18, FR19

**Implementation notes:** Color-coded states (gray = not started, blue = in progress, green = completed). ProgressWidget with circular ring. Auto-log study sessions. Session history timeline. Enhances Overview dashboard with progress-first navigation.

---

### Epic 5: Study Streaks & Gamification

User can maintain daily study streaks, create personal learning challenges, and receive celebratory visual feedback for milestones.

**FRs covered:** FR28, FR29, FR30, FR31, FR32, FR33, FR34, FR35

**Implementation notes:** StudyStreak component with flame icon scaling. Calendar heatmap visualization. Streak pause/recovery (vacation mode). Challenge types: completion-based, time-based, streak-based. Celebration micro-moments via Framer Motion (confetti, scale bounce, progress bar fill).

---

### Epic 6: Learning Intelligence & Momentum

User can view course momentum scores, receive smart course recommendations, and use the "Continue Learning" zero-decision resume button to enter flow state instantly.

**FRs covered:** FR36, FR37, FR38, FR39, FR40, FR41, FR42

**Implementation notes:** Momentum algorithm (40% recency, 30% completion, 30% frequency). Hot/warm/cold indicators on course cards. "Continue Learning" hero CTA on dashboard. Abandonment detection and gentle nudges. Adaptive scheduling suggestions. Implements the defining "zero-decision resume" experience.

---

### Epic 7: Analytics & Reporting Dashboard

User can view comprehensive study analytics with time breakdowns, completion trends, learning velocity metrics, and personalized insights.

**FRs covered:** FR43, FR44, FR46, FR47, FR78

**Implementation notes:** Recharts-based visualizations on Reports page. Study time charts (daily/weekly/monthly). Completion rate trends over time. Learning velocity (videos/week, content/hour, acceleration trends). Retention insights (completed vs abandoned). StatsCard components with sparklines.

---

### Epic 8: AI-Powered Learning Assistant

User can leverage AI for video summaries, note-based Q&A, learning path optimization, knowledge gap identification, and cross-course concept connections.

**FRs covered:** FR48, FR49, FR50, FR51, FR52, FR53

**Implementation notes:** Vercel AI SDK v2.0.31 with @ai-sdk/openai. RAG pattern using MiniSearch for note context retrieval. Streaming responses for summaries. 30-second timeout with AbortController. Graceful degradation when API unavailable. AICoachSuggestion cards throughout UI.

---

## Epic 1: Course Import & Library Management

User can import course folders from disk and browse an organized course library with metadata, categories, and filtering.

### Story 1.1: Set Up Data Foundation and Import Course Folder

As a learner,
I want to select a course folder from my local file system and have the platform scan and import it,
So that my courses are stored and ready for studying without manual data entry.

**Acceptance Criteria:**

**Given** the app is running in Chrome/Edge with File System Access API support
**When** the user clicks "Import Course" and selects a folder via the directory picker
**Then** the system scans the folder recursively for supported files (MP4, MKV, AVI, WEBM, PDF)
**And** extracts video metadata (filename, duration via HTML5 video element) and PDF metadata (filename, page count via PDF.js)
**And** creates a course record in IndexedDB (Dexie.js) with auto-generated UUID, course name from folder name, import timestamp, and file counts
**And** creates individual video and PDF records linked to the course by courseId
**And** stores FileSystemDirectoryHandle in IndexedDB for persistent file access across sessions
**And** displays a success toast notification with course name and content summary (e.g., "Imported: React Patterns — 47 videos, 3 PDFs")

**Given** the user selects a folder with no supported files
**When** the import scan completes
**Then** the system displays an error message: "No supported files found. Please select a folder containing video (MP4, MKV, AVI, WEBM) or PDF files."
**And** does not create any database records

**Given** the user denies file system permission
**When** the permission dialog is dismissed or denied
**Then** the system displays a helpful message explaining why permission is needed with a "Try Again" action
**And** does not crash or leave the app in a broken state

**Technical Notes:**
- Initialize Dexie.js database `ElearningDB` with tables: `courses`, `videos`, `pdfs`
- Initialize Zustand `useCourseStore` with course state and actions
- Define TypeScript types in `src/data/types.ts`: `Course`, `Video`, `Pdf`, `VideoMetadata`, `PdfMetadata`
- Use `crypto.randomUUID()` for all IDs
- Store dates as ISO 8601 strings

---

### Story 1.2: Display Course Library

As a learner,
I want to view all my imported courses in a visual library grid,
So that I can see what courses I have and their details at a glance.

**Acceptance Criteria:**

**Given** the user has imported one or more courses
**When** the user navigates to the Courses page
**Then** all courses are displayed in a responsive card grid (4 columns desktop, 2 tablet, 1 mobile)
**And** each course card shows: course title, video count, PDF count, and gradient placeholder image
**And** cards use `rounded-[24px]` border radius and follow the design system (8px grid spacing, #FAF5EE background)
**And** cards have hover state with scale(1.02) + elevated shadow + blue-600 title color (300ms transition)

**Given** the user has no imported courses
**When** the user navigates to the Courses page
**Then** an empty state is displayed with a clear CTA: "Import Your First Course" that triggers the folder import dialog

**Given** the user has many courses (10+)
**When** browsing the library
**Then** courses are sorted by most recently imported (newest first)
**And** the layout remains performant with no layout shift

---

### Story 1.3: Organize Courses by Topic

As a learner,
I want to tag my courses with topics and filter the library by subject,
So that I can find related courses quickly as my library grows.

**Acceptance Criteria:**

**Given** the user is viewing a course card or course detail
**When** the user adds topic tags (e.g., "React", "TypeScript", "System Design")
**Then** the tags are persisted in IndexedDB on the course record
**And** tags are displayed as badges on the course card
**And** tags use the Dexie.js multi-entry index (`*tags`) for efficient querying

**Given** the user has tagged courses with various topics
**When** the user selects a topic filter on the Courses page
**Then** only courses matching the selected topic are displayed
**And** the filter can be cleared to show all courses again

**Given** the user wants to manage tags
**When** the user edits tags on a course
**Then** existing tags can be removed and new tags added
**And** tag input supports autocomplete from previously used tags across all courses

---

### Story 1.4: Manage Course Status

As a learner,
I want to categorize my courses as Active, Completed, or Paused,
So that I can focus on what I'm currently studying and filter out completed or paused courses.

**Acceptance Criteria:**

**Given** the user is viewing a course in the library
**When** the user changes the course status to Active, Completed, or Paused
**Then** the status is persisted in IndexedDB
**And** the course card displays a visual status indicator (badge or icon)
**And** Active courses show a blue-600 indicator, Completed shows green-600 with checkmark, Paused shows gray-400

**Given** the user has courses in multiple statuses
**When** the user applies a status filter on the Courses page
**Then** only courses matching the selected status are displayed
**And** filters can be combined with topic filters
**And** the active filter state is visually indicated

**Given** a newly imported course
**When** the import completes
**Then** the course status defaults to "Active"

---

**Epic 1 Summary:** 4 stories covering all 6 FRs (FR1-FR6). Each story builds on the previous one and is independently completable.

---

## Epic 2: Video & PDF Content Playback

User can watch course videos and view PDFs with full playback controls, bookmarking, resume functionality, and keyboard shortcuts in a distraction-free Lesson Player.

### Story 2.1: Lesson Player Page with Video Playback

As a learner,
I want to open a course video in a dedicated Lesson Player page and watch it with standard playback controls,
So that I can consume course content in a focused, distraction-free environment.

**Acceptance Criteria:**

**Given** the user selects a video from a course
**When** the Lesson Player page loads
**Then** react-player renders the video using a blob URL created from the FileSystemFileHandle
**And** the player displays the video title and course name in the header
**And** the interface is optimized for minimal distractions (clean layout, no sidebar clutter)
**And** the video starts in paused state, ready for the user to begin

**Given** the video file cannot be accessed (moved/deleted)
**When** the Lesson Player attempts to load the file
**Then** the system displays an error state: "Video file not found. Would you like to locate it?"
**And** provides a file picker button to re-locate the file
**And** does not crash or leave the page in a broken state

**Given** the user is on a mobile viewport (< 640px)
**When** the Lesson Player loads
**Then** the video player takes full width with controls below
**And** touch targets for controls are >= 44x44px

**Technical Notes:**
- Create `src/app/pages/LessonPlayer.tsx` page component
- Add route `/courses/:courseId/lessons/:lessonId` to React Router
- Initialize Zustand `useVideoPlayerStore` for playback state
- Use `URL.createObjectURL()` for video blob URLs, revoke on unmount

---

### Story 2.2: Video Playback Controls and Keyboard Shortcuts

As a learner,
I want custom playback controls with keyboard shortcuts and speed adjustment,
So that I can control my learning pace efficiently without leaving the keyboard.

**Acceptance Criteria:**

**Given** a video is loaded in the Lesson Player
**When** the user interacts with controls
**Then** play/pause toggle works via button click and Space key
**And** seek forward/backward works via progress bar scrub and Arrow keys (±5s), Shift+Arrow (±10s)
**And** volume control with slider and mute toggle (M key)
**And** fullscreen toggle (F key)
**And** playback speed selector offers 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x options
**And** current timestamp and total duration are displayed in MM:SS format

**Given** a video has an associated WebVTT caption file
**When** the user toggles captions (C key)
**Then** captions are displayed/hidden on the video
**And** caption font size is adjustable (14pt-20pt)

**Given** the user watches a video to 95% or more completion
**When** the 95% threshold is crossed
**Then** the video is automatically marked as completed in IndexedDB
**And** a celebration micro-moment plays (green checkmark scale bounce, 300ms)

**Given** the user has `prefers-reduced-motion` enabled
**When** animations would trigger
**Then** completion celebration uses opacity fade instead of scale animation

**Technical Notes:**
- Custom controls overlay on react-player (hide native controls)
- All controls meet WCAG AA+ (4.5:1 contrast, visible focus indicators, ARIA labels)
- Add `progress` table to Dexie.js schema for video completion tracking

---

### Story 2.3: Video Bookmarking and Resume

As a learner,
I want the platform to remember my exact playback position and resume from where I left off,
So that I never waste time searching for where I stopped watching.

**Acceptance Criteria:**

**Given** the user is watching a video
**When** the playback position changes
**Then** the current position is saved to IndexedDB every 5 seconds (debounced)
**And** the save happens silently without user awareness

**Given** the user navigates away and later returns to the same video
**When** the Lesson Player loads
**Then** the video seeks to the exact saved position (seconds precision) within 1 second
**And** the player shows a brief "Resuming from MM:SS" indicator

**Given** the user wants to bookmark a specific position
**When** the user clicks the bookmark button or presses B
**Then** the current timestamp is saved as a bookmark in IndexedDB (`bookmarks` table)
**And** a toast confirms the bookmark was saved
**And** bookmarks are visible on the video progress bar as small markers

**Given** the user has bookmarks for a video
**When** the user clicks a bookmark marker on the progress bar
**Then** the video seeks to that bookmarked position

**Technical Notes:**
- Add `bookmarks` table to Dexie.js: `id, courseId, lessonId, timestamp, createdAt`
- **Schema ownership — `progress` table v1 (this story owns version 1):** Create Dexie schema version 1 with fields `courseId, videoId, currentTime` (playback resume only). Story 4.1 will extend this schema to version 2 — do not add completion or session fields here.
- Use 5-second debounce for position saves

---

### Story 2.4: PDF Viewer with Page Navigation

As a learner,
I want to view PDF course materials with page navigation and zoom controls,
So that I can study slides and textbooks alongside my video content.

**Acceptance Criteria:**

**Given** the user selects a PDF file from a course
**When** the Lesson Player loads in PDF mode
**Then** react-pdf renders the PDF with progressive page loading (pages load as user scrolls)
**And** page navigation controls show current page and total pages (e.g., "Page 5 of 42")
**And** keyboard navigation works (Page Up/Down, Home/End, Arrow keys)

**Given** the user wants to adjust the view
**When** using zoom controls
**Then** fit-width, fit-page, and custom percentage zoom options are available
**And** text selection works within the PDF for copying

**Given** the user navigates away from a PDF
**When** they return later
**Then** the last viewed page is restored from IndexedDB
**And** the restore happens within 1 second

**Technical Notes:**
- Use react-pdf v10.3.0 with PDF.js worker
- Store last page position in `progress` table
- Lazy-load pages for performance with large PDFs

---

### Story 2.5: Course Structure Navigation

As a learner,
I want to see the full course structure and navigate between videos and PDFs within a course,
So that I can browse the curriculum and jump to any lesson.

**Acceptance Criteria:**

**Given** the user is on the Lesson Player page
**When** the course sidebar/panel is visible
**Then** the full course structure is displayed as a collapsible ModuleAccordion
**And** each module shows its title, lesson count, and completion status
**And** each lesson shows its title, duration (videos) or page count (PDFs), and type icon (video/PDF)

**Given** the user is viewing a lesson
**When** the user clicks a different lesson in the course structure
**Then** the Lesson Player switches to the selected lesson without full page reload
**And** the current lesson is highlighted in the course structure list

**Given** the user completes the current video
**When** they want to continue to the next lesson
**Then** a "Next Lesson" button is visible that loads the next lesson in sequence
**And** auto-advance triggers after a 5-second countdown with a visible cancel option

**Given** the course structure on mobile (< 640px)
**When** the user wants to navigate
**Then** the course structure is accessible via a slide-out panel (Sheet component)
**And** the panel can be opened/closed without losing video state

**Technical Notes:**
- ModuleAccordion uses shadcn/ui Accordion component
- LessonList component for ordered lesson display
- Auto-advance uses setTimeout with cancel via clearTimeout

---

### Story 2.6: Video Player UX Fixes & Accessibility

As a learner,
I want a video player with proper touch targets, accessible controls, and reliable behavior on all devices,
So that I can use the player comfortably on mobile, tablet, and desktop with keyboard or touch.

**Acceptance Criteria:**

**Given** the user is on a mobile viewport (< 640px)
**When** the video player bottom controls are visible
**Then** all interactive buttons have minimum 44x44px touch targets
**And** the volume control is accessible via a popover triggered by tapping the mute/unmute button
**And** controls respond to touch events for auto-show/hide (not only mouse events)

**Given** the video player container receives keyboard focus
**When** the user tabs to the player
**Then** a visible focus ring appears around the player container
**And** all keyboard shortcuts function correctly

**Given** the speed menu dropdown is open
**When** the user presses Tab
**Then** focus is trapped within the menu items (wraps from last to first)
**And** pressing Escape closes the menu and returns focus to the trigger button
**And** menu items have `role="menuitem"` with `aria-checked` on the active speed

**Given** the `<video>` element renders
**When** the page loads
**Then** the element has `preload="metadata"`, `playsInline`, and optional `poster` attributes
**And** only metadata is preloaded (not the full video)

**Given** the user has `prefers-reduced-motion` enabled
**When** the controls overlay transitions
**Then** transitions complete in ≤1ms (handled by existing global CSS rule)

**Given** the user is on the Lesson Player page
**When** the page renders
**Then** only one vertical scrollbar is visible for the main content area (no double scrollbar)
**And** the course sidebar has its own independent scroll
**And** all scrollbars use thin, theme-aware styling that matches light/dark mode

**Technical Notes:**
- `src/app/components/figma/VideoPlayer.tsx`: touch targets `h-8 w-8` → `h-11 w-11`, icons `h-4 w-4` → `h-5 w-5`, remove duplicate play/pause from bottom bar, add `onTouchStart={resetControlsTimeout}`, speed menu focus trap (`role="menu"` / `role="menuitem"`), mobile volume vertical popover (`sm:hidden`), new prop `poster?: string`
- `src/app/pages/LessonPlayer.tsx`: change `h-[calc(100vh-120px)]` → `h-full` on outer container to fill Layout's `<main>` exactly and eliminate double scrollbar
- `src/styles/index.css`: add global thin scrollbar styling using `scrollbar-width: thin` + `scrollbar-color` (Firefox) and `::-webkit-scrollbar` rules (Chrome/Safari) using theme CSS variables (`--color-border`, `--color-muted-foreground`)

---

### Story 2.7: Skip Controls, Picture-in-Picture & Shortcuts Help

As a learner,
I want visible skip buttons, picture-in-picture mode, and a shortcuts reference,
So that I can navigate video content quickly, multitask while watching, and discover keyboard shortcuts.

**Acceptance Criteria:**

**Given** the user is watching a video
**When** the controls are visible
**Then** skip-back (−10s) and skip-forward (+10s) buttons appear in the bottom-left control group
**And** pressing J skips back 10 seconds, L skips forward 10 seconds (YouTube convention)
**And** each skip action triggers an ARIA announcement ("Skipped back 10 seconds")

**Given** the browser supports Picture-in-Picture
**When** the user clicks the PiP button or presses P
**Then** the video enters PiP mode (floating window)
**And** the PiP button shows active state while in PiP
**And** exiting PiP (via button or browser chrome) returns to inline playback

**Given** the browser does not support Picture-in-Picture
**When** the controls render
**Then** the PiP button is not shown

**Given** the user presses ? while the video player has focus
**When** the shortcuts overlay appears
**Then** all available keyboard shortcuts are displayed in a two-column grid overlay
**And** pressing ? again or Escape dismisses the overlay
**And** the Layout-level ? handler does NOT also fire (event propagation stopped)

**Technical Notes:**
- New file: `src/app/components/figma/VideoShortcutsOverlay.tsx`
- Import `SkipBack`, `SkipForward`, `PictureInPicture2` from lucide-react
- PiP: `video.requestPictureInPicture()` / `document.exitPictureInPicture()`
- Listen to `enterpictureinpicture` / `leavepictureinpicture` events for state sync
- Guard PiP button render with `document.pictureInPictureEnabled`
- Shortcuts overlay: absolute-positioned inside AspectRatio, `e.stopPropagation()` on `?`

---

### Story 2.8: Chapter Progress Bar & Transcript Panel

As a learner,
I want chapter markers on the progress bar and a synchronized transcript panel,
So that I can navigate long videos by topic and follow along with or search the spoken content.

**Acceptance Criteria:**

**Given** a video has chapter data provided
**When** the progress bar renders
**Then** chapter divider lines appear at each chapter start position
**And** hovering the progress bar shows a tooltip with the timestamp and chapter title
**And** the progress bar grows slightly on hover for easier targeting

**Given** a video has no chapter data
**When** the progress bar renders
**Then** it displays as a standard progress bar with no markers (backward compatible)

**Given** a video has caption/subtitle data (WebVTT)
**When** the user opens the "Transcript" tab in LessonPlayer
**Then** a scrollable panel displays all caption cues with timestamps
**And** the currently spoken cue is highlighted and auto-scrolled into view
**And** clicking any cue seeks the video to that cue's start time

**Given** no caption data exists for the current video
**When** the tabs render
**Then** the "Transcript" tab is not shown

**Technical Notes:**
- New file: `src/app/components/figma/ChapterProgressBar.tsx` — custom progress bar replacing Radix Slider
- New file: `src/app/components/figma/TranscriptPanel.tsx` — VTT parser + synchronized cue list
- New types in `src/data/types.ts`: `Chapter { time: number; title: string }`, `TranscriptCue { startTime: number; endTime: number; text: string }`
- New VideoPlayer prop: `chapters?: Chapter[]`
- TranscriptPanel fetches and parses VTT file directly (browser TextTrack API only gives active cues)
- LessonPlayer: track `videoCurrentTime` via existing `onTimeUpdate`, pass to TranscriptPanel
- Add "Transcript" to existing Tabs component (Materials | Notes | Bookmarks | Transcript)
- Caption source from `videoResource?.metadata?.captions?.[0]?.src`

---

### Story 2.9: Mini-Player & Theater Mode

As a learner,
I want the video to follow me as I scroll and an option to widen the viewing area,
So that I can keep watching while reading materials below and maximize the video when I want focus.

**Acceptance Criteria:**

**Given** the user is watching a video and scrolls down past the player
**When** the main video player leaves the viewport
**Then** a mini-player appears fixed in the bottom-right corner (320px wide)
**And** the original player area shows a placeholder to prevent layout shift
**And** clicking the mini-player scrolls back to the full player
**And** the mini-player disappears when video is paused or the user scrolls back up

**Given** the user clicks the theater mode button or presses T
**When** theater mode activates
**Then** the course sidebar (ModuleAccordion) is hidden
**And** the video and content area expand to use the full available width
**And** pressing T again or clicking the button exits theater mode
**And** the mobile Sheet navigation remains accessible

**Given** the user is in theater mode on mobile (< 1280px)
**When** the sidebar is already hidden by default
**Then** the theater mode button is not shown (sidebar already hidden)

**Technical Notes:**
- New file: `src/app/hooks/useIntersectionObserver.ts` — reusable hook
- Mini-player: CSS-only repositioning (position: fixed vs static) on the SAME `<video>` element, no second instance
- Insert spacer `<div>` with matching aspect ratio when fixed
- New VideoPlayer prop: `onPlayStateChange?: (isPlaying: boolean) => void`
- Theater mode: page-level state in LessonPlayer (Approach A — no Layout coupling)
- New VideoPlayer props: `theaterMode?: boolean`, `onTheaterModeToggle?: () => void`
- Add `t` keyboard shortcut in VideoPlayer

---

**Epic 2 Summary:** 9 stories covering 15 FRs (FR7-FR13, FR79-FR86).

---

## Epic 3: Note-Taking & Knowledge Capture

User can take Markdown notes linked to specific videos with timestamps, capture video frames, organize via tags, search across all notes, export for external tools, and auto-save without manual action.

### Story 3.0: Data Layer Migration (Notes & Bookmarks)

As a learner,
I want my existing notes and bookmarks seamlessly migrated to the new database,
So that I don't lose any data when the platform upgrades its storage engine.

**Acceptance Criteria:**

**Given** the app loads after the Epic 3 upgrade
**When** the Dexie.js schema initializes
**Then** the database upgrades from version 2 to version 3, adding `notes` and `bookmarks` tables
**And** the `notes` table schema is: `id, courseId, &videoId, *tags, createdAt, updatedAt`
**And** the `bookmarks` table schema is: `id, courseId, lessonId, timestamp, label, createdAt`

**Given** existing notes are stored in localStorage (`course-progress` key)
**When** the migration detects un-migrated note data
**Then** all notes from `CourseProgress.notes` (Record<lessonId, Note[]>) are extracted and inserted into the Dexie `notes` table
**And** note IDs, content, tags, timestamps, createdAt, and updatedAt are preserved exactly
**And** courseId and videoId are derived from the progress record structure

**Given** existing bookmarks are stored in localStorage (`video-bookmarks` key)
**When** the migration detects un-migrated bookmark data
**Then** all bookmarks are inserted into the Dexie `bookmarks` table with all fields preserved

**Given** migration completes successfully
**When** the app continues loading
**Then** localStorage data is retained as backup (not deleted) for one version cycle
**And** a console log confirms: `[Migration] Migrated {N} notes and {M} bookmarks to IndexedDB`
**And** subsequent loads skip migration (version-guarded via Dexie upgrade callback)

**Given** the migration encounters an error
**When** a Dexie write fails
**Then** the error is logged: `[Migration] Failed: {error}`
**And** the app falls back to localStorage reads gracefully (no data loss, no crash)
**And** a toast notification warns: "Data migration incomplete. Some features may be limited."

**Technical Notes:**
- Dexie.js `db.version(3).stores({...}).upgrade(tx => { ... })` for schema + data migration
- New Zustand stores: `useNoteStore` (notes CRUD + optimistic updates), `useBookmarkStore` (bookmarks CRUD)
- Both stores use optimistic update pattern: Zustand first (UI), Dexie second (persistence)
- Initialize MiniSearch index from Dexie `notes` table on app load (<2s budget for 500 notes)
- MiniSearch fields: `content`, `tags`, `courseName`, `videoTitle` with boost config (tags 2x, courseName 1.5x)
- Search index updated incrementally on note add/update/delete (not full rebuild)
- All existing note/bookmark lib functions (`src/lib/progress.ts`, `src/lib/bookmarks.ts`) refactored to use Dexie + Zustand
- Pattern reference: `useCourseImportStore.ts` for Dexie-backed Zustand store with optimistic updates

---

### Story 3.1: Markdown Note Editor with Autosave

As a learner,
I want to write Markdown-formatted notes that are linked to the current video and auto-saved,
So that I can capture knowledge while studying without worrying about losing my work.

**Acceptance Criteria:**

**Given** the user is on the Lesson Player page watching a video
**When** the user opens the note editor panel
**Then** @uiw/react-md-editor renders with a toolbar (bold, italic, lists, code blocks, headings, links)
**And** the editor supports side-by-side edit/preview mode
**And** the note is automatically linked to the current course and video (courseId, videoId stored in the note record)
**And** keyboard shortcuts work natively (Cmd+B bold, Cmd+I italic, etc. — NFR42)

**Given** the user is typing in the note editor
**When** 3 seconds elapse since the last keystroke
**Then** the note content is auto-saved to IndexedDB (Dexie.js `notes` table) via `useNoteStore`
**And** if 10 seconds pass with continuous typing, a forced save occurs (max wait)
**And** a subtle autosave indicator fades in ("Saved") and fades out after 2 seconds
**And** the MiniSearch index is updated incrementally with the saved note content

**Given** the user returns to a video they previously took notes on
**When** the note editor loads
**Then** the existing note content is retrieved from IndexedDB and displayed
**And** the user can continue editing seamlessly

**Given** the note contains user-generated Markdown
**When** the note is rendered in preview mode
**Then** the content is sanitized via rehype-sanitize to prevent XSS attacks
**And** the custom sanitization schema allows `video://` and `screenshot://` protocol links

**Technical Notes:**

- **Brownfield upgrade**: Existing `NoteEditor.tsx` (263 lines) has textarea + react-markdown preview + autosave + hashtag extraction. This story REPLACES the textarea with `@uiw/react-md-editor`. Leave the existing `#hashtag` extraction logic in place — Story 3.4 owns its removal when the explicit tag UI is introduced.
- Install: `@uiw/react-md-editor`, `rehype-sanitize`, `use-debounce`
- **Fix currentVideoTime gap**: Add `const [currentVideoTime, setCurrentVideoTime] = useState(0)` to LessonPlayer, wire VideoPlayer's `onTimeUpdate` to update it, pass to NoteEditor. This unblocks the "Add Timestamp" button.
- **Fix tag-dropping bug**: LessonPlayer's `handleNoteChange` must pass the `tags` parameter to the save function (currently silently drops it)
- Use `crypto.randomUUID()` for note IDs, ISO 8601 for dates
- Optimistic update pattern: update `useNoteStore` first, persist to Dexie.js async
- Use `use-debounce` library for 3s debounce / 10s max wait
- NFR35 compatibility: pure Markdown content + string[] tags = naturally compatible with Notion/Obsidian

---

### Story 3.2: Side-by-Side Study Layout

As a learner,
I want to see the video player and note editor side-by-side on desktop,
So that I can watch and take notes simultaneously without context switching.

**Acceptance Criteria:**

**Given** the user is on the Lesson Player page on desktop (>= 1024px)
**When** the note editor is open
**Then** the layout shows video player (60% width) and note editor (40% width) side by side
**And** the split is resizable via a drag handle (shadcn/ui Resizable component)
**And** minimum width for each panel prevents content from being unusably small

**Given** the user navigates to a lesson directly (not via "Continue Learning")
**When** the Lesson Player loads on desktop
**Then** the notes panel is collapsed by default with a toggle button to expand
**And** if the lesson has existing notes, a subtle indicator shows "Notes available"

**Given** the user navigates via "Continue Learning" or with `?panel=notes` URL param
**When** the Lesson Player loads
**Then** the notes panel opens automatically with existing notes pre-loaded

**Given** the user is on tablet (640px-1023px)
**When** the note editor is open
**Then** the layout stacks video on top, notes below
**And** a toggle button allows switching between video-focused and notes-focused view

**Given** the user is on mobile (< 640px)
**When** the note editor is open
**Then** the video and notes are fully stacked (video top, notes bottom)
**And** the note editor can expand to full screen for focused note-taking

**Technical Notes:**
- LessonPlayer reads `?panel=notes` search param to control initial tab/panel state (enables deep-linking from search results and "Continue Learning")
- Convert Tabs from uncontrolled (`defaultValue`) to controlled (`value` + `onChange`) to support programmatic tab switching

---

### Story 3.3: Timestamp Notes and Video Navigation

As a learner,
I want to insert the current video timestamp into my notes and click timestamps to jump to that moment,
So that I can link my knowledge to exact video moments for future recall.

**Acceptance Criteria:**

**Given** the user is watching a video and taking notes
**When** the user presses Alt+T (or clicks the timestamp button in the toolbar)
**Then** the current video timestamp is inserted into the note as a clickable link in format `[MM:SS](video://lessonId#t=seconds)`
**And** the insertion happens at the cursor position

**Given** a note contains a timestamp link like `[2:34](video://lesson-01#t=154)`
**When** the user clicks the link in preview mode
**Then** the video player seeks to exactly 2 minutes 34 seconds (154 seconds)
**And** the seek completes within 1 second

**Given** the user views notes for a video
**When** timestamps are present
**Then** they render as clickable blue-600 links with a clock icon
**And** hovering shows a tooltip with the formatted time

**Technical Notes:**
- Custom react-markdown renderer for `video://` protocol links
- Alt+T keyboard shortcut handler reads current time from LessonPlayer's `currentVideoTime` state (fixed in Story 3.1)
- Custom rehype-sanitize schema to allow `video` protocol in href
- The `video://` renderer pattern is reused by Story 3.9 for `screenshot://` protocol

---

### Story 3.4: Tag-Based Note Organization

As a learner,
I want to add tags to my notes for topical organization,
So that I can categorize and discover related notes across courses.

**Acceptance Criteria:**

**Given** the user is editing a note
**When** the user opens the tag management UI
**Then** a dedicated tag input field is displayed (separate from note content)
**And** tags can be added by typing and pressing Enter or comma
**And** existing tags are shown as removable badges below the input
**And** tag input supports autocomplete from previously used tags across all notes

**Given** the user has notes with various tags
**When** browsing notes on the Global Notes page (Story 3.8)
**Then** notes can be filtered by tag
**And** a tag cloud or list shows all available tags with note counts

**Given** tags are managed
**When** tags are added or removed
**Then** changes are persisted to IndexedDB via `useNoteStore` immediately
**And** the Dexie.js multi-entry index (`*tags`) enables efficient tag-based queries
**And** the MiniSearch index is updated with the new tag values

**Technical Notes:**
- Tag management is via explicit UI, NOT automatic hashtag extraction from markdown content (per Architecture decision)
- **Must remove** the existing `#hashtag` extraction logic from NoteEditor (this story owns the removal — Story 3.1 replaces the textarea but does not own tag logic)
- Tag normalization (trim + lowercase) at the store boundary, not in UI (per Epic 1 team agreement)
- Query all unique tags across notes via Dexie for autocomplete: `db.notes.orderBy('tags').uniqueKeys()`

---

### Story 3.5: Full-Text Note Search

As a learner,
I want to search across all my notes by content, tags, or course name,
So that I can find specific knowledge I've captured in under 10 seconds.

**Acceptance Criteria:**

**Given** the user has notes across multiple courses
**When** the user types a search query in the search bar or Cmd+K command palette
**Then** MiniSearch returns matching results within 100ms of the final keystroke (150ms debounce + sub-1ms search)
**And** results show note snippet with highlighted matching keywords, course name, video title, and tags
**And** results are ranked by relevance (tags boosted 2x, course name 1.5x, content 1x)

**Given** the user types a query with a typo (e.g., "custm hooks")
**When** search executes
**Then** fuzzy matching still returns relevant results (e.g., notes containing "custom hooks")
**And** prefix search works for autocomplete (searching "java" finds "javascript")

**Given** a search result is clicked
**When** the user selects a note result
**Then** the Lesson Player opens with the linked video and `?panel=notes` param to auto-open the Notes tab
**And** if the note contains a timestamp link, the video seeks to that position

**Given** no results match the query
**When** search returns empty
**Then** a helpful message is shown: "No notes found. Try different keywords or browse by tag."

**Technical Notes:**
- Install: `minisearch`
- MiniSearch index initialized in Story 3.0, updated incrementally on note CRUD
- Search fields: content, tags, courseName, videoTitle
- Combine with 'AND' for multi-term queries
- Limit to top 20 results
- **SearchCommandPalette.tsx modification required**: Add a "Notes" result group to the existing component. The current static `useMemo` index must be extended to incorporate MiniSearch note results. Results render with note icon, content snippet, course/video context, and tag badges. Navigation uses `?panel=notes` param for deep-linking.
- The palette's `useMemo(() => buildSearchIndex(), [])` needs dependency on open state or a separate dynamic fetch for notes, since notes change at runtime

---

### Story 3.6: View Course Notes Collection

As a learner,
I want to view all notes for a specific course in one place,
So that I can review my captured knowledge for an entire course at a glance.

**Acceptance Criteria:**

**Given** the user is viewing a course on the CourseDetail page
**When** the user navigates to the Notes tab/section
**Then** all notes for that course are listed, grouped by video
**And** each note shows: preview snippet, tags, timestamp links, and last updated date
**And** notes can be sorted by creation date or by video order

**Given** the user clicks on a note in the collection
**When** the note detail opens
**Then** the full note content renders in Markdown preview with timestamp links active
**And** the user can edit the note inline
**And** the user can delete a note with a confirmation dialog (NFR23)
**And** deleting a note also removes it from the MiniSearch index

**Given** a course has no notes
**When** viewing the Notes section
**Then** an empty state shows: "No notes yet. Start taking notes while watching videos."

**Technical Notes:**
- This adds a "Notes" tab to the CourseDetail page (`src/app/pages/CourseDetail.tsx`)
- Query: `db.notes.where('courseId').equals(courseId).toArray()` grouped by videoId
- Note deletion triggers: Dexie remove + Zustand update + MiniSearch index removal

---

### Story 3.7: Bookmarks Page

As a learner,
I want a dedicated Bookmarks page to view and manage all lessons I've bookmarked,
So that I can quickly revisit important content without searching through courses.

**Acceptance Criteria:**

**Given** the user has bookmarked lessons (via Story 2.3)
**When** the user navigates to the Bookmarks page from the sidebar
**Then** a list of bookmarked lessons is displayed, each showing:
- Lesson title, course name, video duration, completion percentage, and bookmark date
- A thumbnail image (or gradient placeholder fallback)
**And** bookmarks are sorted by "Most Recent" by default
**And** the page header shows the total count ("{N} saved lessons")

**Given** the user wants to sort bookmarks
**When** selecting a sort option from the dropdown
**Then** bookmarks reorder by: "Most Recent" (default), "Course Name" (grouped), or "Alphabetical (A-Z)"
**And** the sort preference persists in localStorage

**Given** the user clicks on a bookmark card
**When** the card is activated (click, tap, or Enter key)
**Then** the app navigates to the Lesson Player at that video's saved position

**Given** the user wants to remove a bookmark on desktop
**When** hovering over a bookmark card
**Then** a Trash2 icon appears on the right side of the card
**And** clicking it removes the bookmark with a collapse animation
**And** a toast notification confirms "Bookmark removed"

**Given** the user wants to remove a bookmark on mobile
**When** interacting with the bookmark card
**Then** a swipe-left gesture reveals a red "Remove" action panel
**And** a three-dot menu provides an accessible alternative with "Remove Bookmark" option (WCAG 2.5.1)

**Given** the user has no bookmarks
**When** the Bookmarks page loads
**Then** a centered empty state shows: BookmarkX icon, "No bookmarks yet", body text, and a "Browse Courses" CTA button

**Given** bookmarks reference courses or lessons that have been deleted
**When** the Bookmarks page mounts
**Then** orphaned bookmarks are purged automatically
**And** a toast notification shows "Removed {N} bookmarks for deleted lessons"

**Technical Notes:**
- Reads from Dexie `bookmarks` table (migrated from localStorage in Story 3.0)
- Uses `useBookmarkStore` (created in Story 3.0) for reactive state
- Sidebar nav: Bookmark icon between "Library" and "Messages", route `/bookmarks`
- BookmarkCard component: `rounded-[24px]` card with horizontal layout (thumbnail + content + action)
- Loading state: 4-6 skeleton bookmark cards with `animate-pulse`, 500ms delay before showing, `aria-busy="true"`
- Virtual scrolling via `@tanstack/react-virtual` when bookmark count > 50
- Accessible: `<section aria-label="Bookmarked lessons">`, `role="article"` per card, `aria-live="polite"` on count
- Keyboard: Tab between cards, Enter to navigate, Delete to remove, focus moves to next card after deletion
- All animations respect `prefers-reduced-motion: reduce`

---

### Story 3.8: Global Notes Dashboard

As a learner,
I want a dedicated Notes page where I can browse, filter, and search all my notes across every course,
So that I can find and review my captured knowledge without remembering which course it came from.

**Acceptance Criteria:**

**Given** the user has notes across multiple courses
**When** the user navigates to the Notes page from the sidebar
**Then** all notes are displayed in reverse chronological order
**And** notes are visually grouped by course with collapsible section headers
**And** each note card shows: content preview (first 2-3 lines), course name, video title, tags as badges, timestamp link count, and last updated date
**And** the page header shows total note count ("{N} notes across {M} courses")

**Given** the user wants to filter by tag
**When** the tag filter bar is visible at the top of the page
**Then** a horizontal scrollable list of tag pills shows all tags with note counts
**And** clicking a tag filters the list to only notes with that tag
**And** multiple tags can be selected (AND filter)
**And** an "All" pill clears the filter

**Given** the user wants to search notes
**When** typing in the search bar at the top
**Then** MiniSearch filters results in real-time (reuses Story 3.5 infrastructure)
**And** matching keywords are highlighted in note previews

**Given** the user clicks a note card
**When** the card is activated
**Then** the app navigates to the Lesson Player with `?panel=notes` to auto-open the note
**And** if the note has timestamp links, the first timestamp is used as the video start position

**Given** the user has no notes
**When** the Notes page loads
**Then** a centered empty state shows: FileText icon, "No notes yet", "Start taking notes while watching videos to build your knowledge base.", and a "Browse Courses" CTA button

**Technical Notes:**
- New page: `src/app/pages/Notes.tsx`
- New route: `/notes` in `src/app/routes.tsx` (lazy-loaded)
- Sidebar nav: NotebookPen icon between "Library" and "Bookmarks"
- Dashboard "My Notes" Quick Action links to `/notes` (update `Overview.tsx`)
- Query: `db.notes.orderBy('updatedAt').reverse().toArray()` with optional tag filter via `db.notes.where('tags').anyOf(selectedTags)`
- Reuses MiniSearch instance from Story 3.5 for in-page search
- Loading state: skeleton cards with `animate-pulse`, 500ms delay, `aria-busy="true"`
- Responsive: single-column on mobile, two-column grid on tablet, three-column on desktop

---

### Story 3.9: Video Frame Capture in Notes

As a learner,
I want to capture the current video frame as a screenshot and embed it in my notes with a timestamp,
So that I can save visual content like slides, diagrams, and code examples alongside my written notes for better recall.

**Acceptance Criteria:**

**Given** the user is watching a video and taking notes
**When** the user clicks the "Capture Frame" button (Camera icon) in the NoteEditor toolbar or presses S while the video player has focus
**Then** the current video frame is captured via canvas
**And** a compressed JPEG image (~50KB at 720p) is stored in IndexedDB
**And** a markdown reference is inserted at the cursor: `![Frame at MM:SS](screenshot://id)`
**And** a brief flash animation on the video confirms the capture
**And** an ARIA announcement confirms: "Frame captured at MM:SS"

**Given** a note contains a screenshot reference like `![Frame at 2:34](screenshot://abc123)`
**When** the note is rendered in preview mode
**Then** the screenshot displays as an inline image with rounded corners and a subtle border
**And** a caption below shows "Frame at 2:34" as a clickable timestamp link (seeks video on click)
**And** clicking the image opens a larger preview in a Dialog

**Given** the user wants to remove a captured frame
**When** the user deletes the markdown reference in the editor
**Then** the screenshot blob is cleaned up from IndexedDB on the next save (orphan detection)

**Given** the browser cannot capture the video frame (e.g., cross-origin restriction)
**When** the capture fails
**Then** an error toast shows: "Could not capture frame. The video source may not allow screenshots."
**And** the note editor remains in its current state (no partial insertion)

**Technical Notes:**
- New Dexie table in schema v3 (or v4 if needed): `screenshots`: `id, courseId, lessonId, timestamp, blob, createdAt`
- Capture: `const canvas = document.createElement('canvas'); canvas.getContext('2d').drawImage(videoEl, 0, 0); canvas.toBlob(cb, 'image/jpeg', 0.7)`
- Access the `<video>` element via ref forwarded from VideoPlayer
- Custom react-markdown renderer for `screenshot://` protocol (same pattern as `video://` from Story 3.3)
- Custom rehype-sanitize schema extended to allow `screenshot` protocol
- Storage budget: warn in console at 100+ screenshots per course (~5MB)
- Local file:// videos are same-origin, so canvas capture works without CORS issues

---

### Story 3.10: Note Export

As a learner,
I want to export my notes as Markdown files or JSON data,
So that I can use them in other tools like Notion or Obsidian, create backups, or share my study notes.

**Acceptance Criteria:**

**Given** the user is on the Global Notes page (Story 3.8) or Course Notes collection (Story 3.6)
**When** the user clicks the "Export" button
**Then** a dropdown offers format options: "Markdown (.md)" and "JSON (.json)"

**Given** the user selects Markdown export for a single course
**When** the export generates
**Then** a `.md` file downloads with: course title as H1, video titles as H2, note content under each video section, timestamp links converted to readable `[MM:SS]` format, tags as a comma-separated list per note
**And** the filename follows: `{course-name}-notes.md`

**Given** the user selects Markdown export for all notes (global)
**When** the export generates
**Then** a single `.md` file downloads organized by course (H1) and video (H2)
**And** the filename follows: `levelup-notes-{YYYY-MM-DD}.md`

**Given** the user selects JSON export
**When** the export generates
**Then** a `.json` file downloads containing an array of note records with all metadata (id, courseId, videoId, content, tags, createdAt, updatedAt, courseName, videoTitle)
**And** screenshot references are included as metadata (screenshot ID + timestamp) but blob data is excluded by default to keep file size reasonable

**Given** the export contains screenshot references
**When** rendering the Markdown export
**Then** screenshot references are converted to `[Screenshot at MM:SS]` text placeholders with a note: "Screenshots are stored locally and not included in this export."

**Technical Notes:**
- Export uses browser download API: `URL.createObjectURL(new Blob([content])) + <a download>`
- Markdown generation: iterate notes grouped by course -> video, render with proper heading hierarchy
- JSON generation: `JSON.stringify(notes, null, 2)` with enriched course/video names from static data
- No external dependencies needed
- Export button placement: top-right of Notes page header and Course Notes tab header
- NFR34 (standard formats) and NFR35 (Notion/Obsidian compatibility) satisfied

---

**Epic 3 Summary:** 11 stories covering 11 FRs (FR20-FR27, FR45, FR76, FR77) plus NFR34, NFR35, and NFR42. Stories 3.0 (data migration) and 3.9 (frame capture) are new capabilities not in the original FR list but essential for a robust, competitive note-taking experience.

---

## Epic 4: Progress Tracking & Visual Maps

User can track completion across courses with color-coded visual progress indicators, study session logging, and comprehensive progress visualization.

### Story 4.1: Video Completion Status Tracking

As a learner,
I want to mark videos as Not Started, In Progress, or Completed with visual indicators,
So that I can see exactly where I am in each course at a glance.

**Acceptance Criteria:**

**Given** the user is viewing a course structure (ModuleAccordion or LessonList)
**When** looking at individual lessons
**Then** each lesson displays a color-coded status indicator:
- Gray dot: Not Started
- Blue dot: In Progress
- Green checkmark: Completed
**And** status is pulled from IndexedDB progress records

**Given** the user is watching a video
**When** the video reaches 95% watched (auto-complete) or the user manually marks it complete
**Then** the status updates to Completed in IndexedDB atomically
**And** the lesson indicator changes from blue to green with a smooth 300ms transition
**And** the update is optimistic (UI updates immediately, IndexedDB sync follows)

**Given** the user wants to manually change a video's status
**When** the user right-clicks or uses a context menu on a lesson
**Then** status options (Not Started, In Progress, Completed) are available
**And** the selected status persists to IndexedDB

**Technical Notes:**

- **Schema ownership — `progress` table v2 (this story owns version 2):** Story 2.3 created `progress` at Dexie version 1. This story migrates to version 2, adding fields `completionStatus, completionPercentage` to the existing `courseId, videoId, currentTime` schema. Increment Dexie version number; do not re-create the table from scratch.
- Atomic state changes (NFR15)
- Initialize Zustand `useProgressStore`

---

### Story 4.2: Course Completion Percentage

As a learner,
I want to see the completion percentage for each course,
So that I know how far I've progressed and how much remains.

**Acceptance Criteria:**

**Given** the user has progress data for a course
**When** viewing the course card in the library or course detail page
**Then** a completion percentage is displayed (e.g., "68% complete")
**And** a progress bar visualizes the percentage with blue-600 fill
**And** the percentage is calculated as: (completed videos / total videos) * 100

**Given** the user completes a video
**When** the completion status updates
**Then** the course completion percentage recalculates immediately (optimistic update)
**And** the progress bar animates to the new value (300ms ease-out)

**Given** a course has 0 videos completed
**When** viewing the course card
**Then** the progress bar shows 0% with gray fill
**And** the text shows "Not started"

---

### Story 4.3: Study Session Auto-Logging

As a learner,
I want the platform to automatically log my study sessions with date, duration, and content covered,
So that I have an accurate record of my study habits without manual tracking.

**Acceptance Criteria:**

**Given** the user starts watching a video or viewing a PDF
**When** a study session begins
**Then** the system creates a session record in IndexedDB with: courseId, startTime (ISO 8601), content type (video/PDF), and lesson identifier

**Given** the user is in an active study session
**When** the user navigates away, closes the app, or switches to a different course
**Then** the session end time is recorded
**And** duration is calculated (endTime - startTime)
**And** total study time is aggregated per course and globally

**Given** the user wants to see total study time
**When** viewing the dashboard or course detail
**Then** total study time across all courses is displayed (e.g., "42 hours total")
**And** per-course study time is shown (e.g., "12.5 hours on React Patterns")

**Technical Notes:**
- Add `studySessions` table to Dexie.js: `++id, courseId, startTime, endTime, duration`
- Use `beforeunload` event and `visibilitychange` to detect session end
- Aggregate with Dexie.js queries on `startTime` index

---

### Story 4.4: Study Session History

As a learner,
I want to view my study session history showing when and what I studied,
So that I can review my learning patterns and stay accountable.

**Acceptance Criteria:**

**Given** the user has completed study sessions
**When** viewing the session history (on Reports page or dashboard)
**Then** sessions are displayed in reverse chronological order as a timeline
**And** each entry shows: date, course name, lesson title, duration, and content type icon
**And** the list shows the most recent 20 sessions with pagination or "Load More"

**Given** the user wants to filter session history
**When** applying a date range or course filter
**Then** only matching sessions are displayed
**And** total duration for the filtered set is shown

---

### Story 4.5: Visual Progress Dashboard Widget

As a learner,
I want a visual progress widget on the dashboard showing my overall learning progress,
So that I can see my advancement at a glance and feel motivated to continue.

**Acceptance Criteria:**

**Given** the user has courses with progress data
**When** viewing the Overview dashboard
**Then** a ProgressWidget displays a circular progress ring showing overall completion
**And** the ring uses SVG with dynamic stroke-dashoffset and percentage text in the center
**And** below the ring: total courses count, completed courses count, total lessons finished
**And** the widget has `role="status"` and aria-label announcing progress (e.g., "3 of 8 courses completed, 142 lessons finished")

**Given** the user completes a lesson
**When** the dashboard refreshes
**Then** the progress ring animates to the new percentage (500ms ease-out)
**And** the counters update immediately

**Given** the user has no progress data
**When** viewing the widget
**Then** the ring shows 0% with a motivational message: "Import a course to get started!"

---

**Epic 4 Summary:** 5 stories covering all 6 FRs (FR14-FR19).

---

## Epic 5: Study Streaks & Gamification

User can maintain daily study streaks, create personal learning challenges, and receive celebratory visual feedback for milestones.

### Story 5.1: Daily Study Streak Tracking

As a learner,
I want to track my consecutive study days and see my current streak,
So that I build consistent study habits through the power of "don't break the chain."

**Acceptance Criteria:**

**Given** the user studies for 10+ minutes in a day
**When** the study session is logged
**Then** the day is marked as a study day in the `streaks` table in IndexedDB
**And** the consecutive day streak counter increments
**And** the streak is displayed on the dashboard header with the current count and flame icon

**Given** the user's streak count reaches milestone tiers
**When** viewing the StudyStreak component
**Then** the flame icon scales dynamically:
- 1-6 days: small flame (w-8), message "Keep it up!"
- 7-29 days: medium flame (w-10), message "You're on fire!"
- 30+ days: large flame (w-12), message "Unstoppable!"
**And** the component uses a gradient background (orange-50 → red-50 → pink-50)

**Given** the user has never studied
**When** viewing the streak widget
**Then** the message shows "Start your streak today!" with a dimmed flame icon

**Given** the user has at least 30 days of study history
**When** viewing the streak widget
**Then** a consistency rate is displayed alongside the streak count (e.g., "24/30 days this month")
**And** on days when the streak count is low, the consistency rate is surfaced as the primary metric to reduce anxiety about imperfect streaks

**Technical Notes:**
- Add `streaks` table to Dexie.js: `++id, date, minutesStudied`
- 10-minute minimum threshold for a "study day"
- Calculate streak by checking consecutive dates backward from today
- Track and display longest streak alongside current streak
- Consistency rate: count of distinct study days in the last 30 days displayed as "X/30 days"
- Always store timestamps as UTC ISO 8601 with IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) per activity record — never store ambiguous local date strings
- Day boundary: use `Intl.DateTimeFormat('en-CA', { timeZone })` for local date strings, never `new Date('YYYY-MM-DD')` (parsed as UTC midnight)
- Mirror streak count, last activity date, and freeze token count to `localStorage` as IndexedDB eviction backup

---

### Story 5.2: Streak Calendar Visualization

As a learner,
I want to see a visual calendar showing my study history as a heatmap,
So that I can see my consistency patterns over weeks and months.

**Acceptance Criteria:**

**Given** the user has study history data
**When** viewing the streak calendar on the dashboard or Reports page
**Then** a calendar heatmap displays the last 90 days (or configurable range)
**And** each day cell is color-coded by study intensity:
- No study: gray-100
- Light study (10-30 min): green-200
- Moderate study (30-60 min): green-400
- Heavy study (60+ min): green-600
**And** hovering a day shows tooltip with date and minutes studied

**Given** the user clicks on a calendar day
**When** a study day is selected
**Then** the study sessions for that day are displayed (course, duration, lessons)

**Technical Notes:**
- Query `streaks` table grouped by date
- Use CSS Grid for calendar layout (7 columns)
- Accessible: each cell has aria-label with date and study time

---

### Story 5.3: Streak Pause and Recovery

As a learner,
I want to pause my study streak without losing my history,
So that I can take breaks (vacation, illness) without guilt or losing my progress.

**Acceptance Criteria:**

**Given** the user wants to take a break
**When** the user activates "Vacation Mode" from Settings or streak widget
**Then** the streak counter pauses (days without study don't count against the streak)
**And** the UI shows "Paused" state with a pause icon replacing the flame
**And** the pause start date is recorded in IndexedDB

**Given** the user deactivates vacation mode
**When** they resume studying
**Then** the streak counter resumes from where it was paused
**And** the flame icon returns with the preserved streak count
**And** paused days are shown differently on the calendar (e.g., gray with pause icon)

**Given** the streak was broken before vacation mode was activated
**When** viewing streak history
**Then** the "days since last study" counter shows instead of streak count
**And** no shaming language is used (message: "Welcome back! Ready to start a new streak?")

**Given** the user misses a single study day and has freeze tokens available
**When** the system detects the gap on next app open or session completion
**Then** one freeze token is automatically consumed (no manual activation required)
**And** the streak is preserved with a visual "Freeze used" indicator on the calendar for that day
**And** a toast notifies: "Streak saved with a freeze token. X tokens remaining."

**Given** freeze token earning milestones are reached
**When** the user achieves a streak or challenge milestone
**Then** freeze tokens are awarded:

- 7-day streak: +1 token
- Challenge completion: +1 token
- 30-day streak: +2 tokens
- 100-day streak: +3 tokens
- Maximum holdable: 5 tokens

**And** a toast notifies the user of earned tokens

**Given** no freeze tokens remain and one day is missed
**When** recovery options are evaluated
**Then** if the monthly grace restore has not yet been used this month, the system offers: "Use your one-time monthly restore?"
**And** multi-day gaps (2+ missed days) are never protected — streak resets with no restore option

**Technical Notes:**

- Add `freezeTokens` (0–5), `lastActivityDateLocal`, and `manualRestoreUsedThisMonth` fields to streak state in Dexie
- Use Dexie transactions for all streak state updates to prevent multi-tab race conditions
- Show longest streak alongside current streak — prevents abandonment after a break
- Show freeze/restore option before the user leaves after a break; never send guilt notifications after a streak has already broken

---

### Story 5.4: Study Reminders

As a learner,
I want to configure gentle reminders to maintain my study streak,
So that I get supportive nudges without feeling pressured.

**Acceptance Criteria:**

**Given** the user navigates to Settings
**When** configuring study reminders
**Then** the user can enable/disable reminders
**And** set a preferred reminder time (e.g., 7:00 PM)
**And** choose reminder frequency (daily, weekdays only, custom days)

**Given** reminders are enabled and the user hasn't studied today
**When** the reminder time arrives
**Then** a browser notification is sent with supportive tone (e.g., "Keep your 16-day streak alive! 🔥")
**And** clicking the notification opens the app

**Given** the user has already studied today
**When** the reminder time arrives
**Then** no reminder is sent (user already met the goal)

**Technical Notes:**
- Use Notification API for browser notifications
- Store reminder preferences in localStorage (user-settings key)
- Check study status via `streaks` table before sending

---

### Story 5.5: Create Learning Challenges

As a learner,
I want to create personal learning challenges with specific goals,
So that I have concrete targets to work toward and stay motivated.

**Acceptance Criteria:**

**Given** the user wants to set a goal
**When** the user creates a new challenge
**Then** they can choose a challenge type:
- Completion-based: "Complete X videos this week"
- Time-based: "Study for X minutes this week"
- Streak-based: "Maintain a X-day streak"
**And** set a target value and optional deadline
**And** the challenge is saved to IndexedDB

**Given** a first-time user imports their first course
**When** the onboarding suggests a challenge
**Then** a pre-populated suggestion appears: "Complete 5 videos this week"
**And** the user can accept, modify, or skip the suggestion

**Given** the user has active challenges
**When** viewing the dashboard
**Then** active challenges are displayed with their type, target, and current progress

**Technical Notes:**

- Add `challenges` table to Dexie.js: `++id, type, target, currentValue, deadline, status, createdAt`
- Challenge statuses: active, completed, expired
- Initialize Zustand `useChallengeStore`
- **Post-import challenge suggestion:** The "first course import" trigger (second AC block above) is implemented by subscribing to the `coursesStore` in Zustand — when `courses.length` transitions from 0 to 1, render the suggestion UI. No cross-epic event bus required; this story reads existing Zustand state.

---

### Story 5.6: Challenge Progress Tracking and Celebrations

As a learner,
I want to see my progress against active challenges and receive celebrations when I hit milestones,
So that I feel rewarded for my effort and motivated to continue.

**Acceptance Criteria:**

**Given** the user has active challenges
**When** the user completes a video, studies for time, or maintains a streak
**Then** the relevant challenge progress updates automatically
**And** a ChallengeProgress indicator shows "3/5 videos" with a progress bar (gradient blue-500 → purple-500)

**Given** a challenge milestone is reached (e.g., 50%, 100%)
**When** the progress updates
**Then** a celebration micro-moment triggers:
- 50%: progress bar pulse animation
- 100%: confetti animation + checkmark + congratulatory toast
**And** completed challenges move to a "Completed Challenges" section

**Given** a challenge deadline passes without completion
**When** the deadline expires
**Then** the challenge is marked as "Expired" (not "Failed" — no guilt language)
**And** the user can choose to restart or dismiss it

**Technical Notes:**

- Framer Motion for celebration animations (LazyMotion loaded async)
- Confetti: use `canvas-confetti` (~4 KB gzipped) with `useWorker: true` (off-main-thread Canvas) — do NOT use `react-confetti` (DOM-based, thrashes React reconciler)
- `prefers-reduced-motion`: if reduced motion is preferred, skip confetti entirely and replace pulse animation with a simple opacity fade (200ms); use `useReducedMotion()` from Framer Motion
- Badge unlock animation: spring transition (`stiffness: 400, damping: 20`) with reduced-motion fallback to opacity fade only — never skip animation entirely
- Progress calculated from `studySessions` and `progress` tables

---

**Epic 5 Summary:** 6 stories covering all 8 FRs (FR28-FR35).

---

## Epic 6: Learning Intelligence & Momentum

User can view course momentum scores, receive smart course recommendations, and use the "Continue Learning" zero-decision resume button to enter flow state instantly.

### Story 6.1: Course Momentum Score Algorithm

As a learner,
I want each course to have a momentum score indicating how "hot" or "cold" my engagement is,
So that I can see which courses need attention and which are gaining momentum.

**Acceptance Criteria:**

**Given** the user has courses with study session data
**When** the momentum algorithm runs
**Then** each course receives a score (0-100) calculated as:
- 40% recency: `100 * Math.exp(-daysSinceLastStudy / 7)`
- 30% completion: `completionPercentage`
- 30% frequency: `Math.min(100, (weeklySessionCount / 4) * 100)`
**And** scores map to categories: Hot (>= 70), Warm (40-69), Cold (< 40)

**Given** a study session ends
**When** the session is logged
**Then** the momentum score for that course is recalculated (debounced 5 seconds)
**And** the updated score is cached in the `courseMomentum` table in IndexedDB

**Given** the app loads
**When** momentum scores are needed
**Then** cached scores are used immediately (no recalculation delay)
**And** scores are refreshed in the background if stale (> 1 hour old)

**Technical Notes:**
- Add `courseMomentum` table to Dexie.js: `courseId, score, category, lastStudied, lastCalculated`
- Pure function `calculateMomentumScore()` in `src/lib/momentum.ts`
- Debounced recalculation on session end

---

### Story 6.2: Momentum-Based Course Display

As a learner,
I want to see momentum indicators on course cards and sort my library by momentum,
So that I can prioritize which courses to focus on.

**Acceptance Criteria:**

**Given** courses have momentum scores
**When** viewing the course library
**Then** each course card displays a MomentumIndicator badge:
- Hot: orange-500 flame icon + "Active" label
- Warm: yellow-500 sun icon + "Recent" label
- Cold: gray-400 snowflake icon + "Paused" label
**And** badges are positioned as overlays on the top-right of course cards

**Given** the user wants to sort courses
**When** selecting "Sort by Momentum" option
**Then** courses are ordered by momentum score (highest first)
**And** hot courses appear first, then warm, then cold

**Given** a course transitions between categories (e.g., warm → cold)
**When** the momentum recalculates
**Then** the indicator updates with a smooth transition (color change, 300ms)

---

### Story 6.3: Continue Learning Zero-Decision Resume

As a learner,
I want a single "Continue Learning" button that instantly resumes my study session at the exact course, video, and playback position,
So that I can start studying with zero decisions and enter flow state in seconds.

**Acceptance Criteria:**

**Given** the user has at least one course with study history
**When** the user clicks "Continue Learning" on the dashboard
**Then** the algorithm executes in < 100ms:
1. Query all courses with progress data
2. Select the hottest course (highest momentum score)
3. Find the in-progress video (resume) OR next unwatched video (start)
4. Retrieve exact playback position from IndexedDB
**And** the Lesson Player loads with the selected video at the exact position
**And** the notes panel is pre-populated with existing notes for that video
**And** total time from click to playing video is < 1 second

**Given** the user is on the dashboard
**When** the "Continue Learning" button is visible
**Then** it displays as a prominent primary CTA (blue-600, large, subtle glow on hover)
**And** context subtitle shows: course name + video title (e.g., "React Hooks — useEffect Basics")
**And** the button has visible focus indicator for keyboard navigation

**Given** the user has no courses or no study history
**When** the dashboard loads
**Then** the button shows "Import Your First Course" instead, linking to the import flow

**Given** the selected video file is not accessible
**When** the algorithm selects a video that has been moved/deleted
**Then** an error recovery prompt appears: "Video file moved. [Locate File] or [Skip to Next]"

**Technical Notes:**
- Algorithm in `src/lib/continueLearning.ts`
- Uses `useProgressStore`, `useCourseStore`, and `courseMomentum` table
- Optimistic navigation: transition starts immediately, data loads in parallel

---

### Story 6.4: Course Recommendations and Abandonment Detection

As a learner,
I want the platform to recommend which course to study next and alert me about courses I might be abandoning,
So that I make informed decisions about my learning priorities.

**Acceptance Criteria:**

**Given** the user has multiple courses
**When** the recommendation algorithm runs
**Then** suggestions are generated using three strategies:
- Strategy 1: Maintain momentum — suggest hot courses (completion 40-80%, studied < 7 days ago)
- Strategy 2: Revive at-risk — surface cold courses (completion 10-80%, not studied > 14 days)
- Strategy 3: Related content — suggest courses with similar tags via MiniSearch similarity

**Given** a course hasn't been studied in 14+ days with partial completion
**When** the dashboard loads
**Then** a gentle nudge appears: "Your [Course Name] is getting cold. Pick it back up?" with a "Resume" CTA
**And** the tone is supportive, not guilt-inducing

**Given** the user completes a course section
**When** the AI Coach section on the dashboard updates
**Then** a contextual recommendation appears: "Based on your React progress, ready to start TypeScript?"
**And** the recommendation includes a CTA to navigate to the suggested course

---

### Story 6.5: Adaptive Study Scheduling Suggestions

As a learner,
I want the platform to suggest optimal study times and session lengths based on my patterns,
So that I can plan my learning around my most productive habits.

**Acceptance Criteria:**

**Given** the user has 2+ weeks of study session history
**When** the scheduling algorithm analyzes patterns
**Then** the system identifies: most productive days of the week, average session duration, peak study hours
**And** suggestions are displayed on the dashboard: "You study best on weekday evenings. Keep it up!"

**Given** the user has inconsistent study patterns
**When** the algorithm detects gaps
**Then** a gentle suggestion appears: "Try scheduling 30 minutes at 7 PM — that's when you're most focused."
**And** the suggestion links to setting up a study reminder

---

**Epic 6 Summary:** 5 stories covering all 7 FRs (FR36-FR42).

---

## Epic 7: Analytics & Reporting Dashboard

User can view comprehensive study analytics with time breakdowns, completion trends, learning velocity metrics, and personalized insights.

### Story 7.1: Study Time Analytics

As a learner,
I want to view my study time broken down by daily, weekly, and monthly periods,
So that I can understand how much time I'm investing in learning.

**Acceptance Criteria:**

**Given** the user has study session history
**When** navigating to the Reports page
**Then** a ProgressChart displays study time as a bar chart using Recharts
**And** the chart supports toggle between daily (last 14 days), weekly (last 8 weeks), and monthly (last 6 months) views
**And** each bar represents total study time for that period with tooltip showing exact hours/minutes
**And** the chart is responsive (300px desktop, 200px mobile height)

**Given** the user hovers over a chart bar
**When** the tooltip appears
**Then** it shows: date/period, total time, breakdown by course (top 3)

**Given** no study data exists
**When** the Reports page loads
**Then** an empty state shows: "Start studying to see your analytics here."

**Technical Notes:**
- Query `studySessions` table with date-range filters
- Pre-compute aggregates for performance (cache in memory during session)
- Chart uses semantic `<figure>` element with descriptive caption for accessibility

---

### Story 7.2: Completion Rate Tracking

As a learner,
I want to track my course completion rates over time,
So that I can see if I'm finishing more courses as I build better habits.

**Acceptance Criteria:**

**Given** the user has courses with varying completion states
**When** viewing the completion section on the Reports page
**Then** a line chart shows cumulative courses completed over time
**And** a summary displays: total courses, completed count, in-progress count, completion rate percentage

**Given** the user completes a course
**When** the course moves to "Completed" status
**Then** the chart updates to reflect the new completion
**And** the completion rate recalculates

---

### Story 7.3: Learning Velocity Metrics

As a learner,
I want to view learning velocity metrics showing my pace and trends,
So that I can understand if I'm accelerating or slowing down in my learning.

**Acceptance Criteria:**

**Given** the user has 2+ weeks of study data
**When** viewing the velocity section on the Reports page
**Then** the following metrics are displayed:
- Videos completed per week (trend line chart)
- Content consumed per hour (duration watched / time spent)
- Progress acceleration/deceleration (week-over-week comparison with up/down arrow)

**Given** the user's velocity is increasing
**When** viewing the trend indicator
**Then** a green TrendingUp arrow is shown with the percentage increase

**Given** the user's velocity is decreasing
**When** viewing the trend indicator
**Then** a supportive orange indicator is shown (no red/negative language)
**And** a suggestion: "Your pace has slowed. Try shorter, focused sessions."

---

### Story 7.4: Retention Insights

As a learner,
I want to see insights comparing my completed versus abandoned courses,
So that I can understand my learning patterns and improve completion rates.

**Acceptance Criteria:**

**Given** the user has courses in various states
**When** viewing the retention section on the Reports page
**Then** a donut chart or summary shows: completed, active, paused, and abandoned courses
**And** "abandoned" is defined as: > 30 days since last study with < 80% completion
**And** each category shows count and percentage

**Given** courses are identified as at-risk
**When** viewing retention insights
**Then** specific courses are listed with their last study date and completion percentage
**And** each has a "Resume" CTA to navigate to the course

---

### Story 7.5: Personalized Insights and Recommendations

As a learner,
I want to receive personalized insights and actionable recommendations based on my study patterns,
So that I can optimize my learning approach.

**Acceptance Criteria:**

**Given** the user has sufficient study data (2+ weeks)
**When** viewing the insights section on the Reports page
**Then** 3-5 personalized insights are generated based on pattern analysis, such as:
- "You complete more videos on weekday evenings — try scheduling sessions then."
- "Your average session is 45 minutes — ideal for focused learning!"
- "React Patterns is your most active course. You're 68% through — keep going!"
**And** each insight includes a relevant metric and actionable suggestion

**Given** the user has minimal data (< 1 week)
**When** viewing the insights section
**Then** a message shows: "Keep studying for a few more days to unlock personalized insights."

**Given** the user has 2+ weeks of study history and 3+ sessions for a course
**When** viewing the insights section
**Then** a completion forecast is displayed: "At your current pace (~45 min/week), you'll finish React Patterns in ~3 weeks"
**And** confidence is indicated: high (low variance), medium, or low (high variance) — low confidence cards use an amber tint
**And** extreme forecasts (1+ year out) show: "Pick up the pace to unlock a completion estimate" instead of a date
**And** the pace assumption is always visible ("At your current pace of X min/week...")

**Given** the user wants to export their study history
**When** clicking "Export Data" on the Reports page
**Then** a CSV file downloads with columns: `date`, `course_name`, `duration_minutes`, `chapters_completed`, `cumulative_minutes`, `streak_day`
**And** the filename follows: `levelup-study-data-{YYYY-MM-DD}.csv`

**Technical Notes:**

- Forecast algorithm: exponential-weighted average of weekly minutes (most recent week highest weight); coefficient of variation determines confidence tier
- Show forecast only with ≥ 2 weeks history and ≥ 3 sessions; use fuzzy language ("~3 weeks"), never an exact date
- CSV export: use `papaparse` (~7.6 KB gzipped) for RFC 4180 compliance; trigger via `URL.createObjectURL(new Blob([csv]))`
- `prefers-reduced-motion`: disable sparkline animations on insights cards; show static values instead

---

**Epic 7 Summary:** 5 stories covering 5 FRs (FR43, FR44, FR46, FR47, FR78). FR45 is covered in Epic 3 Story 3.7 (Bookmarks Page).

---

## Epic 8: AI-Powered Learning Assistant

User can leverage AI for video summaries, note-based Q&A, learning path optimization, knowledge gap identification, and cross-course concept connections.

### Story 8.1: AI Provider Configuration

As a learner,
I want to configure my AI provider and API key in Settings,
So that AI-powered features work with my preferred AI service.

**Acceptance Criteria:**

**Given** the user navigates to Settings
**When** configuring AI settings
**Then** the user can select an AI provider (OpenAI or Anthropic)
**And** enter their API key in a secure input field (masked by default, toggle to reveal)
**And** test the connection with a "Test API Key" button that shows success/failure
**And** settings are persisted in localStorage (not IndexedDB — no sensitive data in DB)

**Given** no API key is configured
**When** the user tries to use an AI feature
**Then** a prompt appears: "Set up your AI provider in Settings to use this feature"
**And** core features (video, notes, progress) continue working without AI (graceful degradation)

**Given** the API key is invalid or the service is unreachable
**When** an AI request fails
**Then** a user-friendly error message appears: "AI is temporarily unavailable. Your learning features still work."
**And** the error is logged to console: `[AI] API request failed: {error}`

**Technical Notes:**
- Vercel AI SDK v2.0.31 with @ai-sdk/openai initially
- API key stored in localStorage (never in code or IndexedDB)
- 30-second timeout with AbortController on all AI requests
- Provider switching requires zero code refactoring (just change model identifier)

---

### Story 8.2: AI Video Summaries

As a learner,
I want to request AI-generated summaries of video content,
So that I can get quick overviews of lessons without watching the full video.

**Acceptance Criteria:**

**Given** the user is viewing a video in the Lesson Player
**When** the user clicks "Generate Summary" (or uses notes from the video as context)
**Then** the AI generates a summary using the user's notes for that video as context
**And** the summary streams in real-time (SSE) showing progressive text generation
**And** the summary includes: key concepts, main takeaways, and related topics

**Given** no notes exist for the video
**When** requesting a summary
**Then** the AI generates a generic summary prompt: "Generate a study summary for [video title] from [course name]"
**And** a note is shown: "Add notes while watching for more personalized summaries."

**Given** the AI request takes longer than 30 seconds
**When** the timeout is reached
**Then** the request is cancelled via AbortController
**And** a message shows: "Summary generation timed out. Try again."

---

### Story 8.3: AI Note Q&A

As a learner,
I want to ask questions and get answers based on my own notes,
So that I can recall specific knowledge without re-watching videos or Googling.

**Acceptance Criteria:**

**Given** the user has notes across multiple courses
**When** the user types a question in the AI Q&A interface (e.g., "How do custom hooks work?")
**Then** MiniSearch retrieves the top 5 most relevant notes as context (RAG pattern)
**And** the relevant notes are sent to the AI as context with the question
**And** the AI generates an answer based on the user's own notes
**And** the response streams in real-time
**And** source notes are cited with links back to the original note and video timestamp

**Given** no relevant notes are found for the question
**When** the search returns empty context
**Then** the AI responds: "I couldn't find relevant notes for this question. Try taking notes on this topic while studying."

**Given** the user asks a follow-up question
**When** continuing the conversation
**Then** the AI maintains context from the previous Q&A exchange within the session

---

### Story 8.4: AI Learning Path Optimization

As a learner,
I want AI to suggest an optimal sequence for studying my courses,
So that I can build knowledge in the most effective order.

**Acceptance Criteria:**

**Given** the user has 3+ courses imported
**When** requesting a learning path recommendation
**Then** the AI analyzes course titles, tags, completion states, and note content
**And** suggests an optimal study sequence with reasoning (e.g., "Start with JavaScript Fundamentals before React Patterns — it builds the foundation")
**And** the recommendation is displayed as an ordered list with course cards

**Given** the user has partially completed courses
**When** the AI generates a path
**Then** it prioritizes: resume in-progress courses (highest momentum) > foundational courses > advanced courses
**And** accounts for the user's current knowledge based on completed courses

---

### Story 8.5: Knowledge Gap Identification

As a learner,
I want the AI to identify gaps in my knowledge and suggest reinforcement,
So that I can strengthen weak areas and build comprehensive understanding.

**Acceptance Criteria:**

**Given** the user has completed courses and taken notes
**When** the AI analyzes notes and completion patterns
**Then** it identifies topics mentioned in course content but absent from notes (potential gaps)
**And** suggests specific videos to re-watch or sections to review
**And** displays gaps as a prioritized list with relevance to the user's goals

**Given** a knowledge gap is identified
**When** the user clicks on a gap suggestion
**Then** the system navigates to the relevant course/video for review
**And** the gap is marked as "Addressed" once the user studies that content

---

### Story 8.6: AI Note Enhancement and Concept Connections

As a learner,
I want AI to help organize my notes and suggest connections between concepts across courses,
So that I can build a connected knowledge graph from my learning.

**Acceptance Criteria:**

**Given** the user has notes across multiple courses
**When** the user requests "Find Connections" on a note or globally
**Then** the AI analyzes note content across courses using MiniSearch similarity + AI reasoning
**And** suggests connections: "Your note on React Hooks relates to your TypeScript Generics note — both use type inference"
**And** connections are displayed as link cards with source and target notes

**Given** the user is editing a note
**When** AI note enhancement is requested
**Then** the AI suggests: improved organization (bullet points, headings), additional tags, and related concepts from other courses
**And** suggestions appear as an inline panel the user can accept or dismiss (not auto-applied)

**Given** concepts are connected
**When** the user views a note with connections
**Then** a "Related Notes" section shows linked notes from other courses
**And** clicking a related note navigates to it with context preserved

---

**Epic 8 Summary:** 6 stories covering all 6 FRs (FR48-FR53).
