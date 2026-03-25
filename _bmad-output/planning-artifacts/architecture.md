---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-07'
editHistory:
  - date: '2026-03-25'
    scope: 'YouTube Course Builder architecture addendum (Epic 23)'
    changes:
      - 'Added YouTube Course Builder Architecture section (10 decision areas)'
      - 'Added Dexie v24 schema design (source discriminator + 3 new tables)'
      - 'Added tiered server deployment architecture (BYOK infrastructure)'
      - 'Added 12-story implementation sequence for Epic 23'
      - 'Updated validation section with YouTube coverage'
    researchInput:
      - '_bmad-output/planning-artifacts/research/technical-youtube-content-handling-research-2026-03-25.md'
      - '_bmad-output/planning-artifacts/research/market-youtube-content-handling-research-2026-03-25.md'
      - 'docs/design/office-hours-2026-03-25-full-platform-youtube-hook.md'
inputDocuments:
  - 'docs/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-Elearningplatformwireframes-2026-03-01.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - 'docs/planning-artifacts/ux-design-specification.md'
  - 'docs/project-context.md'
  - '_bmad-output/planning-artifacts/research/domain-lms-personal-learning-dashboards-research-2026-02-28.md'
  - '_bmad-output/planning-artifacts/research/domain-elearning-platform-improvement-research-2026-03-07.md'
  - '_bmad-output/planning-artifacts/research/technical-webllm-rag-ai-assistant-research-2026-03-07.md'
  - '_bmad-output/planning-artifacts/research/technical-youtube-content-handling-research-2026-03-25.md'
  - '_bmad-output/planning-artifacts/research/market-youtube-content-handling-research-2026-03-25.md'
  - 'docs/design/office-hours-2026-03-25-full-platform-youtube-hook.md'
workflowType: 'architecture'
project_name: 'Elearningplatformwireframes'
user_name: 'Pedro'
date: '2026-03-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (101 FRs):**

| Category | FR Range | Architectural Impact |
|---|---|---|
| Course Management & Import | FR1-FR6, FR89 | File System Access API, Dexie schema, folder scanning |
| Content Viewing (Video/PDF) | FR7-FR13, FR45, FR88 | Native `<video>`, react-pdf, bookmarks, captions (WebVTT) |
| Progress & Session Tracking | FR14-FR19, FR95 | Dexie progress table, completion states, session logging |
| Smart Notes (Markdown) | FR20-FR27, FR76, FR77 | Markdown editor (existing), autosave, tag normalization |
| Study Streaks & Goals | FR28-FR31, FR90, FR91, FR98, FR101 | Streak calculation service, freeze mechanics, calendar visualization |
| Learning Challenges | FR32-FR35 | Goal types (completion/time/streak), progress tracking, milestone detection |
| Momentum & Intelligence | FR36-FR42, FR79 | Composite algorithm (recency + completion + frequency), recommendations, scheduling |
| Analytics & Insights | FR43, FR44, FR46, FR47, FR78, FR93 | Session quality scoring, engagement decay, heatmap, velocity metrics |
| AI Assistant | FR48-FR53, FR94, FR97, FR99 | WebLLM inference, RAG pipeline, source-grounded Q&A, video summarization |
| Onboarding | FR96 | First-use guidance, progressive feature disclosure |
| Retention & Export | FR80-FR87, FR92, FR100 | Spaced repetition (FSRS), data export, xAPI logging, Open Badges |

**Non-Functional Requirements (68 NFRs) — Architecturally Critical:**

| NFR Area | Key Requirements | Architectural Driver |
|---|---|---|
| Performance | < 2s cold start, < 200ms navigation, < 100ms DB queries, < 50ms autosave | Code splitting, IndexedDB indexes, virtual scrolling, debounced saves |
| Bundle Size | < 500KB initial gzipped; AI packages (~7MB) lazy-loaded | Dynamic imports, route-based code splitting, Web Worker isolation |
| Memory | < 3GB peak with AI; memory pressure detection + auto-downgrade | `measureUserAgentSpecificMemory()`, model eviction strategy |
| Accessibility | WCAG 2.2 AA (focus not obscured, 24px targets, dragging alternatives) | Semantic HTML, ARIA patterns, keyboard navigation, reduced motion |
| Data Integrity | Zero data loss; schema-versioned migrations; export round-trip ≥95% fidelity | Dexie upgrade() callbacks, optimistic update with rollback |
| Privacy | All data local by default; per-feature AI consent; cloud API keys encrypted | IndexedDB-only storage; AI tier indicator badges |
| AI Quality | Source attribution on all AI answers; hallucination mitigation; graceful degradation | RAG-only answers, low temperature (0.3), "I don't know" instruction |

**Scale & Complexity:**

- Primary domain: **Client-side SPA** (no backend, no auth, no server-side rendering)
- Complexity level: **HIGH** — 11 epics spanning gamification, analytics, AI inference, spaced repetition, data portability
- Estimated new architectural components: **8-10 major subsystems** (AI engine, embedding pipeline, vector store, FSRS scheduler, analytics engine, streak service, export service, onboarding orchestrator)

### Technical Constraints & Dependencies

| Constraint | Source | Impact |
|---|---|---|
| Chrome/Edge only | File System Access API + WebGPU | No Firefox/Safari support; simplifies CSS/JS targeting |
| No backend server | PRD core requirement | All computation client-side; no WebSocket, no REST API (except Ollama localhost) |
| IndexedDB as sole persistence | Existing architecture | Schema migrations must be non-destructive; storage ~60% of disk |
| Existing Dexie schema v2 | `src/db/schema.ts` | New tables added via version upgrades with `upgrade()` backfill |
| Existing Zustand patterns | `docs/project-context.md` | Individual selectors, optimistic updates, no store destructuring |
| Existing component library | 50+ shadcn/ui components | New UI extends existing patterns; `cn()` utility at `src/app/components/ui/utils.ts` |
| `@` import alias → `./src` | `vite.config.ts` | All imports use `@/` prefix |
| Tailwind CSS v4 | `@tailwindcss/vite` plugin | Source scanning via `@source` directive; CSS variables for theming |
| WebGPU ~65% coverage | Browser adoption data | 3-tier fallback: WebGPU → Ollama → Cloud API |

### Cross-Cutting Concerns Identified

1. **State Management Proliferation** — Currently 1 main Zustand store (`useCourseImportStore`). Epics 5-11 need ~5-7 new stores (streaks, challenges, analytics, AI, spaced repetition, settings, onboarding). Store interaction patterns and shared state need architectural guidance.

2. **Dexie Schema Evolution** — Schema must grow from v2 to potentially v6+ across epics. Each version upgrade needs careful `upgrade()` migration. Tables needed: `progress`, `bookmarks`, `streaks`, `challenges`, `sessions`, `ai_chunks`, `ai_embeddings`, `ai_config`, `review_schedule`, `achievements`, `activity_log`.

3. **Web Worker Architecture** — AI subsystem requires 3 dedicated workers (LLM, embeddings, whisper). Communication patterns (postMessage, SharedWorker for multi-tab) need standardization. Worker lifecycle management (load, unload, memory pressure) is critical.

4. **Background Processing** — Multiple features need background computation: embedding indexing on note save, FSRS review scheduling, engagement decay checks, momentum score recalculation, session quality scoring. Need a task scheduling pattern that doesn't block UI.

5. **Export/Portability** — Every data store must be exportable to JSON, CSV, or Markdown. xAPI activity logging adds a cross-cutting concern: every learning action should emit an xAPI-compatible event for future export.

6. **Accessibility as Universal Constraint** — Every new component must satisfy WCAG 2.2 AA: semantic HTML, ARIA, keyboard navigation, 4.5:1 contrast, 24px minimum targets, `prefers-reduced-motion` support. This isn't a feature — it's a constraint on all features.

7. **Memory Budget Enforcement** — AI models (900MB-2.2GB), embedding models (90-200MB), vector indexes (50MB/10K vectors), plus React component trees. Need a global memory monitoring service with eviction policies.

## Starter Template Evaluation

### Primary Technology Domain

**Client-side SPA (React + TypeScript + Vite)** — established brownfield project, not a greenfield starter selection.

### Starter Options Considered

Not applicable — LevelUp is an existing project with 4 completed epics, an established component library, defined patterns, and production infrastructure. The architectural question is not "which starter?" but "how does the existing foundation extend for Epics 5-11?"

### Established Foundation: React 18 + Vite 6 + Tailwind v4

**Rationale:** Foundation already proven through Epics 1-4 (course management, video player, notes, study goals). No reason to migrate or restructure — extend the existing patterns.

**Architectural Decisions Already Established:**

**Language & Runtime:**
- TypeScript (strict mode) with `@` import alias → `./src`
- React 18.3.1 with functional components and hooks
- Vite 6.3.5 for build tooling and dev server

**Styling Solution:**
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- CSS custom properties in `src/styles/theme.css` (OKLCH color space, light/dark mode)
- `tw-animate-css` for animation utilities
- Design tokens: `#FAF5EE` background, `blue-600` primary, `rounded-[24px]` cards

**State Management:**
- Zustand v5 with individual selectors (never destructure full store)
- Optimistic update pattern: Zustand first → Dexie persist → rollback on failure
- One store per domain concern (currently `useCourseImportStore`)

**Data Persistence:**
- Dexie.js v4 wrapping IndexedDB
- Schema versioned with `upgrade()` migration callbacks
- `crypto.randomUUID()` for IDs, ISO 8601 strings for dates

**Testing Framework:**
- Vitest for unit/integration tests
- Playwright for E2E (Chromium local, full matrix in CI)
- `fake-indexeddb` for Dexie.js mocking
- `@testing-library/react` with `userEvent`

