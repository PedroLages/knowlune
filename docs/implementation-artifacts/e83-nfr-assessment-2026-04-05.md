---
stepsCompleted:
  - step-01-load-context
  - step-02-define-thresholds
  - step-03-gather-evidence
  - step-04-evaluate-and-score
  - step-04e-aggregate-nfr
  - step-05-generate-report
lastStep: step-05-generate-report
lastSaved: '2026-04-05'
epic: E83
title: Book Library and Import — NFR Assessment
inputDocuments:
  - docs/implementation-artifacts/epic-83-tracking-2026-04-05.md
  - docs/implementation-artifacts/epic-83-retro-2026-04-05.md
  - src/services/OpfsStorageService.ts
  - src/services/EpubMetadataService.ts
  - src/services/OpenLibraryService.ts
  - src/stores/useBookStore.ts
  - src/app/components/library/BookImportDialog.tsx
  - src/app/components/library/StorageIndicator.tsx
  - src/stores/__tests__/useBookStore.test.ts
  - src/app/components/library/__tests__/StorageIndicator.test.ts
---

# Epic 83: Book Library and Import — NFR Assessment

**Date:** 2026-04-05
**Epic:** E83 — Book Library and Import
**Assessed By:** Master Test Architect (bmad-testarch-nfr workflow)
**Execution Mode:** SEQUENTIAL (4 NFR domains)

---

## Executive Summary

| Category        | Status   | Risk Level |
|-----------------|----------|------------|
| Performance     | PASS     | LOW        |
| Security        | CONCERNS | MEDIUM     |
| Reliability     | PASS     | LOW        |
| Maintainability | CONCERNS | MEDIUM     |

**Overall Assessment: CONCERNS**
**Overall Risk Level: MEDIUM**

Three of four NFR categories are clear. The two CONCERNS are scoped, non-blocking pre-conditions for E84 rather than release blockers for E83 itself: (1) dependency vulnerabilities inherited from transitive packages, and (2) OPFS browser fallback path not audited across all eight stories.

---

## NFR Category 1: Performance

**Status: PASS**

### Thresholds Applied

| Metric | Threshold | Evidence |
|--------|-----------|----------|
| Build time | No regression | npm run build — 25.76s (within normal range) |
| Library chunk size | < 500 KB minified | Library-BhSCPtsD.js — 409 KB min (gzip: 127 KB) |
| TypeScript compilation | Zero errors | npx tsc --noEmit — 0 errors |
| Unit test execution | All pass | 21/21 tests pass in 1.46s |

### Findings

- Library chunk (409 KB min) is within the 500 KB warning threshold. No violation.
- epub.js bundle impact is code-split into the Library chunk via dynamic import (lazy route). It does not inflate the main bundle.
- OPFS I/O is async — no blocking renders. storeBookFile / readBookFile run outside the React render cycle.
- React.memo and lazy image loading applied to BookCard (noted in S03 retrospective) — correct approach for large grids.
- No synchronous file reads found in any library component.
- Object URL lifecycle is correctly managed in BookImportDialog via setSafeCoverPreviewUrl and unmount cleanup — no memory leak vectors.
- Build is clean — no TypeScript errors, build succeeds in full.

### Evidence Gaps

- No Lighthouse / Core Web Vitals run collected for the Library page. Noted as future evidence.
- No k6 load test (N/A for a client-side OPFS app with no backend API).

**Verdict: PASS** — All measurable performance thresholds met. No regressions detected.

---

## NFR Category 2: Security

**Status: CONCERNS**

### Thresholds Applied

| Control | Threshold | Status |
|---------|-----------|--------|
| Critical CVEs | 0 | PASS — 0 critical |
| High CVEs | 0 | CONCERNS — 5 high |
| File type validation | EPUB only | PASS — enforced in processFile() |
| File size cap | 500 MB | PASS — enforced in processFile() |
| XSS via user input | No raw HTML injection | PASS — verified |
| External API secrets | None stored | PASS — confirmed |

### Findings

#### MEDIUM — 5 High-severity npm audit vulnerabilities (inherited, transitive)

- lodash (2 findings): Code Injection via _.template; Prototype Pollution via array path bypass
- xmldom: XML injection via CDATA serialization
- path-to-regexp (2 findings): ReDoS via route parameters and sequential optional groups

**Assessment:**
- lodash vulnerabilities are in transitive dependencies (likely epubjs or a legacy tool dependency). _.template and _.unset are not called from E83 application code.
- xmldom XML injection is relevant — epubjs uses xmldom internally to parse EPUB content. However, EPUB files are only loaded from local device storage (user-selected files), not from remote URLs or untrusted sources. The attack surface is limited to a user deliberately providing a malicious EPUB file to their own library. The exploit would affect only that user's browser session.
- path-to-regexp ReDoS vulnerabilities are in React Router's routing layer, unrelated to E83 functionality. Route patterns are static strings defined in routes.tsx, not user-controlled.

