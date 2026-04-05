---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-05'
workflowType: 'testarch-nfr-assess'
inputDocuments:
  - docs/implementation-artifacts/stories/E88-S01.md
  - docs/implementation-artifacts/stories/E88-S02.md
  - docs/implementation-artifacts/stories/E88-S03.md
  - docs/implementation-artifacts/stories/E88-S04.md
  - docs/reviews/code/code-review-2026-04-05-E88-S01.md
  - docs/reviews/code/code-review-2026-04-05-E88-S02.md
  - docs/reviews/code/code-review-2026-04-05-e88-s03.md
  - docs/reviews/code/code-review-2026-04-05-e88-s04.md
  - docs/reviews/code/code-review-testing-2026-04-05-E88-S01.md
  - docs/reviews/code/code-review-testing-2026-04-05-E88-S02.md
  - docs/reviews/code/code-review-testing-2026-04-05-e88-s03.md
  - docs/reviews/code/code-review-testing-2026-04-05-e88-s04.md
  - docs/reviews/security/security-review-2026-04-05-E88-S01.md
  - docs/reviews/security/security-review-2026-04-05-e88-s03.md
  - docs/reviews/security/security-review-2026-04-05-e88-s04.md
  - docs/reviews/performance/performance-benchmark-2026-04-05-E88-S01.md
  - docs/reviews/performance/performance-benchmark-2026-04-05-e88-s03.md
  - docs/reviews/performance/performance-benchmark-2026-04-05-e88-s04.md
  - docs/reviews/qa/exploratory-qa-2026-04-05-E88-S01.md
  - docs/reviews/qa/exploratory-qa-2026-04-05-e88-s03.md
  - docs/reviews/qa/exploratory-qa-2026-04-05-e88-s04.md
  - src/services/OpdsService.ts
  - _bmad/tea/testarch/knowledge/adr-quality-readiness-checklist.md
  - _bmad/tea/testarch/knowledge/error-handling.md
---

# NFR Assessment — Epic 88: OPDS Catalogs and Advanced Sources

**Date:** 2026-04-05
**Epic:** E88 (4 stories: S01 OPDS Catalog Connection, S02 OPDS Catalog Browsing & Import, S03 Remote EPUB Streaming, S04 M4B Audiobook Import)
**Overall Status:** CONCERNS ⚠️

---

Note: This assessment summarizes existing evidence from story reviews, code review reports, security reviews, performance benchmarks, and exploratory QA. It does not re-run tests or CI workflows.

---

## Executive Summary

**Assessment:** 22 PASS, 5 CONCERNS, 0 FAIL

**Blockers:** 0 — No release blockers identified

**High Priority Issues:** 2
1. Credentials stored in plaintext in IndexedDB per-book (cross-story, pre-sync risk)
2. Component-level test coverage gaps in OpdsBrowser (AC2 has no component tests)

**Recommendation:** PROCEED with epic closure. Address the two HIGH issues as tech debt in upcoming stories. No blockers prevent release of E88 functionality.

---

## Performance Assessment

### Bundle Size

- **Status:** PASS ✅
- **Threshold:** No >25% regression from baseline (749 KB gzip: 214 KB)
- **Actual:**
  - E88-S01: No new dependencies, ~670 lines across 3 new files. Bundle unchanged.
  - E88-S02: No new dependencies. Bundle unchanged.
  - E88-S03: No new dependencies. Bundle: 749.10 KB raw / 214.26 KB gzip. No regression.
  - E88-S04: `music-metadata` (~200 KB gzipped) added as a **lazy-loaded** dependency. Main bundle: 214.81 KB gzip — no regression. music-metadata is code-split and excluded from initial load.
- **Evidence:** Performance benchmarks for S01, S03, S04 (S02 skipped — no new deps)
- **Findings:** All stories maintained bundle discipline. S04's music-metadata is correctly isolated behind dynamic `import()` and only loads on first M4B import. Initial bundle impact: 0 KB.

### Build Time

- **Status:** PASS ✅
- **Threshold:** Within normal range (< 90s)
- **Actual:** S01: 46.22s, S03: ~60s, S04: ~58s
- **Evidence:** Performance benchmark reports
- **Findings:** All builds within normal range. No regressions.

### Response Time (Network Fetch)