**Code Organization:**
- `src/app/pages/` — route-level components
- `src/app/components/ui/` — shadcn/ui library
- `src/app/components/figma/` — custom components
- `src/stores/` — Zustand stores
- `src/db/` — Dexie schema
- `src/lib/` — utility modules
- `src/data/` — static types and data

**Development Experience:**
- Vite HMR for instant dev feedback
- ESLint + Prettier for code quality
- Git hooks via pre-commit
- GitHub Actions CI/CD pipeline

### Extension Points for Epics 5-11

The existing foundation needs these extensions (not replacements):

| Concern | Current State | Extension Needed |
| --- | --- | --- |
| Zustand stores | 1 store (`useCourseImportStore`) | 5-7 new stores (streaks, challenges, analytics, AI, spaced repetition, settings, onboarding) |
| Dexie schema | v2 (courses, videos, PDFs, tags) | v3+ adding progress, bookmarks, sessions, streaks, challenges, AI tables, review schedules, activity log |
| Web Workers | None | 3 dedicated workers for AI (LLM, embeddings, whisper) |
| Route structure | 7 pages (Overview, MyClass, Courses, Messages, Instructors, Reports, Settings) | New routes for analytics dashboard, AI panel, review queue, onboarding flow |
| Component library | 50+ shadcn/ui components | New custom components: heatmap, momentum gauge, review card, AI chat panel, insight cards |
| Build configuration | Standard Vite + React + Tailwind | Lazy-load AI packages (~7MB), Web Worker bundling, WASM integration for whisper.cpp |

**Note:** No project re-initialization needed. All changes are additive extensions to the existing architecture.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Dexie schema versioning strategy (per-epic migrations)
- Worker communication protocol (typed messages)
- Zustand store organization (independent stores)
- AI 3-tier fallback routing

**Important Decisions (Shape Architecture):**
- Activity logging format (lightweight + xAPI transform)
- Computed metrics caching strategy (hybrid)
- API key encryption (Web Crypto AES-GCM)
- Worker abstraction pattern (hook-per-worker)
- Component architecture (compound components)

**Deferred Decisions (Post-MVP):**
- SharedWorker for multi-tab sync (not needed until multi-tab usage patterns emerge)
- Service Worker caching for offline model access (nice-to-have, not MVP)
- Progressive Web App manifest (can add later without architectural changes)

### Data Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Schema versioning | Per-epic (v3, v4, v5...) | Clean migration boundaries; one `upgrade()` per epic |
| Activity logging | Lightweight events + xAPI transform on export | ~10x smaller storage; xAPI overhead unnecessary for runtime |
| Computed metrics | Hybrid (on-read simple, cached expensive) | Balance between freshness and performance; momentum/velocity cached with staleness tracking |
| ID generation | `crypto.randomUUID()` (existing) | Already established in project-context.md |
| Date format | ISO 8601 strings (existing) | Already established in project-context.md |

**New Dexie Tables (projected across Epics 5-11):**
`progress`, `bookmarks`, `sessions`, `streaks`, `challenges`, `achievements`, `ai_chunks`, `ai_embeddings`, `ai_config`, `review_schedule`, `activity_log`, `computed_metrics`, `settings`, `onboarding_state`

### Authentication & Security

| Decision | Choice | Rationale |
|---|---|---|
| Authentication | None (single-user local app) | No backend, no multi-user, no server |
| API key storage | Web Crypto API (AES-GCM, non-extractable CryptoKey) | SubtleCrypto provides browser-native encryption; PBKDF2 key derivation from user passphrase |
| Content Security Policy | `worker-src blob:`, `wasm-unsafe-eval`, `connect-src localhost:11434` | Minimum permissions for WebGPU workers, WASM, and Ollama |
| AI consent | Per-feature toggle with tier indicator badges | PRD requirement: users choose which AI features to enable and which tier (local/Ollama/cloud) |

### API & Communication Patterns

| Decision | Choice | Rationale |
|---|---|---|
| Worker protocol | Typed discriminated union messages | Type-safe communication: `{type: 'inference'\|'progress'\|'result'\|'error', ...}` |
| LLM Worker | WebLLM `ServiceWorkerMLCEngine` pattern | Built-in message passing; OpenAI-compatible request/response format |
| Embedding Worker | Dedicated worker with Transformers.js | Separate memory budget; independent lifecycle from LLM |
| Transcription Worker | Dedicated worker with whisper.cpp WASM | Heavy WASM computation isolated; loaded only on demand |
| Ollama integration | Direct `fetch()` to `localhost:11434` | Simple HTTP, OpenAI-compatible API, no abstraction needed |
| Error handling | Result type pattern (`{success, data\|error}`) | Errors can't propagate across Worker `postMessage` boundaries |
| Worker lifecycle | Lazy init on first use, evict under memory pressure | Prevents ~2GB upfront allocation; `measureUserAgentSpecificMemory()` triggers eviction |

### Frontend Architecture

| Decision | Choice | Rationale |
|---|---|---|
| Store organization | Independent stores (one per domain) | Matches existing `useCourseImportStore` pattern; cross-store via `getState()` |
| New stores | `useStreakStore`, `useChallengeStore`, `useAnalyticsStore`, `useAIStore`, `useSpacedRepStore`, `useSettingsStore`, `useOnboardingStore` | One per epic/domain concern |
| Worker hooks | `useAIInference()`, `useEmbeddings()`, `useTranscription()` | Encapsulate Worker lifecycle, loading states, message passing |
| Code splitting | `React.lazy()` + route-based dynamic imports | AI packages (~7MB) lazy-loaded; analytics/review/onboarding routes split |
| Component pattern | Compound components for complex UI | `<Heatmap.Grid>`, `<ReviewCard.Front>` etc.; extends shadcn/ui patterns |
| State sync | Zustand → Dexie optimistic updates (existing) | Already established pattern; no change needed |

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|---|---|---|
| WASM loading | `WebAssembly.instantiateStreaming()` from `/public/wasm/` | Efficient streaming compilation; Vite serves from public directory |
| Worker bundling | Vite native `new Worker(new URL(...))` | Built-in bundling as separate entry points; no plugin needed |
| Model hosting | Hugging Face Hub CDN (cached locally after first download) | Standard for WebLLM/Transformers.js; ~900MB-2.2GB cached in browser |
| Static hosting | GitHub Pages (existing CI/CD) | No changes needed; WASM and models fetched separately |
| Memory monitoring | `performance.measureUserAgentSpecificMemory()` | Chrome-only API (matches browser target); 3GB ceiling with auto-downgrade |
| Performance tracking | `PerformanceObserver` for Core Web Vitals | FCP < 2s, LCP monitoring, interaction responsiveness |

### Decision Impact Analysis

**Implementation Sequence:**
1. Dexie schema v3 migration framework (enables all data features)
2. Zustand store pattern establishment (first new store sets template)
3. Web Worker communication protocol (typed messages)
4. Worker lifecycle management hooks
5. Route-based code splitting setup
6. AI subsystem integration (WebLLM + embeddings + vector store)
7. WASM integration for whisper.cpp
8. Memory monitoring service
9. Activity logging infrastructure
10. Computed metrics caching layer

**Cross-Component Dependencies:**
- Worker hooks depend on typed message protocol
- AI stores depend on Worker hooks for state management
- Computed metrics cache depends on activity logging (invalidation triggers)
- Code splitting affects all new route pages (analytics, AI, review, onboarding)
- Memory monitoring affects all Worker lifecycle decisions (eviction policies)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 12 areas where AI agents could make different choices. Existing patterns from `docs/project-context.md` are confirmed; new patterns below extend them for Epics 5-11.

### Naming Patterns

**Dexie Table Naming:**

- Convention: `snake_case`, plural nouns
- Examples: `streaks`, `challenges`, `sessions`, `ai_chunks`, `ai_embeddings`, `review_schedule`, `activity_log`, `computed_metrics`
- Compound tables use underscore separation: `ai_chunks` not `aichunks` or `AIChunks`
- Index fields: camelCase to match TypeScript property names (`courseId`, `createdAt`)

**Zustand Store Naming:**

- Convention: `use[Domain]Store` — PascalCase domain noun
- Examples: `useStreakStore`, `useChallengeStore`, `useAnalyticsStore`, `useAIStore`, `useSpacedRepStore`, `useSettingsStore`, `useOnboardingStore`
- File naming: matches store name — `useStreakStore.ts` in `src/stores/`
- Actions inside store: `verbNoun` — `calculateStreak()`, `freezeDay()`, `resetChallenge()`

**Worker File Naming:**

- Convention: `[domain].worker.ts` in `src/workers/`
- Examples: `llm.worker.ts`, `embeddings.worker.ts`, `transcription.worker.ts`
- Message types: `[Domain]WorkerMessage` and `[Domain]WorkerResponse`

**Service File Naming:**

- Convention: `[domain]Service.ts` in `src/lib/services/`
- Examples: `streakService.ts`, `momentumService.ts`, `analyticsService.ts`, `fsrsService.ts`
- Pure functions, no React dependencies — importable from stores, workers, and tests

**Component Naming (unchanged from existing):**

- PascalCase for components: `MomentumGauge.tsx`, `StreakCalendar.tsx`, `ReviewCard.tsx`
- Custom components: `src/app/components/figma/` for complex domain components
- Compound component parts: `Heatmap.tsx` exports `Heatmap.Grid`, `Heatmap.Cell`, `Heatmap.Legend`

**Type Naming:**

- Interfaces for Dexie records: `I[TableName]` — `IStreak`, `IChallenge`, `ISession`, `IAIChunk`
- Zustand state types: `[Store]State` — `StreakState`, `ChallengeState`
- Worker message types: discriminated unions with `type` field
- Enum-like constants: `as const` objects, not TypeScript `enum`

