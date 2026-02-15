---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7]
inputDocuments:
  - /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/docs/planning-artifacts/prd.md
  - /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/docs/planning-artifacts/ux-design-specification.md
  - /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/CLAUDE.md
  - /Volumes/SSD/Dev/Apps/Elearningplatformwireframes/README.md
workflowType: 'architecture'
project_name: 'Elearningplatformwireframes'
user_name: 'Pedro'
date: '2026-02-14'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

The platform encompasses **53 functional requirements** organized into 8 major capability areas:

1. **Course Library Management (FR1-FR6)**: Import course folders from local file system, organize by topic/subject, categorize as Active/Completed/Paused, display course metadata (video count, PDF count)

2. **Content Consumption (FR7-FR13)**: HTML5 video playback with standard controls, PDF viewing with page navigation, bookmark/resume functionality, course structure navigation, distraction-free viewing interface

3. **Progress & Session Tracking (FR14-FR19)**: Mark content as Not Started/In Progress/Completed, track completion percentage, auto-log study sessions (date, duration, content), visual progress indicators (gray/blue/green color coding)

4. **Note Management (FR20-FR27)**: Markdown-based notes linked to courses/videos, tag-based organization, full-text search, timestamp notes to exact video positions, automatic save without manual action

5. **Motivation & Gamification (FR28-FR35)**: Daily study streak counter with visual calendar, configurable reminders, streak pause mode (vacation mode), learning challenges (completion/time/streak-based), visual feedback at milestones

6. **Learning Intelligence (FR36-FR42)**: Course momentum scoring (hot/warm/cold indicators based on recency + completion + frequency), sortable by momentum, course recommendations based on study patterns, identify courses at risk of abandonment, adaptive scheduling suggestions

7. **Analytics & Reporting (FR43-FR47)**: Study time analytics (daily/weekly/monthly), completion rate tracking, learning velocity metrics, retention insights (completed vs abandoned), personalized recommendations

8. **AI-Powered Assistance (FR48-FR53)**: AI-generated video summaries, Q&A based on user's own notes, optimal learning path suggestions, knowledge gap identification, note enhancement and organization, concept connection across courses

**Non-Functional Requirements:**

**Performance (NFR1-NFR7):**
- Initial app load: < 2 seconds
- Route navigation: < 200ms (instant feel)
- Video playback start: Instant (local files)
- IndexedDB queries: < 100ms
- Note autosave: < 50ms (invisible to user)
- Bundle size: < 500KB gzipped
- Stable memory footprint (no leaks)

**Reliability (NFR8-NFR16):**
- Zero data loss for notes, progress, course metadata
- Graceful recovery from IndexedDB write failures
- Clear error messages for file system issues (moved/renamed courses)
- AI API failures degrade gracefully without blocking core functionality
- Notes autosave every 3 seconds with conflict resolution
- Atomic progress state changes

**Usability (NFR17-NFR25):**
- Zero-click resume (instant return to last position)
- Core workflows require < 3 clicks
- Video resume loads to exact position within 1 second
- Search results appear as user types (< 100ms)
- Destructive actions require confirmation
- Autosave prevents data loss
- Inline form validation

**Integration (NFR26-NFR35):**
- AI API timeout: 30 seconds with fallback
- Secure AI API key storage (environment variables)
- Support multiple AI providers (OpenAI, Anthropic)
- File System Access API with clear permissions
- Handle file system changes without crashing
- Support MP4, MKV, AVI, WEBM video formats + PDF
- Handle large files (2GB+ videos) without memory issues
- Data export in standard formats (JSON, Markdown)

**Accessibility (NFR36-NFR49):**
- WCAG 2.1 AA+ compliance
- 4.5:1 contrast ratio minimum (3:1 for large text ≥18pt)
- Full keyboard accessibility with visible focus indicators
- ARIA labels on icon-only buttons
- Semantic HTML throughout
- Video keyboard controls (Space, Arrow keys)
- Screen reader support with ARIA landmarks
- Lighthouse accessibility score: 100 target

**Security (NFR50-NFR56):**
- Sanitize Markdown to prevent XSS
- Content Security Policy headers
- AI API keys never exposed client-side
- All data remains local (no remote transmission except AI API)
- No authentication required (personal single-user tool)

**UX-Driven Technical Requirements:**

- **Zero-Friction Resume**: "Continue Learning" button must intelligently determine hot course, next unwatched video, and exact playback position
- **Side-by-Side Layout**: Video player + note editor simultaneously visible without context switching
- **Celebration Micro-Moments**: Thoughtful animations for completed videos, maintained streaks, challenge milestones
- **Visual Progress as Navigation**: Progress maps are primary interface, not hidden in analytics
- **Instant Search**: Full-text search across notes with sub-100ms response, timestamp links to video positions
- **Responsive Design**: Desktop-first (1440px+) with tablet (768px) and mobile (375px) support
- **Offline Capability**: Full offline support via IndexedDB

### Scale & Complexity

**Project Scale Assessment:**

- **Primary domain**: Full-stack web application (client-only SPA)
- **Complexity level**: Medium-High
- **Estimated architectural components**:
  - 7 major page components (Overview, Courses, Lesson Player, Library, Reports, Settings, Messages)
  - 50+ shadcn/ui components (already implemented)
  - Custom Figma components for domain-specific UI
  - IndexedDB data layer (courses, videos, notes, progress, streaks, challenges)
  - File System Access integration layer
  - AI API integration layer
  - Video/PDF player components
  - Note editor with Markdown support
  - Analytics engine (momentum scoring, recommendations)
  - Search engine (full-text across notes)

**Complexity Indicators:**

- ✅ **Real-time features**: Autosave notes (every 3 seconds), live progress updates
- ❌ **Multi-tenancy**: Not applicable (single-user personal tool)
- ❌ **Regulatory compliance**: No financial/healthcare data (WCAG AA+ accessibility only)
- ✅ **Integration complexity**: High (File System Access API, AI APIs, IndexedDB)
- ✅ **User interaction complexity**: High (video player, note editor, progress tracking, animations, search)
- ✅ **Data complexity**: Medium (courses, videos, notes, progress states, streaks, challenges, analytics)

### Technical Constraints & Dependencies

**Browser Requirements:**
- **Chrome/Edge only** - File System Access API is critical for course import and not available in Firefox/Safari
- This is an acceptable constraint for a personal tool (user can choose preferred browser)

**Existing Tech Stack (from CLAUDE.md):**
- React 18.3.1 + TypeScript
- Vite 6.3.5 (build tool)
- Tailwind CSS v4 (via @tailwindcss/vite plugin)
- React Router v7 (nested routes)
- shadcn/ui components (50+ components based on Radix UI)
- Lucide React (icons)

**Design System Constraints:**
- Background: `#FAF5EE` (warm off-white) - never hardcode
- Primary color: `blue-600` for CTAs and active states
- Spacing: 8px base grid (0.5rem multiples via Tailwind)
- Border radius: `rounded-[24px]` for cards, `rounded-xl` for buttons/inputs
- Typography: System fonts, line-height 1.5-1.7

**External Dependencies:**
- AI APIs: OpenAI or Anthropic (configurable)
- Local file system: SSD storage for course videos/PDFs
- IndexedDB: Browser-native persistence (no fallback needed)

**Development Constraints:**
- Solo developer (Pedro)
- Phased development: 6-9 months across 3 phases
- No backend infrastructure (local-first design)
- No cloud sync (single device)

### Cross-Cutting Concerns Identified

**1. Data Persistence Strategy**
- IndexedDB is the single source of truth for all application data
- Must handle: courses, videos, PDFs, notes, progress states, streaks, challenges, analytics
- Requires robust schema design for scalability (10 → 100+ courses)
- Needs indexes for fast search (full-text note search, course filtering/sorting)

**2. Performance Optimization**
- Aggressive performance targets (sub-200ms navigation, sub-100ms queries)
- Code splitting via React Router lazy loading
- Virtual scrolling for large course lists (100+ courses)
- Debounced autosave for notes (3-second window)
- Optimistic UI updates for instant feedback

**3. Accessibility Compliance (WCAG 2.1 AA+)**
- Must be baked into component architecture, not retrofitted
- Affects all interactive elements: video player, note editor, navigation, progress widgets
- Requires semantic HTML, ARIA labels, keyboard navigation, focus management
- Design review workflow with Playwright automation already established

**4. Error Resilience & Graceful Degradation**
- File system changes: Moved/renamed courses must be detected and handled
- AI API failures: Core features (video, notes, progress) must continue working
- IndexedDB failures: Clear error messaging with recovery options
- Network issues: Full offline capability required

**5. Animation & Visual Feedback System**
- Celebration micro-moments for completed videos, streaks, challenges
- Progress map animations (gray → blue → green transitions)
- Smooth transitions respecting `prefers-reduced-motion`
- Timing: 150-500ms for UI animations

**6. Responsive Design System**
- Desktop-first approach (1440px+ primary)
- Breakpoints: 640px, 1024px, 1536px (Tailwind defaults)
- Sidebar: Persistent on desktop, collapsible on mobile
- Video + notes: Side-by-side on desktop, stacked on mobile
- Dashboard widgets: Grid → List → Stack across breakpoints

**7. State Management Complexity**
- Video playback state (current position, completion status)
- Note editing state (autosave, sync with IndexedDB)
- Progress tracking state (course completion %, momentum scores)
- Streak tracking state (calendar, counter, pause mode)
- Challenge state (active challenges, progress tracking)
- UI state (sidebar collapsed, active route, search filters)

**8. Security & Privacy**
- All data local (no server transmission except AI API calls)
- Markdown sanitization to prevent XSS
- AI API key management (environment variables, never client-side exposure)
- Content Security Policy for script injection prevention

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack web application (client-only SPA)** based on project requirements for local-first personal learning platform.

### Project Foundation Status

**Brownfield Project**: This project already has an established technical foundation, initialized from Figma wireframes and currently implemented as a React + Vite application.