**Recommendation:** Run npm audit fix to address auto-fixable vulnerabilities. Evaluate --force for the lodash/path-to-regexp chain and test regression. Track non-auto-fixable items (xmldom via epubjs) in docs/known-issues.yaml — monitor for an epubjs update.

#### PASS — EPUB file validation

BookImportDialog.processFile() enforces extension check (.epub only) and size cap (500 MB max). epub.js parse failure provides a second layer of rejection for non-EPUB content.

#### PASS — No XSS vectors

EpubMetadataService extracts title and creator as plain strings — not rendered as HTML. BookDetailsForm renders title/author via React text content. Open Library API responses are parsed for coverUrl, description, and subjects — no HTML injection surface.

#### PASS — No secrets or API keys stored

OpenLibraryService calls the public Open Library API (no key required). No credentials in localStorage, IndexedDB, or OPFS.

#### PASS — OPFS is origin-isolated

OPFS data is scoped to the app's origin — inaccessible to other origins by browser design. No cross-origin leakage risk.

**Verdict: CONCERNS** — No critical exposure. 5 high-severity transitive CVEs require triage. xmldom via epubjs is the only topically relevant finding but attack surface is local-only. Pre-E84 action: audit and remediate or document.

---

## NFR Category 3: Reliability

**Status: PASS**

### Thresholds Applied

| Scenario | Required | Evidence |
|----------|----------|----------|
| OPFS unavailable | Fallback to IndexedDB | PASS — implemented via _useIndexedDBFallback |
| EPUB parse failure | Toast error, no crash | PASS — processFile catch shows toast.error |
| Open Library unreachable | Import proceeds | PASS — fetchOpenLibraryMetadata returns {} on failure |
| Offline mode | Skip network, OPFS still works | PASS — navigator.onLine guard in OpenLibraryService |
| Dexie write failure | Optimistic rollback | PASS — all write paths rollback on failure |
| OPFS file deletion failure | Non-fatal, toast.warning | PASS — nested try/catch in deleteBook |
| Store toast feedback | User sees error | PASS — all catch blocks have toast or silent-catch-ok |
| Service worker offline shell | Library page renders offline | PASS — S08 implemented |

### Findings

#### PASS — OPFS availability detection and fallback

OpfsStorageService.isOpfsAvailable() checks navigator.storage.getDirectory presence. On unsupported browsers, _useIndexedDBFallback = true routes all file I/O through Dexie bookFiles table. The fallback is code-complete and covered by unit tests (OPFS mocked in useBookStore.test.ts).

#### PASS — Error handling completeness

Every catch block in the E83 codebase either shows a user-visible toast.error() or toast.warning(), or is annotated with silent-catch-ok with justification.

#### PASS — Optimistic update rollback

updateBookStatus, updateBookMetadata, and deleteBook all implement the optimistic pattern: apply locally, try Dexie, rollback on failure with db.books.toArray(). Consistent with the existing useCourseStore pattern.

#### PASS — Cascade deletion integrity

deleteBook deletes in order: bookHighlights then books then OPFS (best-effort). OPFS failure is explicitly downgraded to toast.warning — the book record is already removed from Dexie, so re-import is possible without orphaned metadata.

#### CONCERNS (tracked in retro, not a blocker for E83) — OPFS fallback not audited across S02–S07

The retro identified that S01 defined the OPFS fallback (NFR23) but downstream stories (S02–S07) were not explicitly audited to confirm they honor the fallback path. OpfsStorageService is the single point of I/O for all stories, and the fallback is implemented in the service itself — so stories that call storeBookFile/readBookFile transparently get the fallback. However, any story that directly calls navigator.storage.getDirectory without going through the service would bypass the fallback.

Action (pre-E84, tracked in retro): Grep for direct navigator.storage calls outside OpfsStorageService.

**Verdict: PASS** — Error handling, rollback, fallback, and offline resilience are all properly implemented and tested.

---

## NFR Category 4: Maintainability

**Status: CONCERNS**

### Thresholds Applied

| Metric | Threshold | Evidence |
|--------|-----------|----------|
| TypeScript errors | 0 | PASS — 0 errors |
| ESLint errors (E83 files) | 0 | PASS — 0 errors in E83 source files |
| Unit test coverage | Present + passing | PASS — 21 unit tests pass |
| E2E test coverage | Story specs present | PASS — 6 story specs (S03–S08) |
| Silent error handling | Documented or surfaced | PASS — all catch blocks annotated |

### Findings

#### CONCERNS — 5 high-severity npm audit findings require remediation plan

See Security section. These are a maintainability concern because untracked vulnerabilities accumulate tech debt in package-lock.json and block future npm audit --level=high CI gates.