### Structure Patterns

**New Directory Structure (additive to existing):**

```
src/
├── workers/                    # Web Worker entry points
│   ├── llm.worker.ts
│   ├── embeddings.worker.ts
│   └── transcription.worker.ts
├── lib/
│   ├── services/               # Pure business logic (no React)
│   │   ├── streakService.ts
│   │   ├── momentumService.ts
│   │   ├── analyticsService.ts
│   │   ├── fsrsService.ts
│   │   └── exportService.ts
│   └── workers/                # Worker communication hooks
│       ├── useAIInference.ts
│       ├── useEmbeddings.ts
│       └── useTranscription.ts
├── stores/                     # New Zustand stores alongside existing
│   ├── useCourseImportStore.ts # (existing)
│   ├── useStreakStore.ts
│   ├── useChallengeStore.ts
│   ├── useAnalyticsStore.ts
│   ├── useAIStore.ts
│   ├── useSpacedRepStore.ts
│   ├── useSettingsStore.ts
│   └── useOnboardingStore.ts
└── app/
    └── components/
        └── figma/              # New complex domain components
            ├── HeatmapGrid.tsx
            ├── MomentumGauge.tsx
            ├── ReviewCard.tsx
            ├── AIChatPanel.tsx
            ├── InsightCard.tsx
            └── StreakCalendar.tsx
```

**Test Organization (extends existing):**

- Unit tests: co-located — `streakService.test.ts` next to `streakService.ts`
- Store tests: `src/stores/__tests__/useStreakStore.test.ts`
- Worker tests: `src/workers/__tests__/llm.worker.test.ts` (mocked with `vi.fn()`)
- E2E tests: `tests/e2e/` (existing pattern, one spec per story)
- Test factories: `tests/support/factories/` — `makeStreak()`, `makeChallenge()`, `makeSession()`

### Format Patterns

**Worker Message Format:**

```typescript
// Request messages (main → worker)
type WorkerRequest =
  | { type: 'init'; config: ModelConfig }
  | { type: 'inference'; prompt: string; options?: InferenceOptions }
  | { type: 'abort' }
  | { type: 'unload' }

// Response messages (worker → main)
type WorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; percent: number; stage: string }
  | { type: 'result'; data: unknown }
  | { type: 'error'; message: string; code: string }
  | { type: 'metrics'; memoryUsage: number }
```

**Result Type Pattern (all service functions):**

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; code: string } }

// Usage
const result = await streakService.calculateStreak(userId)
if (!result.success) { /* handle error */ }
```

**Activity Log Event Format:**

```typescript
interface ActivityEvent {
  id: string                    // crypto.randomUUID()
  type: string                  // 'video.completed' | 'note.created' | 'review.answered'
  entityType: string            // 'video' | 'note' | 'challenge'
  entityId: string              // FK to relevant record
  timestamp: string             // ISO 8601
  payload: Record<string, unknown>  // Event-specific data
}
```

**Computed Metrics Cache Format:**

```typescript
interface CachedMetric {
  id: string                    // '{metricType}:{entityId}'
  metricType: string            // 'momentum' | 'velocity' | 'engagement_decay'
  entityId: string              // Course/user scope
  value: number
  lastCalculated: string        // ISO 8601
  invalidatedBy: string[]       // Event types that trigger recalculation
}
```

### Communication Patterns

**Cross-Store Communication:**

- Stores read from other stores via `use[Other]Store.getState()` inside actions
- Never subscribe to another store from within a store — use React components to bridge
- Shared derived state computed in the consuming component, not in stores

```typescript
// CORRECT — read cross-store in action
const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  calculateVelocity: (courseId: string) => {
    const sessions = useAnalyticsStore.getState().sessions
    const progress = useCourseImportStore.getState().getProgress(courseId)
    // compute...
  }
}))

// WRONG — subscribing to another store inside a store
const useAnalyticsStore = create<AnalyticsState>((set) => {
  useCourseImportStore.subscribe(/* DON'T */)
})
```

**Worker Lifecycle Protocol:**

1. Component mounts → hook initializes Worker lazily
2. Worker posts `{type: 'ready'}` when initialized
3. Main thread sends requests; worker streams `progress` then `result` or `error`
4. On memory pressure: main thread sends `{type: 'unload'}`; worker terminates model, posts `{type: 'metrics', memoryUsage: 0}`
5. Component unmounts → hook terminates Worker if no other consumers

**Background Task Scheduling:**

- Use `requestIdleCallback()` for non-urgent background tasks (embedding indexing, metric recalculation)
- Use `setTimeout(fn, 0)` for deferred but timely tasks (session quality scoring after session end)
- Never use `setInterval()` for recurring calculations — use event-driven invalidation instead

### Process Patterns

**Error Handling Hierarchy:**

1. **Service layer**: Return `Result<T>` — never throw
2. **Store layer**: Handle `Result` errors, update error state, trigger toast via Sonner
3. **Worker layer**: Catch all errors, post `{type: 'error'}` message — never let errors crash the worker
4. **Component layer**: React Error Boundaries wrap each major feature section
5. **User-facing errors**: Use Sonner toast with actionable messages — never show raw error messages or stack traces

```typescript
// Error boundary placement
<ErrorBoundary fallback={<FeatureErrorFallback feature="analytics" />}>
  <AnalyticsDashboard />
</ErrorBoundary>
```

**Loading State Pattern:**

```typescript
// Every async operation in stores follows this shape
interface AsyncState {
  isLoading: boolean
  error: string | null
}

// Store actions manage loading states
const useAIStore = create<AIState>((set) => ({
  inferenceState: { isLoading: false, error: null },
  runInference: async (prompt: string) => {
    set({ inferenceState: { isLoading: true, error: null } })
    const result = await aiService.infer(prompt)
    if (result.success) {
      set({ inferenceState: { isLoading: false, error: null }, lastResult: result.data })
    } else {
      set({ inferenceState: { isLoading: false, error: result.error.message } })
    }
  }
}))
```

**Validation Pattern:**

- Validate at system boundaries only: user input, file import, Worker messages
- Internal service-to-service calls trust input (already validated at boundary)
- Use Zod schemas for runtime validation of external data (file imports, Ollama responses, xAPI export)

### Enforcement Guidelines

**All AI Agents MUST:**

1. Follow Zustand individual selector pattern — never destructure stores
2. Use `Result<T>` return type for all service functions
3. Use typed discriminated unions for all Worker messages
4. Place services in `src/lib/services/`, workers in `src/workers/`, stores in `src/stores/`
5. Use `crypto.randomUUID()` for IDs and ISO 8601 for dates
6. Include WCAG 2.2 AA compliance on every new component (semantic HTML, ARIA, keyboard, contrast, reduced motion)
7. Use `requestIdleCallback()` for background computations, not `setInterval()`
8. Wrap feature sections in React Error Boundaries
9. Use Sonner toast for user-facing error notifications
10. Co-locate unit tests; E2E tests in `tests/e2e/`

**Pattern Verification:**

- ESLint rules enforce import aliases (`@/`) and no `console.log` in production
- Vitest tests verify store patterns (individual selectors, optimistic updates)
- PR code review checks for pattern adherence (via `/review-story` workflow)

### Pattern Examples

**Good Example — New Store:**

```typescript
// src/stores/useStreakStore.ts
import { create } from 'zustand'
import { db } from '@/db/schema'
import { streakService } from '@/lib/services/streakService'
import type { Result } from '@/lib/types'

interface StreakState {
  currentStreak: number
  longestStreak: number
  isLoading: boolean
  error: string | null
  calculateStreak: () => Promise<void>
  freezeDay: (date: string) => Promise<void>
}

export const useStreakStore = create<StreakState>((set, get) => ({
  currentStreak: 0,
  longestStreak: 0,
  isLoading: false,
  error: null,
  calculateStreak: async () => {
    set({ isLoading: true, error: null })
    const result = await streakService.calculate()
    if (result.success) {
      set({ currentStreak: result.data.current, longestStreak: result.data.longest, isLoading: false })
    } else {
      set({ error: result.error.message, isLoading: false })
    }
  },
  freezeDay: async (date: string) => {
    const old = get().currentStreak
    set({ currentStreak: old }) // optimistic (no change expected)
    const result = await streakService.freeze(date)
    if (!result.success) {
      set({ error: result.error.message })
    }
  }
}))
```

**Anti-Patterns:**

```typescript
// ❌ Destructuring full store
const { currentStreak, freezeDay } = useStreakStore()

// ❌ Throwing in service
function calculate() { throw new Error('fail') } // Use Result<T> instead

// ❌ setInterval for background work
setInterval(() => recalcMetrics(), 60000) // Use requestIdleCallback + event-driven

// ❌ Raw error to user
toast.error(error.stack) // Show actionable message instead

