# Knowlune Onboarding Guide

Knowlune is a free, open-source personal learning platform for tracking
progress through courses, building study habits, and managing a digital
reading library. It's an **open-core** product: the core platform ships
under AGPL-3.0, while premium AI features (spaced review, AI tutor,
knowledge gap analysis) require a paid subscription.

The platform targets self-directed learners who want to import their own
content — YouTube playlists, EPUB books, PDF documents, audiobooks via
Audiobookshelf — and get structured tracking, quizzes, and AI-powered
learning tools alongside.

---

## User Experience

When you first open Knowlune you see a dashboard Overview showing your
study streak, recent courses, and progress toward daily goals. From the
left sidebar you navigate between six main areas:

- **Overview** — dashboard with streaks, active courses, and study plan
- **Courses** — imported YouTube playlists, PDFs, or video folders;
  each course has a lesson player, quiz engine, and notes sidebar
- **Library** — EPUB/audiobook reader with highlights, vocabulary
  builder, and annotation summaries; books can sync from Audiobookshelf
- **Learning Paths** — ordered course sequences you curate or the AI
  generates for you
- **Notes** — cross-course notes with full-text search and AI chat (premium)
- **Reports** — study time analytics, quiz performance, AI usage

Premium features render a soft paywall in-place (`PremiumFeaturePage`)
rather than redirecting away, so free users can still see what they're
unlocking.

---

## How Is It Organized?

### Architecture

```
          User / Browser
               |
               | HTTP (Vite dev / nginx prod)
               v
  +---------------------------+
  |   React SPA (port 5173)   |
  |  Vite + React 19 + Zustand|
  |  IndexedDB (Dexie)        |
  +------------+--------------+
               |
               | HTTP (fetch)
               v
  +---------------------------+
  |  Express Server (port 3001|
  |  AI proxy (Vercel AI SDK) |
  |  ABS proxy (cover cache)  |
  |  Calendar feed generator  |
  +---+--------+----------+---+
      |        |          |
      v        v          v
  LLM APIs   Ollama   Audiobookshelf
  (Anthropic, (LAN)   (user's server)
   Groq, etc)
```

The browser never calls AI providers or Audiobookshelf directly. All
those requests flow through the Express proxy to avoid CORS restrictions
and keep API keys out of browser network traffic.

All user data lives client-side — the Express server is stateless and
has no database. IndexedDB (via Dexie) is the only persistent store.

### Directory Structure

```
knowlune/
  src/
    app/
      components/   # Shared UI (Layout, shadcn/ui, Figma exports)
      pages/        # Route-level page components (~30 pages)
      hooks/        # App-level hooks (auth, media query, etc.)
      config/       # Navigation config, feature flags
    ai/             # Client-side AI: embeddings, quiz gen
    data/           # TypeScript type definitions
    db/             # Dexie schema + migrations
    hooks/          # Cross-cutting hooks (font scale, focus mode)
    lib/            # Pure utilities (search, bookmarks, perf)
    premium/        # Proprietary premium feature code
    services/       # Data-layer services (OPFS, ABS sync)
    stores/         # Zustand state stores
    styles/         # Tailwind + CSS custom properties
    types/          # Additional TypeScript types
  server/
    index.ts        # Express app (AI proxy, ABS proxy, calendar)
    routes/         # calendar.ts, models.ts
    middleware/     # auth, entitlement, rate-limiter, origin-check
  tests/            # Playwright E2E tests
  src/test/         # Vitest unit test helpers + fixtures
  supabase/         # Supabase Edge Functions (Stripe webhooks)
  scripts/          # CI, burn-in, git hooks
  .claude/          # Claude Code agent config + rules
```

### Key Modules

| Module | Responsibility |
|--------|----------------|
| `src/app/components/Layout.tsx` | Sidebar + header shell; all main routes render inside it |
| `src/app/routes.tsx` | React Router v7 config; all 30+ routes declared here |
| `src/db/schema.ts` | Dexie database schema — 40+ tables, versioned migrations |
| `src/stores/` | Zustand stores per domain (books, courses, auth, audio) |
| `src/services/` | Side-effectful services (OPFS file storage, ABS sync) |
| `src/ai/` | Client-side AI: embeddings pipeline, quiz generation, course tagger |
| `server/index.ts` | Express AI + ABS proxy; all server-side logic |
| `src/premium/` | Premium features (not AGPL — proprietary) |
| `supabase/` | Stripe webhook Edge Function; Supabase manages auth + entitlements |