- **Status:** PASS ✅
- **Threshold:** User-facing fetch operations must have explicit timeouts preventing UI hangs
- **Actual:**
  - OPDS validation (`validateCatalog`): 10s AbortController timeout
  - OPDS catalog browsing (`fetchCatalogEntries`): 10s AbortController timeout
  - Remote EPUB streaming (`BookContentService`): 30s AbortController timeout (appropriate for large EPUB files)
- **Evidence:** `src/services/OpdsService.ts:13,58`, `BookContentService.ts` code review
- **Findings:** All fetch operations are bounded. The 30s EPUB timeout is deliberately longer than the 10s catalog timeout to accommodate large remote files on slow connections — this is appropriate. AbortController cleanup is correctly implemented with `clearTimeout` on both success and error paths.

### Runtime Memory

- **Status:** PASS ✅
- **Threshold:** No observable memory leaks; proper resource cleanup
- **Actual:**
  - Remote EPUB Cache API: LRU eviction capped at 10 books (`MAX_CACHED_BOOKS`)
  - Blob URL management: `URL.revokeObjectURL()` called before creating new ones and on unmount
  - Audio element: Singleton at module level, properly cleaned up
  - Cache write: Non-blocking (`.catch()` to avoid blocking main thread)
- **Evidence:** Performance benchmark E88-S03, code review E88-S04
- **Findings:** Memory management is sound. Cache is bounded. No leak patterns detected.

### Perceived Performance (QoE)

- **Status:** PASS ✅
- **Threshold:** Loading states shown during async operations; no blank screens
- **Actual:**
  - OPDS dialog: `loadCatalogs()` fires on dialog open (not on Library mount) — lazy loading
  - OPDS browser: Loading skeleton shown during feed fetch
  - Remote EPUB: "Loading from server..." indicator during fetch
  - M4B import: "Parsing chapters..." progress during metadata extraction
  - Chapter detection polling: 500ms interval (lightweight, not perceptible)
- **Evidence:** Exploratory QA E88-S01, code review E88-S02, QA E88-S03
- **Findings:** All user-facing async operations have appropriate loading indicators. The OPDS dialog is conditionally rendered (not mounted at page load), which is the correct pattern.

---

## Security Assessment

### Authentication & Credential Handling

- **Status:** CONCERNS ⚠️
- **Threshold:** Credentials must not be transmitted in cleartext where preventable; stored credentials must not expand the attack surface
- **Actual:**
  - **S01/S02 (OPDS catalogs):** Basic Auth headers correctly constructed with `btoa()`. Insecure HTTP check implemented (`isInsecureUrl()` exported from OpdsService). However, the HTTP warning is displayed to the user in UI but does not block credential transmission. Credentials stored per-catalog in IndexedDB.
  - **S03 (Remote EPUB):** `console.warn` emitted for HTTP URLs with credentials (BookContentService.ts:98-103). URL validation rejects non-http/https URLs before fetch (BookContentService.ts:87-93). UTF-8 TextEncoder + manual base64 encoding handles non-ASCII credentials per RFC 7617.
  - **S04 (M4B):** No credential handling — M4B is local file import, entirely client-side.
  - **Credential duplication (HIGH advisory):** When adding a book from OPDS (S02), catalog auth credentials are copied into each Book's `source.auth`. This means credentials are duplicated per-book in IndexedDB. If the user later changes catalog credentials, previously-added books retain old (stale) credentials. Future epic should reference the catalog ID instead.
- **Evidence:** Security reviews S01, S03, S04; code review S02
- **Recommendation:** Track credential-per-book duplication as HIGH tech debt. Before Supabase sync (Epic 19), either encrypt the auth fields or exclude them from sync. Add catalog ID reference pattern in a follow-up story.

### Input Validation

- **Status:** PASS ✅
- **Threshold:** No XSS or injection vectors introduced
- **Actual:**
  - XML parsing uses `DOMParser.parseFromString(text, 'application/xml')` — the safe mode. Does NOT execute scripts or load resources.
  - `parsererror` detection correctly catches malformed XML.
  - No parsed XML content is inserted into the DOM via `innerHTML` — only text content is extracted via `textContent`.
  - M4B metadata displayed via React text nodes (JSX) — XSS-safe by design.
  - S03 URL validation rejects `javascript:`, `file://`, `ftp://` protocols before fetch.
