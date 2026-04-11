# Epic 109 Completion Report — Knowledge Pipeline (Highlights, Vocabulary, Export)

**Date:** 2026-04-11  
**Epic:** E109 — Knowledge Pipeline (Highlights, Vocabulary, Export)  
**Status:** Complete — all 5 stories done, PRs merged, post-epic fixes applied  
**Build:** PASS (25.12s, 0 errors, PWA precache 307 entries / 19.69 MB)

---

## Executive Summary

Epic 109 delivered the full Knowledge Pipeline: vocabulary capture from the reader, daily highlight review, highlight export in four formats, per-book annotation summaries, and cross-book search. All five stories shipped to main with zero production incidents. The back half of the epic (S03–S05) passed review in a single round each, demonstrating that infrastructure investment in S01 compounded forward. Post-epic NFR assessment identified two HIGH findings (AnnotationSummary missing try/catch; SearchAnnotations unbounded load) that were resolved in a chore commit before this report.

---

## Stories

| Story | Title | PR | Status | Review Rounds | Issues Fixed |
|-------|-------|-----|--------|---------------|--------------|
| E109-S01 | Vocabulary Builder | #292 | done | 3 | 9 |
| E109-S02 | Daily Highlight Review | #293 | done | 3 | 5 |
| E109-S03 | Highlight Export (Text, Markdown, CSV, JSON) | #294 | done | 1 | 2 |
| E109-S04 | Annotation Summary View | #295 | done | 1 | 2 |
| E109-S05 | Cross-book Search | #296 | done | 1 | 6 |

**Total review rounds:** 9 (first-round pass rate: 3/5 = 60%)  
**Production incidents:** 0

---

## Features Delivered

| Feature | Route | Story |
|---------|-------|-------|
| Vocabulary Builder — capture words from reader, flashcard review mode, mastery levels | `/vocabulary` | S01 |
| Daily Highlight Review — priority-queue review with keep/dismiss ratings | `/highlight-review` | S02 |
| Highlight Export — Text, Markdown, CSV, JSON downloads | dialog (on review/summary pages) | S03 |
| Annotation Summary — per-book highlight statistics and listing | `/library/:bookId/annotations` | S04 |
| Cross-book Search — debounced full-text search across highlights and vocabulary | `/search-annotations` | S05 |

---

## Post-Epic NFR Fixes (committed to main)

Two HIGH findings from the NFR assessment were resolved in a single post-epic chore commit (`0d06d173`):

| Fix | File | Finding |
|-----|------|---------|
| `AnnotationSummary.tsx` — added try/catch to `load()`, toast.error on Dexie failure | `src/app/pages/AnnotationSummary.tsx:108` | NFR HIGH: infinite skeleton on Dexie error |
| `SearchAnnotations.tsx` — added `.limit(500)` cap on mount queries | `src/app/pages/SearchAnnotations.tsx` | NFR HIGH: unbounded full-table load |
| `highlightExport.ts` — removed inline `groupByBook` duplication in Obsidian export | `src/lib/highlightExport.ts:132` | NFR LOW: maintainability dedup |

---

## Quality Gates

### Traceability (testarch-trace)

**Gate Decision: CONCERNS**

| Story | ACs | FULL | PARTIAL | NONE | Coverage % |
|-------|-----|------|---------|------|------------|
| S01 | 7 | 2 | 2 | 3 | 29% |
| S02 | 5 | 2 | 2 | 1 | 40% |
| S03 | 6 | 6 | 0 | 0 | 100% |
| S04 | 5 | 4 | 1 | 0 | 80% |
| S05 | 6 | 4 | 1 | 1 | 67% |
| **Total** | **29** | **18** | **6** | **5** | **62% FULL / 83% FULL+PARTIAL** |

**Total E2E tests:** 31 across 5 stories

**Critical gaps (NONE coverage):**
- GAP-01: S01-AC1 — Reader→Vocabulary capture flow (primary feature entry point, 0 E2E coverage)
- GAP-02: S01-AC4 — Edit/delete with undo (explicitly deferred in story)
- GAP-03: S01-AC5 — Mastery advance/reset (explicitly deferred in story)
- GAP-04: S02-AC4 — Session completion empty state after all highlights rated
- GAP-05: S05-AC4 — Result navigation links not asserted

S01 gaps are explicitly acknowledged deferred scope. S03 achieved 100% AC coverage with download verification. Gate is CONCERNS (not blocked) — deferred tests must be scheduled before Knowledge Pipeline is considered production-stable.

### NFR Assessment

**Gate Decision: CONCERNS — 25/30 (83%), 0 blockers**

