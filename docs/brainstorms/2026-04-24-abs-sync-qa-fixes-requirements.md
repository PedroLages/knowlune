# ABS Sync + Library QA Fixes — Requirements

**Date:** 2026-04-24
**Source:** Books page (`/library`) QA report, 2026-04-24
**Surface:** Library page + sync engine + ABS integration
**Scope:** 9 defects bundled (shared surface area)

## Problem Statement

QA of `/library` against the pre-configured ABS server `Home ABS (http://192.168.2.200:13378)` revealed that ABS sync is silently broken when the server is in `auth-failed` state, two core ABS data models (Series, Collections) have never been persisted, the Supabase sync engine triggers an HTTP 429 storm on every page load, and several filter/UI counters drift from the active source filter. The page misleads users into believing data is fresh and complete when neither is true.

## Goals

1. Make sync state honest: never claim "Synced" when the underlying server is unauthenticated; never silently no-op a user-initiated sync.
2. Complete the ABS data model so Series and Collections tabs render real data instead of empty states forever.
3. Stop the Supabase 429 storm on page load and ship the missing `review_records` migration.
4. Make filter counts and footers reflect the active source filter (no global lies).
5. Fix the most visible polish gaps (cover fallback, sync tooltip, empty-queue compression) without redesigning the page.

## Non-Goals

- Library page layout redesign.
- Multi-server ABS support (stay single-server).
- Reauth flows for non-ABS providers (OPDS, etc.).
- Any change to ABS pull semantics beyond adding Series + Collections fetches.
- Replacing the Supabase sync engine architecture (only throttle + missing migration).

## Users & Value

Pedro (sole beta user, dogfooding ABS sync). Today the Library page lies about sync status, hides 2 tabs of real content, and floods the Supabase server with 429s every navigation. After this work the page is trustworthy, complete, and quiet on the network.

---

## In-Scope Issues

### BLOCKER

#### B1 — Silent sync failure when ABS server status is `auth-failed`
**Current:** `audiobookshelfServers[0].status === 'auth-failed'` still renders a green "Synced" badge. Clicking the sync button bumps `updatedAt` locally but never calls the ABS API; no toast, no banner, no log surface.

**Required behavior:**
- When any configured ABS server is `auth-failed`, the per-source badge MUST render in a destructive/warning style (not success green) with text such as "Auth failed" or "Reconnect".
- Clicking the sync button while in `auth-failed` MUST NOT mutate `updatedAt` and MUST NOT pretend to sync.
- Click action MUST: (a) emit a destructive toast ("ABS authentication expired — reconnect to sync"), and (b) open the ABS settings dialog focused on the affected server with the API-key/credentials field ready for re-entry.
- After a successful re-auth, the next sync attempt proceeds normally and the badge returns to success state.

**Acceptance:**
- E2E: with seeded `auth-failed` server, badge text is not "Synced" and badge style is destructive.
- E2E: clicking the sync button opens the ABS settings dialog and shows a destructive toast; no network request is made to the ABS proxy.
- Unit: `updatedAt` is unchanged after the no-op click.

---

#### B2 — Series + Collections tabs are empty forever (no Dexie stores)
**Current:** `ElearningDB` (v590) has no `series` or `collections` object stores. ABS sync never fetches `/api/libraries/{id}/series` or `/api/libraries/{id}/collections`. The two tabs render the empty state permanently.

**Required behavior:**
- Add `series` and `collections` Dexie object stores in the next schema version (v591 or higher — pick whichever is next free).
- During every ABS sync run, fetch:
  - `GET /api/libraries/{libraryId}/series`
  - `GET /api/libraries/{libraryId}/collections`
  ...via the existing ABS Express proxy (Cloudflare strips CORS — see `project_abs_cors_proxy` memory).
- Persist results with LWW timestamps consistent with existing ABS records (same `updatedAt` semantics as books).
- Series tab MUST render the seeded series with name, book count, and links into the filtered books grid.
- Collections tab MUST render seeded collections similarly.
- Both tabs MUST scope to the currently selected source filter.