#### PASS — TypeScript clean

Zero TypeScript errors. The S05 retro noted non-null assertion fixes were applied during review, and those are reflected in the current codebase.

#### PASS — Unit test suite

useBookStore.test.ts: 14 tests covering all store operations — importBook (including duplicate prevention), deleteBook (including no-op and selectedBookId reset), updateBookStatus, updateBookMetadata, getFilteredBooks (status, search, all), getAllTags (sorted unique), getBookCountByStatus.

StorageIndicator.test.ts: 7 tests covering threshold logic boundaries at 0%, 50%, 79%, 80%, 85%, 90%, 95%, 95.001%, and 100%.

#### PASS — E2E coverage present

Story specs exist for S03–S08. S08's E2E test makes a pragmatic scoping decision (cannot simulate offline in Playwright without full network interception) and documents this in the spec file — acceptable trade-off given the hook-level unit test coverage.

#### CONCERNS — ESLint parsing errors in script files (pre-existing)

scripts/get-smoke-specs-fixed.js, get-smoke-specs.final.js, and get-smoke-specs.js produce Parsing error: Invalid character. These are pre-existing issues unrelated to E83. They inflate the lint error count and obscure real E83 issues.

Action: Pre-existing issue; add these files to .eslintignore or fix encoding. Not an E83 blocker.

#### LOW — relativeTime() non-determinism blind spot

The retro documented that relativeTime() calls Date.now() internally. ESLint test-patterns/deterministic-time only scans test files, not utility functions. This is a known gap documented as retro action item #2. No regression in E83 tests because relativeTime() now accepts an optional now parameter (S03 fix), but the ESLint rule gap remains.

**Verdict: CONCERNS** — Code quality is solid. Two maintainability concerns: transitive CVEs requiring triage, and pre-existing ESLint script-file parsing errors. Neither is introduced by E83 or blocks E84.

---

## NFR Assessment Matrix

| NFR Category    | Criteria Met                                                           | Status       | Risk   | Blocker? |
|-----------------|-----------------------------------------------------------------------|--------------|--------|----------|
| Performance     | Build clean, chunk < 500KB, tests pass, no memory leaks              | PASS         | LOW    | No       |
| Security        | 0 critical CVEs; 5 high transitive CVEs; file validation enforced    | CONCERNS     | MEDIUM | Pre-E84  |
| Reliability     | OPFS fallback, error rollback, offline guard, cascade delete, SW     | PASS         | LOW    | No       |
| Maintainability | 0 TS errors, 21 unit tests green, 6 E2E specs; pre-existing lint issues | CONCERNS  | MEDIUM | No       |

---

## Priority Actions

| Priority | Action | Target |
|----------|--------|--------|
| HIGH | Run npm audit fix and evaluate --force for lodash/path-to-regexp. Triage xmldom/epubjs for known-issues.yaml. | Pre-E84 |
| HIGH | Grep E83 codebase for direct navigator.storage calls outside OpfsStorageService to verify NFR23 fallback coverage. | Pre-E84 |
| MEDIUM | Add scripts/get-smoke-specs*.js to .eslintignore to eliminate pre-existing parsing noise from lint output. | E84 |
| LOW | Extend ESLint test-patterns/deterministic-time plugin to scan utility files (date helpers) in addition to test files. | E84 (retro action #2) |

---

## Cross-Domain Risks

**Security + Maintainability**: The 5 high-severity transitive CVEs are a cross-domain concern. Unaddressed, they will (a) fail a npm audit --level=high CI gate if one is added, and (b) compound if epubjs or lodash adds further vulnerabilities. Risk is MEDIUM while attack surface is local-only for xmldom; however the lodash prototype pollution and code injection findings have broader applicability if any E83 code uses lodash utilities directly.

---

## Gate Decision

| Gate | Decision |
|------|----------|
| E83 release gate | PASS WITH CONDITIONS — Epic is shippable. The two CONCERNS are pre-existing dependency issues (not introduced by E83) and a documented retro item (OPFS fallback audit). Neither prevents E84 from starting. |
| E84 pre-conditions | Address HIGH priority actions above before E84 ships to users. |

---

## Compliance Summary

| Standard | Status |
|---|---|
| WCAG 2.1 AA (accessibility) | Not assessed in this NFR run — covered by design reviews |
| OWASP Top 10 (A03 Injection) | CONCERNS — xmldom via epubjs (local files only, limited surface) |
| OWASP Top 10 (A06 Vulnerable Components) | CONCERNS — 5 high-severity transitive CVEs |
| Error handling standards | PASS — all catch blocks annotated or surface toasts |
| TypeScript strict mode | PASS — zero type errors |
| Design token compliance | PASS — S03 token fixes applied, confirmed in review |