- **Evidence:** Security review S01 (INFO: DOMParser used safely), security review S03, security review S04
- **Findings:** No injection vectors identified across all 4 stories. The DOMParser approach is textbook-safe for XML ingestion in a browser context.

### Data Protection

- **Status:** CONCERNS ⚠️
- **Threshold:** Sensitive data (credentials) should be protected at rest
- **Actual:**
  - OPDS catalog auth (username/password) stored as plain strings in IndexedDB `opdsCatalogs` table.
  - Book `source.auth` stores credentials per-book as plain strings in IndexedDB.
  - IndexedDB is origin-sandboxed — other websites cannot read it. Browser extensions with `storage` permission can.
  - Risk materializes if Supabase sync (Epic 19) includes these tables — credentials would transmit and persist server-side in plaintext.
- **Evidence:** Security reviews S01, S02; code reviews S01, S02
- **Findings:** Acceptable for a local-first app pre-sync. Must be addressed before Epic 19. Recommend tracking in `docs/known-issues.yaml`.

### Secrets in Codebase

- **Status:** PASS ✅
- **Threshold:** 0 hardcoded secrets in diff
- **Actual:** All 4 stories passed secrets scan. No API keys, tokens, or hardcoded credentials in any changed files.
- **Evidence:** All security reviews
- **Findings:** Clean.

### Supply Chain

- **Status:** PASS ✅
- **Threshold:** New dependencies reviewed; no critical vulnerabilities in new deps
- **Actual:**
  - E88-S01, S02, S03: Zero new dependencies added.
  - E88-S04: `music-metadata` added (lazy-loaded). Supply chain risk to initial bundle: zero (dynamic import).
  - Existing `npm audit` shows 11 vulnerabilities (5 moderate, 6 high) in upstream build tooling (`@rollup/plugin-terser`, `workbox-build`, `vite-plugin-pwa`). These are pre-existing, not introduced by E88.
- **Evidence:** npm audit output, security review S04
- **Findings:** E88 introduces no new supply chain vulnerabilities. The 11 pre-existing audit findings are upstream build-tool issues and do not affect runtime security.

---

## Reliability Assessment

### Error Handling

- **Status:** PASS ✅
- **Threshold:** All async operations surface errors to the user; no silent failures; discriminated union pattern for service results
- **Actual:**
  - `OpdsService.validateCatalog()` and `fetchCatalogEntries()`: Return `{ ok: false; error: string }` for all failure modes (network, CORS, timeout, 401, 403, 500, invalid XML, non-OPDS). No silent catches — all catch blocks have `// eslint-disable-next-line error-handling/no-silent-catch -- returns discriminated error result` comments.
  - `BookContentService`: `RemoteEpubError` subclass with structured `code` property (`network`, `auth`, `not-found`, `server`, `timeout`) enables type-safe error handling without parsing error strings.
  - M4B import: All `try/catch` blocks surface errors via `toast.error()`. File size limit (2GB) enforced with user-facing toast.
  - OpdsBrowser: `handleAddToLibrary` does NOT wrap `importBook()` in try/catch — a LOW finding from code review S02 that could leave the "Add" button in a permanent loading state if `importBook` throws.
- **Evidence:** Code reviews S01-S04, security reviews
- **Findings:** Error handling is generally strong. The `importBook` error path in OpdsBrowser is a documented LOW gap. The discriminated union pattern is excellent and should be standardized across future service functions (as captured in E88-S01 lessons learned).

### Edge Case Coverage

- **Status:** PASS ✅
- **Threshold:** Known edge cases for the domain handled explicitly
- **Actual:**
  - OPDS empty catalog (0 entries): Valid — returns `{ ok: true, entryCount: 0 }`
  - OPDS relative URLs: `resolveUrl()` helper handles relative-to-absolute resolution
  - Navigation vs acquisition entry separation: Correctly identifies sub-feeds vs book entries
  - M4B without chapter markers: Single-chapter fallback with full duration
  - M4B with iTunes chapter format AND `metadata.chapters`: Both extraction paths handled with fallback logic
  - Remote EPUB server unreachable with cached version: `hasCachedVersion` flag on error enables "Read cached version" UI
  - Non-ASCII credentials: TextEncoder + manual base64 (RFC 7617 compliant)
  - Mixed M4B + MP3 selection: `toast.warning()` for non-M4B files
