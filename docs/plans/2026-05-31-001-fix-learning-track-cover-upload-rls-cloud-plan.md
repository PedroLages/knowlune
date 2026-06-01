---
title: "fix: Learning Track cover upload fails with Not authorized (Supabase Cloud storage RLS)"
type: fix
status: active
date: 2026-05-31
deepened: 2026-05-31
---

# Fix: Learning Track Cover Upload — "Not authorized to upload covers"

## Overview

On the Learning Tracks page, opening a card's **Change Cover** menu, choosing an image, and pressing **Save** fails with `Not authorized to upload covers. Try signing out and back in.` (or `Cover storage not configured. Please contact support.`). The goal of this plan is to make image cover upload actually work end-to-end for an authenticated user, and to stop this from silently regressing again.

The **application code and the SQL definitions in the repo are already correct** — prior plans (005, 012) removed `upsert`, added 409 retry, user-scoped keys (`{userId}/{pathId}.jpg`), folder-prefix RLS, and a self-contained bucket+policy migration. The error message `Not authorized to upload covers` is emitted only on an HTTP **401/403 from Supabase Storage** (`src/lib/pathCoverUpload.ts` lines 184-199). That is a Storage Row-Level-Security denial for the `authenticated` role — i.e. the bucket and/or its INSERT policy are **not present (or not correct) on the live Supabase Cloud project**, not a bug in the client.

The trigger is the recent **self-hosted → Supabase Cloud migration (~2026-05-04)**. Repo migrations are demonstrably out of sync with the cloud database (known issue `supabase-cloud-sync-updated-at`: the sync engine gets HTTP 400 on the cloud DB for `updated_at` columns that exist in repo migrations). The storage bucket + RLS migration `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql` was almost certainly never applied (or only partially applied) to the cloud project `chyvhrbtttpumsyuhgbu`.

This plan is **diagnosis-first**: Unit 1 confirms the exact live cloud state read-only, then the repair units apply. The most-likely repair (re-apply the idempotent bucket+policy migration to cloud) is safe to run regardless of the precise failure mode.

## Problem Frame

**User-visible symptom:** Authenticated user on `/learning-tracks` (and `/learning-paths`, which shares the same `PathCoverDialog` and `uploadPathCover`) selects an image in Change Cover → Save → toast error `Not authorized to upload covers. Try signing out and back in.` Sometimes `Cover storage not configured. Please contact support.` Gradient presets work; only **image upload** fails.

**Where it fails:** `uploadPathCover()` in `src/lib/pathCoverUpload.ts`:
- `getUserId()` (line 95) calls `supabase.auth.getUser()` — this is a network call that validates the access token. Since the user can use the rest of the app, this succeeds and returns a real `userId`, so the access token is valid at upload time. The thrown error is therefore **not** the `AUTH_REQUIRED` path.
- `supabase.storage.from('learning-path-covers').upload(key, blob, …)` (line 155) returns an error with `statusCode` 401/403 → mapped to `STORAGE_UNAUTHORIZED` (line 188), or 404 → `STORAGE_NOT_FOUND` (line 190).

**Why RLS denies on cloud (root-cause hypotheses, ranked):**
- **H1 (most likely): The bucket's INSERT/UPDATE/DELETE RLS policies are absent on the cloud project.** A 401/403 for an otherwise-valid `authenticated` token means no policy grants the INSERT. The bucket likely exists (public, so SELECT/display works) but the owner-write policies from `20260507000001` / `storage-setup.sql` were never applied to cloud. Produces `STORAGE_UNAUTHORIZED`.
- **H2: The bucket `learning-path-covers` does not exist on cloud.** Produces HTTP 404 → `STORAGE_NOT_FOUND` ("Cover storage not configured"). This matches the "or other type of error" the user reports.
- **H3: Bucket exists with an `allowed_mime_types` restriction** (e.g. created via dashboard) that excludes `image/jpeg`, or a `file_size_limit` lower than the ~80-200 KB processed JPEG. Produces 400/413.
- **H4 (lower): Session/access-token staleness** — `getUser()` succeeds but the token expires between the auth check and the storage request, or clock skew makes Storage reject it. This is what the "sign out and back in" copy assumes, but it is the least likely given `getUser()` succeeds immediately before the upload.

The cover persistence path is separate and downstream: `PathCoverDialog.handleSave` calls `updatePathCover` (`src/stores/useLearningPathStore.ts` line 304), which writes optimistically to Dexie and syncs to `public.learning_paths.cover_image_url` / `cover_preset`. If migration `20260506000001_learning_path_cover_columns.sql` was not applied to cloud, sync of the cover URL would also fail later — worth auditing in the same pass, but it is not the cause of the upload-time error.

## Requirements Trace

