---
title: Fix Console Errors and Warnings in Production Deployment
type: fix
status: done
date: 2026-06-23
deepened: 2026-06-23
---

# Fix Console Errors and Warnings in Production Deployment

## Overview

Fix 5 distinct categories of console errors/warnings observed in the Cloudflare Pages production deployment:
1. Two sync registry bugs (400 errors for `quiz_attempts` and `ai_usage_events`)
2. One CSP inline script violation (blocked script on track detail page)
3. One deprecated meta tag warning (`apple-mobile-web-app-capable`)
4. Three `aria-describedby` accessibility warnings (from `ImportedCourseCard`, `CourseCard`, `ThumbnailPickerDialog`)
5. Repeated embedding worker crashes (triggered by tab switching)

This totals 8 individual console messages across 5 root causes.

## Problem Frame

The browser console on production shows recurring errors that degrade developer observability (real issues hidden in noise), user experience (failed sync, missing semantic search, broken inline scripts), and accessibility compliance (missing ARIA attributes).

## Requirements Trace

- R1. `quiz_attempts` and `ai_usage_events` sync uploads and downloads must succeed without 400 errors
- R2. Inline scripts must execute without CSP violations
- R3. No deprecated meta tag warnings in console
- R4. No `aria-describedby` accessibility warnings from Radix DialogContent
- R5. Embedding worker must not crash when user switches browser tabs

## Scope Boundaries

- This plan covers ONLY the 5 code-level fixes listed in Implementation Units
- Supabase migration deployment (`learning_path_templates` tables) is out of scope — requires `supabase db push` or manual migration run
- `notifications` 403 errors are out of scope — likely an RLS/auth issue requiring Supabase-side investigation
- Blob URL `ERR_FILE_NOT_FOUND` noise is deferred to a separate task — it is a pre-existing pattern across many files, not a new regression

### Deferred to Separate Tasks

- Blob URL lifecycle management audit: separate PR to systematically apply the atomic revocation pattern from `docs/solutions/logic-errors/stale-error-video-load-transition-2026-06-20.md`
- Supabase migration deployment for `learning_path_templates`: run migration `20260503000001_add_learning_path_templates.sql` on Cloud instance

## Context & Research

### Relevant Code and Patterns

- Sync registry insert-only table pattern: `audioBookmarks` entry (`src/lib/sync/tableRegistry.ts:286-295`) correctly uses `cursorField: 'created_at'` and `stripFields: ['updatedAt']`
- CSP defined in `index.html:16-31` via `<meta http-equiv="Content-Security-Policy">`; Vite plugin at `vite.config.ts:468-478` strips directives only during Playwright tests
- DialogContent component: `src/app/components/ui/dialog.tsx:48-76` wraps Radix `DialogPrimitive.Content`
- Embedding worker coordinator: `src/ai/workers/coordinator.ts:546-553` terminates all workers on `visibilitychange`

### Institutional Learnings

- **Sync registry**: `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md` Pattern 3 — append-only tables need `cursorField: 'created_at'` (the codebase property; the learning doc uses the older term `cursorColumn`). Without this, the download engine queries `updated_at > last_sync_at` which silently returns zero rows. Both `quizAttempts` and `aiUsageEvents` already have `insertOnly: true` set; they are only missing the cursor and strip fields.
- **Sync registry**: `docs/solutions/sync/e96-closeout-sync-patterns-2026-04-19.md` Pattern 1 — pair `cursorColumn: 'created_at'` with an index on `(user_id, created_at)`.
- **Worker fallbacks**: `docs/solutions/runtime-errors/note-qa-embedding-fallback-2026-04-28.md` — use timeouts and fallbacks for worker-based async code; assume it can fail or hang.
- **CSP**: No dedicated solution document exists. The `e120-pwa-polish-lessons.md` has a related `MediaMetadata.artwork` CSP bypass pattern.
- **Dialog accessibility**: Only incidental mention in `search-command-palette-rendering-fixes.md`.

