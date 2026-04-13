---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-04-13'
epic: 'E71'
epic_name: 'Knowledge Map Contextual Action Suggestions'
---

# Traceability Report — Epic 71: Knowledge Map Contextual Action Suggestions

**Generated:** 2026-04-13
**Stories:** E71-S01 (10 ACs), E71-S02 (13 ACs), E71-S03 (12 ACs)
**Total ACs:** 35

---

## Gate Decision: FAIL

**Rationale:** Overall coverage is 54% (minimum: 80%) and P1 coverage is 67% (minimum: 80%). The entire E71-S02 component story has zero dedicated tests — 11 ACs have no test coverage whatsoever, including 4 P1 ACs covering ActionCard visual rendering, accessibility ARIA, and `useKnowledgeMapStore.getSuggestedActions()` store getter integration. The `SuggestedActionsPanel` show-more/less toggle, tablet layout, and all ActionCard visual variants are unverified.

---

## Coverage Summary

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Total ACs | 35 | — | — |
| Fully Covered | 19 (54%) | ≥80% | FAIL |
| Partially Covered | 5 | — | — |
| Uncovered | 11 | — | — |
| P0 Coverage | 100% (0/0) | 100% | MET (N/A) |
| P1 Coverage | 67% (14/21) | ≥90% PASS / ≥80% min | NOT MET |
| P2 Coverage | 7% (1/14) | advisory | LOW |
| Overall Coverage | 54% (19/35) | ≥80% | NOT MET |

---

## Test Inventory

### Unit / Integration Tests (`src/lib/__tests__/actionSuggestions.test.ts`)

24 tests covering pure-function logic for `generateActionSuggestions()`, `calculateUrgencyScore()`, `fsrsDecayFactor()`, and `recencyDecayFactor()`.

### E2E Tests (`tests/e2e/story-e71-s03.spec.ts`)

4 Playwright tests covering panel visibility, CTA navigation, empty state, and responsive visibility.

### Component Tests

**None.** No dedicated component tests exist for `ActionCard` or `SuggestedActionsPanel`.

---

## Traceability Matrix

### E71-S01: Action Suggestion Data Layer

| AC | Description | Priority | Test(s) | Coverage |
|----|-------------|----------|---------|----------|
| S01-AC1 | Weak topic (score 35) → `flashcard-review` with correct route/label/estimatedMinutes | P1 | U-01 | FULL |
| S01-AC2 | Fading topic (score 55) → `quiz-refresh` with correct route/label/estimatedMinutes | P1 | U-02 | FULL |
| S01-AC3 | Fading topic + lessons → `lesson-rewatch` targeting lowest-completion lesson | P1 | U-03 | FULL |
| S01-AC4 | Urgency sorting descending (higher urgency first) | P1 | U-04 | FULL |
| S01-AC5 | Deduplication: one suggestion per topic, highest priority action type | P1 | U-05 | FULL |
| S01-AC6 | FSRS stability=5 produces higher urgency than stability=50 | P1 | U-06 | FULL |
| S01-AC7 | Recency decay fallback when FSRS data not provided | P1 | U-07 | FULL |
| S01-AC8 | `maxSuggestions: 3` with 7 topics → 3 returned | P1 | U-10 | FULL |
| S01-AC9 | Empty input OR all strong topics (>=70) → empty array | P1 | U-11, U-13, U-14 | FULL |
| S01-AC10 | Topic with only lessons → only `lesson-rewatch` produced | P1 | U-15 | FULL |

**S01 coverage: 10/10 = 100%**

---

### E71-S02: ActionCard and SuggestedActionsPanel UI Components