// ❌ Worker without typed messages
worker.postMessage({ action: 'go', data: stuff }) // Use discriminated union type
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
Elearningplatformwireframes/
├── .github/workflows/              # CI/CD pipelines
│   ├── ci.yml
│   └── design-review.yml
├── docs/                            # Documentation (existing)
│   ├── planning-artifacts/          # PRD, epics, UX specs
│   ├── implementation-artifacts/    # Story files, sprint tracking
│   ├── reviews/                     # Design + code review reports
│   ├── research/                    # Technical + domain research
│   └── plans/                       # Implementation plans
├── tests/
│   ├── e2e/                         # Playwright E2E specs (one per story)
│   │   └── regression/              # Archived story specs
│   └── support/
│       └── factories/               # Test data factories (NEW)
│           ├── makeCourse.ts
│           ├── makeStreak.ts         # (NEW - Epic 5)
│           ├── makeChallenge.ts      # (NEW - Epic 6)
│           ├── makeSession.ts        # (NEW - Epic 7)
│           ├── makeAIChunk.ts        # (NEW - Epic 8)
│           └── makeReviewCard.ts     # (NEW - Epic 9)
├── public/
│   ├── assets/                      # Static images, icons
│   └── wasm/                        # WASM binaries (NEW - Epic 8)
│       └── whisper/                  # whisper.cpp WASM files
├── scripts/                         # Build and utility scripts
├── src/
│   ├── main.tsx                     # App entry point
│   ├── app/
│   │   ├── App.tsx                  # Root component with RouterProvider
│   │   ├── routes.tsx               # React Router configuration
│   │   ├── components/
│   │   │   ├── Layout.tsx           # Main layout (sidebar + header)
│   │   │   ├── ui/                  # shadcn/ui library (~50 components)
│   │   │   │   ├── utils.ts         # cn() utility
│   │   │   │   └── ...
│   │   │   ├── figma/               # Custom domain components
│   │   │   │   ├── VideoPlayer.tsx           # (existing)
│   │   │   │   ├── ImportedCourseCard.tsx     # (existing)
│   │   │   │   ├── PdfViewer/                # (existing)
│   │   │   │   ├── StreakCalendar.tsx         # (NEW - Epic 5)
│   │   │   │   ├── MomentumGauge.tsx         # (NEW - Epic 5)
│   │   │   │   ├── ChallengeCard.tsx         # (NEW - Epic 6)
│   │   │   │   ├── HeatmapGrid.tsx           # (NEW - Epic 7)
│   │   │   │   ├── InsightCard.tsx           # (NEW - Epic 7)
│   │   │   │   ├── AIChatPanel.tsx           # (NEW - Epic 8)
│   │   │   │   ├── SourceCitation.tsx        # (NEW - Epic 8)
│   │   │   │   ├── ReviewCard.tsx            # (NEW - Epic 9)
│   │   │   │   ├── OnboardingWizard.tsx      # (NEW - Epic 10)
│   │   │   │   └── AchievementBadge.tsx      # (NEW - Epic 11)
│   │   │   ├── navigation/          # Navigation components
│   │   │   ├── notes/               # Markdown editor components
│   │   │   ├── charts/              # Chart components
│   │   │   ├── celebrations/        # Celebration animations
│   │   │   └── errors/              # Error boundary components (NEW)
│   │   │       └── FeatureErrorFallback.tsx
│   │   ├── hooks/                   # App-scoped React hooks
│   │   │   ├── useMediaQuery.ts     # (existing)
│   │   │   └── useIdleDetection.ts  # (existing)
│   │   ├── config/                  # App configuration
│   │   └── pages/                   # Route-level components
│   │       ├── Overview.tsx                  # (existing)
│   │       ├── Courses.tsx                   # (existing)
│   │       ├── CourseDetail.tsx              # (existing)
│   │       ├── ImportedLessonPlayer.tsx      # (existing)
│   │       ├── Notes.tsx                     # (existing)
│   │       ├── Reports.tsx                   # (existing)
│   │       ├── Settings.tsx                  # (existing)
│   │       ├── SessionHistory.tsx           # (existing)
│   │       ├── AnalyticsDashboard.tsx        # (NEW - Epic 7, lazy-loaded)
│   │       ├── AIAssistant.tsx              # (NEW - Epic 8, lazy-loaded)
│   │       ├── ReviewQueue.tsx              # (NEW - Epic 9, lazy-loaded)
│   │       └── Onboarding.tsx               # (NEW - Epic 10, lazy-loaded)
│   ├── data/                        # Static types and data
│   │   ├── types.ts                 # Existing static course types
│   │   └── courses/                 # Static course data
│   ├── db/                          # Dexie database layer
│   │   ├── schema.ts                # Schema definition + migrations
│   │   ├── index.ts                 # DB instance export
│   │   └── __tests__/
│   ├── hooks/                       # Global React hooks
│   │   ├── useCourseCardPreview.ts  # (existing)
│   │   ├── useHoverPreview.ts       # (existing)
│   │   └── useVideoFromHandle.ts    # (existing)
│   ├── lib/                         # Utility modules
│   │   ├── courseImport.ts          # (existing)
│   │   ├── fileSystem.ts            # (existing)
│   │   ├── progress.ts              # (existing)
│   │   ├── bookmarks.ts             # (existing)
│   │   ├── studyGoals.ts            # (existing)
│   │   ├── persistWithRetry.ts      # (existing)
│   │   ├── dateUtils.ts             # (existing)
│   │   ├── errorTracking.ts         # (existing)
│   │   ├── performanceMonitoring.ts # (existing)
│   │   ├── __tests__/
│   │   ├── services/                # Pure business logic (NEW)
│   │   │   ├── streakService.ts             # (NEW - Epic 5)
│   │   │   ├── momentumService.ts           # (NEW - Epic 5)
│   │   │   ├── challengeService.ts          # (NEW - Epic 6)
│   │   │   ├── analyticsService.ts          # (NEW - Epic 7)
│   │   │   ├── sessionQualityService.ts     # (NEW - Epic 7)
│   │   │   ├── aiInferenceService.ts        # (NEW - Epic 8)
│   │   │   ├── ragService.ts                # (NEW - Epic 8)
│   │   │   ├── embeddingService.ts          # (NEW - Epic 8)
│   │   │   ├── fsrsService.ts               # (NEW - Epic 9)
│   │   │   ├── exportService.ts             # (NEW - Epic 11)
│   │   │   ├── activityLogService.ts        # (NEW - cross-cutting)
│   │   │   ├── memoryMonitorService.ts      # (NEW - cross-cutting)
│   │   │   └── __tests__/
│   │   └── workers/                 # Worker communication hooks (NEW)
│   │       ├── useAIInference.ts
│   │       ├── useEmbeddings.ts
│   │       └── useTranscription.ts
│   ├── stores/                      # Zustand stores
│   │   ├── useCourseImportStore.ts  # (existing)
│   │   ├── useContentProgressStore.ts # (existing)
│   │   ├── useBookmarkStore.ts      # (existing)
│   │   ├── useNoteStore.ts          # (existing)
│   │   ├── useSessionStore.ts       # (existing)
│   │   ├── useStreakStore.ts         # (NEW - Epic 5)
│   │   ├── useChallengeStore.ts     # (NEW - Epic 6)
│   │   ├── useAnalyticsStore.ts     # (NEW - Epic 7)
│   │   ├── useAIStore.ts            # (NEW - Epic 8)
│   │   ├── useSpacedRepStore.ts     # (NEW - Epic 9)
│   │   ├── useOnboardingStore.ts    # (NEW - Epic 10)
│   │   ├── useSettingsStore.ts      # (NEW - Epic 11)
│   │   └── __tests__/
│   ├── types/                       # Shared TypeScript types (NEW)
│   │   ├── result.ts                # Result<T> type
│   │   ├── worker.ts                # Worker message types
│   │   └── activity.ts              # ActivityEvent type
│   ├── workers/                     # Web Worker entry points (NEW)
│   │   ├── llm.worker.ts            # (NEW - Epic 8)
│   │   ├── embeddings.worker.ts     # (NEW - Epic 8)
│   │   ├── transcription.worker.ts  # (NEW - Epic 8)
│   │   └── __tests__/
│   ├── styles/
│   │   ├── index.css                # Main CSS entry
│   │   ├── tailwind.css             # Tailwind v4 config
│   │   ├── theme.css                # CSS custom properties
│   │   └── fonts.css                # Font definitions
│   └── test/                        # Test utilities
├── package.json
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── playwright.config.ts
└── CLAUDE.md
```

### Architectural Boundaries

**Data Layer Boundary:**

```text
┌─────────────────────────────────────────────────────┐
│  React Components (pages, figma components)          │
│  ↕ Zustand selectors (read) + actions (write)        │
├──────────────────────────────────────────────────────┤
│  Zustand Stores (src/stores/)                        │
│  ↕ Import services for business logic                │
│  ↕ Persist to Dexie via optimistic update pattern    │
├──────────────────────────────────────────────────────┤
│  Services (src/lib/services/)                        │
│  ↕ Pure functions, return Result<T>                  │
│  ↕ Read/write Dexie directly for complex queries     │
├──────────────────────────────────────────────────────┤
│  Dexie.js (src/db/)                                  │
│  ↕ IndexedDB                                         │
└──────────────────────────────────────────────────────┘
```

**Worker Boundary:**

```text
┌─ Main Thread ──────────────────────┐    ┌─ Worker Thread ────────────┐
│  Worker Hooks (src/lib/workers/)   │    │  Worker Entry Point        │
│  useAIInference()                  │◄──►│  llm.worker.ts             │
│  useEmbeddings()                   │◄──►│  embeddings.worker.ts      │
│  useTranscription()                │◄──►│  transcription.worker.ts   │
│                                    │    │                            │
│  Typed postMessage (WorkerRequest) │───►│  onmessage handler         │
│  onmessage (WorkerResponse)       │◄───│  postMessage response      │
└────────────────────────────────────┘    └────────────────────────────┘
```

**Component Boundary Rules:**

- Pages import from stores (Zustand selectors) and figma components — never from services directly
- Figma components receive data via props — never import stores directly (exception: top-level widget containers)
- Services never import React or Zustand — pure TypeScript functions
- Workers never import from stores or services — self-contained with message protocol
- `src/types/` shared across all layers

**State Ownership:**

| Store | Owns | Reads From |
|---|---|---|
| `useCourseImportStore` | Courses, videos, PDFs, tags | — |
| `useContentProgressStore` | Progress records, completion state | `useCourseImportStore` |
| `useBookmarkStore` | Bookmarks | `useCourseImportStore` |
| `useNoteStore` | Notes, note search | `useCourseImportStore` |
| `useSessionStore` | Study sessions, session history | `useCourseImportStore` |
| `useStreakStore` | Streaks, freeze days | `useSessionStore` |
| `useChallengeStore` | Challenges, milestones | `useContentProgressStore`, `useSessionStore` |
| `useAnalyticsStore` | Analytics, computed metrics | `useSessionStore`, `useContentProgressStore` |
| `useAIStore` | AI config, inference state, RAG results | Worker hooks |
| `useSpacedRepStore` | Review schedule, FSRS state | `useNoteStore` |
| `useOnboardingStore` | Onboarding state, tutorial progress | All stores (read-only checks) |
| `useSettingsStore` | User preferences, AI tier config, export | — |

### Requirements to Structure Mapping

**Epic 5 (Gamification) → Files:**

- `src/stores/useStreakStore.ts` — streak state and freeze mechanics
- `src/lib/services/streakService.ts` — streak calculation logic
- `src/lib/services/momentumService.ts` — momentum scoring algorithm
- `src/app/components/figma/StreakCalendar.tsx` — calendar visualization
- `src/app/components/figma/MomentumGauge.tsx` — momentum score display
- `src/db/schema.ts` — v3 migration (streaks table)

**Epic 6 (Learning Challenges) → Files:**

- `src/stores/useChallengeStore.ts` — challenge state
- `src/lib/services/challengeService.ts` — goal tracking, milestone detection
- `src/app/components/figma/ChallengeCard.tsx` — challenge UI
- `src/db/schema.ts` — v4 migration (challenges, achievements tables)

**Epic 7 (Analytics & Insights) → Files:**

- `src/stores/useAnalyticsStore.ts` — analytics state + computed metrics
- `src/lib/services/analyticsService.ts` — engagement decay, velocity metrics
- `src/lib/services/sessionQualityService.ts` — session quality scoring
- `src/app/pages/AnalyticsDashboard.tsx` — analytics route (lazy-loaded)
- `src/app/components/figma/HeatmapGrid.tsx` — activity heatmap
- `src/app/components/figma/InsightCard.tsx` — insight display
- `src/db/schema.ts` — v5 migration (sessions, computed_metrics tables)

**Epic 8 (AI Assistant) → Files:**

- `src/stores/useAIStore.ts` — AI config, inference state
- `src/lib/services/aiInferenceService.ts` — inference orchestration + 3-tier fallback
- `src/lib/services/ragService.ts` — RAG pipeline + chunking
- `src/lib/services/embeddingService.ts` — embedding generation
- `src/workers/llm.worker.ts` — WebLLM worker
- `src/workers/embeddings.worker.ts` — Transformers.js worker
- `src/workers/transcription.worker.ts` — whisper.cpp worker
- `src/app/pages/AIAssistant.tsx` — AI route (lazy-loaded)
- `src/app/components/figma/AIChatPanel.tsx` — chat interface
- `src/app/components/figma/SourceCitation.tsx` — RAG source display
- `public/wasm/whisper/` — WASM binaries
- `src/db/schema.ts` — v6 migration (ai_chunks, ai_embeddings, ai_config tables)

**Epic 9 (Spaced Repetition) → Files:**

- `src/stores/useSpacedRepStore.ts` — review schedule state
- `src/lib/services/fsrsService.ts` — FSRS algorithm (ts-fsrs wrapper)
- `src/app/pages/ReviewQueue.tsx` — review route (lazy-loaded)
- `src/app/components/figma/ReviewCard.tsx` — review card UI
- `src/db/schema.ts` — v7 migration (review_schedule table)

**Epic 10 (Onboarding) → Files:**

- `src/stores/useOnboardingStore.ts` — onboarding state
- `src/app/pages/Onboarding.tsx` — onboarding route (lazy-loaded)
- `src/app/components/figma/OnboardingWizard.tsx` — wizard component
- `src/db/schema.ts` — v8 migration (onboarding_state table)

**Epic 11 (Data Portability & Settings) → Files:**

- `src/stores/useSettingsStore.ts` — settings state
- `src/lib/services/exportService.ts` — JSON/CSV/Markdown export + xAPI transform
- `src/lib/services/activityLogService.ts` — activity event recording
- `src/app/components/figma/AchievementBadge.tsx` — Open Badges display
- `src/db/schema.ts` — v9 migration (activity_log, settings tables)

**Cross-Cutting Services:**

- `src/lib/services/activityLogService.ts` — event recording (used by all epics)
- `src/lib/services/memoryMonitorService.ts` — memory budget enforcement (Epic 8+)
- `src/types/result.ts` — shared Result<T> type (all services)
- `src/types/worker.ts` — shared Worker message types (Epic 8)
- `src/types/activity.ts` — ActivityEvent type (all epics)
- `src/app/components/errors/FeatureErrorFallback.tsx` — error boundary fallback (all pages)

### Data Flow

```text
User Action → React Component → Zustand Action → Service (business logic)
                                      ↓                    ↓
                               Optimistic UI          Dexie Persist
                                      ↓                    ↓
                               Re-render              Activity Log Event
                                                           ↓
                                                  Metric Invalidation
                                                  (requestIdleCallback)