- R1. An authenticated user can upload a JPEG/PNG/WebP cover image on `/learning-tracks` and `/learning-paths`, the image persists, and the card displays it after Save.
- R2. Re-uploading a cover for the same track (object already exists) succeeds (409 → delete + re-insert).
- R3. A user can only write/replace/delete covers under their own `{userId}/…` prefix (owner-scoped RLS preserved).
- R4. The bucket and its four RLS policies provably exist on the live Supabase Cloud project, confirmed by inspection — not assumed.
- R5. Upload failures produce a precise, actionable message that distinguishes session/auth (401), policy-denied (403), bucket-missing (404), too-large (413), and generic/network failures; internal config detail is logged for operators, not shown to users.
- R6. A repeatable verification mechanism (runbook + automated check) exists so a future environment migration that drops the bucket/policies is caught before users hit it.
- R7. The cover columns (`cover_image_url`, `cover_preset`) exist on `public.learning_paths` in cloud so the post-upload persistence/sync succeeds.

## Scope Boundaries

**In scope:**
- Read-only diagnosis of the live Supabase Cloud project's storage buckets, `storage.objects` RLS policies, and `learning_paths` columns.
- Applying / repairing the `learning-path-covers` bucket and RLS policies on the cloud project (idempotent).
- Reconciling migration history so `20260506000001` and `20260507000001` are recorded as applied on cloud.
- Client-side diagnostic hardening in `uploadPathCover` (status-code → message precision, optional session preflight).
- A storage-config verification script + operator runbook (and optional gated real-Supabase smoke test).

**Out of scope:**
- Redesigning the Change Cover dialog UI or gradient presets (presets work today).
- Migrating legacy flat-key objects (`{pathId}.jpg`) — only affects pre-existing blobs, not new uploads.
- Bulk RLS audit / repair of the other buckets (`course-thumbnails`, `avatars`, `book-covers`, etc.) beyond noting the same migration-application gap may affect them.
- The full sync-engine `updated_at` 400s (`supabase-cloud-sync-updated-at`) — tracked separately; only the `learning_paths` cover columns are in scope here.
- Progress-ring / card layout work from plan 012 (already applied).

### Deferred to Separate Tasks

- General "all storage buckets out of sync with cloud after migration" audit: separate hardening task — this plan fixes `learning-path-covers` and provides the verification pattern other buckets can reuse.
- Sync-engine `updated_at` column 400s (`study_sessions`, `quiz_attempts`, `ai_usage_events`): tracked in known-issues `supabase-cloud-sync-updated-at`.

## Context & Research

### Relevant Code and Patterns

- `src/lib/pathCoverUpload.ts` — `uploadPathCover()` / `deletePathCover()`. Key (`{userId}/{pathId}.jpg`, line 149), status-code → diagnostic mapping (lines 184-199), `DIAGNOSTIC` strings (lines 18-30). Already no `upsert`; 409 → remove + retry.
- `src/app/components/learning-path/PathCoverDialog.tsx` — `handleSave` (lines 95-122) calls `uploadPathCover` then `updatePathCover`; `isUploading` busy flag; toast on error.
- `src/stores/useLearningPathStore.ts` — `updatePathCover` (line 304): optimistic Dexie write + sync (persistence path, downstream of upload).
- `src/lib/auth/supabase.ts` — single Supabase client (PKCE, `persistSession`, `autoRefreshToken`). The same singleton is used for auth and storage, so the session token is attached to storage requests (rules out a "second client without session" bug).
- `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql` — self-contained: creates bucket (`INSERT … ON CONFLICT DO NOTHING`) + four policies (public SELECT; authenticated owner INSERT/UPDATE/DELETE using `(storage.foldername(name))[1] = auth.uid()::text`). Idempotent (`DROP POLICY IF EXISTS` / `CREATE POLICY`).
- `supabase/storage-setup.sql` — manual-apply superset that also defines `learning-path-covers` (lines 246-287) and is explicitly **not** a numbered migration (does not run via `supabase db push`).
- `supabase/migrations/20260506000001_learning_path_cover_columns.sql` — adds `cover_image_url` / `cover_preset` to `public.learning_paths`.
- `src/lib/__tests__/pathCoverUpload.test.ts` — existing unit tests: user-scoped key, no `upsert`, 409 delete+retry, remove-fail message, unauthenticated, unsupported-type. New diagnostics/preflight must extend these.
- `.env.example` (lines 49-53) — production cloud project ref `chyvhrbtttpumsyuhgbu.supabase.co`; prod env vars live in Cloudflare Pages.

### Institutional Learnings

