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
  - date: '2026-03-27'
    scope: 'Server-side premium entitlement enforcement (Adversarial Finding #9)'
    changes:
      - 'Added Server-Side Premium Entitlement Enforcement Architecture section (10 decision areas)'
      - 'Added JWT validation middleware design (jose + HS256/JWKS-ready)'
      - 'Added BYOK authentication strategy (JWT required, entitlement skipped)'
      - 'Added server-side entitlement cache (lru-cache, 5-min TTL)'
      - 'Added per-user tier-based rate limiting (rate-limiter-flexible)'
      - 'Added open relay prevention (4-layer defense)'
      - 'Added 8-story implementation sequence'
    researchInput:
      - 'docs/implementation-artifacts/project-adversarial-review-2026-03-26.md (Finding #9)'
  - date: '2026-03-28'
    scope: 'AI Deep Strategy architecture addendum (Epics 36-43)'
    changes:
      - 'Added AI Deep Strategy Architecture section (7 decision areas, 8 epics)'
      - 'Added Model Registry pattern with ModelInfo interface and provider catalog'
      - 'Added per-feature model overrides with getLLMClient(featureId?) enhancement'
      - 'Added Socratic Tutor architecture (prompts, sessionManager, adaptiveEngine, Dexie tables)'
      - 'Added FSRS flashcard scheduling algorithm with card state machine'
      - 'Added token metering middleware with Supabase usage tracking'
      - 'Added Study Buddy floating overlay with intent detection routing'
      - 'Added cross-feature intelligence loop (misconception→flashcard→quiz→gaps→path)'
      - 'Added 33-story implementation sequence across 8 epics'
    researchInput:
      - '/Users/pedro/.claude/plans/adaptive-petting-unicorn.md (AI Deep Strategy plan)'
  - date: '2026-03-28'
    scope: 'Knowledge Map Phase 1 architecture addendum'
    changes:
      - 'Added Knowledge Map Phase 1 Architecture section (5 decision areas, 4 stories)'
      - 'Added Topic Resolution Service with noise filter + canonical map + category grouping'
      - 'Added Knowledge Score Calculation with dynamic weight redistribution 30/30/20/20'
      - 'Added Knowledge Map Zustand store with cross-store aggregation (no new Dexie table)'
      - 'Added UI architecture: Overview widget + dedicated /knowledge-map page + Recharts Treemap'
      - 'Added data flow from Dexie tables through score pipeline to visualization'
      - 'Added 4-story implementation sequence'
    researchInput:
      - '_bmad-output/planning-artifacts/research/technical-knowledge-visualization-decay-modeling-research-2026-03-28.md'
      - '_bmad-output/brainstorming/brainstorming-session-2026-03-28-knowledge-map-phase1.md'
      - 'docs/plans/2026-03-28-product-roadmap.md (Section 13)'
  - date: '2026-03-28'
    scope: 'AI Tutoring Phase 1-2 architecture addendum (lesson-aware chat + Socratic mode)'
    changes:
      - 'Added AI Tutoring Phase 1-2 Architecture section (7 decision areas, 5 stories)'
      - 'Added Tutor tab in LessonPlayer with reusable chat components (MessageList, ChatInput, CitationLink)'
      - 'Added slot-based prompt builder (tutorPromptBuilder.ts) with 6-slot priority system and auto token budget'
      - 'Added TypeScript hint ladder state machine (Levels 0-4) with client-side frustration detection'
      - 'Added position-based transcript context injection (Phase 1) with 3 strategies: full/chapter/window'
      - 'Added Dexie v29 chatConversations table with blob storage and sliding window (3 exchanges)'
      - 'Added useTutor hook with 6-stage pipeline and 3-tier graceful degradation'
      - 'Added 5-story implementation sequence across Phase 1-2'
    researchInput:
      - '_bmad-output/planning-artifacts/research/technical-socratic-tutoring-llm-research-2026-03-28.md'
      - '_bmad-output/brainstorming/brainstorming-session-2026-03-28-ai-tutoring-phase1-2.md'
      - 'docs/plans/2026-03-28-product-roadmap.md (Section 14)'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/product-brief-Elearningplatformwireframes-2026-03-01.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
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

**Functional Requirements (123 FRs):** All FR categories have architectural homes. Course management (existing), content viewing (existing), progress tracking (existing + extensions), gamification (Epic 5 stores/services), challenges (Epic 6), analytics (Epic 7 lazy-loaded page + computed metrics), AI assistant (Epic 8 workers + RAG + 3-tier fallback), spaced repetition (Epic 9 FSRS), onboarding (Epic 10), data portability (Epic 11 export + xAPI), platform & entitlement (Epic 19 — Supabase Auth + Stripe), learning pathways (Epic 20 — career paths + flashcards + FSRS), YouTube Course Builder (Epic 23 — YouTube Data API v3 + transcript pipeline + AI structuring).

**Non-Functional Requirements (74 NFRs):** All architecturally critical NFRs addressed — performance (code splitting, lazy loading), bundle size (dynamic imports), memory (monitoring + eviction), accessibility (WCAG 2.2 AA enforcement), data integrity (migrations + rollback), privacy (local-first + encryption), AI quality (RAG-only + attribution), YouTube integration (NFR69-NFR74 — API quota, metadata perf, transcript extraction, offline caching).

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

## Authentication & Identity Architecture (Epic 19)

_Merged from docs/planning-artifacts/architecture.md on 2026-03-25._

#### Auth Provider: Supabase Auth

**Decision:** Use Supabase Auth for user authentication with email/password, magic link, and Google OAuth support.

**Rationale:**
- Managed auth service with zero backend maintenance (no auth server to deploy or scale)
- Built-in support for email/password, magic link (passwordless), and OAuth providers
- Generous free tier (50,000 MAUs) covers solo-dev launch phase
- JavaScript SDK handles token storage, refresh, and session management automatically
- Row Level Security (RLS) available if server-side data is added later
- Open-source (can self-host if vendor lock-in becomes a concern)

**Bundle Size:** ~40 KB gzipped (@supabase/supabase-js)

**Implementation Pattern:**
```typescript
// src/lib/auth/supabase.ts — Supabase client singleton
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// src/stores/useAuthStore.ts — Auth state (Zustand)
interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}
```

#### Entitlement System: Local Cache with Server Validation

**Decision:** Validate premium entitlement against a serverless function on app launch (when online), cache result in IndexedDB with 7-day TTL, and expose a `useIsPremium()` reactive hook for UI gating.

**Implementation Pattern:**
```typescript
// src/lib/entitlement/isPremium.ts
interface EntitlementCache {
  tier: 'free' | 'trial' | 'premium'
  expiresAt: string       // ISO date, server-set
  cachedAt: string        // ISO date, client-set
  stripeCustomerId: string
  planId: string | null
}

// React hook for components
export function useIsPremium(): { isPremium: boolean; loading: boolean; tier: string } {
  const tier = useEntitlementStore((s) => s.tier)
  const loading = useEntitlementStore((s) => s.loading)
  return { isPremium: tier !== 'free', loading, tier }
}
```

- Local-first: cached entitlement allows premium features to work offline for up to 7 days
- Distinguishes server-unreachable (honor cache) from server-returns-denied (disable premium)

#### Payment Processing: Stripe Checkout + Customer Portal

**Decision:** Stripe Checkout (hosted) for payment collection, Stripe Customer Portal for subscription management. Supabase Edge Functions handle webhooks.

- Zero PCI scope (no card data touches Knowlune)
- Checkout session created by Edge Function (protects Stripe secret key)
- Webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Trial support: Stripe natively supports 14-day free trials

#### Premium Code Boundary: Vite Build Exclusion

**Decision:** Premium features live in `src/premium/` with proprietary license. AGPL core build excludes this directory via Vite plugin.

- `npm run build` → AGPL core build (excludes `src/premium/`)
- `npm run build:premium` → Full build (includes `src/premium/`)
- ESLint rule errors if `src/` (non-premium) imports from `@/premium/*`
- Core components use `useIsPremium()` + `React.lazy()` to conditionally load premium features

---

## Specialized Algorithms

_Merged from docs/planning-artifacts/architecture.md on 2026-03-25._

#### Session Quality Scoring (FR84)

```typescript
// src/lib/sessionQuality.ts
export interface SessionMetrics {
  totalDuration: number        // seconds
  activeTime: number           // seconds (video playing + editor focused)
  interactions: number         // count (play, pause, note edit, mark complete)
  breaks: number               // count (pauses > 60 seconds)
}

export function scoreSession(metrics: SessionMetrics): number {
  const minutes = metrics.totalDuration / 60

  // 1. Active time ratio (40% weight)
  const activeRatio = Math.min(metrics.activeTime / metrics.totalDuration, 1)
  const activeScore = activeRatio * 100

  // 2. Interaction density (30% weight) — per 10 minutes
  const densityPer10Min = (metrics.interactions / minutes) * 10
  const densityScore = Math.min(densityPer10Min / 8, 1) * 100

  // 3. Optimal length (15% weight) — 25-52 min sweet spot
  let lengthScore: number
  if (minutes >= 25 && minutes <= 52) lengthScore = 100
  else if (minutes < 25) lengthScore = (minutes / 25) * 100
  else lengthScore = Math.max(0, 100 - ((minutes - 52) / 38) * 100)

  // 4. Breaks taken (15% weight) — 1 break per 30 min is ideal
  const idealBreaks = Math.floor(minutes / 30)
  const breakDiff = Math.abs(metrics.breaks - idealBreaks)
  const breakScore = Math.max(0, 100 - breakDiff * 25)

  return Math.round(
    activeScore * 0.4 +
    densityScore * 0.3 +
    lengthScore * 0.15 +
    breakScore * 0.15
  )
}
```

- Score is 0-100 integer, stored in `studySessions.qualityScore`
- Calculated on session end, never mid-session

#### Engagement Decay Detection (FR83)

```typescript
// src/lib/engagementDecay.ts
export interface DecaySignal {
  type: 'frequency' | 'duration' | 'velocity'
  message: string
  severity: 'warning' | 'alert'
}

export function detectDecay(
  recentSessions: StudySession[],  // Last 4 weeks
  weeklyCompletions: number[]       // Last 4 weeks [newest...oldest]
): DecaySignal[] {
  const signals: DecaySignal[] = []

  // 1. Frequency: current 2-week avg < 50% of prior 2-week avg
  const recent2wk = sessionsPerDay(recentSessions, 0, 14)
  const prior2wk = sessionsPerDay(recentSessions, 14, 28)
  if (prior2wk > 0 && recent2wk / prior2wk < 0.5) {
    signals.push({
      type: 'frequency',
      message: `Study frequency dropped to ${Math.round(recent2wk / prior2wk * 100)}% of your usual pace`,
      severity: 'warning',
    })
  }

  // 2. Velocity: completion count negative for 3+ consecutive weeks
  const velocityNegative = weeklyCompletions
    .slice(0, 3)
    .every((count, i) => i === 0 || count < weeklyCompletions[i - 1])

  if (velocityNegative && weeklyCompletions.length >= 3) {
    signals.push({
      type: 'velocity',
      message: 'Completion rate has declined for 3 consecutive weeks',
      severity: 'alert',
    })
  }

  return signals
}
```

- Alert display: Dashboard card (NOT toast) — persistent, dismissible
- Re-trigger cooldown: Same signal type cannot re-fire for 7 days after dismissal
- Never show during first 14 days of app usage (insufficient data)

---

## Accessibility Patterns (NFR57-62, NFR68)

_Merged from docs/planning-artifacts/architecture.md on 2026-03-25._

**`prefers-reduced-motion` Strategy:**
- Applied globally in `src/styles/index.css` — individual components do NOT handle this
- canvas-confetti: Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` before firing
- Framer Motion: Use `useReducedMotion()` hook, set `transition={{ duration: 0 }}`

**Target Size (24x24px minimum — NFR57 SC 2.5.8):**
- All clickable elements: minimum `min-w-6 min-h-6` (24px)
- Icon-only buttons: `p-2` padding on 16px icons = 32px target

**Focus Not Obscured (NFR57 SC 2.4.11):**
- `scroll-padding-top: 4rem` for sticky header
- Floating panels: Must have `aria-modal="true"` or trap focus inside

**Progress Bar ARIA (NFR60):** Always include `role="progressbar"`, `aria-valuenow/min/max`, `sr-only` text equivalent, and `aria-label` describing what is measured.

**Chart Accessibility (NFR61):** `role="img"` + `aria-labelledby` title/desc. Complex charts: toggle data table view. Never color-only differentiation. 3:1 contrast for graphical objects.

---

## AI Layer Architecture (Epic 9/9B)

_Merged from docs/planning-artifacts/architecture.md on 2026-03-25. Documents the AI architecture as built._

### AI Provider Abstraction

```
Settings UI → AIConfigStore (Zustand) → Web Crypto API → IndexedDB (encrypted)
                    ↓
              AI Client Factory → Provider-specific client (OpenAI / Anthropic)
                    ↓
              Feature Components (Summary, Q&A, Learning Path, etc.)
```

- **API key storage:** Web Crypto API with session-scoped encryption keys
- **Cross-tab sync:** `storage` event + custom `CustomEvent` for same-tab updates
- **Consent model:** Per-feature consent toggles
- **Data minimization:** Only content being analyzed is sent. No user metadata, file paths, or PII

### Streaming Response Architecture

All AI features use Vercel AI SDK: `useChat` for conversational features, `useCompletion` for single-shot features. Structured output via Zod schemas. 30-second timeout with retry.

### Graceful Degradation

| Feature | AI Mode | Fallback Mode |
|---------|---------|---------------|
| Video Summary | LLM-generated 100-300 word summary | "Summary unavailable" with retry |
| Q&A from Notes | RAG with citation extraction | Manual full-text note search |
| Learning Path | LLM-inferred prerequisite ordering | Alphabetical course list |
| Knowledge Gaps | AI-enriched gap analysis | Rule-based (note ratio + watch %) |
| Note Organization | AI auto-tag + topical overlap | Tag-based matching only |
| Related Concepts | AI topical similarity | Shared tag matching only |

### Vector Search

`BruteForceVectorStore` in `src/lib/vectorSearch.ts` (~200 lines). 10.27ms p50 @ 10K vectors, 100% recall. Stored in IndexedDB with Float32Array embeddings. Migration trigger: >50K vectors OR >200ms latency → EdgeVec library.

### Web Worker Architecture

Workers lazy-spawned via `WorkerCoordinator`. Auto-terminate after 60s idle. Terminated on `visibilitychange` (tab hidden). Pool size limited by `navigator.hardwareConcurrency`.

### CSP Requirements

External AI providers require CSP allowlists in `connect-src`: `https://api.openai.com`, `https://api.anthropic.com`. Must be configured before feature stories call external APIs.

---

## Future: Premium Tier Architecture

_Merged from docs/planning-artifacts/architecture.md on 2026-03-25._

### Cloud Sync Layer (Future)

- **Sync engine:** CRDTs via Yjs or simple last-write-wins
- **Backend:** Supabase Postgres or Cloudflare D1
- **Sync scope:** Notes, progress, streaks, settings only (not video/PDF files)
- **Conflict resolution:** Per-field timestamps; user-visible merge UI for note conflicts
- **Core value:** Local IndexedDB remains primary. Cloud is backup/sync, not requirement

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

## Server-Side Premium Entitlement Enforcement Architecture

_Added 2026-03-27. Addresses Adversarial Finding #9 (Premium Entitlement Bypass) by moving the security boundary from client-side IndexedDB to server-side middleware. Client-side `isPremium()` becomes a UX hint for fast rendering, not the security boundary._

**Input Documents:**
- Adversarial Review: `docs/implementation-artifacts/project-adversarial-review-2026-03-26.md`, Finding #9
- Existing entitlement system: `src/lib/entitlement/isPremium.ts` (E19-S03)
- Stripe integration: `supabase/functions/stripe-webhook/index.ts` (E19-S02)
- AI proxy: `server/index.ts` (E22)

### Entitlement Enforcement Decision Summary