## Key Technical Decisions

- **CSP fix: add hash for the actual blocked inline script** — Adding the observed hash (`sha256-uUew0TW/lrngy0J3LVp+D/7ubZJy1tfFlGU/IVg84rQ=`) to `script-src` blocks only the specific inline script content while maintaining security. This hash was captured from the browser's CSP violation error on the track detail page. It does NOT correspond to `public/reduce-motion-init.js` (a same-origin external script already allowed via `'self'`); it is from a dynamically-generated inline script — likely produced by a library runtime (framer-motion `motion/react` or similar) that executes on the Learning Track Detail page.
- **Worker fix: don't terminate, just reject pending** — The `visibilitychange` listener should reject pending requests (triggering fallback behavior) rather than killing workers. This keeps the model loaded in memory so it's ready when the user returns.
- **Dialog fix: add `DialogDescription` to all three files** — Radix UI requires a `DialogDescription` child to suppress the accessibility warning. `DialogDescription` is NOT currently imported in any of the three affected files and must be added to each import statement. For simple dialogs where a full description would be visual noise, add a screen-reader-only `<DialogDescription className="sr-only">` with brief contextual text.

## Implementation Units

- [ ] **Unit 1: Fix sync registry for insert-only tables**

**Goal:** `quizAttempts` and `aiUsageEvents` sync uploads and downloads succeed without PostgREST 400 errors.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/lib/sync/tableRegistry.ts`

**Approach:**
- Add `cursorField: 'created_at'` to both `quizAttempts` (line 623) and `aiUsageEvents` (line 635) registry entries so the download engine queries `ORDER BY created_at` instead of the nonexistent `updated_at`
- Add `stripFields: ['updatedAt']` to both entries so `syncableWrite` does not stamp an `updatedAt` field into upload payloads for tables without that column
- Follow the `audioBookmarks` entry (lines 286-295) as the reference pattern

**Patterns to follow:**
- `audioBookmarks` entry: `src/lib/sync/tableRegistry.ts:286-295`
- Sync patterns doc: `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md` Pattern 3

**Test scenarios:**
- Happy path: `syncableWrite('quizAttempts', 'add', record)` produces an upload payload without `updated_at` field; cursor for download uses `created_at`
- Happy path: same for `aiUsageEvents`
- Integration: sync engine download for both tables uses the correct cursor column in the PostgREST query

**Verification:**
- No more `column quiz_attempts.updated_at does not exist` errors in console
- No more `column ai_usage_events.updated_at does not exist` errors in console

---

- [ ] **Unit 2: Fix CSP inline script violation**

**Goal:** The inline script blocked by CSP on the Learning Track Detail page executes without violation.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `index.html`

**Approach:**
- Add the observed script hash `'sha256-uUew0TW/lrngy0J3LVp+D/7ubZJy1tfFlGU/IVg84rQ='` to the `script-src` directive in the CSP meta tag at line 19
- The current directive is: `script-src 'self' 'wasm-unsafe-eval' https://www.youtube.com`
- New directive: `script-src 'self' 'wasm-unsafe-eval' https://www.youtube.com 'sha256-uUew0TW/lrngy0J3LVp+D/7ubZJy1tfFlGU/IVg84rQ='`
- **Important**: This hash is for a dynamically-generated inline script on the track detail page, NOT for `public/reduce-motion-init.js` (which is a same-origin external script loaded via `<script src="...">` and already permitted by CSP `'self'`). The hash was captured from a real CSP violation error in the browser console. The exact source is likely framer-motion's runtime (`motion/react`) or another library that injects inline script content at runtime. Adding the hash is more secure than `'unsafe-inline'` because it only allows that specific script content.
- No external script files need modification — the fix is purely in the CSP meta tag.

**Patterns to follow:**
- Existing CSP structure: `index.html:16-31`