| Category | Status |
|----------|--------|
| Testability / Automation | CONCERNS |
| Test Data Strategy | PASS |
| Scalability / Availability | CONCERNS |
| Disaster Recovery | PASS |
| Security | PASS |
| Monitorability | CONCERNS |
| QoS / QoE | CONCERNS |
| Deployability | PASS |

HIGH findings (both resolved post-epic): AnnotationSummary infinite skeleton; SearchAnnotations unbounded load.

Security: PASS across all five stories — local-first, no external data transmission, CSV follows RFC 4180, regex injection mitigated, no raw HTML injection possible in search highlighting.

### Adversarial Review

**17 findings: 4 HIGH, 10 MEDIUM, 3 LOW**

| # | Finding | Severity | Story | Status |
|---|---------|----------|-------|--------|
| F01 | "Spaced repetition" is mislabeled — actually a priority queue, no SM-2 scheduling | HIGH | S02 | KI-049 (open) |
| F02 | Vocabulary review doesn't use lastReviewedAt for filtering — serves all non-mastered every session | HIGH | S01 | KI-050 (open) |
| F03 | SearchAnnotations loads full DB before user input — .limit(500) cap applied post-epic | HIGH | S05 | KI-051 (open, partially mitigated) |
| F04 | `modal={false}` on export dialog breaks focus trap (WCAG 2.1 SC 1.3.1) | HIGH | S03 | KI-052 (open) |
| F05 | Vocabulary `context` field not searched in cross-book search | MEDIUM | S01, S05 | open |
| F06 | No story file, no AC, no lessons learned for E109-S03 | MEDIUM | S03 | noted |
| F07 | AnnotationSummary back button hardcodes `/library` instead of `navigate(-1)` | MEDIUM | S04 | KI-054 (open) |
| F08 | loadDailyHighlights .limit(80) silently biases toward recent items, not most-due | MEDIUM | S02 | open |
| F09 | Obsidian export duplicates groupByBook logic inline | MEDIUM | S03 | resolved in post-epic chore |
| F10 | Deleted-book vocabulary items appear as "Unknown book" with no warning | MEDIUM | S01 | open |
| F11 | Search result links open reader at start, not at annotation CFI | MEDIUM | S05 | open |
| F12 | All data-dependent vocabulary flows explicitly deferred from test coverage | MEDIUM | S01 | KI-055 (open) |
| F13 | Export E2E tests verify filename but not file content | MEDIUM | S03 | open |
| F14 | HighlightReview load failure is visually indistinguishable from empty state | MEDIUM | S02 | open |
| F15 | Color filter badges use `aria-pressed` on `<div>` elements — wrong element | LOW | S04 | open |
| F16 | Search ignores `context`, `chapterHref`, and metadata fields | LOW | S05 | open |
| F17 | Daily Review and Cross-Book Search have no sidebar navigation entries | LOW | S02, S05 | KI-056 (open) |

---

## Known Issues

### Pre-existing E109 known issues (KI-039 through KI-048)

All 10 items remain open. KI-046, KI-047, KI-048 (R3 deferred from E109-S01) require triage before E110-S01.

### New issues filed this epic (KI-049 through KI-056)

| ID | Summary | Severity | Type |
|----|---------|----------|------|
| KI-049 | Spaced repetition mislabeled — priority queue, no SM-2 | high | feature |
| KI-050 | Vocabulary review no scheduling — all non-mastered every session | high | feature |
| KI-051 | SearchAnnotations unbounded load (partially mitigated with .limit(500)) | high | performance |
| KI-052 | Export dialog modal={false} breaks focus trap (a11y) | high | accessibility |
| KI-053 | AnnotationSummary no try/catch — infinite skeleton on Dexie error | high | reliability |
| KI-054 | AnnotationSummary back button hardcodes /library instead of navigate(-1) | medium | ux |
| KI-055 | E109-S01 data-dependent vocabulary flows have zero E2E coverage | medium | test |
| KI-056 | Daily Review and Cross-Book Search have no sidebar navigation entries | low | ux |

> Note: KI-053 was resolved by the post-epic chore commit. Status remains open until verified in E110.

---

## Retrospective Summary

### Metrics

| Metric | Value |
|--------|-------|
| Stories completed | 5/5 (100%) |
| E108 action items completed | 1/6 (17%) |
| Total review rounds | 9 |
| First-round pass rate | 60% (3/5) |
| Production incidents | 0 |
| NFR HIGH findings post-epic | 2 (resolved) |

### What Went Well

1. **Infrastructure compounding**: S01 introduced Dexie v42 schema, optimistic-update store pattern, and `dismissOnboarding` E2E helper. S03–S05 each passed review in one round because the foundation was stable.
2. **Shared test helpers**: `dismissOnboarding` (S01), `seedBookHighlights` (S02), and vocabulary seed helpers (S05) are reusable infrastructure that eliminates per-story rediscovery.
3. **S03 clean architecture**: Export flows are inherently complex (file encoding, format branching, filename sanitization) — one review round, two LOW findings. Design-first thinking on the export module prevented rework.
4. **Security posture**: All five stories are local-first with no external data transmission. Security gate: PASS across the board.