| Decision Area | Choice | Rationale |
|---|---|---|
| BYOK authentication | JWT required, entitlement skipped | Industry standard (Vercel, LiteLLM, OpenRouter, Cloudflare all require platform auth on BYOK). Prevents open relay, enables usage analytics and per-user rate limiting. |
| Primary enforcement point | Express proxy middleware (`server/middleware/entitlement.ts`) | All Knowlune-hosted AI requests route through Express :3001; single enforcement point, no extra network hops |
| JWT validation library | `jose` (v6.x, zero-dep, ESM-native) | Industry consensus over `jsonwebtoken` (legacy CJS). No CVEs in v5/v6 line. auth0-maintained. |
| JWT algorithm | HS256 with `SUPABASE_JWT_SECRET`, JWKS-ready design | Self-hosted Supabase on Unraid defaults to HS256. Middleware accepts either secret or JWKS URL for future asymmetric key migration. |
| Server-side entitlement cache | `lru-cache` with 5-minute TTL, max 1000 entries | Avoids Supabase DB hit on every request (~50-200ms savings). LRU eviction prevents unbounded memory. |
| Rate limiting | `rate-limiter-flexible` with per-user token bucket | Supports per-user keying, tier-based rates, memory→Redis migration path. Better than `express-rate-limit` for tier-aware limits. |
| Open relay prevention | 4-layer defense (JWT + origin check + domain allowlist + rate limit) | Research confirms unauthenticated CORS proxies are exploitable open relays. |
| Vite dev proxy | Mirror enforcement with `DEV_SKIP_ENTITLEMENT` escape hatch | Dev-prod parity; escape hatch for local development without Supabase |
| Migration strategy | Immediate enforcement (no phased rollout) | Pre-launch with zero external consumers. Every source warns retrofitting auth is painful — do it now. |
| Subscription lapse | 403 structured error; client shows re-subscribe CTA | Max 5-minute grace period from cache TTL. Acceptable for learning platform. |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  useIsPremium()          getLLMClient()                         │
│  ┌──────────────┐        ┌──────────────┐                      │
│  │ IndexedDB    │        │ ProxyLLM /   │──── Authorization:   │
│  │ cache (UX    │        │ OllamaLLM    │     Bearer <JWT>     │
│  │ hint only)   │        │ Client       │                      │
│  └──────────────┘        └──────┬───────┘                      │
│                                 │                              │
│                    POST /api/ai/* + Authorization header        │
└─────────────────────────────────┼──────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express Proxy (:3001)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Middleware Chain (applied to /api/ai/* routes)            │  │
│  │                                                          │  │
│  │  1. Origin Check                                         │  │
│  │     - Verify request origin is an allowed Knowlune       │  │
│  │       frontend (configurable allowlist)                   │  │
│  │     - Block requests from unknown origins                 │  │
│  │                                                          │  │
│  │  2. JWT Validation (authenticateJWT)                      │  │
│  │     - Extract Authorization: Bearer <token>               │  │
│  │     - jose.jwtVerify() with SUPABASE_JWT_SECRET (HS256)  │  │
│  │     - Verify aud: "authenticated" claim                   │  │
│  │     - Check exp (reject expired tokens)                   │  │
│  │     - Attach userId (sub claim) to req                    │  │
│  │                                                          │  │
│  │  3. BYOK Detection                                        │  │
│  │     - Has apiKey in body? → mark req.isBYOK = true       │  │
│  │     - Has ollamaServerUrl? → mark req.isBYOK = true      │  │
│  │     - BYOK skips step 4 (entitlement), proceeds to 5     │  │
│  │                                                          │  │
│  │  4. Entitlement Check (Knowlune-hosted AI only)           │  │
│  │     - Check lru-cache (5-min TTL)                         │  │
│  │     - Cache miss → query Supabase entitlements table      │  │
│  │     - Reject if tier === 'free' with 403 structured error │  │
│  │                                                          │  │
│  │  5. Rate Limiter                                          │  │
│  │     - rate-limiter-flexible keyed by userId               │  │
│  │     - Tier-based token bucket (see table below)           │  │
│  │     - Rejects with 429 + Retry-After header               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Existing route handlers (unchanged):                           │
│    POST /api/ai/generate    — Non-streaming LLM                 │
│    POST /api/ai/stream      — SSE streaming LLM                 │
│    POST /api/ai/ollama      — Ollama streaming (OpenAI-compat)  │
│    POST /api/ai/ollama/chat — Ollama non-streaming              │
│    GET  /api/ai/ollama/tags — List models (rate-limited only)   │
│    GET  /api/ai/ollama/health — Health check (no auth needed)   │
│                                                                 │
│  Existing SSRF protection (isAllowedOllamaUrl) unchanged        │
└─────────────────────────────────────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐
  │ AI Providers    │  │ Supabase DB      │  │ Stripe        │
  │ (OpenAI, etc.)  │  │ (entitlements    │  │ (webhooks →   │
  │                 │  │  table, RLS)     │  │  entitlements) │
  └─────────────────┘  └──────────────────┘  └───────────────┘
```

### Decision 1: BYOK Authentication Strategy

**Problem:** Currently ALL proxy requests are BYOK (every request has `apiKey` or `ollamaServerUrl` in the body). The proxy is an unauthenticated CORS relay — once deployed, anyone can use it.

**Decision:** Require JWT authentication on all proxy requests. Skip entitlement check for BYOK. Two separate middleware layers, never coupled.

**Why require auth on BYOK (industry validation):**
- Vercel AI Gateway: Requires team-level auth even with BYOK keys
- LiteLLM Proxy: Never forwards proxy auth to providers; validates its own auth first
- OpenRouter: Requires account + credits even for BYOK (first 1M/month free, then 5% fee)
- Cloudflare AI Gateway: Requires `cf-aig-authorization` on all requests including BYOK

**BYOK detection logic:**
```
Request has body.apiKey?        → BYOK (cloud providers: OpenAI, Anthropic, Groq, Gemini, GLM)
Request has body.ollamaServerUrl? → BYOK (user's Ollama server)
Neither?                        → Knowlune-hosted AI (requires premium entitlement)
```

**Critical design rule (Vercel bug lesson):** BYOK rate limiting and hosted-AI entitlement checking are independent middleware layers. A BYOK request must never be rejected because of hosted-AI entitlement state. The middleware chain is:
```
authenticateJWT → detectBYOK → [if !BYOK: checkEntitlement] → rateLimitByTier → handler
```

### Decision 2: JWT Validation Flow

**Problem:** Express proxy has zero authentication. Need to verify Supabase JWTs without adding latency.

**Decision:** Use `jose` library with HS256 symmetric verification (self-hosted Supabase default). Design the middleware to accept either a JWT secret or JWKS URL for future asymmetric key migration.

**Verification steps:**
1. Extract `Authorization: Bearer <token>` header
2. `jose.jwtVerify(token, secret, { audience: 'authenticated' })`
   - Signature verification (HS256 HMAC with `SUPABASE_JWT_SECRET`)
   - Audience claim: must be `"authenticated"` (Supabase-specific requirement)
   - Expiration: reject if `exp` is in the past
3. Extract `sub` claim as `userId`
4. Attach `{ userId, email, role }` to `req.auth`

**Performance:** ~1ms CPU-bound (no network hop). Negligible compared to AI inference latency.

**Error responses:**
| Condition | HTTP Status | Error Code | Client Action |
|---|---|---|---|
| Missing Authorization header | 401 | `AUTH_REQUIRED` | Prompt sign-in |
| Invalid/malformed token | 401 | `AUTH_INVALID` | Prompt sign-in |
| Expired token | 401 | `TOKEN_EXPIRED` | Auto-refresh via `supabase.auth.onAuthStateChange`, retry |
| Valid token | — | — | Continue to next middleware |

**Environment variables (new):**
```
SUPABASE_JWT_SECRET=<from Supabase dashboard: Settings > API > JWT Secret>
SUPABASE_URL=<existing, for entitlement DB queries>
SUPABASE_SERVICE_ROLE_KEY=<for server-side entitlement queries bypassing RLS>
ALLOWED_ORIGINS=http://localhost:5173,https://knowlune.app
DEV_SKIP_ENTITLEMENT=false
```

**Future JWKS migration:** When upgrading self-hosted Supabase to asymmetric keys, change configuration to:
```
SUPABASE_JWKS_URL=https://<your-supabase>/.well-known/jwks.json
```
The middleware detects the presence of `SUPABASE_JWKS_URL` and uses `jose.createRemoteJWKSet()` instead of the shared secret. No code change required.

### Decision 3: Server-Side Entitlement Cache

**Problem:** Querying Supabase on every AI request adds 50-200ms latency. AI streaming is latency-sensitive.

**Decision:** `lru-cache` (v11+, by Isaac Schlueter) with 5-minute TTL and max 1000 entries.

**Why `lru-cache` over raw `Map`:**
- Native TTL support in milliseconds (no manual `setTimeout` cleanup)
- LRU eviction prevents unbounded memory growth
- Max size bound (1000 users = ~50KB memory)
- Zero dependencies, TypeScript-native
- Stale-while-revalidate option for non-blocking refresh

**Cache configuration:**
```typescript
import { LRUCache } from 'lru-cache'

interface EntitlementCacheEntry {
  tier: 'free' | 'trial' | 'premium'
  expiresAt?: string  // Stripe subscription expiry
}

const entitlementCache = new LRUCache<string, EntitlementCacheEntry>({
  max: 1000,
  ttl: 5 * 60 * 1000,  // 5 minutes
})
```

**Cache miss flow:**
1. Cache miss for `userId`
2. Query Supabase: `supabaseAdmin.from('entitlements').select('tier, expires_at').eq('user_id', userId).single()`
3. Store result in cache
4. Return tier for middleware decision

**Cache invalidation:**
- **Primary:** TTL expiry (5 minutes). Subscription changes propagate within 5 minutes.
- **Optional future enhancement:** Stripe webhook POSTs to `/api/internal/invalidate-entitlement` (shared secret protected) to force immediate cache eviction. Reduces propagation to seconds.
- **Process restart:** Cache cleared. First request per user hits Supabase.

**Supabase unreachable handling:**
- Cache has valid entry → honor it (fail-open for known users)
- No cache entry → reject with 503 `SERVICE_UNAVAILABLE` (fail-closed for unknown users)
- Log warning for monitoring

### Decision 4: Open Relay Prevention

**Problem:** An unauthenticated CORS proxy is an exploitable open relay (HTTP Toolkit research). Even with JWT auth, additional layers are needed.

**Decision:** 4-layer defense:

| Layer | Purpose | Implementation |
|---|---|---|
| **1. Origin check** | Only allow requests from Knowlune frontends | Check `Origin`/`Referer` header against `ALLOWED_ORIGINS` env var |
| **2. JWT authentication** | Identity verification — only registered users | `jose.jwtVerify()` (see Decision 2) |
| **3. Domain allowlist** | Prevent proxying to arbitrary destinations | For non-BYOK: only proxy to known AI provider domains. For BYOK Ollama: existing SSRF protection (`isAllowedOllamaUrl`) blocks loopback/metadata |
| **4. Rate limiting** | Prevent abuse even by authenticated users | Per-user token bucket (see Decision 5) |

**Origin check details:**
- `ALLOWED_ORIGINS` env var: comma-separated list of allowed origins
- Development: `http://localhost:5173,http://localhost:4173`
- Production: `https://knowlune.app` (or deployed domain)
- Missing origin header: reject (browser always sends `Origin` on cross-origin requests)
- Exception: health check endpoint (`/api/ai/ollama/health`) skips origin check

**Domain allowlist for non-BYOK (future Knowlune-hosted AI):**
- `api.openai.com`
- `api.anthropic.com`
- `api.groq.com`
- `generativelanguage.googleapis.com`
- `open.bigmodel.cn`
- Configurable via env var for adding new providers

### Decision 5: Rate Limiting

**Problem:** Even authenticated premium users could abuse the proxy (runaway loops, shared accounts).

**Decision:** `rate-limiter-flexible` with per-user token bucket, tier-based rates.

**Why `rate-limiter-flexible` over `express-rate-limit`:**
- Supports keying by arbitrary string (userId), not just IP
- Native tier-based configuration (different limits per group)
- Per-request point costs (streaming can cost more "points")
- Memory → Redis migration path without code changes
- Active maintenance, 5M+ weekly downloads

| Tier | Bucket Size (burst) | Refill Rate | Points per Request |
|---|---|---|---|
| Free (authenticated) | 5 | 2/min | 1 (non-stream), 2 (stream) |
| Trial | 20 | 10/min | 1 (non-stream), 2 (stream) |
| Premium | 20 | 10/min | 1 (non-stream), 2 (stream) |
| BYOK (any tier) | 30 | 15/min | 1 (all — user pays provider) |

**Rate limit response:**
- HTTP 429 Too Many Requests
- `Retry-After` header with seconds until refill
- Body: `{ "error": "RATE_LIMITED", "retryAfter": 30 }`

**Critical:** Rate limiting checks happen at request initiation, before streaming begins. Individual SSE chunks are not counted.

### Decision 6: Graceful Degradation

**Scenario: Subscription lapses mid-session**
1. Stripe webhook fires → updates Supabase `entitlements` table → tier = `'free'`
2. Server cache TTL (5 min) means at most 5 more minutes of premium access
3. Next request after cache refresh returns 403:
   ```json
   { "error": "ENTITLEMENT_EXPIRED", "message": "Your premium subscription has expired.", "upgradeUrl": "/settings" }
   ```
4. Client `ProxyLLMClient` maps 403 to `LLMError` with code `ENTITLEMENT_ERROR`
5. UI shows re-subscribe CTA via existing `PremiumGate` component

**Scenario: Supabase unreachable during entitlement check**
- Cached user → honor cache (fail-open)
- Unknown user → 503 `SERVICE_UNAVAILABLE` (fail-closed)
- Log warning for monitoring

**Scenario: JWT expired mid-session**
- 401 `TOKEN_EXPIRED` response
- Supabase client auto-refreshes token via `onAuthStateChange`
- Client retries request with new token
- No user-facing interruption (transparent refresh)

**Scenario: User signed out**
- No JWT → 401 `AUTH_REQUIRED`
- UI shows sign-in prompt (existing flow via `AuthDialog`)
- BYOK features continue to work after sign-in

### Decision 7: Vite Dev Proxy Strategy

**Problem:** Vite dev server has `ollamaDevProxy()` that mirrors Express endpoints. Should it enforce auth?

**Decision:** Mirror enforcement with `DEV_SKIP_ENTITLEMENT=true` escape hatch.

**Implementation:**
- Extract shared middleware logic into `server/middleware/entitlement.ts`
- Both Express (`server/index.ts`) and Vite plugin (`vite.config.ts`) import the same middleware
- `DEV_SKIP_ENTITLEMENT=true` in `.env.local` bypasses all auth checks in dev only
- Checked against `process.env.NODE_ENV === 'development'` — ignored in production builds

**When Vite proxy vs Express proxy is used:**
- Express running on :3001 → Vite proxies `/api/ai/*` to Express (Express handles auth)
- Express NOT running → Vite dev middleware handles requests directly (needs its own auth)
- Production build → Express only (no Vite)

**Recommendation:** For development, run Express on :3001 with `DEV_SKIP_ENTITLEMENT=true`. The Vite dev proxy (`ollamaDevProxy`) should also respect the flag but log a warning: `"⚠️ Entitlement checks disabled (DEV_SKIP_ENTITLEMENT=true)"`

### Decision 8: Client-Side Changes

**Problem:** `ProxyLLMClient` and `OllamaLLMClient` currently send requests without `Authorization` headers.

**Decision:** All proxy requests include `Authorization: Bearer <JWT>` from the Supabase session.

**Implementation approach:**
- `getLLMClient()` factory already has access to AI configuration
- Add session token retrieval: `useAuthStore.getState().session?.access_token`
- Pass token to client constructors; clients include it in fetch headers
- If no session (signed out), client throws `LLMError` with `AUTH_REQUIRED` before making request

**Client-side flow change:**
```
Before: getLLMClient() → ProxyLLMClient.streamCompletion() → fetch('/api/ai/stream', { body })
After:  getLLMClient() → ProxyLLMClient.streamCompletion() → fetch('/api/ai/stream', { headers: { Authorization }, body })
```

**`isPremium()` role change:**
- Before: Security boundary (gates access to premium features)
- After: UX hint (drives fast UI rendering, skeleton states, upgrade CTAs)
- No code removal — `PremiumGate`, `useIsPremium()`, `SubscriptionCard` all continue to work
- Add JSDoc comment: `/** UX hint for fast rendering. Server-side middleware is the security boundary. */`

### New Files and Modifications

**New files:**

| File | Purpose |
|---|---|
| `server/middleware/authenticate.ts` | JWT validation with `jose`. Extracts userId, attaches to req. Supports HS256 secret and future JWKS. |
| `server/middleware/entitlement.ts` | BYOK detection + entitlement check from `lru-cache` / Supabase fallback. |
| `server/middleware/rate-limiter.ts` | Per-user token bucket with `rate-limiter-flexible`. Tier-based limits. |
| `server/middleware/origin-check.ts` | Validates request Origin against `ALLOWED_ORIGINS` allowlist. |
| `server/middleware/types.ts` | Shared types: `AuthenticatedRequest`, `EntitlementCacheEntry`. |
| `server/middleware/__tests__/authenticate.test.ts` | Unit tests for JWT validation (valid/expired/missing/malformed tokens). |
| `server/middleware/__tests__/entitlement.test.ts` | Unit tests for BYOK detection, cache hit/miss, tier check. |
| `server/middleware/__tests__/rate-limiter.test.ts` | Unit tests for tier-based rate limits, burst behavior, 429 responses. |

**Modified files:**

| File | Change |
|---|---|
| `server/index.ts` | Import and apply middleware chain to `/api/ai/*` routes. Health check endpoint excluded from auth. |
| `src/ai/llm/proxy-client.ts` | Add `Authorization: Bearer` header from auth store session. |
| `src/ai/llm/ollama-client.ts` | Add `Authorization: Bearer` header in proxy mode (not direct mode). |
| `src/ai/llm/factory.ts` | Pass session token to client constructors. |
| `src/ai/llm/types.ts` | Add `ENTITLEMENT_ERROR` and `RATE_LIMITED` to `LLMErrorCode`. |
| `src/ai/llm/client.ts` | Map 403 → `ENTITLEMENT_ERROR`, 429 → `RATE_LIMITED` in `BaseLLMClient`. |
| `src/lib/entitlement/isPremium.ts` | Add JSDoc clarifying UX-hint-only role. No logic changes. |
| `vite.config.ts` | Import shared middleware for `ollamaDevProxy()`, respect `DEV_SKIP_ENTITLEMENT`. |
| `package.json` | Add `jose`, `lru-cache`, `rate-limiter-flexible` dependencies. |
| `.env.example` | Add `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`, `DEV_SKIP_ENTITLEMENT`. |

### Implementation Sequence

| Story | Scope | Dependencies | Key Files |
|---|---|---|---|
| E##-S01 | JWT authentication middleware (`jose` + HS256 + aud verification + JWKS-ready config) | None | `server/middleware/authenticate.ts`, `server/middleware/types.ts`, tests |
| E##-S02 | Origin check middleware + `ALLOWED_ORIGINS` configuration | None | `server/middleware/origin-check.ts`, `.env.example` |
| E##-S03 | BYOK detection + entitlement check middleware (`lru-cache` + Supabase fallback) | S01 | `server/middleware/entitlement.ts`, tests |
| E##-S04 | Per-user tier-based rate limiter (`rate-limiter-flexible` + token bucket) | S01, S03 | `server/middleware/rate-limiter.ts`, tests |
| E##-S05 | Wire middleware chain into Express proxy + health check exclusion | S01-S04 | `server/index.ts` |
| E##-S06 | Client-side auth header injection (ProxyLLMClient + OllamaLLMClient proxy mode) | S05 | `src/ai/llm/proxy-client.ts`, `src/ai/llm/ollama-client.ts`, `src/ai/llm/factory.ts` |
| E##-S07 | Error handling UI (403 → re-subscribe CTA, 401 → auto-refresh, 429 → retry indicator) | S06 | `src/ai/llm/client.ts`, `src/ai/llm/types.ts` |
| E##-S08 | Vite dev proxy mirroring + `DEV_SKIP_ENTITLEMENT` + `isPremium()` JSDoc update | S01 | `vite.config.ts`, `src/lib/entitlement/isPremium.ts` |

### Entitlement Enforcement Validation

**Coherence with Existing Architecture:**
- Follows established BYOK philosophy: user-provided keys bypass entitlement (no gate on user's own resources)
- Extends Express proxy pattern with middleware chain (same layering as SSRF protection via `isAllowedOllamaUrl`)
- Uses Supabase infrastructure already in place (JWT tokens, entitlements table, RLS)
- Client-side `isPremium()` retains its role for UI rendering; this addendum adds the server-side security boundary
- Follows Zod validation pattern already in `server/index.ts` for request body schemas

**Requirements Coverage:**
- Adversarial Finding #9 fully addressed: server-side enforcement on all Knowlune-hosted AI endpoints
- BYOK model preserved: user-provided API keys and Ollama servers bypass premium check (but still require auth)
- Offline UX preserved: `isPremium()` cache drives UI gates; server enforcement only applies to online AI requests
- Stripe webhook integration reused: `entitlements` table is the single source of truth
- Open relay prevention: 4-layer defense (origin + JWT + domain allowlist + rate limit)

**Risk Mitigations:**
- Supabase unreachable → fail-open for cached users, fail-closed for unknown users
- JWT secret rotation → single env var update, no code change
- Memory leak in entitlement cache → `lru-cache` handles TTL eviction and max size bounding
- Rate limiter drift → process restart clears counters (acceptable for single-instance proxy)
- BYOK/hosted coupling (Vercel bug) → independent middleware layers, never coupled
- Future JWKS migration → middleware auto-detects `SUPABASE_JWKS_URL` env var

---

## AI Deep Strategy Architecture (Epics 36-43)

_Added 2026-03-28. This section extends the architecture for the AI Deep Strategy — 8 epics covering model selection, Socratic tutoring, token metering, flashcards, quizzes, subscription tiers, Study Buddy, and cross-feature intelligence. Three strategic gaps drove this work: (1) users can select a provider but not a model (wire disconnected at factory.ts:95), (2) no subscription/billing for non-BYOK users, (3) AI features should go deeper with tutoring, flashcards, quizzes, and a conversational study buddy._

**Input Documents:**
- AI Deep Strategy plan: `/Users/pedro/.claude/plans/adaptive-petting-unicorn.md`
- Existing AI Layer Architecture: this document, line 1249
- Existing Entitlement Architecture: this document, line 1869

### AI Deep Strategy Decision Summary

| Decision Area | Choice | Rationale |
|---|---|---|
| Model registry | `src/lib/modelRegistry.ts` with `ModelInfo` interface (id, provider, tier, pricing, speed, bestFor, freeTierAllowed) | Extends existing `AI_PROVIDERS` pattern; enables per-feature cost optimization (5-10x cost differences between summary vs. tutoring models) |
| Per-feature model overrides | `featureModelOverrides` in config + `getLLMClient(featureId?)` | Wire exists end-to-end (`ProxyLLMClient` model param line 29, `getProviderModel()` override line 30) — just needs connecting at `factory.ts:95` |
| Tutor architecture | `src/ai/tutor/` module with Socratic prompts, sessionManager, adaptiveEngine, Dexie tables | Reuses RAG coordinator for context, ChatQA UI patterns for chat interface, streaming from `BaseLLMClient` |
| FSRS flashcard scheduling | `src/ai/flashcards/scheduler.ts` implementing Free Spaced Repetition Scheduler | FSRS outperforms SM-2 by ~15% retention accuracy (trained on 300M+ Anki reviews). Card state machine: New → Learning → Review → Relearning |
| Token metering | Proxy middleware counting tokens per SSE response + Supabase `ai_usage` table | Extends existing entitlement middleware chain (`server/middleware/`). tiktoken fallback for providers without usage metadata |
| Study Buddy overlay | Floating chat in `Layout.tsx` with LLM-based intent detection → feature routing | Follows Layout overlay pattern (SearchCommandPalette, OnboardingOverlay at lines 615-639). Context engine for page/lesson/course awareness |
| Intelligence loop | Misconception → flashcard pipeline, quiz → gap aggregation, comprehension → path reordering | Cross-feature data flow connecting tutor, flashcards, quizzes, knowledge gaps, and learning paths into a feedback loop |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Browser (Client)                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Model Selection Layer (E36)                       │    │
│  │                                                                     │    │
│  │  ModelRegistry              AIConfigurationSettings                  │    │
│  │  ┌──────────────────┐       ┌──────────────────────────────┐        │    │
│  │  │ ModelInfo[]       │       │ selectedModels: per-provider  │        │    │
│  │  │ per provider,     │◄─────│ featureModelOverrides:        │        │    │
│  │  │ tier, cost, speed │       │   per-feature model choice    │        │    │
│  │  └────────┬─────────┘       └──────────────┬───────────────┘        │    │
│  │           │                                │                        │    │
│  │           ▼                                ▼                        │    │
│  │  getLLMClient(featureId?)                                           │    │
│  │  ┌──────────────────────────────────────────────┐                   │    │
│  │  │ 1. Check featureModelOverrides[featureId]     │                   │    │
│  │  │ 2. Fall back to selectedModels[provider]      │                   │    │
│  │  │ 3. Fall back to getDefaultModel(provider)     │                   │    │
│  │  │ 4. Pass model to ProxyLLMClient constructor   │                   │    │
│  │  └──────────────────────┬───────────────────────┘                   │    │
│  └─────────────────────────┼───────────────────────────────────────────┘    │
│                            │                                                │
│  ┌─────────────────────────┼───────────────────────────────────────────┐    │
│  │                    AI Feature Layer                                  │    │
│  │                         │                                           │    │
│  │  ┌─────────────┐  ┌────┴────────┐  ┌──────────────┐  ┌─────────┐  │    │
│  │  │ Tutor (E37) │  │ Flashcards  │  │ Quiz (E40)   │  │ Existing│  │    │
│  │  │ Socratic    │  │ (E39)       │  │ Adaptive     │  │ Features│  │    │
│  │  │ prompts,    │  │ FSRS sched, │  │ difficulty,  │  │ Summary │  │    │
│  │  │ adaptive    │  │ AI gen,     │  │ 5 Q types,   │  │ Chat QA │  │    │
│  │  │ difficulty  │  │ spaced rep  │  │ concept-map  │  │ L.Path  │  │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  │ K.Gaps  │  │    │
│  │         │                │                │          │ Notes   │  │    │
│  │         │    ┌───────────┼────────────────┘          └─────────┘  │    │
│  │         │    │           │                                        │    │
│  │         ▼    ▼           ▼                                        │    │
│  │  ┌──────────────────────────────────┐                             │    │
│  │  │   Intelligence Loop (E43)         │                             │    │
│  │  │                                   │                             │    │
│  │  │  Tutor misconceptions             │                             │    │
│  │  │    → auto-generate flashcards     │                             │    │
│  │  │  Quiz wrong answers               │                             │    │
│  │  │    → weighted knowledge gaps      │                             │    │
│  │  │  Comprehension data               │                             │    │
│  │  │    → learning path reordering     │                             │    │
│  │  └──────────────────────────────────┘                             │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │                    Study Buddy Overlay (E42)                       │    │
│  │  Floating FAB → expandable chat panel                              │    │
│  │  Context engine: current page, lesson, course                      │    │
│  │  Intent detection → routes to tutor/flashcards/quiz/RAG/analytics  │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────┐    │
│  │  Dexie Storage (new tables)                                        │    │
│  │  tutorSessions | tutorMisconceptions | flashcardDecks | flashcards │    │
│  │  reviewSessions | quizzes | quizAttempts                           │    │
│  └───────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                     POST /api/ai/* + Authorization: Bearer <JWT>
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Express Proxy (:3001)                                 │
│                                                                             │
│  Existing middleware chain (from Entitlement Architecture):                   │
│    Origin Check → JWT Auth → BYOK Detection → Entitlement → Rate Limit      │
│                                                                             │
│  NEW: Token Counting Middleware (E38)                                        │
│  ┌───────────────────────────────────────────────────────┐                  │
│  │  ... → Rate Limit → [handler] → Token Counter → respond                  │
│  │                                                       │                  │
│  │  1. Parse SSE stream for usage metadata               │                  │
│  │  2. Fallback: estimate via tiktoken                   │                  │
│  │  3. Log to Supabase ai_usage table                    │                  │
│  │  4. Deduct from ai_budgets.used_this_month            │                  │
│  └───────────────────────────────────────────────────────┘                  │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │ AI Providers │ │ Supabase DB  │ │ Supabase DB  │
          │ (6 cloud +   │ │ (ai_usage,   │ │ (entitlements│
          │  Ollama)     │ │  ai_budgets) │ │  table)      │
          └──────────────┘ └──────────────┘ └──────────────┘
```

### Decision 1: Model Registry Pattern

**Problem:** Users are locked into hardcoded defaults (Haiku 4.5, GPT-4-turbo). Different AI tasks have 5-10x cost differences — summaries work on economy models, tutoring needs premium reasoning. There's no way to browse available models or understand cost/quality tradeoffs.

**Decision:** Create `src/lib/modelRegistry.ts` with a typed model catalog, extending the existing `AI_PROVIDERS` registry pattern in `src/lib/aiConfiguration.ts`.

**ModelInfo interface:**
```typescript
interface ModelInfo {
  id: string                // API model ID (e.g., 'claude-sonnet-4-6')
  name: string              // Display name (e.g., 'Claude Sonnet 4.6')
  provider: AIProviderId    // Reuses existing type from aiConfiguration.ts
  tier: 'economy' | 'balanced' | 'premium'
  inputCostPer1M: number    // USD per 1M input tokens
  outputCostPer1M: number   // USD per 1M output tokens
  contextWindow: number     // Max tokens (e.g., 200000)
  speed: 'fast' | 'medium' | 'slow'
  bestFor: string[]         // ['summaries', 'chat', 'analysis', 'tutoring']
  isDefault?: boolean       // One per provider
  freeTierAllowed?: boolean // true for economy models on free providers (Ollama, Groq, Gemini, GLM)
}
```

**Catalog structure (all 6 providers):**

| Provider | Economy | Balanced | Premium |
|---|---|---|---|
| OpenAI | GPT-4.1-mini | GPT-4.1 | o3 |
| Anthropic | Haiku 4.5 | Sonnet 4.6 | Opus 4.6 |
| Groq | Llama 3.3 70B | Llama 4 Scout | DeepSeek R1 (via Groq) |
| Gemini | Gemini 2.0 Flash | Gemini 2.5 Pro | Gemini 2.5 Pro (high thinking) |
| GLM | GLM-4-Flash | GLM-4-Plus | GLM-4-Long |
| Ollama | (dynamic from API) | (dynamic from API) | (dynamic from API) |

**Ollama special case:** Ollama models are fetched dynamically via `OllamaLLMClient.fetchModels()`. The registry stores a placeholder entry for Ollama; actual model list comes from the user's server. Tier classification for Ollama models is omitted (user self-manages).

**Exported functions:**
```
getModelsForProvider(id: AIProviderId): ModelInfo[]     — Filter catalog by provider
getDefaultModel(id: AIProviderId): ModelInfo            — Return isDefault=true entry
getModelById(id: string): ModelInfo | undefined         — Lookup by API model ID
getFreeTierModels(): ModelInfo[]                        — Filter freeTierAllowed=true
getModelsForFeature(feature: string): ModelInfo[]       — Filter by bestFor tag
```

**Relationship to `AI_PROVIDERS`:** The model registry is a separate module that imports `AIProviderId` from `aiConfiguration.ts`. It does NOT replace `AI_PROVIDERS` — that registry handles provider-level concerns (validation patterns, connection testing, display names). The model registry adds model-level concerns (pricing, capabilities, tier classification).

**Update cadence:** Model catalog is hardcoded with a `CATALOG_VERSION` string. Updated when new models are released. Future enhancement: fetch latest catalog from a CDN endpoint.

### Decision 2: Per-Feature Model Overrides + getLLMClient Enhancement

**Problem:** All AI features use the same model. Summaries (low stakes, high volume) should use economy models while tutoring (high stakes, interactive) should use premium reasoning models. The `getLLMClient()` factory creates clients without passing the model parameter, even though `ProxyLLMClient` already accepts it.

**Decision:** Add `featureModelOverrides` to config and enhance `getLLMClient()` with a 3-tier resolution: feature override → global selection → provider default.

**Config schema extension (in `src/lib/aiConfiguration.ts`):**
```typescript
type AIFeatureId =
  | 'videoSummary'
  | 'noteQA'
  | 'learningPath'
  | 'knowledgeGaps'
  | 'noteOrganization'
  | 'analytics'
  | 'tutor'
  | 'flashcards'
  | 'quiz'
  | 'studyBuddy'

interface AIConfigurationSettings {
  // ... existing fields ...
  selectedModels?: Partial<Record<AIProviderId, string>>       // Global per-provider model
  featureModelOverrides?: Partial<Record<AIFeatureId, string>> // Per-feature model ID
}
```

**getLLMClient resolution flow (modified `src/ai/llm/factory.ts`):**
```
getLLMClient(featureId?: AIFeatureId)
  │
  ├─ Test injection? → return window.__mockLLMClient
  │
  ├─ Read config = getAIConfiguration()
  │
  ├─ Resolve model:
  │   1. featureId && config.featureModelOverrides?.[featureId]  → use that model
  │   2. config.selectedModels?.[config.provider]                → use global selection
  │   3. getDefaultModel(config.provider).id                     → use registry default
  │
  ├─ Ollama path: OllamaLLMClient(serverUrl, { model })
  │
  └─ Cloud path: ProxyLLMClient(providerId, apiKey, model)
                                                         ↑ currently missing at line 95
```

**The existing wire (connecting the disconnected pieces):**
- `ProxyLLMClient` constructor already stores `this.model = model` (proxy-client.ts:29)
- `ProxyLLMClient.streamCompletion()` already sends `model` in request body (proxy-client.ts:58)
- `server/providers.ts:getProviderModel()` already accepts optional `model` override (line 30)
- **Only missing piece:** `factory.ts:95` calls `new ProxyLLMClient(providerId, apiKey)` without passing model

**UI approach (in `AIConfigurationSettings.tsx`):**
- Below provider selector: add `ModelPicker` component (replaces `OllamaModelPicker` for all providers)
- Collapsible "Advanced: Per-Feature Models" section at bottom of AI Settings
- Shows feature name + current model (inherited or overridden) + dropdown to override
- "Reset to Default" button per feature
- ModelPicker component shows: model name, tier badge (Economy/Balanced/Premium), cost per 1M tokens, speed indicator, "best for" tags

**Generalizing OllamaModelPicker:**
- Current `OllamaModelPicker.tsx` is Ollama-specific (fetches from server, shows sizes)
- New `ModelPicker.tsx`: generic component that accepts `ModelInfo[]` and `onModelSelect`
- For Ollama: wraps OllamaModelPicker behavior (dynamic fetch) inside ModelPicker shell
- For cloud providers: reads from ModelRegistry catalog (static)
- Shared UI: searchable combobox (same shadcn Popover + Command pattern)

### Decision 3: Tutor Architecture

**Problem:** No AI tutoring exists. Research shows 40% comprehension gains from Socratic tutoring over passive learning. This is Knowlune's #1 differentiator — no competing personal learning platform has AI Socratic tutoring integrated with course content.

**Decision:** Create `src/ai/tutor/` module with Socratic prompt engineering, adaptive difficulty, misconception tracking, and Dexie persistence. Reuse RAG coordinator for content retrieval and ChatQA patterns for UI.

**Module structure:**
```
src/ai/tutor/
  ├── types.ts           TutorSession, TutorMessage, MisconceptionRecord, TutorDifficulty
  ├── prompts.ts         Socratic system prompts, difficulty-scaled templates
  ├── sessionManager.ts  CRUD: create/resume/close sessions, add messages
  ├── adaptiveEngine.ts  Difficulty adjustment, misconception detection, cross-session tracking
  └── hooks/
      └── useTutor.ts    React hook: session state, send message, streaming, difficulty control
```

**Socratic prompt strategy (3 difficulty modes):**

| Mode | Behavior | System Prompt Instruction |
|---|---|---|
| **Guided** | Heavy scaffolding, leading questions, immediate hints | "Ask one simple question at a time. If the student struggles, provide a hint within 2 exchanges. Break complex concepts into small steps." |
| **Challenging** | Probing questions, Socratic questioning, delayed hints | "Ask questions that reveal understanding. Do not give answers. If the student struggles after 3 exchanges, provide a subtle hint. Challenge correct answers with 'why' follow-ups." |
| **Expert** | Devil's advocate, edge cases, conceptual depth | "Challenge every answer, even correct ones. Probe edge cases and implications. Only confirm mastery after the student defends their reasoning from multiple angles." |

**RAG integration:** The tutor uses `ragCoordinator.retrieveContext(query)` to ground questions in course content. The system prompt includes retrieved note chunks as context. This prevents hallucination and ensures questions relate to material the student has studied.

**Dexie schema additions:**
```typescript
// Added to schema.ts at next version increment
tutorSessions: '++id, lessonId, courseId, startedAt, difficulty, status'
tutorMisconceptions: '++id, sessionId, concept, detectedAt, resolvedAt'
```

**TutorSession type:**
```typescript
interface TutorSession {
  id?: number
  lessonId: string
  courseId: string
  startedAt: Date
  closedAt?: Date
  difficulty: 'guided' | 'challenging' | 'expert'
  status: 'active' | 'completed' | 'abandoned'
  messageCount: number
  misconceptionCount: number
}

interface TutorMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  misconceptionDetected?: string  // concept tag if AI detected a misconception
}

interface MisconceptionRecord {
  id?: number
  sessionId: number
  concept: string           // e.g., "recursion base case"
  description: string       // AI's description of the misconception
  detectedAt: Date
  resolvedAt?: Date         // Set when student demonstrates understanding
  feedsInto?: 'flashcard' | 'quiz'  // Intelligence loop tracking
}
```

**UI placement:** Collapsible tutor panel in `LessonPlayer.tsx` (right sidebar on desktop, bottom drawer on mobile). Chat-style interface reusing message list/input patterns from `ChatQA.tsx`. "Start Tutoring" button appears on lesson pages. Session history accessible via tutor panel header.

**Streaming:** Uses same `AsyncGenerator<LLMStreamChunk>` pattern as all existing features. The `useTutor` hook wraps `getLLMClient('tutor')` with session management.

### Decision 4: FSRS Flashcard Scheduling

**Problem:** Knowlune needs spaced repetition for long-term retention. The existing `reviewRecords` and `flashcards` Dexie tables exist but lack a scheduling algorithm.

**Decision:** Implement FSRS (Free Spaced Repetition Scheduler) — the successor to SM-2, used by modern Anki (adopted 2023). FSRS uses a 4-parameter model trained on 300M+ Anki reviews, achieving ~15% better retention prediction than SM-2.

**FSRS algorithm core (`src/ai/flashcards/scheduler.ts`):**

```typescript
interface FSRSParameters {
  w: [number, number, number, number]  // 4 weights (default: [0.4, 0.6, 2.4, 5.8])
  requestRetention: number              // Target retention rate (default: 0.9 = 90%)
  maximumInterval: number               // Max days between reviews (default: 36500)
}

interface CardSchedulingState {
  stability: number      // How long the memory lasts (days)
  difficulty: number     // 0-10, how hard the card is for this user
  elapsedDays: number    // Days since last review
  scheduledDays: number  // Days until next review
  reps: number           // Total review count
  lapses: number         // Times card was forgotten (rated Again)
  state: CardState       // New | Learning | Review | Relearning
  lastReview?: Date
}

type CardState = 'new' | 'learning' | 'review' | 'relearning'
type Rating = 'again' | 'hard' | 'good' | 'easy'  // Maps to 1-4
```

**State machine:**
```
                 ┌─────────────────────────────────┐
                 │                                  │
    ┌────────┐   │  ┌──────────┐   ┌──────────┐   │
    │  New   │───┴──│ Learning │───│ Review   │───┘
    └────────┘      └──────────┘   └────┬─────┘
                         ▲              │ (Again)
                         │              ▼
                         │         ┌──────────────┐
                         └─────────│ Relearning   │
                                   └──────────────┘
```

- **New → Learning:** First review of a new card
- **Learning → Review:** Good/Easy rating during learning
- **Review → Review:** Good/Easy rating (interval increases)
- **Review → Relearning:** Again rating (card forgotten, lapse counted)
- **Relearning → Review:** Good/Easy rating (shorter interval than before lapse)

**Key functions:**
```
scheduleCard(card: CardSchedulingState, rating: Rating): CardSchedulingState
getNextReviewDate(card: CardSchedulingState): Date
getDueCards(deck: FlashcardDeck): Flashcard[]     // Cards where nextReview <= now
getRetentionEstimate(card: CardSchedulingState): number  // Current retrievability 0-1
```

**AI card generation (`src/ai/flashcards/generator.ts`):**
- Input: lesson transcript + user notes (via RAG coordinator)
- Output: structured JSON → parsed into Flashcard objects
- Card types: Q&A, Cloze deletion, Concept definition, True/False
- Deduplication: check existing deck concepts before generating
- LLM prompt outputs: `{ cards: [{ type, front, back, clozeText?, concept }] }`

**Dexie schema additions:**
```typescript
flashcardDecks: '++id, courseId, lessonId, title, createdAt'
flashcards: '++id, deckId, type, difficulty, state, nextReview, [deckId+nextReview]'
reviewSessions: '++id, deckId, startedAt, cardsReviewed, correctCount'
```

**Compound index `[deckId+nextReview]`** enables efficient "get due cards for deck" queries without scanning all flashcards.

### Decision 5: Token Metering

**Problem:** No way to track AI usage per user. Subscription tiers need usage limits, BYOK users need visibility into their API costs, and Knowlune needs cost data to set sustainable pricing.

**Decision:** Add token counting middleware to the Express proxy (post-response), log to Supabase `ai_usage` table, and enforce budgets via `ai_budgets` table. Extends the existing entitlement middleware chain.

**Middleware placement in the chain:**
```
Origin Check → JWT Auth → BYOK Detection → Entitlement → Rate Limit
  → [handler: AI provider call] → Token Counter (post-response) → respond
```

**Token counting strategy:**
1. **Primary:** Parse SSE stream for provider-supplied usage metadata
   - OpenAI: `usage` field in final stream chunk (`prompt_tokens`, `completion_tokens`)
   - Anthropic: `message_delta` event with `usage` object
   - Groq: `x-groq` header with token counts
   - Gemini: `usageMetadata` in response
   - GLM: `usage` field in response
2. **Fallback:** Estimate via `tiktoken` (cl100k_base tokenizer) for providers that don't return counts
3. **Ollama:** Ollama API returns `eval_count` and `prompt_eval_count` natively

**Implementation approach:** The token counter is a response interceptor, not a request middleware. It wraps the response stream, watches for usage metadata in the final chunk, and fires an async log to Supabase after the response completes. This ensures zero added latency to the user-facing response.

**Supabase tables:**
```sql
-- Per-request usage log
CREATE TABLE ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT,                    -- AIFeatureId or null
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_estimate NUMERIC(10,6),     -- USD, computed from model registry pricing
  is_byok BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_usage_user_month ON ai_usage (user_id, created_at);

-- Monthly budget tracking
CREATE TABLE ai_budgets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  tier TEXT NOT NULL DEFAULT 'free',
  monthly_token_limit INTEGER,     -- null = unlimited (BYOK)
  used_this_month INTEGER DEFAULT 0,
  reset_date DATE NOT NULL,        -- 1st of next month
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Budget enforcement flow:**
1. Pre-request: check `ai_budgets.used_this_month < monthly_token_limit`
2. If over budget: return 402 `BUDGET_EXCEEDED` with upgrade CTA
3. Post-response: increment `used_this_month` by actual token count
4. BYOK users: `monthly_token_limit = null` (no enforcement, log-only)

**Budget warnings (client-side):**
- 80% usage: yellow banner in AI Settings + toast notification
- 95% usage: red banner with "X tokens remaining" counter
- 100%: complete current response, then show upgrade CTA with model downgrade suggestion
- Fetched via `GET /api/ai/usage/budget` endpoint (cached 5 min client-side)

**Cost estimation:** `cost_estimate = (input_tokens / 1M) * model.inputCostPer1M + (output_tokens / 1M) * model.outputCostPer1M`. Uses model registry pricing data.

### Decision 6: Study Buddy Overlay

**Problem:** Each AI feature is siloed in its own page. Users must navigate to ChatQA for Q&A, to a lesson for tutoring, to Settings for configuration. A conversational overlay that's always available and context-aware would unify the AI experience.

**Decision:** Floating chat overlay in `Layout.tsx` with LLM-based intent detection that routes to existing feature modules. Follows the Layout overlay pattern established by `SearchCommandPalette`, `OnboardingOverlay`, and `ImportProgressOverlay`.

**Overlay architecture:**
```
Layout.tsx
  └── <StudyBuddy />                    (new component, inserted alongside existing overlays)
        ├── <StudyBuddyFAB />           (floating action button, bottom-right)
        ├── <StudyBuddyPanel />         (expandable chat panel)
        │     ├── <StudyBuddyHeader />  (title, minimize, settings)
        │     ├── <MessageList />       (reuse from ChatQA patterns)
        │     ├── <ChatInput />         (reuse from ChatQA patterns)
        │     └── <ProactiveSuggestion /> (contextual prompts)
        └── Context Engine
              ├── useCurrentRoute()     (detect current page)
              ├── useCurrentLesson()    (detect active lesson)
              └── useRecentActivity()   (recent study actions)
```

**Context engine:** The Study Buddy knows where the user is and what they're doing. Context is assembled from:
- **Current route:** React Router's `useLocation()` → determines page context
- **Current lesson:** If on LessonPlayer, extract `lessonId` and `courseId` from route params
- **Recent activity:** Last 5 study sessions from Dexie `studySessions` table
- **Flashcard status:** Due card count from `flashcards` table
- **Knowledge gaps:** Active gaps from `detectGaps.ts`

Context is injected into the Study Buddy's system prompt as structured data, not as conversation history.

**Intent detection + feature routing (`src/ai/studyBuddy/intentRouter.ts`):**

| User Intent | Detection Pattern | Routes To |
|---|---|---|
| "Quiz me on Chapter 3" | quiz/test/assess keywords + content reference | `src/ai/quiz/generator.ts` |
| "Make flashcards for this lesson" | flashcard/card keywords + content scope | `src/ai/flashcards/generator.ts` |
| "Help me understand recursion" | explain/understand/why keywords | `src/ai/tutor/` (Socratic mode) |
| "What should I study today?" | study/plan/schedule keywords | Study planner logic (due cards + weak areas) |
| "What's my progress?" | progress/stats/how am I doing | Analytics summary from Dexie |
| General question | No specific intent detected | RAG coordinator (default fallback) |

**Intent classification approach:** Single LLM call with structured output:
```typescript
interface IntentClassification {
  intent: 'quiz' | 'flashcard' | 'tutor' | 'planner' | 'analytics' | 'rag'
  confidence: number      // 0-1
  contentScope?: string   // extracted course/lesson reference
  parameters?: Record<string, string>  // e.g., { difficulty: 'hard', count: '10' }
}
```

If confidence < 0.7, treat as RAG (general knowledge query). The intent classifier uses a small/fast model (economy tier) to minimize latency and cost.

**Session persistence:** Study Buddy conversation persists across page navigation within the same browser session. Stored in Zustand (not Dexie) — ephemeral by design. Users can optionally save a conversation to notes.

**Proactive suggestions (non-blocking):**
- After lesson completion: "Want me to quiz you on what you just learned?"
- When flashcards are due: "You have {N} flashcards due for review"
- On Knowledge Gaps page: "I noticed you're struggling with {concept} — want to practice?"
- Suggestions appear as subtle chips above the chat input, dismissible with one click

### Decision 7: Intelligence Loop

**Problem:** Each AI feature generates data in isolation. Tutor misconceptions don't inform flashcard generation. Quiz results don't update knowledge gaps. Learning paths don't consider actual comprehension. The feedback loop that makes each feature smarter from the others' data is missing.

**Decision:** Three cross-feature data flows connecting tutor, flashcards, quizzes, knowledge gaps, and learning paths into a closed feedback loop.

**Flow 1: Misconception → Flashcard Pipeline (E43-S01)**

```
Tutor Session
  │  AI detects misconception (stored in tutorMisconceptions)
  │
  ▼
adaptiveEngine.ts: getMisconceptionsForFlashcards()
  │  Filters: unresolved misconceptions not yet linked to a flashcard
  │
  ▼
flashcards/generator.ts: generateFromMisconceptions(misconceptions[])
  │  Creates targeted flashcards addressing each misconception
  │  Sets feedsInto: 'flashcard' on the MisconceptionRecord
  │
  ▼
User Confirmation
  │  Auto-generated cards presented for review (accept/reject/edit)
  │  Accepted cards added to relevant deck with state: 'new'
```

**Trigger:** Batch process after tutor session closes. Not real-time (avoid generating cards mid-conversation).

**Flow 2: Quiz + Tutor → Knowledge Gap Aggregation (E43-S02)**

```
Knowledge Gap Sources (unified scoring):
  ├── Study patterns (existing):        weight 0.3
  │   - Low watch % on lessons
  │   - Few notes on topics
  │   - Long gaps between study sessions
  │
  ├── Tutor misconceptions (new):       weight 0.4
  │   - Unresolved misconceptions → high gap confidence
  │   - Resolved misconceptions → reduced gap score
  │   - Frequency of misconception across sessions
  │
  └── Quiz performance (new):           weight 0.3
      - Wrong answers per concept
      - Concept difficulty trend (improving vs declining)
      - Question type weakness (MCQ vs short answer)
```

**Enhanced `detectGaps.ts`:**
```typescript
interface KnowledgeGap {
  concept: string
  confidence: number           // 0-1 weighted composite
  sources: GapSource[]         // Which signals contributed
  suggestedActions: GapAction[] // tutor, flashcard, quiz, rewatch
}

type GapSource =
  | { type: 'study-pattern'; metric: string; value: number }
  | { type: 'tutor-misconception'; misconceptionId: number; resolved: boolean }
  | { type: 'quiz-result'; quizId: number; questionType: string; wasCorrect: boolean }

type GapAction = 'practice-tutor' | 'review-flashcards' | 'take-quiz' | 'rewatch-lesson'
```

**Flow 3: Comprehension-Driven Learning Path Reordering (E43-S03)**

```
Current: suggestOrder.ts uses completion status + AI-inferred prerequisites
Enhanced: suggestOrder.ts also considers:
  │
  ├── Knowledge gap severity per concept
  │   - High gap in prerequisite → suggest reviewing before advancing
  │
  ├── Tutor session outcomes
  │   - Poor tutor performance on topic X → recommend X's prerequisite
  │
  └── Quiz/flashcard mastery
      - Concept mastered (high flashcard retention + quiz accuracy) → skip review
      - Concept weak → insert targeted review lesson
```

**Implementation:** `suggestOrder.ts` receives a `ComprehensionData` object alongside the existing completion data:
```typescript
interface ComprehensionData {
  conceptMastery: Map<string, number>  // concept → 0-1 mastery score
  activeGaps: KnowledgeGap[]
  recentTutorOutcomes: TutorSessionSummary[]
}
```

The ordering algorithm weights comprehension data at 40% (completion remains 60%) to avoid jarring reorderings that contradict the user's mental model of their progress.

### New Files and Modifications

**New files (across Epics 36-43):**

| File | Epic | Purpose |
|---|---|---|
| `src/lib/modelRegistry.ts` | E36 | Model catalog with ModelInfo interface, provider queries |
| `src/app/components/figma/ModelPicker.tsx` | E36 | Universal model selector (generalizes OllamaModelPicker) |
| `src/ai/tutor/types.ts` | E37 | TutorSession, TutorMessage, MisconceptionRecord types |
| `src/ai/tutor/prompts.ts` | E37 | Socratic system prompts (3 difficulty modes) |
| `src/ai/tutor/sessionManager.ts` | E37 | CRUD for tutor sessions in Dexie |
| `src/ai/tutor/adaptiveEngine.ts` | E37 | Difficulty adjustment, misconception tracking |
| `src/ai/tutor/hooks/useTutor.ts` | E37 | React hook for tutor flow |
| `src/app/components/figma/TutorPanel.tsx` | E37 | Collapsible tutor chat in LessonPlayer |
| `server/middleware/tokenCounter.ts` | E38 | Post-response token counting + Supabase logging |
| `server/middleware/usageLogger.ts` | E38 | Async usage logging to Supabase ai_usage |
| `src/app/components/figma/UsageDashboard.tsx` | E38 | Token budget bar, usage charts, cost breakdown |
| `src/ai/hooks/useBudgetCheck.ts` | E38 | Budget warning hook for all AI features |
| `src/ai/flashcards/types.ts` | E39 | Flashcard, FlashcardDeck, ReviewSchedule types |
| `src/ai/flashcards/scheduler.ts` | E39 | FSRS algorithm implementation |
| `src/ai/flashcards/generator.ts` | E39 | AI card generation from content |
| `src/ai/flashcards/prompts.ts` | E39 | Card generation system prompts |
| `src/ai/flashcards/hooks/useFlashcardGenerator.ts` | E39 | Card generation hook |
| `src/ai/flashcards/hooks/useReviewSession.ts` | E39 | Review session hook with FSRS scheduling |
| `src/app/pages/FlashcardReview.tsx` | E39 | Swipeable card review UI |
| `src/app/pages/FlashcardDecks.tsx` | E39 | Deck management page |
| `src/ai/quiz/types.ts` | E40 | Quiz, Question, QuizAttempt types |
| `src/ai/quiz/generator.ts` | E40 | AI quiz generation with difficulty scaling |
| `src/ai/quiz/scorer.ts` | E40 | Scoring + adaptive difficulty adjustment |
| `src/ai/quiz/prompts.ts` | E40 | Quiz generation system prompts per format |
| `src/ai/quiz/hooks/useQuiz.ts` | E40 | React hook for quiz flow |
| `src/app/pages/QuizPlayer.tsx` | E40 | Quiz-taking UI with per-question-type components |
| `src/app/components/figma/StudyBuddy.tsx` | E42 | Floating overlay shell + context engine |
| `src/ai/studyBuddy/intentRouter.ts` | E42 | LLM-based intent classification → feature routing |
| `src/ai/studyBuddy/proactiveSuggestions.ts` | E42 | Context-aware suggestion generation |
| `src/ai/studyBuddy/personality.ts` | E42 | Tone configuration + preference memory |

**Modified files (across Epics 36-43):**

| File | Epic | Change |
|---|---|---|
| `src/lib/aiConfiguration.ts` | E36 | Add `selectedModels`, `featureModelOverrides`, `AIFeatureId` type |
| `src/app/components/figma/AIConfigurationSettings.tsx` | E36 | Add ModelPicker, per-feature override UI |
| `src/ai/llm/factory.ts` | E36 | `getLLMClient(featureId?)` with 3-tier model resolution |
| `server/providers.ts` | E36 | Verify model override flows correctly |
| `src/db/schema.ts` | E37, E39, E40 | Add tutorSessions, tutorMisconceptions, flashcardDecks, flashcards, reviewSessions tables |
| `src/app/pages/LessonPlayer.tsx` | E37 | Add TutorPanel integration |
| `src/ai/rag/ragCoordinator.ts` | E37, E42 | Extended context retrieval for tutor + study buddy |
| `server/index.ts` | E38 | Add token counting middleware to chain |
| `src/app/pages/Overview.tsx` | E39 | "Due Today" flashcard widget |
| `src/app/routes.tsx` | E39, E40 | Add routes for FlashcardReview, FlashcardDecks, QuizPlayer |
| `src/lib/entitlement/isPremium.ts` | E41 | Extend for new feature IDs (tutor, flashcards, quiz) |
| `src/app/components/PremiumFeaturePage.tsx` | E41 | Add pre-configured entries for new features |
| `src/app/components/Layout.tsx` | E42 | Insert `<StudyBuddy />` overlay |
| `src/ai/knowledgeGaps/detectGaps.ts` | E43 | Unified gap scoring from tutor + quiz + study patterns |
| `src/ai/learningPath/suggestOrder.ts` | E43 | Comprehension-weighted reordering |

### Implementation Sequence

```
E36: Model Selection + Per-Feature Overrides (4 stories)
  ├── E36-S01: Model Registry + Provider Catalog        (no deps)
  ├── E36-S02: ModelPicker Component + Settings          (depends: S01)
  ├── E36-S03: Wire Model Selection Through Pipeline     (depends: S01)
  └── E36-S04: Per-Feature Model Overrides               (depends: S02, S03)

E37: AI Socratic Tutor (5 stories)                       (depends: E36)
  ├── E37-S01: Tutor Data Model + Dexie Storage          (no deps)
  ├── E37-S02: Socratic Prompts + LLM Integration        (depends: S01)
  ├── E37-S03: Tutor UI (Chat Panel in LessonPlayer)     (depends: S02)
  ├── E37-S04: Misconception Tracking + Adaptive Diff    (depends: S02)
  └── E37-S05: Integration with Knowledge Gaps           (depends: S04)

E38: Token Metering + Usage Dashboard (4 stories)        (parallel with E37)
  ├── E38-S01: Token Counting Middleware                  (no deps)
  ├── E38-S02: Usage Tracking Supabase Tables             (depends: S01)
  ├── E38-S03: Usage Dashboard UI                         (depends: S02)
  └── E38-S04: Budget Warnings + Graceful Degradation     (depends: S03)

E39: Smart Flashcard Generator (5 stories)               (depends: E36)
  ├── E39-S01: Flashcard Data Model + FSRS Algorithm      (no deps)
  ├── E39-S02: AI Flashcard Generation from Content       (depends: S01)
  ├── E39-S03: Flashcard Review UI                        (depends: S01)
  ├── E39-S04: Deck Management + Auto-Generation          (depends: S02, S03)
  └── E39-S05: Spaced Repetition Dashboard                (depends: S04)

E40: Adaptive Quiz Engine (4 stories)                    (depends: E36)
  ├── E40-S01: Quiz Data Model + Question Types           (no deps)
  ├── E40-S02: AI Quiz Generation + Difficulty Scaling    (depends: S01)
  ├── E40-S03: Quiz UI + Interactive Answering            (depends: S02)
  └── E40-S04: Quiz Results → Knowledge Gaps Feed         (depends: S03)

E41: Subscription Tier Enforcement (3 stories)           (depends: E36, E38)
  ├── E41-S01: Provider + Model Restrictions by Tier      (depends: E36-S04, E38-S02)
  ├── E41-S02: Feature Gating for New AI Features         (depends: E37, E39, E40 for features to gate)
  └── E41-S03: Upgrade Flow + BYOK Escape Hatch           (depends: S01, S02)

E42: AI Study Buddy (5 stories)                          (depends: E37, E39, E40)
  ├── E42-S01: Chat Overlay Shell + Context Engine        (no deps beyond Layout)
  ├── E42-S02: Conversational RAG (Unified Knowledge)     (depends: S01)
  ├── E42-S03: Intent Detection + Feature Routing         (depends: S02, E37, E39, E40)
  ├── E42-S04: Proactive Suggestions                      (depends: S03)
  └── E42-S05: Study Buddy Personality + Preferences      (depends: S04)

E43: Cross-Feature Intelligence Loop (3 stories)         (depends: E37, E39, E40)
  ├── E43-S01: Misconception → Flashcard Pipeline         (depends: E37-S04, E39-S02)
  ├── E43-S02: Quiz + Tutor → Knowledge Gap Aggregation   (depends: E37-S05, E40-S04)
  └── E43-S03: Intelligence-Driven Path Reordering        (depends: S02)
```

**Parallelization opportunities:**
- E37 (Tutor) and E38 (Metering) can run in parallel
- E39 (Flashcards) and E40 (Quizzes) can run in parallel after E36
- E41 (Tier Enforcement) must wait for E36 + E38
- E42 (Study Buddy) and E43 (Intelligence Loop) must wait for E37 + E39 + E40

### AI Deep Strategy Validation

**Coherence with Existing Architecture:**
- Extends `getLLMClient()` factory pattern (not a new abstraction — connects existing disconnected wire)
- Follows Dexie schema versioning pattern (v27+ → v28+ with checkpoint schema)
- Uses established middleware chain pattern from Entitlement Architecture addendum
- Reuses RAG coordinator, ChatQA UI patterns, PremiumFeaturePage gating, Layout overlay pattern
- Model registry complements (not replaces) existing `AI_PROVIDERS` in `aiConfiguration.ts`
- Token metering integrates into existing Express proxy middleware chain
- Study Buddy follows same overlay insertion pattern as SearchCommandPalette/OnboardingOverlay

**Requirements Coverage:**
- Gap 1 (model selection): Fully addressed by E36 — model registry + per-feature overrides
- Gap 2 (subscription billing): Addressed by E38 (metering) + E41 (tier enforcement)
- Gap 3 (deeper AI features): Addressed by E37 (tutor) + E39 (flashcards) + E40 (quizzes) + E42 (study buddy) + E43 (intelligence loop)
- BYOK philosophy preserved: BYOK users get unlimited usage, no model restrictions, per-feature overrides
- Free tier defined: Ollama + free API providers (Groq, Gemini, GLM) with economy models only

**Risk Mitigations:**
- FSRS complexity → pure TypeScript implementation, no external dependency; default parameters from Anki's trained values
- Token counting accuracy → primary (provider metadata) + fallback (tiktoken estimation); log both for comparison
- Intent detection latency → use economy model for classifier; cache recent classifications
- Intelligence loop data quality → weighted scoring prevents single-source domination; user confirmation on auto-generated flashcards
- Dexie schema growth → compound indexes for performance-critical queries; checkpoint schema for fresh installs
- Study Buddy context window → context engine sends structured summary (not raw history); capped at ~2000 tokens of context

## Knowledge Map Phase 1 Architecture

_Added 2026-03-28. This section defines the architecture for Knowledge Map Phase 1 (Roadmap Section 13): topic-level knowledge scoring with dashboard treemap visualization. The Knowledge Map answers "What do I actually know right now?" by computing per-topic scores from quiz, flashcard, completion, and recency data, then visualizing them as an interactive Recharts Treemap._

**Input Documents:**
- Brainstorming: `_bmad-output/brainstorming/brainstorming-session-2026-03-28-knowledge-map-phase1.md`
- Technical research: `_bmad-output/planning-artifacts/research/technical-knowledge-visualization-decay-modeling-research-2026-03-28.md`
- Roadmap: `docs/plans/2026-03-28-product-roadmap.md` (Section 13)
- Reference patterns: `src/lib/qualityScore.ts`, `src/lib/spacedRepetition.ts`, `src/lib/reportStats.ts`, `src/lib/dashboardOrder.ts`

### Knowledge Map Decision Summary

| Decision Area | Choice | Rationale |
|---|---|---|
| Topic granularity | `Lesson.keyTopics[]` with noise filter + canonical map | 40-60 meaningful topics after filtering; direct data mapping to lessons/quizzes/flashcards |
| Category grouping | `Course.category` as treemap parent nodes | 5 categories give visual structure without added complexity |
| Score formula | Dynamic weight redistribution (30/30/20/20 base) | Handles sparse data gracefully; every topic can reach 100 |
| Confidence metadata | `high` / `medium` / `low` based on signal count | Communicates data quality without misleading users |
| Decay model | Existing `predictRetention()` exponential curve | Production-ready, already tested; FSRS upgrade is Phase 2 |
| Visualization | Recharts Treemap (desktop) + sorted list (mobile) | Zero new dependencies; Recharts already installed with 12+ chart instances |
| Overview widget | Category-level treemap + Focus Areas panel | Lightweight summary; links to full page |
| Dedicated page | `/knowledge-map` with topic-level treemap + popovers | Full-screen real estate for drill-down |
| State management | Zustand store, computed on-demand (no Dexie table) | Scores change daily due to decay; caching stale scores is worse than recomputing |
| Action suggestions | Contextual based on available signals per topic | Flashcard review, quiz retake, or lesson rewatch depending on what exists |

### Decision 1: Topic Resolution Service

**File:** `src/lib/topicResolver.ts`

**Purpose:** Extract, normalize, filter, and group topics from course data into a canonical set suitable for scoring and visualization.

**Why a dedicated module:** Topic resolution is a pure data transformation that multiple consumers need (the score service, the store, and potentially future features like study suggestions). Isolating it as a pure function module makes it testable, composable, and independent of React/Zustand.

**Input:** `Course[]` (from `useCourseStore`)
**Output:** `ResolvedTopic[]`

```typescript
// src/lib/topicResolver.ts

export interface ResolvedTopic {
  name: string              // Display name (title-cased canonical form)
  canonicalName: string     // Normalized key for deduplication
  category: string          // Course.category (parent group)
  lessonIds: string[]       // All lessons teaching this topic
  courseIds: string[]        // All courses containing this topic
  questionTopics: string[]  // Matching Question.topic values (for quiz mapping)
}

/** Noise patterns to exclude from topic extraction */
const NOISE_PATTERNS = [
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}$/i,
  /^(week|session)\s+\d+$/i,
  /^weekly session$/i,
  /^course (overview|summary|introduction)$/i,
  /^(getting started|next steps|key takeaways|what to expect|q&a|wrap[- ]?up)$/i,
  /^\d{4}[-/]\d{2}[-/]\d{2}$/,  // ISO date patterns
]