- **`storage-setup.sql` is manual-apply** — not in `supabase/migrations/`, so `supabase db push` never runs it. Bucket + policies can be missing in any freshly provisioned environment (e.g. the new cloud project). (From plan 012, "Institutional Learnings".)
- **Folder-prefix RLS over subquery** — use `(storage.foldername(name))[1] = auth.uid()::text`, never a subquery that races async sync. The repo already does this.
- **Migrations are out of sync with Supabase Cloud post-migration** — `supabase-cloud-sync-updated-at` (known-issues, 2026-05-04) is direct evidence the cloud DB lacks objects that exist in repo migrations. The same gap explains the storage policies being absent.
- **`oauth-cached-old-supabase-url`** (known-issues, 2026-05-04) — confirms a real environment cutover happened; some clients cached the old URL.

### Related Plans (prior attempts)

- `docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md` — created migration `20260507000001`, removed `upsert`, added 409 retry. Code-side fix landed; the **deploy/apply-to-cloud step was the gap** and is the focus here.
- `docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md` — identified deploy/session as the probable cause, recommended operator verification (never turned into a durable check).
- `docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md` — earlier card/cover behavior fixes.

### Why prior fixes did not resolve it

Plans 005/012 fixed the **client and the repo SQL** but treated "apply the policies to the linked Supabase project" as a manual operator step with no verification. After the cloud cutover, that step was not (re)performed on `chyvhrbtttpumsyuhgbu`, so the authenticated INSERT is still denied. This plan makes the cloud-side application explicit, verified, and regression-guarded.

## Key Technical Decisions

- **Diagnose before repair.** Confirm the live cloud state (bucket existence, exact `storage.objects` policies for the bucket, `learning_paths` columns) read-only first, so the repair targets the real failure mode and we stop guessing across plans.
- **Repair via the existing idempotent migration, applied to cloud.** Apply `20260507000001` (bucket + 4 policies) to the cloud project using the Supabase MCP `apply_migration` (preferred, records it in migration history) or `execute_sql` / dashboard SQL editor / psql as fallback. Because it is fully idempotent, re-applying is safe even if some objects already exist.
- **Reconcile migration history.** After applying, ensure `20260506000001` and `20260507000001` are recorded as applied (via MCP `list_migrations` / `apply_migration`) so future `db push` runs are clean and the audit is trustworthy.
- **Keep RLS owner-scoped.** Do not weaken policies to "any authenticated user". Preserve `(storage.foldername(name))[1] = auth.uid()::text` (R3).
- **Sharper client diagnostics, not behavior change.** Map 401 vs 403 vs 404 vs 413 to distinct messages and operator logs so the next misconfiguration is self-evident (403 → "storage policy missing/denied", 404 → "bucket not configured"). Add an optional pre-upload session freshness check (`getSession`; refresh if near/after expiry) to address H4 cheaply.
- **Add a durable verification guard.** A small service-role script that asserts the bucket + 4 policies exist, runnable post-deploy and in CI, so an environment migration that drops them fails loudly instead of reaching users (R6). This is the anti-regression decision that distinguishes this plan from 005/012.

## Open Questions

### Resolved During Planning

- **Is this a client bug?** No. The repo code and SQL are correct; the error is a live Storage RLS denial. Confirmed by the 401/403 → `STORAGE_UNAUTHORIZED` mapping and `getUser()` succeeding before the upload.
- **Is the session attached to storage requests?** Yes — single `supabase` singleton shared by auth and storage; `getUser()` validates the token immediately before upload.
- **Which surfaces are affected?** Both `/learning-tracks` and `/learning-paths` — they share `PathCoverDialog` + `uploadPathCover`.

### Deferred to Implementation (require live cloud access)

- **Exact failure mode (H1 vs H2 vs H3):** determined in Unit 1 by inspecting cloud `storage.buckets` and `pg_policies` (schema `storage`). The repair in Unit 2 covers H1/H2; Unit 1 will surface H3 (mime/size limits) if present.
- **Whether `learning_paths.cover_image_url` / `cover_preset` exist on cloud:** verified in Unit 1; remediated in Unit 2 if missing (R7).
- **Exact tool to apply migration on cloud:** Supabase MCP `apply_migration` if the project is linked/authorized; otherwise dashboard SQL editor or `psql`. Confirmed at execution time.

## Implementation Units

- [ ] **Unit 1: Confirm the live Supabase Cloud root cause (read-only diagnosis)**

**Goal:** Replace hypotheses with the confirmed live state of the `learning-path-covers` bucket, its RLS policies, and the `learning_paths` cover columns on project `chyvhrbtttpumsyuhgbu`.

**Requirements:** R4 (and informs R1, R7)

**Dependencies:** None

**Files:**
- None (investigation). Findings recorded in this plan's "Deferred to Implementation" resolution and/or a short note appended to `docs/known-issues.yaml`.