- **Evidence:** Code reviews S01-S04, test coverage reviews
- **Findings:** Domain-specific edge cases are well-handled. The M4B chapter variability (iTunes vs `metadata.chapters`) was correctly anticipated and implemented with fallbacks.

### CI Stability

- **Status:** CONCERNS ⚠️
- **Threshold:** `burn_in_validated: true` preferred before epic close
- **Actual:** All 4 stories have `burn_in_validated: false`.
- **Evidence:** Story frontmatter
- **Findings:** Burn-in was not run for E88. This is the same status as E87. For remote EPUB and OPDS features, burn-in would require a mock OPDS server (Playwright MSW intercept or a fixture server). The absence of burn-in validation is a known project-level gap, not specific to E88. Not a blocker.

### Fault Tolerance (Remote Book Availability)

- **Status:** PASS ✅
- **Threshold:** App must function gracefully when remote OPDS server is unavailable
- **Actual:**
  - Remote EPUB: On fetch failure, Cache API is checked for a previously cached version. If found, "Read cached version" button is shown. If not found, clear error message with retry option.
  - Reading progress, highlights, and bookmarks are stored in Dexie (local) by `bookId`, not file path — data survives server unavailability.
  - OPDS catalog browsing: Standard fetch error handling applies; CORS and connection errors surface actionable messages.
- **Evidence:** E88-S03 story, code review S03, exploratory QA S03
- **Findings:** The offline/unavailability story for remote books is solid. Local reading data (position, highlights) is decoupled from remote content availability. The Cache API fallback provides a good user experience for disconnected scenarios.

---

## Maintainability Assessment

### Test Coverage

- **Status:** CONCERNS ⚠️
- **Threshold:** Service-layer well-tested; critical UI flows have E2E coverage
- **Actual:**

  | Story | Unit Tests | E2E Tests | Status |
  |-------|-----------|-----------|--------|
  | S01 (OPDS Connection) | 11 tests (service + schema checkpoint) — all pass | `tests/e2e/regression/story-e88-s01.spec.ts` exists | ADEQUATE |
  | S02 (OPDS Browsing) | 24 tests (OpdsService parsing, pagination, format labels) — all pass | No E2E spec for browsing flow | PARTIAL |
  | S03 (Remote Streaming) | 16 tests (BookContentService, all error codes, LRU eviction) — all pass | No E2E spec (requires mock server) | ADEQUATE |
  | S04 (M4B Import) | 28 tests (M4bParserService, chapter extraction, fallbacks) — all pass | No E2E spec | ADEQUATE |

  **Coverage gaps identified:**
  - S02: No component tests for `OpdsBrowser`, `OpdsBookCard`, `NavigationCard`, `BreadcrumbTrail`
  - S02: No test for `isAlreadyInLibrary` (duplicate detection)
  - S02: No test for `handleAddToLibrary` error path
  - S02: No test for `getBookFormat` edge cases (MOBI/other formats)
  - S03: No test for URL validation (rejecting `javascript:`, `file://` schemes)
  - S03: No test for non-ASCII credentials (UTF-8 TextEncoder path)
  - S03: No test for HTTP insecure warning (`console.warn`)
  - Store: No unit tests for `useOpdsCatalogStore` CRUD operations (S01)

- **Evidence:** Code review testing reports S01-S04
- **Findings:** Service-layer test coverage is strong across all stories (75 total unit tests). The critical gap is component-level coverage for `OpdsBrowser` (S02), specifically the "Add to Library" flow (AC2). This is the most user-facing gap. Recommend addressing in a follow-up chore or during E88-S02 E2E story.

### Code Quality

- **Status:** PASS ✅
- **Threshold:** No hardcoded colors; ESLint passing; TypeScript strict; no major architectural debt
- **Actual:**
  - All stories: `lint`, `type-check`, `format-check` gates passed per story frontmatter
  - Design tokens used throughout (no hardcoded colors found by ESLint rule)
  - Brand button variants used correctly (`variant="brand"`, `variant="brand-outline"`)
  - `@/` import alias used consistently
  - `data-testid` attributes on all interactive elements
  - Discriminated union pattern for service results (eliminates try/catch in consumers)
  - Clean separation: service layer → state layer (Zustand) → UI layer
  - Architectural finding (S02 MEDIUM): Auth credentials stored per-book rather than by catalog reference — creates stale credential risk
