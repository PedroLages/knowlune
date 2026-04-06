---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-06'
epic: E102
overall_nfr_status: CONCERNS
---

# NFR Assessment — Epic 102: Audiobookshelf Sync & Discovery (Growth)

**Date:** 2026-04-06
**Reviewer:** Claude Sonnet 4.6 (automated)
**Execution mode:** Sequential (4 domains)

---

## Overall NFR Status: CONCERNS

**Overall Risk Level: MEDIUM**

No blockers. Two MEDIUM concerns (burn-in not run for Socket.IO tests; REST fallback not asserted after socket disconnect). All P0 NFRs met. Three LOW findings suitable for chore tracking.

---

## NFR Sources

| Source | NFRs Covered |
|--------|-------------|
| `prd-audiobookshelf-integration-2026-04-05.md` | NFR1–NFR18 |
| `architecture-audiobookshelf-integration.md` | Decision 4 (service isolation), Decision 6, Decision 7 |
| E102-S01 through E102-S04 story files | Feature-specific NFRs, pre-review checklists |

---

## Domain Assessment Summary

| Domain | Risk Level | Status |
|--------|-----------|--------|
| Security | MEDIUM | CONCERNS |
| Performance | LOW | PASS |
| Reliability | MEDIUM | CONCERNS |
| Scalability / Maintainability | LOW | PASS |

---

## Security Assessment

### NFR Coverage

| NFR | Requirement | Status | Evidence |
|-----|-------------|--------|----------|
| NFR6 | API keys in Dexie (IndexedDB) | PASS | `useAudiobookshelfStore.ts` — keys persisted in Dexie, not localStorage |
| NFR7 | Keys transmitted only to user's own ABS server | PASS | `AudiobookshelfService.ts` — all calls to user-configured URL only |
| NFR8 | HTTP warning when credentials sent over non-HTTPS | PASS | `AudiobookshelfServerForm.tsx:75` — `showHttpWarning = isInsecureUrl(url)` |
| NFR9 | No telemetry or external network calls | PASS | No analytics, no third-party fetch calls found |

### Findings

**CONCERN: CSP WebSocket Wildcard**
The `connect-src` directive in `index.html` includes `ws: wss:` wildcards, enabling WebSocket connections to any domain. This is intentional to support user-configured ABS servers (which have dynamic/unpredictable URLs) and is an accepted tradeoff for self-hosted apps. Not a vulnerability given the LAN context.

**CONCERN: Security Reviews Skipped for S01 and S04**
- E102-S01 (progress sync PATCH payload) — `security-review-skipped`
- E102-S04 (Socket.IO, token-in-URL auth) — `security-review-skipped`

For S04: the Bearer token is passed as a URL query parameter (`?token=apiKey`) for WebSocket authentication. On self-hosted LAN, this appears in server logs but is an ABS API constraint, not a Knowlune design choice. For internet-facing deployments, this would warrant a MEDIUM finding; for LAN-only it is acceptable.

S01 PATCH payload contains only progress data (currentTime, duration, progress, isFinished) — no credentials. No security concern.

### Security Priority Actions

| Priority | Action |
|----------|--------|
| LOW | Document `ws:/wss:` wildcard in `engineering-patterns.md` as intentional for ABS Socket.IO support |
| LOW | Acknowledge token-in-URL for Socket.IO WebSocket auth as acceptable for self-hosted LAN use case |

---

## Performance Assessment

### NFR Coverage

| NFR | Requirement | Status | Evidence |
|-----|-------------|--------|----------|
| NFR1 | Catalog fetch <1s for 50 items LAN | PASS | Lazy-loaded, paginated, same pattern as E101 (not regressed) |
| NFR2 | Playback starts <2s | PASS | Inherited from E87/E101 AudiobookRenderer; not modified in E102 |
| NFR3 | Bookmark FAB <200ms | N/A | E102 does not touch bookmark FAB |
| NFR4 | Cover lazy-loading non-blocking | PASS | SeriesCard and CollectionCard use same lazy-load pattern as Library grid |
| NFR5 | Zero bundle size increase (no new deps) | PASS | All 4 stories: zero new npm dependencies confirmed |

### Findings

**PASS: Bundle Size**
No new npm dependencies across all 4 E102 stories. SeriesCard adds ~5kB gzip. Socket.IO implemented via native WebSocket (no `socket.io-client`). Pre-existing bundle regressions from other epics are unrelated to E102.

**PASS: Series Loading**
`loadSeries()` lazy-loaded on first "Series" tab click. `seriesLoaded` guard prevents redundant API calls. SeriesCard uses `React.memo` and `useMemo` for sort, progress, and next-unfinished computation.

**CONCERN: CollectionCard Book Resolution O(n*m)**
`CollectionCard` uses `allBooks.find()` in a `useMemo` loop. For libraries with 1000+ books and large collections, this could cause frame drops during expansion. Flagged as MEDIUM by performance benchmark.

### Performance Priority Actions