/** Canonical synonym map — grows over time as new courses are added */
const CANONICAL_MAP: Record<string, string> = {
  'body language': 'body language',
  'nonverbal communication': 'body language',
  'nonverbal cues': 'body language',
  'micro expressions': 'micro-expressions',
  'microexpressions': 'micro-expressions',
  'lie detection': 'deception detection',
  'deception': 'deception detection',
  // Extend as course data reveals new synonyms
}
```

**Processing pipeline:**
1. Iterate all `Course.modules[].lessons[].keyTopics[]`
2. Normalize each topic: `toLowerCase().trim().replace(/[-_]/g, ' ').replace(/\s+/g, ' ')`
3. Filter noise: reject topics matching any `NOISE_PATTERNS` entry
4. Canonicalize: map through `CANONICAL_MAP` (passthrough if no synonym found)
5. Deduplicate: group by canonical name, merge `lessonIds[]` and `courseIds[]`
6. Associate category: inherit from parent `Course.category` (if topic spans multiple categories, use the category with more lessons)
7. Generate display name: title-case the canonical name

**Key design choices:**
- **Pure function, no side effects** — follows `qualityScore.ts` pattern
- **Deterministic canonical map over fuzzy matching** — debuggable, no false positives (e.g., "authority" vs. "authoring" would be incorrectly merged by Levenshtein)
- **Noise filter uses regex patterns** — extensible without code changes to the algorithm
- **~40-60 topics expected** after filtering (ideal for Recharts Treemap per research)

**Integration with quiz data:** `Question.topic` (optional string, added in E15-S05) maps to topics via canonicalization. If `Question.topic` is not set, inherit from the parent lesson's `keyTopics[0]`.

### Decision 2: Knowledge Score Calculation Service

**File:** `src/lib/knowledgeScore.ts`

**Purpose:** Calculate a 0-100 knowledge score per topic using dynamic weight redistribution across available signals.

**Pattern:** Follows `src/lib/qualityScore.ts` (158 lines) — WEIGHTS object, individual factor functions, composite calculation, tier classification.

```typescript
// src/lib/knowledgeScore.ts