- **Evidence:** All code reviews
- **Findings:** Code quality is high. The per-book credential duplication (S02) is the main architectural concern to address. Component size warnings in S01 (402 lines) and S02 (518 lines) are noted but not blockers.

### Technical Debt

- **Status:** CONCERNS ⚠️
- **Threshold:** No tech debt that blocks future work (particularly Epic 19 Supabase sync)
- **Actual:**
  - **Pre-sync blocking**: Credentials in `opdsCatalogs` and `Book.source.auth` are plaintext. Before Epic 19 sync, these must be encrypted or excluded from sync scope.
  - **Credential per-book duplication**: If catalog credentials change, stale credentials persist in all previously-added books. Catalog ID reference pattern would be cleaner.
  - **Component extraction**: `OpdsCatalogSettings.tsx` (402 lines) and `OpdsBrowser.tsx` (518 lines) both exceed size thresholds. Noted for refactoring.
  - **`handleAddToLibrary` error path**: Missing try/catch around `importBook()` could leave the Add button in a broken state.
- **Evidence:** Code reviews S01, S02
- **Findings:** All tech debt is documented and non-blocking for the current epic. The pre-sync credential concern is the highest-priority item for future planning.

### Documentation & Lessons Learned

- **Status:** PASS ✅
- **Threshold:** Non-empty lessons learned sections; key patterns documented
- **Actual:**
  - S01: 4 lessons learned (zero-dependency XML parsing, CORS friction, discriminated union pattern, schema checkpoint test pattern)
  - S03: 5 lessons learned (Cache API for binary data, RemoteEpubError structured errors, design token migration, AbortController pattern, non-ASCII credentials risk)
  - S04: 5 lessons learned (music-metadata browser compatibility, M4B chapter extraction variability, single/multi-file abstraction, sleep timer integration, OPFS simplicity)
  - S02: No dedicated lessons learned section (dev agent record section empty)
- **Evidence:** Story files
- **Findings:** 3 of 4 stories have substantive lessons learned. S02 lessons learned is empty — minor gap, not a blocker.

---

## Custom NFR Assessments

### OPDS Protocol Compliance

- **Status:** PASS ✅
- **Threshold:** Correct Atom namespace validation; handles both namespace forms; relative URL resolution
- **Actual:**
  - Validates `root.namespaceURI === ATOM_NS` OR `root.getAttribute('xmlns') === ATOM_NS` — handles both namespace declaration forms (inline and prefix)
  - OPDS link relations correctly parsed: `http://opds-spec.org/acquisition`, `http://opds-spec.org/image`, `http://opds-spec.org/image/thumbnail`, `rel="subsection"`, `rel="next"`
  - `resolveUrl()` correctly handles relative URLs (e.g., `/get/epub/42` → `https://server/get/epub/42`)
  - Navigation vs acquisition entry correctly distinguished by link type/rel attributes
- **Evidence:** `src/services/OpdsService.ts` code review
- **Findings:** OPDS 1.x compliance is solid. The namespace dual-check is important for real-world catalog compatibility.

### M4B Chapter Extraction Reliability

- **Status:** PASS ✅
- **Threshold:** Chapter extraction must handle variable M4B metadata structures with graceful fallback
- **Actual:**
  - Primary path: `metadata.chapters` (newer music-metadata versions)
  - Fallback path: `metadata.native['iTunes']` chapter atoms (encoder-specific)
  - iTunes tag filtering: Set membership (`ITUNES_CHAPTER_TAG_IDS.has()`) rather than substring — prevents false positives
  - No-chapter fallback: Creates single chapter spanning full duration
  - Type guards for `metadata.chapters` (safe interface + optional chaining)
  - 2GB file size limit enforced before parsing
- **Evidence:** Code review S04 (Round 2), test coverage review S04
- **Findings:** M4B extraction is defensively implemented. The variability in M4B chapter storage formats was correctly anticipated. 28 unit tests validate the extraction logic across all scenarios.

---

## Quick Wins

2 quick wins identified for immediate implementation (optional, no code changes required for epic close):