```

**AI Data Flow:**

```text
User Query → useAIStore.query() → useAIInference() hook
                                       ↓
                                  llm.worker.ts (postMessage)
                                       ↓
                              WebLLM / Ollama / Cloud API
                                       ↓
                              Worker Response (result/error)
                                       ↓
                              useAIStore updates state
                                       ↓
                              AIChatPanel re-renders
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All technology choices verified compatible. React 18 + Vite 6 + Tailwind v4 foundation extends cleanly for Epics 5-11. Zustand v5 independent stores + Dexie v4 optimistic updates work together without conflicts. Web Worker bundling via Vite native support confirmed. WebLLM, Transformers.js, and whisper.cpp WASM all operate in isolated Worker threads with typed message protocols.

**Pattern Consistency:** Naming conventions are uniform across all layers (camelCase TypeScript, snake_case Dexie tables, PascalCase components). Result<T> pattern used consistently in all services. Error handling hierarchy (Service → Store → Component → User) has no gaps.

**Structure Alignment:** Project structure supports all architectural decisions. Every component has a defined home directory. Worker hook abstraction cleanly bridges main/worker thread boundary. State ownership matrix shows no circular dependencies between stores.

### Requirements Coverage Validation

**Epic Coverage:** All 7 remaining epics (5-11) have complete architectural support — stores, services, components, Dexie migrations, and page routes mapped. Epic 23 (YouTube Course Builder) added via 2026-03-25 addendum with 10 decision areas, 3 new Dexie tables, and 12-story implementation sequence.

**Functional Requirements (101 FRs):** All FR categories have architectural homes. Course management (existing), content viewing (existing), progress tracking (existing + extensions), gamification (Epic 5 stores/services), challenges (Epic 6), analytics (Epic 7 lazy-loaded page + computed metrics), AI assistant (Epic 8 workers + RAG + 3-tier fallback), spaced repetition (Epic 9 FSRS), onboarding (Epic 10), data portability (Epic 11 export + xAPI).

**Non-Functional Requirements (68 NFRs):** All architecturally critical NFRs addressed — performance (code splitting, lazy loading), bundle size (dynamic imports), memory (monitoring + eviction), accessibility (WCAG 2.2 AA enforcement), data integrity (migrations + rollback), privacy (local-first + encryption), AI quality (RAG-only + attribution).

### Implementation Readiness Validation

**Decision Completeness:** All critical and important decisions documented with specific technology choices, versions, and rationale. Implementation sequence defined (10-step priority order).

**Structure Completeness:** Full project tree defined with existing files preserved and all new files mapped to specific epics. Integration boundaries documented with ASCII diagrams.

**Pattern Completeness:** 12 conflict points addressed. Concrete code examples provided for stores, services, workers, and anti-patterns. Enforcement guidelines list 10 mandatory rules.

### Gap Analysis Results

**Critical Gaps:** None found. (YouTube Course Builder gaps addressed in 2026-03-25 addendum.)

**Important Gaps (2):**

1. **Vector search integration** — MeMemo HNSW library location not explicitly mapped. Resolution: used within `ragService.ts` and `embeddingService.ts`; vector index stored in `ai_embeddings` Dexie table.
2. **Dexie version numbering offset** — Schema currently at v2; Epic 2 planned v3 for progress/bookmarks. Epics 5-11 would be v4-v10. Per-epic principle holds; numbering shifts by one.

**Nice-to-Have Gaps (1):**

1. **Worker ref-counting** — Multiple components sharing a worker hook need explicit consumer counting for lifecycle management. Can be addressed during Epic 8 implementation.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed (101 FRs, 68 NFRs)
- [x] Scale and complexity assessed (HIGH — 11 epics, 8-10 subsystems)
- [x] Technical constraints identified (Chrome-only, no backend, IndexedDB)
- [x] Cross-cutting concerns mapped (7 concerns)

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified (React 18, Vite 6, Tailwind v4, Zustand v5, Dexie v4)
- [x] Integration patterns defined (Worker protocol, cross-store communication)
- [x] Performance considerations addressed (code splitting, memory monitoring, lazy loading)

**Implementation Patterns**

- [x] Naming conventions established (12 conflict points resolved)
- [x] Structure patterns defined (directory layout, test organization)
- [x] Communication patterns specified (Worker lifecycle, cross-store reads)
- [x] Process patterns documented (error handling, loading states, validation)

**Project Structure**

- [x] Complete directory structure defined (existing + new files)
- [x] Component boundaries established (data layer, worker boundary, state ownership)
- [x] Integration points mapped (data flow diagrams)
- [x] Requirements to structure mapping complete (all 7 epics mapped)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH — brownfield project with proven foundation; all extensions are additive.