**Approach:**
- Use the Supabase MCP (read-only) against the cloud project. Suggested checks:
  - `list_projects` / `get_project` → confirm the connected project ref is `chyvhrbtttpumsyuhgbu` (production), not a stale/self-hosted target.
  - `execute_sql` (read-only):
    - `select id, name, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'learning-path-covers';` → bucket existence + limits (tests H2/H3).
    - `select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%learning-path-covers%';` → confirm the four owner policies exist with the folder-prefix predicate (tests H1).
    - `select column_name from information_schema.columns where table_schema='public' and table_name='learning_paths' and column_name in ('cover_image_url','cover_preset');` → tests R7.
  - `list_migrations` → confirm whether `20260506000001` and `20260507000001` are recorded as applied on cloud.
  - `get_advisors` (security) → catch any RLS/storage advisories.
- If the Supabase MCP is not connected to the cloud project, follow these fallback procedures (arranged from most to least structured). After every fallback action, the operator **must** re-run the Unit 1 diagnostic queries to provably confirm the resulting state before proceeding to the next unit — document the result in this plan file or `docs/known-issues.yaml`.
  - **Supabase Dashboard — SQL Editor (structured, GUI-driven):**
    1. Log in to `https://supabase.com/dashboard/project/chyvhrbtttpumsyuhgbu` (the production project ref confirmed in step 1 above).
    2. Navigate to **SQL Editor** in the left sidebar and open a new query tab.
    3. For Unit 1 (read-only), paste and execute the diagnostic queries from the "Approach" section above one at a time. Copy and save the result rows as operator evidence.
    4. For Unit 2 (apply migration), paste the full contents of `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql` and execute.
    5. After each query, save a screenshot or copy the output — this operator log is the proof of state before transitioning units.
  - **Supabase Dashboard — Storage / Database inspectors (visual confirmation):**
    1. Navigate to **Storage** → `learning-path-covers` → **Policies** to visually confirm the four RLS policies are listed and each uses the folder-prefix predicate `(storage.foldername(name))[1] = auth.uid()::text`.
    2. Navigate to **Database** → **Tables** → `learning_paths` → **Columns** to confirm `cover_image_url` (type `text`) and `cover_preset` (type `text`) exist.
  - **`psql` fallback (requires cloud superuser connection string):**
    1. Obtain the connection string: Supabase Dashboard → Project Settings → Database → Connection string → URI (or from `SUPABASE_DB_URL` in Cloudflare Pages env vars). The password is visible in the dashboard — note it before starting.
    2. Connect: `psql "<postgresql://postgres:xxxx@db.chyvhrbtttpumsyuhgbu.supabase.co:6543/postgres>"`
    3. For Unit 1, execute queries directly: `psql "<conn>" -c "select id, name, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'learning-path-covers';"`
    4. For Unit 2, apply the migration: `psql "<conn>" -f supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql`
    5. Verify: re-run Unit 1 queries through psql and confirm the expected rows and policies are present.
  - **Cannot reach the dashboard or database at all:** The project may have been deactivated or the URL may be wrong. Pause. Verify the project ref `chyvhrbtttpumsyuhgbu` is correct in the Supabase dashboard and `.env.example`. Do not proceed to Unit 2 until live project access is restored.
- Optionally reproduce in-browser: sign in on prod, open Change Cover, attempt upload, and read the masked operator log line `[PathCoverUpload] Upload failed: { …, statusCode }` to capture the exact status code (403 vs 404).

**Execution note:** Investigation only — do not modify cloud state in this unit.

**Test scenarios:**
- Test expectation: none — read-only diagnosis. Output is the confirmed failure mode (H1/H2/H3) and column/migration status, which selects the exact remediation in Unit 2.

**Verification:**
- A written determination of: (a) bucket present? (b) which of the 4 policies present and their predicates, (c) cover columns present?, (d) migration rows present. This determination is the entry condition for Unit 2.

---

- [ ] **Unit 2: Repair the storage bucket + RLS policies (and cover columns) on Supabase Cloud**

**Goal:** Make the `learning-path-covers` bucket and its four owner-scoped RLS policies provably present and correct on the cloud project, and ensure `learning_paths` cover columns exist — so authenticated uploads succeed.

**Requirements:** R1, R2, R3, R4, R7

**Dependencies:** Unit 1 (confirmed failure mode)

**Files:**
- Use existing: `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql` (bucket + 4 policies, idempotent).
- Use existing: `supabase/migrations/20260506000001_learning_path_cover_columns.sql` (cover columns) — apply if Unit 1 shows columns missing.
- Modify only if Unit 1 reveals a divergence (e.g. H3 mime/size limit on the bucket): a new follow-up migration `supabase/migrations/<next-ts>_learning_path_cover_bucket_limits.sql` (+ matching `rollback/`) to set `allowed_mime_types`/`file_size_limit`. Do **not** edit historical migrations.

