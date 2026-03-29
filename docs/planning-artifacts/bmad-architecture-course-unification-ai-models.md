# BMad Architecture: Course Experience Unification + AI Model Selection Per Feature

**Date:** 2026-03-29
**Architect:** Claude (BMad architecture session)
**Inputs:** Brainstorming doc (Hybrid approach A4), Domain research (task-based auto-routing with power-user override)
**Current Dexie version:** 29 (checkpoint)

---

## Table of Contents

1. [Epic A: Course Experience Unification](#epic-a-course-experience-unification)
   - [A1. Unified Data Model](#a1-unified-data-model)
   - [A2. Route Unification](#a2-route-unification)
   - [A3. Dead Code Removal Strategy](#a3-dead-code-removal-strategy)
   - [A4. Feature Additions](#a4-feature-additions)
   - [A5. IndexedDB Migration Plan](#a5-indexeddb-migration-plan)
   - [A6. Redirect Strategy](#a6-redirect-strategy)
2. [Epic B: AI Model Selection Per Feature](#epic-b-ai-model-selection-per-feature)
   - [B1. Extended Configuration Type](#b1-extended-configuration-type)
   - [B2. Model Discovery](#b2-model-discovery)
   - [B3. BYOK Pattern](#b3-byok-pattern)
   - [B4. OpenRouter as Optional Gateway](#b4-openrouter-as-optional-gateway)
   - [B5. LLM Client Factory Refactor](#b5-llm-client-factory-refactor)
   - [B6. UI Pattern](#b6-ui-pattern)
   - [B7. Default Model Recommendations](#b7-default-model-recommendations)
3. [Epic Sequencing](#epic-sequencing)
4. [Appendix: File Inventory](#appendix-file-inventory)

---

## Epic A: Course Experience Unification

### A1. Unified Data Model

#### Decision

Evolve `ImportedCourse` into THE canonical course type. It already has `source: CourseSource` discriminator (`'local' | 'youtube'`). The dead `Course` type (lines 92-109 of `types.ts`) is deleted entirely. No new unified type is created -- `ImportedCourse` IS the unified type, renamed to `Course` once dead code is removed.

**Phase 1 (this epic):** Adapter layer normalizes access. `ImportedCourse` type stays as-is in Dexie. A `CourseAdapter` interface provides a source-agnostic read API over the existing data.

**Phase 2 (future epic, only if Notion/Readwise import lands):** Rename `ImportedCourse` to `Course`, rename `importedCourses` table to `courses` via Dexie migration. Rename `importedVideos`/`importedPdfs` to `courseVideos`/`coursePdfs`.

#### Rationale

- `ImportedCourse` already has every field needed for both local and YouTube courses.
- The `source` field discriminator is already present and indexed in Dexie v29.
- A rename-only migration (Phase 2) is trivially safe -- Dexie supports table renames via copy-and-delete within a single version upgrade.
- Doing the rename now would require touching every file that imports `ImportedCourse` (~40 files) for zero user-facing benefit. The adapter layer delivers the UX improvement without the rename churn.

#### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Create new `UnifiedCourse` superset type | Adds a third type alongside `Course` and `ImportedCourse`. More confusion, not less. |
| Merge fields from `Course` into `ImportedCourse` | `Course` has `modules: Module[]`, `basePath`, `isSequential` -- none of which are needed. ImportedCourse uses flat `importedVideos`/`importedPdfs` tables. Merging would bloat the type with dead fields. |
| Skip adapters, just use `ImportedCourse` directly everywhere | YouTube courses have unique rendering needs (iframe embed vs blob URL, chapters vs directory structure). Without an adapter, every consumer must check `source` and branch. Adapters centralize this. |

#### CourseAdapter Interface

```typescript
// src/lib/courseAdapter.ts (new file)
interface CourseAdapter {
  getCourse(): ImportedCourse
  getSource(): CourseSource
  getLessons(): Promise<LessonItem[]>  // Normalized lesson list
  getMediaUrl(lessonId: string): Promise<string | null>
  getTranscript(lessonId: string): Promise<string | null>
  getThumbnailUrl(): Promise<string | null>
  getCapabilities(): ContentCapabilities
}

interface LessonItem {
  id: string
  title: string
  type: 'video' | 'pdf'
  duration?: number
  order: number
  // Source-specific metadata opaque to consumers
  sourceMetadata?: Record<string, unknown>
}

interface ContentCapabilities {
  hasVideo: boolean
  hasPdf: boolean
  hasTranscript: boolean
  supportsNotes: boolean
  supportsQuiz: boolean
  supportsPrevNext: boolean
  supportsBreadcrumbs: boolean
}
```

#### Key Files to Modify

| File | Change |
|---|---|
| `src/lib/courseAdapter.ts` | NEW: Adapter interface + `LocalCourseAdapter`, `YouTubeCourseAdapter` implementations |
| `src/data/types.ts` | Delete `Course` interface (lines 92-109). Extend `CourseSource` with future sources as needed. |
| `src/stores/useCourseImportStore.ts` | No changes in Phase 1. Rename to `useCourseStore.ts` in Phase 2. |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Adapter abstraction leaks source-specific behavior | Medium | Medium | Each adapter owns all source-specific logic. Unified components never check `source` directly. |
| YouTube courses need FileSystemDirectoryHandle=null checks | Low | Low | Already handled -- YouTube courses set `directoryHandle: null`. Adapter encapsulates this. |
| Performance overhead from adapter indirection | Very Low | Low | Adapters are thin data mappers, not computation-heavy. No measurable impact. |

---

### A2. Route Unification

#### Decision

Consolidate to a single route tree under `/courses/:courseId`. The `:courseId` param is the existing Dexie `id` (UUID). A `CourseRouter` component at the route level loads the course, creates the appropriate adapter, and renders the unified page components.

**New route structure:**

```
/courses/:courseId              -> UnifiedCourseDetail
/courses/:courseId/lessons/:lessonId  -> UnifiedLessonPlayer
```

**Removed routes (after redirect layer is in place):**

```
/imported-courses/:courseId
/imported-courses/:courseId/lessons/:lessonId
/youtube-courses/:courseId
/youtube-courses/:courseId/lessons/:lessonId
```

**Dead routes (deleted immediately, no redirects):**

```
/courses/:courseId/overview       (CourseOverview -- dead code)
/courses/:courseId/:lessonId      (LessonPlayer -- dead code)
/courses/:courseId/lessons/:lessonId/quiz
/courses/:courseId/lessons/:lessonId/quiz/results
/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId
```

Quiz routes are kept but re-parented under the new `/courses/` tree since quiz functionality is live (just not wired to imported courses yet).

#### Rationale

- Users currently see 3 different URL patterns for the same concept (a course). Bookmarks and shared links break across patterns.
- Domain research confirms no learning platform differentiates routes by content source.
- The courseId is already a UUID, so there is no collision between imported and YouTube course IDs.

#### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Keep `/imported-courses/*` and `/youtube-courses/*` but add `/courses/*` as alias | Three route families becomes four. More surface area, not less. |
| Use slug-based URLs (`/courses/react-fundamentals`) | Slugs require a lookup table or unique name enforcement. UUIDs are already unique. Slugs can be added later as an optional SEO layer. |
| Use source prefix in URL (`/courses/yt/abc123`) | Violates unification principle -- users should not know or care about source. |

#### Key Files to Modify

| File | Change |
|---|---|
| `src/app/routes.tsx` | Replace 9 course-related routes with 2 unified routes + quiz sub-routes. Add redirect routes for old paths. |
| `src/app/pages/UnifiedCourseDetail.tsx` | NEW: Unified detail page using adapter. Replaces `ImportedCourseDetail.tsx` + `YouTubeCourseDetail.tsx`. |
| `src/app/pages/UnifiedLessonPlayer.tsx` | NEW: Unified player using adapter. Replaces `ImportedLessonPlayer.tsx` + `YouTubeLessonPlayer.tsx`. |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bookmark breakage for existing users | High | Medium | Redirect layer (see A6) ships in first story before any route removals. |
| E2E test breakage | High | Medium | Update all test navigation paths. Use search-and-replace for route strings. |
| Deep link from other features (sidebar, search, notifications) | High | Low | Grep for `/imported-courses` and `/youtube-courses` in all `.tsx` files and update. |

---

### A3. Dead Code Removal Strategy

#### Decision

Delete all dead `Course`-system code in a single preparatory story before building the unified layer. This reduces confusion during implementation and shrinks the dependency graph.

#### Deletion Inventory

**Files to DELETE entirely:**

| File | LOC | Why Dead |
|---|---|---|
| `src/app/pages/CourseDetail.tsx` | ~193 | References `useCourseStore` which reads from `db.courses` (cleared on startup) |
| `src/app/pages/CourseOverview.tsx` | ~150 | Same dependency chain |
| `src/app/pages/LessonPlayer.tsx` | ~1,088 | Same dependency chain. **BUT: extract reusable components first (see A4).** |
| `src/stores/useCourseStore.ts` | 27 | Read-only store for cleared table |

**Code to DELETE from existing files:**

| File | Lines | What |
|---|---|---|
| `src/data/types.ts` | 92-109 | Dead `Course` interface |
| `src/main.tsx` | 50-55 | `db.courses.clear()` call (no data to clear after table removal) |
| `src/app/routes.tsx` | 197-243 | 6 dead routes for `/courses/*` (old system) |
| `src/db/schema.ts` | `courses` table declaration | Remove from latest version. Add Dexie v30 that drops the `courses` table. |
| `src/db/checkpoint.ts` | `courses` entry | Remove from checkpoint schema |

**Files to KEEP (referenced by live code):**

| File | Reason |
|---|---|
| `src/lib/progress.ts` | Used by imported course system for video position tracking |
| `src/lib/bookmarks.ts` | Used by imported course system |
| `src/app/components/figma/ModuleAccordion.tsx` | Only used by dead LessonPlayer, but could be repurposed. Delete if not needed after A4 extraction. |

#### Dependency Graph (Dead Code)

```
db.courses.clear() (main.tsx)
  -> db.courses table (schema.ts)
    -> Course type (types.ts)
      -> useCourseStore (useCourseStore.ts)
        -> LessonPlayer.tsx
          -> CourseDetail.tsx
          -> CourseOverview.tsx
        -> routes.tsx (6 dead routes)
```

All references form a self-contained subgraph. No live code depends on `Course` or `useCourseStore`.

#### Rationale

- Dead code actively harms: new contributors may think `Course` is the right type to use. The `db.courses.clear()` call in `main.tsx` is a red flag that confuses anyone reading the startup sequence.
- Deleting first (before building unified layer) means the unified layer has zero risk of accidentally importing dead code.

#### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Leave dead code in place during unification | Risk of accidental imports. Also, the `courses` Dexie table name conflicts with the future unified table name (Phase 2). |
| Gradual removal across multiple stories | More merge conflicts, harder to track what is deleted vs. what is being migrated. Single-story atomic deletion is cleaner. |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Accidentally deleting live code | Low | High | Grep every import/reference before deletion. Run full build + E2E suite after. |
| `courses` table removal breaks Dexie for existing users | Low | Medium | Dexie v30 migration explicitly drops the table. Existing users upgrade cleanly. The table was cleared on every startup anyway. |

---

### A4. Feature Additions

#### Decision

Extract reusable components from dead `LessonPlayer.tsx` (1,088 lines) BEFORE deleting it, then integrate into the unified player.

#### Components to Extract

| Component | Source Location (LessonPlayer.tsx) | Destination | Notes |
|---|---|---|---|
| **NoteEditor integration** | Uses `NoteEditor` component from `src/app/components/notes/NoteEditor.tsx` | Reuse directly in `UnifiedLessonPlayer` | `NoteEditor` is already a standalone component. LessonPlayer just mounts it in a resizable panel. |
| **Prev/Next Navigation** | Inline logic using `allLessons` array + `currentIndex` | Extract to `useLessonNavigation(courseId, lessonId)` hook | Returns `{ prevLesson, nextLesson, currentIndex, totalLessons }` |
| **Breadcrumbs** | Uses shadcn `Breadcrumb` component with course > lesson path | Extract to `<CourseBreadcrumb course={course} lessonTitle={title} />` | Thin wrapper around existing shadcn Breadcrumb |
| **Resizable Panel Layout** | `ResizablePanelGroup` with video + notes side panel | Reuse pattern directly in `UnifiedLessonPlayer` | Layout structure, not a reusable component |
| **Tab System** (Notes/Transcript/Summary/Bookmarks) | `Tabs` with 4 `TabsContent` sections | Reuse pattern with adapter-aware content | Transcript tab uses adapter for source-specific transcript loading |
| **Auto-Advance Countdown** | `AutoAdvanceCountdown` component | Already standalone at `src/app/components/figma/AutoAdvanceCountdown.tsx` | Direct reuse |
| **Completion Modal** | `CompletionModal` component | Already standalone at `src/app/components/celebrations/CompletionModal.tsx` | Direct reuse |

#### Integration Architecture

```
UnifiedLessonPlayer
  |-- CourseBreadcrumb (extracted)
  |-- ResizablePanelGroup (pattern reuse)
  |   |-- Main Panel
  |   |   |-- VideoPlayer (local) OR YouTubeEmbed (youtube) -- adapter decides
  |   |   |-- LessonNavigation (extracted hook + UI)
  |   |-- Side Panel (desktop) / Sheet (mobile)
  |       |-- Tabs
  |           |-- NoteEditor (existing component)
  |           |-- TranscriptPanel (existing component)
  |           |-- AISummaryPanel (existing component)
  |           |-- BookmarksList (existing component)
  |-- AutoAdvanceCountdown (existing component)
  |-- CompletionModal (existing component)
```

#### Key Files to Modify/Create

| File | Change |
|---|---|
| `src/app/hooks/useLessonNavigation.ts` | NEW: Hook for prev/next lesson resolution via adapter |
| `src/app/components/figma/CourseBreadcrumb.tsx` | NEW: Breadcrumb wrapper for course context |
| `src/app/pages/UnifiedLessonPlayer.tsx` | NEW: Composes all the above |
| `src/app/components/notes/NoteEditor.tsx` | No changes -- already standalone |
| `src/app/components/figma/TranscriptPanel.tsx` | Minor: accept transcript source from adapter instead of assuming local file |
| `src/app/components/figma/AISummaryPanel.tsx` | Minor: accept transcript via adapter |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extracted components miss edge cases from LessonPlayer | Medium | Medium | Write E2E tests for notes, nav, breadcrumbs BEFORE extracting. Tests validate behavior is preserved. |
| Notes panel data model mismatch for YouTube courses | Low | Low | Notes already use `courseId + videoId` as key. YouTube videos have unique IDs. No conflict. |
| Resizable panel performance on mobile | Low | Medium | LessonPlayer already handles this with Sheet fallback on mobile. Copy the pattern. |

---

### A5. IndexedDB Migration Plan

#### Decision

Add Dexie v30 with a single change: drop the dead `courses` table. No data transformation needed for `importedCourses` -- all existing data stays in place, untouched.

#### Migration Details

**Version 30 schema change:**

```typescript
// In schema.ts, after v29:
database.version(30).stores({
  // All existing tables unchanged...
  courses: null,  // DROP TABLE -- was cleared on every startup anyway
  // Everything else identical to v29
})
```

**Checkpoint update:**

```typescript
// In checkpoint.ts:
export const CHECKPOINT_VERSION = 30
// Remove `courses` line from CHECKPOINT_SCHEMA
```

**Why this is safe:**
- `db.courses.clear()` runs on every app startup (main.tsx:53). The table is always empty for active users.
- Dexie's `null` value in `.stores()` drops the table cleanly.
- No other table references `courses` via foreign key (Dexie has no FK constraints).

#### Data Survival Guarantee

| Data Type | Storage | Impact | Action |
|---|---|---|---|
| Imported courses (local) | `importedCourses` table | None | Untouched |
| YouTube courses | `importedCourses` table (source='youtube') | None | Untouched |
| Videos | `importedVideos` table | None | Untouched |
| PDFs | `importedPdfs` table | None | Untouched |
| Notes | `notes` table (keyed by courseId+videoId) | None | Untouched |
| Progress | `progress`, `contentProgress` tables | None | Untouched |
| Bookmarks | `bookmarks` table | None | Untouched |
| Study sessions | `studySessions` table | None | Untouched |
| Dead sample courses | `courses` table | Dropped | No loss -- was cleared on startup |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Dexie migration fails on upgrade | Very Low | High | v30 only drops a table (simplest possible migration). Unit test in `schema-checkpoint.test.ts` validates migration chain. |
| User has unsaved data in `courses` table | Near Zero | None | Table is cleared on every startup. Impossible to accumulate data. |

---

### A6. Redirect Strategy

#### Decision

Implement React Router redirect routes that permanently map old URL patterns to new ones. Use `<Navigate to={...} replace />` components at the route level.

#### Redirect Map

| Old Pattern | New Pattern | Implementation |
|---|---|---|
| `/imported-courses/:courseId` | `/courses/:courseId` | Route with `<Navigate>` |
| `/imported-courses/:courseId/lessons/:lessonId` | `/courses/:courseId/lessons/:lessonId` | Route with `<Navigate>` |
| `/youtube-courses/:courseId` | `/courses/:courseId` | Route with `<Navigate>` |
| `/youtube-courses/:courseId/lessons/:lessonId` | `/courses/:courseId/lessons/:lessonId` | Route with `<Navigate>` |

#### Implementation Pattern

```typescript
// In routes.tsx -- redirect routes (kept until at least 2 epics after migration)
{
  path: 'imported-courses/:courseId',
  element: <Navigate to={`/courses/${useParams().courseId}`} replace />,
},
// ... (implemented as small wrapper components since useParams needs component context)
```

In practice, each redirect needs a tiny wrapper component:

```typescript
function ImportedCourseRedirect() {
  const { courseId } = useParams()
  return <Navigate to={`/courses/${courseId}`} replace />
}
```

#### Internal Link Updates

All internal `<Link to="/imported-courses/...">` and `<Link to="/youtube-courses/...">` must be updated to `/courses/...`. Grep targets:

| Pattern to Search | Estimated Occurrences |
|---|---|
| `/imported-courses/` in `.tsx` files | ~15-20 |
| `/youtube-courses/` in `.tsx` files | ~10-15 |
| `imported-courses` in E2E test files | ~20-30 |
| `youtube-courses` in E2E test files | ~10-15 |

#### Key Files to Modify

| File | Change |
|---|---|
| `src/app/routes.tsx` | Add 4 redirect routes, remove 6 dead routes, add 2 unified routes |
| `src/app/components/Layout.tsx` | Update sidebar course links |
| `src/app/pages/Courses.tsx` | Update course card links |
| `src/stores/useCourseImportStore.ts` | No URL logic (store is URL-agnostic) |
| `tests/**/*.spec.ts` | Update all navigation URLs |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Missed internal links cause 404s | Medium | Medium | Comprehensive grep + E2E test suite catches missed links. |
| Redirect routes left forever, becoming dead code | Low | Low | Add a `// TODO: Remove redirect after Epic X+2` comment. Track in known-issues.yaml. |

---

## Epic B: AI Model Selection Per Feature

### B1. Extended Configuration Type

#### Decision

Add a `featureModels` map to `AIConfigurationSettings`. Each AI feature can optionally specify a provider + model + generation parameters. When unset, falls back to the global provider's default model.

#### Type Design

```typescript
// In src/lib/aiConfiguration.ts

/** AI features that support per-feature model selection */
export type AIFeatureId =
  | 'videoSummary'
  | 'noteQA'
  | 'thumbnailGeneration'
  | 'quizGeneration'
  | 'flashcardGeneration'
  | 'learningPath'
  | 'knowledgeGaps'
  | 'noteOrganization'

/** Per-feature model override configuration */
export interface FeatureModelConfig {
  /** Provider to use for this feature (overrides global) */
  provider: AIProviderId
  /** Model ID (e.g., 'gpt-4o-mini', 'claude-haiku-4-5') */
  model: string
  /** Temperature override (0.0-2.0). null = use model default. */
  temperature?: number
  /** Max tokens override. null = use model default. */
  maxTokens?: number
}

/** Extended AI configuration */
export interface AIConfigurationSettings {
  // ... existing fields unchanged ...

  /** Per-feature model overrides. null/undefined = use global provider default. */
  featureModels?: Partial<Record<AIFeatureId, FeatureModelConfig>>

  /** API keys per provider (for multi-provider support) */
  providerKeys?: Partial<Record<AIProviderId, EncryptedData>>
}
```

#### Rationale

- `featureModels` is optional and defaults to `undefined` -- zero breaking change for existing users.
- `Partial<Record<...>>` means only overridden features are stored. If a user only customizes `videoSummary`, only that entry exists.
- `providerKeys` enables multi-provider support (user can have OpenAI key for summaries AND Anthropic key for Q&A). This replaces the single `apiKeyEncrypted` field over time.
- Temperature and maxTokens per feature allow fine-tuning (e.g., low temperature for quiz generation, high for creative summaries).

#### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Single `selectedModel` per provider (B3 from brainstorming) | Insufficient granularity. Cannot use Haiku for tagging and Sonnet for tutoring. B3 is a stepping stone, not the target. |
| Model config per course | Configuration explosion. Per-feature is the right granularity for a personal app. |
| Separate localStorage keys per feature | Fragmented storage. Single `AIConfigurationSettings` object is easier to backup/restore and reason about. |

#### Key Files to Modify

| File | Change |
|---|---|
| `src/lib/aiConfiguration.ts` | Add `AIFeatureId`, `FeatureModelConfig`, extend `AIConfigurationSettings` |
| `src/lib/aiConfiguration.ts` | Add `getFeatureModel(feature: AIFeatureId): { provider, model, temperature?, maxTokens? }` resolver |
| `src/lib/aiConfiguration.ts` | Add `getDecryptedApiKeyForProvider(provider: AIProviderId)` for multi-provider key lookup |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Config migration breaks existing users | Low | Medium | New fields are optional with undefined default. `getAIConfiguration()` already spreads defaults. |
| Per-feature API key lookup adds latency | Very Low | Low | Key decryption is ~1ms (Web Crypto). Negligible. |

---

### B2. Model Discovery

#### Decision

Implement provider-specific model discovery with a static fallback list. Dynamic fetching where APIs support it, curated static lists elsewhere.

#### Discovery Strategy Per Provider

| Provider | Strategy | Endpoint | Notes |
|---|---|---|---|
| **Ollama** | Dynamic (already implemented) | `GET /api/tags` | Returns installed models. `OllamaModelPicker.tsx` already handles this. |
| **OpenAI** | Dynamic + filter | `GET /v1/models` | Returns all models. Filter to chat-capable models (exclude embeddings, whisper, dall-e). |
| **Anthropic** | Static curated list | None (no list-models API) | Anthropic does not expose a model listing endpoint. Maintain a hardcoded list: `claude-opus-4-6`, `claude-sonnet-4-5`, `claude-haiku-4-5`, etc. |
| **Google Gemini** | Dynamic | `GET /v1beta/models?key={key}` | Returns model list with capabilities. Filter to `generateContent` capable. |
| **Groq** | Dynamic | `GET /openai/v1/models` | OpenAI-compatible endpoint. Returns available models. |
| **GLM/Z.ai** | Static curated list | None | Limited model set: `glm-4-flash`, `glm-4-plus`. |
| **OpenRouter** | Dynamic | `GET /api/v1/models` | Returns 500+ models. Group by provider, show cost tier. |

#### Implementation

```typescript
// src/lib/modelDiscovery.ts (new file)

interface DiscoveredModel {
  id: string            // Model ID used in API calls
  name: string          // Human-readable name
  provider: AIProviderId | 'openrouter'
  costTier?: 'free' | 'low' | 'medium' | 'high'
  contextWindow?: number
  capabilities: ('chat' | 'vision' | 'image-gen')[]
}

/** Fetch available models for a provider. Returns cached results for 5 minutes. */
async function discoverModels(
  provider: AIProviderId,
  apiKey: string
): Promise<DiscoveredModel[]>

/** Static fallback list when dynamic discovery fails or is unavailable */
const STATIC_MODEL_LIST: Record<AIProviderId, DiscoveredModel[]>
```

#### Cache Strategy

- Cache discovered models in memory (Zustand store or module-level `Map`) for 5 minutes.
- On Settings page open: fetch fresh list.
- On API error: fall back to static list + show warning toast.
- "Custom model ID" text input as escape hatch for models not in the list.

#### Rationale

- Dynamic fetching ensures users see models their API key actually has access to (some keys are restricted).
- Static fallback prevents the Settings page from being broken when an API is down.
- 5-minute cache avoids hammering model list APIs on every Settings page interaction.

#### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Only static lists for all providers | Stale within weeks as providers release new models. |
| Only dynamic lists | Breaks when API is down. Anthropic has no list endpoint. |
| Fetch on every dropdown open | Excessive API calls. Model lists change rarely. |

#### Key Files to Create/Modify

| File | Change |
|---|---|
| `src/lib/modelDiscovery.ts` | NEW: Model discovery service with dynamic + static fallback |
| `src/lib/modelDiscovery.static.ts` | NEW: Static model catalog (separated for easy updates) |
| `server/routes/models.ts` | NEW: Proxy endpoint for model list APIs (CORS) |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenAI model list returns 100+ models, overwhelming UI | High | Medium | Filter to chat-capable. Group by family (GPT-4, GPT-4o, etc.). Show max 20. |
| Model discovery adds latency to Settings page | Medium | Low | Fetch in background on Settings mount. Show skeleton while loading. |
| Static list becomes stale | High | Low | Stale list still works -- old models remain available. Update static list each epic. |

---

### B3. BYOK Pattern

#### Decision

Extend the existing single-provider BYOK to support multiple simultaneous provider keys. Each provider gets its own encrypted API key stored in `providerKeys`. The existing `apiKeyEncrypted` field is migrated to `providerKeys[currentProvider]` on first load.

#### Architecture

```
User enters API key in Settings
  -> Encrypted via Web Crypto API (existing encryptData())
  -> Stored in providerKeys[providerId] in localStorage
  -> Never sent to backend (API calls use server proxy which receives key per-request)
  -> Decrypted only when preparing API call (existing getDecryptedApiKey() pattern)
```

#### Multi-Provider Key Storage

```typescript
// Migration from single key to multi-key (backward compatible)
function getDecryptedApiKeyForProvider(provider: AIProviderId): Promise<string | null> {
  const config = getAIConfiguration()

  // New path: per-provider keys
  if (config.providerKeys?.[provider]) {
    return decryptData(config.providerKeys[provider])
  }

  // Legacy path: single key for the global provider
  if (provider === config.provider && config.apiKeyEncrypted) {
    return decryptData(config.apiKeyEncrypted)
  }

  return null
}
```

#### Rationale

- BYOK is the industry standard for personal apps (TypingMind, CodeGPT, Warp, 50+ others on BYOKList.com).
- Multi-provider keys are required for per-feature model selection (Epic B's core value proposition).
- Web Crypto encryption is already implemented and battle-tested.
- Browser-side key storage means no backend key management, no server-side security surface.

#### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Server-side key storage | Adds security surface, requires auth system (not yet built). Knowlune is a client-side app. |
| Single provider only (current behavior) | Blocks per-feature model selection across providers. |
| Reuse Claude Code OAuth tokens | Explicitly prohibited by Anthropic ToS (Feb 2026). Technically blocked. |

#### Key Files to Modify

| File | Change |
|---|---|
| `src/lib/aiConfiguration.ts` | Add `providerKeys`, `getDecryptedApiKeyForProvider()`, migration logic |
| `src/app/components/figma/AIConfigurationSettings.tsx` | UI for entering keys per provider (expand accordion per provider) |
| `src/lib/crypto.ts` | No changes (existing encrypt/decrypt sufficient) |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Multiple API keys increase attack surface | Low | Medium | Keys encrypted at rest (Web Crypto). Never logged. XSS is the main vector -- existing CSP headers mitigate. |
| User confusion with multiple key fields | Medium | Low | Progressive disclosure: show only the selected provider's key by default. "Add another provider" expands additional fields. |
| Migration from single-key to multi-key corrupts existing key | Low | High | Migration is additive (copy, don't delete). Keep `apiKeyEncrypted` as legacy fallback indefinitely. |

---

### B4. OpenRouter as Optional Gateway

#### Decision

Add OpenRouter as a new provider option (`'openrouter'`). It acts as a single API gateway to 500+ models across providers. Users who want multi-model access without multiple API keys can use OpenRouter instead of individual provider keys.

#### Integration Design

- OpenRouter uses the OpenAI-compatible API format. The existing `ProxyLLMClient` (which calls the Vite dev server proxy) can route to OpenRouter by setting `baseURL` to `https://openrouter.ai/api/v1`.
- Model IDs use the format `provider/model` (e.g., `anthropic/claude-haiku-4-5`, `openai/gpt-4o-mini`).
- API key format: `sk-or-v1-...`

#### Implementation

```typescript
// In AI_PROVIDERS registry:
openrouter: {
  id: 'openrouter',
  name: 'OpenRouter',
  validateApiKey: key => /^sk-or-v1-[A-Za-z0-9]{48,}$/.test(key),
  testConnection: async (key) => { /* GET /api/v1/models with key */ },
}
```

```typescript
// In server/providers.ts, add OpenRouter case:
case 'openrouter':
  return createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
    headers: { 'HTTP-Referer': 'https://knowlune.app', 'X-Title': 'Knowlune' }
  })(model || 'anthropic/claude-haiku-4-5')
```

#### Rationale

- OpenRouter solves the "multiple API keys" problem with a single key.
- OpenAI-compatible API means minimal code changes.
- Users can access Claude, GPT, Gemini, and open-source models from one account.
- Domain research validates this as the emerging pattern for BYOK apps.

#### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Only support individual providers | Forces users to manage 3-4 API keys for full flexibility. |
| Make OpenRouter the ONLY option | Locks users into OpenRouter's pricing markup. Power users with direct API access should not be forced through a gateway. |
| LiteLLM self-hosted proxy | Over-engineered for a personal app. Requires running a separate server. |

#### Key Files to Modify

| File | Change |
|---|---|
| `src/lib/aiConfiguration.ts` | Add `'openrouter'` to `AIProviderId` union. Add provider entry. |
| `server/providers.ts` | Add OpenRouter case using `createOpenAI` with custom baseURL |
| `src/lib/modelDiscovery.ts` | Add OpenRouter model listing (GET `/api/v1/models`) |
| `src/app/components/figma/AIConfigurationSettings.tsx` | Add OpenRouter to provider selector |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenRouter adds latency (extra hop) | Medium | Low | Optional -- users with direct API keys can use individual providers. |
| OpenRouter pricing changes | Low | Low | Users manage their own OpenRouter billing. Knowlune has no financial dependency. |
| OpenRouter API compatibility breaks | Low | Medium | OpenAI compatibility is their core promise. Monitor changelogs. Fall back to direct provider on failure. |

---

### B5. LLM Client Factory Refactor

#### Decision

Refactor the LLM client factory to read per-feature configuration with global fallback. Consolidate the 3 hardcoded model locations into a single `resolveModel()` utility.

#### Current State (3 duplicate model maps)

```
src/lib/aiSummary.ts:108    -> PROVIDER_MODELS (openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-20241022', ...)
src/lib/noteQA.ts:35        -> getModel() switch (openai: 'gpt-4o-mini', anthropic: 'claude-3-5-haiku-20241022', ...)
src/lib/thumbnailService.ts:152 -> hardcoded 'gemini-2.0-flash-preview-image-generation'
server/providers.ts:17      -> DEFAULT_MODELS (anthropic: 'claude-haiku-4-5', openai: 'gpt-4-turbo', ...)
```

Note: `aiSummary.ts` and `server/providers.ts` use DIFFERENT default models for the same providers (e.g., `gpt-4o-mini` vs `gpt-4-turbo` for OpenAI).

#### Target State (single resolution chain)

```typescript
// src/lib/modelResolver.ts (new file)

/** Default models per provider (single source of truth) */
const PROVIDER_DEFAULTS: Record<AIProviderId, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
  glm: 'glm-4-flash',
  ollama: 'llama3.2',
  openrouter: 'anthropic/claude-haiku-4-5',
}

/** Feature-specific default overrides (e.g., thumbnail gen MUST use Gemini) */
const FEATURE_DEFAULTS: Partial<Record<AIFeatureId, FeatureModelConfig>> = {
  thumbnailGeneration: {
    provider: 'gemini',
    model: 'gemini-2.0-flash-preview-image-generation',
  },
}

/**
 * Resolve the model configuration for a given feature.
 *
 * Resolution order:
 * 1. User's per-feature override (featureModels[feature])
 * 2. Feature-specific default (FEATURE_DEFAULTS[feature])
 * 3. User's global provider + default model (PROVIDER_DEFAULTS[globalProvider])
 */
function resolveFeatureModel(feature: AIFeatureId): {
  provider: AIProviderId
  model: string
  temperature?: number
  maxTokens?: number
}
```

#### Factory Integration

```typescript
// Updated getLLMClient() signature:
async function getLLMClient(feature?: AIFeatureId): Promise<LLMClient>

// Usage in consumers:
// src/lib/aiSummary.ts
const client = await getLLMClient('videoSummary')

// src/lib/noteQA.ts
const client = await getLLMClient('noteQA')
```

The factory reads `resolveFeatureModel(feature)` to determine the provider + model, then gets the appropriate API key via `getDecryptedApiKeyForProvider(provider)`.

#### Key Files to Create/Modify

| File | Change |
|---|---|
| `src/lib/modelResolver.ts` | NEW: Single model resolution utility |
| `src/ai/llm/factory.ts` | Accept optional `AIFeatureId`, delegate to `resolveFeatureModel()` |
| `src/lib/aiSummary.ts` | DELETE `PROVIDER_MODELS`. Call `getLLMClient('videoSummary')`. |
| `src/lib/noteQA.ts` | DELETE `getModel()`. Call `getLLMClient('noteQA')`. |
| `src/lib/thumbnailService.ts` | Read model from `resolveFeatureModel('thumbnailGeneration')` instead of hardcoded string. |
| `server/providers.ts` | Accept model as parameter (already does via `model?` param). Sync `DEFAULT_MODELS` with `PROVIDER_DEFAULTS`. |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Refactoring breaks existing AI features | Medium | High | Unit tests for `resolveFeatureModel()` covering all resolution paths. E2E tests for summary + QA. |
| Server-side `DEFAULT_MODELS` diverges from client-side | Low | Medium | Move `PROVIDER_DEFAULTS` to a shared constants file imported by both client and server. |
| Feature resolution adds overhead to every AI call | Very Low | None | One synchronous localStorage read + object lookup. Sub-millisecond. |

---

### B6. UI Pattern

#### Decision

Extend the existing Settings > AI Configuration panel. Keep the current per-feature consent toggles. Below each toggle, add an optional model override section that appears when the toggle is enabled.

#### UI Layout

```
Settings > AI Configuration
|
|-- Provider Selection (existing)
|     [OpenAI v]  [API Key: ****]  [Test Connection]
|     [+ Add another provider]  -- expands Anthropic, Gemini, etc.
|
|-- Model Selection (new, collapsed by default)
|     Global Default Model: [gpt-4o-mini v]
|
|-- Feature Configuration (enhanced existing)
|     [ ] Video Summary        [Override: Default v]  [gpt-4o-mini v]
|     [ ] Note Q&A             [Override: Default v]
|     [ ] Learning Path        [Override: Default v]
|     [ ] Knowledge Gaps       [Override: Default v]
|     [ ] Note Organization    [Override: Default v]
|     [ ] Quiz Generation      [Override: Default v]
|
|     When "Override" dropdown != "Default":
|     |-- Provider: [Anthropic v]
|     |-- Model: [claude-haiku-4-5 v]
|     |-- Temperature: [0.7] (slider)
|     |-- Max Tokens: [2048] (input)
```

#### Progressive Disclosure

1. **Casual users** see only the consent toggles (existing behavior). Everything uses global provider defaults.
2. **Intermediate users** pick a global model from a dropdown (new). All features use that model.
3. **Power users** expand per-feature overrides to mix providers and models.

#### Component Architecture

| Component | File | Responsibility |
|---|---|---|
| `AIConfigurationSettings` | `src/app/components/figma/AIConfigurationSettings.tsx` | Existing: provider + key + consent. Enhanced: model picker + feature overrides. |
| `ProviderModelPicker` | `src/app/components/figma/ProviderModelPicker.tsx` | NEW: Generic model dropdown for any provider (generalizes `OllamaModelPicker`). |
| `FeatureModelOverride` | `src/app/components/figma/FeatureModelOverride.tsx` | NEW: Collapsible per-feature override panel with provider + model + params. |
| `OllamaModelPicker` | `src/app/components/figma/OllamaModelPicker.tsx` | Existing: Ollama-specific. Becomes a thin wrapper around `ProviderModelPicker`. |

#### Key Files to Modify

| File | Change |
|---|---|
| `src/app/components/figma/AIConfigurationSettings.tsx` | Add global model picker, enhance consent toggles with override expansion |
| `src/app/components/figma/ProviderModelPicker.tsx` | NEW: Generic model picker using `discoverModels()` |
| `src/app/components/figma/FeatureModelOverride.tsx` | NEW: Per-feature override panel |
| `src/app/components/figma/OllamaModelPicker.tsx` | Refactor to delegate to `ProviderModelPicker` |

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Settings page becomes overwhelming | Medium | Medium | Progressive disclosure. Override section hidden by default. Accordion for advanced features. |
| Model dropdown shows too many options | Medium | Low | Group by family. Show "Recommended" badge. Limit to 20 per provider, with search. |
| Temperature/maxTokens confuse non-technical users | Low | Low | Only shown in override section (power users only). Sensible defaults when not set. |

---

### B7. Default Model Recommendations

#### Decision

Ship opinionated defaults per feature based on task characteristics. No recommendation engine -- just a static mapping reviewed each epic.

#### Default Model Matrix

| Feature | Task Type | Recommended Model (OpenAI) | Recommended Model (Anthropic) | Recommended Model (Groq) | Recommended Model (Gemini) | Temperature |
|---|---|---|---|---|---|---|
| Video Summary | Long-form comprehension | gpt-4o-mini | claude-haiku-4-5 | llama-3.3-70b-versatile | gemini-2.0-flash | 0.3 |
| Note Q&A (RAG) | Conversational reasoning | gpt-4o | claude-sonnet-4-5 | llama-3.3-70b-versatile | gemini-2.0-flash | 0.5 |
| Thumbnail Generation | Image generation | N/A | N/A | N/A | gemini-2.0-flash-preview-image-generation | 1.0 |
| Quiz Generation | Structured extraction | gpt-4o-mini | claude-haiku-4-5 | llama-3.3-70b-versatile | gemini-2.0-flash | 0.2 |
| Flashcard Generation | Structured extraction | gpt-4o-mini | claude-haiku-4-5 | llama-3.3-70b-versatile | gemini-2.0-flash | 0.2 |
| Learning Path | Planning + reasoning | gpt-4o | claude-sonnet-4-5 | llama-3.3-70b-versatile | gemini-2.0-flash | 0.5 |
| Knowledge Gaps | Analysis + reasoning | gpt-4o | claude-sonnet-4-5 | llama-3.3-70b-versatile | gemini-2.0-flash | 0.4 |
| Note Organization | Classification | gpt-4o-mini | claude-haiku-4-5 | llama-3.3-70b-versatile | gemini-2.0-flash | 0.1 |

#### Design Principles for Defaults

1. **Use smallest sufficient model** -- prefer Haiku/Mini for structured extraction, Sonnet/4o for reasoning tasks.
2. **Low temperature for structured output** -- quiz/flashcard generation needs deterministic, well-formatted responses.
3. **Higher temperature for conversational features** -- Q&A and tutoring benefit from varied responses.
4. **Thumbnail generation is Gemini-only** -- only provider with native image generation in the text model.

#### UI Indication

Show a "Recommended" badge next to the default model in the dropdown. When a user selects a non-recommended model, show a subtle note: "Default: {model name}. You can always reset to recommended."

#### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Recommendations become stale as new models release | High | Low | Static list updated each epic. Functional correctness is not affected -- old models still work. |
| "Recommended" badge creates false confidence | Low | Low | Badge is informational. Users can override freely. No enforcement. |

---

## Epic Sequencing

### Recommended Order: Epic A first, then Epic B

**Rationale (from brainstorming, confirmed by architecture analysis):**

1. Epic A reduces the number of player/detail components from 6 to 2. Epic B then wires model selection into 2 components instead of 6.
2. Epic A's dead code removal frees the `courses` Dexie table name for future Phase 2 schema unification.
3. Epic A has higher user-facing impact (consistent UX) vs. Epic B (power-user configuration).

### Epic A Story Order (suggested)

| Order | Story | Depends On |
|---|---|---|
| 1 | Extract reusable components from dead LessonPlayer (notes, nav, breadcrumbs) | Nothing |
| 2 | Delete dead code (Course type, useCourseStore, CourseDetail, CourseOverview, LessonPlayer, Dexie v30) | Story 1 |
| 3 | Build CourseAdapter interface + LocalCourseAdapter + YouTubeCourseAdapter | Story 2 |
| 4 | Build UnifiedCourseDetail page | Story 3 |
| 5 | Build UnifiedLessonPlayer page (with notes, nav, breadcrumbs) | Stories 3, 1 |
| 6 | Route unification + redirect layer + internal link updates | Stories 4, 5 |
| 7 | E2E test migration + new unified flow tests | Story 6 |

### Epic B Story Order (suggested)

| Order | Story | Depends On |
|---|---|---|
| 1 | DRY up model constants into `modelResolver.ts` + `PROVIDER_DEFAULTS` | Nothing |
| 2 | Add `featureModels` and `providerKeys` to AIConfigurationSettings type | Story 1 |
| 3 | Build `modelDiscovery.ts` (dynamic + static model fetching) | Nothing |
| 4 | Build `ProviderModelPicker` component (generalize OllamaModelPicker) | Story 3 |
| 5 | Add multi-provider BYOK UI (per-provider API key entry) | Story 2 |
| 6 | Add per-feature model override UI (`FeatureModelOverride` component) | Stories 4, 5 |
| 7 | Add OpenRouter as provider option | Stories 2, 3 |
| 8 | Wire `getLLMClient(feature)` through all AI consumers | Stories 1, 2 |
| 9 | E2E tests for model selection + multi-provider flows | Story 8 |

---

## Appendix: File Inventory

### Epic A: Files Touched

| File | Action | Epic A Story |
|---|---|---|
| `src/data/types.ts` | DELETE lines 92-109 (Course interface) | S02 |
| `src/stores/useCourseStore.ts` | DELETE file | S02 |
| `src/app/pages/CourseDetail.tsx` | DELETE file | S02 |
| `src/app/pages/CourseOverview.tsx` | DELETE file | S02 |
| `src/app/pages/LessonPlayer.tsx` | EXTRACT then DELETE | S01, S02 |
| `src/main.tsx` | DELETE db.courses.clear() block | S02 |
| `src/db/schema.ts` | Add v30 dropping courses table | S02 |
| `src/db/checkpoint.ts` | Update to v30, remove courses entry | S02 |
| `src/app/routes.tsx` | Replace 9 routes with 2 unified + 4 redirects | S06 |
| `src/lib/courseAdapter.ts` | NEW file | S03 |
| `src/app/hooks/useLessonNavigation.ts` | NEW file | S01 |
| `src/app/components/figma/CourseBreadcrumb.tsx` | NEW file | S01 |
| `src/app/pages/UnifiedCourseDetail.tsx` | NEW file | S04 |
| `src/app/pages/UnifiedLessonPlayer.tsx` | NEW file | S05 |

### Epic B: Files Touched

| File | Action | Epic B Story |
|---|---|---|
| `src/lib/aiConfiguration.ts` | MODIFY: Add types, providerKeys, featureModels | S02 |
| `src/lib/modelResolver.ts` | NEW file | S01 |
| `src/lib/modelDiscovery.ts` | NEW file | S03 |
| `src/lib/modelDiscovery.static.ts` | NEW file | S03 |
| `src/ai/llm/factory.ts` | MODIFY: Accept AIFeatureId, use resolveFeatureModel | S08 |
| `src/lib/aiSummary.ts` | MODIFY: DELETE PROVIDER_MODELS, use getLLMClient('videoSummary') | S08 |
| `src/lib/noteQA.ts` | MODIFY: DELETE getModel(), use getLLMClient('noteQA') | S08 |
| `src/lib/thumbnailService.ts` | MODIFY: Read model from resolver | S08 |
| `server/providers.ts` | MODIFY: Sync DEFAULT_MODELS, add OpenRouter | S07 |
| `src/app/components/figma/AIConfigurationSettings.tsx` | MODIFY: Add model picker, feature overrides, multi-provider keys | S05, S06 |
| `src/app/components/figma/ProviderModelPicker.tsx` | NEW file | S04 |
| `src/app/components/figma/FeatureModelOverride.tsx` | NEW file | S06 |
| `src/app/components/figma/OllamaModelPicker.tsx` | MODIFY: Delegate to ProviderModelPicker | S04 |
| `server/routes/models.ts` | NEW file (proxy for model list APIs) | S03 |
