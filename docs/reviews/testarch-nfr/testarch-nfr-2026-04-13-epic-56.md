---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-13'
epic: E56
title: 'Knowledge Map Phase 1'
overallRisk: LOW
verdict: PASS
inputDocuments:
  - src/lib/topicResolver.ts
  - src/lib/knowledgeScore.ts
  - src/lib/knowledgeTierUtils.ts
  - src/stores/useKnowledgeMapStore.ts
  - src/app/components/knowledge/TopicTreemap.tsx
  - src/app/components/knowledge/FocusAreasPanel.tsx
  - src/app/components/knowledge/KnowledgeMapWidget.tsx
  - src/app/components/knowledge/TopicDetailPopover.tsx
  - src/app/pages/KnowledgeMap.tsx
  - src/app/routes.tsx
  - vite.config.ts
  - docs/reviews/security/security-review-2026-04-13-E56-S03-R3.md
  - tests/e2e/regression/knowledge-map-page.spec.ts
  - tests/e2e/regression/knowledge-map-widget.spec.ts
  - src/lib/__tests__/topicResolver.test.ts
  - src/lib/__tests__/knowledgeScore.test.ts
  - src/stores/__tests__/useKnowledgeMapStore.test.ts
---

# NFR Assessment — Epic 56: Knowledge Map Phase 1

**Date:** 2026-04-13
**Assessor:** Master Test Architect (bmad-testarch-nfr)
**Execution Mode:** sequential
**Overall Risk Level:** LOW
**Verdict:** PASS

---

## Executive Summary

Epic 56 introduces a local-first, read-only knowledge map feature: pure-computation scoring
libraries, a Zustand orchestration store, Recharts Treemap visualization, and a dedicated page
with a dashboard widget. All four NFR domains assessed at LOW risk. No blockers identified.

---

## NFR Domain Assessments

### A. Performance

**Risk Level: LOW**

| Category | Status | Evidence |
|---|---|---|
| Lazy-loaded route | PASS | `React.lazy(() => import('./pages/KnowledgeMap'))` in routes.tsx:116–118 |
| Recharts chunk isolation | PASS | `vite.config.ts` manual chunk: recharts + d3 → `chart` chunk (452 kB / 129 kB gzip). Loaded only when KnowledgeMap route is first visited. |
| KnowledgeMap page chunk | PASS | `dist/assets/KnowledgeMap-*.js` — 14 kB (tiny page-only chunk) |
| Build time | PASS | `npm run build` completes in 26.3 s |
| 30-second cache | PASS | `computeScores()` short-circuits if `elapsed < 30_000 ms` (store:113–116) |
| Promise.all DB fetch | PASS | All 6 Dexie tables fetched in a single `Promise.all` (store:122–130), minimizing sequential I/O |
| Pure-function libs | PASS | `topicResolver.ts` and `knowledgeScore.ts` are side-effect-free; O(n) complexity |
| ResponsiveContainer usage | PASS | `aspect={16/9}` with `minHeight={200}` prevents layout shift |

**Note:** The `chart` bundle (452 kB / 129 kB gzip) is shared with all chart consumers and loads
on first KnowledgeMap visit. This is a known architectural trade-off pre-existing before E56 and
not a regression introduced by this epic.

---

### B. Security

**Risk Level: LOW**

| Category | Status | Evidence |
|---|---|---|
| Raw HTML injection | PASS | Zero raw HTML injection patterns in all 5 knowledge components. Verified by code scan. |
| Data source isolation | PASS | All data sourced from local Dexie/IndexedDB only — no external API calls, no network inputs |
| Score data rendering | PASS | Numeric scores rendered via `Math.round()` + string templates, never as raw HTML |
| Topic name rendering | PASS | Topic names pass through `normalizeTopic()` → `toTitleCase()` → React text node |
| Navigation security | PASS | `useNavigate()` from React Router used exclusively — no `window.location` manipulation |
| Auth boundary | PASS | `/knowledge-map` route is nested inside the Layout-protected router tree. Local-first PWA — no server-side sensitive data exposure. |
| Prior security review | PASS | Security review R3 (2026-04-13) for E56-S03 confirmed no issues |
| Hardcoded credentials | PASS | No secrets or credentials present in any E56 file |

---

### C. Reliability

**Risk Level: LOW**