**Approach:**
- Apply `20260507000001` to the cloud project. Preferred: Supabase MCP `apply_migration` (name it to match the file so it is recorded in `supabase_migrations.schema_migrations`). Fallbacks: paste into dashboard SQL editor, or `psql "<cloud-conn>" -f supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql`.
- If Unit 1 shows the bucket exists but with a restrictive `allowed_mime_types` or low `file_size_limit` (H3), apply a small additive migration to relax it: allow `image/jpeg` (the upload always converts to JPEG) and keep `file_size_limit` at 2 MB. Keep it idempotent.
- If Unit 1 shows `learning_paths.cover_image_url` / `cover_preset` missing (R7), apply `20260506000001`.
- Reconcile migration history so both timestamps are recorded as applied (avoids re-running and keeps the audit meaningful).
- Because every statement is `ON CONFLICT DO NOTHING` / `DROP POLICY IF EXISTS` + `CREATE POLICY`, applying is safe whether the objects partially exist or not.

**Multi-session integration testing:** The integration test scenarios below (owner-RLS denial, anonymous denial) require a second authenticated session against the live project. Two approaches are available:

- **Option A (preferred — self-contained):** Create a dedicated test user via the app signup flow (`/register`) before running integration tests. Use a deterministic disposable email (e.g., `test-cover-rls-<env>@example.com`) and record credentials in a local `.env.test` file or as Playwright project env vars. After testing, delete the user via Supabase Dashboard → Authentication → Users, or clean up only the uploaded storage objects if the user record is harmless. This approach exercises the real auth flow and is the most faithful reproduction of the RLS denial.
- **Option B (manual setup):** Use the Supabase Dashboard → Authentication → Users page to create a secondary test user with a known email/password. Export its session token via browser dev tools or the `supabase.auth.signInWithPassword()` method, then inject the token into a second Playwright browser context (see the existing session-injection pattern in `tests/support/fixtures/local-storage-fixture.ts` for reference). This avoids a signup step in the test itself but requires knowing the password and handling token expiry.
- **RLS-specific assertion:** Whichever approach is chosen, the test must assert that a signed-in upload to `learning-path-covers/{otherUserId}/test.jpg` returns an HTTP 403 or equivalent denial error, confirming that the `auth.uid()::text = (storage.foldername(name))[1]` predicate denies cross-user writes. A 404 for the non-existent key is acceptable as long as the insert is blocked — the test should verify the response status code, not just the toast message text.

**Patterns to follow:**
- The idempotent bucket+policy structure already in `20260507000001` and `storage-setup.sql`.
- Rollback pattern in `supabase/migrations/rollback/20260507000001_learning_path_cover_storage_policies_rollback.sql`.

**Test scenarios:**
- Integration (live, post-apply): authenticated upload to `learning-path-covers/{ownUserId}/<pathId>.jpg` succeeds (was 403/404).
- Integration: re-upload to the same key triggers 409 → delete + re-insert and still succeeds (R2).
- Integration: authenticated upload to `learning-path-covers/{otherUserId}/x.jpg` is denied (R3 owner scoping preserved).
- Integration: anonymous/no-session upload is denied (policy is `TO authenticated`).
- Integration: public SELECT of an uploaded cover URL returns the image (display path).
- Idempotency: applying the migration twice does not error.
- Post-apply SQL re-check (same queries as Unit 1) shows bucket + 4 policies + cover columns present.

**Verification:**
- In the prod app, on `/learning-tracks` and `/learning-paths`: Change Cover → pick image → Save → success toast and the card shows the image. Replacing it again succeeds.
- Supabase dashboard → Storage → `learning-path-covers` → Policies lists the four policies.

---

- [ ] **Unit 3: Harden `uploadPathCover` diagnostics + add session preflight**

**Goal:** When a storage call fails, surface a precise, actionable message and operator log that distinguishes session/auth (401), policy-denied (403), bucket-missing (404), and too-large (413); and cheaply rule out token staleness (H4) with a pre-upload session check.

**Requirements:** R5 (and mitigates H4 for R1)

**Dependencies:** None (can run in parallel with Units 1-2). Lands behind Unit 2 for the user-facing fix, but is independent code.

**Files:**
- Modify: `src/lib/pathCoverUpload.ts`
- Test: `src/lib/__tests__/pathCoverUpload.test.ts`

**Approach:**
- **Split 401 vs 403.** Today both map to `STORAGE_UNAUTHORIZED` (line 188). Separate them:
  - 401 → session/token problem → keep "Try signing out and back in." (the only case where that advice is correct).
  - 403 → RLS policy denial → a distinct message (e.g. "Cover uploads aren't enabled for your account yet — this is a server configuration issue.") plus a clear operator log naming the bucket + policy expectation. 403 is an operator/deploy problem, not something the user can fix by re-login, so the copy must not imply otherwise.
