---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-evaluate-and-score', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-04-11'
workflowType: 'testarch-nfr-assess'
---

# NFR Assessment — Epic 109: Knowledge Pipeline (Highlights, Vocabulary, Export)

**Date:** 2026-04-11  
**Epic:** E109 (S01-S05)  
**Overall Status:** CONCERNS

---

Note: Based on direct code analysis of committed files. Build, lint, and migration correctness verified. No full E2E run performed.

## Scope

| Story | Name | Status |
|-------|------|--------|
| E109-S01 | Vocabulary Builder | done |
| E109-S02 | Daily Highlight Review with Spaced Repetition | done |
| E109-S03 | Highlight Export (Text, Markdown, CSV, JSON) | done |
| E109-S04 | Annotation Summary (Per-Book Highlights View) | done |
| E109-S05 | Cross-Book Search (Highlights + Vocabulary) | done |

---

## Executive Summary

**Assessment:** 4 PASS, 4 CONCERNS, 0 FAIL | **Blockers:** 0

**High Priority Issues:**

1. **S02 - Silent catch in HighlightReview load failure** - Catch path sets isLoading(false) and shows empty state with no toast. A Dexie error is visually indistinguishable from a legitimately empty library.
2. **S05 - In-memory full-table scan with no size cap** - SearchAnnotations loads all highlights + vocabulary on mount without any `.limit()`. The useMemo filter runs synchronously per keystroke (no useDeferredValue/debounce on the filter itself). At scale (>1,000 items) this could cause perceptible jank.

**Recommendation:** CONCERNS - both HIGH issues are addressable without architectural changes. No release blockers; all five features ship functionally.

---

## Performance Assessment

### Response Time (p95)

- **Status:** CONCERNS
- **Threshold:** No new synchronous O(n) operations at render time
- **Actual:**
  - **S05**: Full-table load of all bookHighlights + vocabularyItems on mount (no `.limit()`). URL-debounce (300ms) correctly applied, but the in-memory filter useMemo runs synchronously on every query state change before the debounce fires. For typical library sizes (<300 items) sub-millisecond; for power users (>1,000 items) could cause jank.
  - **S02 loadDailyHighlights**: Applies `.limit(80)` cap + client-side sort. Correct and bounded.
  - **S01/S03/S04**: No render-time O(n) concerns.
- **Evidence:** SearchAnnotations.tsx:71-79 (no limit); HighlightReview.tsx:47-50 (.limit(80) applied)

### Throughput

- **Status:** PASS
- **Actual:** Build 24.35s (vs 25.46s E108 baseline - improvement). PWA precache 307 entries (19.69 MB, +0.09 MB). No new npm dependencies. Pre-existing large chunks unchanged.
- **Evidence:** npm run build output (2026-04-11)

### Resource Usage

- **CPU:** CONCERNS - useMemo filter in SearchAnnotations.tsx:106 recomputes synchronously on every keystroke. No useDeferredValue applied.
- **Memory:** CONCERNS - SearchAnnotations loads all bookHighlights + vocabularyItems without any cap. Safe at personal library scale; unbounded for power users.

### Scalability

- **Status:** PASS
- **Actual:** All four export formats support per-book scoping. Progress callbacks wired to all formats. Minor: exportHighlightsAsObsidian duplicates the groupByBook logic (inline loop at lines 132-138) instead of using the shared helper at line 59.

---

## Security Assessment

### Authentication / Authorization

- **Status:** PASS - All five stories are client-side only. No new authenticated endpoints. All data via Dexie (IndexedDB). No cross-user access risk.

### Data Protection

- **Status:** PASS - All export formats generate files in-browser via Blob URLs. No data transmitted externally. safeFilename() properly sanitizes book titles. No dynamic code execution.

### Injection / Output Encoding

- **Status:** PASS
- **highlightMatch() in SearchAnnotations.tsx:38-52**: Renders matches as React nodes using JSX mark elements - no raw HTML injection possible. Regex escape correctly handles all metacharacters preventing regex injection. ReDoS risk is nil (escaped literal pattern, no nested quantifiers).
- **HighlightItem.tsx:43,51**: Renders textAnchor and note as plain React text nodes.
- **Export CSV**: Escaping follows RFC 4180. Correct.
- **HighlightItem.tsx:58**: cfiRange is URL-encoded before use in router Links.