| AC | Description | Priority | Test(s) | Coverage |
|----|-------------|----------|---------|----------|
| S02-AC1 | `ActionCard` renders flashcard-review: Layers icon, `bg-destructive/10 text-destructive` badge, TrendingDown, "Review 5 flashcards", "5 min review", "Start Review" button | P1 | NONE | NONE |
| S02-AC2 | `ActionCard` renders quiz-refresh: `bg-warning/10 text-warning`, Minus icon, Brain icon, "Take Quiz" button | P1 | NONE | NONE |
| S02-AC3 | `ActionCard` renders lesson-rewatch: RotateCcw icon, "Watch Lesson" button | P2 | NONE | NONE |
| S02-AC4 | CTA button uses `<Link>` (not `useNavigate`) for navigation | P1 | E2E-02 (navigation confirmed, not `<Link>` isolation) | PARTIAL |
| S02-AC5 | Long topic name: truncated with ellipsis + `title` attribute | P2 | NONE | NONE |
| S02-AC6 | Desktop (>=1024px): vertical sidebar `w-80`, `flex flex-col gap-3` | P2 | E2E-04 (visibility only) | PARTIAL |
| S02-AC7 | Tablet (640-1023px): 2-column grid `grid grid-cols-2 gap-3` | P2 | NONE | NONE |
| S02-AC8 | Mobile (<640px): horizontal scroll `snap-x snap-mandatory`, cards `min-w-[280px]` | P2 | E2E-04 (visibility only) | PARTIAL |
| S02-AC9 | Empty state: `CheckCircle2`, "All topics looking strong!" message | P1 | E2E-03 | FULL |
| S02-AC10 | 7 suggestions, `maxVisible: 5` → 5 visible + "Show 2 more suggestions" link | P2 | NONE | NONE |
| S02-AC11 | "Show more" → "Show less" + `ChevronUp` icon on expand | P2 | NONE | NONE |
| S02-AC12 | Accessibility: `<section aria-labelledby>`, `role="region"`, `<article role="listitem">`, descriptive `aria-label` | P1 | NONE | NONE |
| S02-AC13 | Panel header: `Sparkles` `text-brand`, "Suggested Actions", "Topics that need your attention" | P2 | NONE | NONE |

**S02 coverage: 1/13 fully covered + 3 partial = 8%**

---

### E71-S03: Knowledge Map Integration and Tests

| AC | Description | Priority | Test(s) | Coverage |
|----|-------------|----------|---------|----------|
| S03-AC1 | `/knowledge-map` with declining topics → panel visible, cards sorted by urgency | P1 | E2E-01 | FULL |
| S03-AC2 | Desktop: `flex gap-6` layout, treemap `flex-1`, panel `w-80` sidebar | P1 | E2E-04 (visibility only, no layout assertion) | PARTIAL |
| S03-AC3 | Mobile: panel above topic list, not sidebar | P1 | E2E-04 (visibility only, no position assertion) | PARTIAL |
| S03-AC4 | All strong topics → empty state "All topics looking strong!" (panel remains visible) | P1 | E2E-03 | FULL |
| S03-AC5 | `useKnowledgeMapStore.getSuggestedActions()` reads store, calls `generateActionSuggestions()` | P1 | NONE | NONE |
| S03-AC6 | Panel does not interfere with treemap interactions (no z-index overlap, no event capture) | P2 | NONE | NONE |
| S03-AC7 | `generateActionSuggestions()` with mixed flashcard/quiz/lesson topics → correct per-topic action types | P1 | U-09 | FULL |
| S03-AC8 | Mixed FSRS + recency decay in same call — both correctly computed and ranked | P1 | U-08 | FULL |
| S03-AC9 | Empty topics array → empty array, no errors | P1 | U-13 | FULL |
| S03-AC10 | All tests use `FIXED_DATE` constant per ESLint rule | P2 | U (all), E2E (all) | FULL |
| S03-AC11 | E2E: panel visible + ActionCard with CTA button when declining topics seeded | P1 | E2E-01 | FULL |
| S03-AC12 | E2E: CTA click navigates to expected route (URL assertion) | P1 | E2E-02 | FULL |

**S03 coverage: 8/12 fully covered + 2 partial**

---

## Gaps and Blind Spots

### P1 Gaps (Gate-Blocking)

| Gap ID | AC | Description | Recommended Action |
|--------|-----|-------------|-------------------|
| GAP-01 | S02-AC1 | `ActionCard` flashcard-review rendering: icons, badge colors, CTA label never asserted | Add component test (Vitest + @testing-library/react) or visual E2E test |
| GAP-02 | S02-AC2 | `ActionCard` quiz-refresh rendering: warning colors, Brain icon, "Take Quiz" never asserted | Add component test for quiz-refresh variant |
| GAP-03 | S02-AC12 | Accessibility ARIA: `aria-labelledby`, `role="region"`, `role="listitem"`, `aria-label` never tested | Add accessibility test via `@axe-core/playwright` or component ARIA assertions |
| GAP-04 | S03-AC5 | `useKnowledgeMapStore.getSuggestedActions()` store getter integration never tested | Add unit test for store getter wiring (mock store state, verify `generateActionSuggestions()` called with correct data) |