**Project Origin:**
- Exported from Figma design: [E-learning platform wireframes](https://www.figma.com/design/q4x6ttJD11avObQNFoeQ2D/E-learning-platform-wireframes)
- Current implementation serves as UI wireframe/prototype
- Architecture decisions needed to evolve from wireframe to full application

### Existing Technical Foundation

**Core Stack (Already Established):**

**Build Tooling:**
- **Vite 6.3.5**: Lightning-fast dev server with HMR, optimized production builds
- **TypeScript**: Strict type checking, enhanced IDE support
- **ES6+ Module System**: Modern JavaScript with tree-shaking

**Frontend Framework:**
- **React 18.3.1**: Component-based UI with concurrent features
- **React Router v7**: Nested routing with data loading capabilities
- **TypeScript Configuration**: Strict mode enabled for type safety

**Styling Solution:**
- **Tailwind CSS v4**: Utility-first CSS via @tailwindcss/vite plugin
- **CSS Variables (OKLCH)**: Custom theme system for light/dark mode support
- **Design Tokens**: Defined in theme.css (#FAF5EE background, blue-600 primary, 8px grid)

**UI Component Library:**
- **shadcn/ui (50+ components)**: Production-ready components built on Radix UI primitives
- **Radix UI**: Accessible, unstyled component primitives (headless UI)
- **class-variance-authority**: Type-safe component variants
- **Lucide React**: Icon library (optimized SVGs)

**Development Experience:**
- **Hot Module Replacement**: Instant updates during development
- **TypeScript IntelliSense**: Full IDE autocomplete and type checking
- **Design Review Workflow**: Automated Playwright testing for accessibility/responsiveness

### Architectural Decisions Already Made

**✅ Language & Runtime:**
- TypeScript for type safety and developer experience
- Modern ES6+ features with Vite bundling
- No polyfills needed (Chrome/Edge target browsers)

**✅ Styling Solution:**
- Tailwind CSS v4 for utility-first styling
- No CSS-in-JS overhead (native CSS with utilities)
- Design system via CSS custom properties
- 8px spacing grid enforced via Tailwind scale

**✅ Build Tooling:**
- Vite for development and production builds
- Code splitting via dynamic imports
- Asset optimization (images, fonts) built-in
- Environment variable management via .env files

**✅ Component Architecture:**
- Functional components with hooks (React 18.3.1)
- shadcn/ui patterns: composition over configuration
- Accessible by default (Radix UI primitives)
- Variant-based styling (class-variance-authority)

**✅ Routing Strategy:**
- React Router v7 with nested routes
- Client-side routing (no SSR needed for local-first app)
- Layout-based route organization
- Code splitting per route via lazy loading

**✅ Development Workflow:**
- npm as package manager
- Vite dev server on localhost:5173
- TypeScript compilation via Vite
- Design review via Playwright automation

### Architectural Gaps to Address

**Decisions Still Needed:**

**🔲 State Management:**
- React Context vs Zustand vs Jotai vs other solution
- Global state for: courses, notes, progress, streaks, challenges
- Optimistic updates strategy for instant UI feedback

**🔲 Data Persistence Layer:**
- IndexedDB abstraction library (Dexie.js, idb, custom wrapper)
- Schema design for courses, videos, notes, progress, analytics
- Migration strategy for schema evolution
- Backup/export functionality

**🔲 File System Integration:**
- File System Access API implementation
- Permission handling and persistence
- Error recovery for moved/renamed files
- File metadata extraction (video duration, PDF page count)

**🔲 Video/PDF Players:**
- Video player library selection (native HTML5, react-player, custom)
- PDF viewer library (react-pdf, pdfjs, custom)
- Playback state management (current position, buffering)
- Keyboard shortcuts and accessibility

**🔲 Note Editor:**
- Markdown editor library (react-markdown-editor-lite, custom)
- Markdown rendering (react-markdown, marked + sanitize)
- Autosave implementation (debounced, optimistic)
- Timestamp linking to video positions

**🔲 Search Engine:**
- Full-text search implementation (Lunr.js, Fuse.js, custom IndexedDB queries)
- Indexing strategy for notes and course metadata
- Sub-100ms search performance optimization
- Search result ranking algorithm

**🔲 AI Integration:**
- AI SDK selection (OpenAI SDK, Anthropic SDK, Vercel AI SDK)
- API key management and secure storage
- Streaming response handling for summaries
- Error handling and graceful degradation

**🔲 Analytics Engine:**
- Course momentum scoring algorithm implementation
- Study time tracking and aggregation
- Learning velocity calculations
- Recommendation algorithm for next courses

**🔲 Animation System:**
- Animation library (Framer Motion, React Spring, CSS animations)
- Celebration micro-moments design
- Progress map transitions (gray → blue → green)
- Respect for prefers-reduced-motion

**🔲 Testing Strategy:**
- Unit testing framework (Vitest recommended with Vite)
- Component testing approach
- Integration testing for IndexedDB operations
- E2E testing via existing Playwright setup

### Rationale for Current Foundation

**Why This Stack Works:**

1. **Vite + React**: Proven combination for fast development and optimized production builds
2. **TypeScript**: Essential for large codebase with complex state management
3. **Tailwind CSS v4**: Matches design system requirements, performance-optimized
4. **shadcn/ui**: Provides accessible, customizable components that align with WCAG 2.1 AA+ requirements
5. **React Router v7**: Supports code splitting and nested layouts needed for dashboard structure

**Alignment with Requirements:**

- ✅ **Performance**: Vite ensures fast builds, code splitting meets sub-2s load time
- ✅ **Accessibility**: Radix UI primitives + Tailwind provide WCAG AA+ foundation
- ✅ **Responsive**: Tailwind breakpoints match UX requirements (640px, 1024px, 1536px)
- ✅ **Offline**: Client-only SPA enables full offline capability
- ✅ **Browser Target**: Chrome/Edge alignment for File System Access API

### Next Steps in Architecture

With the foundation established, the remaining architectural decisions focus on:

1. **Data Layer Architecture** (IndexedDB schema, state management)
2. **Feature-Specific Libraries** (video player, PDF viewer, markdown editor, search)
3. **Integration Patterns** (File System API, AI APIs)
4. **Performance Optimization** (code splitting, virtual scrolling, autosave debouncing)
5. **Testing Strategy** (unit, integration, E2E)

These decisions will be addressed in the following architectural decision sections.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- State Management (Zustand) - Required for all interactive features
- Data Persistence (Dexie.js) - Foundation for offline-first architecture
- File System Integration - Core import functionality
- Video/PDF Players - Primary content consumption

**Important Decisions (Shape Architecture):**
- AI Integration (Vercel AI SDK) - Learning intelligence features
- Note Editor (Markdown) - Note-taking workflow
- Search Engine (MiniSearch) - Content discovery
- Animation System (Framer Motion) - UX polish and celebration moments

**Performance Optimizations:**
- Testing Strategy (Vitest + Playwright) - Quality assurance
- Analytics Engine (Custom algorithms) - Insights and recommendations

### Data Architecture

#### State Management: Zustand v5.0.11

**Decision:** Use Zustand for global state management across courses, notes, progress, streaks, and challenges.

**Rationale:**
- 70-90% fewer re-renders compared to React Context via selector-based subscriptions
- Minimal boilerplate (no providers, actions, reducers)
- Perfect for intermediate developers (simple API, easy to debug)
- Zustand + Dexie.js pattern: Zustand for UI state, Dexie.js for persistence
- Supports optimistic updates pattern (update UI immediately, sync to IndexedDB async)

**Bundle Size:** ~1 KB gzipped

**Key Features:**
- Selector-based subscriptions prevent unnecessary re-renders
- Middleware support (persist, devtools, immer)
- Slice pattern for organizing stores by domain
- TypeScript-first with excellent type inference

**Implementation Pattern:**
```typescript
// Video player store with selective subscriptions
const useVideoStore = create<VideoPlayerState>((set) => ({
  playing: false,
  volume: 1,
  playbackRate: 1,
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  setPlaybackRate: (rate) => set({ playbackRate: rate })
}))

// Component only re-renders when 'playing' changes
const PlayButton = () => {
  const playing = useVideoStore((state) => state.playing)
  const togglePlay = useVideoStore((state) => state.togglePlay)
  return <button onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
}
```

**Affects:** All UI components with shared state (courses, notes, video player, progress tracking)

---

#### Data Persistence: Dexie.js v4.3.0

**Decision:** Use Dexie.js as IndexedDB abstraction layer for all local data persistence.

**Rationale:**
- Complex schema requirements (courses, videos, notes, progress, analytics) need robust abstraction
- `liveQuery()` for reactive UI updates (auto-refresh when data changes)
- Schema versioning and migrations built-in
- Compound indexes for fast queries (sub-100ms requirement)
- Bulk operations for course import performance
- Better DX than raw IndexedDB or idb wrapper

**Bundle Size:** ~30 KB gzipped

**Key Features:**
- Reactive queries via `liveQuery()` (auto-update UI on data changes)
- Transaction support for atomic operations (progress + streak updates)
- Full-text search support via compound indexes
- Schema migrations for version upgrades
- TypeScript support with type-safe queries

**Schema Design:**
```typescript
const db = new Dexie('ElearningDB')

db.version(1).stores({
  courses: '++id, name, importedAt, *tags',
  videos: '++id, courseId, filename, duration, completionStatus',
  pdfs: '++id, courseId, filename, pageCount',
  notes: 'id, courseId, &videoId, *tags, createdAt, updatedAt',
  progress: '++id, courseId, videoId, currentTime, completionPercentage',
  streaks: '++id, date, minutesStudied',
  studySessions: '++id, courseId, startTime, endTime, duration',
  courseMomentum: 'courseId, score, category, lastStudied',
  bookmarks: 'id, courseId, lessonId, createdAt'
})
// Note: `notes` and `bookmarks` tables use manual ID (crypto.randomUUID())
// per Architecture convention. All other tables use ++id (auto-increment).
```

**Performance Optimizations:**
- Compound indexes for common queries: `[courseId+completionStatus]`, `[date+courseId]`
- Bulk import using `bulkAdd()` for course scanning (10x faster than individual adds)
- `liveQuery()` debounced to prevent excessive re-renders

**Affects:** All data-driven features (courses, notes, progress, analytics, search)

---

### Video & Content Players

#### Video Player: react-player v3.4.0 with Custom Controls

**Decision:** Use react-player with fully custom controls overlay for video playback.

**Rationale:**
- User explicitly requested react-player over native HTML5 (more features, better cross-format support)
- Custom controls required for e-learning specific features (timestamp to notes, playback speed 0.5x-2x, WebVTT captions)
- Supports MP4, MKV, AVI, WEBM formats via single component
- Keyboard accessibility built into custom controls (Space, Arrow keys, T for timestamp, C for captions)

**Bundle Size:** ~80 KB gzipped

**Custom Controls Features:**
- Play/pause toggle (Space key)
- Progress bar with scrubbing (Arrow keys ±5s, Shift+Arrow ±10s)
- Playback speed selector (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x) - scientifically proven to improve learning outcomes
- Volume control with mute (M key)
- Fullscreen toggle (F key)
- **Timestamp to notes button** (T key) - inserts `[MM:SS](video://id#t=seconds)` into note editor
- **Completion indicator** - auto-mark as complete at 95% watched
- **WebVTT caption support** - toggle (C key), language selection, font size (14pt-20pt)
- WCAG AA+ compliant (4.5:1 contrast, keyboard navigable, visible focus indicators)

**WebVTT Captions Integration:**
```typescript
<ReactPlayer
  url={videoBlobUrl}
  controls={false}
  config={{
    file: {
      tracks: [
        {
          kind: 'subtitles',
          src: captionBlobUrl,
          srcLang: 'en',
          label: 'English',
          default: true
        }
      ]
    }
  }}
/>
```

**Affects:** Lesson Player page, video playback state management, progress tracking

---

#### PDF Viewer: react-pdf v10.3.0

**Decision:** Use react-pdf (Mozilla PDF.js wrapper) for PDF document viewing.

**Rationale:**
- Industry standard (Mozilla PDF.js) with React wrapper
- Page navigation with thumbnail sidebar
- Handles large PDFs efficiently (lazy loading pages)
- Extracts page count for course metadata
- Keyboard navigation (Page Up/Down, Home/End)

**Bundle Size:** ~300 KB gzipped (largest single dependency, justified by core functionality)

**Key Features:**
- Progressive loading (render pages as user scrolls)
- Text selection and search within PDFs
- Zoom controls (fit-width, fit-page, custom %)
- Bookmark current page (persist to IndexedDB)
- Page count extraction for course library metadata

**Affects:** Lesson Player page (PDF mode), course import metadata extraction

---

### Note Management

#### Markdown Note Editor: @uiw/react-md-editor + react-markdown

**Decision:** Use @uiw/react-md-editor for editing with react-markdown + rehype-sanitize for rendering.

**Rationale:**
- Lightweight (4.6 KB vs 851 KB for MDXEditor)
- Side-by-side editor/preview (matches UX spec)
- 3-second debounced autosave (NFR: autosave every 3 seconds)
- **XSS prevention via rehype-sanitize** (CRITICAL security requirement)
- Custom timestamp link format: `[2:34](video://lesson-01#t=154)` renders as clickable link that seeks video
- Tag-based organization via dedicated tag management UI
- Toolbar with common formatting (bold, italic, lists, code blocks, links)

**Bundle Size:** ~28 KB total (~4.6 KB editor + ~10 KB react-markdown + ~10 KB rehype-sanitize + ~3 KB dependencies)

**Security-First Implementation:**
```typescript
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

// CRITICAL: Always sanitize to prevent XSS
// rehype-sanitize must be configured with a custom schema that adds `video` to the allowed protocols:
// { ...defaultSchema, protocols: { ...defaultSchema.protocols, href: [...defaultSchema.protocols.href, 'video'] } }
// This allows `video://{videoId}#t={seconds}` timestamp links in note markdown to survive sanitization.
<ReactMarkdown rehypePlugins={[[rehypeSanitize, customSchema]]}>
  {markdown}
</ReactMarkdown>
```

**Custom Features:**
- **Timestamp links:** Custom renderer for `video://` protocol links
- **Tag management:** Explicit tag management UI (supersedes automatic hashtag extraction per Epic 3, Story 3.5). Tags are managed through dedicated input, not extracted from markdown content.
- **Autosave:** 3-second debounce with 10-second max wait (force save after 10s)
- **Optimistic updates:** Update Zustand immediately, sync to Dexie.js async

**Autosave Pattern:**
```typescript
const debouncedSave = useDebouncedCallback(
  async (content: string) => {
    await saveNote(noteId, content) // Dexie.js
  },
  3000, // 3 second debounce
  { maxWait: 10000 } // Force save after 10s max
)
```

**Affects:** Lesson Player note editor, note search/tagging, timestamp linking

---

### Full-Text Search

#### Search Engine: MiniSearch

**Decision:** Use MiniSearch for full-text search across notes and course metadata.

**Rationale:**
- Sub-millisecond search performance (meets <100ms requirement with 150ms debounce = ~150ms total)
- 50% smaller index than Lunr.js or Fuse.js alternatives
- Zero runtime dependencies (lightweight, no bloat)
- Fuzzy search (typo tolerance) + prefix search (autocomplete)
- Field boosting for relevance ranking (tags 2x, courseName 1.5x, content 1x)
- Incremental index updates (add/update/delete documents without full rebuild)
- Index rebuilt from IndexedDB on each app load (not persisted)

**Bundle Size:** ~9 KB gzipped

**Search Configuration:**
```typescript
const searchIndex = new MiniSearch({
  fields: ['content', 'tags', 'courseName', 'videoTitle'],
  storeFields: ['id', 'courseId', 'videoId', 'courseName', 'videoTitle', 'tags', 'updatedAt'],
  searchOptions: {
    boost: {
      tags: 2,        // Tags 2x more important
      courseName: 1.5, // Course name 1.5x
      content: 1      // Content baseline
    },
    fuzzy: 0.2,       // Allow typos (20% edit distance)
    prefix: true,     // Support autocomplete (search "java" finds "javascript")
    combineWith: 'AND' // All terms must match
  }
})
```

**Performance Optimization:**
- 150ms debounce on search input (prevents search-on-every-keystroke overload)
- Sub-1ms search execution after debounce
- Limit results to top 20 (pagination if needed)
- MiniSearch index is rebuilt from IndexedDB on each app load (not persisted). Rebuild budget: <2 seconds for 500 notes.

**Affects:** Global search bar, note discovery, course filtering

---

### AI Integration

#### AI SDK: Vercel AI SDK v2.0.31 with @ai-sdk/openai

**Decision:** Use Vercel AI SDK with OpenAI provider for AI-powered learning features.

**Rationale:**
- **Future-proof:** Start with OpenAI (~19.5 KB), easily add Anthropic later without refactoring
- **NFR alignment:** Requirements explicitly mention "Support multiple AI providers (OpenAI, Anthropic)"
- **Unified API:** Same code works with any provider (switch by changing model identifier only)
- **Streaming built-in:** SSE streaming for video summaries (better UX than waiting for full response)
- **Simpler for intermediate developers:** Less boilerplate than direct OpenAI SDK
- **Active development:** Published 7 hours ago (AI SDK 6 with agent abstractions)

**Bundle Size:** ~19.5 KB gzipped (@ai-sdk/openai provider only)

**AI Features:**
- **Video summaries:** Stream AI-generated summaries of video transcripts
- **Q&A on notes:** RAG pattern using MiniSearch for context retrieval + AI for answers
- **Learning path suggestions:** Analyze study patterns, recommend next courses
- **Knowledge gap identification:** Compare notes across courses, suggest missing concepts
- **Note enhancement:** Suggest tags, organize bullet points, connect concepts

**Security & Privacy:**
- API keys in `.env` file, NEVER exposed client-side
- Client calls edge function/API route (not direct client → OpenAI)
- 30-second timeout with AbortController (NFR requirement)
- Graceful degradation: Core features (video, notes, progress) work if AI unavailable

**Provider Switching Example:**
```typescript
// Start with OpenAI
import { openai } from '@ai-sdk/openai'
const model = openai('gpt-4-turbo')

// Switch to Claude later (zero refactoring)
import { anthropic } from '@ai-sdk/anthropic'
const model = anthropic('claude-3-5-sonnet-20241022')
```

**Affects:** AI-powered features (video summaries, Q&A, recommendations, knowledge gaps)

---

### Animation & Visual Feedback

#### Animation System: Framer Motion v12.34.0 with LazyMotion

**Decision:** Use Framer Motion with LazyMotion for code-split animations.

**Rationale:**
- **Built for celebration micro-moments:** Complex sequences (scale + rotate + opacity) for completed videos, streaks, challenges
- **Bundle optimization:** LazyMotion splits bundle (4.6 KB initial + 15 KB async loaded = 19.6 KB total)
- **Accessibility-first:** Automatic `prefers-reduced-motion` support (WCAG requirement)
- **Developer experience:** Declarative variants easier than CSS keyframes for orchestration
- **Layout animations:** Progress map transitions (gray → blue → green) work out of the box

**Bundle Size:** ~19.6 KB gzipped (4.6 KB initial + 15 KB domAnimation features loaded async)

**Use Cases:**
- **Celebration micro-moments:** Completed video checkmark (scale bounce), streak counter pulse, challenge milestone confetti
- **Progress map transitions:** Color changes (gray → blue → green) with smooth 300ms transition
- **Page transitions:** Fade in/out between routes (150ms duration)
- **Hover states:** Scale 1.05 on course cards (200ms spring)
- **Loading states:** Skeleton shimmer animations

**Accessibility Implementation:**
```typescript
import { MotionConfig } from 'framer-motion'

// Automatically respects prefers-reduced-motion
<MotionConfig reducedMotion="user">
  {/* All animations inside disable transforms for users who prefer reduced motion */}
  {/* Opacity and color animations still work (subtle, accessible) */}
</MotionConfig>
```

**Hybrid Strategy:** Use CSS for simple transitions (hover states, page navigation) + Framer Motion for complex celebrations (reduces bundle usage)

**Affects:** Celebration moments, progress visualizations, page transitions, micro-interactions

---

### Testing Strategy

#### Test Stack: Vitest v4.0.18 + React Testing Library v16.3.2 + fake-indexeddb + Playwright

**Decision:** Use comprehensive testing stack with Vitest for unit/component/integration tests and Playwright for E2E.

**Rationale:**
- **Vitest:** Native Vite integration (shares config, transforms, plugins), Jest-compatible API, fast execution
- **React Testing Library:** Industry standard, accessibility-first queries, encourages best practices
- **fake-indexeddb:** Essential for testing Dexie.js operations without browser overhead
- **Playwright:** Already configured for design review, extend for full user flow testing

**Bundle Impact:** 0 KB (all dev dependencies)

**Test Coverage:**

**Unit Tests (Vitest):**
- Zustand stores (course state, video player state, note editor state)
- Analytics algorithms (momentum scoring, learning velocity)
- Search indexing logic (MiniSearch integration)
- Utility functions (timestamp parsing, duration formatting)
- **Coverage goal:** 80%+ for stores, utilities, algorithms

**Component Tests (Vitest + React Testing Library):**
- VideoPlayer component (play/pause, captions, playback speed)
- NoteEditor component (autosave, timestamp links, Markdown preview)
- ProgressMap component (color transitions, completion indicators)
- CourseCard component (metadata display, momentum indicators)
- **Coverage goal:** All interactive components tested

**Integration Tests (Vitest + fake-indexeddb):**
- Dexie.js CRUD operations (courses, videos, notes, progress)
- Full-text search indexing (MiniSearch + IndexedDB)
- Progress tracking (completion status, streak counting)
- Data migrations (schema version upgrades)
- **Coverage goal:** All IndexedDB operations covered

**E2E Tests (Playwright):**
- Complete user flows (import course → watch video → take notes → mark complete)
- File System Access API integration
- Video/PDF playback functionality
- Design review (accessibility, responsiveness) ✅ Already configured
- **Coverage goal:** Critical user flows (import, consume, track progress)

**Test Commands:**
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:e2e": "playwright test",
  "test:design": "playwright test tests/design-review.spec.ts"
}
```

**Affects:** All features (quality assurance, regression prevention, refactoring confidence)

---

### Analytics & Intelligence

#### Analytics Engine: Custom TypeScript Algorithms

**Decision:** Implement custom analytics algorithms using TypeScript + Zustand + Dexie.js.

**Rationale:**
- No suitable library exists for e-learning specific metrics (momentum scoring, learning velocity)
- Custom implementation provides full control over formulas and data structures
- Zero bundle overhead (TypeScript compiles to JavaScript, no runtime library)
- Optimized for performance (<100ms queries via Dexie.js indexes)

**Bundle Impact:** 0 KB (custom TypeScript code, no libraries)

**Key Algorithms:**

**Course Momentum Scoring:**
```typescript
// Hot/Warm/Cold indicators (FR36-FR37)
function calculateMomentumScore(course: Course): MomentumScore {
  const recencyScore = 100 * Math.exp(-daysSinceLastStudy / 7) // Exponential decay
  const completionScore = course.completionPercentage
  const frequencyScore = Math.min(100, (weeklySessionCount / 4) * 100)

  // Weighted: 40% recency, 30% completion, 30% frequency
  const totalScore = recencyScore * 0.4 + completionScore * 0.3 + frequencyScore * 0.3

  return {
    score: totalScore,
    category: totalScore >= 70 ? 'hot' : totalScore >= 40 ? 'warm' : 'cold'
  }
}
```

**Study Time Analytics:**
- Auto-log study sessions (video watch time, PDF view time, note editing time)
- Aggregate daily/weekly/monthly (pre-computed at midnight via Web Worker)
- Track time per course, per video, total study time
- Session duration tracking with pause detection

**Learning Velocity:**
- Completion rate over time (videos completed per week)
- Content consumed per hour (duration watched / time spent)
- Progress acceleration/deceleration trends (compare week-over-week)

**Recommendation Algorithm:**
- **Strategy 1:** Suggest hot courses to maintain momentum (completion% 40-80%, last studied <7 days)
- **Strategy 2:** Revive cold courses at risk of abandonment (completion% 10-80%, last studied >14 days)
- **Strategy 3:** Suggest related courses via MiniSearch similarity (topic/keyword matching)

**Performance Optimization:**
- Momentum scores cached in IndexedDB, recalculated only on session end (debounced 5s)
- Daily stats pre-computed at midnight (Web Worker background task)
- Dexie.js indexes on `startTime`, `courseId`, `date` for fast queries (<100ms)

**Affects:** Reports page (analytics dashboard), course recommendations, momentum indicators

---

### File System Integration

#### File System Access: Native Browser API

**Decision:** Use native File System Access API for course folder import and file access.

**Rationale:**
- Native browser API (zero bundle cost)
- Fully supported in Chrome 131+ and Edge 128+ (target browsers)
- Persist FileSystemHandles in IndexedDB for repeated access
- Extract video metadata (duration) via native HTML5 video element
- Extract PDF metadata (page count) via PDF.js (already using for react-pdf)

**Bundle Impact:** 0 KB (native browser API)

**Browser Support:**
- ✅ Chrome 131+ (fully supported)
- ✅ Edge 128+ (fully supported)
- ✅ Chrome 86-130 / Edge 86-127 (partially supported)
- ❌ Firefox/Safari (not supported - acceptable for Chrome/Edge-only app)

**Key Features:**

**Directory Import:**
- `showDirectoryPicker()` to select course folder
- Request read permission (persistent across sessions)
- Store FileSystemDirectoryHandle in IndexedDB
- Scan directory for MP4/MKV/AVI/WEBM videos + PDFs

**Permission Handling:**
- Query permission status: `queryPermission({ mode: 'read' })`
- Re-request on app load if status is 'prompt'
- Handle 'denied' status: Show UI prompt to re-import
- Persist handles survive browser restart (if permission granted)

**Error Recovery:**
- Detect moved/deleted files via `NotFoundError`
- Show "Re-import course?" prompt
- Attempt to relocate files by matching filename + size
- Mark videos as 'missing' until found

**Video Metadata Extraction (Native HTML5):**
```typescript
async function extractVideoMetadata(fileHandle: FileSystemFileHandle): Promise<VideoMetadata> {
  const file = await fileHandle.getFile()
  const blobUrl = URL.createObjectURL(file)

  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'

    video.addEventListener('loadedmetadata', () => {
      resolve({
        duration: video.duration, // seconds
        width: video.videoWidth,
        height: video.videoHeight
      })
      URL.revokeObjectURL(blobUrl)
      video.remove()
    })

    video.src = blobUrl
  })
}
```

**PDF Metadata Extraction (PDF.js):**
```typescript
async function extractPdfMetadata(fileHandle: FileSystemFileHandle): Promise<PdfMetadata> {
  const file = await fileHandle.getFile()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  return {
    pageCount: pdf.numPages, // Fast (metadata only, no rendering)
    fileSize: file.size
  }
}
```

**Affects:** Course import workflow, file access for video/PDF playback, metadata extraction

---

### Decision Impact Analysis

**Implementation Sequence:**
1. **Foundation (Phase 1 - First 2 months):**
   - Dexie.js schema design and migration system
   - Zustand store architecture (slice pattern)
   - File System Access API integration + course import
   - Video/PDF metadata extraction

2. **Core Features (Phase 2 - Months 3-5):**
   - react-player with custom controls + WebVTT captions
   - react-pdf viewer with navigation
   - Markdown note editor with autosave + timestamp links
   - MiniSearch full-text search indexing

3. **Intelligence & Polish (Phase 3 - Months 6-9):**
   - Vercel AI SDK integration (video summaries, Q&A)
   - Custom analytics algorithms (momentum scoring, recommendations)
   - Framer Motion animations (celebration micro-moments)
   - Comprehensive test suite (Vitest + Playwright)

**Cross-Component Dependencies:**
- **Video Player → Note Editor:** Timestamp link insertion requires shared video position state (Zustand)
- **File System → Dexie.js:** FileSystemHandles stored in IndexedDB for persistent access
- **MiniSearch → Dexie.js:** Search index updated on note create/update/delete
- **Analytics → All Features:** Session tracking monitors video player, PDF viewer, note editor
- **Framer Motion → Progress Tracking:** Celebration animations triggered on completion events
- **AI SDK → MiniSearch:** Q&A feature uses search to retrieve relevant note context

**Performance Budget Status:**
- **Target:** <500 KB gzipped
- **Actual:** ~487 KB gzipped (97% of budget)
- **Remaining:** ~13 KB headroom for minor additions

**Bundle Breakdown:**
- react-pdf: 300 KB (60% of total - largest dependency, justified by core functionality)
- react-player: 80 KB (16%)
- Dexie.js: 30 KB (6%)
- @uiw/react-md-editor + react-markdown: 28 KB (6%)
- Framer Motion (LazyMotion): 19.6 KB (4%)
- Vercel AI SDK (@ai-sdk/openai): 19.5 KB (4%)
- MiniSearch: 9 KB (2%)
- Zustand: 1 KB (<1%)
- **Total:** ~487 KB / 500 KB target ✅

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 37 areas where AI agents could make different choices

### Naming Patterns

#### Component & File Naming

**Components:**
- **Rule:** PascalCase for React component files and component names
- **Examples:** `VideoPlayer.tsx`, `CourseCard.tsx`, `NoteEditor.tsx`, `StudyStreakCalendar.tsx`
- **Rationale:** Matches existing codebase pattern (all 70+ components use PascalCase)

**Utility Files:**
- **Rule:** camelCase for utility/library files
- **Examples:** `progress.ts`, `studyLog.ts`, `journal.ts`, `settings.ts`, `api.ts`
- **Rationale:** Distinguishes utilities from components at a glance

**Test Files:**
- **Rule:** `[filename].test.ts` pattern, co-located in `__tests__/` directories
- **Examples:** `src/lib/__tests__/progress.test.ts`, `src/lib/__tests__/journal.test.ts`
- **Rationale:** Vitest convention, existing pattern in codebase

**Type Definition Files:**
- **Rule:** Centralized in `src/data/types.ts`, use PascalCase for type names
- **Examples:** `Course`, `Module`, `Lesson`, `Note`, `CourseProgress`
- **Rationale:** Single source of truth for shared types prevents duplication

---

#### Function & Variable Naming

**Functions:**
- **Rule:** camelCase with verb-noun pattern
- **Examples:** `getAllProgress()`, `saveNote()`, `markLessonComplete()`, `extractTagsFromContent()`
- **Good:** `calculateMomentumScore()`, `getCourseCompletionPercent()`
- **Bad:** `ProgressGet()`, `note_save()`, `LessonComplete()`

**Variables:**
- **Rule:** camelCase with descriptive noun/noun-phrase
- **Examples:** `completedLessons`, `totalLessons`, `lastAccessedAt`, `videoTimestamp`
- **Boolean variables:** Prefix with `is`, `has`, `should`, `can`
  - **Examples:** `isLessonComplete`, `hasCompletedCourse`, `shouldAutoplay`, `canAccessLesson`

**Constants:**
- **Rule:** SCREAMING_SNAKE_CASE for true constants (never change at runtime)
- **Examples:** `STORAGE_KEY`, `MINUTES_PER_LESSON`, `CURRENT_MIGRATION_VERSION`, `COURSES_ROOT`
- **Rationale:** Existing pattern in codebase, clearly distinguishes constants

---

#### TypeScript Type Naming

**Interfaces:**
- **Rule:** PascalCase, descriptive noun
- **Examples:** `CourseProgress`, `Note`, `Resource`, `CaptionTrack`, `VideoMetadata`
- **No `I` prefix:** Use `CourseProgress`, NOT `ICourseProgress`

**Type Aliases:**
- **Rule:** PascalCase for union/intersection types
- **Examples:** `CourseCategory`, `Difficulty`, `ResourceType`
- **When to use:** Prefer `type` for unions/primitives, `interface` for object shapes

**Generics:**
- **Rule:** Single uppercase letter for simple generics, descriptive PascalCase for complex
- **Examples:** `T`, `K`, `V` for simple generics; `TData`, `TError`, `TContext` for React Query

---

#### Zustand Store Naming

**Store Names:**
- **Rule:** `use[Domain]Store` pattern
- **Examples:** `useVideoPlayerStore`, `useCourseStore`, `useNoteStore`, `useProgressStore`, `useStreakStore`
- **Bad:** `useVideo()`, `usePlayerState()`, `videoStore()`

**Store Actions:**
- **Rule:** Verb-based, camelCase
- **Examples:** `togglePlay()`, `setPlaybackRate()`, `updateProgress()`, `markComplete()`

**Store State Fields:**
- **Rule:** camelCase nouns
- **Examples:** `playing`, `volume`, `playbackRate`, `currentCourse`, `selectedLesson`

---

#### Dexie.js Database Naming

**Database Name:**
- **Rule:** Single PascalCase name ending in `DB`
- **Example:** `ElearningDB`

**Table Names:**
- **Rule:** Lowercase plural nouns
- **Examples:** `courses`, `videos`, `pdfs`, `notes`, `progress`, `streaks`, `studySessions`, `courseMomentum`
- **Rationale:** Matches SQL convention, existing schema uses lowercase

**Field Names:**
- **Rule:** camelCase
- **Examples:** `courseId`, `videoId`, `completionStatus`, `lastStudied`, `createdAt`, `pageCount`

**Index Names:**
- **Rule:** Auto-generated by Dexie.js from field syntax
- **Compound indexes:** `[field1+field2]` → `field1_field2` index
- **Multi-entry indexes:** `*tags` → tags index

---

### Structure Patterns

#### Project Organization

**Component Directory Structure:**
```
src/app/components/
  ├── ui/                  # shadcn/ui components (50+ components)
  ├── figma/              # Custom Figma-exported components
  ├── navigation/         # Navigation components (BottomNav, etc.)
  ├── charts/             # Chart/visualization components
  ├── celebrations/       # Celebration/achievement components
  ├── notes/              # Note-taking components
  ├── examples/           # Example/demo components
  ├── [Feature].tsx       # Top-level feature components
  └── Layout.tsx          # Main layout wrapper