**Key Strengths:**

- Builds on 4 epics of proven patterns — no speculative architecture
- Clear separation of concerns (stores → services → Dexie)
- Worker isolation prevents AI subsystem from blocking UI
- Memory monitoring with graceful degradation for resource-constrained devices
- Per-epic Dexie migrations enable incremental delivery

**Areas for Future Enhancement:**

- SharedWorker for multi-tab coordination (deferred post-MVP)
- Service Worker for offline model caching (nice-to-have)
- PWA manifest for installable experience (can add without architectural changes)
- Worker ref-counting mechanism (refine during Epic 8)

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions
- Check `docs/project-context.md` for existing rules that still apply

**First Implementation Priority:** Epic 5 (Gamification) — establishes the first new Zustand store, first new service, and first Dexie migration, setting the template for all subsequent epics.

---

## YouTube Course Builder Architecture (Epic 23)

_Added 2026-03-25. This section extends the architecture for YouTube Course Builder (MVP Feature 12, FR112–FR123, NFR69–NFR74). YouTube introduces the first server-side dependency in Knowlune's previously client-only architecture._

**Input Documents:**
- PRD: Feature 12, FR112–FR123, NFR69–NFR74
- Technical research: `_bmad-output/planning-artifacts/research/technical-youtube-content-handling-research-2026-03-25.md`
- Market research: `_bmad-output/planning-artifacts/research/market-youtube-content-handling-research-2026-03-25.md`
- UX spec: YouTube Course Builder section (`_bmad-output/planning-artifacts/ux-design-specification.md`, lines 1282–1579)
- Office hours: `docs/design/office-hours-2026-03-25-full-platform-youtube-hook.md`

### YouTube Decision Summary

| Decision Area | Choice | Rationale |
|---|---|---|
| Server deployment | 3-tier BYOK infrastructure | 90% zero-config via youtube-transcript; yt-dlp/Whisper for users with servers |
| YouTube API calls | Direct from browser (not proxied) | CORS supported, API key already client-side |
| Transcript pipeline | youtube-transcript → yt-dlp → Whisper fallback | Tiered by capability: pure JS → binary → GPU |
| Schema strategy | Hybrid source discriminator on shared tables | FR120 feature parity; zero existing code changes |
| Video player | `react-youtube` (IFrame Player API wrapper) | Thin wrapper, React event binding, maintained |
| AI structuring | Existing `getLLMClient()` + rule-based fallback | BYOK philosophy; works with and without AI |
| Store architecture | New `useYouTubeImportStore` (separate from course import) | Fundamentally different flow (network vs. filesystem) |
| Offline strategy | Cache metadata + transcripts in IDB; playback requires network | Graceful degradation; study features work offline |
| COEP resolution | `credentialless` instead of `require-corp` | Enables both SharedArrayBuffer (WebLLM) and YouTube IFrame |

### YouTube Server-Side Architecture

#### Tiered Deployment Model

The BYOK philosophy extends to infrastructure. Users without a server get 90% functionality; users with a server (Unraid, Docker, VPS) unlock the remaining 10%.

| Tier | Dependency | Config Required | Coverage | Runs On |
|---|---|---|---|---|
| **Tier 1** (zero-config) | `youtube-transcript` npm (pure JS) | None | ~90% of videos with captions | Vite middleware / Vercel serverless |
| **Tier 2** (user server) | `youtube-dl-exec` → yt-dlp binary | Server URL in Settings | Subtitle fallback + enriched metadata | User's server (Unraid, Docker, VPS) |
| **Tier 3** (user Whisper) | faster-whisper Docker container | Whisper URL in Settings | ~10% of videos without captions | User's GPU server (Unraid w/ NVIDIA) |

#### API Route Design

Vite middleware plugin `youtubeDevProxy()` follows the established `ollamaDevProxy()` pattern (`vite.config.ts:42`):

```
POST /api/youtube/transcript          — Tier 1: youtube-transcript (pure JS, runs in Vite)
POST /api/youtube/ytdlp/metadata      — Tier 2: proxy to user's yt-dlp server
POST /api/youtube/ytdlp/subtitles     — Tier 2: proxy to user's yt-dlp server
POST /api/youtube/whisper/transcribe  — Tier 3: proxy to user's Whisper endpoint
```

YouTube Data API v3 (metadata, playlists, channels) goes **direct from browser** — CORS is supported and the API key is already client-side.

#### Transcript Fallback Chain

```
TranscriptPipeline.fetch(videoId)
  │
  ├─ Tier 1: youtube-transcript (npm)
  │    → POST /api/youtube/transcript
  │    → Success? Store in IDB, return
  │    → Failure? Check if yt-dlp server configured
  │
  ├─ Tier 2: yt-dlp subtitle extraction
  │    → POST /api/youtube/ytdlp/subtitles
  │    → Success? Store in IDB, return
  │    → Failure? Check if Whisper endpoint configured
  │
  ├─ Tier 3: faster-whisper transcription
  │    → POST /api/youtube/whisper/transcribe
  │    → Success? Store in IDB, return
  │    → Failure? Mark "no transcript available"
  │
  └─ Final: { status: 'unavailable', reason: string }
```

#### SSRF Protection

Generalize the existing `isAllowedOllamaUrl()` (`vite.config.ts:20-31`) to a shared `isAllowedProxyUrl()` function. Same rules apply: block loopback/metadata addresses, allow private LAN ranges (192.168.x, 10.x, 172.16-31.x) for home servers. Used by both Ollama and YouTube server endpoints.

### YouTube Data API v3 Integration

| Decision | Choice | Rationale |
|---|---|---|
| API key storage | Web Crypto AES-GCM (same as AI keys) | Follows `src/lib/crypto.ts` + `src/lib/aiConfiguration.ts` pattern |
| Rate limiting | Client-side token bucket at 3 req/s | Prevents `rateLimitExceeded` errors; exponential backoff on 429 |
| Quota tracking | localStorage counter, reset at midnight PT | Warn at 400/500 target; typical usage ~300 units/day |
| Metadata caching | 7-day TTL (NFR121), 30-day mandatory refresh (YouTube ToS) | `expiresAt` on cache records, `lastRefreshedAt` on courses |
| Quota fallback | oEmbed (`youtube.com/oembed?url=...`) | Free, no quota, basic metadata (title, author, thumbnail) |

**API Client Design:**

```typescript
// src/lib/youtubeApi.ts
export class YouTubeApiClient {
  constructor(private apiKey: string, private rateLimiter: YouTubeRateLimiter)

  // Batch up to 50 video IDs per call (1 quota unit)
  async getVideoMetadata(videoIds: string[]): Promise<YouTubeVideoMetadata[]>

  // Paginated playlist fetch (1 unit per page, 50 items/page)
  async getPlaylistItems(playlistId: string): Promise<YouTubePlaylistItem[]>

  // Channel info (1 quota unit)
  async getChannelInfo(channelId: string): Promise<YouTubeChannelInfo>
}
```

**Daily Quota Budget (single-user):**

| Activity | Units/call | Typical calls/day | Total |
|---|---|---|---|
| Playlist imports | 1 | 50 | 50 |
| Video metadata (batched) | 1 per 50 videos | 200 | 200 |
| Channel info | 1 | 50 | 50 |
| **Total** | | | **300 units** (~3% of 10,000 free quota) |

### YouTube Transcript Pipeline

#### Storage Format

```typescript
// Raw transcript: exact output from extraction tier
interface YouTubeTranscriptRecord {
  courseId: string                 // FK to ImportedCourse.id
  videoId: string                 // YouTube video ID
  cues: TranscriptCue[]           // Reuses existing type (src/data/types.ts:24-28)
  fullText: string                // Concatenated text for full-text search indexing
  source: 'youtube-transcript' | 'ytdlp' | 'whisper'
  language: string                // e.g., 'en'
  isCleaned: boolean              // True if LLM-cleaned
  cleanedByModel: string | null   // e.g., 'llama3.2:latest'
  fetchedAt: string               // ISO 8601
}
```

#### Transcript Cleanup via LLM (Premium)

Uses existing `getLLMClient()` factory from `src/ai/llm/factory.ts`. Sends raw auto-generated captions through Ollama/BYOK LLM for:
- Proper punctuation and capitalization
- Paragraph breaks at topic transitions
- Common ASR error correction in technical vocabulary
- Chapter headers from video chapter metadata

Follows existing AI consent model. Falls back to raw cues if LLM unavailable.

#### Existing Infrastructure Reused

| Component | Location | How It's Reused |
|---|---|---|
| `TranscriptCue` type | `src/data/types.ts:24-28` | Exact match for youtube-transcript output format |
| `TranscriptPanel` | `src/app/components/figma/TranscriptPanel.tsx` | Auto-scroll, click-to-seek, active cue highlighting — works directly with YouTube cues |
| `parseVTT()` | `TranscriptPanel.tsx:19` | Parses yt-dlp VTT subtitle output |
| `useCaptionLoader` | `src/app/hooks/useCaptionLoader.ts` | Pattern for async transcript loading with status tracking |
| `Chapter` type | `src/data/types.ts:19-22` | YouTube chapter markers use the same `{ time, title }` shape |

### YouTube Dexie Schema (v24)

#### Source Discriminator Strategy

YouTube courses share `importedCourses` and `importedVideos` tables with a `source` discriminator field. This ensures FR120 feature parity — all 15+ existing features (progress, notes, bookmarks, study sessions, streaks, challenges, flashcards, quizzes, embeddings, analytics, reminders, learning paths, content progress, captions, thumbnails) work automatically for YouTube courses with zero code changes.