export const BASE_WEIGHTS = {
  quiz: 0.30,
  flashcard: 0.30,
  completion: 0.20,
  recency: 0.20,
} as const

export type KnowledgeTier = 'strong' | 'fading' | 'weak'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface TopicScoreInput {
  avgQuizScore: number | null       // 0-100, null if no quiz data
  avgFlashcardRetention: number | null  // 0-100, null if no flashcard data
  completionPercent: number         // 0-100, always available
  daysSinceLastEngagement: number   // Always available (from timestamps)
}

export interface TopicScoreResult {
  score: number                     // 0-100 composite
  tier: KnowledgeTier               // strong >= 70, fading 40-69, weak < 40
  confidence: ConfidenceLevel       // high (3-4 signals), medium (2), low (1)
  factors: {
    quiz: number | null
    flashcard: number | null
    completion: number
    recency: number
  }
  signalsUsed: string[]
  effectiveWeights: Record<string, number>
}
```

**Dynamic weight redistribution algorithm:**

When a signal is unavailable (null), its base weight is redistributed proportionally to available signals. This ensures every topic can reach 100 regardless of data availability.

```typescript
export function calculateTopicScore(input: TopicScoreInput): TopicScoreResult {
  const signals: Array<{ key: string; value: number; baseWeight: number }> = []

  // Always available
  signals.push({ key: 'completion', value: input.completionPercent, baseWeight: BASE_WEIGHTS.completion })
  signals.push({ key: 'recency', value: calculateRecencyScore(input.daysSinceLastEngagement), baseWeight: BASE_WEIGHTS.recency })

  // Conditionally available
  if (input.avgQuizScore !== null) {
    signals.push({ key: 'quiz', value: input.avgQuizScore, baseWeight: BASE_WEIGHTS.quiz })
  }
  if (input.avgFlashcardRetention !== null) {
    signals.push({ key: 'flashcard', value: input.avgFlashcardRetention, baseWeight: BASE_WEIGHTS.flashcard })
  }

  // Redistribute: normalize weights to sum to 1.0
  const totalWeight = signals.reduce((sum, s) => sum + s.baseWeight, 0)
  const effectiveWeights: Record<string, number> = {}
  let score = 0

  for (const signal of signals) {
    const effective = signal.baseWeight / totalWeight
    effectiveWeights[signal.key] = effective
    score += signal.value * effective
  }

  score = Math.round(Math.min(100, Math.max(0, score)))

  return {
    score,
    tier: getKnowledgeTier(score),
    confidence: getConfidenceLevel(signals.length),
    factors: {
      quiz: input.avgQuizScore,
      flashcard: input.avgFlashcardRetention,
      completion: input.completionPercent,
      recency: calculateRecencyScore(input.daysSinceLastEngagement),
    },
    signalsUsed: signals.map(s => s.key),
    effectiveWeights,
  }
}
```

**Weight redistribution examples:**

| Available Signals | Effective Weights | Max Possible Score |
|---|---|---|
| All 4 (quiz + flashcard + completion + recency) | 30/30/20/20 | 100 |
| No flashcards (quiz + completion + recency) | 43/29/29 | 100 |
| No quizzes (flashcard + completion + recency) | 43/29/29 | 100 |
| Completion + recency only | 50/50 | 100 |

**Recency score function:**

```typescript
export function calculateRecencyScore(daysSinceEngagement: number): number {
  if (daysSinceEngagement <= 7) return 100     // Full score within 7 days
  if (daysSinceEngagement >= 90) return 10     // Floor at 10 (learner did engage at some point)
  // Linear decay from 100 to 10 over days 7-90
  return Math.round(100 - ((daysSinceEngagement - 7) / 83) * 90)
}
```

**Design choice: linear recency (not exponential):** The recency component is a weight in the composite, not the decay model itself. The exponential `predictRetention()` is used for flashcard retention signals. Using exponential for both would double-penalize old topics. Linear recency provides a gentler, more intuitive degradation.

**Tier classification:**

| Tier | Range | Label | Design Token |
|---|---|---|---|
| Strong | >= 70 | "Strong" | `--success` / `--chart-2` |
| Fading | 40-69 | "Fading" | `--warning` / `--chart-4` |
| Weak | < 40 | "Weak" | `--destructive` / `--chart-5` |

**Confidence classification:**

| Level | Condition | UI Indicator |
|---|---|---|
| High | 3-4 signals (quiz + flashcard available) | Solid fill |
| Medium | 2 signals (quiz or flashcard, not both) | Standard fill with subtle indicator |
| Low | Completion + recency only | Striped/dashed pattern or "?" icon |

### Decision 3: Knowledge Map Store

**File:** `src/stores/useKnowledgeMapStore.ts`

**Purpose:** Zustand store that computes and caches topic scores by aggregating data from multiple existing stores and Dexie tables.

**Why Zustand (not a Dexie table):** Knowledge scores change daily due to the recency decay component. Storing precomputed scores in Dexie would require daily recomputation jobs and introduce stale data risk. Computing on-demand from live data ensures scores are always current. The computation is cheap (~5ms for 60 topics against cached store data).

**Store interface:**

```typescript
// src/stores/useKnowledgeMapStore.ts