```

**Rule:** Organize components by type/feature, NOT by page
- **Good:** `src/app/components/charts/ProgressChart.tsx`
- **Bad:** `src/app/pages/overview/ProgressChart.tsx`

---

**Utilities & Libraries:**
```
src/lib/
  ├── __tests__/          # Unit tests co-located with utilities
  ├── progress.ts         # Progress tracking utilities
  ├── studyLog.ts         # Study logging utilities
  ├── journal.ts          # Journal/notes utilities
  ├── settings.ts         # Settings management
  ├── api.ts              # API client (future)
  └── [feature].ts        # Feature-specific utilities
```

**Rule:** Place shared utilities in `src/lib/`, NOT scattered in components

---

**Data & Types:**
```
src/data/
  └── types.ts            # Centralized TypeScript types
```

**Rule:** ALL shared types in `src/data/types.ts`, NOT duplicated across files
- **Affects:** Prevents drift when multiple agents define similar types

---

**Pages:**
```
src/app/pages/
  ├── Overview.tsx
  ├── MyClass.tsx
  ├── Courses.tsx
  ├── CourseDetail.tsx
  ├── LessonPlayer.tsx
  ├── Library.tsx
  ├── Messages.tsx
  ├── Reports.tsx
  └── Settings.tsx
```

**Rule:** One page component per route, placed in `src/app/pages/`

---

#### Test Organization

**Unit Tests:**
- **Location:** `src/lib/__tests__/[filename].test.ts`
- **Example:** `src/lib/__tests__/progress.test.ts` tests `src/lib/progress.ts`

**Component Tests:**
- **Location:** `src/app/components/[feature]/__tests__/[Component].test.tsx`
- **Example:** `src/app/components/notes/__tests__/NoteEditor.test.tsx`

**Integration Tests:**
- **Location:** `src/__tests__/integration/[feature].test.ts`
- **Example:** `src/__tests__/integration/course-import.test.ts`

**E2E Tests:**
- **Location:** `tests/[feature].spec.ts`
- **Example:** `tests/design-review.spec.ts`, `tests/accessibility.spec.ts`

**Rule:** Tests co-located near code they test, E2E at project root

---

### Format Patterns

#### JSON & Data Formats

**Field Naming:**
- **Rule:** camelCase for all JSON fields
- **Examples:** `courseId`, `completedLessons`, `lastAccessedAt`, `videoTimestamp`
- **Never:** `course_id`, `completed-lessons`, `last_accessed_at`

**Date/Time Format:**
- **Rule:** ISO 8601 strings via `new Date().toISOString()`
- **Example:** `"2026-02-14T10:30:00.000Z"`
- **Storage:** Always store as ISO string, convert to Date when needed
- **Display:** Use `date-fns` for formatting (already in dependencies)

**Boolean Representation:**
- **Rule:** `true` / `false` (JavaScript booleans), NOT `1` / `0` or `"true"` / `"false"`

**Null vs Undefined:**
- **Rule:** Use `undefined` for optional fields, `null` for explicit absence
- **Example:** `lastWatchedLesson?: string` (can be undefined), `captionFile: string | null` (explicitly none)

**ID Generation:**
- **Rule:** `crypto.randomUUID()` for all IDs
- **Example:** `id: crypto.randomUUID()` // "550e8400-e29b-41d4-a716-446655440000"
- **Never:** Sequential integers, timestamps, or manual concatenation

---

#### localStorage Keys

**Pattern:**
- **Rule:** `kebab-case` with feature prefix
- **Examples:** `course-progress`, `study-streak`, `notes-migration-version`, `user-settings`
- **Bad:** `courseProgress`, `COURSE_PROGRESS`, `course_progress`

---

#### API Response Formats (Future)

**Success Response:**
```typescript
{
  data: T,              // Actual response data
  meta?: {              // Optional metadata
    timestamp: string,
    version: string
  }
}
```

**Error Response:**
```typescript
{
  error: {
    code: string,       // Error code (e.g., "VIDEO_NOT_FOUND")
    message: string,    // Human-readable message
    details?: unknown   // Optional additional details
  }
}
```

**Rule:** Consistent wrapper format for all API responses

---

### Communication Patterns

#### Zustand State Management

**Store Creation Pattern:**
```typescript
import { create } from 'zustand'