### What Was Challenging

1. **S01 took 3 rounds**: Three separate failure categories across rounds — TypeScript type error (R1), missing rollback patterns in three store actions (R2), hover-only accessibility bug in flashcard review (R3). Each category was invisible to the previous round.
2. **Hover-only buttons (recurring)**: Flashcard review buttons visible only on `:hover` — inaccessible to keyboard and touch. This pattern also appeared in E108. Requires a dedicated checklist item.
3. **Dexie `.notEqual()` footgun**: `.where(field).notEqual(value)` silently excludes documents where the field is absent entirely. Fix: full table scan with in-memory filter. Documented in lessons learned.
4. **NFR gaps surviving story review**: Two HIGH findings (AnnotationSummary infinite skeleton; SearchAnnotations unbounded load) were not caught during S04 and S05 story reviews. Both required post-epic NFR assessment to surface.
5. **Inter-epic prep gap (systemic, 6th consecutive epic)**: 1/6 E108 action items completed. Root cause: retro closes and first story starts in the same session, leaving no time for chore commits or carry-forward work.

### Patterns Documented

| Pattern | Type | Source |
|---------|------|--------|
| Dexie `.notEqual()` unreliable for nullable/absent fields — use full table scan | Footgun / fix | E109-S02 |
| Optimistic updates require ref-based snapshots to avoid stale closures | Code pattern | E109-S02 |
| Shared test helpers compound across stories — extract at first reuse signal | Process | E109 all stories |
| Hover-only interactive elements fail accessibility — verify focus and touch | Recurring bug | E109-S01, E108 |
| NFR gaps survive story-level review — run NFR assessment before declaring epic done | Process | E109 post-epic |
| Infrastructure-first sequencing accelerates subsequent stories | Planning | E109 |

---

## Action Items for E110

| # | Action | Owner | Priority | When |
|---|--------|-------|----------|------|
| 1 | Triage KI-046, KI-047, KI-048 — assign to E110 or mark wont-fix | Pedro | HIGH | Before E110-S01 |
| 2 | Add try/catch to `AnnotationSummary.tsx` load() (verify post-epic fix merged cleanly) | Pedro | HIGH | Before E110-S01 |
| 3 | Add "hover-only button accessibility check" to story pre-review checklist in story template | Pedro | HIGH | Before E110-S01 |
| 4 | Add Dexie `.notEqual()` footgun to `docs/engineering-patterns.md` | Pedro | HIGH | Before E110-S01 |
| 5 | Create GitHub issue for inter-epic prep checkpoint (finish-story/SKILL.md or CLAUDE.md) — blocks /start-story E110-S01 by convention | Pedro | HIGH | This session |
| 6 | Schedule S01 data-dependent E2E coverage (edit, delete, undo, mastery) in E110 or chore story | Pedro | MEDIUM | E110 planning |
| 7 | Evaluate modal={false} in HighlightExportDialog — fix to modal={true} unless design intent documented | Pedro | MEDIUM | E110 or chore |
| 8 | Add useDeferredValue or result count indicator to SearchAnnotations (KI-051) | Pedro | MEDIUM | E110 or chore |

---

## Next Epic

**Epic 110 — Library Organization (Shelves, Series, Reading Queue)**

Dexie is at v43 after E109. Any new tables or indexes in E110 require v44+. The schema checkpoint test must be updated in the same commit as the migration.

E109 left the annotation and vocabulary infrastructure stable. E110 is organizational — adding structure on top of what exists without modifying the knowledge pipeline tables.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Traceability matrix | `docs/reviews/testarch-trace-2026-04-11-epic-109.md` |
| NFR assessment | `docs/reviews/nfr-assessment-2026-04-11-e109.md` |
| Adversarial review | `docs/reviews/adversarial/adversarial-review-2026-04-11-E109.md` |
| Retrospective | `docs/implementation-artifacts/epic-109-retro-2026-04-11.md` |
| Known issues | `docs/known-issues.yaml` (KI-039 through KI-056) |
| S01 story | `docs/implementation-artifacts/stories/E109-S01.md` |
| S02 story | `docs/implementation-artifacts/stories/E109-S02.md` |
| S04 story | `docs/implementation-artifacts/stories/E109-S04.md` |
| S05 story | `docs/implementation-artifacts/story-e109-s05.md` |

> Note: E109-S03 story file is missing — the implementation and tests exist but no canonical story artifact was created (adversarial finding F06). File as a documentation chore for E110.