Source-specific fields (`directoryHandle`, `fileHandle` for local; `youtubeVideoId`, `youtubeUrl` for YouTube) are optional. Existing code paths that use filesystem handles already guard with null checks.

#### Type Extensions

```typescript
// Added to src/data/types.ts

export type CourseSource = 'local' | 'youtube'

// ImportedCourse gains optional fields:
export interface ImportedCourse {
  // ... existing fields (id, name, description, importedAt, category, tags, status, etc.) ...
  source?: CourseSource             // undefined treated as 'local' (backward compat)
  youtubePlaylistId?: string        // For playlist-sourced courses
  youtubeChannelId?: string         // Channel/author linkage
  youtubeChannelName?: string       // Denormalized for display
  lastRefreshedAt?: string          // ISO 8601 — YouTube ToS 30-day refresh tracking
}

// ImportedVideo gains optional fields:
export interface ImportedVideo {
  // ... existing fields (id, courseId, filename, path, duration, format, order, etc.) ...
  youtubeVideoId?: string           // YouTube video ID
  youtubeUrl?: string               // Full URL for IFrame embed
  thumbnailUrl?: string             // YouTube thumbnail URL
  description?: string              // Video description
  chapters?: Chapter[]              // YouTube chapter markers (reuses existing Chapter type)
}
```

#### New Tables

```typescript
// YouTube metadata cache (TTL-managed)
export interface YouTubeVideoCache {
  videoId: string                   // YouTube video ID (primary key)
  title: string
  description: string
  duration: number                  // seconds
  thumbnailUrl: string
  channelId: string
  channelName: string
  chapters: Chapter[]               // YouTube chapter markers
  publishedAt: string               // ISO 8601
  fetchedAt: string                 // ISO 8601
  expiresAt: string                 // ISO 8601 (fetchedAt + TTL)
}

// YouTube course chapters (user-editable structure)
export interface YouTubeCourseChapter {
  id: string                        // crypto.randomUUID()
  courseId: string                   // FK to ImportedCourse.id
  title: string                     // Chapter display name
  order: number                     // Position in course
  videoIds: string[]                // Ordered list of ImportedVideo.id within this chapter
  source: 'ai' | 'rule-based' | 'manual'  // How this chapter was created
  createdAt: string                 // ISO 8601
}
```

#### Schema v24 Declaration

```typescript
db.version(24)
  .stores({
    // All 27 existing v23 tables (must redeclare)
    importedCourses: 'id, name, importedAt, status, source, *tags',      // Added: source index
    importedVideos: 'id, courseId, filename, youtubeVideoId',             // Added: youtubeVideoId index
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
    aiUsageEvents: 'id, featureType, timestamp, courseId',
    reviewRecords: 'id, noteId, nextReviewAt, reviewedAt',
    courseReminders: 'id, courseId',
    courses: 'id, category, difficulty, authorId',
    quizzes: 'id, lessonId, createdAt',
    quizAttempts: 'id, quizId, [quizId+completedAt], completedAt',
    videoCaptions: '[courseId+videoId], courseId, videoId',
    authors: 'id, name, createdAt',
    careerPaths: 'id',
    pathEnrollments: 'id, pathId, status',
    flashcards: 'id, courseId, noteId, nextReviewAt, createdAt',
    entitlements: 'userId',
    // NEW: YouTube-specific tables
    youtubeVideoCache: 'videoId, expiresAt',
    youtubeTranscripts: '[courseId+videoId], courseId, videoId',
    youtubeChapters: 'id, courseId, order',
  })
  .upgrade(async tx => {
    // Migration: set source='local' on all existing courses
    await tx.table('importedCourses').toCollection().modify(course => {
      if (!course.source) {
        course.source = 'local'
      }
    })
    console.log('[Migration v24] Set source=local on existing courses')
  })
```

#### DB Type Declaration

```typescript
const db = new Dexie('ElearningDB') as Dexie & {
  // ... existing 27 tables ...
  youtubeVideoCache: EntityTable<YouTubeVideoCache, 'videoId'>
  youtubeTranscripts: Table<YouTubeTranscriptRecord>          // compound PK: [courseId+videoId]
  youtubeChapters: EntityTable<YouTubeCourseChapter, 'id'>
}
```

### YouTube IFrame Player

| Decision | Choice | Rationale |
|---|---|---|
| Player library | `react-youtube` npm | Thin wrapper over YouTube IFrame Player API; React event binding; maintained |
| Progress tracking | Poll `getCurrentTime()` every 1s while playing | YouTube API lacks continuous timeupdate events; matches `ImportedLessonPlayer` interval |
| Progress storage | Same `progress` table (`[courseId+videoId]`) | Automatic parity with local video progress |
| Transcript sync | Player current time → `TranscriptPanel` prop | Active cue highlighting + auto-scroll; click-to-seek calls `player.seekTo()` |

#### COEP/YouTube IFrame Conflict

**Problem:** `vite.config.ts:370` sets `Cross-Origin-Embedder-Policy: require-corp` for WebLLM SharedArrayBuffer support. This **blocks** YouTube IFrame embeds (cross-origin resource without CORP header).

**Resolution:** Change COEP from `require-corp` to `credentialless`:

```diff
- 'Cross-Origin-Embedder-Policy': 'require-corp',
+ 'Cross-Origin-Embedder-Policy': 'credentialless',
```

`credentialless` still enables SharedArrayBuffer in Chrome (M110+) but allows cross-origin resources that don't carry credentials. YouTube IFrame embeds work because they don't require credentials from the embedding page.

**Verification required:** Test WebLLM model loading with `credentialless` during E23-S09 implementation. If WebLLM breaks, fall back to conditional COEP (set header per-route via service worker or Vite middleware path matching).

#### CSP Updates

```
frame-src: https://www.youtube.com https://www.youtube-nocookie.com
img-src: https://i.ytimg.com https://img.youtube.com
connect-src: https://www.googleapis.com/youtube/
```

### YouTube AI Course Structuring

#### Two Paths (FR115/FR116)

| Condition | Path | Function |
|---|---|---|
| AI configured + consent granted | AI-powered structuring | `structureCourseWithAI()` via `getLLMClient()` |
| AI configured + consent denied | Rule-based fallback | `groupVideosByKeywords()` |
| AI configured + timeout/error | Rule-based with toast warning | Automatic degradation |
| No AI configured | Rule-based fallback | `groupVideosByKeywords()` |
| Rule-based fails (< 3 videos) | Single flat chapter | All videos in one chapter |

#### AI Structuring

```typescript
// src/ai/youtube/courseStructurer.ts
export interface CourseStructureProposal {
  chapters: Array<{
    title: string
    videoIds: string[]         // Ordered by suggested sequence
    rationale: string          // AI explanation for grouping
  }>
  courseTitle: string           // Suggested course title
  courseDescription: string    // Suggested description
  tags: string[]               // Suggested tags
}

export async function structureCourseWithAI(
  videos: Array<{
    videoId: string
    title: string
    description: string
    duration: number
    chapters?: Chapter[]
  }>
): Promise<CourseStructureProposal>
```

Input: video titles, descriptions, chapter markers, durations. LLM proposes chapter groupings with pedagogical ordering. Uses structured output via existing Zod schema pattern.

#### Rule-Based Fallback

```typescript
// src/lib/youtubeRuleBasedGrouping.ts
export function groupVideosByKeywords(
  videos: Array<{ videoId: string; title: string; description: string }>
): CourseStructureProposal
```

Algorithm: Extract keywords from titles (TF-IDF word frequency) → compute pairwise cosine similarity → cluster above threshold → name chapters by top keywords → preserve original playlist order within clusters. Falls back to single "All Videos" chapter if clustering produces poor results.

### YouTube Store Architecture

#### useYouTubeImportStore

New Zustand store managing the 4-step import wizard. **Separate from `useCourseImportStore`** because the YouTube flow is fundamentally different: network-based, multi-step async with AI structuring, vs. filesystem-based folder scanning.

```typescript
// src/stores/useYouTubeImportStore.ts
export type ImportWizardStep = 'urls' | 'preview' | 'organize' | 'details'

interface YouTubeImportState {
  // Wizard navigation
  step: ImportWizardStep
  isOpen: boolean

  // Step 1: URL input
  rawInput: string
  detectedUrls: ParsedYouTubeUrl[]
  validationStatus: 'idle' | 'validating' | 'valid' | 'invalid' | 'mixed'

  // Step 2: Metadata preview
  videos: YouTubeVideoMetadata[]
  isLoadingMetadata: boolean
  metadataProgress: { current: number; total: number } | null
  unavailableVideos: string[]

  // Step 3: Organization
  chapters: YouTubeCourseChapter[]
  structureSource: 'ai' | 'rule-based' | 'manual'
  isStructuring: boolean

  // Step 4: Details
  courseName: string
  courseDescription: string
  courseTags: string[]
  selectedThumbnailUrl: string | null

  // Actions
  setStep: (step: ImportWizardStep) => void
  setRawInput: (input: string) => void
  fetchMetadata: () => Promise<void>
  structureCourse: () => Promise<void>
  saveCourse: () => Promise<string>            // Returns courseId
  reset: () => void
}
```

After `saveCourse()` completes, data is written to shared `importedCourses`/`importedVideos` tables and becomes accessible through existing `useCourseImportStore.loadImportedCourses()`.

#### useYouTubeTranscriptStore

Lightweight store managing background transcript fetching (continues after wizard closes):

