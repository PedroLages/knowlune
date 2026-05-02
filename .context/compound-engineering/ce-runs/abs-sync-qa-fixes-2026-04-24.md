---
schemaVersion: 1
slug: abs-sync-qa-fixes
status: active
stage: phase-0
runMode: autopilot-auto-deepen
startedAt: 2026-04-24T01:40:00Z
updatedAt: 2026-04-24T01:40:00Z
lastGreenSha: 273715eff2d83d33a1b04ee4801bc38f29cc86e7
input: |
  Fix ALL 9 issues from Books page QA report 2026-04-24 covering ABS sync,
  Series/Collections schema, cover fallback, count inconsistencies, filter
  UX, Supabase 429 storm, sync-button tooltip, reading-queue banner.
stagesCompleted: []
artifacts: {}
errors: []
policies:
  autoDeepenOnLowScore: true
  autoApproveThreshold: 85
---

# CE Run — ABS sync QA fixes (2026-04-24)

## Phase 0 — Classify & Initialize
- Autopilot with auto-deepen policy: if plan-critic score ≤ 85 → auto-dispatch ce-plan-deepener; if > 85 → auto-approve.
- Last-green SHA: 273715eff2d83d33a1b04ee4801bc38f29cc86e7 (main).

## Scope (all 9 issues from QA report)

### 🔴 BLOCKER
1. **Sync silently fails when `status: auth-failed`** — no toast/banner, red dot only, Supabase "Synced" badge contradicts. Clicking Sync bumps `updatedAt` with no API call. Fix: surface error, route to ABS settings / prompt re-auth, persistent destructive toast.
2. **Series + Collections never populate** — no `series` / `collections` Dexie stores exist. Fix: add stores, fetch `/api/libraries/{id}/series` + `/collections` during sync, persist, render.

### 🟠 HIGH
3. **Cover 404 → no fallback** — missing `<img>` node entirely for failed covers. Fix: placeholder component with book initials / icon fallback.
4. **(pre-existing) Supabase 429 storm** — 26 tables download in parallel on load; `review_records` 404 (missing migration). Fix: throttle/rate-limit parallel downloads, run missing migration.

### 🟡 MEDIUM
5. **Count inconsistency** — reading-status tabs show global 239 when ABS source (235) is selected. Fix: recompute counts from filtered set.
6. **Format filter tabs disappear in Series/Collections views** — no visual indication. Fix: either keep visible with explanation or label the mode change.
7. **Storage footer always shows total 239** — label as "total across sources" or scope to current source.

### 🟢 LOW
8. **Sync button tooltip missing** — no hover tooltip text shown. Fix: add Radix tooltip with "Last synced X ago / Auth failed".
9. **"Reading queue is empty" banner takes ~100px when empty** — compress empty state.