### Compliance

- **Status:** PASS - Local-first PWA; no PII transmitted; all data stays in IndexedDB.

---

## Reliability Assessment

### Availability

- **Status:** PASS
- **S05**: Load failure caught, sets loadError state, renders error message, shows toast.error(). Cancellation on unmount implemented (cancelled flag).
- **S01 store**: All five operations (addItem, updateItem, deleteItem, advanceMastery, resetMastery) implement optimistic update + rollback + toast.error(). Excellent pattern.
- **S03**: Returns empty result on empty dataset, no thrown errors.

### Error Rate

- **Status:** CONCERNS
- **S02 HighlightReview load failure**: Catch path annotated silent-catch-ok but shows empty state with no user notification. A Dexie error and an empty library look identical.
- **S04 AnnotationSummary load** (AnnotationSummary.tsx:108-122): load() async function has NO try/catch. If the Dexie query throws, the error propagates as an unhandled promise rejection. loading state stays true indefinitely - infinite skeleton, no recovery path. This is the most significant fault-tolerance gap in E109.
- **S01 store**: All error paths correct.
- **S03 export**: Exceptions correctly propagated to caller (HighlightExportDialog).

### MTTR

- **Status:** PASS - Vocabulary undo-delete (S01, 4000ms Undo toast) well-implemented. Highlight review rating rollback uses refs to avoid stale closures (HighlightReview.tsx:101-109).

### Dexie Migration Correctness

- **Status:** PASS
- **v42** (vocabularyItems table): Additive-only, new table. No existing data affected.
- **v43** (bookHighlights index expansion adding lastReviewedAt + reviewRating): Index additions are non-destructive in Dexie v3 - existing rows default new index fields to undefined. Correct and safe.
- **Evidence:** schema.ts:1285-1292

### CI Burn-In

- **Status:** CONCERNS - npm run lint shows waitForTimeout() hard-wait warnings in test files (lines 255, 258, 276, 281). E2E specs committed for S02-S05. Burn-in validation not confirmed.

---

## Maintainability Assessment

### Test Coverage

- **Status:** PASS - E2E specs committed for S02 (105 lines), S03 (142 lines), S04 (139 lines), S05 (180 lines). All pages have data-testid attributes throughout indicating good test hook discipline.

### Code Quality

- **Status:** PASS
- npm run lint: 0 errors in E109-specific files. The 121 total lint errors are all pre-existing (Layout, figma components).
- AnnotationSummary.tsx:258 and HighlightItem.tsx:38 both use inline style for dynamic highlight color hex values. This is an appropriate exception (cannot express arbitrary hex as a Tailwind class). ESLint warns correctly but this is not a true violation.
- No hardcoded Tailwind color classes; design token ESLint rule passes.
- Build: PASS (24.35s, 0 errors).

### Technical Debt

- **Status:** CONCERNS - exportHighlightsAsObsidian() at highlightExport.ts:132-138 re-implements groupByBook inline. The shared groupByBook() helper at line 59 is used by text and json formats but not by the Obsidian format. Future grouping logic changes must be applied in two places.

### Documentation Completeness

- **Status:** PASS - highlightExport.ts has clear JSDoc listing all four formats and their evolution. useVocabularyStore.ts has complete JSDoc referencing the useHighlightStore pattern. The optimistic-update-with-ref-rollback pattern in HighlightReview.tsx:101-109 is novel and worth adding to engineering-patterns.md.

---

## Quick Wins

1. **Add try/catch to AnnotationSummary load** (Reliability) - HIGH - 15 mins
   - File: src/app/pages/AnnotationSummary.tsx:108
   - Prevents infinite skeleton; add toast.error() for user feedback
   - Validation: npm run lint clean

2. **Use shared groupByBook helper in exportHighlightsAsObsidian** (Maintainability) - LOW - 10 mins
   - File: src/lib/highlightExport.ts:132-138
   - Replace inline loop with groupByBook(allHighlights)