| Category | Status | Evidence |
|---|---|---|
| Loading state | PASS | `isLoading` renders Skeleton UI in KnowledgeMap.tsx:77–89 |
| Error state | PASS | `error` string displayed via `EmptyState` component (KnowledgeMap.tsx:91–101) |
| Empty state | PASS | `topics.length === 0` renders descriptive EmptyState (KnowledgeMap.tsx:103–113) |
| DB failure catch | PASS | `computeScores` try/catch sets `error` state with `error.message` (store:370–376) |
| Cache invalidation | PASS | `invalidateCache()` exposed for consumers to force recomputation |
| Widget cleanup pattern | PASS | `KnowledgeMapWidget` useEffect uses `ignore` flag to prevent stale state updates after unmount (widget:34–43) |
| Missing engagement data | PASS | Defaults to `365` days if no engagement found (store:308), producing conservative low-score via recency decay |
| Unreviewed flashcard edge case | PASS | Explicitly documented — unreviewed cards contribute retention=0 (store:270, `EC-HIGH` comment) |
| FocusAreasPanel empty guard | PASS | Returns `null` if `focusAreas.length === 0` — no render crash (FocusAreasPanel.tsx:31) |

**Minor Concern (advisory):** The store catch block uses `console.error` only — no toast notification
is surfaced to the user from within the store. User-visible error feedback exists on the dedicated
KnowledgeMap page via the `error` state → EmptyState path. The dashboard widget (`KnowledgeMapWidget`)
silently degrades to empty state, which is acceptable for a widget context. No remediation required.

---

### D. Scalability / Maintainability

**Risk Level: LOW**

| Category | Status | Evidence |
|---|---|---|
| Unit tests — libs | PASS | `topicResolver.test.ts`: 28 tests (294 lines); `knowledgeScore.test.ts`: 31 tests (318 lines) — pure functions fully exercised |
| Unit tests — store | PASS | `useKnowledgeMapStore.test.ts`: 11 integration tests (264 lines) covering score computation, caching, and empty states |
| E2E coverage | PASS | `knowledge-map-page.spec.ts`: ~58 test calls (198 lines); `knowledge-map-widget.spec.ts`: ~48 test calls (150 lines) |
| Shared tier utilities | PASS | `knowledgeTierUtils.ts` centralizes badge classes + labels — zero duplication between widget and page |
| Pure function design | PASS | `topicResolver.ts` and `knowledgeScore.ts` are pure with no DB access — trivially unit-testable |
| Code organization | PASS | Clean separation: lib (pure) → store (orchestration) → components (presentation) |
| Design tokens | PASS | SVG fills use CSS variables (`var(--success)`, `var(--warning)`, `var(--destructive)`) — dark/light mode safe |
| Recharts index signature | CONCERN | `[key: string]: unknown` on `TreemapDataItem` weakens type safety but is required for Recharts compatibility. Documented with inline comment. Acceptable trade-off. |
| Accessibility | PASS | ARIA labels on all interactive cells, `role="button"`, keyboard `Enter/Space` support, `aria-pressed` on category filters, `aria-label` on progress bars |

---

## Cross-Domain Risks

None identified. No performance/scalability interaction concern (dataset is local IndexedDB, not
server-scale). No security/reliability interaction concern (no external data, no auth mutation).

---

## Compliance

| Standard | Status |
|---|---|
| WCAG 2.1 AA | PASS — ARIA labels, keyboard navigation, design token contrast ratios |
| Local-first data isolation | PASS — no PII exposed to external services |
| Design token enforcement | PASS — ESLint `no-hardcoded-colors` satisfied throughout |
| Bundle size SLA | PASS — no new large chunks introduced; `chart` chunk pre-dates E56 |

---

## Priority Actions

None required. Advisory improvements for future epics:

1. **(ADVISORY)** Consider adding a toast notification in `KnowledgeMapWidget` error path if
   user-visible degradation feedback becomes a product requirement.
2. **(ADVISORY)** If Recharts is upgraded to v4+, revisit the `[key: string]: unknown` index
   signature — the new API may eliminate this requirement.
3. **(ADVISORY)** The shared `chart` chunk (452 kB) could be further split if recharts and other
   charting libs diverge in usage. Not a regression from E56.

---

## Domain Risk Summary

| Domain | Risk Level | Gate |
|---|---|---|
| Performance | LOW | PASS |
| Security | LOW | PASS |
| Reliability | LOW | PASS |
| Maintainability | LOW | PASS |
| **Overall** | **LOW** | **PASS** |

---

## Gate Decision

**PASS — Epic 56 is release-ready from an NFR perspective.**

All four NFR domains are LOW risk. No blockers. No waivers required.

Recommended next step: `/retrospective E56`