- Keep 404 → `STORAGE_NOT_FOUND` and 413 → `STORAGE_TOO_LARGE` as-is; ensure the operator log includes `bucket`, masked key, and `statusCode` (already present at lines 195-198 — extend to include the resolved diagnostic category).
- **Session preflight (H4):** before the upload, call `supabase.auth.getSession()`; if there is no session or the access token is expired/within a small skew window, attempt `supabase.auth.refreshSession()` once. If it still cannot produce a valid session, throw `AUTH_REQUIRED`. This keeps `getUser()` for identity but guarantees a fresh token is what Storage receives. (Keep it minimal — `autoRefreshToken` already handles most cases.)
- No change to the happy-path contract (`{userId}/{pathId}.jpg`, JPEG conversion, public URL return).

**Execution note:** Test-first for the status-code → message mapping and the preflight branch — these are pure-ish branches that are easy to drive with mocked Supabase responses, matching the existing test's `vi.hoisted` mock shape.

**Test scenarios:**
- Happy path: valid session + successful upload returns the public URL (existing test still passes).
- Error path: upload returns `statusCode: 403` → throws the new policy-denied message (not the "sign out" copy); operator log records category `STORAGE_FORBIDDEN`/policy.
- Error path: upload returns `statusCode: 401` → throws the "sign out and back in" message.
- Error path: upload returns `statusCode: 404` → `STORAGE_NOT_FOUND`.
- Error path: upload returns `statusCode: 413` → `STORAGE_TOO_LARGE`.
- Edge case: `getSession()` returns null/expired and `refreshSession()` fails → throws `AUTH_REQUIRED`, no upload attempted.
- Edge case: `getSession()` expired but `refreshSession()` succeeds → upload proceeds with refreshed token.
- Regression: existing 409 delete+retry, unauthenticated, and unsupported-type tests still pass.

**Verification:**
- `npm run test -- pathCoverUpload` passes including new cases.
- Manually forcing a 403 (e.g. temporarily on a test project) shows the policy-denied message, not the misleading "sign out" copy.

---

- [ ] **Unit 4: Add a storage-config verification guard + operator runbook**

**Goal:** Prevent silent regression — make "the `learning-path-covers` bucket + 4 policies + cover columns exist on the target Supabase project" a checkable, repeatable assertion run after any deploy/environment change.

**Requirements:** R6

**Dependencies:** Unit 2 (the correct end-state to assert against)

**Files:**
- Create: `scripts/verify-storage-config.mjs` (Node, uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from env; never the anon key).
- Create: `docs/deployment/supabase-storage-setup.md` (runbook: how to apply `storage-setup.sql` / `20260507000001` to a new environment, and how to run the verifier).
- Modify: `package.json` (add a script, e.g. `"verify:storage": "node scripts/verify-storage-config.mjs"`).
- Modify (optional): CI workflow under `.github/workflows/` to run `verify:storage` against prod/staging post-deploy (read-only; fails the job if missing).

**Approach:**
- The script connects with the service-role key and asserts:
  - bucket `learning-path-covers` exists and is public with `file_size_limit >= 2 MB` and (if set) `allowed_mime_types` includes `image/jpeg`;
  - the four policies on `storage.objects` for the bucket exist (query `pg_policies`);
  - `public.learning_paths` has `cover_image_url` and `cover_preset`.
- Exit non-zero with a precise message naming what is missing and pointing at the runbook + migration to apply.
- The runbook documents: which migration/script to apply, the MCP/dashboard/psql options, and the `npm run verify:storage` command — closing the "manual step with no verification" gap that caused this recurrence.

**Per user rule:** This unit adds a script and edits `package.json`. If a new dependency is introduced (e.g. `@supabase/supabase-js` is already a dependency, so likely none), run the security vulnerability scan after the manifest change, fix only scanner-reported issues at the scanner's desired version, and re-scan. If the script reuses the existing `@supabase/supabase-js`, no manifest dependency change is needed and the scan is not triggered.

**Test scenarios:**
- Happy path: against a correctly configured project, the verifier exits 0 and prints a concise OK summary.
- Error path: against a project missing the INSERT policy, the verifier exits non-zero and names the missing policy + remediation.
- Error path: against a project missing the bucket, the verifier exits non-zero with the bucket-missing message.
- Edge case: missing `SUPABASE_SERVICE_ROLE_KEY` → clear "credentials not configured" error, exit non-zero (no silent pass).