```typescript
// src/stores/useYouTubeTranscriptStore.ts
interface YouTubeTranscriptState {
  status: Record<string, 'pending' | 'fetching' | 'done' | 'failed' | 'cleaning'>
  activeFetches: number
  fetchTranscript: (courseId: string, videoId: string) => Promise<void>
  batchFetchTranscripts: (courseId: string, videoIds: string[]) => void
  getTranscript: (courseId: string, videoId: string) => Promise<TranscriptCue[] | null>
}
```

### YouTube Offline-First Design

| Data | Available Offline | Storage | TTL |
|---|---|---|---|
| Course structure (chapters, video order) | ✅ Yes | IndexedDB `importedCourses` + `youtubeChapters` | Permanent (user data) |
| Video metadata (title, duration) | ✅ Yes (text only) | IndexedDB `youtubeVideoCache` | 7d default, 30d max (ToS) |
| Transcripts (cues + full text) | ✅ Yes | IndexedDB `youtubeTranscripts` | Permanent until course deleted |
| Notes, progress, bookmarks | ✅ Yes | IndexedDB (shared tables) | Permanent |
| Video playback | ❌ No (requires network) | YouTube IFrame | N/A |
| Thumbnails | ⚠️ Partially (browser cache) | HTTP cache | Browser-managed |

**When offline:**
- Course detail page shows full structure with progress bars, chapter breakdown
- Transcript panel shows cached transcript (if previously fetched)
- Video player shows "Connect to the internet to watch" placeholder with `WifiOff` icon
- Notes, progress, streaks, flashcards continue working normally
- "Refresh metadata" button disabled with tooltip "Requires internet connection"

**30-Day Metadata Refresh (YouTube ToS):**

```typescript
// src/lib/youtubeMetadataRefresh.ts — runs on app startup
export async function refreshStaleMetadata(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const staleCourses = await db.importedCourses
    .where('source').equals('youtube')
    .filter(c => (c.lastRefreshedAt ?? '') < thirtyDaysAgo)
    .toArray()
  // Queue refresh for each (rate-limited, non-blocking)
}
```

### YouTube Component Architecture

| Component | Location | Shared? | Description |
|---|---|---|---|
| `YouTubeImportDialog` | `src/app/components/figma/YouTubeImportDialog.tsx` | No | 4-step import wizard (`sm:max-w-3xl`) |
| `YouTubeUrlInput` | `src/app/components/figma/YouTubeUrlInput.tsx` | No | Wizard Step 1: Textarea with auto-detection |
| `YouTubeMetadataPreview` | `src/app/components/figma/YouTubeMetadataPreview.tsx` | No | Wizard Step 2: Video list with skeletons |
| `YouTubeChapterEditor` | `src/app/components/figma/YouTubeChapterEditor.tsx` | **Yes** | Wizard Step 3 + post-import edit dialog (FR119) |
| `YouTubeCourseDetailsForm` | `src/app/components/figma/YouTubeCourseDetailsForm.tsx` | No | Wizard Step 4: Name, tags, description, cover |
| `YouTubePlayer` | `src/app/components/figma/YouTubePlayer.tsx` | No | IFrame Player API wrapper with progress polling |
| `YouTubeLessonPlayer` | `src/app/pages/YouTubeLessonPlayer.tsx` | No | Route page: player + transcript + notes |
| `YouTubeCourseDetail` | `src/app/pages/YouTubeCourseDetail.tsx` | No | Route page: course overview with chapters |
| `TranscriptPanel` | `src/app/components/figma/TranscriptPanel.tsx` | **Yes** | Already generic — works with YouTube cues directly |

**Drag-and-Drop:** `@dnd-kit/core` + `@dnd-kit/sortable` for nested chapter/video reordering. Multiple `SortableContext` containers (one per chapter). Extends existing `VideoReorderList.tsx` pattern.

**Route Additions (`src/app/routes.tsx`):**
```typescript
{ path: 'youtube-courses/:courseId', element: <YouTubeCourseDetail /> }
{ path: 'youtube-courses/:courseId/lessons/:lessonId', element: <YouTubeLessonPlayer /> }
```

### YouTube Security

| Concern | Decision | Implementation |
|---|---|---|
| API key encryption | Web Crypto AES-GCM | Same pattern as `src/lib/crypto.ts`; session-scoped, never plaintext |
| SSRF protection | Generalized `isAllowedProxyUrl()` | Shared by Ollama + YouTube server endpoints; blocks loopback/metadata |
| CSP | Add YouTube domains | `frame-src youtube.com`, `img-src i.ytimg.com`, `connect-src googleapis.com` |
| Data boundaries (NFR74) | YouTube data stays local | Exceptions: YouTube API (Google), user's AI provider, user's Whisper endpoint |
| Server URL validation | Same as Ollama URL pattern | Block non-private addresses unless HTTPS; validate on save in Settings |

### YouTube New File Summary

```
src/lib/
├── youtubeApi.ts                    — YouTube Data API v3 client (batch, pagination)
├── youtubeUrlParser.ts              — URL detection/validation (video, playlist, channel)
├── youtubeConfiguration.ts          — Settings management (API key, server URLs, TTL)
├── youtubeRateLimiter.ts            — Token bucket rate limiter (3 req/s)
├── youtubeQuotaTracker.ts           — Daily quota tracking (localStorage)
├── youtubeTranscriptPipeline.ts     — 3-tier fallback transcript orchestrator
├── youtubeTranscriptCleanup.ts      — LLM-based transcript cleanup (premium)
├── youtubeRuleBasedGrouping.ts      — TF-IDF keyword clustering (free fallback)
├── youtubeMetadataRefresh.ts        — 30-day ToS compliance refresh
└── ssrfProtection.ts                — Shared SSRF validation (extracted from vite.config.ts)

src/ai/youtube/
└── courseStructurer.ts              — LLM course structuring via getLLMClient()

src/stores/
├── useYouTubeImportStore.ts         — 4-step import wizard state
└── useYouTubeTranscriptStore.ts     — Background transcript fetch progress

src/app/components/figma/
├── YouTubeImportDialog.tsx          — Import wizard dialog
├── YouTubeUrlInput.tsx              — Step 1: URL input with auto-detection
├── YouTubeMetadataPreview.tsx       — Step 2: Video list with thumbnails
├── YouTubeChapterEditor.tsx         — Step 3: Nested drag-and-drop editor (shared)
├── YouTubeCourseDetailsForm.tsx     — Step 4: Course details form
└── YouTubePlayer.tsx                — IFrame Player API wrapper

src/app/pages/
├── YouTubeCourseDetail.tsx          — Course detail page with chapters
└── YouTubeLessonPlayer.tsx          — Lesson player: YouTube + transcript + notes
```

### YouTube Implementation Sequence

| Story | Scope | Dependencies | Key Files |
|---|---|---|---|
| E23-S01 | Dexie v24 schema + types + migration | None | `src/db/schema.ts`, `src/data/types.ts` |
| E23-S02 | URL parser + configuration (Settings UI) | S01 | `src/lib/youtubeUrlParser.ts`, `src/lib/youtubeConfiguration.ts` |
| E23-S03 | YouTube Data API v3 client + rate limiter + quota | S02 | `src/lib/youtubeApi.ts`, `src/lib/youtubeRateLimiter.ts` |
| E23-S04 | youtube-transcript Vite middleware (Tier 1) | S01 | `vite.config.ts`, `src/lib/youtubeTranscriptPipeline.ts` |
| E23-S05 | Import wizard Steps 1-2 (URL input + preview) | S02, S03 | `YouTubeImportDialog.tsx`, `YouTubeUrlInput.tsx`, `YouTubeMetadataPreview.tsx` |
| E23-S06 | Rule-based grouping + ChapterEditor (`@dnd-kit`) | S01 | `YouTubeChapterEditor.tsx`, `src/lib/youtubeRuleBasedGrouping.ts` |
| E23-S07 | AI course structuring + wizard Step 3 | S03, S06 | `src/ai/youtube/courseStructurer.ts` |
| E23-S08 | Import wizard Step 4 (details) + save flow | S05, S06 | `YouTubeCourseDetailsForm.tsx`, `useYouTubeImportStore.ts` |
| E23-S09 | YouTube IFrame player + progress + COEP fix | S01 | `YouTubePlayer.tsx`, `YouTubeLessonPlayer.tsx`, `vite.config.ts:370` |
| E23-S10 | Transcript panel + search + click-to-seek | S04, S09 | `TranscriptPanel.tsx` (extend), `useYouTubeTranscriptStore.ts` |
| E23-S11 | Tier 2 (yt-dlp) + Tier 3 (Whisper) integration | S04 | `src/lib/youtubeTranscriptPipeline.ts`, `src/lib/ssrfProtection.ts` |
| E23-S12 | Offline support + 30-day refresh + CSP hardening | S03, S09 | `src/lib/youtubeMetadataRefresh.ts`, `vite.config.ts` |

### YouTube Architecture Validation

**Coherence with Existing Architecture:**
- Follows all established patterns: Zustand individual selectors, `Result<T>` services, typed message protocols, `crypto.randomUUID()` IDs, ISO 8601 dates
- Extends rather than modifies: source discriminator on shared tables, new YouTube-specific tables, new Vite middleware plugin alongside Ollama
- Component architecture follows shadcn/ui patterns, `cn()` utility, design token system

**Requirements Coverage:**
- All 12 FRs (FR112–FR123) have architectural homes
- All 6 NFRs (NFR69–NFR74) addressed: quota budget, performance targets, key security, offline access, data locality
- Free/premium tier split matches PRD: core import is free, AI structuring and Whisper are premium

**Risk Mitigations:**
- `youtube-transcript` breaks → Tier 2 yt-dlp fallback
- YouTube API quota exhaustion → oEmbed fallback + aggressive caching
- COEP blocks YouTube IFrame → `credentialless` header (test in E23-S09)
- Offline use → metadata + transcripts cached in IndexedDB