import { create } from 'zustand'
import type { ResolvedTopic } from '@/lib/topicResolver'
import type { TopicScoreResult } from '@/lib/knowledgeScore'

export interface ScoredTopic extends ResolvedTopic {
  scoreResult: TopicScoreResult
  urgency: number                    // 0-100, higher = more urgent to review
  lastEngagementDate: Date | null
  suggestedActions: SuggestedAction[]
}

export interface SuggestedAction {
  type: 'flashcard-review' | 'retake-quiz' | 'rewatch-lesson'
  label: string
  route: string
  priority: number                   // 1 = most urgent
}

export interface CategoryGroup {
  category: string
  label: string                      // Title-cased display label
  topics: ScoredTopic[]
  avgScore: number                   // Average of topic scores in this category
  topicCount: number
}

interface KnowledgeMapState {
  // Computed data
  topics: ScoredTopic[]
  categories: CategoryGroup[]
  focusAreas: ScoredTopic[]          // Top 3 most urgent topics
  isLoading: boolean
  lastComputedAt: Date | null

  // Actions
  computeScores: () => Promise<void>
  getTopicsByCategory: (category: string) => ScoredTopic[]
  getTopicByName: (canonicalName: string) => ScoredTopic | undefined
}
```

**Data aggregation sources:**

| Data Source | Store/Table | What It Provides |
|---|---|---|
| Course structure + `keyTopics` | `useCourseStore` | Topic extraction input, lesson metadata |
| Lesson completion | `useContentProgressStore` | `status` per lesson (for completion %) |
| Flashcard retention | `useFlashcardStore` | `interval`, `easeFactor`, `reviewedAt` per card |
| Quiz scores | `db.quizAttempts` (Dexie) | `percentage` per attempt, `answers[].isCorrect` |
| Study sessions | `db.studySessions` (Dexie) | Timestamps for recency calculation |

**Computation flow:**

```
computeScores()
  │
  ├─ 1. resolveTopics(courses)              // topicResolver.ts
  │     → ResolvedTopic[] (~40-60 topics)
  │
  ├─ 2. For each topic, aggregate signals:
  │     ├─ completionPercent: count completed lessons / total lessons for topic
  │     ├─ avgQuizScore: average percentage across quizAttempts matching topic's questions
  │     ├─ avgFlashcardRetention: average predictRetention() across flashcards in topic's courses
  │     └─ daysSinceLastEngagement: most recent timestamp across all signals
  │
  ├─ 3. calculateTopicScore(input)           // knowledgeScore.ts
  │     → TopicScoreResult per topic
  │
  ├─ 4. computeUrgency(score, daysSince)     // Urgency ranking
  │     → urgency = (100 - score) * 0.6 + min(100, daysSince * 2) * 0.4
  │
  ├─ 5. suggestActions(topic)                // Contextual action suggestions
  │     → SuggestedAction[] sorted by priority
  │
  ├─ 6. Group by category                    // CategoryGroup[] for treemap hierarchy
  │
  └─ 7. Select top 3 by urgency              // focusAreas for widget panel
```

**Recalculation triggers:**
- On mount (initial page load or navigation to Knowledge Map)
- On store dependency changes (content progress updated, flashcard reviewed, quiz completed)
- No periodic timer — recalculation is fast enough to run on every relevant navigation

**Flashcard-to-topic mapping:** Flashcards have `courseId` but no direct topic tag. Mapping strategy: flashcard.courseId -> course.modules[].lessons[].keyTopics[] -> spread flashcard retention across all topics in that course. This is an approximation but acceptable for Phase 1. Phase 2 could add a `topicTag` field to `Flashcard`.

**Quiz-to-topic mapping:** `Question.topic` (optional) provides direct mapping when available. Fallback: quiz belongs to a course -> spread quiz scores across all topics in that course's lessons, weighted by lesson count.

### Decision 4: UI Architecture

#### Component Hierarchy

```
Overview.tsx
  └─ KnowledgeMapWidget.tsx              (DashboardSectionId = 'knowledge-map')
       ├─ TopicTreemap.tsx               (category-level, 5 cells)
       └─ FocusAreasPanel.tsx            (top 3 urgent topics)