interface VideoPlayerState {
  playing: boolean
  volume: number
  playbackRate: number
  togglePlay: () => void
  setVolume: (volume: number) => void
  setPlaybackRate: (rate: number) => void
}

export const useVideoPlayerStore = create<VideoPlayerState>((set) => ({
  // State
  playing: false,
  volume: 1,
  playbackRate: 1,

  // Actions
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  setVolume: (volume) => set({ volume }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
}))
```

**State Update Pattern:**
- **Rule:** Use functional updates when depending on previous state
- **Good:** `set((state) => ({ count: state.count + 1 }))`
- **Bad:** `set({ count: count + 1 })` (closure may have stale value)

**Selector Pattern:**
```typescript
// Component only re-renders when 'playing' changes
const PlayButton = () => {
  const playing = useVideoPlayerStore((state) => state.playing)
  const togglePlay = useVideoPlayerStore((state) => state.togglePlay)
  return <button onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
}
```

**Rule:** Use selector-based subscriptions (NOT `const { playing } = useVideoPlayerStore()`)

---

#### Dexie.js Data Persistence

**Optimistic Update Pattern:**
```typescript
// 1. Update Zustand immediately (optimistic)
useNoteStore.getState().updateNote(noteId, content)

// 2. Persist to IndexedDB async (background)
await db.notes.update(noteId, { content, updatedAt: new Date().toISOString() })
```

**Rule:** Update UI state first, persist to IndexedDB second

**LiveQuery Pattern (Future):**
```typescript
import { useLiveQuery } from 'dexie-react-hooks'

function CourseList() {
  const courses = useLiveQuery(() => db.courses.toArray())
  // Component auto-updates when IndexedDB changes
}
```

---

#### Event Naming (Future)

**Custom Events:**
- **Rule:** `domain:action` pattern with kebab-case
- **Examples:** `course:imported`, `lesson:completed`, `note:saved`, `streak:updated`

**Event Payload:**
```typescript
{
  type: 'course:imported',
  payload: {
    courseId: string,
    timestamp: string
  }
}
```

---

### Process Patterns

#### Error Handling

**Try-Catch Pattern:**
```typescript
export function getAllProgress(): Record<string, CourseProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch (error) {
    console.error('[Progress] Error loading progress:', error)
    return {} // Safe fallback
  }
}
```

**Rules:**
- Prefix log messages with `[Domain]` for context
- ALWAYS provide safe fallback values (empty object, empty array, default state)
- Log errors to console.error (NOT console.log)
- Include enough context to debug (function name, operation)

**User-Facing Errors:**
```typescript
try {
  await importCourse(path)
} catch (error) {
  // Show user-friendly toast notification
  toast.error('Failed to import course. Please try again.')
  // Log technical details to console
  console.error('[Import] Course import failed:', error)
}
```

**Rule:** Separate user-facing messages (friendly) from developer logs (technical)

---

#### Loading States

**Pattern:**
```typescript
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<Error | null>(null)