**Open product decisions (planning resolves):**
- Exact card composition for Series/Collections (cover stack vs single cover vs grid). Planning may copy ABS web UI conventions.
- Whether series/collections participate in the global Supabase sync mirror in this batch — DEFAULT: no, local-only this round (Supabase mirror deferred to a follow-up so we don't grow the 429 storm).

**Acceptance:**
- E2E with ABS fixture containing ≥1 series and ≥1 collection: both tabs render non-empty, counts match fixture.
- Unit: Dexie migration from v590 → new version succeeds without data loss for `books`, `audiobookshelfServers`, etc.

---

### HIGH

#### H1 — Cover 404 has no fallback (img element omitted entirely)
**Current:** Items whose `/items/{id}/cover` returns 404 render no `<img>` at all (e.g. `1aeba91e-8299-4805-b3d6-8637bbb35207`). Visually a hole; programmatically no alt text.

**Required behavior:**
- A reusable `<BookCoverFallback>` (or extension to existing cover component) renders when:
  - The cover URL is missing, OR
  - The `<img>` fires `onerror`.
- Fallback shows a muted-background tile with the book's first-letter initial in brand-soft tokens (or a neutral book glyph if title is missing) and accessible alt text "{title} — cover unavailable".
- Uses design tokens only (no hardcoded colors).

**Acceptance:**
- Unit: component renders fallback on `onError`.
- E2E: at least one card on the QA page renders the fallback (not an empty space) for the known-404 item.

---

#### H2 — Supabase 429 storm + missing `review_records` migration
**Current:** On `/library` mount, the Supabase sync engine fires 26 parallel table downloads. Self-hosted Supabase returns HTTP 429 for nearly all of them. `review_records` additionally returns 404 (table missing — schema drift).

**Required behavior:**
- `src/lib/sync/syncEngine.ts` MUST throttle parallel table downloads. Default cap: **4 concurrent** (configurable constant). Remaining tables wait their turn.
  - On 429, retry with exponential backoff (e.g. 250 ms → 500 ms → 1 s, max 3 retries) before surfacing failure.
  - 429s MUST NOT toast on every attempt — only after exhausted retries, and then deduped per table per session.
- Ship the missing Supabase migration that creates `review_records` (schema must match what the sync engine downloads/uploads — cross-reference existing TypeScript types).
- After this fix, a cold `/library` load against the prod Supabase instance MUST produce zero 429s under normal conditions and zero 404s for `review_records`.

**Acceptance:**
- Unit: sync engine never has more than N (default 4) in-flight downloads.
- Manual / E2E with network panel: cold load shows at most 4 concurrent Supabase requests at any instant; no 429 or 404 in network log on a healthy server.

---

### MEDIUM

#### M1 — Reading-status filter counts ignore source filter
**Current:** With ABS source selected (235 books), reading-status pills still show "All 239", "Reading X", etc. — counts derived from the global set, not the filtered set.

**Required:** All reading-status pill counts MUST recompute from the source-filtered book set. When source = ABS, "All" reads 235 (or whatever ABS subset count is); same for the per-status tallies.

**Acceptance:** E2E verifies pill counts equal source-filtered totals when toggling source filter.

---

#### M2 — Format filter tabs disappear in Series/Collections views
**Current:** Format tabs (e.g. Audio / eBook) silently vanish when Series or Collections tab is active, with no indication.

**Required:** Either (a) keep format tabs visible and apply them to the Series/Collections list, OR (b) explicitly render a "Viewing series" / "Viewing collections" mode label in the slot where filters live so users see why filters changed. Planning picks the implementation; product preference is **(a) keep visible** to minimize mode-switching surprise.

**Acceptance:** E2E: switching to Series tab does not silently remove the format tab control.

---

#### M3 — Storage footer always reads global total
**Current:** Footer reads `239 books` regardless of active source filter.

**Required:** Footer MUST EITHER scope to the currently filtered source ("235 books from ABS") OR explicitly label the figure as "239 books total (all sources)". Default: scope to current source, with the global figure shown as secondary text when a source filter is active.

**Acceptance:** E2E: changing source filter changes the footer book count.

---

### LOW

#### L1 — Sync button missing hover tooltip
**Current:** Accessible name exists; no visible tooltip on hover.

**Required:** Wrap the sync button in a Radix tooltip (shadcn/ui Tooltip) showing:
- Default state: "Last synced {relative time}" (e.g. "Last synced 2 minutes ago"), or "Never synced".
- `auth-failed` state: "Auth failed — click to reconnect".

**Acceptance:** E2E hover assertion shows tooltip text matching server state.

---

#### L2 — Empty reading-queue banner takes ~100 px when empty
**Current:** Empty-state banner for the queue is the same height as a populated banner.

**Required:** When the reading queue is empty, render a compact inline empty state (≤ 40 px tall) with a single line of muted text and an optional small "Add a book" link. Do not reserve hero-banner height.

**Acceptance:** E2E: when queue is empty, banner element height ≤ 40 px (or component matches a compact variant).

---

## Cross-Cutting Constraints

- **Design tokens only.** No hardcoded colors. Use `text-destructive`, `bg-brand-soft`, `text-muted-foreground`, etc. (see `.claude/rules/styling.md`).
- **Accessibility.** All new states keep WCAG 2.1 AA contrast and keyboard focus. Tooltip is keyboard-triggerable. Toasts are announced.
- **Tests.** Add Vitest unit tests for: sync-engine throttle, cover fallback, auth-failed no-op. Add Playwright E2E covering all 9 acceptance points; reuse existing ABS fixtures + add `auth-failed` and series/collections fixtures.
- **No regressions** to existing books sync, source filter, or layout.
- **ABS proxy.** All ABS calls continue through the Express proxy (CORS).
- **Dexie migration safety.** v590 → next version migration is purely additive; existing data preserved.

## Risk & Open Questions (deferred to planning)

- Exact retry/backoff curve for Supabase throttle (planning to confirm 250/500/1000 ms vs longer).
- Whether `review_records` migration is reverse-compatible with already-deployed clients (likely yes — additive table).
- Whether Series/Collections cards link into a dedicated detail view or just filter the books grid (default: filter the books grid; detail view is a future enhancement).
- Whether to also re-emit the missing migration through the standard Supabase migrations folder vs ad-hoc SQL (planning resolves; standard folder strongly preferred).

## Success Criteria

- A cold load of `/library` against a healthy Supabase instance produces zero 429s and zero 404s in the network panel.
- Auth-failed ABS server is unmistakable in the UI and cannot silently appear "Synced".
- Series and Collections tabs render real data for the configured ABS server.
- All counts and the storage footer agree with the active source filter.
- All 9 issues have passing automated coverage (Vitest + Playwright).

## Out of Scope (restated)

- Library page layout redesign.
- Multi-server ABS UX.
- Non-ABS provider reauth flows.
- Replacing the sync engine architecture beyond throttling.
- Mirroring `series` / `collections` to Supabase in this batch.