/knowledge-map route
  └─ KnowledgeMap.tsx                    (page component)
       ├─ TopicTreemap.tsx               (topic-level, 40-60 cells, grouped by category)
       ├─ TopicDetailPopover.tsx          (score breakdown + action buttons)
       └─ FocusAreasPanel.tsx            (top 3 urgent, reused)
```

#### New Files

| File | Purpose | Estimated Size |
|---|---|---|
| `src/lib/topicResolver.ts` | Topic extraction, noise filter, canonical map | ~120 lines |
| `src/lib/knowledgeScore.ts` | Score calculation, tiers, confidence | ~130 lines |
| `src/stores/useKnowledgeMapStore.ts` | Zustand store with cross-store aggregation | ~200 lines |
| `src/app/components/knowledge/TopicTreemap.tsx` | Recharts Treemap wrapper with custom cell renderer | ~150 lines |
| `src/app/components/knowledge/TopicDetailPopover.tsx` | Score breakdown popover with action buttons | ~120 lines |
| `src/app/components/knowledge/FocusAreasPanel.tsx` | Top 3 urgent topics with action suggestions | ~100 lines |
| `src/app/components/knowledge/KnowledgeMapWidget.tsx` | Overview dashboard section | ~80 lines |
| `src/app/pages/KnowledgeMap.tsx` | Dedicated page with topic treemap | ~150 lines |

#### Dashboard Section Registration

Add to `src/lib/dashboardOrder.ts`:

```typescript
// Add to DashboardSectionId type:
| 'knowledge-map'

// Add to SECTION_LABELS:
'knowledge-map': 'Knowledge Map',

// Add to DEFAULT_ORDER (after 'skill-proficiency'):
'skill-proficiency',
'knowledge-map',    // NEW — placed after skill proficiency (related: knowledge depth)
'insight-action',
```

**Why after `skill-proficiency`:** The Knowledge Map is a deeper view of the same concept the Skill Proficiency Radar covers at category level. Placing them adjacent creates a natural drill-down flow: radar (category overview) -> treemap (topic detail).

#### Route Registration

Add to `src/app/routes.tsx`:

```typescript
{
  path: 'knowledge-map',
  lazy: () => import('./pages/KnowledgeMap'),
}
```

Add sidebar nav entry in `Layout.tsx` (after Reports or Settings, depending on navigation density assessment).

#### TopicTreemap Component

**Recharts Treemap configuration:**

```typescript
// src/app/components/knowledge/TopicTreemap.tsx

interface TreemapData {
  name: string
  children: Array<{
    name: string            // Category label
    children: Array<{
      name: string          // Topic display name
      size: number          // Lesson count (determines cell area)
      score: number         // 0-100 (determines cell color)
      tier: KnowledgeTier
      confidence: ConfidenceLevel
    }>
  }>
}

// Custom cell renderer for color-coded cells
function KnowledgeMapCell({ x, y, width, height, name, score, tier }: CustomCellProps) {
  const fill = getTierColor(tier)
  // Only render label if cell is large enough (width > 60, height > 30)
  const showLabel = width > 60 && height > 30
  const showScore = width > 40 && height > 20

  return (
    <g>
      <rect x={x} y={y} width={width} height={height}
        fill={fill} stroke="var(--border)" strokeWidth={1}
        rx={4} className="cursor-pointer hover:opacity-90 transition-opacity" />
      {showLabel && <text ...>{name}</text>}
      {showScore && <text ...>{score}%</text>}
    </g>
  )
}
```

**Color mapping using design tokens:**

```typescript
function getTierColor(tier: KnowledgeTier): string {
  switch (tier) {
    case 'strong': return 'var(--success)'
    case 'fading': return 'var(--warning)'
    case 'weak': return 'var(--destructive)'
  }
}
```

**Mobile fallback (< 640px):** Replace treemap with a sorted topic list using existing shadcn/ui components (`Card`, `Progress`, `Badge`, `Accordion`). Topics grouped by category via `Accordion`, sorted worst-first within each group. This provides full accessibility and touch-friendly interaction on small screens.

#### TopicDetailPopover

Click any treemap cell (or list item on mobile) to open a `Popover` (shadcn/ui) showing:

1. **Topic name** + tier badge
2. **Score breakdown**: quiz %, flashcard retention %, completion %, recency score — each with effective weight shown
3. **Confidence level** indicator
4. **Last engagement date** ("45 days ago")
5. **Suggested actions**: 1-3 contextual buttons (Review Flashcards, Retake Quiz, Rewatch Lesson)

**Action routing:**
- Flashcard review: navigates to flashcard review filtered by course
- Quiz retake: navigates to quiz for the course containing this topic
- Lesson rewatch: navigates to the first incomplete lesson in this topic

#### FocusAreasPanel

Standalone panel showing top 3 most urgent topics. Used in both the Overview widget and the dedicated page.

**Urgency ranking formula:**

```typescript
function computeUrgency(score: number, daysSinceEngagement: number): number {
  const scoreUrgency = 100 - score                             // 0-100, higher = more urgent
  const recencyUrgency = Math.min(100, daysSinceEngagement * 2) // Caps at 50 days -> 100
  return scoreUrgency * 0.6 + recencyUrgency * 0.4
}
```

Each focus area item displays: topic name, score + tier badge, days since engagement, and 1-2 action buttons.

### Decision 5: Data Flow Architecture

**End-to-end data flow from Dexie tables to rendered visualization:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Data Sources (Dexie + Zustand)                                  │
│                                                                 │
│  useCourseStore ──── Course[].modules[].lessons[].keyTopics[]  │
│  useContentProgressStore ── ContentProgress[].status            │
│  useFlashcardStore ──────── Flashcard[].interval/reviewedAt    │
│  db.quizAttempts ─────────── QuizAttempt[].percentage/answers  │
│  db.studySessions ────────── StudySession[].startTime          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ topicResolver.ts                                                │
│                                                                 │
│  resolveTopics(courses) → ResolvedTopic[]                      │
│    1. Extract keyTopics from all lessons                        │
│    2. Normalize (lowercase, trim, collapse spaces)              │
│    3. Filter noise (dates, "weekly session", meta-topics)       │
│    4. Canonicalize (synonym map)                                │
│    5. Deduplicate + merge lesson/course IDs                     │
│    6. Group by Course.category                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ knowledgeScore.ts                                               │
│                                                                 │
│  For each ResolvedTopic:                                        │
│    1. Aggregate completion % from contentProgress               │
│    2. Aggregate quiz scores from quizAttempts (via Question.topic│
│       or course-level fallback)                                 │
│    3. Aggregate flashcard retention via predictRetention()       │
│    4. Calculate daysSinceLastEngagement from most recent signal  │
│    5. calculateTopicScore() → TopicScoreResult                  │
│       (dynamic weight redistribution, tier, confidence)         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ useKnowledgeMapStore.ts                                         │
│                                                                 │
│  computeScores() orchestrates the full pipeline:                │
│    1. resolveTopics() → topics                                  │
│    2. For each topic: aggregate signals → calculateTopicScore() │
│    3. computeUrgency() → rank topics                            │
│    4. suggestActions() → contextual actions per topic            │
│    5. Group by category → CategoryGroup[]                       │
│    6. Select top 3 → focusAreas                                 │
│                                                                 │
│  Exposes: topics, categories, focusAreas, isLoading             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ KnowledgeMapWidget.tsx   │  │ KnowledgeMap.tsx (page)   │
│ (Overview section)       │  │ (/knowledge-map route)    │
│                          │  │                          │
│ TopicTreemap (category)  │  │ TopicTreemap (topic)     │
│ FocusAreasPanel (top 3)  │  │ TopicDetailPopover       │
│ "See full map" link      │  │ FocusAreasPanel (top 3)  │
│                          │  │ Mobile list fallback     │
└──────────────────────────┘  └──────────────────────────┘
```

**Performance considerations:**
- Topic resolution: one-time on mount, ~1ms for 8 courses / 170 lessons
- Score computation: ~5ms for 60 topics (Dexie reads are cached in Zustand stores)
- Recharts Treemap rendering: ~50 SVG rects, well within Recharts' performance ceiling
- No waterfalls: all data sources are queried in parallel via `Promise.all()`

**Accessibility:**
- Treemap cells include text labels (topic name + score) — not color-only
- Custom cell has `role="button"` and keyboard focus support
- Mobile list fallback is fully accessible: `Progress` + `Badge` components with ARIA labels
- Screen reader: "Topic: Body Language, knowledge score: 78 percent, status: Strong"
- Focus Areas panel uses semantic `<ol>` with descriptive text

### Knowledge Map Implementation Sequence

**4 stories, sequential with clear boundaries:**

```
E??-S01: Topic Resolution Service                    (no deps)
  ├── src/lib/topicResolver.ts (noise filter, canonical map, normalization)
  ├── Unit tests for topic extraction pipeline
  └── Validates ~40-60 meaningful topics from current course data

E??-S02: Knowledge Score Calculation                  (depends: S01)
  ├── src/lib/knowledgeScore.ts (dynamic weights, tiers, confidence)
  ├── src/stores/useKnowledgeMapStore.ts (cross-store aggregation)
  ├── Unit tests for score calculation + weight redistribution
  └── Integration test: store computes scores from seeded Dexie data

E??-S03: Overview Widget — Category Treemap           (depends: S02)
  ├── src/app/components/knowledge/KnowledgeMapWidget.tsx
  ├── src/app/components/knowledge/TopicTreemap.tsx (shared, category-level)
  ├── src/app/components/knowledge/FocusAreasPanel.tsx
  ├── Register 'knowledge-map' in DashboardSectionId + DEFAULT_ORDER
  └── E2E test: widget renders on Overview with correct sections

E??-S04: Knowledge Map Page — Topic Treemap           (depends: S03)
  ├── src/app/pages/KnowledgeMap.tsx
  ├── src/app/components/knowledge/TopicDetailPopover.tsx
  ├── Route registration in routes.tsx, sidebar nav entry in Layout.tsx
  ├── Mobile responsive: sorted list fallback below 640px
  └── E2E test: page renders, popover shows score breakdown, actions navigate
```

**Parallelization:** S01 and S02 could theoretically be a single story, but separating them isolates the pure data transformation (S01) from the cross-store aggregation (S02), making each more focused and testable.

### Knowledge Map Validation

**Coherence with Existing Architecture:**
- Follows pure function pattern from `qualityScore.ts` (WEIGHTS object, individual factor functions, composite calculation)
- Reuses `predictRetention()` from `spacedRepetition.ts` for flashcard retention signals
- Extends `DashboardSectionId` type and `DEFAULT_ORDER` array from `dashboardOrder.ts`
- Uses existing Recharts library (12+ chart instances across the app, zero new dependencies)
- Zustand store follows established patterns from `useFlashcardStore`, `useContentProgressStore`
- Design tokens (`--success`, `--warning`, `--destructive`) for tier colors match existing conventions
- Component naming follows project convention: `src/app/components/knowledge/` directory

## AI Tutoring Phase 1-2 Architecture (Lesson-Aware Chat + Socratic Mode)

_Added 2026-03-28. This section defines the implementation-ready architecture for AI Tutoring Phase 1 (lesson-aware chat) and Phase 2 (Socratic mode), corresponding to Roadmap Section 14. Phase 1 delivers lesson-context-aware tutoring with zero new AI infrastructure (position-based transcript injection from existing data). Phase 2 adds Socratic questioning with a TypeScript hint ladder and client-side frustration detection. This addendum refines the high-level Tutor architecture from the AI Deep Strategy section (Decision 3) into concrete file structures, type definitions, and implementation sequences._

**Input Documents:**
- Brainstorming: `_bmad-output/brainstorming/brainstorming-session-2026-03-28-ai-tutoring-phase1-2.md`
- Technical research: `_bmad-output/planning-artifacts/research/technical-socratic-tutoring-llm-research-2026-03-28.md`
- Roadmap: `docs/plans/2026-03-28-product-roadmap.md` (Section 14)
- Reference patterns: `src/ai/hooks/useChatQA.ts`, `src/ai/rag/promptBuilder.ts`, `src/ai/rag/ragCoordinator.ts`, `src/ai/llm/factory.ts`, `src/app/pages/LessonPlayer.tsx`, `src/db/schema.ts`

**Relationship to AI Deep Strategy (Decision 3):**
The AI Deep Strategy addendum defined the Tutor module at the strategic level: `src/ai/tutor/` with prompts, sessionManager, adaptiveEngine, and Dexie tables (`tutorSessions`, `tutorMisconceptions`). This addendum supersedes that design for Phase 1-2 scope with several refinements:
- **Simpler persistence:** Single `chatConversations` table (Dexie v29) with blob messages instead of separate `tutorSessions` + `tutorMisconceptions` tables. Misconception tracking deferred to Phase 3+.
- **Adaptive difficulty deferred:** The 3-level adaptive engine (Guided/Challenging/Expert) is replaced by a 2-mode system (Socratic/Explain) with a 5-level hint ladder. Full adaptive difficulty is Phase 6.
- **UI placement refined:** Tutor tab in LessonPlayer's existing Tabs component (not a collapsible ResizablePanel). Simpler, zero responsive work.
- **File location refined:** `src/ai/tutor/` directory (same as strategic plan), but different internal structure optimized for Phase 1-2 scope.

### AI Tutoring Phase 1-2 Decision Summary

| Decision Area | Choice | Rationale |
|---|---|---|
| UI placement | 6th tab ("Tutor") in LessonPlayer's existing Tabs | Reuses chat components, has lesson context via route params, zero responsive work (tabs already collapse on mobile) |
| Prompt architecture | 6-slot system prompt with priority ordering | Graceful degradation under 4K Ollama pressure: optional slots auto-omitted |
| Hint ladder | TypeScript state machine (Levels 0-4) in `hintLadder.ts` | Saves ~100 tokens vs prompt-encoded ladder; more reliable than LLM self-managing escalation |
| Frustration detection | Client-side heuristics (message length, keywords, patterns) | Zero token cost; works identically across all models |
| Transcript context (Phase 1) | Position-based injection: full/chapter/window strategies | Zero new infrastructure; no embedding pipeline needed |
| Transcript context (Phase 2) | Lazy embedding on first tutor interaction + RAG retrieval | Progressive enhancement; embedding only when tutor is actually used |
| Conversation persistence | Dexie v29, `chatConversations` table, blob messages, 3-exchange sliding window | KISS; 2-5 KB per conversation; resume via message history display |
| Modes | 2 modes only: Socratic (default) + Explain | Testing 5 modes across multiple LLM providers is not "Small" scope |
| Degradation | 3 tiers: Full / Limited / Offline | Reuses ChatQA banner patterns; consistent UX |
| Premium gating | Same as ChatQA (premium or BYOK required) | No premature monetization complexity; same middleware chain |

### Decision 1: Tutor Chat UI

**Problem:** Users need AI tutoring while watching lessons, with full lesson context awareness. The tutor must live inside the LessonPlayer to access `courseId`, `lessonId`, video playback position, and transcript data.

**Decision:** Add a "Tutor" tab as the 6th tab in LessonPlayer's existing `<Tabs>` component, reusing chat components from `src/app/components/chat/`.

**Current LessonPlayer tabs (5):** Materials, Notes, Bookmarks, Transcript, Summary
**New tab:** Tutor (6th, conditionally rendered like Summary — requires AI provider configured)

**Component structure:**

```
src/app/components/tutor/
  ├── TutorChat.tsx           Orchestrator: wraps MessageList + ChatInput + mode selector + badges
  ├── TutorModeChips.tsx      Socratic/Explain mode selector (Phase 2)
  └── TranscriptBadge.tsx     "Transcript-grounded" (green) or "General mode" (yellow) indicator
```

**TutorChat.tsx orchestrator:**

```typescript
// src/app/components/tutor/TutorChat.tsx

interface TutorChatProps {
  courseId: string
  lessonId: string           // videoId for YouTube courses
  videoPosition?: number     // Current playback position in seconds (from video player ref)
}

export function TutorChat({ courseId, lessonId, videoPosition }: TutorChatProps) {
  const { messages, isGenerating, sendMessage, error, mode, setMode, transcriptStatus } =
    useTutor({ courseId, lessonId, videoPosition })

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex items-center gap-2 mb-3">
        <TranscriptBadge status={transcriptStatus} />
        <TutorModeChips mode={mode} onModeChange={setMode} />  {/* Phase 2 */}
      </div>
      <MessageList messages={messages} className="flex-1 overflow-y-auto" />
      <ChatInput
        onSend={sendMessage}
        disabled={isGenerating || transcriptStatus === 'offline'}
        placeholder={getPlaceholder(mode, transcriptStatus)}
      />
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  )
}
```

**Reused components from `src/app/components/chat/`:**
- `MessageList` — renders conversation bubbles (user + assistant)
- `ChatInput` — text input with send button
- `CitationLink` — renders `[timestamp]` links that seek video to that position
- `MessageBubble` — individual message rendering
- `EmptyState` — shown when no messages yet (customized prompt: "Ask about this lesson...")

**LessonPlayer.tsx modification:**

```typescript
// Add to imports
import { TutorChat } from '../components/tutor/TutorChat'

// Add to TabsList (after Summary tab, conditionally on AI provider configured)
{aiConfigured && <TabsTrigger value="tutor">Tutor</TabsTrigger>}

// Add TabsContent
{aiConfigured && (
  <TabsContent value="tutor" className="mt-4">
    <div className="bg-card rounded-2xl shadow-sm p-5">
      <TutorChat
        courseId={courseId}
        lessonId={currentVideoId}
        videoPosition={videoRef.current?.currentTime}
      />
    </div>
  </TabsContent>
)}
```

**Video position propagation:** The `videoPosition` prop is passed from `LessonPlayer`'s video element ref. It does not need real-time streaming — the position is sampled when the user sends a message (not on every frame). The `useTutor` hook reads `videoPosition` at message-send time to determine transcript context.

**Mobile behavior:** LessonPlayer's `<TabsList>` already handles overflow with horizontal scrolling on mobile. Adding a 6th tab requires no responsive changes.

**CitationLink enhancement for timestamps:** Existing `CitationLink` navigates to note sources. For the tutor, citations reference transcript timestamps. The component accepts an `onClick` handler — for tutor mode, this handler calls `videoRef.current.seekTo(timestamp)` to jump to the relevant video position.

### Decision 2: Tutor Prompt Architecture

**File:** `src/ai/tutor/tutorPromptBuilder.ts`