async function handleAction() {
  setIsLoading(true)
  setError(null)
  try {
    await performAction()
  } catch (err) {
    setError(err as Error)
  } finally {
    setIsLoading(false)
  }
}
```

**Naming:**
- Loading states: `isLoading`, `isImporting`, `isSaving`
- Error states: `error`, `importError`, `saveError`

---

#### Autosave Pattern

**Debounced Autosave (3-second debounce, 10-second max wait):**
```typescript
import { useDebouncedCallback } from 'use-debounce'

const debouncedSave = useDebouncedCallback(
  async (content: string) => {
    // 1. Update Zustand (optimistic)
    useNoteStore.getState().updateNote(noteId, content)
    // 2. Persist to Dexie.js (async)
    await db.notes.update(noteId, { content, updatedAt: new Date().toISOString() })
  },
  3000,  // 3-second debounce
  { maxWait: 10000 }  // Force save after 10 seconds max
)
```

**Rule:** Use `use-debounce` library for consistency

---

#### Data Migration Pattern

**Version-Based Migration:**
```typescript
const MIGRATION_VERSION_KEY = 'notes-migration-version'
const CURRENT_MIGRATION_VERSION = 1

function migrateData(data: OldFormat): NewFormat {
  // Check version
  const version = localStorage.getItem(MIGRATION_VERSION_KEY)
  if (!version || parseInt(version) < CURRENT_MIGRATION_VERSION) {
    console.log('[Migration] Migrating data to version', CURRENT_MIGRATION_VERSION)
    const migrated = transformData(data)
    saveData(migrated)
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString())
    console.log('[Migration] Complete!')
    return migrated
  }
  return data
}
```

**Rules:**
- Always increment version number when schema changes
- Log migration start/end for debugging
- Preserve original data until migration succeeds
- Run migrations on data load, NOT on app start

---

### Enforcement Guidelines

**All AI Agents MUST:**
- Use exact naming conventions listed above (case-sensitive)
- Follow directory organization rules for new files
- Use camelCase for JSON fields in all data structures
- Implement try-catch error handling with safe fallbacks
- Use ISO 8601 date strings via `new Date().toISOString()`
- Use `crypto.randomUUID()` for ID generation
- Apply selector-based Zustand subscriptions
- Follow optimistic update pattern (Zustand first, IndexedDB second)
- Co-locate tests with source files in `__tests__/` directories
- Centralize shared types in `src/data/types.ts`

**Pattern Enforcement:**
- **Linting:** ESLint enforces naming conventions
- **TypeScript:** Type system prevents field name drift
- **Code Review:** Automated design review checks patterns
- **Documentation:** This document is the source of truth

**Pattern Violations:**
- Document violations in code review comments
- Update patterns if multiple agents independently choose different approach
- Escalate persistent conflicts to architecture review

---

### Pattern Examples

#### Good Examples

**1. Zustand Store with Selectors:**
```typescript
// ✅ Correct: Selector-based, no re-renders
const CourseCard = ({ courseId }: { courseId: string }) => {
  const course = useCourseStore((state) => state.courses.find(c => c.id === courseId))
  const updateProgress = useCourseStore((state) => state.updateProgress)
  // Only re-renders when THIS course changes
}
```

**2. Optimistic Updates with Retry:**
```typescript
// ✅ Correct: Update UI immediately, persist async with retry + rollback
async function saveNote(content: string) {
  // 1. Zustand (optimistic)
  useNoteStore.getState().updateContent(noteId, content)

  // 2. IndexedDB (background) with exponential backoff retry
  const backoffDelays = [1000, 2000, 4000] // 3 attempts: 1s, 2s, 4s
  for (let attempt = 0; attempt < backoffDelays.length; attempt++) {
    try {
      await db.notes.update(noteId, { content, updatedAt: new Date().toISOString() })
      return // Success
    } catch (error) {
      if (attempt < backoffDelays.length - 1) {
        await new Promise(r => setTimeout(r, backoffDelays[attempt]))
      } else {
        // After retry exhaustion: revert Zustand to last-persisted content
        useNoteStore.getState().updateContent(noteId, previousContent)
        toast.error('Failed to save note')
      }
    }
  }
}
```

**3. Error Handling:**
```typescript
// ✅ Correct: Try-catch with safe fallback
export function getCourses(): Course[] {
  try {
    const raw = localStorage.getItem('courses')
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    console.error('[Courses] Error loading courses:', error)
    return [] // Safe fallback
  }
}
```

---

#### Anti-Patterns

**1. Store Usage Without Selectors:**
```typescript
// ❌ Wrong: Entire component re-renders on ANY store change
const CourseCard = () => {
  const { courses, updateProgress } = useCourseStore()
  // Re-renders when unrelated courses change
}
```

**2. Non-Optimistic Updates:**
```typescript
// ❌ Wrong: UI freezes while waiting for IndexedDB
async function saveNote(content: string) {
  await db.notes.update(noteId, { content }) // Wait...
  useNoteStore.getState().updateContent(noteId, content) // Then update UI
  // User sees lag
}
```

**3. Inconsistent Naming:**
```typescript
// ❌ Wrong: Mixed conventions
interface CourseProgress {
  course_id: string,      // snake_case (wrong)
  CompletedLessons: string[], // PascalCase (wrong)
  "last-accessed": string  // kebab-case (wrong)
}
```

**4. Missing Error Handling:**
```typescript
// ❌ Wrong: No try-catch, can crash app
export function getCourses(): Course[] {
  const raw = localStorage.getItem('courses')
  return JSON.parse(raw) // Throws if invalid JSON
}
```

---

### Cross-Cutting Concerns

**TypeScript Configuration:**
- **Rule:** Strict mode enabled, no `any` types
- **Example:** Use `unknown` for truly unknown types, then type guard

**Import Paths:**
- **Rule:** Use `@/` alias for `src/` directory
- **Good:** `import { Button } from '@/app/components/ui/button'`
- **Bad:** `import { Button } from '../../../app/components/ui/button'`

**React Patterns:**
- **Rule:** Functional components with hooks (NO class components)
- **Rule:** Use TypeScript interfaces for props
- **Rule:** Export components as named exports (NOT default)

**Accessibility:**
- **Rule:** All interactive elements keyboard accessible
- **Rule:** ARIA labels on icon-only buttons
- **Rule:** Semantic HTML (button, nav, main, etc.)
- **Rule:** 4.5:1 contrast ratio minimum (WCAG AA+)

## Project Structure & Boundaries

### Complete Project Directory Structure

```
Elearningplatformwireframes/
├── README.md
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── playwright.config.ts
├── lighthouserc.js
├── vitest.config.ts
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── design-review.yml
│
├── .claude/
│   ├── skills/
│   └── workflows/
│       └── design-review/
│           ├── design-principles.md
│           └── agent-config.md
│
├── public/
│   ├── assets/              # Static images, icons
│   └── fonts/               # Custom fonts (if any)
│
├── src/
│   ├── main.tsx             # App entry point
│   ├── app/
│   │   ├── App.tsx          # Root component with RouterProvider
│   │   ├── routes.tsx       # React Router configuration
│   │   │
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── StudyStreakCalendar.tsx
│   │   │   ├── ProgressWidget.tsx
│   │   │   │
│   │   │   ├── ui/          # shadcn/ui components (50+ components)
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── tooltip.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── figma/       # Custom Figma-exported components
│   │   │   │   ├── CourseCard.tsx
│   │   │   │   ├── LessonList.tsx
│   │   │   │   ├── ModuleAccordion.tsx
│   │   │   │   ├── VideoPlayer.tsx
│   │   │   │   └── PdfViewer.tsx
│   │   │   │
│   │   │   ├── navigation/  # Navigation components
│   │   │   │   └── BottomNav.tsx
│   │   │   │
│   │   │   ├── charts/      # Chart/visualization components
│   │   │   │   └── __tests__/
│   │   │   │
│   │   │   ├── celebrations/ # Celebration/achievement components
│   │   │   │   └── __tests__/
│   │   │   │
│   │   │   ├── notes/       # Note-taking components (FUTURE)
│   │   │   │   ├── NoteEditor.tsx
│   │   │   │   ├── NoteList.tsx
│   │   │   │   ├── TimestampLink.tsx
│   │   │   │   └── __tests__/
│   │   │   │
│   │   │   └── examples/    # Example/demo components
│   │   │       └── __tests__/
│   │   │
│   │   └── pages/           # Route page components
│   │       ├── Overview.tsx
│   │       ├── MyClass.tsx
│   │       ├── Courses.tsx
│   │       ├── CourseDetail.tsx
│   │       ├── LessonPlayer.tsx
│   │       ├── Library.tsx
│   │       ├── Messages.tsx
│   │       ├── Instructors.tsx
│   │       ├── Reports.tsx
│   │       └── Settings.tsx
│   │
│   ├── stores/              # Zustand stores (FUTURE)
│   │   ├── __tests__/
│   │   ├── useCourseStore.ts
│   │   ├── useVideoPlayerStore.ts
│   │   ├── useNoteStore.ts
│   │   ├── useProgressStore.ts
│   │   └── useStreakStore.ts
│   │
│   ├── db/                  # Dexie.js database layer (FUTURE)
│   │   ├── __tests__/
│   │   ├── schema.ts        # Database schema definition
│   │   ├── migrations.ts    # Version migrations
│   │   └── index.ts         # Database instance export
│   │
│   ├── lib/                 # Utilities & libraries
│   │   ├── __tests__/
│   │   │   ├── progress.test.ts
│   │   │   ├── journal.test.ts
│   │   │   └── studyLog.test.ts
│   │   ├── progress.ts      # Progress tracking utilities
│   │   ├── studyLog.ts      # Study logging utilities
│   │   ├── journal.ts       # Journal/notes utilities
│   │   ├── settings.ts      # Settings management
│   │   ├── api.ts           # API client (FUTURE)
│   │   ├── fileSystem.ts    # File System Access API (FUTURE)
│   │   └── utils.ts         # General utilities
│   │
│   ├── search/              # MiniSearch integration (FUTURE)
│   │   ├── __tests__/
│   │   ├── index.ts         # Search index configuration
│   │   └── indexing.ts      # Document indexing logic
│   │
│   ├── ai/                  # AI integration (FUTURE)
│   │   ├── __tests__/
│   │   ├── client.ts        # Vercel AI SDK client
│   │   ├── summaries.ts     # Video summary generation
│   │   ├── qa.ts            # Q&A on notes
│   │   └── recommendations.ts # Learning path suggestions
│   │
│   ├── analytics/           # Analytics engine (FUTURE)
│   │   ├── __tests__/
│   │   ├── momentum.ts      # Course momentum scoring
│   │   ├── velocity.ts      # Learning velocity calculations
│   │   └── recommendations.ts # Recommendation algorithms
│   │
│   ├── data/
│   │   └── types.ts         # Centralized TypeScript types
│   │
│   └── styles/
│       ├── index.css        # Main CSS entry
│       ├── tailwind.css     # Tailwind v4 configuration
│       ├── theme.css        # CSS custom properties
│       └── fonts.css        # Font definitions
│
├── tests/                   # E2E tests (Playwright)
│   ├── design-review.spec.ts
│   ├── accessibility.spec.ts
│   └── ...
│
├── docs/                    # Documentation
│   ├── planning-artifacts/
│   │   ├── prd.md
│   │   ├── architecture.md  # THIS FILE
│   │   └── ux-design-specification.md
│   └── ...
│
└── _bmad/                   # BMAD workflow artifacts
    └── ...