3. **Add useDeferredValue to SearchAnnotations filter** (Performance) - LOW - 30 mins
   - File: src/app/pages/SearchAnnotations.tsx:106
   - Wrap query in useDeferredValue(query) before passing to useMemo

---

## Recommended Actions

### Immediate - HIGH

1. **Add try/catch to AnnotationSummary.tsx load** - 15 mins - Pedro
   - src/app/pages/AnnotationSummary.tsx:108
   - On error: console.error + setLoading(false) + toast.error('Failed to load annotations. Please refresh.')

### Short-term - MEDIUM

2. **SearchAnnotations scale guard** - 30 mins
   - src/app/pages/SearchAnnotations.tsx:106
   - Option A: useDeferredValue(query) to defer filter
   - Option B: slice results to top 200 with indicator message

3. **HighlightReview load failure UX** - 30 mins
   - src/app/pages/HighlightReview.tsx:92-96
   - Distinguish error state from empty state; consider toast.error()

### Long-term - LOW

4. **groupByBook deduplication in exportHighlightsAsObsidian** - 10 mins
5. **Extract ref-rollback pattern to engineering-patterns.md** - 15 mins

---

## Evidence Gaps

- **Performance benchmark for S05 at scale**: No evidence in-memory search is performant for 500+ highlights + vocab items
- **Burn-in validation for E109 E2E specs**: Hard-wait warnings suggest potential flakiness; burn-in not confirmed

---

## Findings Summary

| Category | PASS | CONCERNS | FAIL | Status |
|----------|------|----------|------|--------|
| 1. Testability & Automation | 3 | 1 | 0 | CONCERNS |
| 2. Test Data Strategy | 3 | 0 | 0 | PASS |
| 3. Scalability & Availability | 3 | 1 | 0 | CONCERNS |
| 4. Disaster Recovery | 3 | 0 | 0 | PASS (N/A) |
| 5. Security | 5 | 0 | 0 | PASS |
| 6. Monitorability / Debuggability | 2 | 2 | 0 | CONCERNS |
| 7. QoS & QoE | 3 | 1 | 0 | CONCERNS |
| 8. Deployability | 3 | 0 | 0 | PASS |
| **Total** | **25** | **5** | **0** | **CONCERNS** |

**Score: 25/30 (83%) - Good foundation; 5 addressable concerns, 0 blockers**

---

## Gate YAML

```yaml
nfr_assessment:
  date: '2026-04-11'
  story_id: 'E109-S01-S05'
  feature_name: 'Knowledge Pipeline (Highlights, Vocabulary, Export)'
  adr_checklist_score: '25/30'
  categories:
    testability_automation: 'CONCERNS'
    test_data_strategy: 'PASS'
    scalability_availability: 'CONCERNS'
    disaster_recovery: 'PASS'
    security: 'PASS'
    monitorability: 'CONCERNS'
    qos_qoe: 'CONCERNS'
    deployability: 'PASS'
  overall_status: 'CONCERNS'
  critical_issues: 0
  high_priority_issues: 2
  medium_priority_issues: 2
  low_priority_issues: 2
  concerns: 5
  blockers: false
  quick_wins: 3
  evidence_gaps: 2
  recommendations:
    - 'Add try/catch to AnnotationSummary load (infinite skeleton on Dexie error)'
    - 'Improve HighlightReview load failure UX (silent catch looks like empty library)'
    - 'Add useDeferredValue or result cap to SearchAnnotations for large datasets'
    - 'Remove groupByBook duplication in exportHighlightsAsObsidian'
    - 'Run burn-in validation on E109 E2E specs'
```

---

## Sign-Off

- Overall Status: CONCERNS
- Critical Issues: 0
- High Priority Issues: 2 (AnnotationSummary infinite skeleton; SearchAnnotations unbounded load)
- Concerns: 5 total
- Evidence Gaps: 2

**Gate Status: CONCERNS - No blockers. Proceed with awareness.**

**Next Actions:**
- Fix AnnotationSummary try/catch as chore commit (HIGH, 15 mins)
- Review HighlightReview silent-catch UX (MEDIUM)
- Schedule useDeferredValue optimization for E110 or standalone chore
- Run burn-in before next dependent epic

**Generated:** 2026-04-11  
**Workflow:** testarch-nfr (manual code analysis)
