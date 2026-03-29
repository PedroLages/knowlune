# BMad Brainstorming: Course Experience Unification + AI Model Selection Per Feature

**Date:** 2026-03-29
**Facilitator:** Claude (BMad brainstorming session)
**Scope:** Two upcoming epics for Knowlune

---

## Table of Contents

1. [Situation Analysis](#1-situation-analysis)
2. [Epic A: Course Experience Unification — Approaches](#2-epic-a-course-experience-unification--approaches)
3. [Epic B: AI Model Selection Per Feature — Approaches](#3-epic-b-ai-model-selection-per-feature--approaches)
4. [Dependencies Between Epic A and Epic B](#4-dependencies-between-epic-a-and-epic-b)
5. [Priority Recommendation](#5-priority-recommendation)
6. [Risks and Mitigation Strategies](#6-risks-and-mitigation-strategies)
7. [Quick Wins vs Long-Term Investments](#7-quick-wins-vs-long-term-investments)
8. [What NOT To Do](#8-what-not-to-do)

---

## 1. Situation Analysis

### Current Course System (3 Parallel Tracks)

| Aspect | Regular Courses (`/courses/:id`) | Imported Courses (`/imported-courses/:id`) | YouTube Courses (`/youtube-courses/:id`) |
|--------|----------------------------------|--------------------------------------------|-----------------------------------------|
| **Status** | DEAD CODE — `db.courses.clear()` runs on startup in `main.tsx:53` | Primary user-facing system | Secondary user-facing system |
| **Store** | `useCourseStore` — read-only, no `add` method | `useCourseImportStore` — full CRUD, thumbnails, tags | `useYouTubeImportStore` — import wizard only |
| **Type** | `Course` (193-line detail page) | `ImportedCourse` (553-line detail, 264-line player) | Uses `ImportedCourse` with `source: 'youtube'` (470-line detail, 407-line player) |
| **Routes** | 5 routes (detail, overview, player, quiz, quiz results) | 2 routes (detail, player) | 2 routes (detail, player) |
| **Features** | Notes panel, prev/next nav, breadcrumbs, quiz access, course overview | Missing: notes panel, prev/next nav, breadcrumbs, quiz access | Missing: notes panel, prev/next nav, breadcrumbs, quiz access |
| **Player LOC** | 1,088 lines (LessonPlayer.tsx — full featured) | 264 lines (ImportedLessonPlayer.tsx — minimal) | 407 lines (YouTubeLessonPlayer.tsx — moderate) |

### Current AI Model Configuration

Models are hardcoded in 3 locations across 2 files:

- `src/lib/aiSummary.ts:108-114` — `PROVIDER_MODELS` map (one model per provider)
- `src/lib/noteQA.ts:35-58` — `getModel()` switch statement (duplicates the same mapping)
- `src/lib/thumbnailService.ts:152` — Gemini model for image generation

The AI configuration (`AIConfigurationSettings`) stores provider + API key + consent toggles, but has no concept of per-feature model assignment. Ollama is the only provider where users can pick a model (via `OllamaModelPicker`), but that selection applies globally.

---

## 2. Epic A: Course Experience Unification — Approaches

### Approach A1: Adapter Pattern — Wrap Existing Components

**Concept:** Create a unified `UnifiedCourseDetail` and `UnifiedLessonPlayer` that detect the course source and delegate to an adapter layer. Each source gets an adapter that normalizes data access, while the UI is shared.

**Implementation sketch:**
- Define a `CourseAdapter` interface: `getMetadata()`, `getLessons()`, `getMediaUrl()`, `getTranscript()`
- Build `LocalCourseAdapter`, `YouTubeCourseAdapter` that wrap `ImportedCourse` data
- Single route `/courses/:slug` resolves via adapter
- Remove dead `Course` type and `useCourseStore` entirely

**Trade-offs:**
| Dimension | Assessment |
|-----------|------------|
| Effort | Medium (6-8 stories). Write adapters + new unified pages, then migrate. |
| Risk | Low-medium. Adapters isolate source-specific quirks. |
| UX impact | High. Users get one consistent experience. |
| Migration | Need URL redirects from `/imported-courses/*` and `/youtube-courses/*`. |
| Test burden | Moderate. Test each adapter + the unified UI. |

### Approach A2: Feature Parity Lift — Enhance Imported/YouTube In Place

**Concept:** Instead of unifying, bring the imported and YouTube players up to feature parity with the (dead) regular player. Add notes panel, prev/next nav, breadcrumbs, quiz access to both. Keep separate routes.

**Implementation sketch:**
- Extract shared components from `LessonPlayer.tsx` (NotesPanel, LessonNav, Breadcrumbs)
- Compose them into `ImportedLessonPlayer` and `YouTubeLessonPlayer`
- Keep 3 route families but with identical feature sets

**Trade-offs:**
| Dimension | Assessment |
|-----------|------------|
| Effort | Medium (5-7 stories). Extracting + integrating shared components. |
| Risk | Low. No route changes, no data migration. |
| UX impact | Medium. Features improve, but 3 URL families persist (confusing for deep links, bookmarks). |
| Migration | None needed — routes stay the same. |
| Debt | High. 3 parallel systems remain; every new feature must be added 3 times. |

### Approach A3: Full Rewrite — Single Course Entity With Source Discriminator

**Concept:** Replace all 3 course types with a single `UnifiedCourse` entity in Dexie. The `source` field (`'local' | 'youtube' | 'notion' | 'readwise'` — future-proof) determines media resolution strategy. One store, one route tree, one set of pages.

**Implementation sketch:**
- Design `UnifiedCourse` type that is a superset of `ImportedCourse` fields + source-specific extensions
- Write a Dexie migration that transforms existing `importedCourses` table into `courses` table
- Single store: `useUnifiedCourseStore` with source-aware methods
- Single route tree: `/courses/:slug`, `/courses/:slug/lessons/:lessonId`, etc.
- Delete: `CourseDetail.tsx`, `CourseOverview.tsx`, `LessonPlayer.tsx` (dead code), `useCourseStore.ts`
- URL slug generation: course name + source prefix for uniqueness (e.g., `react-fundamentals-yt`)

**Trade-offs:**
| Dimension | Assessment |
|-----------|------------|
| Effort | High (10-14 stories). Schema migration, new unified store, page rewrite, redirect layer. |
| Risk | Medium-high. Dexie migration could corrupt data if botched. |
| UX impact | Highest. Clean URLs, single mental model, future import sources slot in naturally. |
| Migration | Dexie versioned migration + route redirect middleware for old bookmarks. |
| Debt | Lowest. One system to maintain forever. |

### Approach A4: Hybrid — Adapter Pattern Now, Full Rewrite Later

**Concept:** Ship Approach A1 first (unified UI via adapters, keeping current data layer). Schedule A3 (schema unification) as a follow-up epic when there's evidence of new import sources (Notion, Readwise) needing the unified schema.

**Trade-offs:**
| Dimension | Assessment |
|-----------|------------|
| Effort | Medium now + medium later = high total, but spread over time. |
| Risk | Low now, medium later. Adapter layer proves the UI before committing to migration. |
| UX impact | High immediately (unified routes and features). |
| Debt | Medium. Adapter layer adds indirection, but protects against premature schema changes. |

---

## 3. Epic B: AI Model Selection Per Feature — Approaches

### Current AI Features Requiring Model Configuration

| Feature | File | Current Model | Use Case |
|---------|------|---------------|----------|
| Video summary | `aiSummary.ts` | per-provider default (e.g., `gpt-4o-mini`) | Summarize transcripts |
| Note Q&A (RAG) | `noteQA.ts` | per-provider default | Answer questions from notes |
| Thumbnail generation | `thumbnailService.ts` | `gemini-2.0-flash-preview-image-generation` | Generate course thumbnails |
| Auto-analysis | (various) | provider default | Course content analysis |
| Learning path suggestions | (AI learning path page) | provider default | Recommend learning sequences |
| Knowledge gap detection | (knowledge gaps page) | provider default | Identify weak areas |

### Approach B1: Per-Feature Model Picker in Settings

**Concept:** Extend `AIConfigurationSettings` with a `modelOverrides` map. For each AI feature (summary, QA, tagging, tutoring), users can optionally specify a provider+model pair. Defaults to the global provider's default model.

**Implementation sketch:**
- Add `featureModels: Record<AIFeature, { provider: AIProviderId; model: string } | null>` to config
- Build a "Model Assignments" section in Settings > AI with dropdowns per feature
- Each AI service reads its override first, falls back to global default
- For Ollama: fetch available models from `/api/tags`; for cloud providers: maintain a curated list

**Trade-offs:**
| Dimension | Assessment |
|-----------|------------|
| Effort | Medium (4-6 stories). Config schema + UI + wiring each feature. |
| Risk | Low. Additive change — null overrides preserve current behavior. |
| UX impact | High for power users. Casual users ignore it (defaults work). |
| Complexity | Model lists per provider need maintenance (new models release frequently). |

### Approach B2: Smart Model Recommendations

**Concept:** Same as B1, but with an opinionated recommendation engine. The system suggests optimal models per feature based on the task type (cheap/fast for tagging, smart/expensive for tutoring, local for privacy-sensitive).

**Implementation sketch:**
- Curated model catalog with metadata: `{ id, provider, costTier, speedTier, qualityTier, privacyLocal }`
- Recommendation algorithm: match feature requirements to model attributes
- UI shows "Recommended" badges next to suggested models
- One-click "Apply recommendations" button

**Trade-offs:**
| Dimension | Assessment |
|-----------|------------|
| Effort | High (7-10 stories). Catalog maintenance, recommendation logic, testing combinations. |
| Risk | Medium. Recommendations can be wrong; users may trust them blindly. |
| UX impact | Highest for onboarding — reduces decision paralysis for new users. |
| Maintenance | Catalog needs updating as providers release new models. |

### Approach B3: Provider-Level Model Selection Only

**Concept:** Simpler version — for each configured provider, let users pick which model to use (instead of the hardcoded default). The same model is used for all features of that provider. No per-feature granularity.

**Implementation sketch:**
- Extend `AIConfigurationSettings` with `selectedModel: string` per provider (like Ollama already has)
- Add model picker dropdowns for OpenAI, Anthropic, Groq, etc. in Settings
- Fetch available models via API for each provider (OpenAI: `/v1/models`, Anthropic: hardcoded list)

**Trade-offs:**
| Dimension | Assessment |
|-----------|------------|
| Effort | Low (2-3 stories). Extend existing Ollama pattern to other providers. |
| Risk | Very low. Minimal schema change. |
| UX impact | Medium. Users can pick GPT-4o instead of GPT-4o-mini, but can't mix providers per feature. |
| Limitation | Cannot use Claude for tutoring AND GPT for tagging simultaneously. |

### Approach B4: Multi-Provider Model Matrix

**Concept:** Allow users to configure multiple providers simultaneously (not just one). Each feature can be assigned to any configured provider + model combination.

**Implementation sketch:**
- Change from single `provider` to `configuredProviders: Record<AIProviderId, { apiKey, model, status }>`
- Feature-to-provider assignment matrix in Settings UI
- Each AI service resolves its provider+model from the matrix

**Trade-offs:**
| Dimension | Assessment |
|-----------|------------|
| Effort | High (8-12 stories). Multi-provider config, key management for multiple APIs, matrix UI. |
| Risk | Medium. More API keys = more security surface. Key rotation becomes complex. |
| UX impact | Highest for power users with multiple subscriptions. |
| Complexity | Highest. Testing N providers x M features x K models combinations. |

### On Claude Code Subscription OAuth Tokens

**Question raised:** Can Claude Code subscription OAuth tokens be reused for Anthropic API calls in third-party apps?

**Answer: No.** Claude Code's OAuth tokens are scoped to the Claude Code application and tied to Anthropic's internal auth infrastructure. They cannot be extracted or reused for third-party API calls. Reasons:

1. **Token scope:** Claude Code tokens are issued for the Claude Code client specifically, not for arbitrary API access.
2. **Terms of Service:** Reusing OAuth tokens outside their intended application violates Anthropic's ToS.
3. **Technical barriers:** The tokens use internal endpoints and auth flows that differ from the public Anthropic API (`api.anthropic.com`).
4. **Rotation/revocation:** Claude Code manages token lifecycle internally; extracting tokens would break when they rotate.

**Recommendation:** Users who want Anthropic models in Knowlune should use a standard Anthropic API key from `console.anthropic.com`. The free tier or pay-as-you-go pricing is the intended path.

---

## 4. Dependencies Between Epic A and Epic B

### Direct Dependencies: None

These epics are structurally independent. Epic A changes the course data model and UI components. Epic B changes the AI configuration layer. They touch different stores, different pages, and different lib modules.

### Indirect Coupling Points

| Coupling Point | Impact |
|----------------|--------|
| **AI Summary in Player** | If Epic A unifies the lesson player, and Epic B changes how models are resolved, both modify `LessonPlayer` (or its successor). Merge conflicts likely if developed in parallel. |
| **Per-Course AI Preferences** | Future feature: let users assign different AI models per course (e.g., use local Llama for private courses, GPT-4o for public YouTube courses). This requires both unified course identity (Epic A) and per-feature model selection (Epic B). |
| **Auto-Analysis on Import** | Import flow triggers AI analysis. If Epic A changes the import pipeline and Epic B changes model resolution, both affect `autoAnalysis.ts`. |

### Recommended Sequencing Constraint

Ship one epic fully before starting the other. No interleaving. The coupling points are minor but would create annoying merge conflicts and integration testing overhead if developed simultaneously.

---

## 5. Priority Recommendation

### Recommendation: Epic A First, Then Epic B

**Rationale:**

1. **User-facing pain is higher for Epic A.** Three URL families, inconsistent features, dead code — this confuses users every session. AI model selection is a power-user enhancement; the current defaults work fine for most.

2. **Epic A reduces surface area.** After unification, there are fewer places to wire up per-feature model selection (one player, one detail page, one store). Epic B becomes simpler.

3. **Epic A has more dead code risk.** The `Course` type, `useCourseStore`, `CourseDetail.tsx`, `CourseOverview.tsx`, and `LessonPlayer.tsx` are dead code that new contributors might accidentally resurrect or depend on. Removing it sooner prevents tech debt accumulation.

4. **Epic B's value compounds over time.** As more AI features are added (future epics), per-feature model selection becomes more valuable. Shipping it later means it launches with more features to configure.

5. **Testing efficiency.** Epic A's E2E tests validate the unified player. Epic B's tests can then target that single player instead of testing model selection across 3 separate player components.

### Recommended Approach Combination

- **Epic A:** Approach A4 (Hybrid — adapter pattern now, schema rewrite later)
  - Why: Gets unified UX shipped quickly without risky Dexie migration. The adapter layer proves the design. Schema unification can be a follow-up chore epic if/when new import sources (Notion, Readwise) arrive.

- **Epic B:** Approach B1 (per-feature model picker), with B3 as a quick-win first story
  - Why: B3 (provider-level model selection) can ship in 2-3 stories as an immediate improvement. B1 (per-feature granularity) builds on top of that foundation. Skip B2 (recommendations) and B4 (multi-provider matrix) — they are over-engineered for a personal learning app.

---

## 6. Risks and Mitigation Strategies

### Epic A Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Bookmark/URL breakage** | High | Medium | Ship redirect middleware in the first story. Test with saved bookmarks. |
| **Feature regression in unified player** | Medium | High | Extract features from `LessonPlayer.tsx` (1,088 lines) into composable hooks/components. Write E2E tests before refactoring. |
| **Dexie migration data loss** (if doing A3) | Low | Critical | Use versioned migration with rollback. Backup IDB before migration. Test with real user data (your own). |
| **YouTube-specific edge cases** | Medium | Medium | YouTube courses have unique fields (playlist ID, channel, thumbnails from URL vs blob). Adapter must handle these without leaking YouTube semantics into the unified UI. |
| **FileSystemDirectoryHandle loss** | Medium | High | Imported local courses depend on `directoryHandle` for file access. Handle permissions may be revoked between sessions. This is a pre-existing issue but becomes more visible in a unified system. |

### Epic B Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Model list staleness** | High | Low | Use dynamic fetching where possible (Ollama `/api/tags`, OpenAI `/v1/models`). For Anthropic/others, maintain a static list with a "Custom model ID" escape hatch. |
| **Invalid model selection** | Medium | Medium | Validate model ID on first use, fall back to default with a toast warning. |
| **Cost surprise** | Medium | Medium | Show cost tier indicators (free/cheap/expensive) next to model names. Warn when selecting expensive models for high-frequency features (auto-tagging). |
| **API key doesn't support selected model** | Medium | Low | Some API keys have model access restrictions. Test connection with selected model during setup. |

---

## 7. Quick Wins vs Long-Term Investments

### Quick Wins (1-2 Stories Each)

| Win | Epic | Impact | Effort |
|-----|------|--------|--------|
| **Delete dead course code** | A | Removes ~1,400 lines of confusion. `CourseDetail.tsx`, `CourseOverview.tsx`, `LessonPlayer.tsx`, `useCourseStore.ts`, `db.courses.clear()` in main.tsx. | 1 story |
| **Add route redirects** | A | `/courses/:id` redirects to `/imported-courses/:id` (or new unified route). Prevents 404s from old bookmarks. | 0.5 story |
| **Extract NotesPanel as shared component** | A | Currently only in dead `LessonPlayer.tsx`. Extract and add to imported/YouTube players. | 1 story |
| **Extend Ollama model picker pattern to cloud providers** | B | Provider-level model selection for OpenAI/Anthropic (B3). Uses existing `OllamaModelPicker` as template. | 2 stories |
| **DRY up model constants** | B | Consolidate `PROVIDER_MODELS` (aiSummary.ts) and `getModel()` (noteQA.ts) into a single `resolveModel()` utility. | 1 story |

### Long-Term Investments (3+ Stories Each)

| Investment | Epic | Impact | Effort |
|------------|------|--------|--------|
| **Unified course adapter layer** | A | Foundation for all future import sources. | 4-5 stories |
| **Prev/next lesson navigation for all sources** | A | Requires understanding lesson ordering across sources. | 2 stories |
| **Per-feature model assignment UI** | B | Full B1 implementation with settings panel. | 3-4 stories |
| **Dexie schema unification** | A | Single `courses` table for all sources (A3). Only if new sources emerge. | 5-6 stories |
| **Model capability catalog** | B | Structured metadata for recommendations (B2). Only if user research demands it. | 4-5 stories |

---

## 8. What NOT To Do

### Anti-Patterns for Epic A

1. **Do NOT try to merge `Course` and `ImportedCourse` types by adding optional fields to `Course`.** The `Course` type is designed for pre-seeded sample data with modules/lessons baked in. It has fundamentally different assumptions (sequential modules, basePath, coverImage as URL). Trying to make it a superset will create a type with 30+ optional fields and no type safety.

2. **Do NOT keep the `courses` Dexie table "just in case."** It is cleared on every app start. Any code that reads from it gets empty results. Delete it or repurpose it — do not leave zombie infrastructure.

3. **Do NOT build a universal player that handles all media types in one mega-component.** The dead `LessonPlayer.tsx` is already 1,088 lines. Instead, compose from smaller pieces: `VideoPlayer`, `PDFViewer`, `YouTubeEmbed`, `NotesPanel`, `LessonNav` — assembled by the adapter.

4. **Do NOT create a new URL scheme that encodes the source type** (e.g., `/courses/youtube/abc123`). The whole point of unification is that users should not know or care about the source. Use opaque slugs: `/courses/react-fundamentals`.

5. **Do NOT migrate URLs without a redirect layer.** There are E2E tests, user bookmarks, and potentially shared links that reference `/imported-courses/*` and `/youtube-courses/*`. These must redirect permanently (301) to the new routes.

6. **Do NOT attempt to unify the import wizards.** The local file import (FileSystem Access API) and YouTube import (URL parsing + metadata fetch) have completely different UX flows. Keep them as separate entry points that produce the same `UnifiedCourse` entity.

### Anti-Patterns for Epic B

1. **Do NOT build a model marketplace or discovery UI.** This is a personal learning app, not an AI playground. A simple dropdown with known models per provider is sufficient. Users who want exotic models can type a custom model ID.

2. **Do NOT store model selections per-course.** This creates an explosion of configuration surface. Per-feature is the right granularity. If a user wants different models for different courses, they can change the setting — it is not a frequent operation.

3. **Do NOT try to auto-detect the "best" model.** Running benchmark comparisons across providers to recommend the best model for each feature is a research project, not a product feature. Ship static recommendations based on common knowledge (GPT-4o is good at conversation, Haiku is fast and cheap for tagging).

4. **Do NOT build a cost tracking/estimation system.** Tempting, but out of scope. Users manage their own API billing. Showing cost tiers (free/cheap/moderate/expensive) as badges is sufficient.

5. **Do NOT try to reuse Claude Code OAuth tokens.** As explained in Section 3, this is technically infeasible and violates ToS. Do not even prototype it. Users need their own Anthropic API keys.

6. **Do NOT build provider failover/fallback chains** (e.g., "try Claude, if rate-limited fall back to GPT"). This adds enormous complexity for a personal app where the user controls exactly one provider at a time. If their API key is rate-limited, show an error and let them switch.

7. **Do NOT duplicate model lists across files.** The current codebase already has this problem (`PROVIDER_MODELS` in aiSummary.ts vs `getModel()` in noteQA.ts). Any approach must centralize model resolution into a single module.

---

## Appendix: Codebase References

| File | Relevance |
|------|-----------|
| `src/app/routes.tsx` | All 3 course route families (lines 189-275) |
| `src/stores/useCourseStore.ts` | Dead store — read-only, no add, table cleared on startup |
| `src/stores/useCourseImportStore.ts` | Primary course store with full CRUD |
| `src/stores/useYouTubeImportStore.ts` | YouTube import wizard state |
| `src/data/types.ts:92-109` | Dead `Course` type |
| `src/data/types.ts:148-174` | `ImportedCourse` type (the real one) |
| `src/data/types.ts:148` | `CourseSource = 'local' \| 'youtube'` |
| `src/main.tsx:50-54` | `db.courses.clear()` — kills sample courses on startup |
| `src/app/pages/LessonPlayer.tsx` | 1,088-line full-featured player (dead code) |
| `src/app/pages/ImportedLessonPlayer.tsx` | 264-line minimal player |
| `src/app/pages/YouTubeLessonPlayer.tsx` | 407-line moderate player |
| `src/lib/aiSummary.ts:108-114` | Hardcoded `PROVIDER_MODELS` map |
| `src/lib/noteQA.ts:35-58` | Duplicated hardcoded model selection |
| `src/lib/aiConfiguration.ts` | AI config types — no per-feature model concept |
| `src/app/components/figma/OllamaModelPicker.tsx` | Existing model picker (Ollama only) |
| `src/app/components/figma/AIConfigurationSettings.tsx` | Settings UI for AI providers |