```

### Architectural Boundaries

#### Component Boundaries

**UI Components (`src/app/components/`):**
- **Responsibility:** Rendering UI, handling user interactions, managing local component state
- **Communication:** Receive props from parent components, emit events via callbacks, subscribe to Zustand stores via selectors
- **Do NOT:** Directly access IndexedDB, make API calls, contain business logic
- **Pattern:** Functional components with TypeScript interfaces for props

**Example:**
```typescript
// ✅ Correct: Component uses Zustand for state, emits events via props
interface VideoPlayerProps {
  videoId: string
  onComplete: (videoId: string) => void
}

export function VideoPlayer({ videoId, onComplete }: VideoPlayerProps) {
  const playing = useVideoPlayerStore((state) => state.playing)
  const togglePlay = useVideoPlayerStore((state) => state.togglePlay)
  
  const handleVideoEnd = () => {
    onComplete(videoId) // Emit event to parent
  }
}
```

---

#### State Management Boundaries

**Zustand Stores (`src/stores/`):**
- **Responsibility:** Global application state, UI state, derived state
- **Communication:** Components subscribe via selectors, stores update IndexedDB via async actions
- **Do NOT:** Directly manipulate DOM, contain complex business logic
- **Pattern:** Slice pattern for domain separation (video player, courses, notes, progress, streaks)

**Data Flow:**
1. User interaction → Component calls Zustand action
2. Zustand updates state immediately (optimistic)
3. Zustand action persists to IndexedDB async (background)
4. On write failure: Retry with exponential backoff (3 attempts: 1s, 2s, 4s)
5. After retry exhaustion: Revert Zustand store to last-persisted content AND show error toast
6. `beforeunload`: Best-effort async IndexedDB write + synchronous localStorage snapshot as failsafe (NFR57)

**Example:**
```typescript
// src/stores/useNoteStore.ts
export const useNoteStore = create<NoteState>((set, get) => ({
  notes: {},

  updateNote: async (noteId, content) => {
    const previousContent = get().notes[noteId]?.content

    // 1. Optimistic update
    set((state) => ({
      notes: { ...state.notes, [noteId]: { ...state.notes[noteId], content } }
    }))

    // 2. Persist to IndexedDB with exponential backoff retry
    const backoffDelays = [1000, 2000, 4000]
    for (let attempt = 0; attempt < backoffDelays.length; attempt++) {
      try {
        await db.notes.update(noteId, { content, updatedAt: new Date().toISOString() })
        return // Success
      } catch (error) {
        if (attempt < backoffDelays.length - 1) {
          await new Promise(r => setTimeout(r, backoffDelays[attempt]))
        } else {
          // After retry exhaustion: revert to last-persisted content
          set((state) => ({
            notes: { ...state.notes, [noteId]: { ...state.notes[noteId], content: previousContent } }
          }))
          toast.error('Failed to save note')
        }
      }
    }
  }
}))
```

---

#### Data Persistence Boundaries

**Dexie.js Database (`src/db/`):**
- **Responsibility:** IndexedDB abstraction, schema management, migrations, queries
- **Communication:** Called by Zustand stores, provides reactive queries via `liveQuery()`
- **Do NOT:** Update Zustand stores directly, contain UI logic
- **Pattern:** Central schema definition with versioned migrations

**Schema Organization:**
```typescript
// src/db/schema.ts
export const db = new Dexie('ElearningDB')