**Test scenarios:**
- Happy path: track detail page loads without "violates the following Content Security Policy directive" error in console
- Edge case: other inline scripts (if any) remain blocked — only the specific hashed script is allowed
- Edge case: verify the hash still works after a built deploy (Vite does not modify inline scripts in the CSP meta tag; only external JS files get bundled)

**Verification:**
- No CSP violation error on `/learning-tracks/:trackId` page in production

---

- [ ] **Unit 3: Fix deprecated meta tag**

**Goal:** The `apple-mobile-web-app-capable` deprecation warning is eliminated.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `index.html`

**Approach:**
- Replace `<meta name="apple-mobile-web-app-capable" content="yes">` (line 33) with the standards-based `<meta name="mobile-web-app-capable" content="yes">`
- The PWA manifest (`vite.config.ts:507-513`) already has `display: 'standalone'` which is the equivalent behavior; this meta tag is supplementary

**Test scenarios:**
- Happy path: no deprecation warning about `apple-mobile-web-app-capable` in console
- Edge case: iOS Safari standalone mode is preserved via `display: 'standalone'` in the PWA manifest (`vite.config.ts:507-513`), not the meta tag; the deprecated `apple-mobile-web-app-capable` tag is supplementary and safe to replace

**Verification:**
- No "apple-mobile-web-app-capable is deprecated" warning in console

---

- [ ] **Unit 4: Fix missing aria-describedby on DialogContent**

**Goal:** Radix UI DialogContent components no longer emit "Missing Description or aria-describedby" accessibility warnings.

**Requirements:** R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/figma/ImportedCourseCard.tsx`
- Modify: `src/app/components/figma/CourseCard.tsx`
- Modify: `src/app/components/figma/ThumbnailPickerDialog.tsx`

**Approach:**
- Add `DialogDescription` to the dialog import destructuring in all three files (it is NOT currently imported in any of them):
  - `src/app/components/figma/ImportedCourseCard.tsx` (line 44): change `Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose` to `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose`
  - `src/app/components/figma/CourseCard.tsx` (line 8): change `Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose` to `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose`
  - `src/app/components/figma/ThumbnailPickerDialog.tsx` (line 4): change `Dialog, DialogContent, DialogHeader, DialogTitle` to `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription`
- Add a screen-reader-only `<DialogDescription>` child inside `<DialogContent>` in each component where none is currently present:
  - `ImportedCourseCard.tsx`: add `<DialogDescription className="sr-only">Course details and available actions</DialogDescription>` inside the preview `<DialogContent>`
  - `CourseCard.tsx`: add `<DialogDescription className="sr-only">Course details and available actions</DialogDescription>` inside the preview `<DialogContent>`
  - `ThumbnailPickerDialog.tsx`: add `<DialogDescription className="sr-only">Select a cover image for this course</DialogDescription>` inside `<DialogContent>`
- Radix UI requires a `DialogDescription` child to suppress its accessibility warning; passing `aria-describedby={undefined}` does not work because React normalizes `undefined` props (treats them as not passed)
- The `className="sr-only"` keeps the description visually hidden while satisfying the accessibility requirement
- `DialogDescription` is exported from `src/app/components/ui/dialog.tsx` (line 125) and ready to import

**Patterns to follow:**
- DialogContent component: `src/app/components/ui/dialog.tsx:48-76`
- DialogDescription export: `src/app/components/ui/dialog.tsx:125`

**Test scenarios:**
- Happy path: opening each affected dialog no longer triggers "Missing Description or aria-describedby" warning in console
- Edge case: existing `DialogDescription` children in other dialogs continue to work correctly (no regression)

**Verification:**
- No "Missing Description or aria-describedby" warnings in console

---

- [ ] **Unit 5: Fix embedding worker tab-hide termination**

**Goal:** Embedding workers survive browser tab switches without crashing and requiring full model re-download.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/ai/workers/coordinator.ts`