1. **Add `isAlreadyInLibrary` unit test** (Maintainability) - LOW effort (30 min)
   - Export the helper from `OpdsBrowser.tsx` and add a unit test for the duplicate detection logic.
   - No code changes needed in production code — test-only addition.

2. **Add URL validation unit tests for BookContentService** (Reliability) - LOW effort (20 min)
   - Test that `javascript:`, `file://`, `ftp://` URLs are rejected by the URL validation guard.
   - Increases confidence in the S03 security fix that has no test coverage.

---

## Recommended Actions

### Immediate (Before Epic 19 Sync) - HIGH Priority

1. **Encrypt or exclude OPDS credentials from Supabase sync scope** - HIGH - Medium effort - Dev
   - `opdsCatalogs.auth` and `Book.source.auth` are plaintext in IndexedDB
   - Before Epic 19, add encryption layer OR explicitly exclude these fields from sync
   - Validation: `books` and `opdsCatalogs` sync excludes `auth` fields OR they are encrypted at rest

2. **Refactor Book.source.auth to reference catalogId** - MEDIUM - Medium effort - Dev
   - Currently credentials are duplicated per-book at import time (OpdsBrowser.tsx:425-429)
   - Replace with `source.catalogId` reference; BookContentService resolves credentials at runtime from `opdsCatalogs` table
   - Validation: Changing catalog credentials reflects immediately in all books from that catalog

### Short-term (Next Milestone) - MEDIUM Priority

3. **Add component tests for OpdsBrowser AC2 flow** - MEDIUM - Medium effort - Dev/QA
   - Test `handleAddToLibrary` success and error paths
   - Test `isAlreadyInLibrary` duplicate detection
   - Test `getBookFormat` edge cases
   - Validation: AC2 coverage in test-coverage report changes from PARTIAL to COVERED

4. **Add try/catch around `importBook()` in handleAddToLibrary** - LOW - Minimal effort - Dev
   - Prevents Add button stuck in loading state on `importBook` throw
   - File: `OpdsBrowser.tsx` line 435
   - Validation: Error path shows toast.error and cleanup runs

### Long-term (Backlog) - LOW Priority

5. **Extract OpdsCatalogSettings sub-components** - LOW - Low effort - Dev
   - `OpdsCatalogForm` (form + test/save logic)
   - `OpdsCatalogListItem` (individual row with edit/delete)
   - Current: 402 lines in one file
   - Validation: Component passes ESLint size warning

6. **Add burn-in validation for OPDS and remote streaming specs** - LOW - Medium effort - QA
   - Requires mock OPDS server fixture (MSW or Playwright route intercept)
   - Run 10 iterations to validate stability
   - Validation: 10/10 passes on `story-e88-s01.spec.ts`

---

## Monitoring Hooks

3 monitoring hooks recommended:

### Security Monitoring

- [ ] **Track plaintext credential tables in sync blocklist** — Add `opdsCatalogs.auth` and `Book.source.auth` to a documented "pre-sync blocklist" until encrypted
  - Owner: Dev
  - Deadline: Before Epic 19 planning

### Performance Monitoring

- [ ] **Monitor `music-metadata` lazy-load timing on first M4B import** — Log time from file selection to chapter extraction complete. Target < 3s on typical device.
  - Owner: Dev
  - Deadline: During E88-S04 E2E test authoring

### Reliability Monitoring

- [ ] **Track Cache API eviction metrics** — Log when LRU eviction occurs (books > 10 cached). If eviction is frequent, consider increasing `MAX_CACHED_BOOKS`.
  - Owner: Dev
  - Deadline: Post-launch observation (2 sprints)

---

## Evidence Gaps

3 evidence gaps identified:

- [ ] **No E2E spec for OPDS browsing flow (S02)** — Owner: QA — Deadline: Next sprint — Suggested: Playwright spec with MSW OPDS feed mock — Impact: AC2 regression risk
- [ ] **No E2E spec for remote EPUB streaming (S03)** — Owner: QA — Deadline: Next sprint — Suggested: Playwright spec with route intercept for `/epub/*` — Impact: Remote book flow has no automated regression guard
- [ ] **No unit tests for `useOpdsCatalogStore` CRUD (S01)** — Owner: Dev — Deadline: Low priority — Suggested: Vitest store tests with Dexie mock — Impact: Store error paths (toast.error) untested

---