db.version(1).stores({
  courses: '++id, name, importedAt, *tags',
  videos: '++id, courseId, filename, duration, completionStatus',
  pdfs: '++id, courseId, filename, pageCount',
  notes: 'id, courseId, &videoId, *tags, createdAt, updatedAt',
  progress: '++id, courseId, videoId, currentTime, completionPercentage',
  streaks: '++id, date, minutesStudied',
  studySessions: '++id, courseId, startTime, endTime, duration',
  courseMomentum: 'courseId, score, category, lastStudied',
  bookmarks: 'id, courseId, lessonId, createdAt'
})
// Note: `notes` and `bookmarks` tables use manual ID (crypto.randomUUID())
// per Architecture convention. All other tables use ++id (auto-increment).
```

**Access Pattern:**
- Zustand stores import `db` from `src/db/index.ts`
- Components NEVER import `db` directly (must go through Zustand)
- Background tasks (Web Workers) can access `db` for analytics calculations

---

#### Service Boundaries

**File System Integration (`src/lib/fileSystem.ts`):**
- **Responsibility:** File System Access API wrapper, permission handling, metadata extraction
- **Communication:** Called by course import flow, returns file handles to be stored in IndexedDB
- **Pattern:** Async functions with error handling, permission state management

**AI Integration (`src/ai/`):**
- **Responsibility:** Vercel AI SDK wrapper, streaming responses, provider abstraction
- **Communication:** Called by UI components (via Zustand if state needed), returns AI-generated content
- **Pattern:** Edge function calls (NOT direct client → OpenAI), 30s timeout with AbortController

**Search Engine (`src/search/`):**
- **Responsibility:** MiniSearch index management, full-text search across notes
- **Communication:** Updated by Zustand note store on CRUD operations, queried by search components
- **Pattern:** Singleton index instance, debounced search queries (150ms)

**Analytics Engine (`src/analytics/`):**
- **Responsibility:** Course momentum scoring, learning velocity calculations, recommendations
- **Communication:** Reads from IndexedDB, updates momentum scores in background (Web Worker)
- **Pattern:** Pure functions for calculations, scheduled background tasks for aggregation

---

### Requirements to Structure Mapping

#### FR1-FR6: Course Library Management

**Files:**
- `src/app/pages/Library.tsx` - Course library UI
- `src/lib/fileSystem.ts` - File System Access API integration
- `src/db/schema.ts` - `courses`, `videos`, `pdfs` tables
- `src/stores/useCourseStore.ts` - Course state management

**Flow:**
1. User clicks "Import Course" → `Library.tsx` calls `fileSystem.importCourse()`
2. `fileSystem.ts` uses `showDirectoryPicker()`, scans for MP4/PDF files
3. Metadata extracted (video duration, PDF page count) via native APIs
4. `useCourseStore` saves to IndexedDB via Dexie.js
5. UI updates via Zustand subscription

---

#### FR7-FR13: Content Consumption

**Files:**
- `src/app/pages/LessonPlayer.tsx` - Lesson player page
- `src/app/components/figma/VideoPlayer.tsx` - react-player with custom controls
- `src/app/components/figma/PdfViewer.tsx` - react-pdf viewer
- `src/stores/useVideoPlayerStore.ts` - Playback state
- `src/lib/progress.ts` - Resume position tracking

**Flow:**
1. User selects lesson → `LessonPlayer.tsx` loads video/PDF from IndexedDB handle
2. `VideoPlayer.tsx` subscribes to `useVideoPlayerStore` for playback state
3. Progress auto-saved every 5 seconds to `progress` table
4. Resume position loaded on component mount from `getProgress(courseId, lessonId)`

---

#### FR14-FR19: Progress & Session Tracking

**Files:**
- `src/lib/progress.ts` - Progress tracking utilities
- `src/lib/studyLog.ts` - Study session logging
- `src/db/schema.ts` - `progress`, `studySessions` tables
- `src/stores/useProgressStore.ts` - Progress state
- `src/app/components/ProgressWidget.tsx` - Visual progress indicator

**Flow:**
1. Video playback → `VideoPlayer.tsx` calls `saveVideoPosition()`
2. User marks lesson complete → `markLessonComplete()` updates `progress` table
3. Study session auto-logged on page load/unload → `logStudyAction()`
4. Progress widget subscribes to `useProgressStore` for real-time updates

---

#### FR20-FR27: Note Management

**Files:**
- `src/app/components/notes/NoteEditor.tsx` - Markdown editor (FUTURE)
- `src/app/components/notes/NoteList.tsx` - Note list view (FUTURE)
- `src/stores/useNoteStore.ts` - Note state (FUTURE)
- `src/db/schema.ts` - `notes` table
- `src/search/index.ts` - Full-text search indexing (FUTURE)

**Flow:**
1. User types in note editor → 3-second debounced autosave
2. `useNoteStore.updateNote()` updates Zustand immediately, IndexedDB async
3. Tags managed via explicit tag management UI (not extracted from markdown; see Epic 3, Story 3.5)
4. MiniSearch index updated on save → enables full-text search
5. Timestamp links (`[2:34](video://lesson-01#t=154)`) rendered as clickable

---

#### FR28-FR35: Motivation & Gamification

**Files:**
- `src/app/components/StudyStreakCalendar.tsx` - Streak calendar (EXISTING)
- `src/lib/studyLog.ts` - Streak tracking logic (EXISTING)
- `src/db/schema.ts` - `streaks` table
- `src/stores/useStreakStore.ts` - Streak state (FUTURE)
- `src/app/components/celebrations/Confetti.tsx` - Celebration animations (FUTURE)

**Flow:**
1. Daily study logged → `logStudyAction()` updates `streaks` table
2. Streak counter calculated from consecutive days in `streaks` table
3. Calendar heatmap reads last 30 days from `studySessions`
4. Streak pause mode → `setStreakPause()` marks dates as protected
5. Milestone reached → Framer Motion animation triggered

---

#### FR36-FR42: Learning Intelligence

**Files:**
- `src/analytics/momentum.ts` - Momentum scoring algorithm (FUTURE)
- `src/analytics/recommendations.ts` - Recommendation engine (FUTURE)
- `src/db/schema.ts` - `courseMomentum` table
- `src/app/pages/Overview.tsx` - Displays momentum indicators

**Flow:**
1. Study session ends → Web Worker calculates momentum scores
2. `calculateMomentumScore()` uses recency + completion + frequency
3. Scores saved to `courseMomentum` table (hot/warm/cold categories)
4. Overview page queries IndexedDB for hot courses → "Continue Learning" button
5. Recommendations generated by analyzing study patterns + MiniSearch similarity

---

#### FR43-FR47: Analytics & Reporting

**Files:**
- `src/app/pages/Reports.tsx` - Analytics dashboard
- `src/analytics/velocity.ts` - Learning velocity calculations (FUTURE)
- `src/lib/progress.ts` - Progress aggregation utilities
- `src/app/components/charts/` - Chart components

**Flow:**
1. Reports page loads → Queries `studySessions`, `progress`, `courseMomentum`
2. Daily/weekly/monthly aggregation pre-computed at midnight (Web Worker)
3. Charts rendered via chart components (recharts or similar)
4. Completion rate = completed lessons / total lessons per course
5. Retention insights = courses completed vs abandoned (completion% < 10%)

---

#### FR48-FR53: AI-Powered Assistance

**Files:**
- `src/ai/client.ts` - Vercel AI SDK wrapper (FUTURE)
- `src/ai/summaries.ts` - Video summary generation (FUTURE)
- `src/ai/qa.ts` - Q&A on notes (FUTURE)
- `src/ai/recommendations.ts` - Learning path suggestions (FUTURE)

**Flow:**
1. User requests video summary → `summaries.ts` calls edge function with transcript
2. Edge function uses Vercel AI SDK → streams response to client
3. Q&A on notes → `qa.ts` uses MiniSearch to retrieve relevant note context
4. Context + question sent to AI → RAG pattern for accurate answers
5. Learning path suggestions → `recommendations.ts` analyzes study patterns + course metadata

---

### Integration Points

#### Internal Communication

**Component → Zustand:**
```typescript
// Component subscribes to specific state slice
const playing = useVideoPlayerStore((state) => state.playing)
const togglePlay = useVideoPlayerStore((state) => state.togglePlay)
```

**Zustand → Dexie.js:**
```typescript
// Zustand action persists to IndexedDB
updateNote: async (noteId, content) => {
  set((state) => ({ notes: { ...state.notes, [noteId]: { content } } }))
  await db.notes.update(noteId, { content, updatedAt: new Date().toISOString() })
}
```

**Dexie.js → Components (via LiveQuery):**
```typescript
// Component auto-updates when IndexedDB changes (FUTURE)
const courses = useLiveQuery(() => db.courses.toArray())
```

---

#### External Integrations

**File System Access API:**
- **Entry Point:** `src/lib/fileSystem.ts`
- **Permission Flow:** Request read permission → Store FileSystemDirectoryHandle in IndexedDB → Query permission on app load
- **Error Handling:** `NotFoundError` → Prompt user to re-import course
- **Security:** Sandboxed to user-selected directories, no write access

**AI APIs (OpenAI/Anthropic):**
- **Entry Point:** `src/ai/client.ts`
- **Authentication:** API keys in `.env` file, edge function proxies requests
- **Timeout:** 30-second AbortController timeout (NFR26)
- **Fallback:** Core features work if AI unavailable (graceful degradation)

**Browser APIs:**
- **IndexedDB:** Dexie.js abstraction, 100% offline capability
- **localStorage:** Settings, migration version tracking
- **Web Workers:** Background analytics calculations (midnight tasks)

---

#### Data Flow

**Course Import Flow:**
```
User selects folder
  → File System Access API: showDirectoryPicker()
  → fileSystem.ts: Extract metadata (duration, page count)
  → useCourseStore: Save to IndexedDB
  → Zustand: Update courses state
  → UI: Re-render course list
```

**Video Playback Flow:**
```
User clicks video
  → LessonPlayer.tsx: Load FileSystemFileHandle from IndexedDB
  → Create blob URL: URL.createObjectURL(file)
  → VideoPlayer.tsx: react-player renders video
  → useVideoPlayerStore: Track playback position
  → Every 5s: saveVideoPosition() → IndexedDB
```

**Note Autosave Flow:**
```
User types in note editor
  → 3-second debounce
  → useNoteStore.updateNote()
    → Zustand: Update notes state (optimistic)
    → Dexie.js: Persist to notes table (async)
    → MiniSearch: Update search index
  → On write failure: Retry with exponential backoff (3 attempts: 1s, 2s, 4s)
  → After retry exhaustion: Revert Zustand to last-persisted content + error toast
  → beforeunload: Best-effort async IndexedDB write + localStorage snapshot failsafe
```

**Momentum Scoring Flow:**
```
Study session ends
  → logStudyAction() → studySessions table
  → Web Worker: calculateMomentumScore()
    → Query last 30 days of studySessions
    → Calculate recency + completion + frequency
    → Save to courseMomentum table
  → Overview page: Query courseMomentum for hot courses
```

---

### File Organization Patterns

#### Configuration Files

**Root Configuration:**
- `package.json` - Dependencies, scripts
- `tsconfig.json` - TypeScript compiler options
- `vite.config.ts` - Vite build configuration
- `eslint.config.js` - Linting rules
- `playwright.config.ts` - E2E test configuration
- `vitest.config.ts` - Unit/integration test configuration
- `.env.example` - Environment variable template
- `.prettierrc` - Code formatting rules

**GitHub Actions:**
- `.github/workflows/ci.yml` - CI/CD pipeline
- `.github/workflows/design-review.yml` - Automated design review

---

#### Source Organization

**Component Organization:**
- Components grouped by type/feature, NOT by page
- shadcn/ui components in `src/app/components/ui/`
- Custom components in `src/app/components/[feature]/`
- Page components in `src/app/pages/`

**Utility Organization:**
- Shared utilities in `src/lib/`
- Feature-specific utilities co-located with feature
- Centralized types in `src/data/types.ts`

**Future Directories:**
- `src/stores/` - Zustand stores (Phase 1)
- `src/db/` - Dexie.js schema (Phase 1)
- `src/search/` - MiniSearch integration (Phase 2)
- `src/ai/` - AI integration (Phase 3)
- `src/analytics/` - Analytics algorithms (Phase 3)

---

#### Test Organization

**Unit Tests:**
- Co-located in `__tests__/` directories
- Example: `src/lib/__tests__/progress.test.ts`
- Test utilities, stores, algorithms

**Component Tests:**
- Co-located in `src/app/components/[feature]/__tests__/`
- Example: `src/app/components/notes/__tests__/NoteEditor.test.tsx`
- Test interactive components

**Integration Tests:**
- `src/__tests__/integration/` for cross-module tests
- Example: `src/__tests__/integration/course-import.test.ts`
- Test IndexedDB operations, search indexing

**E2E Tests:**
- `tests/` directory at project root
- Example: `tests/design-review.spec.ts`
- Test complete user flows

---

#### Asset Organization

**Static Assets:**
- Images: `public/assets/` (optimized via Vite)
- Fonts: `public/fonts/` (referenced in `src/styles/fonts.css`)
- Icons: Lucide React components (no static files)

**Dynamic Assets:**
- Videos/PDFs: Accessed via File System Access API (NOT stored in project)
- User data: IndexedDB (courses, notes, progress)
- Search index: Rebuilt from IndexedDB on app load (MiniSearch not persisted; rebuild budget <2s for 500 notes)

---

### Development Workflow Integration

#### Development Server Structure

**Local Development:**
- `npm run dev` → Vite dev server on `localhost:5173`
- Hot Module Replacement for instant updates
- React Fast Refresh preserves component state
- File System Access API requires HTTPS in production (localhost exempt)

**File Watching:**
- Vite watches `src/` directory
- Tailwind v4 watches via `@source` directive in `src/styles/tailwind.css`
- TypeScript compilation via Vite (no separate tsc watch)

---

#### Build Process Structure

**Production Build:**
- `npm run build` → Vite production build
- Code splitting per route (React Router lazy loading)
- Tree-shaking removes unused code
- Asset optimization (images, fonts)
- CSS minification via Tailwind + Lightning CSS
- Output: `dist/` directory

**Bundle Analysis:**
- Bundle size target: <500 KB gzipped (NFR6)
- Current: ~487 KB (97% of budget)
- Largest bundle: react-pdf (300 KB)

---

#### Deployment Structure

**Deployment Target:**
- Static hosting (Vercel, Netlify, GitHub Pages, etc.)
- No server required (local-first app)
- Edge functions for AI API proxy (if using Vercel/Netlify)

**Environment Variables:**
- `.env` file for local development
- Platform-specific environment variables for production (Vercel, Netlify)
- Required: `VITE_OPENAI_API_KEY` or `VITE_ANTHROPIC_API_KEY`

**Browser Requirements:**
- Chrome 131+ or Edge 128+ (File System Access API)
- HTTPS required for File System Access API in production
- IndexedDB support (all modern browsers)

---

### Implementation Sequence Mapping

**Phase 1: Foundation (Months 1-2)**
- `src/db/schema.ts` - IndexedDB schema
- `src/stores/useCourseStore.ts` - Course state
- `src/lib/fileSystem.ts` - File System Access API
- `src/app/pages/Library.tsx` - Course import UI

**Phase 2: Core Features (Months 3-5)**
- `src/app/components/figma/VideoPlayer.tsx` - react-player integration
- `src/app/components/figma/PdfViewer.tsx` - react-pdf integration
- `src/app/components/notes/NoteEditor.tsx` - Markdown editor
- `src/search/index.ts` - MiniSearch integration

**Phase 3: Intelligence & Polish (Months 6-9)**
- `src/ai/client.ts` - Vercel AI SDK
- `src/analytics/momentum.ts` - Momentum scoring
- `src/app/components/celebrations/` - Framer Motion animations
- `tests/` - Comprehensive test suite

---


## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are compatible without conflicts:
- React 18.3.1 + Vite 6.3.5 (native integration)
- Zustand v5.0.11 (React 18 compatible, selector-based subscriptions)
- Dexie.js v4.3.0 (browser-native, no conflicts)
- react-player v3.4.0 + react-pdf v10.3.0 (both React 18 compatible)
- @uiw/react-md-editor + react-markdown + rehype-sanitize (compatible stack)
- MiniSearch (zero dependencies, pure JavaScript)
- Vercel AI SDK v2.0.31 (latest stable, provider abstraction)
- Framer Motion v12.34.0 LazyMotion (React 18 compatible)
- Vitest v4.0.18 (native Vite integration)

**Pattern Consistency:**
Implementation patterns support all architectural decisions:
- Naming: PascalCase components, camelCase utilities, SCREAMING_SNAKE_CASE constants
- Zustand: `use[Domain]Store` pattern consistent across all stores
- Dexie.js: Lowercase plural tables, camelCase fields (SQL convention)
- Optimistic updates: Zustand first, IndexedDB second (consistent across features)
- Error handling: Try-catch with safe fallbacks + logging prefix pattern

**Structure Alignment:**
Project structure supports all architectural decisions:
- Clear separation: components, stores, db, lib, search, ai, analytics
- Boundaries respect React, Zustand, Dexie.js separation of concerns
- Integration points (Zustand ↔ Dexie.js, MiniSearch ↔ notes) properly structured
- Future directories defined (stores/, db/, search/, ai/, analytics/)

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**

- **FR1-FR6 (Course Library Management):** File System Access API + Dexie.js (courses, videos, pdfs tables) + useCourseStore + Library.tsx ✅
- **FR7-FR13 (Content Consumption):** react-player + react-pdf + useVideoPlayerStore + progress tracking (resume position) ✅
- **FR14-FR19 (Progress & Session Tracking):** progress.ts + studyLog.ts + Dexie.js (progress, studySessions tables) + ProgressWidget ✅
- **FR20-FR27 (Note Management):** @uiw/react-md-editor + MiniSearch + useNoteStore + timestamp links + explicit tag management UI ✅
- **FR28-FR35 (Motivation & Gamification):** StudyStreakCalendar (existing) + studyLog.ts + Dexie.js (streaks table) + Framer Motion celebrations ✅
- **FR36-FR42 (Learning Intelligence):** Custom momentum scoring algorithm + courseMomentum table + recommendation engine + MiniSearch similarity ✅
- **FR43-FR47 (Analytics & Reporting):** Reports.tsx + custom analytics algorithms + Web Worker background tasks + chart components ✅
- **FR48-FR53 (AI-Powered Assistance):** Vercel AI SDK + streaming responses + RAG pattern (MiniSearch + AI) + edge functions ✅

**All 53 functional requirements are architecturally supported.**

**Non-Functional Requirements Coverage:**

- **Performance (NFR1-NFR7):**
  - <2s load time: Vite code splitting per route ✅
  - <200ms navigation: React Router lazy loading ✅
  - <100ms IndexedDB queries: Dexie.js compound indexes ✅
  - <50ms autosave: 3-second debounce with optimistic updates ✅
  - <500KB bundle: 487KB achieved (97% of budget) ✅
  - Stable memory: React 18 concurrent features, no memory leaks in patterns ✅

- **Reliability (NFR8-NFR16):**
  - Zero data loss: IndexedDB persistence + autosave + versioned migrations ✅
  - Graceful recovery: Try-catch patterns with fallbacks ✅
  - AI degradation: Core features (video, notes, progress) work without AI ✅
  - Autosave conflict resolution: Retry with exponential backoff (3 attempts: 1s, 2s, 4s), revert Zustand on exhaustion + error toast, beforeunload localStorage snapshot failsafe ✅
  - Atomic progress state changes: Dexie.js transactions ✅

- **Usability (NFR17-NFR25):**
  - Zero-click resume: Progress tracking + momentum scoring for hot course detection ✅
  - <3 clicks: Direct navigation via React Router, optimistic updates for instant feedback ✅
  - Video resume <1s: Playback position from IndexedDB, blob URL cached ✅
  - Search as-you-type: 150ms debounce + sub-1ms MiniSearch execution ✅
  - Destructive actions: Confirmation dialogs (pattern enforced) ✅

- **Integration (NFR26-NFR35):**
  - AI timeout 30s: AbortController pattern ✅
  - API key security: .env + edge function proxies ✅
  - Multiple AI providers: Vercel AI SDK provider abstraction (OpenAI → Anthropic zero refactoring) ✅
  - File System Access API: Native browser API with permission handling ✅
  - Large file support (2GB+ videos): Streaming via blob URLs, no in-memory loading ✅
  - Data export: JSON/Markdown export via IndexedDB queries ✅

- **Accessibility (NFR36-NFR49):**
  - WCAG 2.1 AA+ compliance: Radix UI primitives + automated design review workflow ✅
  - 4.5:1 contrast: Theme system with CSS variables enforced ✅
  - Keyboard accessibility: All patterns require keyboard navigation ✅
  - ARIA labels: Required for icon-only buttons (enforced by pattern) ✅
  - Semantic HTML: Enforced by ESLint rules ✅
  - Video keyboard controls: Custom controls with Space, Arrow keys, T, C, F, M shortcuts ✅

- **Security (NFR50-NFR56):**
  - XSS prevention: rehype-sanitize for Markdown rendering ✅
  - CSP headers: Deployment configuration (Vercel/Netlify) ✅
  - API keys never client-side: .env + edge function proxies ✅
  - Local-first: No remote transmission except AI API (explicit requirement) ✅

**All 56 non-functional requirements are architecturally addressed.**

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All critical decisions documented with exact versions (Zustand v5.0.11, Dexie.js v4.3.0, etc.) ✅
- Implementation patterns cover 37 identified conflict points ✅
- Consistency rules are clear and enforceable via TypeScript + ESLint ✅
- Examples provided for all major patterns (good examples vs anti-patterns) ✅

**Structure Completeness:**
- Complete directory tree with current + future files (stores/, db/, search/, ai/, analytics/) ✅
- All files and directories defined with explicit purposes ✅
- Integration points clearly specified (component boundaries, state flow, data persistence) ✅
- Component boundaries well-defined (UI, State Management, Data Persistence, Services) ✅

**Pattern Completeness:**
- All 37 potential conflict points addressed (naming, structure, format, communication, process) ✅
- Naming conventions comprehensive (components, functions, types, Zustand stores, Dexie.js tables) ✅
- Communication patterns fully specified (Zustand selectors, optimistic updates, Dexie.js LiveQuery) ✅
- Process patterns complete (error handling, loading states, autosave, data migrations) ✅

### Gap Analysis Results

**Critical Gaps:** **NONE** ✅

**Important Gaps:** **NONE** ✅

**Nice-to-Have Enhancements:**
- Deployment configuration examples (Vercel edge functions for AI proxy, Netlify functions)
- CI/CD pipeline implementation details (currently only file references in `.github/workflows/`)
- More detailed test fixture examples (fake-indexeddb usage patterns)
- Performance monitoring strategy (Lighthouse CI integration for regression detection)

**Security Note:**
Security review identified path traversal vulnerability in `vite.config.ts` (serveLocalMedia plugin, lines 19-21). This is an implementation bug, not an architectural gap. Recommendation: Add path validation with `path.resolve()` and containment check before serving files.

**Overall:** Architecture is complete and ready for implementation with HIGH confidence.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (brownfield React app from Figma wireframes)
- [x] Scale and complexity assessed (Medium-High: 53 FRs + 56 NFRs, 7 major pages, 50+ components)
- [x] Technical constraints identified (Chrome/Edge only, File System Access API, local-first design)
- [x] Cross-cutting concerns mapped (8 major concerns: data persistence, performance, accessibility, error resilience, animations, responsive, state management, security)

**✅ Architectural Decisions**

- [x] Critical decisions documented with versions (9 core decisions: Zustand, Dexie.js, react-player, react-pdf, Markdown editor, MiniSearch, Vercel AI SDK, Framer Motion, Vitest)
- [x] Technology stack fully specified (487KB/500KB bundle target, 97% efficiency)
- [x] Integration patterns defined (File System Access API, AI edge functions, IndexedDB persistence, MiniSearch indexing)
- [x] Performance considerations addressed (all NFR targets met architecturally: <2s load, <200ms nav, <100ms queries, <50ms autosave)

**✅ Implementation Patterns**

- [x] Naming conventions established (37 conflict points identified and resolved)
- [x] Structure patterns defined (component organization by type/feature, test co-location in `__tests__/`)
- [x] Communication patterns specified (Zustand selectors, optimistic updates, Dexie.js LiveQuery)
- [x] Process patterns documented (error handling with fallbacks, loading states, 3s autosave with 10s max wait, version-based migrations)

**✅ Project Structure**

- [x] Complete directory structure defined (current structure + 6 future directories: stores/, db/, search/, ai/, analytics/, notes/)
- [x] Component boundaries established (UI Components, State Management, Data Persistence, Services)
- [x] Integration points mapped (Zustand ↔ Dexie.js optimistic updates, MiniSearch ↔ note CRUD, AI ↔ edge functions, File System ↔ IndexedDB handles)
- [x] Requirements to structure mapping complete (FR1-FR53 mapped to specific files: FR1-FR6 → Library.tsx + fileSystem.ts, FR7-FR13 → LessonPlayer.tsx + VideoPlayer.tsx, etc.)

### Architecture Readiness Assessment

**Overall Status:** **READY FOR IMPLEMENTATION** ✅

**Confidence Level:** **HIGH** (9/10)

The architecture is comprehensive, coherent, and provides sufficient guidance to prevent AI agent conflicts during implementation.

**Key Strengths:**

1. **Bundle Optimization:** 487KB/500KB target achieved (97% efficiency) with largest dependency (react-pdf 300KB) justified by core PDF viewing functionality
2. **Performance-First Architecture:** Optimistic updates, code splitting, compound indexes, and debounced autosave all architecturally baked in to meet aggressive NFR targets
3. **Accessibility-First Design:** WCAG 2.1 AA+ compliance via Radix UI primitives + automated Playwright design review workflow ensures accessibility is not retrofitted
4. **Security-First Patterns:** XSS prevention (rehype-sanitize), API key isolation (edge functions), local-first data architecture prevents common web vulnerabilities
5. **Future-Proof AI Integration:** Vercel AI SDK provider abstraction enables OpenAI → Anthropic switch with zero refactoring
6. **Comprehensive Conflict Prevention:** 37 conflict points identified and resolved before implementation (naming, structure, format, communication, process patterns)
7. **Brownfield-Aware:** Architecture builds on existing foundation (Figma wireframes, 50+ shadcn/ui components, React Router v7) rather than starting from scratch
8. **Phased Implementation Ready:** Clear Phase 1 (Foundation), Phase 2 (Core Features), Phase 3 (Intelligence & Polish) with dependency mapping

**Areas for Future Enhancement:**

- Deployment documentation (Vercel/Netlify edge function configuration for AI proxy)
- CI/CD implementation details (test execution, build validation, deployment automation)
- Performance monitoring strategy (Lighthouse CI for performance regression detection)
- Internationalization (i18n) preparation (if multi-language support needed later)

### Implementation Handoff

**AI Agent Guidelines:**

1. **Follow Architectural Decisions Exactly:** Use exact versions specified (Zustand v5.0.11, Dexie.js v4.3.0, etc.) to prevent version conflicts
2. **Use Implementation Patterns Consistently:** Apply naming conventions, structure patterns, and communication patterns across all code
3. **Respect Project Structure:** Place files in correct directories (components by type, tests in `__tests__/`, utilities in `lib/`)
4. **Respect Boundaries:** Components → Zustand → Dexie.js (never skip layers, e.g., components directly accessing IndexedDB)
5. **Refer to This Document:** For all architectural questions, consult this document as the single source of truth

**First Implementation Priority:**

**Phase 1: Foundation (Months 1-2)**

1. **Database Schema Setup:**
   - Create `src/db/schema.ts` with Dexie.js database definition
   - Define all tables: `courses`, `videos`, `pdfs`, `notes`, `progress`, `streaks`, `studySessions`, `courseMomentum`
   - Add compound indexes for performance: `[courseId+completionStatus]`, `[date+courseId]`
   - Export `db` instance from `src/db/index.ts`

2. **Zustand Store Architecture:**
   - Create `src/stores/useCourseStore.ts` with slice pattern
   - Implement optimistic update pattern (Zustand first, IndexedDB async)
   - Add error handling with retry (exponential backoff: 1s, 2s, 4s) and rollback on retry exhaustion

3. **File System Integration:**
   - Create `src/lib/fileSystem.ts` for File System Access API wrapper
   - Implement `showDirectoryPicker()` with permission handling
   - Extract video metadata (duration) via native HTML5 video element
   - Extract PDF metadata (page count) via PDF.js

4. **Course Import Flow:**
   - Update `src/app/pages/Library.tsx` with import button
   - Scan directory for MP4/MKV/AVI/WEBM + PDF files
   - Store FileSystemDirectoryHandle in IndexedDB
   - Display imported courses in library

**Start here:** Create `src/db/schema.ts` as the first file to implement.

---

**Architecture Complete** ✅