### External Dependencies

| Dependency | What it's used for | Configured via |
|-----------|-------------------|----------------|
| Supabase | User auth + premium entitlement checks | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |
| Stripe | Premium subscription checkout | Configured in Supabase Edge Function secrets |
| LLM APIs (Anthropic, Groq, Gemini, OpenAI, GLM, OpenRouter) | AI tutoring, quiz generation, learning paths | User-provided BYOK keys, or Knowlune-managed (premium) |
| Ollama | Self-hosted LLM inference (user's LAN server) | User-configured server URL in Settings |
| Audiobookshelf | Audiobook library sync | User-configured server URL + API token |
| Sentry | Frontend error tracking (optional) | `VITE_SENTRY_DSN` |

---

## Key Concepts and Abstractions

| Concept | What it means in this codebase |
|---------|-------------------------------|
| `ImportedCourse` | A course created from a YouTube playlist, video folder, or PDF; the primary course entity |
| `Book` | An EPUB or audiobook in the library; stored in IndexedDB + OPFS |
| `StudySession` | A timed learning session tracked per content item |
| `LearningPath` | An ordered list of courses a user follows toward a goal |
| `ReviewRecord` | A spaced-repetition record tracking when to next review a piece of content |
| `Flashcard` | An AI-generated or user-created card in the spaced review system |
| `Embedding` | A vector embedding of a note, used for semantic search |
| `LearnerModel` | AI model of the user's knowledge state for adaptive recommendations |
| BYOK | "Bring Your Own Key" — users supply their own LLM API keys to bypass entitlement checks |
| OPFS | Origin Private File System — browser API used to store EPUB and audio files locally (avoids IndexedDB size limits) |
| Zustand store | Each domain has a dedicated store in `src/stores/`. Stores load from Dexie on first access and write back on mutations |
| Progressive disclosure | Sidebar items unlock as users engage — `useProgressiveDisclosure` hook manages visibility |
| `PremiumFeaturePage` | Wrapper component that shows a paywall if the user lacks entitlement, renders children otherwise |
| CHECKPOINT_VERSION | Dexie migration version constant in `src/db/checkpoint.ts` — increment here when adding schema changes |

---

## Primary Flows

### Flow 1: Importing and Watching a YouTube Course

The most common user action — importing a playlist and tracking progress
through it.

```
User pastes YouTube playlist URL in import dialog
  |
  v
src/app/pages/Courses.tsx
  triggers import dialog
  |
  v
src/services/YouTubeImportService.ts
  fetches playlist via server proxy (/api/ai/…)
  creates ImportedCourse + ImportedVideo records
  |
  v
src/db/schema.ts (Dexie)
  persists to IndexedDB
  |
  v
src/stores/useCourseStore.ts
  loadCourses() refreshes in-memory state
  |
  v
User navigates to course → /courses/:courseId
  src/app/pages/CourseOverview.tsx renders
  |
  v
User clicks lesson → /courses/:courseId/lessons/:lessonId
  src/app/pages/UnifiedLessonPlayer.tsx
  video plays, progress tracked in contentProgress table
  |
  v
User completes lesson → quiz offered
  /courses/:courseId/lessons/:lessonId/quiz
  src/app/pages/Quiz.tsx
  quiz generated by src/ai/quizGenerationService.ts
```

### Flow 2: Reading an EPUB in the Library

```
User imports EPUB file via Library page
  |
  v
src/stores/useBookStore.ts importBook()
  stores metadata in Dexie books table
  stores file bytes in OPFS via
    src/services/OpfsStorageService.ts
  |
  v
User clicks "Read" → /library/:bookId/read
  src/app/pages/BookReader.tsx
  full-viewport reader (outside Layout)
  |
  v
Highlights/bookmarks saved to
  db.bookHighlights + db.audioBookmarks
  |
  v
/library/:bookId/annotations
  src/app/pages/AnnotationSummary.tsx
  shows all highlights for the book
```

### Flow 3: AI Tutor / Chat

```
User opens /tutor or /notes/chat (premium gate)
  |
  v
src/app/pages/Tutor.tsx or ChatQA.tsx
  user types message
  |
  v
src/ai/* (embedding lookup + prompt assembly)
  |
  v
POST /api/ai/stream  (Express proxy)
  |
  v
server/index.ts
  middleware chain:
    origin-check → JWT auth → BYOK detect
    → entitlement check → rate limiter
  |
  v
Vercel AI SDK streamText()
  forwards to LLM provider (Anthropic / Groq / Ollama / …)
  |
  v
SSE chunks stream back to browser
  rendered token-by-token in chat UI
```

---

## Developer Guide

### Setup

```bash
npm install
cp .env.example .env   # fill in Supabase URL + anon key at minimum
npm run dev            # Vite SPA on :5173
npm run server         # Express proxy on :3001 (optional — for AI features)
```

For local dev without Supabase auth, set `DEV_SKIP_ENTITLEMENT=true`
in `.env.local` — this bypasses the entitlement check so AI endpoints
work without a subscription.

Playwright browsers must be installed separately:

```bash
npx playwright install --with-deps chromium
```

### Running and Testing

```bash
npm run typecheck      # TypeScript type check
npm run lint           # ESLint (with custom design token rules)
npm run test:unit      # Vitest unit tests with coverage
npm run test:e2e       # Playwright E2E (Chromium)
npm run build          # Production Vite bundle
make ci                # Full CI pipeline (typecheck + lint + build + tests)
```

The E2E suite uses `FIXED_DATE` constants and IndexedDB seeding helpers
(see `src/test/`) — avoid `Date.now()` or `new Date()` in tests
directly, as the ESLint rule `test-patterns/deterministic-time` will
flag it.

### Common Change Patterns

**Add a new page route:**

1. Create `src/app/pages/YourPage.tsx`
2. Add a lazy import + route to `src/app/routes.tsx`
3. If it needs sidebar navigation, add an entry in
   `src/app/config/navigation.ts`

**Add a new database table:**

1. Declare the type in `src/data/types.ts`
2. Add the table to `ElearningDatabase` in `src/db/schema.ts`
3. Increment `CHECKPOINT_VERSION` in `src/db/checkpoint.ts` and add a
   migration in `createCheckpointDb()`

**Add a new Zustand store:**

Follow the pattern in `src/stores/useBookStore.ts` — create with
Zustand, add an `isLoaded` guard, load from Dexie on first call, write
back on mutations.

**Add a server-side endpoint:**

Add a route in `server/index.ts` or a new router in `server/routes/`.
Note the middleware chain: AI endpoints at `/api/ai/*` go through
`origin-check → JWT → BYOK → entitlement → rate-limiter`. Place the
endpoint registration before or after the chain application depending
on whether auth is needed.

### Key Files to Start With

| Area | File | Why |
|------|------|-----|
| App wiring | `src/app/App.tsx` | All global providers and startup effects |
| Routing | `src/app/routes.tsx` | Complete route map for all 30+ pages |
| Data model | `src/db/schema.ts` | All 40+ Dexie tables — the source of truth for what's stored |
| Server proxy | `server/index.ts` | AI + ABS proxy; middleware chain documented inline |
| Styling | `src/styles/theme.css` | All CSS custom property tokens — never use hardcoded Tailwind colors |
| Navigation | `src/app/config/navigation.ts` | Sidebar items and progressive disclosure config |

### Practical Tips

- **ESLint blocks hardcoded colors.** The custom rule
  `design-tokens/no-hardcoded-colors` rejects `bg-blue-600` in favor of
  `bg-brand`. See `src/styles/theme.css` for all token names and
  [docs/implementation-artifacts/design-token-cheat-sheet.md](docs/implementation-artifacts/design-token-cheat-sheet.md)
  for a quick reference.

- **The AI directory is client-side only.** `src/ai/` runs in the
  browser using WebLLM or calls the Express proxy — it does not import
  Node.js modules. The server's AI logic lives entirely in
  `server/index.ts` and `server/providers.ts`.

- **OPFS, not IndexedDB, for binary files.** Large files (EPUBs, audio)
  go through `src/services/OpfsStorageService.ts` into the browser's
  Origin Private File System. Dexie stores only metadata and IDs.

- **Premium code is gated.** `src/premium/` is not covered by AGPL and
  is tree-shaken in the open-source build. The Vite plugin
  `vite-plugin-premium-guard.ts` enforces this boundary at build time.

- **The story workflow drives development.** Stories follow
  `/start-story → implement → /review-story → /finish-story`. See
  [CLAUDE.md](CLAUDE.md) and
  [.claude/rules/workflows/story-workflow.md](.claude/rules/workflows/story-workflow.md)
  for the full workflow.