## Findings Summary

**Based on ADR Quality Readiness Checklist (8 categories, 29 criteria)**

| Category | Criteria Met | PASS | CONCERNS | FAIL | Overall Status |
|---|---|---|---|---|---|
| 1. Testability & Automation | 3/4 | 3 | 1 | 0 | CONCERNS ⚠️ |
| 2. Test Data Strategy | 3/3 | 3 | 0 | 0 | PASS ✅ |
| 3. Scalability & Availability | 3/4 | 3 | 1 | 0 | CONCERNS ⚠️ |
| 4. Disaster Recovery | 2/3 | 2 | 1 | 0 | CONCERNS ⚠️ |
| 5. Security | 3/4 | 3 | 1 | 0 | CONCERNS ⚠️ |
| 6. Monitorability, Debuggability & Manageability | 3/4 | 3 | 1 | 0 | CONCERNS ⚠️ |
| 7. QoS & QoE | 4/4 | 4 | 0 | 0 | PASS ✅ |
| 8. Deployability | 3/3 | 3 | 0 | 0 | PASS ✅ |
| **Total** | **24/29** | **24** | **5** | **0** | **CONCERNS ⚠️** |

**Criteria Met Scoring:**
- 24/29 (83%) = Room for improvement (threshold: 20-25 range)

**Category Details:**

**1. Testability & Automation (3/4)**
- 1.1 Isolation: ✅ Services fully mockable (`vi.stubGlobal('fetch', ...)`, `vi.doMock` for music-metadata)
- 1.2 Headless: ✅ All business logic in service layer (OpdsService, BookContentService, M4bParserService) — testable without UI
- 1.3 State Control: ✅ Dexie mock available; Zustand stores injectable
- 1.4 Sample Requests: ⚠️ No OPDS fixture server provided; E2E tests for browsing/streaming require mock OPDS server not yet set up

**2. Test Data Strategy (3/3)**
- 2.1 Segregation: ✅ Local-first app; test data isolated to test context (no cross-tenant risk)
- 2.2 Generation: ✅ Synthetic XML fixtures in unit tests; no production data used
- 2.3 Teardown: ✅ Vitest `beforeEach`/`afterEach` with mock cleanup; fake timers restored

**3. Scalability & Availability (3/4)**
- 3.1 Statelessness: ✅ All state in IndexedDB (Dexie) + Zustand; no in-memory session state
- 3.2 Bottlenecks: ✅ Remote fetch bounded by AbortController; Cache API capped at 10 books
- 3.3 SLA Definitions: ⚠️ No explicit SLA for remote OPDS/streaming availability (acceptable for personal-use feature)
- 3.4 Circuit Breakers: ✅ 10s/30s fetch timeouts serve as circuit breakers; no cascading failure risk (client-only)

**4. Disaster Recovery (2/3)**
- 4.1 RTO/RPO: ⚠️ No explicit DR plan (N/A for a PWA; user data in Dexie + OPFS survives browser restarts)
- 4.2 Failover: ✅ Cache API fallback when remote server unreachable
- 4.3 Backups: ✅ Local reading progress stored in Dexie (survives server loss); cached EPUBs persist in Cache API

**5. Security (3/4)**
- 5.1 AuthN/AuthZ: ✅ Basic Auth correctly implemented with HTTP warning; URL validation before fetch
- 5.2 Encryption: ⚠️ Credentials stored in plaintext IndexedDB (acceptable pre-sync; risk before Epic 19)
- 5.3 Secrets: ✅ No hardcoded secrets; all credentials user-provided at runtime
- 5.4 Input Validation: ✅ DOMParser safe mode; URL scheme validation; file size limit; React JSX escaping

**6. Monitorability (3/4)**
- 6.1 Tracing: ✅ Error types structured (`RemoteEpubError.code`, discriminated unions); errors surface to UI
- 6.2 Logs: ⚠️ `console.warn` for HTTP credentials; no structured logging or APM integration (acceptable for phase)
- 6.3 Metrics: ✅ Errors observable via toast notifications; `@sentry/react` already in dependencies
- 6.4 Config: ✅ Constants (`FETCH_TIMEOUT_MS`, `MAX_CACHED_BOOKS`) centralized and changeable