### P2 Gaps (Advisory)

| Gap ID | AC | Description | Recommended Action |
|--------|-----|-------------|-------------------|
| GAP-05 | S02-AC3 | `ActionCard` lesson-rewatch variant (RotateCcw, "Watch Lesson") not tested | Extend component test suite |
| GAP-06 | S02-AC5 | Topic name truncation + `title` attribute not tested | Add component test with long topic name input |
| GAP-07 | S02-AC7 | Tablet 2-column grid layout (640-1023px) not tested | Add E2E responsive test at `{ width: 768, height: 1024 }` |
| GAP-08 | S02-AC10 | Show more/less toggle: initial 5 visible, "Show N more" link not tested | Add component interaction test |
| GAP-09 | S02-AC11 | Toggle state change: "Show less" + ChevronUp on expand not tested | Add component interaction test |
| GAP-10 | S02-AC13 | Panel header (Sparkles icon, title, subtitle) not tested | Add component test or E2E assertion |
| GAP-11 | S03-AC6 | Treemap + panel z-index / pointer-event conflict not tested | Add E2E interaction test clicking treemap cells while panel is visible |

### Partial Coverage Items Needing Hardening

| Gap ID | AC | Issue | Recommended Action |
|--------|-----|-------|-------------------|
| GAP-12 | S02-AC4 | Navigation confirmed via E2E but `<Link>` vs `useNavigate` usage not isolated | Add component test asserting `<a>` tag rendered (not button with click handler) |
| GAP-13 | S03-AC2 | Desktop sidebar layout not asserted — only panel visibility confirmed | Add E2E assertions for `flex` container CSS or element bounding-box position |
| GAP-14 | S03-AC3 | Mobile panel position (above topic list) not verified — only visibility confirmed | Add E2E DOM-order assertion at `{ width: 375 }` |

### Coverage Heuristics

- **API endpoint coverage:** N/A (no API endpoints; pure client-side computation)
- **Auth/authz negative paths:** N/A (no authentication required)
- **Happy-path-only blind spots:** `generateActionSuggestions()` not tested with malformed/null input (null `lessons`, undefined `canonicalName`, negative scores). No boundary tests for score exactly at tier thresholds (score=40, score=70).

---

## Recommendations

1. **URGENT (P1 unblocking):** Add component tests for `ActionCard` variants (GAP-01, GAP-02, GAP-03) and a unit test for `useKnowledgeMapStore.getSuggestedActions()` (GAP-04). These 4 gaps are blocking the FAIL gate decision.

2. **HIGH:** Add accessibility test using `@axe-core/playwright` or `jest-axe` targeting `SuggestedActionsPanel` (covers GAP-03 efficiently alongside other ARIA concerns).

3. **MEDIUM:** Add E2E responsive test for tablet viewport 768px (GAP-07) and DOM-order assertion for mobile panel position (GAP-14).

4. **MEDIUM:** Add component tests for show-more/less toggle interaction (GAP-08, GAP-09) — these cover core UX interactivity.

5. **LOW:** Add boundary unit tests for `generateActionSuggestions()` at tier threshold scores (exactly 40 and 70) to prevent off-by-one regressions.

---

## Gate Decision Summary

```
GATE DECISION: FAIL

P0 Coverage:  100% (N/A — no P0 ACs)      → MET
P1 Coverage:   67% (21 ACs, 14 fully)      → NOT MET (minimum: 80%)
P2 Coverage:    7% (14 ACs, 1 fully)       → NOT MET (advisory)
Overall:       54% (35 ACs, 19 fully)      → NOT MET (minimum: 80%)

FAIL — Release BLOCKED until coverage improves.

Primary blocker: E71-S02 component story has 0 dedicated tests across 13 ACs.
4 P1 ACs with zero coverage: S02-AC1, S02-AC2, S02-AC12, S03-AC5.

Fastest path to PASS:
1. Add ActionCard component tests (AC1, AC2, AC3, AC5, AC12) — 5 ACs → ~+15%
2. Add SuggestedActionsPanel interaction tests (AC10, AC11, AC13) — 3 ACs → ~+9%
3. Add store getter unit test (S03-AC5) — 1 AC → ~+3%
4. Harden partial E2E assertions (S03-AC2, S03-AC3) — 2 ACs → ~+6%
→ Projected coverage after fixes: ~87% overall, ~90%+ P1 → PASS
```
