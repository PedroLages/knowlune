# Open Known Issues Cleanup Plan

**Created:** 2026-04-06
**Context:** Post E104/E105 completion. 6 open KIs in known-issues.yaml — 2 already silently fixed, 2 deferred, 2 actionable.

---

## Current State (Verified)

| KI | Summary | Filed Severity | Actual Status |
|----|---------|---------------|---------------|
| KI-028 | EmbeddingWorker 8 console errors on page load | medium | **open** — placeholder worker tries to fetch model on init |
| KI-030 | 5 ESLint errors in non-story files | medium | **already fixed** — 0 errors now (KI-026/027 fixes covered these) |
| KI-033 | 110+ ESLint warnings | low | **partially improved** — now 73 src/ + 7 server/ = 80 warnings |
| KI-034 | OPDS credentials plaintext IndexedDB | high | **deferred to E19** — acceptable for local-first |
| KI-035 | CatalogListView buttons 36px touch targets | low | **already fixed** — buttons are now `size-11` (44px) |
| KI-036 | Unit test coverage 55%, 15pp gap to 70% | medium | **open** — needs ~60-80 unit tests, dedicated epic |

---

## Step 1: Housekeeping (no code changes)

Update known-issues.yaml status for silently-fixed items:

- **KI-030** → `status: fixed`, `fixed_by: chore-trivial-fixes-2026-04-05`
  - Verified: `npx eslint src/` returns 0 errors. The 5 errors overlapped with KI-026/KI-027 fixes.
- **KI-035** → `status: fixed`, `fixed_by: E88-S02` (or chore commit)
  - Verified: CatalogListView.tsx lines 73/84/93 already use `size-11` not `size-9`.

Also:
- Mark `epic-104: done` in sprint-status.yaml (only story E104-S01 is done, epic still says in-progress)
- Commit untracked E104 post-epic docs (completion report, retro, tracking)

**Commit:** `chore: mark E104 done, update resolved KIs (KI-030, KI-035)`

---

## Step 2: EmbeddingWorker Console Noise (KI-028)

**File:** `src/ai/workers/embedding.worker.ts`
**Problem:** Worker tries to load the Transformers.js model on initialization. When offline or model not cached, it produces 8 console errors. Not a bug — but pollutes dev console and E2E test logs.

**Fix options:**
1. **Lazy init** — Don't load model until first `embed` message arrives (recommended)
2. **Offline guard** — Check `navigator.onLine` before attempting fetch, skip silently if offline
3. **Retry with backoff** — Suppress errors after first failure, retry with exponential backoff

**Recommended:** Option 1 (lazy init). The worker should only load when actually needed, not on every page load. Add a try/catch around the pipeline init with a single `console.warn` instead of 8 uncaught errors.

**Commit:** `fix(ai): lazy-init embedding worker to suppress console noise on page load`

---

## Step 3: ESLint Warnings Reduction (KI-033)

**Current:** 80 warnings (73 src/ + 7 server/)

### Breakdown by category:

| Category | Count | Fix Strategy |
|----------|-------|-------------|
| component-size (>500 lines) | 17 | **SKIP** — architectural, needs dedicated refactoring epic |
| component-size (>300 lines, warn) | 20 | **SKIP** — same as above |
| error-handling/no-silent-catch | 9 | **FIX** — add `// silent-catch-ok` where intentional, `toast.error()` where user should see it |
| unused eslint-disable directives | 6 | **FIX** — just delete the comments |
| inline styles | 4 | **FIX** — convert to Tailwind utilities |
| server/ warnings | 7 | **FIX** — 2 silent-catch in server proxy files |

### Actionable (19 warnings):
- 9 silent-catch → review each, add annotation or toast
- 6 unused eslint-disable → remove dead comments
- 4 inline styles → convert to Tailwind

### Not actionable now (61 warnings):
- 37 component-size → architectural debt, needs component splitting epic
- These are warnings, not errors — no CI impact

**Expected result:** 80 → ~61 warnings (24% reduction)

**Commit:** `chore(lint): fix silent-catch annotations, remove dead eslint-disables, convert inline styles`

---

## Step 4: Update KI-033 Notes

After Step 3, update KI-033 in known-issues.yaml:
- Update notes: "Reduced from 110+ to ~61 warnings. Remaining 37 are component-size warnings requiring architectural refactoring. 24 are component-size at warn threshold (300-500 lines). No action needed until a dedicated component-splitting initiative."
- Keep `status: open` (still has warnings, just fewer)

---

## Deferred (No Action)

| KI | Why Deferred | When |
|----|-------------|------|
| KI-034 | OPDS credentials encryption — needs Supabase sync infra | E19 |
| KI-036 | Unit test coverage gap — needs ~60-80 new tests | Dedicated coverage epic |

---

## Execution Order

```
1. Step 1: Housekeeping commit (KI-030, KI-035, E104 status)     ~5 min
2. Step 2: Fix KI-028 embedding worker                            ~15 min
3. Step 3: Fix 19 actionable ESLint warnings                      ~20 min
4. Step 4: Update KI-033 notes                                    ~2 min
```

**Total:** ~40 min, 3 chore commits, 0 new stories needed.

**After this plan:** All KIs are either fixed, annotated with reduced scope, or explicitly deferred with a target epic.
