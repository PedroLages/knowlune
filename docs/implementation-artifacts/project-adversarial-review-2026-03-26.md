# Project Adversarial Review: Knowlune

**Date:** 2026-03-26
**Reviewer:** Adversarial Review Agent (post-mega-epic-run)
**Scope:** Full codebase after 8 epics (E20, E18, E23, E19, E1B, E1C, E26, E28), 40 stories, 40 PRs (#66-#105)
**Codebase size:** ~146,000 lines across 704 TypeScript/TSX files, 27 Dexie schema versions, 22 Zustand stores

---

## Severity Definitions

| Level | Meaning |
|-------|---------|
| CRITICAL | Will cause data loss, security breach, or crash in production |
| HIGH | Will cause significant user frustration or technical debt within 3 months |
| MEDIUM | Will slow development velocity or degrade UX at scale |
| LOW | Cosmetic or minor inefficiency; fix when convenient |

---

## Finding 1: No List Virtualization -- O(n) DOM Rendering

**Severity:** HIGH
**Category:** Performance

The Courses page (646 lines), Authors page (592 lines), and Notes page (693 lines) render all items directly into the DOM. There is zero usage of `react-virtual`, `@tanstack/virtual`, or any virtualization library across the entire codebase.

**Impact at scale:**
- 500+ courses: noticeable scroll jank (each card has thumbnail, progress bar, tags, status badge)
- 1,000+ notes: browser tab memory exceeds 500MB with TipTap editor instances
- 10,000+ YouTube videos across courses: initial render blocks main thread for seconds

**Recommendation:** Add `@tanstack/react-virtual` to Courses list, Notes list, and any table views. Priority: Courses page (most likely to hit hundreds of items first).

---

## Finding 2: IndexedDB Has No Data Pruning or Size Limits

**Severity:** HIGH
**Category:** Architecture / Data Management

The Dexie schema (931 lines, 27 versions) defines 20+ tables but implements zero garbage collection, TTL expiration, or storage quota monitoring. Tables grow indefinitely:

- `studySessions`: Every session logged forever (no archival)
- `embeddings`: Vector data accumulates with no eviction
- `aiUsageEvents`: Analytics events never pruned
- `quizAttempts`: Every attempt across every retake preserved
- `youtubeVideoCache`: 30-day refresh cycle but no deletion of abandoned course data
- `courseThumbnails`: Binary blob storage with no size limits

**Impact:** After 6-12 months of active use, IndexedDB could exceed browser storage limits (Safari: 1GB default). Users receive a cryptic `QuotaExceededError` with no graceful degradation path.

**Recommendation:** Implement a `StorageManager` that: (1) monitors `navigator.storage.estimate()`, (2) prunes sessions older than 90 days, (3) evicts stale embeddings, (4) warns users at 80% quota.

---

## Finding 3: No Pagination in Zustand Stores

**Severity:** MEDIUM
**Category:** Performance / Architecture

All 22 Zustand stores load entire collections into memory. Zero stores implement pagination, cursor-based loading, or lazy fetching. `useCourseStore`, `useNoteStore`, `useAuthorStore`, `useQuizStore` all call `toArray()` on their respective Dexie tables, pulling everything into JavaScript heap.

**Impact:** With 500+ courses each having 20+ lessons, the initial `loadCourses()` call in `Layout.tsx` (line 207) blocks the critical rendering path. Combined with `useSessionStore`, `useBookmarkStore`, and `useContentProgressStore` all loading eagerly, the app initialization serializes 5+ IndexedDB reads before first paint.

**Recommendation:** Implement lazy loading with `useSWR` or `@tanstack/react-query` for Dexie reads. Load only visible items, fetch details on demand.

---

## Finding 4: 27 Dexie Schema Versions -- Migration Chain Fragility

**Severity:** HIGH
**Category:** Technical Debt

The schema file has 27 sequential `.version()` calls. Each version must execute in order for new users. If any migration has a subtle bug (and some have `upgrade()` functions that mutate data), the entire chain breaks silently -- Dexie does not throw on partially-applied migrations.

**Impact:**
- New users in 6 months will run through 27+ migrations on first load
- Testing all migration paths is combinatorially explosive
- A single corrupt migration (e.g., the v20 dedup issue from KI-003) can leave users in an unrecoverable state

**Recommendation:** Implement a migration checkpoint system. Every 10 versions, snapshot the expected schema state. For new installs, jump directly to latest checkpoint instead of replaying all migrations.

---

## Finding 5: Single ErrorBoundary at Root -- No Granular Recovery

**Severity:** MEDIUM
**Category:** UX / Resilience

The entire app has one `ErrorBoundary` in `App.tsx`. If any page component throws (e.g., a Dexie read fails, a malformed quiz attempt crashes the renderer), the entire UI crashes to a fallback screen.

**Impact:** A bug in the YouTube transcript parser takes down the Overview dashboard. A malformed note crashes the Settings page. There is no isolation between features.

**Recommendation:** Add route-level error boundaries. Each `SuspensePage` wrapper in `routes.tsx` should include an `ErrorBoundary` that shows "This section encountered an error" with a retry button, while keeping sidebar navigation functional.

---

## Finding 6: localStorage as Pseudo-Database (57 Occurrences)

**Severity:** MEDIUM
**Category:** Architecture / Data Integrity

There are 57 `localStorage.getItem/setItem` calls across 20 files. localStorage is used for: sidebar state, settings, study goals, reminders, dashboard order, pomodoro preferences, quiz preferences, engagement preferences, YouTube configuration, quota tracking, AI configuration, and more.

**Problems:**
- No schema or versioning for localStorage keys (unlike Dexie which has migrations)
- `JSON.parse` of corrupted/stale values causes silent failures (the sidebar migration code in Layout.tsx lines 249-269 is an example of this going wrong)
- Synchronous reads on the main thread
- 5MB limit shared across all localStorage users; no quota management
- Settings split arbitrarily between localStorage (`getSettings()`) and Dexie (courses, notes)

**Recommendation:** Consolidate all preferences into a single Dexie `preferences` table with typed keys and migration support. Keep only sidebar collapse state (trivially small) in localStorage.

---

## Finding 7: API Key Security -- Browser-Side Encryption is Theater

**Severity:** MEDIUM
**Category:** Security

API keys are encrypted with Web Crypto AES-GCM (`src/lib/aiConfiguration.ts`) and stored in localStorage. However, the encryption key is derived from the browser's `crypto.subtle` with no user password or hardware token. Anyone with access to the browser's dev tools can call `decryptData()` and retrieve the plaintext key.

Additionally:
- The AI proxy server (`server/index.ts`) accepts API keys in POST request bodies over HTTP (no TLS enforcement)
- Ollama URLs are validated against SSRF but the validation can be bypassed via DNS rebinding (hostname resolves to public IP initially, then to 127.0.0.1)
- YouTube API keys stored alongside Ollama credentials in the same localStorage blob

**Impact:** On shared computers, API keys are trivially extractable. The proxy server lacks TLS, meaning keys transit in plaintext on local networks.

**Recommendation:** (1) Enforce HTTPS on the proxy in production, (2) add rate limiting to the proxy per-IP, (3) document that browser-side encryption is obfuscation not security, (4) consider server-side key storage with Supabase Vault for authenticated users.

---

## Finding 8: God Components -- Settings.tsx at 1,169 Lines

**Severity:** MEDIUM
**Category:** Technical Debt / Maintainability

Three components exceed 500 lines:
- `Settings.tsx`: 1,169 lines (profile, appearance, AI config, quiz prefs, engagement, subscription, data export, account deletion, legal links)
- `LessonPlayer.tsx`: 1,075 lines (video player, keyboard shortcuts, notes panel, transcript, bookmarks, progress tracking)
- `LearningPathDetail.tsx`: 960 lines (path display, drag-drop editor, progress tracking, AI suggestions)

**Impact:** These files are merge-conflict magnets. Any story touching Settings risks breaking unrelated features. Testing is difficult because the component tree is deeply nested with many side effects.

**Recommendation:** Extract each Settings section into its own component (some already exist in `src/app/components/settings/` but Settings.tsx still orchestrates everything inline). LessonPlayer should be decomposed into PlayerControls, PlayerSidebar, PlayerKeyboardHandler.

---

## Finding 9: No Rate Limiting on Premium Feature Access

**Severity:** MEDIUM
**Category:** Security / Business Logic

The entitlement system (`src/lib/entitlement/isPremium.ts`) and `PremiumFeaturePage` wrapper gate features client-side. The cached entitlement has a TTL but:
- There is no server-side enforcement of premium features
- The AI proxy (`server/index.ts`) does not check subscription status before proxying LLM requests
- A user could modify `CachedEntitlement` in IndexedDB to grant themselves premium access indefinitely
- The `PREMIUM_BUILD` flag in `vite.config.premium.ts` suggests code-splitting but the free build still ships premium component code (just behind a UI gate)

**Impact:** Any technically competent user can bypass the paywall entirely. Premium AI features (course structuring, knowledge gaps, learning paths) consume API credits that the developer pays for.

**Recommendation:** Move entitlement checks server-side. The Supabase Edge Function or proxy server should validate the user's subscription before processing premium API calls.

---

## Finding 10: E2E Test Coverage Gaps -- Import Wizard Untestable

**Severity:** MEDIUM
**Category:** Testing

Per KI-010, the Import Wizard has zero E2E tests because `showDirectoryPicker()` cannot be automated in Playwright. This is the most critical user workflow (importing local courses is the app's core value proposition) and it has no automated UI coverage.

Additionally:
- Store test coverage is described as "critically low" in the retrospective context
- 189 unit test files vs 168 E2E spec files, but many E2E specs are smoke tests checking page loads rather than user flows
- No integration tests exist between stores (e.g., importing a course should update the session store, progress store, and course store atomically)

**Recommendation:** (1) Add a URL-based or drag-and-drop import path that can be E2E tested, (2) write cross-store integration tests for critical workflows, (3) measure store-level branch coverage and target 80%+.

---

## Finding 11: YouTube Transcript Pipeline -- Silent Failure Cascade

**Severity:** MEDIUM
**Category:** Resilience

The 3-tier transcript fallback (youtube-transcript -> yt-dlp -> Whisper) is architecturally sound but has failure modes:
- Tier 2 (yt-dlp) requires a server-side binary that most users will not have installed
- Tier 3 (Whisper) is Premium-only, so free users get no fallback beyond Tier 1
- If youtube-transcript fails (geo-restriction, age-gate, private video), free users see no transcript with no clear explanation of why
- The `youtubeTranscriptPipeline.ts` uses a `Result<T>` pattern but error messages are developer-oriented, not user-friendly

**Recommendation:** Surface clear user-facing messages: "Transcript unavailable for this video -- it may be geo-restricted or have no captions." Add a manual subtitle upload path as a user-controlled fallback.

---

## Finding 12: No Service Worker / PWA Offline Strategy for YouTube Courses

**Severity:** LOW
**Category:** Feature Gap

YouTube courses depend on YouTube's iframe player, which requires an internet connection. The app caches metadata in IndexedDB but cannot play videos offline. This is a fundamental limitation but it is not communicated to users.

**Impact:** Users see "cached" YouTube courses in their library but clicking play shows a blank iframe. The offline banner says "Some features may be limited" but does not specify which.

**Recommendation:** (1) Disable play buttons on YouTube courses when offline, (2) show an explicit "Online required" badge on YouTube course cards, (3) consider audio-only caching via yt-dlp for premium users.

---

## Finding 13: Competitive Feature Gaps

**Severity:** LOW
**Category:** Product Strategy

Compared to competitors (Coursera, Udemy, Anki, Obsidian):
- **No collaborative features**: No shared courses, study groups, or social learning
- **No mobile app**: Responsive web but no PWA install prompt, no push notifications on iOS
- **No spaced repetition visualization**: Flashcards exist but there is no forgetting curve graph
- **No content creation tools**: Users cannot create their own quizzes (only consume pre-built ones)
- **No LMS integration**: Cannot import from SCORM, xAPI, or LTI sources
- **No search across course content**: Search only covers notes and bookmarks, not video transcripts or PDF text

**Recommendation:** Prioritize user-created quizzes (high engagement, low implementation cost) and cross-content search (transcripts are already indexed for AI features, just need a search UI).

---

## Summary

| # | Finding | Severity | Category |
|---|---------|----------|----------|
| 1 | No list virtualization | HIGH | Performance |
| 2 | No IndexedDB data pruning | HIGH | Data Management |
| 3 | No pagination in stores | MEDIUM | Performance |
| 4 | 27 schema migrations fragile | HIGH | Technical Debt |
| 5 | Single root ErrorBoundary | MEDIUM | UX / Resilience |
| 6 | localStorage as pseudo-DB | MEDIUM | Architecture |
| 7 | API key encryption is theater | MEDIUM | Security |
| 8 | God components (1000+ lines) | MEDIUM | Maintainability |
| 9 | No server-side premium enforcement | MEDIUM | Security / Business |
| 10 | E2E gaps on import wizard | MEDIUM | Testing |
| 11 | YouTube transcript silent failures | MEDIUM | Resilience |
| 12 | No offline strategy for YouTube | LOW | Feature Gap |
| 13 | Competitive feature gaps | LOW | Product Strategy |

**Top 3 Risks:**
1. **IndexedDB growth without limits** -- will cause production crashes within 6-12 months for power users
2. **No list virtualization** -- performance degrades linearly with data volume, no ceiling
3. **27 migration versions with no checkpoint** -- new user onboarding becomes fragile and slow over time