**Approach:**
- In the `visibilitychange` listener (lines 546-553), instead of calling `coordinator.terminate()` which kills all workers and rejects all pending requests, only reject pending requests while keeping workers alive
- Reject each worker's pending requests with a specific error message (e.g., "Tab hidden — retry when visible") so callers can handle the transient failure gracefully
- When the tab becomes visible again, workers are still loaded with the model in memory — no re-download needed
- The existing `warmUp` in `App.tsx` already handles the initial model load; post-return, just resume accepting requests
- Keep the existing TODO comment about the known issue but update it to note the improvement
- **Note**: The 60-second idle timer within workers will still terminate them on longer tab absences. This is acceptable — the worker will be recreated on the next request, and the existing crash-recovery path handles that case. The key improvement is avoiding termination on typical tab switches (seconds to minutes) which is the common case.

**Patterns to follow:**
- Worker fallback pattern: `docs/solutions/runtime-errors/note-qa-embedding-fallback-2026-04-28.md`

**Test scenarios:**
- Happy path: switching to another browser tab and back does not trigger "Worker crash" / "Backfill failed" errors in console
- Happy path: embedding requests made after returning to the tab succeed without re-downloading the model
- Edge case: rapidly switching tabs multiple times does not accumulate errors
- Edge case (accepted): tab absent longer than the 60s idle timeout will still terminate the worker — worker is recreated on next request via existing recovery path

**Verification:**
- No "Coordinator Worker embed-worker crashed" errors in console after tab switches
- No "CourseEmbedding Backfill failed" errors from tab-switch-induced crashes

## System-Wide Impact

- **Interaction graph:** Sync registry change affects the download engine (`syncEngine.ts`) and upload path (`syncableWrite.ts`) for `quizAttempts` and `aiUsageEvents` only. CSP change affects all pages (single meta tag). Worker change affects the embedding coordinator singleton.
- **Error propagation:** Sync errors for the two fixed tables will now surface as actual data issues rather than silent schema errors. Worker errors will be transient (rejected requests) rather than terminal (crashed worker).
- **Unchanged invariants:** All other sync tables retain their existing registry configs. DialogContent component API is unchanged — `aria-describedby` can still be passed explicitly when needed. CSP other directives (`style-src`, `default-src`, etc.) are unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| CSP hash may not match after a deploy if the inline script content changes | The inline script is generated by a library runtime (framer-motion or similar), not application code, so its content is stable across deploys. Verify in production after deploy; if the hash changes, update it. |
| Worker may still crash for genuine OOM reasons | The fix only addresses tab-hide termination, not OOM crashes. The existing crash recovery path (spawn new worker on next request) handles OOM |
| 60-second idle timeout still terminates workers on longer tab absences | Documented as accepted behavior — worker recreated on next request via existing recovery path |

## Sources & References

- **Sync patterns:** `docs/solutions/sync/e93-closeout-sync-patterns-2026-04-18.md` Pattern 3
- **Sync patterns:** `docs/solutions/sync/e96-closeout-sync-patterns-2026-04-19.md` Pattern 1
- **Worker fallbacks:** `docs/solutions/runtime-errors/note-qa-embedding-fallback-2026-04-28.md`
- **Blob URL lifecycle:** `docs/solutions/logic-errors/stale-error-video-load-transition-2026-06-20.md`
- Related code: `src/lib/sync/tableRegistry.ts:286-295` (audioBookmarks reference pattern)
- Related code: `src/app/components/ui/dialog.tsx:48-76` (DialogContent component)
- Related code: `src/app/components/ui/dialog.tsx:108-119` (DialogDescription component)
- Related code: `src/ai/workers/coordinator.ts:546-553` (tab-hide termination)
- Related code: `index.html:15` (reduce-motion-init.js external script — NOT the CSP violation source)
- Related code: `index.html:16-31` (CSP policy)
- Verification: SHA-256 of `public/reduce-motion-init.js` is `sha256-bFeBdioiIya+lnY02vdi8MsXbS4FH2OcnDC3f_gHcUk=` (confirmed does NOT match the CSP violation hash)