**7. QoS & QoE (4/4)**
- 7.1 Latency: ✅ Explicit timeouts prevent indefinite hangs; skeleton loading prevents blank screens
- 7.2 Throttling: ✅ N/A (client-side only; no server to rate-limit)
- 7.3 Perceived Performance: ✅ Skeletons, progress indicators, lazy-loaded dialogs
- 7.4 Degradation: ✅ Friendly error messages for all failure modes; no stack traces to user

**8. Deployability (3/3)**
- 8.1 Zero Downtime: ✅ PWA; Dexie schema migrations versioned (checkpoint pattern validated by tests)
- 8.2 Backward Compatibility: ✅ Schema version bumped (opdsCatalogs table); checkpoint tests validate migration
- 8.3 Rollback: ✅ Dexie schema has version history; IndexedDB migration is reversible to prior version

---

## Gate YAML Snippet

```yaml
nfr_assessment:
  date: '2026-04-05'
  epic_id: 'E88'
  feature_name: 'OPDS Catalogs and Advanced Sources'
  stories: ['E88-S01', 'E88-S02', 'E88-S03', 'E88-S04']
  adr_checklist_score: '24/29'
  categories:
    testability_automation: 'CONCERNS'
    test_data_strategy: 'PASS'
    scalability_availability: 'CONCERNS'
    disaster_recovery: 'CONCERNS'
    security: 'CONCERNS'
    monitorability: 'CONCERNS'
    qos_qoe: 'PASS'
    deployability: 'PASS'
  overall_status: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 2
  medium_priority_issues: 3
  concerns: 5
  blockers: false
  quick_wins: 2
  evidence_gaps: 3
  recommendations:
    - 'Encrypt or exclude OPDS credentials from Supabase sync scope before Epic 19'
    - 'Refactor Book.source.auth to reference catalogId to prevent stale credentials'
    - 'Add component tests for OpdsBrowser AC2 (handleAddToLibrary, isAlreadyInLibrary)'
```

---

## Related Artifacts

- **Story Files:** `docs/implementation-artifacts/stories/E88-S01.md` through `E88-S04.md`
- **Code Reviews:** `docs/reviews/code/code-review-2026-04-05-E88-S01.md` through `e88-s04.md`
- **Security Reviews:** `docs/reviews/security/security-review-2026-04-05-E88-S01.md`, `e88-s03.md`, `e88-s04.md`
- **Performance Benchmarks:** `docs/reviews/performance/performance-benchmark-2026-04-05-E88-S01.md`, `e88-s03.md`, `e88-s04.md`
- **Exploratory QA:** `docs/reviews/qa/exploratory-qa-2026-04-05-E88-S01.md`, `e88-s03.md`, `e88-s04.md`
- **Implementation:** `src/services/OpdsService.ts`, `src/services/BookContentService.ts`, `src/services/M4bParserService.ts`

---

## Recommendations Summary

**Release Blocker:** None. Epic 88 can be closed.

**High Priority:** 2 items — credential encryption/exclusion before Epic 19 sync, and catalog ID reference pattern. Both are tech debt items for future stories.

**Medium Priority:** Component test coverage for OpdsBrowser AC2; `importBook` error path guard.

**Next Steps:** 
1. Add E88 known issues to `docs/known-issues.yaml` for credential storage tech debt
2. Proceed to `/testarch-trace` for E88 requirements traceability
3. Proceed to `/retrospective` for E88 lessons learned aggregation

---

## Sign-Off

**NFR Assessment:**

- Overall Status: CONCERNS ⚠️
- Critical Issues: 0
- High Priority Issues: 2
- Concerns: 5 categories
- Evidence Gaps: 3
- ADR Checklist Score: 24/29 (83%)

**Gate Status:** PROCEED ✅

The 5 CONCERNS categories are all acknowledged risks with documented remediation plans. None block the epic from closing or the features from shipping. The architecture is sound, security posture is acceptable for a local-first pre-sync app, and performance impact is minimal across all 4 stories.

**Next Actions:**

- PROCEED to `/testarch-trace` and `/retrospective` for epic closeout
- TRACK credential storage as HIGH tech debt before Epic 19
- SCHEDULE component test additions for OpdsBrowser as a follow-up chore

**Generated:** 2026-04-05
**Workflow:** testarch-nfr v4.0

---

<!-- Powered by BMAD-CORE™ -->