**Problem:** The system prompt must work within Ollama's 4K default context window while providing rich lesson context on larger models. The existing `promptBuilder.ts` is note-focused and not extensible for tutoring slots.

**Decision:** New dedicated prompt builder with 6 slots filled in priority order. Under token pressure, optional slots are omitted automatically from lowest to highest priority.

**Slot architecture (priority order, highest first):**

| Slot | Priority | Tokens (4K) | Tokens (128K) | Content |
|---|---|---|---|---|
| `BASE_INSTRUCTIONS` | 1 (required) | 150 | 300 | Tutor identity, rules, citation format |
| `MODE_RULES` | 2 (required) | 100 | 150 | Socratic or Explain behavior rules |
| `COURSE_CONTEXT` | 3 (required) | 40 | 80 | Course title, lesson title, lesson position (e.g., "5 of 12") |
| `TRANSCRIPT_EXCERPT` | 4 (high) | 1,200 | 4,000 | Position-based transcript injection |
| `LEARNER_PROFILE` | 5 (optional) | 40 | 100 | Progress %, lesson position, streak count |
| `RESUME_CONTEXT` | 6 (optional) | 100 | 200 | Last exchange from prior conversation |

**Token budget allocation (4K Ollama):**

| Component | Tokens |
|---|---|
| System prompt (slots 1-4) | 1,490 |
| Learner profile (slot 5) | 40 |
| Conversation history (sliding window) | 650 |
| User message | 200 |
| Reserved for generation | **1,620** |
| **Total** | **4,000** |

**Token budget allocation (128K model):**

| Component | Tokens |
|---|---|
| System prompt (slots 1-6) | 4,830 |
| Conversation history (last 5 exchanges) | 2,000 |
| User message | 300 |
| Reserved for generation | **2,000** |
| **Total** | **~9,130** (conservative, well within 128K) |

**Implementation:**

```typescript
// src/ai/tutor/tutorPromptBuilder.ts

import type { TutorMode, TutorContext } from './types'

interface PromptSlot {
  priority: number      // 1 = highest, never dropped
  key: string
  content: string
  estimatedTokens: number
  required: boolean     // If true, never omitted
}

interface TutorPromptOptions {
  mode: TutorMode
  courseTitle: string
  lessonTitle: string
  lessonPosition: string        // e.g., "5 of 12"
  transcriptExcerpt?: string
  learnerProfile?: string
  resumeContext?: string
  hintLevel: number
  maxSystemTokens: number       // Budget for system prompt portion
}

export function buildTutorSystemPrompt(options: TutorPromptOptions): string {
  const slots: PromptSlot[] = [
    {
      priority: 1,
      key: 'base',
      content: BASE_INSTRUCTIONS,
      estimatedTokens: estimateTokens(BASE_INSTRUCTIONS),
      required: true,
    },
    {
      priority: 2,
      key: 'mode',
      content: getModeRules(options.mode, options.hintLevel),
      estimatedTokens: 100,
      required: true,
    },
    {
      priority: 3,
      key: 'course',
      content: `CURRENT CONTEXT:\nCourse: ${options.courseTitle}\nLesson: ${options.lessonTitle} (${options.lessonPosition})`,
      estimatedTokens: 40,
      required: true,
    },
    ...(options.transcriptExcerpt ? [{
      priority: 4,
      key: 'transcript',
      content: `LESSON MATERIAL:\n${options.transcriptExcerpt}`,
      estimatedTokens: estimateTokens(options.transcriptExcerpt),
      required: false,
    }] : []),
    ...(options.learnerProfile ? [{
      priority: 5,
      key: 'profile',
      content: `LEARNER PROFILE:\n${options.learnerProfile}`,
      estimatedTokens: 40,
      required: false,
    }] : []),
    ...(options.resumeContext ? [{
      priority: 6,
      key: 'resume',
      content: `PREVIOUS CONVERSATION:\n${options.resumeContext}`,
      estimatedTokens: estimateTokens(options.resumeContext),
      required: false,
    }] : []),
  ]

  // Fill slots in priority order, respecting budget
  let remainingBudget = options.maxSystemTokens
  const includedSlots: PromptSlot[] = []

  for (const slot of slots.sort((a, b) => a.priority - b.priority)) {
    if (slot.estimatedTokens <= remainingBudget || slot.required) {
      includedSlots.push(slot)
      remainingBudget -= slot.estimatedTokens
    }
  }

  return includedSlots.map(s => s.content).join('\n\n')
}

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token (English text)
  return Math.ceil(text.length / 4)
}
```

**Base instructions template:**

```
You are a learning tutor for the course and lesson described below. Your role is
to help the student understand the material deeply.

RULES:
1. Base your responses ONLY on the provided lesson material
2. When referencing specific content, cite timestamps in [MM:SS] format
3. Be encouraging — confusion is a normal part of learning
4. Match vocabulary complexity to the student's demonstrated level
5. Keep responses concise (2-4 sentences) unless asked to elaborate
```

**Mode-specific rules:**

```typescript
const MODE_RULES: Record<TutorMode, string> = {
  socratic: `MODE: Socratic Questioning
- Ask ONE guiding question at a time — never give the answer directly
- If the student answers correctly, probe deeper with "why" or "what if" follow-ups
- {hintLevelInstruction}
- If the student explicitly asks "just tell me", switch to Explain mode for this answer`,

  explain: `MODE: Direct Explanation
- Provide clear, structured explanations
- Use examples from the lesson material when possible
- After explaining, ask a brief check-for-understanding question`,
}
```

**Why a new prompt builder (not extending `promptBuilder.ts`):** The existing `PromptBuilder` class is tightly coupled to note-based RAG context (`RetrievedContext.notes[]`). The tutor needs transcript context, mode rules, hint levels, and learner profiles — a fundamentally different prompt structure. A dedicated builder avoids polluting the ChatQA prompt path with tutor-specific logic.

### Decision 3: Hint Ladder State Machine

**File:** `src/ai/tutor/hintLadder.ts`

**Problem:** Socratic tutoring that never gives answers frustrates students. Research shows 3-4 failed hints should trigger escalation to direct explanation. Encoding the full ladder in the system prompt wastes ~100 tokens. LLMs are unreliable at self-managing escalation state.

**Decision:** TypeScript state machine tracks hint level (0-4). Only one instruction line injected per turn. Client-side frustration heuristics auto-escalate the level.

**Hint levels:**

| Level | Instruction Injected into System Prompt | Behavior |
|---|---|---|
| 0 | "Ask an open-ended guiding question about the concept." | Pure Socratic — no hints |
| 1 | "Ask about a specific part of the lesson material related to the student's question." | Narrowing question |
| 2 | "Give a strong hint referencing a specific concept from the lesson." | Scaffolded hint |
| 3 | "Provide a near-complete explanation with one gap for the student to fill." | Near-answer |
| 4 | "Explain directly and clearly. The student needs a direct answer." | Full explanation fallback |

**State machine implementation:**

```typescript
// src/ai/tutor/hintLadder.ts

export interface HintLadderState {
  level: number             // 0-4
  consecutiveStuck: number  // Exchanges at same level without progress
  escalationHistory: number[] // Record of level changes for analytics
}

export function createHintLadder(): HintLadderState {
  return { level: 0, consecutiveStuck: 0, escalationHistory: [0] }
}

export function processUserMessage(
  state: HintLadderState,
  message: string
): HintLadderState {
  const frustration = detectFrustration(message)

  if (frustration === 'explicit') {
    // User explicitly asked for help — jump to level 4
    return {
      ...state,
      level: Math.min(4, state.level + 2),
      consecutiveStuck: 0,
      escalationHistory: [...state.escalationHistory, Math.min(4, state.level + 2)],
    }
  }

  if (frustration === 'implicit') {
    // Implicit frustration signal — escalate by 1
    return {
      ...state,
      level: Math.min(4, state.level + 1),
      consecutiveStuck: 0,
      escalationHistory: [...state.escalationHistory, Math.min(4, state.level + 1)],
    }
  }

  // No frustration — increment stuck counter
  const newStuck = state.consecutiveStuck + 1
  if (newStuck >= 2) {
    // 2 exchanges without progress at this level — auto-escalate
    return {
      ...state,
      level: Math.min(4, state.level + 1),
      consecutiveStuck: 0,
      escalationHistory: [...state.escalationHistory, Math.min(4, state.level + 1)],
    }
  }

  return { ...state, consecutiveStuck: newStuck }
}

export function resetHintLadder(state: HintLadderState): HintLadderState {
  // Reset when user asks a new topic (detected by topic change)
  return { level: 0, consecutiveStuck: 0, escalationHistory: [...state.escalationHistory, 0] }
}

export function getHintInstruction(level: number): string {
  return HINT_INSTRUCTIONS[Math.min(4, Math.max(0, level))]
}
```

**Client-side frustration detection:**

```typescript
// src/ai/tutor/hintLadder.ts (continued)

type FrustrationSignal = 'explicit' | 'implicit' | 'none'

const EXPLICIT_PATTERNS = [
  /just tell me/i,
  /give me the answer/i,
  /i give up/i,
  /stop asking/i,
  /explain it/i,
]

const IMPLICIT_KEYWORDS = [
  "i don't know",
  "i don't understand",
  "i'm confused",
  "i'm lost",
  "help",
  "idk",
  "no idea",
  "what?",
  "huh?",
]

export function detectFrustration(message: string): FrustrationSignal {
  const trimmed = message.trim()

  // Explicit: user directly asks for answer
  if (EXPLICIT_PATTERNS.some(p => p.test(trimmed))) return 'explicit'

  // Implicit signals
  const isShort = trimmed.length < 15
  const hasImplicitKeyword = IMPLICIT_KEYWORDS.some(kw =>
    trimmed.toLowerCase().includes(kw)
  )

  if (hasImplicitKeyword) return 'implicit'
  if (isShort && !trimmed.includes('?')) return 'implicit' // Short non-question after Socratic prompt

  return 'none'
}
```

**Why client-side (not LLM-based) frustration detection:**
- Zero token cost — frustration analysis happens in TypeScript, not in the prompt
- Deterministic behavior — same input always produces same escalation, regardless of LLM model
- Works identically on Ollama 3B and GPT-4o — critical for consistent UX across providers
- No latency — instant detection before the LLM call

### Decision 4: Transcript Context Injection

**File:** `src/ai/tutor/transcriptContext.ts`

**Problem:** The tutor needs lesson-specific context to provide grounded answers. The existing RAG pipeline embeds notes, not transcripts. Phase 1 must work without any new embedding infrastructure.

**Decision:** Phase 1 uses position-based transcript injection (zero new infrastructure). Phase 2 adds lazy embedding with RAG retrieval.

**Phase 1: Position-based injection (3 strategies):**

```typescript
// src/ai/tutor/transcriptContext.ts

import type { YouTubeTranscriptRecord, YouTubeCourseChapter, TranscriptCue } from '@/data/types'

export type TranscriptStatus = 'full' | 'limited' | 'offline'

interface TranscriptContextResult {
  excerpt: string           // The transcript text to inject
  status: TranscriptStatus  // For UI badge
  strategy: 'full' | 'chapter' | 'window' | 'none'
  tokenEstimate: number
}

/**
 * Extract relevant transcript context based on lesson data and video position.
 *
 * Strategy selection:
 * 1. Short lessons (<2K tokens): inject full transcript
 * 2. Lessons with chapters: inject current chapter
 * 3. Long lessons without chapters: inject 512-token window around position
 * 4. No transcript: return empty with 'limited' status
 */
export function getTranscriptContext(
  transcript: YouTubeTranscriptRecord | null,
  chapters: YouTubeCourseChapter[],
  videoPositionSeconds: number,
  maxTokens: number = 1200
): TranscriptContextResult {
  if (!transcript || transcript.status !== 'done' || !transcript.fullText) {
    return { excerpt: '', status: 'limited', strategy: 'none', tokenEstimate: 0 }
  }

  const fullTextTokens = estimateTokens(transcript.fullText)

  // Strategy 1: Short lessons — inject full transcript
  if (fullTextTokens <= maxTokens) {
    return {
      excerpt: transcript.fullText,
      status: 'full',
      strategy: 'full',
      tokenEstimate: fullTextTokens,
    }
  }

  // Strategy 2: Lessons with chapters — inject current chapter
  if (chapters.length > 0) {
    const currentChapter = findCurrentChapter(chapters, videoPositionSeconds)
    if (currentChapter) {
      const chapterText = extractChapterText(transcript.cues, currentChapter)
      const chapterTokens = estimateTokens(chapterText)
      if (chapterTokens <= maxTokens) {
        return {
          excerpt: formatChapterContext(chapterText, currentChapter.title),
          status: 'full',
          strategy: 'chapter',
          tokenEstimate: chapterTokens,
        }
      }
      // Chapter too long — fall through to window strategy
    }
  }

  // Strategy 3: Window around current position
  const windowText = extractWindowAroundPosition(
    transcript.cues,
    videoPositionSeconds,
    maxTokens
  )
  return {
    excerpt: windowText,
    status: 'full',
    strategy: 'window',
    tokenEstimate: estimateTokens(windowText),
  }
}

/**
 * Find the chapter containing the current video position.
 */
function findCurrentChapter(
  chapters: YouTubeCourseChapter[],
  positionSeconds: number
): YouTubeCourseChapter | null {
  // Chapters are sorted by startTime
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (chapters[i].startTime <= positionSeconds) {
      return chapters[i]
    }
  }
  return chapters[0] ?? null
}

/**
 * Extract transcript cues that fall within a chapter's time range.
 */
function extractChapterText(
  cues: TranscriptCue[],
  chapter: YouTubeCourseChapter
): string {
  const endTime = chapter.endTime ?? Infinity
  return cues
    .filter(c => c.startTime >= chapter.startTime && c.startTime < endTime)
    .map(c => c.text)
    .join(' ')
}

/**
 * Extract a token-limited window of transcript text around the video position.
 * Centers on the cue nearest to positionSeconds, expands outward until token budget is reached.
 */
function extractWindowAroundPosition(
  cues: TranscriptCue[],
  positionSeconds: number,
  maxTokens: number
): string {
  if (cues.length === 0) return ''

  // Find nearest cue
  let nearestIdx = 0
  let minDist = Math.abs(cues[0].startTime - positionSeconds)
  for (let i = 1; i < cues.length; i++) {
    const dist = Math.abs(cues[i].startTime - positionSeconds)
    if (dist < minDist) {
      minDist = dist
      nearestIdx = i
    }
  }

  // Expand outward from center
  let left = nearestIdx
  let right = nearestIdx
  let text = cues[nearestIdx].text
  let tokens = estimateTokens(text)

  while (tokens < maxTokens) {
    const canExpandLeft = left > 0
    const canExpandRight = right < cues.length - 1

    if (!canExpandLeft && !canExpandRight) break

    if (canExpandLeft) {
      left--
      const added = cues[left].text + ' '
      if (estimateTokens(added) + tokens > maxTokens) { left++; break }
      text = added + text
      tokens = estimateTokens(text)
    }

    if (canExpandRight && tokens < maxTokens) {
      right++
      const added = ' ' + cues[right].text
      if (estimateTokens(added) + tokens > maxTokens) { right--; break }
      text = text + added
      tokens = estimateTokens(text)
    }
  }

  const startTime = formatTimestamp(cues[left].startTime)
  const endTime = formatTimestamp(cues[right].endTime)
  return `[${startTime} - ${endTime}]\n${text}`
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatChapterContext(text: string, chapterTitle: string): string {
  return `Chapter: ${chapterTitle}\n${text}`
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
```

**Phase 2: Lazy embedding + RAG (future addendum):**
1. On first tutor interaction for a lesson, trigger background embedding of that lesson's transcript chunks (512 tokens, 20% overlap)
2. Store embeddings in existing `embeddings` table with a `sourceType: 'transcript'` discriminator
3. RAG retrieval via `ragCoordinator.retrieveContext()` with transcript source filter
4. Position-aware boosting: +0.2 similarity for chunks within 60 seconds of playhead

Phase 2 RAG will be detailed in a separate addendum when Phase 1 is complete and validated.

### Decision 5: Conversation Storage

**Problem:** Tutor conversations need to persist across page navigations and browser sessions so users can resume where they left off. The conversation also needs to provide context to the LLM for coherent multi-turn dialogue.

**Decision:** Dexie v29 with `chatConversations` table, blob message storage, 3-exchange sliding window for LLM context, and resume via message history display.

**Dexie v29 migration:**

```typescript
// src/db/schema.ts — add after v27 (v28 reserved for E50 StudySchedule)

database.version(29).stores({
  chatConversations: 'id, [courseId+videoId], courseId, updatedAt',
})
```

**Type definition:**

```typescript
// src/data/types.ts

export type TutorMode = 'socratic' | 'explain'

export interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number         // Date.now()
}

export interface ChatConversation {
  id: string                // UUID
  courseId: string           // FK to ImportedCourse.id
  videoId: string           // YouTube video ID or local video filename
  mode: TutorMode           // Current mode
  hintLevel: number         // Current hint ladder level (0-4)
  messages: TutorMessage[]  // JSON blob — full history
  createdAt: number         // Date.now()
  updatedAt: number         // Date.now()
}
```

**Add to ElearningDatabase type:**

```typescript
chatConversations: EntityTable<ChatConversation, 'id'>
```

**Compound index `[courseId+videoId]`:** Enables fast lookup of the conversation for the current lesson. One conversation per course+lesson pair (latest wins). If mode changes, update the existing conversation.

**Sliding window for LLM context (3 exchanges = 6 messages):**

```typescript
function getConversationContext(messages: TutorMessage[], maxExchanges: number = 3): TutorMessage[] {
  // An "exchange" is a user message + assistant response pair
  const lastN = messages.slice(-(maxExchanges * 2))
  return lastN
}
```

**Why 3 exchanges (not more):**
- 3 exchanges = ~650 tokens at average message length
- Fits comfortably in 4K Ollama budget alongside transcript context
- Research shows recent context is far more valuable than older context for tutoring
- Full message history is shown in UI (user can scroll) — only LLM context is windowed

**Resume behavior:**
- On navigation to lesson: load existing `chatConversation` for `[courseId+videoId]`
- Show all messages in `MessageList` (full history, scrollable)
- Inject last exchange (2 messages) as LLM context for continuity
- No special "resume" UI — conversation appears as if user never left

**Conversation lifecycle:**
- Created on first message in a lesson
- Updated (messages appended, `updatedAt` bumped) on each exchange
- No explicit "close" — conversation persists indefinitely
- No auto-delete — user can clear via button in TutorChat header

### Decision 6: Tutor Hook (useTutor)

**File:** `src/ai/hooks/useTutor.ts`