**Verification:**
- Run `npm run verify:storage` against the repaired prod project → exits 0.
- Temporarily point it at a project without the policy → exits non-zero with actionable output.

---

- [ ] **Unit 5 (optional): Real-Supabase E2E for the cover upload happy path**

**Goal:** Lock in R1/R2 with an integration test that exercises the full upload against a real Supabase test project, so the regression cannot return undetected.

**Requirements:** R1, R2 (defense-in-depth)

**Dependencies:** Unit 2

**Files:**
- Create: `tests/e2e/learning-track-cover-upload-real-supabase.spec.ts` (tagged `@integration`, gated behind an env flag).
- Possibly reuse: a test-user helper analogous to the one described in known-issue `KI-E119-POST-003` (`tests/support/helpers/…`).

**Approach:**
- Follow the existing gated-integration pattern (`KNOWLUNE_INTEGRATION=1`, excluded from default `test:e2e`): create/sign in a test user against the test project, open Change Cover, upload a small fixture image via the hidden file input (`accept="image/…"`), assert success toast and that the card renders the public cover URL. Replace it once to exercise the 409 path. Clean up the storage object and user in `afterEach`.

**Execution note:** Start from a failing test against an un-repaired test project to prove it catches the bug, then confirm green after applying the migration.

**Test scenarios:**
- Happy path: signed-in test user uploads a JPEG → success toast, card shows image, object exists under `{userId}/`.
- Happy path: re-upload (replacement) → 409 path → success, new image.
- Negative: object cannot be written under another user's prefix (RLS).

**Verification:**
- `KNOWLUNE_INTEGRATION=1 npm run test:e2e -- learning-track-cover-upload-real-supabase` passes against the repaired test project; the same test fails against a project missing the policies.

## System-Wide Impact

- **Interaction graph:** `PathCoverDialog.handleSave` → `uploadPathCover` (Storage) → `updatePathCover` (Dexie + sync to `public.learning_paths`). Both `/learning-tracks` and `/learning-paths` use this exact path; fixing storage RLS fixes both. No other component consumes `uploadPathCover`.
- **Error propagation:** Storage status codes → `DIAGNOSTIC` messages → toast. Unit 3 sharpens the mapping so 403 (operator/deploy) is no longer disguised as a user-fixable session problem.
- **State lifecycle risks:** `updatePathCover` is optimistic and rolls back on failure; unchanged. The delete+insert (409) path is not atomic — last-write-wins for concurrent multi-device cover edits; acceptable and unchanged from plan 012.
- **API surface parity:** The same bucket/policy gap likely affects other buckets (`course-thumbnails`, `avatars`, `book-covers`, …) on cloud. Out of scope to fix here, but Unit 4's verifier and runbook are the reusable pattern; note this in the runbook.
- **Integration coverage:** Unit-test mocks cannot prove RLS on the live project — that is exactly the gap that let this persist. Unit 1 (live inspection), Unit 4 (verifier), and optional Unit 5 (real-Supabase E2E) cover what mocks cannot.
- **Unchanged invariants:** Owner-scoped RLS predicate `(storage.foldername(name))[1] = auth.uid()::text`; storage key `{userId}/{pathId}.jpg`; JPEG conversion + public-URL return contract; gradient-preset behavior; sync payload shape for `coverImageUrl` / `coverPreset`.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Supabase MCP not connected to the prod cloud project (`chyvhrbtttpumsyuhgbu`) | Confirm project ref in Unit 1 (`get_project`); fall back to dashboard SQL editor / `psql` with the cloud connection string. |
| Applying the migration to the **wrong** project (e.g. stale self-hosted target) | Unit 1 first verifies the connected project ref; the migration is idempotent and owner-scoped, limiting blast radius. |
| Service-role key handling in the verifier script (Unit 4) | Read from env only; never commit; document in runbook; never use the anon key. Do not log the key. |
| Bucket exists with a restrictive `allowed_mime_types` (H3) not covered by re-applying policies | Unit 1 inspects bucket limits; Unit 2 includes an additive limits migration only if needed. |
| 403 persists after applying policies (predicate mismatch — e.g. app userId ≠ `auth.uid()`) | Unit 1 captures the exact `qual`/`with_check`; the app uses `supabase.auth.getUser().id`, which equals the JWT `sub` used by RLS by definition — if it still mismatches, capture the JWT `sub` vs uploaded key prefix in Unit 1. |
| Cover columns missing on cloud (R7) cause post-upload sync failure even after storage works | Unit 1 checks columns; Unit 2 applies `20260506000001` if missing. |
| Recurrence on the next environment migration | Unit 4 verifier + runbook turn the silent manual step into a loud, automatable check. |

### Rollback Procedure

