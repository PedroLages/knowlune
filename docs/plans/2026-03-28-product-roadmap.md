# Knowlune Product Roadmap — Strategic Exploration

> **Purpose:** Strategic exploration of 19 areas with implementation status tracking. Informs future epic planning.
>
> **Date:** 2026-03-28 | **Last Status Update:** 2026-03-28

---

## Table of Contents

1. [Supabase Data Sync](#1-supabase-data-sync)
2. [Authentication Refinement](#2-authentication-refinement)
3. [Standalone Desktop App](#3-standalone-desktop-app)
4. [CRUD & UX Gaps](#4-crud--ux-gaps)
5. [Repository Strategy](#5-repository-strategy)
6. [Video Storage & Offline Downloads](#6-video-storage--offline-downloads)
7. [Cloud Storage Integration](#7-cloud-storage-integration-google-drive-etc)
8. [Machine Learning](#8-machine-learning)
9. [Offline & Multi-Device Experience](#9-offline--multi-device-experience)
10. [Calendar Integration](#10-calendar-integration)
11. [Accessibility & Cognitive UX](#11-accessibility--cognitive-ux)
12. [PKM Export Pipeline](#12-pkm-export-pipeline)
13. [Knowledge Map & Decay Visualization](#13-knowledge-map--decay-visualization)
14. [AI Tutoring (Socratic Mode)](#14-ai-tutoring-socratic-mode)
15. [Notification System](#15-notification-system)
16. [Onboarding & UX Polish](#16-onboarding--ux-polish)
17. [UI Enhancement — Stitch Design Upgrades](#17-ui-enhancement--stitch-design-upgrades)
18. [User Flow Documentation & Live Design Audit](#18-user-flow-documentation--live-design-audit)
19. [Books & Audiobooks Library](#19-books--audiobooks-library)
20. [Cross-Cutting Dependencies](#20-cross-cutting-dependencies)
21. [Recommended Sequencing](#21-recommended-sequencing)

---

## Implementation Status Summary

> **Baseline:** 35 epics completed (E1-E35), ~200+ stories delivered.
> **Known issues:** ~~55+ failing tests~~ → All 3,429 unit tests passing (202 suites). KI-016 through KI-025 resolved.

| # | Area | Status | % | Key Evidence |
|---|------|--------|---|-------------|
| 1 | Supabase Data Sync | 🟡 Architecture Ready | 0% impl | E44-E49 planned (37 stories), readiness confirmed. Architecture: `docs/plans/sync-architecture.md` |
| 2 | Authentication Refinement | 🟡 Mostly Done | 90% | E19 complete. Password reset done (EmailPasswordForm.tsx). Missing: session expiry UI (E43-S04 story ready) |
| 3 | Standalone Desktop App | ⬜ Deferred | — | Explicitly deferred post-sync |
| 4 | CRUD & UX Gaps | 🟡 Partially Done | 70% | Missing: completion % (E43-S05 story ready), bulk ops, soft-delete, data import |
| 5 | Repository Strategy | 🟡 Infrastructure Done | 60% | `src/premium/` separated, repo split not done |
| 6 | Video Storage & Offline | 🟡 Infrastructure Done | 40% | Transcripts cached, no download UI |
| 7 | Cloud Storage | 🔴 Not Started | 5% | Only `exportService.ts` exists |
| 8 | Machine Learning | 🟡 Stories Ready | 50% | E9/E9B: embeddings, vector search, AI summaries. E52 hybrid scope ready (4 stories — simplified quiz + tag-based recs). Full 8-story scope deferred to Phase 2 after 2-week validation. Pending: FSRS |
| 9 | Offline & Multi-Device | 🟡 Infrastructure Done | 40% | Service worker + IDB, no sync status UI |
| 10 | Calendar Integration | 🟡 Stories Ready | 0% impl | E50 ready (6 stories, 31 AC). Stories amended with edge case findings (Cache-Control, Web Crypto, graceful degradation). Implementation priority: 2nd. |
| 11 | Accessibility & Cognitive UX | 🟡 Stories Ready | 70% | E30: WCAG 2.1 AA. E51 ready (4 stories, 23 AC). Stories amended with 6 HIGH edge cases (17 MotionConfig overrides, 5 confetti components, blocking script, animations toggle conflict). Implementation priority: 1st. |
| 12 | PKM Export Pipeline | 🟡 Stories Ready | 50% | E53 ready (3 stories, 20 AC). Flashcard/bookmark MD export + Anki .apkg. Edge case review: 44 findings (14 HIGH). Amended with WASM loading, HTML stripping, package fallback. |
| 13 | Knowledge Map & Decay | 🟡 Stories Ready | 0% impl | E56 ready (4 stories, 38 AC). Topic resolution + knowledge scoring + Recharts Treemap + dedicated page. Research + architecture + edge case review (35 findings) complete. |
| 14 | AI Tutoring (Socratic) | 🟡 Stories Ready | 0% impl | E57 ready (5 stories — 3 Phase 1 + 2 Phase 2). Tutor tab in LessonPlayer, slot-based prompts, hint ladder, Dexie v29 conversations. Research + architecture + edge case review (29 findings, 11 HIGH) complete. |
| 15 | Notification System | 🟡 Stories Ready | 30% | UI complete. Architecture decided: Dexie v28 + EventEmitter bus + 5 triggers. Stories E43-S06/S07 ready. |
| 16 | Onboarding & UX Polish | 🟡 Stories Ready | 90% | E25: onboarding. E54 ready (3 stories — lesson flow wiring). Auto-advance + checkmarks across all course types. |
| 17 | UI Enhancement (Stitch) | 🟡 Stories Ready | 0% impl | E55 ready (5 stories). Deep Focus Mode SVG timer widget + Streak Calendar month-view. Brainstorm + edge case review (37 findings) complete. |
| 18 | User Flows & Live Audit | 🔴 Not Started | 0% | 33 per-page flows + 10 cross-page journeys + style compliance. Plan: `docs/plans/user-flow-audit-plan.md` |
| 19 | Books & Audiobooks Library | ⬜ Future Exploration | — | EPUB reader, audiobook player, highlights, shelves. 5-8 epics. Plan: `docs/plans/2026-03-28-books-audiobooks-exploration.md` |

---

## 1. Supabase Data Sync

> **Status:** 🟡 Architecture Ready (0% implemented)
> **Completed:** Auth + entitlements (E19). Architecture designed, adversarial review passed, all decisions resolved, implementation readiness confirmed.
> **Epics:** E44-E49 (37 stories) — Phase 1: E44-E46 (18 stories), Phase 2: E47-E49 (19 stories, deferred until Phase 1 validated)
> **Architecture:** [`docs/plans/sync-architecture.md`](sync-architecture.md)
> **Epics breakdown:** [`_bmad-output/planning-artifacts/epics-sync.md`](../_bmad-output/planning-artifacts/epics-sync.md)
> **Adversarial review:** [`docs/reviews/adversarial/adversarial-review-2026-03-28-sync-architecture.md`](../reviews/adversarial/adversarial-review-2026-03-28-sync-architecture.md) — 14 findings, 4 HIGH resolved
> **Last Updated:** 2026-03-28

### Current State
- Auth + entitlements only (Epic 19)
- All user data in 27 IndexedDB tables (Dexie v27) — purely client-side
- Self-hosted Supabase on Unraid (titan.local / supabase.pedrolages.net)
- `exportService.ts` already serializes all tables to JSON/CSV — proves data is portable

### What Needs Syncing (by priority)

| Priority | Tables | Why |
|----------|--------|-----|
| P0 | `contentProgress`, `studySessions` | "Where was I?" — most valuable cross-device data |
| P1 | `notes`, `bookmarks`, `flashcards` | Study materials users actively create |
| P2 | `importedCourses`, `importedVideos`, `importedPdfs` | Course metadata (not the files themselves) |
| P3 | `learningPaths`, `learningPathEntries` | User-created learning journeys |
| P4 | Everything else (quizzes, embeddings, thumbnails, etc.) | Nice-to-have completeness |

### Approach Options

**A. Last-Write-Wins (LWW) for everything**
- Add `userId` + `updatedAt` + `syncedAt` columns to Supabase Postgres mirrors
- Compare timestamps on sync — latest write wins
- Supabase Realtime for push updates when online
- Pros: Simple, maps to existing `updatedAt` fields on 6+ tables
- Cons: Concurrent offline edits on different devices → earlier edit lost. Notes (Tiptap HTML) would lose entire content on conflict

**B. CRDT-based sync with Yjs**
- Already have Yjs dependency (`yjs: ^13.6.29`, `@tiptap/extension-collaboration`)
- Every document becomes a Yjs doc stored as binary in Supabase
- Pros: Perfect merge for notes, no data loss on concurrent edits
- Cons: Massive complexity, overkill for simple records (progress, bookmarks), storage bloat

**C. Hybrid — LWW for structured data, CRDT for notes only** ⭐ Recommended
- LWW for progress, bookmarks, sessions, flashcards, paths (simple records)
- Yjs CRDT for notes only (already supported via Tiptap collaboration extensions)
- Pros: Right tool for each data type, notes get merge safety, simple data stays simple
- Cons: Two sync mechanisms to maintain

### Key Design Decisions

- **Conflict UI:** When LWW detects a conflict, show "This was edited on another device — keep this version or the other?" (not silent overwrite)
- **Initial sync:** Reuse `exportService.ts` serialization for first full upload
- **RLS pattern:** `auth.uid() = user_id` on every Supabase table
- **Bandwidth:** Self-hosted on LAN — trivial. 10K study sessions ≈ 5MB. Realtime websockets are negligible on local network
- **Migration:** Add `userId` to all Dexie tables, backfill from auth store on first sync

### Effort: Large (3-4 epics)

---

## 2. Authentication Refinement

> **Status:** 🟡 Mostly Done (85%)
> **Completed:** Email/password, magic link, Google OAuth, JWT middleware, BYOK, GDPR deletion, profile sync (E19)
> **Remaining:** Password reset flow, session expiry UI
> **Blockers:** None
> **Last Updated:** 2026-03-28

### Current State (Already Built)
- Email/password, magic link, Google OAuth
- JWT middleware on Express proxy
- BYOK detection, entitlement checking, rate limiting
- GDPR account deletion with 7-day grace period
- Profile sync (displayName/bio) to Supabase user_metadata

### What's Actually Missing

| Gap | Severity | Effort |
|-----|----------|--------|
| **Password reset flow** — no "forgot password" link visible | Must-fix | Small |
| **Session expiry UI** — no handling when JWT expires mid-session | Must-fix | Small |
| **Apple Sign-In** — required for Mac App Store distribution | Conditional | Small |
| **GitHub OAuth** — easy to add but low value (learners ≠ developers) | Low | Tiny |
| **BYOK key sync** — API keys in browser localStorage, not synced | Nice-to-have | Small |
| **RBAC (roles)** — admin/instructor/student | Premature | Medium |

### Recommendation
- **Now:** Add password reset flow + session expiry handling (table stakes)
- **If desktop app:** Add Apple Sign-In (mandatory for App Store)
- **After data sync:** BYOK key sync to Supabase (encrypted)
- **Future:** RBAC only when multi-user features exist

### Effort: Small (1 epic for must-fixes)

---

## 3. Standalone Desktop App

> **Status:** ⬜ Deferred
> **Rationale:** PWA covers 90% of use cases. Web app not feature-complete yet. Revisit after data sync.
> **Last Updated:** 2026-03-28

### The Core Question
Should Knowlune become a native Mac app? What would it unlock?

### Arguments FOR a Desktop App

| Argument | Strength | Notes |
|----------|----------|-------|
| Bundle yt-dlp + Whisper locally | Strong | Eliminates Docker requirement for course creation |
| Persistent file system access | Strong | Current `directoryHandle`/`fileHandle` (File System Access API) expires across sessions, Chromium-only |
| Mac App Store distribution | Medium | Revenue channel, discoverability |
| Background processing | Medium | Sync, downloads, transcription while app is closed |
| Native UX (Dock, menu bar, notifications) | Low | PWA already handles most of this |

### Arguments AGAINST (for now)

| Argument | Strength | Notes |
|----------|----------|-------|
| PWA covers 90% of use cases | Strong | Already configured, works today, zero maintenance |
| Massive development effort | Strong | 6-8 epics for Tauri, maintaining two platforms |
| Web app isn't feature-complete yet | Strong | CRUD gaps, data sync, test debt — fix these first |
| Small user base | Medium | Premature optimization for distribution channels |

### Framework Comparison

| | Tauri | Electron | PWA (current) |
|---|---|---|---|
| Binary size | ~10-15MB + bundled tools | ~150MB+ | 0 (web) |
| RAM usage | ~50-100MB | ~200-400MB | Browser tab |
| Rendering engine | WKWebView (Safari) | Chromium | User's browser |
| Bundle yt-dlp/Whisper | Yes (Rust child process) | Yes (Node child process) | No |
| File system access | Full native | Full native | Limited (FSAA) |
| Auto-update | Built-in | Built-in | Service worker |
| Mac App Store | Yes | Difficult (Apple discourages) | No |
| Development effort | XLarge (Rust backend) | XLarge (familiar Node) | Done |

### Recommendation: Not yet — revisit after data sync

The PWA handles daily use well. Build a desktop app when:
1. User feedback shows Docker requirement blocks adoption
2. You want Mac App Store distribution
3. File System Access API limitations cause real complaints
4. Data sync is complete (desktop MUST sync with web)

**If building later: Tauri > Electron** — smaller binary, native macOS integration, can bundle yt-dlp/whisper.cpp as Rust child processes.

### Effort: XLarge (6-8 epics) — defer

---

## 4. CRUD & UX Gaps

> **Status:** 🟡 Partially Done (70%)
> **Completed:** Import (file/YouTube/bulk), edit metadata, delete courses, learning path CRUD, notes export, AI ordering
> **Remaining:** Completion % fix (hardcoded to 0), bulk delete, soft-delete/archive, data import/restore, Anki import
> **Blockers:** None — all tests passing
> **Last Updated:** 2026-03-28

### Current Inventory

#### Courses
| Feature | Status | Gap |
|---------|--------|-----|
| Import (file/YouTube/bulk) | ✅ Complete | — |
| Edit metadata | ✅ `EditCourseDialog.tsx` | — |
| Delete imported course | ✅ `removeImportedCourse()` | Single-delete only |
| Bulk delete | ❌ Missing | No batch operations |
| Archive/soft-delete | ❌ Missing | Hard delete only, no recovery |
| Completion % (imported) | ❌ Hardcoded to 0 | `contentProgress` exists but not aggregated |
| Catalog course editing | ❌ Read-only | Intentional? Or gap? |
| Course duplication | ❌ Missing | Can't clone a course to customize |
| Course sharing/export | ❌ Missing | Can't share a course structure with others |

#### Learning Paths
| Feature | Status | Gap |
|---------|--------|-----|
| Create/rename/delete | ✅ Complete | — |
| Add/remove/reorder courses | ✅ Complete | — |
| AI-powered ordering | ✅ `applyAIOrder()` | — |
| Path templates | ❌ Missing | Pre-built paths for common topics |
| Path sharing | ❌ Missing | Can't share paths with others |
| Path progress visualization | ❓ Partial | Exists but could be richer |
| Path discovery/browse | ❌ Missing | No way to discover community paths |

#### Notes & Study Materials
| Feature | Status | Gap |
|---------|--------|-----|
| Create/edit/delete notes | ✅ Complete | — |
| Rich text (Tiptap) | ✅ Complete | — |
| Export (JSON/CSV/MD) | ✅ `exportService.ts` | — |
| Import/restore | ❌ Missing | One-way only — can export but not import back |
| Note templates | ❌ Missing | — |
| Flashcard bulk import | ❌ Missing | No Anki CSV import |

#### Settings & Profile
| Feature | Status | Gap |
|---------|--------|-----|
| Display name/bio | ✅ Synced to Supabase | — |
| Avatar | ✅ Local only | Not synced (user_metadata 1MB limit) |
| Change password/email | ✅ Complete | — |
| Data export | ✅ Complete | — |
| Data import/restore | ❌ Missing | Critical gap for backup/restore |
| Notification preferences | ❌ Limited | — |
| Theme customization | ❌ Light/dark only | No accent colors, custom themes |

#### Code Health
| Issue | Count | Impact |
|-------|-------|--------|
| Failed unit tests | 67 | CI unreliable |
| ESLint warnings | 217 | Code quality drift |
| Low store coverage | Multiple stores <10% | Regressions undetected |

### Priority Ranking

1. **Fix test suite** — unreliable tests undermine everything else
2. **Imported course completion %** — broken feature, not missing feature
3. **Data import/restore** — users need backup recovery
4. **Soft-delete/archive** — safety net for accidental deletion
5. **Bulk operations** — quality-of-life improvement
6. **Templates & sharing** — community features (after data sync)

### Effort: Medium (2-3 epics for P1-P4)

---

## 5. Repository Strategy

> **Status:** 🟡 Infrastructure Done (60%)
> **Completed:** Premium code separation (`src/premium/`), separate build config, import guards, AGPL-3.0
> **Remaining:** Actual repo split, CI/CD for two repos
> **Blockers:** None — not urgent until external contributors or public premium launch
> **Last Updated:** 2026-03-28

### Current State
- Single public GitHub repo
- License: AGPL-3.0 (in `package.json`)
- Premium code already separated: `src/premium/` with `LicenseRef-LevelUp-Premium` headers
- `vite.config.premium.ts` builds premium bundle separately
- Import guard prevents core from depending on premium

### Options

**A. Core Open / Premium Closed** ⭐ Recommended
```
knowlune/           (public, AGPL-3.0)  — core app
knowlune-premium/   (private)           — premium features as npm package
```
- Pros: Clean licensing, community contributes to core, premium code stays private
- Cons: Two repos, cross-repo PRs awkward, CI doubles
- The infrastructure already exists (`src/premium/`, import guards, separate build config)

**B. Full Open with Feature Flags**
- Single repo, premium gated by entitlement checks at runtime
- Pros: Simplest, single CI
- Cons: Premium code visible (competitors see it), AGPL means forks can strip entitlement checks

**C. Business Source License (BSL)**
- Source-available but not commercially usable for N years
- Pros: Strongest protection
- Cons: Not true "open source", discourages contributors, license change requires all contributor consent

**D. Inner Source (monorepo with private packages)**
- Single repo, npm workspaces, some packages marked private
- Pros: Single repo convenience
- Cons: GitHub doesn't support per-directory visibility

### Recommendation: A (Core Open / Premium Closed)

The split is already architected. Extract `src/premium/` into a private repo, publish as a scoped npm package or git submodule. Core stays AGPL-3.0 (strong copyleft for self-hosted apps). Premium gets a proprietary license (already has `LicenseRef-LevelUp-Premium` headers).

**Don't rush this.** The single-repo setup works fine until you have external contributors or a public premium launch.

### Effort: Medium (1-2 epics, mostly CI/CD)

---

## 6. Video Storage & Offline Downloads

> **Status:** 🟡 Infrastructure Done (40%)
> **Completed:** YouTube transcript pipeline (E28), Whisper fallback, video playback, metadata caching
> **Remaining:** Progressive download cache, "download for offline" UI, storage quota management
> **Blockers:** None
> **Last Updated:** 2026-03-28

### The Problem Space

Currently, Knowlune handles video in three ways:
1. **YouTube embed** — streams via iframe, requires internet
2. **Local files** — accessed via File System Access API handles (expire across sessions, Chromium-only)
3. **Metadata only** — thumbnails cached in IndexedDB (`courseThumbnails`), transcripts cached (`youtubeTranscripts`)

No video content is stored or downloadable for offline viewing.

### Approach Options

**A. Progressive Download Cache (like Spotify/Netflix)**
- Download videos to browser Cache Storage or IndexedDB
- Stream when online, serve from cache when offline
- Auto-evict old content when storage quota approached
- Pros: Familiar UX pattern, works in PWA, no external storage needed
- Cons: Browser storage limits (varies: Chrome ~60% of disk, Safari ~1GB), large videos fill quota fast, no cross-device sharing
- Best for: YouTube courses where videos are streamable

**B. Local File Management (desktop app required)**
- Download videos to a user-specified folder on disk
- Index files in Dexie, serve via local file:// or custom protocol
- Pros: No storage limits, persistent, user controls location
- Cons: Requires desktop app (Tauri/Electron), not available in web/PWA
- Best for: Building a comprehensive offline library

**C. Cloud Storage as Media Backend (see section 7)**
- Store videos in user's Google Drive/iCloud/OneDrive
- Stream from cloud storage instead of YouTube
- Pros: User owns their data, survives YouTube takedowns, cross-device
- Cons: Complex API integrations, user needs sufficient cloud storage, bandwidth costs
- Best for: Permanent course archival

**D. Hybrid: Cache for web, Local files for desktop** ⭐ Recommended
- Web/PWA: Progressive cache for recently-watched content (auto-managed, quota-aware)
- Desktop app (future): Full local downloads to user-specified directory
- Cloud storage (optional): Sync local library to Google Drive as backup

### Key Design Decisions

- **What to cache first:** Transcripts > thumbnails > video (transcripts are tiny, videos are huge)
- **Storage quota management:** Monitor `navigator.storage.estimate()`, warn at 80%, auto-evict LRU content at 90%
- **Download UI:** Per-course "Make available offline" toggle, download progress indicator, storage usage dashboard in Settings
- **YouTube ToS consideration:** Downloading YouTube videos may violate ToS. The feature should focus on user-uploaded/imported content, with YouTube remaining stream-only

### Effort: Medium-Large (2-3 epics for web caching, more if desktop)

---

## 7. Cloud Storage Integration (Google Drive, etc.)

> **Status:** 🔴 Not Started (5%)
> **Completed:** `exportService.ts` serializes all tables to JSON/CSV (proves data is portable)
> **Remaining:** `.knowlune` portable bundle, Google Drive API, WebDAV
> **Blockers:** None — can start with export bundles immediately
> **Last Updated:** 2026-03-28

### Use Cases

| Use Case | Service | Value |
|----------|---------|-------|
| Course file backup | Google Drive, OneDrive, iCloud | Protect against data loss, YouTube takedowns |
| App data backup | Google Drive, Dropbox | Alternative to Supabase sync for privacy-conscious users |
| Cross-device file sharing | iCloud, Google Drive | Access course materials from any device |
| Course import from cloud | Google Drive, Dropbox | Import courses directly from cloud folders |

### Approach Options

**A. Google Drive API Integration**
- OAuth2 for Google Drive access
- Upload/download course files and app data exports
- Pros: Most popular cloud storage, well-documented API, familiar to users
- Cons: Google API quotas, OAuth complexity, Google may deprecate/change APIs

**B. Multi-Provider via rclone-style Abstraction**
- Abstract cloud storage behind a common interface
- Support Google Drive, OneDrive, Dropbox, S3, WebDAV
- Pros: User choice, future-proof
- Cons: Massive surface area, each provider has quirks, maintenance burden

**C. WebDAV Only (Self-Hosted Friendly)** ⭐ Interesting alternative
- WebDAV is a simple HTTP-based file protocol
- Nextcloud, Synology, ownCloud all support WebDAV natively
- Pros: Self-hosted friendly (matches Knowlune's Unraid ethos), simple protocol, no OAuth dance
- Cons: Less familiar to mainstream users, no Google Drive/iCloud support

**D. Export + Manual Sync (KISS approach)** ⭐ Recommended starting point
- Enhance existing export to produce a portable `.knowlune` bundle (ZIP with manifest)
- User manually saves to their cloud storage of choice
- Import restores from `.knowlune` bundle
- Pros: Zero API dependencies, works with any storage, ship fast
- Cons: Not automatic, requires user discipline

### Recommendation: D first, then A

Start with portable export/import bundles (`.knowlune` format). This solves the backup problem immediately with minimal effort. Then add Google Drive API integration as a premium feature for automated sync.

**The self-hosted angle:** Given your Unraid setup, WebDAV support (option C) is a natural fit and differentiator. Knowlune could be the learning platform that respects data sovereignty.

### Effort: Small (export bundles), Medium (Google Drive), Large (multi-provider)

---

## 8. Machine Learning

> **Status:** 🟡 Partially Done (50%)
> **Completed:** Ollama integration (E22), OpenAI embeddings (E9), vector search (E9B-S03), AI summaries, Q&A/RAG, knowledge gap detection, note organization, feature analytics
> **Remaining:** Auto-quiz generation, content-based recommendations, FSRS upgrade, on-device embeddings, knowledge graph
> **Blockers:** None — existing infrastructure supports phases 1-4
> **Last Updated:** 2026-03-28

### Current ML/AI State
- Ollama integration (local LLM via self-hosted server)
- OpenAI embeddings pipeline
- Vector search for semantic content discovery
- AI-powered course structuring (premium)
- AI-powered learning path ordering (`applyAIOrder()`)
- Vercel AI SDK for streaming completions

### ML Opportunity Areas

#### A. Personalized Learning (Adaptive Learning Engine)

**What it does:** Tracks how the user learns and adapts the experience.

| Feature | ML Technique | Complexity | Value |
|---------|-------------|------------|-------|
| Knowledge gap detection | Item Response Theory (IRT) from quiz results | Medium | High |
| Optimal study scheduling | Spaced repetition with ML-tuned intervals (SM-2 → ML) | Medium | High |
| Learning style profiling | Clustering on engagement patterns (video vs text vs quiz preference) | Medium | Medium |
| Study time prediction | Time-series forecasting on session data | Low | Low |
| Course difficulty estimation | Bayesian inference from completion rates + quiz scores | Medium | Medium |

**Key insight:** The spaced repetition system (Epic 20) already exists with flashcards. Upgrading from SM-2 to a neural scheduler (like FSRS — Free Spaced Repetition Scheduler) is a high-value, moderate-effort improvement that has been validated by Anki community research.

#### B. Content Understanding (AI-Powered Course Analysis)

**What it does:** Automatically extracts structure and meaning from course content.

| Feature | ML Technique | Complexity | Value |
|---------|-------------|------------|-------|
| Auto-generate quizzes from transcripts | LLM (Ollama/OpenAI) with structured output | Low | Very High |
| Lesson summarization | LLM with RAG over transcript chunks | Low | High |
| Key concept extraction | NER + LLM for domain-specific terms | Medium | High |
| Knowledge graph generation | Entity relationship extraction from transcripts | High | Medium |
| Prerequisite detection | Graph analysis on concept dependencies | High | Medium |
| Cross-course topic mapping | Embedding similarity across transcript chunks | Medium | High |

**Key insight:** Auto-quiz generation is the highest-value, lowest-effort ML feature. You already have transcripts (YouTube pipeline), embeddings (OpenAI pipeline), and LLM access (Ollama/AI proxy). The pipeline is: transcript → chunk → LLM prompt → structured quiz JSON → save to `quizzes` table. This could ship in 1-2 stories.

#### C. On-Device ML (Privacy-First)

**What it does:** Run ML models locally without cloud dependency.

| Technology | Use Case | Browser Support | Size |
|------------|----------|----------------|------|
| ONNX Runtime Web | Classification, embeddings | All modern browsers | 5-50MB per model |
| Transformers.js | NLP tasks (summarization, NER) | Chrome, Firefox, Safari | 50-500MB per model |
| TensorFlow.js | Custom models, transfer learning | All modern browsers | Varies |
| WebLLM (MLC) | Full LLM inference in browser | Chrome (WebGPU) | 1-4GB per model |
| CoreML (Tauri only) | Any ML task, optimized for Apple Silicon | macOS/iOS only | Varies |

**Key insight:** Transformers.js can run sentence-transformers models (like `all-MiniLM-L6-v2`, ~23MB) directly in the browser for embeddings. This would eliminate the OpenAI embeddings dependency for the vector search feature. Combined with WebLLM for local LLM inference, you could offer a fully offline AI experience.

**Trade-off:** On-device models are 10-100x slower than cloud APIs and require significant download on first use. Best as a fallback, not primary.

#### D. Recommendation Engine

**What it does:** Suggests what to study next.

| Approach | Technique | Data Needed |
|----------|-----------|-------------|
| Content-based filtering | Embedding similarity of completed vs available courses | Course embeddings (already have) |
| Collaborative filtering | "Users who studied X also studied Y" | Multi-user data (requires data sync + opt-in) |
| Knowledge-gap-driven | Recommend courses that fill gaps identified by quiz performance | Quiz results + course topic mapping |
| Schedule-aware | Recommend based on available time, difficulty, and learning goals | Study session patterns |

**Key insight:** Content-based recommendation is achievable NOW — you already have embeddings. "Because you completed [Course A], you might like [Course B]" using cosine similarity on existing embeddings.

### Recommended ML Roadmap

| Phase | Feature | Technique | Effort | Dependencies |
|-------|---------|-----------|--------|-------------|
| 1 | Auto-quiz generation | LLM structured output | Small | Transcripts exist |
| 2 | Content-based recommendations | Embedding similarity | Small | Embeddings exist |
| 3 | Smart spaced repetition (FSRS) | Neural scheduler | Medium | Flashcard system exists |
| 4 | Lesson summarization | LLM + RAG | Small | Transcripts + embeddings exist |
| 5 | Key concept extraction | NER + LLM | Medium | Transcripts exist |
| 6 | On-device embeddings | Transformers.js | Medium | Replace OpenAI dependency |
| 7 | Knowledge gap detection | IRT from quiz data | Medium | Quiz system + enough data |
| 8 | Knowledge graph | Entity extraction + graph | Large | Concept extraction (phase 5) |

### Effort: Phases 1-4 are Small (1 epic total), Phases 5-8 are Medium-Large (2-4 epics)

---

## 9. Offline & Multi-Device Experience

> **Status:** 🟡 Infrastructure Done (40%)
> **Completed:** Service worker + app shell caching, IndexedDB local-first (29 tables), offline notes/quiz/flashcards
> **Remaining:** Sync status indicator, "download for offline" toggles, offline mode banner, device-specific settings
> **Blockers:** Depends on data sync (Section 1) for status indicator
> **Last Updated:** 2026-03-28

> This section answers: "What should a Knowlune user be able to do without internet, and what should they see when switching between devices?"

### The Vision: Learn Anywhere, Continue Everywhere

The offline and multi-device experience ties together sections 1 (sync), 6 (storage), and 7 (cloud) into a coherent **user-facing promise**.

### What Should Work Offline (by platform)

| Feature | Web/PWA | Desktop (Tauri, future) | Mobile (future) |
|---------|---------|------------------------|-----------------|
| **Browse course library** | ✅ Cached metadata | ✅ Full local DB | ✅ Cached metadata |
| **Watch imported local videos** | ⚠️ FSAA handles expire | ✅ Persistent file access | ❌ No file access |
| **Watch YouTube videos** | ❌ Stream-only | ⚠️ If pre-downloaded | ❌ Stream-only |
| **Read transcripts** | ✅ Cached in IndexedDB | ✅ Local DB | ✅ Cached |
| **Read/edit notes** | ✅ Tiptap works offline | ✅ Full offline | ✅ If synced |
| **Review flashcards** | ✅ All in IndexedDB | ✅ Local DB | ✅ If synced |
| **Take quizzes** | ✅ All in IndexedDB | ✅ Local DB | ✅ If synced |
| **Track progress** | ✅ Writes to IndexedDB | ✅ Local DB | ✅ Queue for sync |
| **AI features (chat, summarize)** | ⚠️ Only with local Ollama | ✅ Bundled or Ollama | ❌ Cloud-only |
| **Search (vector)** | ⚠️ If embeddings cached | ✅ Local embeddings | ❌ Cloud-only |
| **Study streaks / analytics** | ✅ Local calculation | ✅ Local calculation | ✅ If synced |

**Key:** ✅ Works | ⚠️ Partial/conditional | ❌ Not available

### What Users Should See When Switching Devices

**Scenario: User studies on laptop, opens Knowlune on phone later**

| Data | Expected Behavior | Sync Mechanism |
|------|-------------------|----------------|
| Progress ("I'm on lesson 7 of 12") | Instantly reflected | Supabase Realtime (live) or batch (every 5 min) |
| Notes written during session | Available on other device | LWW sync (structured) or CRDT (rich text) |
| Flashcard review history | Spaced repetition intervals synced | LWW sync |
| Bookmarks | Appear on all devices | LWW sync |
| Study streak | Same streak count everywhere | Sync `studySessions` table |
| Course library | Same courses listed | Sync metadata (not video files) |
| Downloaded videos | NOT synced (device-local) | Each device manages its own downloads |
| AI chat history | Synced as conversation records | LWW sync |
| Settings/preferences | Same theme, layout, preferences | Supabase user_metadata (already partial) |

### Offline-First Architecture Principles

1. **Write locally first, sync later** — Never block user actions on network availability. All writes go to IndexedDB immediately. Sync happens in the background.

2. **Optimistic UI** — Show the action as completed before sync confirms it. If sync fails, show a non-blocking warning ("Changes saved locally, will sync when online").

3. **Conflict resolution hierarchy:**
   - Progress/sessions: Last-write-wins (conflicts are rare and low-stakes)
   - Notes: CRDT merge via Yjs (concurrent editing is possible)
   - Flashcard intervals: Latest review wins (spaced repetition is personal)
   - Settings: Last-write-wins with device-specific overrides (e.g., dark mode on phone, light on desktop)

4. **Sync status indicator** — Small icon in the header showing:
   - 🟢 Synced (all changes uploaded)
   - 🟡 Syncing (upload in progress)
   - 🔴 Offline (changes queued, will sync when online)
   - Users should never have to think about sync — but should be able to check if curious.

5. **Bandwidth-aware sync** — On mobile/metered connections: sync metadata only. On Wi-Fi/LAN: full sync including thumbnails and cached content.

### What Users Should NOT Expect Offline

Being explicit about limitations prevents frustration:

- **YouTube video playback** — requires internet (YouTube ToS, no local caching of their content)
- **AI features without local LLM** — cloud-dependent AI (OpenAI, Anthropic, Groq) needs internet. Only Ollama/on-device models work offline
- **Course import from URL** — fetching new content requires internet
- **Account management** — login, password change, billing require Supabase connectivity
- **Real-time collaboration** — if future multi-user features are added, they need internet

### Device-Specific Considerations

**Web/PWA (current platform):**
- Service worker caches app shell + static assets (already configured)
- IndexedDB stores all user data (already local-first)
- Gap: No explicit "offline mode" UI — app silently degrades. Should add offline indicator.
- Gap: No "download for offline" on course content (transcripts, thumbnails)

**Desktop (Tauri, future):**
- Full file system access — videos stored permanently, no quota limits
- Can run background sync even when app window is closed
- Can bundle Whisper/yt-dlp for offline course creation
- Can use CoreML for on-device ML on Apple Silicon

**Mobile (not yet planned):**
- Responsive web works on phone browsers today
- A dedicated mobile app (React Native or Capacitor) would unlock:
  - Push notifications for study reminders
  - Background audio playback (listen to lectures)
  - Offline downloads with platform-native storage management
- **Decision gate:** Only build native mobile after data sync is proven on web

### Implementation Phases

| Phase | What | Enables | Depends On |
|-------|------|---------|------------|
| 1 | Add sync status indicator to header | User awareness of sync state | Data sync (section 1) |
| 2 | "Download for offline" toggle on courses | Offline transcript/thumbnail access | PWA service worker enhancement |
| 3 | Offline mode banner ("You're offline — changes saved locally") | Clear UX when disconnected | Service worker offline detection |
| 4 | Device-specific settings (theme per device) | Personalized per-device experience | Data sync with device ID |
| 5 | Storage management dashboard in Settings | User controls over cached content | Storage quota monitoring |
| 6 | Background sync (desktop) | Seamless multi-device | Tauri app (section 3) |

### Effort: Spread across Waves 1-3 (mostly comes "for free" with data sync implementation)

---

## 10. Calendar Integration

> **Status:** 🟡 Stories Ready (0% impl)
> **Completed:** Research, brainstorming, UX design, spec, edge case review, readiness check. E50 epic: 6 stories, 31 AC, all amended with HIGH edge case findings.
> **Remaining:** Implementation (E50-S01 → S06). Google Calendar sync (Phase 3+), smart scheduling (Phase 4)
> **Stories:** [`docs/implementation-artifacts/stories/E50-S01..S06`](../implementation-artifacts/stories/) | **Epic:** [`epics-calendar.md`](../../_bmad-output/planning-artifacts/epics-calendar.md)
> **Blockers:** None for Phase 1-2. Phase 3+ needs Supabase auth for OAuth token storage
> **Implementation Priority:** 2nd (after E51 Accessibility)
> **Last Updated:** 2026-03-28

### The Problem Space

Knowlune tracks study sessions, streaks, and course deadlines — but none of this connects to the user's actual calendar. Users have to mentally juggle "when should I study?" with their real schedule. Calendar integration bridges this gap.

### What Calendar Integration Means for a Learning App

| Feature | Value | Complexity |
|---------|-------|------------|
| **Scheduled study blocks** — "Study React 6-7pm Tues/Thu" | Builds consistent habit, shows commitment on real calendar | Medium |
| **Deadline reminders** — "Course X module 3 due in 2 days" | Prevents falling behind on learning goals | Low |
| **Session logging** — Completed study sessions appear as calendar events | Visual proof of progress, motivation | Low |
| **Smart scheduling** — "Find 30 min this week for flashcard review" | AI-assisted time management | High |
| **Spaced repetition reminders** — "Review these flashcards today (FSRS scheduled)" | Prevents SRS decay, right-time notifications | Medium |
| **Exam/goal countdown** — "Certification exam in 14 days — you've covered 60%" | Pacing awareness | Low |

### Integration Approaches

**A. Google Calendar API (OAuth 2.0)** ⭐ Most users
- Read/write events via Google Calendar API v3
- OAuth 2.0 consent flow (requires Supabase auth first for token storage)
- Pros: Most people have Google Calendar, rich API, push notifications
- Cons: OAuth complexity, Google API review for production, requires internet

**B. Apple Calendar (CalDAV / EventKit)**
- Web: CalDAV protocol (standard, works with any CalDAV server)
- Desktop (Tauri): Native EventKit on macOS — full read/write access
- Pros: Privacy-focused users prefer it, no Google dependency
- Cons: CalDAV setup non-trivial, EventKit macOS-only

**C. iCal Feed (read-only, universal)** ⭐ Simplest starting point
- Generate an `.ics` feed URL that any calendar app can subscribe to
- Feed contains: upcoming study blocks, deadlines, SRS review reminders
- Pros: Works with ANY calendar (Google, Apple, Outlook, Fastmail), no OAuth, no API keys
- Cons: Read-only (calendar can't write back), polling delay (15-60 min), no two-way sync
- **This is the "wave 1" approach** — ship value fast, add two-way sync later

**D. CalDAV Server (self-hosted)** — for power users
- Knowlune acts as a CalDAV server, user connects any client
- Pros: Full control, works offline, self-hosted angle aligns with Knowlune ethos
- Cons: Complex implementation, maintaining CalDAV compliance

### Recommended Phased Approach

| Phase | What | How | Effort |
|-------|------|-----|--------|
| 1 | **iCal feed** — subscribe URL in Settings | Generate `.ics` from study schedule + deadlines | Small (1-2 stories) |
| 2 | **Study planner UI** — schedule blocks per course | In-app calendar view (could use existing Calendar component from shadcn) | Medium (3-4 stories) |
| 3 | **Google Calendar two-way sync** | OAuth 2.0, create/update events, read free/busy | Medium-Large (1 epic) |
| 4 | **Smart scheduling** — "Find time for this course" | Read free/busy slots, suggest study windows using ML | Large (depends on ML + calendar API) |

### Key Design Decisions

- **iCal feed first** — provides 80% of the value with 20% of the effort. User pastes a URL into their calendar app and gets study reminders. No OAuth, no API keys, no review process.
- **Study schedule data model** — needs a `studySchedule` table: `{ courseId, dayOfWeek, startTime, endTime, recurrence, reminderMinutes }`. This is useful even without calendar integration (in-app scheduling UI).
- **Privacy consideration** — iCal feed URLs should be unguessable (UUID-based) and revokable. User can regenerate the URL to invalidate old subscribers.
- **Timezone handling** — Store all times in UTC, convert to user's local timezone for display and iCal export. Use `Intl.DateTimeFormat` for detection.

### What This Looks Like in the App

**Settings → Calendar Integration:**
- Toggle: "Enable calendar sync"
- iCal feed URL with copy button
- Connected accounts (Google, future)
- Study schedule editor (weekly recurring blocks)

**Course detail page:**
- "Schedule study time" button → opens time picker, creates recurring block
- "Set deadline" for course completion → appears in calendar

**Overview dashboard:**
- "Today's study plan" widget showing scheduled blocks
- "Upcoming deadlines" timeline

### Effort: Phase 1-2 is E50 (6 stories ready), Phase 3+ deferred

---

## 11. Accessibility & Cognitive UX

> **Status:** 🟡 Stories Ready (70%)
> **Completed:** WCAG 2.1 AA architecture, 4.5:1 contrast, touch targets (E30-S01), ARIA labels (E30-S02), heading hierarchy (E30-S03), aria-expanded (E30-S04), aria-live (E30-S06). E51 planning complete: research, brainstorming, UX design, spec, edge case review, readiness check. Stories amended with 6 HIGH edge cases.
> **Remaining:** Implementation (E51-S01 → S04). Screen reader audit (Phase 3), WCAG 2.2 (Phase 5)
> **Stories:** [`docs/implementation-artifacts/stories/E51-S01..S04`](../implementation-artifacts/stories/) | **Epic:** [`epics-accessibility.md`](../../_bmad-output/planning-artifacts/epics-accessibility.md)
> **Blockers:** None
> **Implementation Priority:** 1st (smallest scope, no schema migration, highest readiness)
> **Last Updated:** 2026-03-28

### Current State

Knowlune already targets WCAG 2.1 AA (per styling.md): 4.5:1 contrast, keyboard navigation, semantic HTML, ARIA labels, 44x44px touch targets. But there's no explicit accessibility settings UI, no cognitive accessibility features, and no accessibility audit has been run.

### What's Missing

| Feature | Category | Impact | Effort |
|---------|----------|--------|--------|
| **Accessibility settings page** — centralized a11y controls | Infrastructure | High | Small |
| **Dyslexia-friendly font toggle** — Atkinson Hyperlegible (chosen over OpenDyslexic — better readability evidence, ~40KB lazy-loaded) | Cognitive | High | Tiny |
| **Content density control** — compact / comfortable / spacious | Cognitive | Medium | Small |
| **Reduced motion toggle** — respects `prefers-reduced-motion` + manual override | Motor/Vestibular | Medium | Tiny |
| **Reading mode** — adjustable line height, max-width, font size | Cognitive | High | Small |
| **Focus mode** — hide sidebar, header, distractions during study | Cognitive | Medium | Small |
| **Screen reader audit + fixes** — test with VoiceOver, fix landmark navigation | Visual | High | Medium |
| **Keyboard shortcut overlay** — show all shortcuts on `?` press | Motor | Medium | Small |
| **Auto-captions for uploaded videos** — Whisper already available | Auditory | High | Medium |
| **Color blind mode** — alternative color scheme that doesn't rely on hue alone | Visual | Medium | Small |
| **Text-to-speech for notes/transcripts** — Web Speech API | Visual/Cognitive | Medium | Small |
| **High contrast mode** — WCAG AAA (7:1 contrast) option | Visual | Medium | Small |

### WCAG 2.2 Gaps (published Oct 2023 — newer than current 2.1 target)

| Criterion | What | Status |
|-----------|------|--------|
| 2.4.11 Focus Appearance | Focus indicators must be ≥2px, sufficient contrast | Unknown — needs audit |
| 2.5.7 Dragging Movements | All drag actions must have non-drag alternative | Unknown — learning path reorder uses drag |
| 2.5.8 Target Size Minimum | 24x24px minimum (Knowlune targets 44x44px — likely passing) | Likely OK |

### Recommended Phased Approach

| Phase | What | Effort |
|-------|------|--------|
| 1 | **E51 (4 stories ready):** Settings infrastructure + Atkinson Hyperlegible font toggle + 3-state reduced motion + spacious density mode. Settings page and features combined into single phase. | Small (4 stories) |
| 2 | ~~**Settings page:** Centralized accessibility preferences~~ — merged into Phase 1 (E51-S01) | — |
| 3 | **Screen reader audit:** VoiceOver testing, fix landmarks, ARIA enhancements | Medium (1 epic) |
| 4 | **Reading mode + focus mode:** Distraction-free study experience | Small (3-4 stories) |
| 5 | **WCAG 2.2 compliance:** Full audit + fix pass | Medium (1 epic) |

### Design Considerations

- **Respect OS preferences first:** Read `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme` via CSS media queries. Then let users override in-app.
- **Don't hide accessibility:** Put the settings page in the main Settings nav, not buried. Label it "Display & Accessibility" (like iOS).
- **Store preferences in theme system:** Knowlune's CSS variable theme system (`theme.css`) is perfect for this — add `--font-family-reading`, `--content-max-width`, `--content-density` tokens.
- **Dyslexia font loading:** Load Atkinson Hyperlegible only when toggled (~40KB, lazy-loaded via `@fontsource/atkinson-hyperlegible`). Use `@font-face` with `font-display: swap`.

### Effort: Phase 1-2 are Small (1 epic), Full WCAG 2.2 is Medium (2 epics total)

---

## 12. PKM Export Pipeline

> **Status:** 🟡 Partially Done (50%)
> **Completed:** Data export JSON/CSV/MD (E11-S04), note export
> **Remaining:** YAML frontmatter Markdown, Anki `.apkg`, Obsidian vault export, Notion API, Readwise
> **Blockers:** None
> **Last Updated:** 2026-03-28

### The Problem Space

Learners don't just consume content — they build a personal knowledge base from it. Knowlune captures notes, flashcards, bookmarks, highlights, and transcripts, but this knowledge is locked inside the app. Users want to move their learning artifacts into their PKM tool of choice.

### The Ecosystem

| Tool | Format | Integration Method | User Base |
|------|--------|--------------------|-----------|
| **Obsidian** | Markdown files with YAML frontmatter | Write `.md` files to a folder, or use Obsidian URI scheme | Power users, developers |
| **Notion** | Markdown import, or Notion API | API for live sync, or Markdown for one-shot export | Broad, mainstream |
| **Anki** | `.apkg` (SQLite + media) or CSV | Generate `.apkg` for full fidelity, CSV for simplicity | SRS-focused learners |
| **Logseq** | Markdown with `[[backlinks]]` | Write Markdown files with Logseq-compatible syntax | Outliner-style PKM |
| **Readwise** | Readwise API | Push highlights/notes to Readwise for spaced review | Read-later + SRS users |
| **Generic** | Markdown, JSON, CSV | Already partially supported via `exportService.ts` | Everyone |

### What to Export

| Content Type | Export Format | Notes |
|-------------|--------------|-------|
| **Notes** (Tiptap rich text) | Markdown with YAML frontmatter | Include: title, course, date, tags. Convert Tiptap HTML → Markdown |
| **Flashcards** | Anki `.apkg`, CSV, or Markdown (Q/A pairs) | Include: deck name, tags, review history (for SRS import) |
| **Bookmarks** | Markdown list with timestamps + context | Group by course, include surrounding text |
| **Course outlines** | Markdown nested list or OPML | Lesson structure with completion status |
| **Transcripts** | Markdown with timestamps | Already have these — just format for PKM |
| **Highlights** (if added) | Markdown with source context | Readwise-compatible format |
| **Learning path** | Markdown ordered list with progress | Course links + completion % |

### Recommended Phased Approach

| Phase | What | Effort |
|-------|------|--------|
| 1 | **Enhanced Markdown export** — Notes, flashcards, bookmarks as `.md` with YAML frontmatter | Small (2-3 stories) |
| 2 | **Anki export** — Generate `.apkg` files from flashcard decks | Medium (2-3 stories) |
| 3 | **Obsidian vault export** — Batch export to a folder structure with `[[wikilinks]]` between concepts | Small (2 stories) |
| 4 | **Notion API integration** — Push notes/flashcards to a Notion database | Medium (1 epic) |
| 5 | **Readwise integration** — Push highlights to Readwise for spaced review | Small (1-2 stories) |

### Key Design Decisions

- **Export, not sync** — Start with one-shot export (user triggers manually). Bidirectional sync with Obsidian/Notion is 10x more complex and fragile. Export first, sync later (if ever).
- **YAML frontmatter is the standard:** Every exported `.md` file should have frontmatter with `title`, `date`, `source` (course name), `tags`, and `type` (note/flashcard/bookmark). This is what Obsidian, Logseq, and most PKM tools expect.
- **Tiptap → Markdown conversion:** Tiptap stores content as HTML. Use a library like `turndown` to convert to Markdown. Handle tables, code blocks, and images.
- **Anki `.apkg` format:** It's a renamed ZIP containing a SQLite database (`collection.anki2`) and media folder. Libraries like `anki-apkg-export` (npm) handle generation.

### What This Looks Like in the App

**Settings → Export → PKM Export:**
- "Export to Obsidian" → generates a folder of `.md` files, downloads as ZIP
- "Export flashcards to Anki" → generates `.apkg` file
- "Export to Notion" → OAuth flow, push to Notion database
- Per-course: "Export notes for this course" (context menu)

### Effort: Phases 1-3 are Small (1 epic), Full ecosystem is Medium (2 epics)

---

## 13. Knowledge Map & Decay Visualization

> **Status:** 🔴 Not Started (0%)
> **Completed:** Data sources exist: quiz scores, flashcard retention, study sessions, content progress
> **Remaining:** Knowledge score calculation, dashboard heatmap, decay predictions, action suggestions, concept graph
> **Blockers:** Phase 3 needs FSRS upgrade (Wave 2)
> **Last Updated:** 2026-03-28

### The Problem Space

Knowlune tracks progress (lessons completed, courses finished), but doesn't answer the deeper question: **"What do I actually know right now?"**

A knowledge map visualizes the user's understanding across all their learning — what's strong, what's fading, what has gaps. This turns Knowlune from a "course tracker" into a "learning intelligence dashboard."

### What This Looks Like

```
                    ┌──────────────────┐
                    │   KNOWLEDGE MAP  │
                    └──────────────────┘

   React ████████████░░  78% strong     TypeScript ██████░░░░░░  50% fading ⚠️
   CSS    ██████████████  95% strong     Node.js    ████░░░░░░░░  33% fading ⚠️
   SQL    ██████████░░░░  70% strong     Docker     ██░░░░░░░░░░  15% weak 🔴
   Git    ████████████░░  80% strong     AWS        ░░░░░░░░░░░░   0% not started
```

### Data Sources for Knowledge Estimation

| Signal | What it tells us | Already available? |
|--------|------------------|--------------------|
| **Quiz scores** | Direct measurement of understanding | ✅ `quizAttempts` table |
| **Flashcard retention** | Spaced repetition performance (recall %) | ✅ `flashcards` table (reviewCount, lastReviewed) |
| **Lesson completion** | Exposure (not mastery) | ✅ `contentProgress` table |
| **Time spent per topic** | Engagement depth | ✅ `studySessions` table |
| **Days since last engagement** | Decay estimation (Ebbinghaus) | ✅ Calculable from timestamps |
| **Self-assessment** | User confidence (calibration metric) | ❌ Not implemented |
| **AI-generated concept tags** | Topic granularity beyond course-level | ⚠️ Partially (embeddings exist, concept extraction not yet) |

### Knowledge Decay Model

Use the **Ebbinghaus forgetting curve** as a baseline, adjusted by:
- **Quiz performance:** Higher scores → slower decay
- **Review frequency:** More reviews → slower decay (FSRS already models this)
- **Content type:** Procedural knowledge (coding) decays slower than declarative (facts)
- **Recency:** Last engagement date is the primary decay driver

**Simplified formula:**
```
knowledge_strength = base_score × retention_factor × recency_factor

where:
  base_score = weighted average of quiz scores + completion %
  retention_factor = FSRS stability estimate (if flashcards exist for this topic)
  recency_factor = e^(-days_since_last_engagement / half_life)
  half_life = adjusted by review count and quiz performance
```

### Visualization Options

**A. Topic Heatmap** ⭐ Recommended starting point
- Grid of topic cards, colored by knowledge strength (green → yellow → red)
- Click to drill into specific concepts within a topic
- Simple, intuitive, works on all screen sizes

**B. Radial Knowledge Graph**
- Spider/radar chart with topics as axes
- Filled area shows knowledge coverage
- Visually striking but hard to read with many topics

**C. Tree Map**
- Topics as rectangles sized by time invested, colored by retention
- Shows both effort and current state
- Good for "where did my time go?" analysis

**D. Timeline + Decay Curves**
- Per-topic line chart showing knowledge over time
- Predicted future decay shown as dotted line
- "If you don't review TypeScript by Friday, you'll drop below 50%"

### What Actions the Map Drives

The map isn't just pretty — it should **drive behavior:**

- "TypeScript is fading → Review these 5 flashcards" (direct link to SRS session)
- "You haven't touched Docker in 45 days → Here's a 10-min refresher quiz"
- "React knowledge is strong → Ready for advanced topics?" (recommendation)
- "Knowledge gap: You know React but not testing → Suggested course"

### Recommended Phased Approach

| Phase | What | Depends On | Effort |
|-------|------|------------|--------|
| 1 | **Topic-level knowledge score** — calculate from existing data (quiz + completion + recency) | Nothing — uses existing tables | Small (2-3 stories) |
| 2 | **Knowledge dashboard widget** — heatmap on Overview page | Phase 1 | Small (2-3 stories) |
| 3 | **Decay predictions** — "You'll forget X by date Y" | FSRS upgrade (Wave 2) | Medium (3-4 stories) |
| 4 | **Action suggestions** — "Review these flashcards" / "Take this refresher quiz" | Phases 1-3 + AI recommendations | Medium (1 epic) |
| 5 | **Full knowledge graph** — concept-level (not just course-level) | ML concept extraction (section 8, phase 5) | Large (1-2 epics) |

### Effort: Phases 1-2 are Small (1 epic), Full system is Large (3 epics across Waves 2-4)

---

## 14. AI Tutoring (Socratic Mode)

> **Status:** 🔴 Not Started (0%)
> **Completed:** LLM access (Ollama/OpenAI/Groq), streaming completions, course transcripts, embeddings + vector search
> **Remaining:** Lesson-aware context injection, Socratic prompting, RAG-grounded answers, learner profile, conversation memory, tutoring modes
> **Blockers:** Phase 4 needs knowledge map (Section 13 phase 1)
> **Last Updated:** 2026-03-28

### The Problem Space

Section 8 (ML) covers auto-quiz generation, recommendations, and content analysis — but not **interactive tutoring**. The highest-value AI experience in learning is a tutor that:
- Knows what you're studying right now
- Knows what you've struggled with before
- Guides you to the answer instead of giving it

This is what Khan Academy's Khanmigo does, and it's rapidly becoming a user expectation for any learning platform with AI features.

### Current AI State in Knowlune

| Feature | Status | Gap |
|---------|--------|-----|
| LLM access (Ollama/OpenAI/Groq) | ✅ via AI proxy + Vercel AI SDK | — |
| Streaming completions | ✅ Configured | — |
| Course transcripts | ✅ YouTube + Whisper pipeline | — |
| Embeddings + vector search | ✅ OpenAI embeddings + semantic search | — |
| Per-lesson context | ❌ AI doesn't know which lesson you're on | Gap |
| Learner history awareness | ❌ AI doesn't know your quiz scores/weak areas | Gap |
| Socratic prompting | ❌ AI gives direct answers | Gap |
| Conversation memory | ❌ Each AI chat is stateless | Gap |

### What Socratic Tutoring Looks Like

**User is watching a React hooks lesson and asks: "I don't understand useEffect cleanup"**

❌ **Current (generic chatbot):**
> "useEffect cleanup runs when the component unmounts or before the effect re-runs. You return a function from useEffect..."

✅ **Socratic tutor:**
> "Good question! Let's work through this. You learned about useEffect in the previous lesson — do you remember what happens when the dependency array changes?"
>
> *[User responds]*
>
> "Right! The effect re-runs. Now, imagine you set up a `setInterval` in your effect. What would happen if the effect re-runs without cleaning up the old interval?"
>
> *[User responds]*
>
> "Exactly — you'd have TWO intervals running! That's why cleanup exists. Can you write the cleanup function for a `setInterval` effect?"

### Key Design Decisions

**System prompt architecture:**
```
You are a learning tutor for {user.displayName}.

CURRENT CONTEXT:
- Course: {currentCourse.title}
- Lesson: {currentLesson.title} ({currentLesson.orderIndex}/{totalLessons})
- Transcript excerpt: {relevantTranscriptChunk}

LEARNER PROFILE:
- Topics mastered: {topicsMastered}
- Recent struggles: {recentQuizFailures}
- Learning style: {preferredExplanationDepth}

BEHAVIOR:
- Use Socratic method: ask guiding questions before giving answers
- Reference the current lesson content when relevant
- If the student is stuck after 2 hints, provide a direct explanation
- Adjust complexity to match the learner's demonstrated level
```

**Tutoring modes (user-selectable):**

| Mode | Behavior | Best For |
|------|----------|----------|
| **Socratic** (default) | Guide with questions, hints before answers | Deep understanding |
| **Explain** | Direct, clear explanation with examples | Quick clarification |
| **ELI5** | Simplify to fundamentals, use analogies | New concepts |
| **Quiz me** | Generate questions, check answers, explain mistakes | Active recall |
| **Debug my thinking** | User explains their understanding, tutor identifies gaps | Misconception detection |

### Conversation Memory

- Store conversations in a `tutorConversations` table: `{ id, courseId, lessonId, messages[], createdAt }`
- Load relevant past conversations when returning to a topic
- "Last time we discussed useEffect, you were confused about dependency arrays. Want to review that?"
- Conversations sync via data sync (section 1) for multi-device continuity

### RAG for Lesson-Aware Answers

The tutor should answer from the **course content**, not generic knowledge:

1. User asks a question
2. Embed the question → vector search against transcript chunks for current course
3. Include top 3 relevant chunks in the LLM prompt as context
4. LLM generates answer grounded in what the course actually teaches

This prevents the AI from contradicting the course material or teaching concepts the user hasn't been introduced to yet.

### Recommended Phased Approach

| Phase | What | Depends On | Effort |
|-------|------|------------|--------|
| 1 | **Lesson-aware AI chat** — inject current course/lesson context into system prompt | Nothing new — existing AI + course data | Small (2-3 stories) |
| 2 | **Socratic mode** — system prompt engineering for guided questioning | Phase 1 | Small (1-2 stories) |
| 3 | **RAG-grounded answers** — vector search transcript chunks for current course | Existing embeddings pipeline | Medium (3-4 stories) |
| 4 | **Learner profile injection** — quiz history, weak areas, knowledge score in system prompt | Knowledge map (section 13, phase 1) | Small (2 stories) |
| 5 | **Conversation memory** — persist tutor chats, reference past discussions | New table + optional sync | Medium (3-4 stories) |
| 6 | **Tutoring modes** — ELI5, Quiz Me, Debug My Thinking | Phase 2 | Small (2-3 stories) |

### Effort: Phases 1-2 are Small (part of ML epic), Full system is Medium (2 epics)

---

## 15. Notification System

> **Status:** 🟡 UI Done, Data Missing (30%)
> **Completed:** Popover UI, 6 notification types, icon mapping, read/unread state, "Mark all read" (NotificationCenter.tsx)
> **Remaining:** `notifications` Dexie table, trigger logic, persistence, preferences UI, push notifications, email digest
> **Blockers:** None — data layer replaces existing `createMockNotifications()` hardcoded data
> **Last Updated:** 2026-03-28

### Current State

The notification bell UI already exists in [NotificationCenter.tsx](src/app/components/figma/NotificationCenter.tsx) with:
- Popover with bell icon + unread badge count
- 6 notification types: `achievement`, `streak`, `recommendation`, `reminder`, `new-content`, `course-complete`
- Icon mapping, color coding, relative timestamps, read/unread state
- "Mark all as read" button
- **But:** All data is hardcoded mock (`createMockNotifications()` at line 69). There's a TODO: "Replace with real notification data source (store or API)"

### What's Missing

| Layer | Status | What Needs Building |
|-------|--------|-------------------|
| **UI shell** | ✅ Done | Popover, icons, read/unread — already built |
| **Data model** | ❌ Missing | `notifications` table in Dexie schema |
| **Notification triggers** | ❌ Missing | Logic that creates notifications from app events |
| **Persistence** | ❌ Missing | Store in IndexedDB, sync via Supabase (later) |
| **Preferences** | ❌ Missing | Per-type enable/disable in Settings |
| **Push notifications** | ❌ Missing | PWA push via Service Worker, or native (desktop) |
| **Email digest** | ❌ Missing | Requires Supabase Edge Functions + email provider |

### Notification Triggers (What Generates Them)

| Trigger | Type | When | Data Source |
|---------|------|------|-------------|
| **Streak milestone** | `streak` | 7, 14, 30, 60, 100 day streaks | `studySessions` table |
| **Streak at risk** | `streak` | No session today and streak > 3 days | `studySessions` + current time |
| **Achievement unlocked** | `achievement` | Badge criteria met (5 lessons/day, first quiz 100%, etc.) | Achievement engine (existing) |
| **Course completed** | `course-complete` | All lessons in a course marked done | `contentProgress` table |
| **SRS cards due** | `reminder` | Flashcards due today (FSRS schedule) | `flashcards` table (nextReviewDate) |
| **Study reminder** | `reminder` | Scheduled study block approaching (calendar phase 2) | `studySchedule` table |
| **Knowledge decay alert** | `recommendation` | Topic drops below threshold (knowledge map phase 3) | Knowledge score calculation |
| **Course recommendation** | `recommendation` | New recommendation generated | ML recommendation engine |
| **Import finished** | `new-content` | Course import completes (can take minutes for YouTube) | Import pipeline events |
| **Quiz results** | `achievement` | Quiz completed — show score + improvement | `quizAttempts` table |

### Architecture

```
┌─────────────────────────────────┐
│  Notification Triggers          │
│  (streak, SRS, import, etc.)    │
└──────────────┬──────────────────┘
               │ creates
               ▼
┌─────────────────────────────────┐
│  notifications table (Dexie)    │
│  { id, type, title, message,    │
│    timestamp, read, dismissed,  │
│    actionUrl?, metadata? }      │
└──────────────┬──────────────────┘
               │ reads
               ▼
┌─────────────────────────────────┐      ┌──────────────────┐
│  useNotificationStore (Zustand) │─────▶│ NotificationCenter│
│  unreadCount, notifications,    │      │ (existing UI)     │
│  markRead(), dismiss()          │      └──────────────────┘
└──────────────┬──────────────────┘
               │ optional
               ▼
┌─────────────────────────────────┐
│  Push / Email (future)          │
│  Service Worker push API        │
│  Supabase Edge Functions        │
└─────────────────────────────────┘
```

### Notification Preferences (Settings UI)

**Settings → Notifications:**

| Setting | Default | Notes |
|---------|---------|-------|
| Enable notifications | On | Master toggle |
| Streak milestones | On | 7, 14, 30, 60, 100 day celebrations |
| Streak at risk warnings | On | "Your streak expires in 3 hours!" |
| Study reminders | On | From scheduled study blocks (calendar) |
| SRS due cards | On | "12 flashcards due today" |
| Knowledge decay alerts | Off | Can be noisy — opt-in |
| Course recommendations | On | Weekly, not per-recommendation |
| Achievement unlocks | On | Badges, milestones |
| Import completion | On | Useful for long YouTube imports |
| Quiet hours | Off | e.g., no notifications 10pm-8am |
| Push notifications (PWA) | Off | Requires explicit browser permission |

### Key Design Decisions

- **In-app first, push later.** The existing popover UI is the primary channel. Push notifications (PWA Service Worker) are opt-in and come in a later phase. Email digest is the furthest out.
- **Don't over-notify.** Learning apps that spam notifications lose users. Rate limit: max 5 notifications per day for low-priority types. High-priority (streak at risk) always shows.
- **Actionable notifications.** Every notification should link to something: "12 cards due" → opens flashcard review. "Streak at risk" → opens any lesson. "Course complete" → shows certificate/next course.
- **Batch similar notifications.** "3 achievements unlocked today" instead of 3 separate notifications. Group by type within a time window.
- **Notification lifecycle:** Created → Unread → Read → Dismissed. Auto-dismiss after 30 days. Don't accumulate forever.

### Recommended Phased Approach

| Phase | What | Depends On | Effort |
|-------|------|------------|--------|
| 1 | **Data model + store** — `notifications` table, `useNotificationStore`, wire to existing UI | Nothing — replaces mock data | Small (2-3 stories) |
| 2 | **Core triggers** — streak milestones/warnings, course completion, import finished | Phase 1 | Small (2-3 stories) |
| 3 | **SRS + study reminders** — flashcard due notifications, scheduled study block alerts | FSRS (Wave 2) + Calendar (section 10) | Small (2 stories) |
| 4 | **Preferences UI** — per-type toggles in Settings, quiet hours | Phase 2 | Small (2 stories) |
| 5 | **Smart triggers** — knowledge decay alerts, course recommendations | Knowledge Map (section 13) + ML recommendations | Medium (3-4 stories) |
| 6 | **Push notifications** — PWA Service Worker push, browser permission flow | Phase 4 | Medium (3-4 stories) |
| 7 | **Email digest** — weekly summary email via Supabase Edge Functions | Supabase sync (section 1) + email provider | Medium (1 epic) |

### Effort: Phases 1-2 are Small (1 epic), Full system including push + email is Medium (2 epics)

---

## 16. Onboarding & UX Polish

> **Status:** 🟢 Mostly Done (90%)
> **Completed:** 4-step onboarding flow (E25-S07), empty state guidance (E25-S09), progressive sidebar (E25-S08)
> **Remaining:** Polish iterations based on user feedback, accessibility audit of onboarding
> **Blockers:** None
> **Last Updated:** 2026-03-28

> Surfaced by the [Interactive App Audit (2026-03-28)](../reviews/design/app-visual-audit-2026-03-28.md). These are cross-cutting UX gaps that don't fit cleanly into any single technical area.

### The Problem Space

The app audit revealed that Knowlune has strong features but **new users land in a confusing state**: all stats at zero, no guidance, mock notification data, empty pages with minimal explanation. The app assumes users already know what to do. This is a "last mile" problem — the features exist but the experience of discovering and using them needs work.

### What Needs Building

| Feature | Problem It Solves | Effort |
|---------|-------------------|--------|
| **First-run onboarding checklist** | New users see all zeros and no guidance. A "Getting Started" widget guides: import course → start lesson → take note → set goal | Small (2-3 stories) |
| **Empty state design system** | 6+ pages show minimal empty states. Reusable component with illustration, explanation, CTA, and optional preview | Small (2-3 stories) |
| **Next Lesson CTA** | After finishing a video, user must manually find next lesson. Add "Up Next: [Lesson Name]" button | Tiny (1 story) |
| **Lesson completion checkmarks** | Course sidebar shows lessons with durations but no completion indicators | Tiny (1 story) |
| **Settings section navigation** | 15+ sections in one scrollable page. Add tabs or sidebar nav | Small (2 stories) |
| **Sign Up clarity** | Login form only says "Sign in" — new users don't know they can create an account. Add "Don't have an account? Sign up" | Tiny (1 story) |
| **Course ID → title display** | Session History and Career Path detail show raw IDs ("authority") instead of full course titles | Tiny (1 story) |
| **Reports data aggregation fix** | Reports shows empty state despite existing session data. Stats aren't aggregating from existing records | Small (2-3 stories) |
| **Pricing/plan comparison** | Premium gates say "Upgrade" with no pricing info. Add plan comparison page or in-gate comparison | Small (2 stories) |

### Recommended Phased Approach

| Phase | What | Effort |
|-------|------|--------|
| 1 | **Quick bug fixes** — Course ID display, sign up link, password validation timing | Tiny (1-2 stories) |
| 2 | **Onboarding checklist** — "Getting Started" widget on Overview, auto-dismisses after user completes steps | Small (2-3 stories) |
| 3 | **Empty state component** — Create reusable component, apply to Learning Paths, Challenges, Notes, Reports, Bookmarks | Small (2-3 stories) |
| 4 | **Lesson flow improvements** — Next Lesson CTA, completion checkmarks, progress indicators | Small (2-3 stories) |
| 5 | **Settings UX** — Section navigation, settings search | Small (2 stories) |
| 6 | **Reports fix** — Ensure analytics aggregate from all data sources | Small (2-3 stories) |

### Effort: Small (1 epic for phases 1-4, most items are tiny fixes)

---

## 17. UI Enhancement — Stitch Design Upgrades

> **Status:** 🔴 Not Started (0%)
> **Source:** [`docs/plans/2026-03-28-stitch-design-exploration.md`](2026-03-28-stitch-design-exploration.md)
> **Completed:** Full design exploration — 12-page catalog (50+ concepts), 5 implementation-ready focus pages
> **Remaining:** All implementation
> **Blockers:** None — all upgrades are visual layer changes on existing data infrastructure
> **Last Updated:** 2026-03-28

### Design Assets

| Asset | Location | Content |
|-------|----------|---------|
| **12-page design catalog** | [`docs/plans/stitch-designs/index.html`](stitch-designs/index.html) (~260KB) | Full catalog: 12 pages × 4-5 variations = ~50 design concepts |
| **5 focus pages** | [`docs/plans/stitch-designs/focus/index.html`](stitch-designs/focus/index.html) (~112KB) | Implementation-ready: current vs proposed, variations, component close-ups |
| **Exploration doc** | [`docs/plans/2026-03-28-stitch-design-exploration.md`](2026-03-28-stitch-design-exploration.md) | Analysis, widget candidates, design principles, priority ranking |

### Full Catalog — 12 Pages

| # | Page | Knowlune Target | Readiness | Potential |
|---|------|----------------|-----------|-----------|
| 01 | Charts & Data Visualization | Reports page, analytics dashboard | Explore | Sparklines, gradient area charts, dark mode variants |
| 02 | Radar & Skill Maps | Knowledge Map (Section 13) | Explore | Radar chart for skill proficiency across course categories |
| 03 | **Progress Indicators** | Course cards, Overview | **Focus page ready** | Segmented chapter bars, milestone bars, hero metrics |
| 04 | **Activity Visualizations** | Overview dashboard | **Focus page ready** | Streak calendar, activity timeline, heatmaps |
| 05 | Course Cards & Grids | Courses page, My Class | Explore | Thumbnail grids, bento layout, list views, state variants |
| 06 | Dashboard Widgets | Overview page | Explore | KPI strips, goal trackers, study schedule widgets |
| 07 | **Learning Path Visualizations** | Learning Path Detail | **Focus page ready** | Vertical timeline, roadmap, node graph alternatives |
| 08 | Quiz & Flashcard UI | Flashcard review, quiz taking | Explore | Flip cards, timed challenges, score displays, split views |
| 09 | Media Player Layouts | Lesson Player | Explore | Cinema mode, split panel with transcript, PiP |
| 10 | Dialogs & Forms | Import wizard, Settings | Explore | Wizard improvements, sheet patterns, inline editing |
| 11 | **Gamification & Engagement** | Overview, Pomodoro | **Focus page ready** | Badges, XP/levels, celebrations, deep focus mode |
| 12 | Landing Page Sections | Public-facing marketing | Explore | Hero variants, feature bento, comparison cards, CTAs |

### Phase 1: Implementation-Ready Widgets (5 focus pages)

| # | Widget | Current Component | Stitch Upgrade | Focus Page | Effort |
|---|--------|------------------|----------------|------------|--------|
| 1 | **Deep Focus Mode** | `PomodoroTimer.tsx` | Large SVG ring, session counter, "Today's Focus Stats" card | `focus/deep-focus-mode.html` | Medium (2-3 stories) |
| 2 | **Streak Calendar** | `StudyStreakCalendar.tsx` | Month-view mode, large streak header, trophy badge | `focus/streak-calendar.html` | Small (1-2 stories) |
| 3 | **Activity Timeline** | `RecentActivity.tsx` | Vertical timeline, typed icons, day grouping | `focus/activity-timeline.html` | Small (2-3 stories) |
| 4 | **Learning Path Timeline** | `TrailMap.tsx` | Clean vertical timeline as alternative view | `focus/learning-path-timeline.html` | Small (2 stories) |
| 5 | **Progress Composites** | `ProgressRing.tsx`, `StatsCard.tsx` | Segmented chapter bar, metrics strip, richer cards | `focus/progress-composites.html` | Medium (3-4 stories) |

### Phase 2: Exploration Candidates (7 remaining catalog pages)

These pages have design ideas worth exploring but need a focus-page treatment before implementation:

| Page | Opportunity | When to Explore | Synergy |
|------|------------|-----------------|---------|
| 01 Charts & Data Viz | Upgrade Reports page with gradient charts, sparklines | When fixing Reports data aggregation (Section 4) | Wave 1 Reports fix |
| 02 Radar & Skill Maps | Skill radar for knowledge map visualization | When building Knowledge Map (Section 13) | Wave 2 Knowledge Map |
| 05 Course Cards & Grids | Richer course card layouts, bento grid option | When doing CRUD/UX polish (Section 4) | Wave 1 CRUD gaps |
| 06 Dashboard Widgets | KPI strip, goal tracker, study schedule for Overview | When adding calendar/scheduling (Section 10) | Wave 1 Calendar |
| 08 Quiz & Flashcard UI | Flip card animation, timed challenges, score display | When upgrading to FSRS (Section 8) | Wave 2 ML |
| 09 Media Player Layouts | Split panel with transcript, cinema mode, PiP | Standalone UI polish pass | Wave 4 polish |
| 10 Dialogs & Forms | Improved import wizard, inline editing | When doing CRUD polish (Section 4) | Wave 1 CRUD gaps |
| 12 Landing Page | Public marketing site | When preparing public launch | Wave 4 |

### Design Principles from Stitch

1. **Tonal layering** — definition through background color shifts instead of borders
2. **Ambient shadows** — multi-layer shadows with indigo tint: `0px 20px 40px rgba(29,28,24,0.06)`
3. **Label hierarchy** — `10px uppercase tracking-widest` for category labels above bold headlines
4. **Icon circles** — icons inside colored circular backgrounds (not bare icons)
5. **Gradient CTAs** — `linear-gradient(135deg, primary, primary-container)` for primary buttons

### Implementation Notes

- All upgrades are **visual layer changes** on existing data infrastructure
- Each is independent and can be a separate story/PR
- Must use design tokens from `src/styles/theme.css` — no hardcoded colors
- Stitch used Manrope/Inter fonts → adapt to system fonts
- Stitch used Material Symbols → substitute Lucide equivalents
- Focus pages include "Current vs Proposed" comparisons — use as implementation specs

### Suggested Priority

**Phase 1 (Wave 1-2):**
1. Deep Focus Mode — most dramatic upgrade, explicitly requested
2. Streak Calendar — high visibility on Overview
3. Activity Timeline — new visual pattern
4. Vertical Path Timeline — alternative view
5. Progress Composites — polish pass

**Phase 2 (as synergies arise):**
- Charts & Reports — when fixing Reports page
- Radar/Skill Maps — when building Knowledge Map
- Quiz/Flashcard UI — when upgrading to FSRS
- Course Cards — when doing CRUD polish

### Effort: Phase 1 = Small-Medium (1-2 epics), Phase 2 = spread across feature epics

### Future Explorations

Items to investigate when implementing the widgets above:

#### Audio & Sound Design

The Pomodoro timer currently uses Web Audio API oscillators (`pomodoroAudio.ts`) to generate a two-tone chime (C5→E5). Functional but robotic. Needs exploration:

| Option | Pros | Cons |
|--------|------|------|
| **Bundled audio files** (Freesound, Mixkit, Pixabay — free licensed) | Rich, warm, satisfying sounds; users expect this quality | ~100KB added to bundle; licensing per file |
| **Synthesized (current)** | Zero file size, works offline, no licensing | Sounds clinical/robotic, limited palette |
| **System native** (Notification API) | Familiar OS sounds, zero bundle | Can't choose which sound; needs permission; background tabs only |

**Recommended:** Hybrid — bundle 4-6 small `.mp3` files (~100KB total) for key events, keep oscillator as fallback, system notification when tab is backgrounded.

**Sound events to design for:**

| Event | Sound Style | Current State |
|-------|------------|---------------|
| Focus session complete | Meditation bell / singing bowl | Two-tone oscillator chime |
| Break complete | Gentle chime / xylophone | Same oscillator chime |
| Break warning (1 min left) | Soft tick / subtle alert | None |
| Session start | Brief positive tone | None |
| Achievement unlocked | Celebration / level-up | None (NotificationCenter has no audio) |
| Streak milestone | Fanfare snippet | None |

**Future:** Sound themes (Zen, Minimal, Playful, Silent) as a settings option. Ties into Accessibility (Section 11) for reduced-audio preference.

**Key files:** `src/lib/pomodoroAudio.ts`, `src/lib/pomodoroPreferences.ts`, `src/app/components/figma/PomodoroTimer.tsx`

---

## 18. User Flow Documentation & Live Design Audit

> **Status:** 🔴 Not Started (0%)
> **Plan:** [`docs/plans/user-flow-audit-plan.md`](user-flow-audit-plan.md)
> **Completed:** Plan created with full page inventory, template, and batch prompts
> **Remaining:** All 4 batches (33 per-page flows + 10 cross-page journeys)
> **Blockers:** None — independent of all other areas
> **Last Updated:** 2026-03-28

### What This Covers

Comprehensive documentation + live browser audit of all 33 pages, serving as:
- **QA testing reference** — step-by-step "click X, expect Y" for each page
- **E2E test specs** — identify gaps in the 100+ existing test specs
- **Product documentation** — onboard contributors to how the app works
- **Style compliance audit** — verify design tokens, WCAG, responsive design per page

### Scope

| Deliverable | Count |
|-------------|-------|
| Per-page flow docs (with style compliance checklist) | 33 |
| Cross-page journey docs (live-tested) | 10 |
| Index | 1 |
| Screenshots | ~100+ |

### Execution: 4 Batches

| Batch | Pages | Scope |
|-------|-------|-------|
| 1 | 1-13 | Library + Course Detail group |
| 2 | 14-25 | Study + Track groups (incl. premium gates) |
| 3 | 26-33 | Settings, Auth, Detail pages, Utility |
| 4 | — | 10 cross-page journeys (live testing only) |

Each batch: read code → draft flows → live browser verification via Playwright MCP → fix minor issues → flag major issues.

### Effort: Medium (1-2 epics, or run as a quality gate before major releases)

---

## 19. Books & Audiobooks Library

> **Status:** ⬜ Future Exploration (Wave 4-5)
> **Plan:** [`docs/plans/2026-03-28-books-audiobooks-exploration.md`](2026-03-28-books-audiobooks-exploration.md)
> **Priority:** Low — explore after core platform is solid (sync, ML, calendar done)
> **Last Updated:** 2026-03-28

### Idea

Extend Knowlune from video courses into a comprehensive learning library: books (EPUB/PDF) + audiobooks (M4B/MP3) with unified progress tracking, notes, flashcards, and spaced repetition.

### Why It Fits

- ~70% of infrastructure already exists (progress tracking, notes, flashcards, PDF viewer, export, AI/RAG)
- Books are a primary learning medium — natural extension
- Self-hosted book manager with spaced repetition is a unique niche

### Why It's Deferred

- 5-8 epics of effort (same scale as sync)
- EPUB reader is a product in itself
- Existing tools (Calibre, Kindle, Apple Books) handle reading well
- Core features (sync, ML, calendar, a11y) should ship first

### Phases (if pursued)

| Phase | What | Effort |
|-------|------|--------|
| 1 | Book metadata + library shelves (reading list tracker) | Medium (1 epic) |
| 2 | EPUB reader (epub.js, pagination, themes) | Large (1-2 epics) |
| 3 | Audiobook player (chapter nav, speed, sleep timer) | Medium (1 epic) |
| 4 | Highlights & annotations (inline in EPUB) | Large (1 epic) |
| 5 | Study tool integration (flashcards from highlights, book notes) | Medium (1 epic) |
| 6 | Metadata enrichment (Google Books/Open Library API) | Small |
| 7 | Calibre/OPDS integration | Medium (1 epic) |

### Decision Gate

Before starting: "Do I read/listen to enough books to justify this? Is the PDF viewer sufficient for ebooks?"

---

## 20. Cross-Cutting Dependencies

> **Execution priority document:** [`docs/plans/execution-priority.md`](execution-priority.md) — tier-based order with rationale and decision gates.

```
                    ┌──────────────────────┐
                    │  Test Health (E43)    │ ✅ DONE — 3,429 tests passing
                    │  S01-S03: resolved   │
                    └────────┬─────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌───────────────┐
     │ Auth (2)   │  │ CRUD (4)   │  │ ML hybrid     │
     │ E43-S04    │  │ E43-S05    │  │ E52 (4 stories│
     │ session exp│  │ completion │  │ quiz + recs)  │
     └─────┬──────┘  └─────┬──────┘  └───────┬───────┘
           │               │                  │
           ▼               ▼                  │ 2-week validation
     ┌─────────────────────────┐              ▼
     │   Data Sync (1)         │       ┌──────────────┐
     │   E44-E46 Phase 1       │       │ ML Full (E52)│
     │   E47-E49 Phase 2       │       │ 8 stories    │
     └────────────┬────────────┘       └──────────────┘
                  │
       ┌──────────┼──────────┬──────────┐
       ▼          ▼          ▼          ▼
  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐
  │ Cloud   │ │ Repo   │ │ Offline  │ │ Desktop App  │
  │ Storage │ │ Split  │ │ UX (9)   │ │ (Tauri)      │
  │ (7)     │ │ (5)    │ │ sync UI  │ │ (3)          │
  └─────────┘ └────────┘ └──────────┘ └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ Offline/     │
                                       │ Downloads (6)│
                                       └──────┬───────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │ Books (19)   │ ← Needs desktop + sync for full value
                                       └──────────────┘

     INDEPENDENT TRACKS (no blockers, run anytime):

     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
     │ Calendar (10)    │     │ Accessibility     │     │ PKM Export (12)  │
     │ E50 (6 stories)  │     │ E51 (4 stories)   │     │ E53 (3 stories)  │
     │ Phase 1-2 indep. │     │ (11) font/density │     │ Markdown/Anki    │
     │ Phase 3+ → Auth  │     └──────────────────┘     └──────────────────┘
     └──────────────────┘
                              ┌──────────────────┐     ┌──────────────────┐
     ┌──────────────────┐     │ Lesson Flow (16)  │     │ Stitch UI (17)   │
     │ Notifications    │     │ E54 (3 stories)   │     │ E55 (5 stories)  │
     │ E43-S06/S07      │     │ CTA + checkmarks  │     │ Focus + Streak   │
     └──────────────────┘     └──────────────────┘     └──────────────────┘

     DEPENDENCY CHAINS:

     ┌──────────────────┐     ┌──────────────────┐
     │ FSRS (ML ph. 3)  │────▶│ Knowledge Map    │
     │ (not yet planned)│     │ E56 (4 stories)   │
     └──────────────────┘     │ Ph.1-2 independent│
                              │ Ph.3 needs FSRS   │
                              └────────┬──────────┘
                                       │
                                       ▼
                              ┌──────────────────┐
                              │ AI Tutoring (14)  │
                              │ E57 (5 stories)   │
                              │ Ph.1-3 independent│
                              │ Ph.4 → Knowl. Map │
                              └──────────────────┘

     QUALITY GATES (run before releases):

     ┌──────────────────┐
     │ User Flows (18)  │ ← Run before major releases, not a feature dependency
     │ 33 pages + 10    │
     │ journeys + audit │
     └──────────────────┘
```

### Key Dependency Chains

1. **Test health (E43) → Everything** — Don't build on a broken foundation
2. **Auth (E43-S04) + CRUD (E43-S05) → Data Sync (E44)** — Sync needs stable schemas and auth
3. **Data Sync (E44-E46) → Desktop App (3)** — Desktop must sync with web version
4. **Data Sync → Cloud Storage (7)** — Same sync engine can target multiple backends
5. **Data Sync → Offline UX (9)** — Sync status indicator needs sync engine
6. **Desktop App → Full Offline (6) → Books (19)** — Full library needs persistent file access
7. **E52 hybrid → E52 full** — 2-week validation gate between hybrid and full ML pipeline
8. **Auth → Calendar phase 3+** — Google Calendar OAuth needs Supabase token storage
9. **FSRS → Knowledge Map phase 3 (E56)** — Decay predictions use FSRS stability estimates
10. **Knowledge Map (E56) → AI Tutoring phase 4 (E57)** — Learner profile needs knowledge scores

### Independent Tracks (can run in parallel — Tier 1 + 2)

| Epic | Area | Stories | Dependencies |
|------|------|---------|-------------|
| E51 | Accessibility Phase 1 | 4 | None — pure frontend |
| E50 | Calendar Phase 1-2 | 6 | None — Phases 1-2 independent |
| E43-S06/S07 | Notifications data layer | 2 | None — replaces mock data |
| E52 | ML Phase 1 (hybrid) | 4 | None — uses existing AI infra |
| E53 | PKM Export Phase 1 | 3 | None — uses existing export |
| E54 | Lesson Flow | 3 | None — pure frontend |
| E55 | Stitch UI Phase 1 | 5 | None — pure frontend |
| E56 | Knowledge Map Phase 1-2 | 4 | None for Ph.1-2 (Ph.3 needs FSRS) |
| E57 | AI Tutoring Phase 1-3 | 5 | None for Ph.1-3 (Ph.4 needs E56) |

---

## 21. Recommended Sequencing

> **Execution priority:** [`docs/plans/execution-priority.md`](execution-priority.md) — 5-tier order with rationale, parallelization notes, and decision gates.

### Wave 1: Foundation (E43 — 7 stories ready)
> Fix what's broken, fill critical gaps, ship quick wins
> **Epic:** `docs/implementation-artifacts/stories/E43-S01..S07` | **Execution guide:** `_bmad-output/planning-artifacts/execution-guide-wave1-e44.md`

- [x] ~~Fix failing tests~~ — All 3,429 unit tests passing (202 suites). E43-S01/S02/S03 resolved.
- [x] ~~Add password reset flow~~ (already implemented in EmailPasswordForm.tsx:30-51)
- [ ] Session expiry handling — story ready: E43-S04 (useAuthLifecycle hook + banner)
- [ ] Fix imported course completion % — story ready: E43-S05 (wire callers to existing function)
- [ ] Add data import/restore (`.knowlune` portable bundle) — unblocked by E44-S01/S02 (export fix)
- [ ] **Calendar phase 1-2 (E50):** 6 stories ready — StudySchedule model, iCal feed endpoint, feed URL management, Settings UI, schedule editor, SRS events widget
- [ ] **Accessibility phase 1 (E51):** 4 stories ready — Settings infrastructure, reduced motion toggle, Atkinson Hyperlegible font, spacious density mode. **Priority: implement first**
- [ ] **PKM Export phase 1 (E53):** 3 stories ready — Flashcard/bookmark Markdown + Anki .apkg + batch ZIP export UI
- [ ] **Notifications phases 1-2:** stories ready: E43-S06 (Dexie + store), E43-S07 (triggers + wiring)
- [x] ~~**Onboarding phases 1-3:** Quick bug fixes + Getting Started checklist + empty state component~~ (E25 — complete)
- [ ] **Lesson flow (E54):** 3 stories ready — Auto-advance wiring for imported/YouTube players + completion checkmarks
- [ ] **Stitch UI phase 1 (E55):** 5 stories ready — Pomodoro Zustand store, SVG timer widget, focus stats, month-view calendar, streak header

### Wave 2: Intelligence (next 2-3 epics)
> Ship high-value ML + AI features using existing infrastructure

- [ ] **ML Phase 1 hybrid (E52):** 4 stories ready — Simplified quiz generation (MCQ+T/F, no Bloom's), quiz UI, basic QC (Zod+dedup), tag-based recommendations (Jaccard similarity). 2-week validation gate before full pipeline.
- [ ] **ML Phase 2 (E52 full):** Deferred — Bloom's Taxonomy, transcript chunker, embedding-based recs, LLM abstraction, auto-generate. Only after hybrid validates usage.
- [x] ~~Lesson summarization with RAG~~ (E9B — AI summaries complete)
- [ ] Upgrade spaced repetition from SM-2 to FSRS
- [ ] **Calendar:** SRS review reminders in iCal feed (connects FSRS to calendar)
- [ ] **AI Tutoring Phase 1-2 (E57):** 5 stories ready — Tutor tab in LessonPlayer, streaming hook, conversation persistence (Dexie v29), Socratic hint ladder, RAG-grounded answers
- [ ] **Knowledge Map Phase 1 (E56):** 4 stories ready — Topic resolution, knowledge scoring, Overview treemap widget, dedicated /knowledge-map page
- [ ] **PKM Export phases 2-3:** Obsidian vault export (wikilinks, folder structure) — builds on E53
- [ ] **Notifications phase 3:** SRS due reminders + study block alerts (ties into FSRS + calendar)
- [ ] **Notifications phase 4:** Preferences UI in Settings (per-type toggles, quiet hours)
- [ ] **Stitch UI phase 2:** Activity Timeline + Vertical Path Timeline + Progress Composites (Section 17)

### Wave 3: Sync (6 epics — E44-E49)
> Multi-device experience — architecture: [`docs/plans/sync-architecture.md`](sync-architecture.md) | epics: [`epics-sync.md`](../_bmad-output/planning-artifacts/epics-sync.md)

**Phase 1 (MVP — 18 stories):**
- [ ] **E44:** Sync Pre-Requisites — export v2, import compat, multi-user scoping, ESLint rule (4 stories)
- [ ] **E45:** Sync Infrastructure — Dexie v28, syncQueue, syncableWrite(), engine core, Supabase migrations (6 stories)
- [ ] **E46:** P0 Sync Live — wire stores, triggers, offline queue, auth backfill, sync UI (8 stories)

**Phase 2 (deferred until Phase 1 validated — 19 stories):**
- [ ] **E47:** P1 Tables — Dexie v29, flashcardReviews, note conflict UI, review log replay
- [ ] **E48:** P2-P3 Tables — Dexie v30, remaining stores, non-serializable field stripping
- [ ] **E49:** Sync Polish — Realtime subscriptions, upload wizard, sync log, chaos testing
- [ ] **Offline UX:** Sync status indicator + offline mode banner
- [ ] Offline content caching (transcripts, thumbnails, PWA)
- [ ] Soft-delete/archive with sync support
- [ ] **Calendar phase 3:** Google Calendar two-way sync (OAuth, needs Supabase auth)
- [ ] **Knowledge Map phase 3:** Decay predictions ("you'll forget X by date Y") — needs FSRS
- [ ] **AI Tutoring phase 4:** Learner profile injection (quiz history, weak areas, knowledge score)
- [ ] **Accessibility phase 3:** Screen reader audit + VoiceOver fixes
- [ ] **PKM phase 3:** Obsidian vault export (folder structure with wikilinks)
- [ ] **Notifications phase 5:** Smart triggers (knowledge decay alerts, recommendations)
- [ ] **Notifications phase 6:** PWA push notifications (Service Worker, browser permission)

### Wave 4: Polish & Platform (2-3 epics)
> Prepare for public launch

- [ ] Repo split (core open / premium private)
- [ ] Bulk operations (multi-select delete, archive)
- [ ] Google Drive integration (premium feature)
- [ ] On-device embeddings (Transformers.js — remove OpenAI dependency for free tier)
- [ ] **Offline UX:** Storage management dashboard in Settings
- [ ] **Calendar phase 4:** Smart scheduling ("find time for this course" — ML + free/busy)
- [ ] **Knowledge Map phase 4:** Action suggestions ("review these flashcards", "take refresher quiz")
- [ ] **AI Tutoring phases 5-6:** Conversation memory + tutoring modes (ELI5, Quiz Me, Debug)
- [ ] **Accessibility phases 4-5:** Reading mode, focus mode, WCAG 2.2 compliance audit
- [ ] **PKM phases 4-5:** Notion API integration, Readwise sync
- [ ] **Notifications phase 7:** Email digest (weekly summary via Supabase Edge Functions)

### Wave 5: Desktop (6-8 epics) — Future
> Only if adoption signals justify it

- [ ] Tauri app shell with existing React app
- [ ] Bundle yt-dlp + whisper.cpp as local tools
- [ ] Local file downloads for offline library
- [ ] Mac App Store submission (requires Apple Sign-In)
- [ ] **Offline UX:** Background sync, full offline downloads
- [ ] **Calendar:** Native macOS EventKit integration
- [ ] **Knowledge Map phase 5:** Full concept-level knowledge graph (ML concept extraction)

### Decision Gates

| Gate | When | Question | If Yes → | If No → |
|------|------|----------|----------|---------|
| E52 validation | 2 weeks after E52 ships | "Did users use generated quizzes?" | Plan E52 full scope (8 stories) | Deprioritize ML Phase 2 |
| E57 validation | 2 weeks after E57 ships | "Is Socratic better than direct explanation?" | Plan Phase 3-6 | Keep Explain mode only |
| Sync decision | Before E44 | "Do I use Knowlune on multiple devices?" | Start E44 | Skip to Tier 5 |
| E46 validation | 2-4 weeks after E46 | "Does P0 sync work reliably?" | Start E47 | Fix issues first |
| Calendar phase 3 | After E50 validated | "Is iCal feed sufficient, or need two-way sync?" | Plan Google Calendar epic | Keep iCal only |
| PKM phase 4 | After E53 validated | "Are users exporting to Notion, or is Markdown enough?" | Plan Notion API epic | Keep Markdown/Anki |
| Knowledge Map phase 5 | After E56 validated | "Is topic-level sufficient, or need concept-level?" | Plan ML concept extraction | Keep topic-level |
| Desktop decision | Before Wave 5 | "Is Docker blocking adoption?" | Start Tauri app | Keep PWA only |
| Books decision | Before Wave 4-5 | "Do I read enough to justify this?" | Start Phase 1 (shelves) | Park indefinitely |
| Wave 4 | Before repo split | "Am I ready for public contributors?" | Split repos | Keep monorepo |

---

## Critical Files Reference

| Area | Key Files |
|------|-----------|
| Database schema | `src/db/schema.ts` (27 tables, v27) |
| Auth store | `src/stores/useAuthStore.ts` |
| Entitlement | `src/lib/entitlement/isPremium.ts` |
| Export service | `src/lib/exportService.ts` |
| Course import store | `src/stores/useCourseImportStore.ts` |
| Learning path store | `src/stores/useLearningPathStore.ts` |
| Premium manifest | `src/premium/manifest.ts` |
| Premium build | `vite.config.premium.ts` |
| Express proxy | `server/index.ts` |
| YouTube transcript pipeline | `vite-plugin-youtube-transcript.ts` |
| SSRF protection | `src/lib/ssrfProtection.ts` |
| PWA config | `vite.config.ts` (VitePWA section) |