**Problem:** The tutor needs to orchestrate: loading/creating conversations, building context, building prompts, streaming LLM responses, processing frustration signals, updating hint levels, and persisting messages. This mirrors the `useChatQA` pattern but with lesson-awareness and state management.

**Decision:** New `useTutor` hook following the same 5-stage pipeline pattern as `useChatQA` but extended with context injection and hint ladder management. Paired with a Zustand store for conversation state.

**Zustand store:**

```typescript
// src/stores/useTutorStore.ts

import { create } from 'zustand'
import type { ChatConversation, TutorMessage, TutorMode } from '@/data/types'
import db from '@/db/schema'

interface TutorState {
  conversation: ChatConversation | null
  messages: TutorMessage[]
  isGenerating: boolean
  error: string | null
  mode: TutorMode
  hintLevel: number
  transcriptStatus: 'full' | 'limited' | 'offline'

  // Actions
  loadConversation: (courseId: string, videoId: string) => Promise<void>
  addMessage: (message: TutorMessage) => void
  updateLastMessage: (content: string) => void
  setMode: (mode: TutorMode) => void
  setHintLevel: (level: number) => void
  setTranscriptStatus: (status: 'full' | 'limited' | 'offline') => void
  setIsGenerating: (generating: boolean) => void
  setError: (error: string | null) => void
  persistConversation: () => Promise<void>
  clearConversation: () => Promise<void>
}
```

**useTutor hook — 6-stage pipeline:**

```typescript
// src/ai/hooks/useTutor.ts

import { useCallback, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { useTutorStore } from '@/stores/useTutorStore'
import { getLLMClient } from '@/ai/llm/factory'
import { buildTutorSystemPrompt } from '@/ai/tutor/tutorPromptBuilder'
import { getTranscriptContext } from '@/ai/tutor/transcriptContext'
import { processUserMessage, getHintInstruction, createHintLadder } from '@/ai/tutor/hintLadder'
import type { TutorMode } from '@/data/types'
import { LLMError } from '@/ai/llm/types'

interface UseTutorOptions {
  courseId: string
  lessonId: string
  videoPosition?: number
}

export function useTutor({ courseId, lessonId, videoPosition }: UseTutorOptions) {
  const store = useTutorStore()

  // Stage 0: Load existing conversation on mount
  useEffect(() => {
    store.loadConversation(courseId, lessonId)
  }, [courseId, lessonId])

  const sendMessage = useCallback(async (query: string) => {
    if (store.isGenerating) return

    store.setIsGenerating(true)
    store.setError(null)

    // Stage 1: Process frustration + update hint ladder
    const hintState = processUserMessage(
      { level: store.hintLevel, consecutiveStuck: 0, escalationHistory: [] },
      query
    )
    store.setHintLevel(hintState.level)

    // Add user message
    const userMsg = { role: 'user' as const, content: query, timestamp: Date.now() }
    store.addMessage(userMsg)

    try {
      // Stage 2: Get transcript context
      const transcript = await loadTranscript(courseId, lessonId)
      const chapters = await loadChapters(courseId, lessonId)
      const transcriptCtx = getTranscriptContext(
        transcript,
        chapters,
        videoPosition ?? 0,
        1200 // maxTokens for transcript
      )
      store.setTranscriptStatus(transcriptCtx.status)

      // Stage 3: Build system prompt
      const courseInfo = await loadCourseInfo(courseId, lessonId)
      const systemPrompt = buildTutorSystemPrompt({
        mode: store.mode,
        courseTitle: courseInfo.courseTitle,
        lessonTitle: courseInfo.lessonTitle,
        lessonPosition: courseInfo.lessonPosition,
        transcriptExcerpt: transcriptCtx.excerpt || undefined,
        learnerProfile: buildLearnerProfile(courseId),
        hintLevel: hintState.level,
        maxSystemTokens: getSystemTokenBudget(),
      })

      // Stage 4: Build message array for LLM
      const conversationContext = getConversationContext(store.messages, 3)
      const llmMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationContext.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: query },
      ]

      // Stage 5: Stream LLM response
      const aiMsg = { role: 'assistant' as const, content: '', timestamp: Date.now() }
      store.addMessage(aiMsg)

      const llmClient = await getLLMClient('tutor')
      let fullResponse = ''

      for await (const chunk of llmClient.streamCompletion(llmMessages)) {
        if (chunk.content) {
          fullResponse += chunk.content
          store.updateLastMessage(fullResponse)
        }
        if (chunk.finishReason) break
      }

      // Stage 6: Persist conversation
      await store.persistConversation()

    } catch (err) {
      const errorMessage = err instanceof LLMError
        ? mapLLMErrorToMessage(err)
        : 'Failed to process your request. Please try again.'
      store.setError(errorMessage)
      store.addMessage({
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
      })
    } finally {
      store.setIsGenerating(false)
    }
  }, [courseId, lessonId, videoPosition, store.isGenerating, store.mode, store.hintLevel, store.messages])

  return {
    messages: store.messages,
    isGenerating: store.isGenerating,
    sendMessage,
    error: store.error,
    mode: store.mode,
    setMode: store.setMode,
    transcriptStatus: store.transcriptStatus,
    clearConversation: store.clearConversation,
  }
}
```

**Error mapping (reuses ChatQA pattern):**

```typescript
function mapLLMErrorToMessage(err: LLMError): string {
  switch (err.code) {
    case 'TIMEOUT': return 'Request timed out. Please try again.'
    case 'RATE_LIMIT': return 'Rate limit exceeded. Please wait a moment.'
    case 'AUTH_ERROR': return 'Authentication failed. Check your AI provider settings.'
    case 'AUTH_REQUIRED': return 'Sign in required to use AI tutoring.'
    case 'ENTITLEMENT_ERROR': return 'Premium subscription required for AI tutoring.'
    case 'RATE_LIMITED': return 'Server rate limit exceeded. Please wait a moment.'
    case 'NETWORK_ERROR': return 'Network error. Check your connection.'
    default: return `AI provider error: ${err.message}`
  }
}
```

**Streaming failure recovery (improvement over ChatQA):**
If the LLM stream fails mid-response, the partial content is preserved in the message with an " [Response interrupted]" suffix appended. The user sees what was generated rather than losing it. This addresses brainstorming idea #29.

### Decision 7: Graceful Degradation

**Problem:** The tutor must function meaningfully across varying conditions: transcript availability, LLM availability, and different model capabilities.

**Decision:** 3-tier degradation with consistent banner UI, reusing ChatQA patterns.

**Degradation tiers:**

| Tier | Condition | Tutor Behavior | UI Indicator |
|---|---|---|---|
| **Full** | Transcript + LLM available | Lesson-aware Socratic tutoring with transcript citations | TranscriptBadge: "Transcript-grounded" (green) |
| **Limited** | No transcript, LLM available | General tutoring scoped to course title/description only | TranscriptBadge: "General mode" (yellow); banner: "Transcript not available for this lesson. Tutoring is limited to general course context." |
| **Offline** | LLM unavailable | Past conversations read-only, input disabled | Banner: "AI provider offline. Configure a provider in Settings to use tutoring." (same pattern as ChatQA lines 46-71) |

**TranscriptBadge component:**

```typescript
// src/app/components/tutor/TranscriptBadge.tsx

import { Badge } from '@/app/components/ui/badge'
import type { TranscriptStatus } from '@/ai/tutor/transcriptContext'

interface TranscriptBadgeProps {
  status: TranscriptStatus
}

export function TranscriptBadge({ status }: TranscriptBadgeProps) {
  switch (status) {
    case 'full':
      return <Badge variant="outline" className="text-success border-success">Transcript-grounded</Badge>
    case 'limited':
      return <Badge variant="outline" className="text-warning border-warning">General mode</Badge>
    case 'offline':
      return <Badge variant="outline" className="text-destructive border-destructive">Offline</Badge>
  }
}
```

**Premium gating:** The tutor follows the same gating as ChatQA. The `getLLMClient('tutor')` call goes through the existing middleware chain: origin check, JWT auth, BYOK detection, entitlement check, rate limit. No new endpoints, no new middleware. BYOK users and premium subscribers both get full tutor functionality with no capability differentiation in Phase 1-2.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LessonPlayer.tsx                                        │
│                                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Materials │ │  Notes   │ │Bookmarks │ │Transcript│ │ Summary  │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │ Tutor Tab (NEW)                                                   │      │
│  │                                                                   │      │
│  │  ┌─────────────────────────────────────────────────────────────┐ │      │
│  │  │ TutorChat.tsx                                                │ │      │
│  │  │                                                              │ │      │
│  │  │  TranscriptBadge ── "Transcript-grounded" / "General mode"  │ │      │
│  │  │  TutorModeChips ─── [Socratic] [Explain]  (Phase 2)        │ │      │
│  │  │                                                              │ │      │
│  │  │  MessageList ──────── (reused from chat/)                   │ │      │
│  │  │    MessageBubble ──── User and assistant messages            │ │      │
│  │  │    CitationLink ───── [MM:SS] links → video seek            │ │      │
│  │  │                                                              │ │      │
│  │  │  ChatInput ────────── (reused from chat/)                   │ │      │
│  │  └─────────────────────────────────────────────────────────────┘ │      │
│  └──────────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────┬──────────────────────────────┘
                                               │
                                 useTutor hook │
                                               │
┌──────────────────────────────────────────────┴──────────────────────────────┐
│                      AI Tutor Module (src/ai/tutor/)                         │
│                                                                             │
│  ┌────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐ │
│  │ tutorPromptBuilder │  │ transcriptContext.ts │  │ hintLadder.ts        │ │
│  │                    │  │                      │  │                      │ │
│  │ 6-slot system      │  │ 3 strategies:        │  │ Levels 0-4           │ │
│  │ prompt with        │  │  - full transcript   │  │ Frustration          │ │
│  │ auto budget        │  │  - chapter-based     │  │ detection            │ │
│  │                    │  │  - position window   │  │ Auto-escalation      │ │
│  └────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘ │
│           │                         │                         │             │
│           └─────────────┬───────────┘                         │             │
│                         │                                     │             │
│                         ▼                                     │             │
│  ┌────────────────────────────────────────────────────────────┘             │
│  │                                                                          │
│  ▼                                                                          │
│  useTutor.ts (6-stage pipeline)                                             │
│    1. Process frustration → update hint level                               │
│    2. Get transcript context (position-based)                               │
│    3. Build system prompt (6 slots, auto budget)                            │
│    4. Build LLM message array (system + history + query)                    │
│    5. Stream LLM response (reuses getLLMClient)                             │
│    6. Persist conversation (Dexie v29)                                      │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                        │
│  │ useTutorStore.ts     │  │ Dexie v29             │                        │
│  │ (Zustand)            │◄─│ chatConversations     │                        │
│  │ Session state +      │  │ [courseId+videoId]     │                        │
│  │ UI reactivity        │──►│ Blob messages        │                        │
│  └──────────────────────┘  └──────────────────────┘                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                     getLLMClient('tutor') │
                                      │
                    Same middleware chain as ChatQA:
                    Origin → JWT → BYOK → Entitlement → Rate Limit
                                      │
                           ┌──────────┴──────────┐
                           ▼                     ▼
                    ┌──────────────┐      ┌──────────────┐
                    │ AI Providers │      │ Ollama       │
                    │ (6 cloud)    │      │ (local)      │
                    └──────────────┘      └──────────────┘
```

### New Files Summary

| File | Purpose | Phase | Est. Lines |
|---|---|---|---|
| `src/app/components/tutor/TutorChat.tsx` | Orchestrator: MessageList + ChatInput + badges + mode chips | 1 | ~80 |
| `src/app/components/tutor/TranscriptBadge.tsx` | Transcript availability indicator | 1 | ~25 |
| `src/app/components/tutor/TutorModeChips.tsx` | Socratic/Explain mode selector chips | 2 | ~35 |
| `src/ai/tutor/types.ts` | TutorMode, TutorContext, PromptSlot types | 1 | ~40 |
| `src/ai/tutor/tutorPromptBuilder.ts` | 6-slot system prompt builder with auto budget | 1 | ~120 |
| `src/ai/tutor/transcriptContext.ts` | Position-based transcript extraction (3 strategies) | 1 | ~150 |
| `src/ai/tutor/hintLadder.ts` | Hint level state machine + frustration detection | 2 | ~120 |
| `src/ai/hooks/useTutor.ts` | 6-stage pipeline hook | 1 | ~140 |
| `src/stores/useTutorStore.ts` | Zustand conversation state + Dexie persistence | 1 | ~120 |

### Files to Modify

| File | Change | Phase |
|---|---|---|
| `src/app/pages/LessonPlayer.tsx` | Add Tutor TabsTrigger + TabsContent (6th tab) | 1 |
| `src/db/schema.ts` | Add v29 migration with `chatConversations` table | 1 |
| `src/db/checkpoint.ts` | Update `CHECKPOINT_VERSION` to 29 and add `chatConversations` to `CHECKPOINT_SCHEMA` | 1 |
| `src/data/types.ts` | Add `ChatConversation`, `TutorMessage`, `TutorMode` types | 1 |

### Implementation Sequence

**5 stories across Phase 1-2:**

```
Phase 1: Lesson-Aware Chat (3 stories)

E??-S01: Tutor Data Layer + Prompt Builder                   (no deps)
  ├── src/ai/tutor/types.ts (TutorMode, TutorContext, PromptSlot)
  ├── src/ai/tutor/tutorPromptBuilder.ts (6-slot builder, auto budget)
  ├── src/ai/tutor/transcriptContext.ts (3-strategy position injection)
  ├── src/db/schema.ts v29 migration (chatConversations table)
  ├── src/db/checkpoint.ts (update to v29)
  ├── src/data/types.ts (ChatConversation, TutorMessage, TutorMode)
  ├── Unit tests: prompt builder slot priority, transcript context strategies
  └── Unit tests: Dexie v29 migration, conversation CRUD

E??-S02: Tutor Hook + Store                                  (depends: S01)
  ├── src/stores/useTutorStore.ts (Zustand store with Dexie persistence)
  ├── src/ai/hooks/useTutor.ts (6-stage pipeline)
  ├── Streaming integration with getLLMClient('tutor')
  ├── Conversation load/save/resume lifecycle
  ├── Error handling (reuses ChatQA error mapping pattern)
  └── Integration test: mock LLM, verify full pipeline

E??-S03: Tutor Tab UI + Integration                          (depends: S02)
  ├── src/app/components/tutor/TutorChat.tsx (orchestrator)
  ├── src/app/components/tutor/TranscriptBadge.tsx
  ├── LessonPlayer.tsx modification (6th tab)
  ├── 3-tier graceful degradation (Full/Limited/Offline)
  ├── CitationLink → video seek integration
  └── E2E test: tutor tab visible, send message, response streams, badge shows

Phase 2: Socratic Mode (2 stories)

E??-S04: Hint Ladder + Frustration Detection                 (depends: S03)
  ├── src/ai/tutor/hintLadder.ts (state machine + frustration detection)
  ├── Integration with useTutor pipeline (Stage 1: process frustration)
  ├── Hint level instruction injection into prompt builder
  ├── Unit tests: escalation paths, frustration patterns, reset on topic change
  └── Integration test: mock LLM, verify hint level progresses through exchanges

E??-S05: Mode Selector + Socratic Prompts                    (depends: S04)
  ├── src/app/components/tutor/TutorModeChips.tsx (Socratic/Explain chips)
  ├── Mode-specific prompt templates (socratic vs explain rules)
  ├── Mode persistence in chatConversation record
  ├── Mode switch mid-conversation behavior (reset hint ladder to 0)
  └── E2E test: mode switch changes prompt behavior, hint ladder escalates visually
```

**Parallelization:** S01 and S02 are sequential (S02 depends on S01 types and data layer). S03 depends on S02 for the hook. S04 and S05 are sequential within Phase 2. Phase 1 (S01-S03) must be complete before Phase 2 starts.

### AI Tutoring Phase 1-2 Validation

**Coherence with Existing Architecture:**
- Follows `useChatQA` 5-stage pipeline pattern (extended to 6 stages with frustration processing)
- Reuses `getLLMClient()` factory with `'tutor'` feature ID (enables per-feature model selection from AI Deep Strategy)
- Reuses chat components (`MessageList`, `ChatInput`, `CitationLink`, `MessageBubble`, `EmptyState`) from `src/app/components/chat/`
- Follows Zustand store pattern from `useQAChatStore`, `useFlashcardStore`
- Follows Dexie versioning convention (v29, compound index pattern from `youtubeTranscripts`)
- Uses design tokens (`text-success`, `text-warning`, `text-destructive`) for TranscriptBadge
- LessonPlayer tab pattern matches existing 5 tabs with conditional rendering
- Same middleware chain as ChatQA (no new endpoints, no new server code)

**Relationship to AI Deep Strategy Decisions:**
- **Model Registry (Decision 1):** `getLLMClient('tutor')` resolves model via feature overrides — users can assign premium models to tutoring
- **Token Metering (Decision 5):** Tutor requests flow through the same proxy middleware and will be counted in `ai_usage` table
- **Study Buddy (Decision 6):** The Study Buddy's intent router will route "help me understand X" to the tutor module in Phase 6+
- **Intelligence Loop (Decision 7):** Misconception tracking (deferred to Phase 3+) will feed into the flashcard generation pipeline

**What This Addendum Does NOT Cover:**
- Phase 3+: RAG retrieval with lazy transcript embeddings (separate addendum when Phase 1-2 validated)
- Phase 4: Learner profile injection from Knowledge Map (depends on Section 13)
- Phase 5: Cross-lesson conversation memory with summarization
- Phase 6: Additional modes (ELI5, Quiz Me, Debug My Thinking)
- Misconception tracking and intelligence loop integration
- Post-hoc consistency checking for hallucination prevention

**Requirements Coverage:**
- Roadmap Section 13 goals: knowledge score calculation (done), dashboard heatmap/treemap (done), decay estimation (done via recency + predictRetention), action suggestions (done)
- Deferred to Phase 2: FSRS upgrade, historical trend tracking, self-assessment signal, concept graph
- Deferred to Phase 3: cross-topic correlation, study recommendations engine

**Risk Mitigations:**
- Sparse quiz/flashcard data → dynamic weight redistribution ensures fair scoring; confidence level communicates data quality
- Topic noise → regex-based noise filter + canonical map; extensible without algorithm changes
- Treemap readability on mobile → sorted list fallback below 640px breakpoint
- Flashcard-to-topic mapping imprecision → course-level spread is acceptable for Phase 1; Phase 2 adds `topicTag` to Flashcard
- Score staleness → computed on-demand (no cache), recency component ensures time-awareness