**When to rollback:** If applying the storage migration (Unit 2) causes a blocking regression — e.g., existing covers stop loading for users who already had working uploads, or the bucket becomes inaccessible even for public reads — revert to the pre-migration state. Note that the migration is designed to be additive and idempotent, so rollback should not normally be needed. Specific scenarios that warrant rollback:

1. Uploads succeed but stored images are not served publicly (SELECT policy regression) — indicating the `FOR SELECT` policy was accidentally dropped or broadened beyond `public`.
2. Applying the migration causes `supabase db push` or subsequent migrations to fail on cloud due to migration history conflicts.
3. The operator accidentally applies the migration to the wrong project (e.g., a staging or local project instead of production). In this case, identify the correct project via the dashboard, not by reverting the migration — the idempotent design means applying it to the right project is safe even if it was already applied to the wrong one.

**How to rollback:**

1. Run the existing rollback script against the cloud project: `supabase/migrations/rollback/20260507000001_learning_path_cover_storage_policies_rollback.sql`. This script drops the four named RLS policies (`DROP POLICY IF EXISTS` for select/insert/update/delete) and then deletes the bucket row from `storage.buckets`. Read the script content before running to confirm the exact statement order.

   - **MCP path:** `supabase db execute --file supabase/migrations/rollback/20260507000001_learning_path_cover_storage_policies_rollback.sql`
   - **Dashboard path:** Paste the rollback script into SQL Editor and execute.
   - **psql path:** `psql "<conn>" -f supabase/migrations/rollback/20260507000001_learning_path_cover_storage_policies_rollback.sql`

2. If the rollback script DROPs the bucket, verify the bucket is gone: `select count(*) from storage.buckets where id = 'learning-path-covers';` should return 0.

3. If cover columns (`cover_image_url`, `cover_preset`) were added by `20260506000001` and the rollback should also revert those, run the existing columns rollback script at `supabase/migrations/rollback/20260506000001_learning_path_cover_columns_rollback.sql` (which runs `ALTER TABLE ... DROP COLUMN IF EXISTS` for both columns).

4. Remove the migration timestamps from `supabase_migrations.schema_migrations` if they were recorded with SQL:

   ```sql
   delete from supabase_migrations.schema_migrations where version in ('20260506000001', '20260507000001');
   ```

**How to verify rollback succeeded:**

- In-browser: open `/learning-tracks` → Change Cover on any track. The upload should now produce the original error (`Not authorized` or `Cover storage not configured`), confirming the policies are removed.
- SQL: re-run the Unit 1 diagnostic queries — all four policies should be absent, and the bucket may or may not exist depending on the rollback script's approach.
- If the rollback was for a wrong-environment application, verify that no objects or policies exist for `learning-path-covers` in the correct environment, and apply the migration there instead.

**Resuming after rollback:**

- Rollback is a diagnostic step, not a permanent workaround. After rollback, diagnose the regression, fix the migration or deployment process, and re-apply from Unit 2. If the root cause is not obvious, log the issue in `docs/known-issues.yaml` and flag to the operator.

## Documentation / Operational Notes

- New runbook `docs/deployment/supabase-storage-setup.md`: applying storage buckets/policies to a new Supabase environment, plus `npm run verify:storage`.
- Append a resolution note to `docs/known-issues.yaml` once confirmed (the cover-RLS recurrence and its root cause: cloud-migration left storage policies unapplied), and cross-reference `supabase-cloud-sync-updated-at`.
- Deployment ordering: apply/verify the cloud migration (Unit 2) **before** relying on the user-facing fix; Unit 3 (client) can ship independently but the upload only works once Unit 2 lands on cloud.

## Sources & References

- **Prior plans:**
  - `docs/plans/2026-05-07-012-fix-learning-path-card-progress-ring-and-cover-rls-plan.md`
  - `docs/plans/2026-05-06-005-fix-learning-path-cover-gradient-preset-and-upload-rls-plan.md`
  - `docs/plans/2026-05-06-003-fix-learning-paths-card-behavior-and-cover-plan.md`
- **Code:** `src/lib/pathCoverUpload.ts`, `src/app/components/learning-path/PathCoverDialog.tsx`, `src/stores/useLearningPathStore.ts`, `src/lib/auth/supabase.ts`, `src/lib/__tests__/pathCoverUpload.test.ts`
- **SQL:** `supabase/migrations/20260507000001_learning_path_cover_storage_policies.sql`, `supabase/storage-setup.sql`, `supabase/migrations/20260506000001_learning_path_cover_columns.sql`
- **Known issues:** `supabase-cloud-sync-updated-at`, `oauth-cached-old-supabase-url`, `KI-E119-POST-003` (real-Supabase integration test pattern) in `docs/known-issues.yaml`
- **Env:** `.env.example` (prod project ref `chyvhrbtttpumsyuhgbu`)