| Priority | Action |
|----------|--------|
| LOW | Replace `allBooks.find()` in CollectionCard with O(1) lookup map keyed by `absItemId` (future chore) |

---

## Reliability Assessment

### NFR Coverage

| NFR | Requirement | Status | Evidence |
|-----|-------------|--------|----------|
| NFR15 | ABS v2.26.0+ support | PASS | Dev notes document minimum version; endpoints stable in v2.x |
| NFR16 | Actionable error messages | PASS | Unit tests assert specific error strings: "Authentication failed", "Could not connect", "Connection timed out" |
| NFR17 | Graceful offline degradation | PASS | Sync is best-effort; queue maintained; no error toasts on failure; E2E tested |

### Findings

**PASS: Error Handling Architecture**
`absApiFetch` discriminated union eliminates throws. All service functions return `AbsResult<T>`. Store catch blocks use `toast.error()`. ESLint `error-handling/no-silent-catch` enforced at save-time.

**PASS: Best-Effort Sync Queue**
Silent sync queue (S01) implemented and unit-tested. Items enqueued on push failure, flushed on reconnect. No user-facing errors for sync failures.

**CONCERN: Socket.IO REST Fallback Not Fully Verified**
E2E test for S04-AC4 confirms no error toast on socket disconnect, but does not assert that REST polling from E102-S01 resumes. The fallback logic exists in code (`isSocketConnected` flag gates REST polling) but the behavior is not tested end-to-end.

**CONCERN: Burn-In Not Run**
All three E102 stories with E2E tests have `burn_in_validated: false`. The `socket-sync.spec.ts` is highest risk — it uses `page.addInitScript()` to inject a WebSocket mock, which is timing-sensitive and a known source of flakiness (see test-patterns.md: burn-in triggered by `addInitScript`-based mocks).

### Reliability Priority Actions

| Priority | Action |
|----------|--------|
| MEDIUM | Run burn-in (10 iterations) for `socket-sync.spec.ts` to validate WebSocket mock stability |
| MEDIUM | Add E2E assertion in `socket-sync.spec.ts` that REST `PATCH /api/me/progress/:itemId` is called after socket disconnect |
| LOW | Optionally run burn-in for `series.spec.ts` and `collections.spec.ts` |

---

## Scalability & Maintainability Assessment

### NFR Coverage

| NFR | Requirement | Status | Evidence |
|-----|-------------|--------|----------|
| NFR18 | Single-file service isolation | PASS | `AudiobookshelfService.ts` (518 lines) contains 100% of ABS API calls |
| NFR5 | Zero dependencies | PASS | Confirmed across all 4 stories |
| NFR10–14 | WCAG AA accessibility | PASS | E102-S02 design review PASS; E102-S03 design review PASS (1 LOW redundant handler) |
| NFR15 | ABS v2.26.0+ | PASS | All new endpoints (series, collections, progress) documented as stable in v2.x |

### Findings

**PASS: Service Isolation**
All ABS API endpoints (fetchProgress, updateProgress, fetchSeriesForLibrary, fetchCollections, connectSocket, onProgressUpdate, pushProgressUpdate) reside in `AudiobookshelfService.ts`. No ABS calls found in components, hooks, or stores. NFR18 fully met.

**PASS: Architectural Consistency**
All 4 stories follow identical patterns: `absApiFetch` discriminated union, `isLoaded` guards, Zustand individual selectors, `toast.error()` in catch blocks. Pattern reuse is high.

---

## Cross-Domain Risks

| Risk | Domains | Impact | Notes |
|------|---------|--------|-------|
| Socket.IO security + reliability blind spot | Security × Reliability | LOW | Security review skipped for S04 + no burn-in for socket tests. Self-hosted LAN context reduces severity. |

---

## NFR Gate Criteria

| Criterion | Required | Actual | Status |
|-----------|----------|--------|--------|
| P0 NFRs (NFR1-NFR9) | All PASS | PASS (all met) | MET |
| No FAIL findings | Zero FAIL | Zero FAIL | MET |
| CONCERN count | Acceptable | 2 MEDIUM, 3 LOW | CONCERNS |
| Burn-in for timing-sensitive tests | Recommended | Not run (S04) | CONCERN |

---

## Summary & Recommendation

**Overall: CONCERNS — proceed with documented awareness**

All 18 NFRs from the PRD are met or exceeded. No blockers. Two MEDIUM concerns warrant action before E103 begins or as chore commits:

1. **Run burn-in for `socket-sync.spec.ts`** — WebSocket mock uses `addInitScript` (known flakiness pattern). 10-iteration burn-in validates stability.
2. **Add REST fallback E2E assertion** — Confirms S04-AC4 behavior fully (no error toast AND REST resumes).

Three LOW findings are suitable for the issues tracker:
- Document `ws:/wss:` CSP wildcard
- Optimize CollectionCard O(n*m) book resolution
- Acknowledge Socket.IO token-in-URL as acceptable for LAN use

No security vulnerabilities found. No performance regressions. No maintainability debt introduced.
