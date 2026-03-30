# Epic 53: PKM Export Phase 1 — Completion Report

**Date:** 2026-03-30
**Epic:** E53 — PKM Export Phase 1 (Markdown + Anki .apkg)
**Status:** Complete (3/3 stories, 3 PRs merged)
**Duration:** 1 day (2026-03-30)

---

## Executive Summary

Epic 53 delivers a complete personal knowledge management export pipeline: Markdown export for flashcards and bookmarks (Obsidian-compatible), Anki .apkg deck generation, and a Settings UI for batch downloads. The implementation is architecturally clean — four new modules (`flashcardExport.ts`, `bookmarkExport.ts`, `ankiExport.ts`, `pkmExport.ts`) compose existing export infrastructure without modifying it. All three stories passed code review on the first round (100% first-pass rate), the best result across recent epics. A notable engineering decision was replacing the unmaintained `anki-apkg-export` npm package with a custom sql.js + JSZip implementation, eliminating WASM deployment issues and supply chain risk.

The adversarial review found 15 findings (4 critical, 5 high, 4 medium, 2 low), with the most significant being raw HTML in flashcard Markdown export (C1) and weak E2E test coverage for the Settings UI integration (C3). The testarch trace reports 85% AC coverage with CONCERNS on S03 UI integration tests.

---

## Delivery Summary

| Story | Title | PR | Review Rounds | Issues Fixed | Key Notes |
|-------|-------|----|---------------|-------------|-----------|
| E53-S01 | Flashcard & Bookmark Markdown Export | #172 | 1 | 2 | YAML frontmatter with FSRS fields, per-course folders, tag derivation |
| E53-S02 | Anki .apkg Export | #173 | 1 | 4 | Custom sql.js + JSZip; bypassed unmaintained anki-apkg-export |
| E53-S03 | PKM Batch Export & Settings UI | #174 | 1 | 2 | Thin orchestrator + 2 new Settings cards with weighted progress |
| **Totals** | | | **3 (avg 1.0)** | **8** | |

### Features Delivered

- **Flashcard Markdown export**: YAML frontmatter (type, deck, tags, FSRS fields), Q/A body, files organized under `flashcards/{course-name}/`, tag derivation from course + linked note tags
- **Bookmark Markdown export**: One file per course, bookmarks grouped by video heading, sorted by timestamp ascending, YAML frontmatter with metadata
- **Anki .apkg export**: Full SQLite-based Anki deck generation using sql.js ASM build + JSZip, dynamic import for bundle splitting, HTML stripping, single "Knowlune Export" deck with per-card tags
- **PKM batch bundle**: Orchestrates notes + flashcards + bookmarks into one ZIP with README.md and file count summary
- **Settings UI cards**: "PKM Export (Obsidian)" and "Flashcard Export (Anki)" cards in Data Management section with progress feedback, disabled states, and empty-state toasts
- **Shared utility extraction**: `yieldToUI()` extracted to `uiUtils.ts` (DRY improvement across export modules)

### Git History

```
3ddc1aa3 docs(Epic 53): add post-epic validation reports — trace, adversarial, retrospective
210efcb5 chore: update epic tracking — all E53 stories complete
032b2ff5 feat(E53-S03): PKM batch export & Anki export cards in Settings (#174)
aa473877 chore: update epic tracking after E53-S02
35525470 feat(E53-S02): Anki .apkg export with sql.js + JSZip (#173)
676ba246 chore: update epic tracking after E53-S01
ec7e589e feat(E53-S01): flashcard & bookmark Markdown export (#172)
```

---

## Quality Gates

### Review Gates Per Story

| Gate | E53-S01 | E53-S02 | E53-S03 |
|------|---------|---------|---------|
| Build | PASS | PASS | PASS |
| Lint | PASS | PASS | PASS |
| Type check | PASS | PASS | PASS |
| Format | PASS | -- | PASS |
| Unit tests | PASS | PASS | PASS |
| E2E tests | PASS | -- | PASS |
| Design review | -- | -- | PASS |
| Code review | PASS | PASS | PASS |
| Test coverage review | PASS | PASS | PASS |
| Lessons learned | PASS | -- | -- |
| Burn-in | Not run | Not run | Not run |

### Test Coverage (Testarch Trace)

| Metric | Value |
|--------|-------|
| Total acceptance criteria | 20 |
| Fully covered by tests | 17 |
| Partially covered | 2 |
| Not covered | 1 |
| **Coverage percentage** | **85%** |
| **Gate decision** | **CONCERNS** |

**Test file inventory:**

| File | Type | Tests | Stories Covered |
|------|------|-------|-----------------|
| `src/lib/__tests__/flashcardExport.test.ts` | Unit (Vitest) | 11 | E53-S01 AC1-4,7 |
| `src/lib/__tests__/bookmarkExport.test.ts` | Unit (Vitest) | 11 | E53-S01 AC5-7 |
| `src/lib/__tests__/ankiExport.test.ts` | Unit (Vitest) | 11 | E53-S02 AC1-5 |
| `src/lib/__tests__/pkmExport.test.ts` | Unit (Vitest) | 14 | E53-S03 AC2,5 |
| `tests/e2e/story-e53-s03.spec.ts` | E2E (Playwright) | 7 | E53-S03 AC1,4,6,8 |
| **Total** | | **54** | |

**Coverage gaps (from trace):**
- E53-S03 AC3 — Anki download filename format not tested (NOT COVERED)
- E53-S03 AC7 — Error path + isExporting reset not tested (NOT COVERED)
- E53-S03 AC4 — Disabled-during-export only verifies initial enabled state (PARTIAL)
- E53-S02 AC2 — Deck name "Knowlune Export" not explicitly asserted (PARTIAL)

---

## Review Reports

### Code Reviews

| Report | Key Findings |
|--------|-------------|
| `code-review-2026-03-30-E53-S01.md` | MEDIUM: non-deterministic Date in bookmarkExport; MEDIUM: YAML tags not escaped for internal quotes |
| `code-review-2026-03-30-E53-S02.md` | MEDIUM: sqlDb not wrapped in try-finally (leak on exception); MEDIUM: Date.now() for IDs non-deterministic |
| `code-review-2026-03-30-E53-S03.md` | All checks PASS: error handling, double-execution guard, clean orchestrator architecture |

### Design Reviews

| Report | Key Findings |
|--------|-------------|
| `design-review-2026-03-30-E53-S03.md` | PASS — cards match existing pattern, design tokens correct, a11y verified |

### Test Coverage Reviews

| Report | Key Findings |
|--------|-------------|
| `code-review-testing-2026-03-30-E53-S01.md` | AC coverage verified for all 7 ACs |
| `code-review-testing-2026-03-30-E53-S02.md` | AC2 partial (deck name not asserted), AC5 partial (dynamic import indirect) |
| `code-review-testing-2026-03-30-E53-S03.md` | 2 NOT COVERED (AC3, AC7), 3 PARTIAL (AC2, AC4, AC5) |

---

## Adversarial Review

**Verdict:** PASS WITH 15 FINDINGS (4 critical, 5 high, 4 medium, 2 low)

### Critical Findings

| # | Finding | Status |
|---|---------|--------|
| C1 | Raw HTML in flashcard Markdown Q/A body — unreadable in Obsidian | Must fix |
| C2 | 2/3 story files have empty "Challenges and Lessons Learned" sections | Must fix |
| C3 | Zero E2E tests exercise actual export download flow | Must fix |
| C4 | PKM bundle has no partial-failure resilience (one sub-exporter failure kills all) | Should fix |

### High Findings

| # | Finding | Status |
|---|---------|--------|
| H1 | `Date.now()` in ankiExport makes IDs non-deterministic | Should fix |
| H2 | No useRef guard against double-click race on export buttons | Should fix |
| H3 | Anki GUID includes time-dependent deck ID — duplicates on reimport | Should fix |
| H4 | Bookmark headings use raw filenames instead of video titles | Should fix |
| H5 | Empty-state messages use success toast instead of info/warning | Should fix |

### Medium/Low Findings

- M1: Flashcard filenames include HTML tag remnants from `fc.front`
- M2: FSRS numeric fields not guarded against NaN/Infinity
- M3: README counted in reported file total (off-by-one)
- M4: Edge case review HIGH findings not tracked in known-issues.yaml
- L1: `now` parameter not forwarded from pkmExport to bookmarkExport
- L2: Unit test mocks sanitizeFilename with different implementation than production

---

## Observed Patterns and Incidents

### Pattern 1: Pre-Implementation Edge Case Review Eliminates Review Rounds

The adversarial edge case review during planning identified 4 EC-HIGH items. All were addressed proactively in S02's implementation (ASM.js build over WASM, HTML stripping for Anki, custom .apkg generator, dynamic import error handling). This directly contributed to the 100% first-pass review rate — the best across recent epics (E59: 60%, E54: 33%, E53: 100%).

### Pattern 2: Composable Export Architecture Scales Linearly

Adding 3 new export types required zero changes to existing modules. The PKM bundle orchestrator (`pkmExport.ts`) is 122 lines because it delegates everything to existing exporters. This validates the export architecture from Epic 11.

### Pattern 3: Unmaintained Packages Replaced with Custom Implementation

The `anki-apkg-export` npm package (unmaintained since ~2019) was bypassed entirely. A custom 417-line module using sql.js ASM build + JSZip produces correct .apkg files without WASM deployment issues or supply chain risk. For niche features, owning the implementation is preferable to wrapping abandoned dependencies.

### Pattern 4: Shared Utility Extraction (DRY)

The duplicated `yieldToUI()` helper (identical across 3+ export modules) was extracted to `uiUtils.ts`. Code review flagged this during S01/S02, and it was resolved as a DRY improvement.

---

## Pre-Existing Issues (Not Caused by E53)

| Issue | Origin | Impact on E53 |
|-------|--------|--------------|
| 5 TypeScript errors in schema.test.ts (CardState) | Pre-existing | No impact; unrelated to export files |
| 23 ESLint warnings | Pre-existing | No new warnings introduced |
| Unit test coverage below 70% threshold | Pre-existing | E53 added 47 unit tests, likely improved ratio |

---

## Technical Debt Introduced/Carried

### New Debt (E53)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | Raw HTML in flashcard Markdown export (C1) | HIGH | `htmlToMarkdown()` needed on fc.front/fc.back |
| 2 | No partial-failure resilience in pkmExport (C4) | MEDIUM | Individual try/catch per sub-exporter |
| 3 | Anki GUID includes Date.now() — non-deterministic, causes duplicates on reimport (H1/H3) | MEDIUM | Remove topDeckId from GUID, inject now parameter |
| 4 | No useRef guard against double-click race (H2) | MEDIUM | Ref-based synchronous guard needed |
| 5 | Bookmark headings use raw filenames (H4) | LOW | Prefer v.title over v.filename |
| 6 | Empty-state toasts use success variant (H5) | LOW | Should use info/warning |
| 7 | Edge case review findings not tracked in known-issues.yaml (M4) | LOW | 10 HIGH findings untracked |

### Carried Debt (from previous epics)

| # | Item | Priority | Carrying Since |
|---|------|----------|---------------|
| 8 | Streak milestone over-emission | MEDIUM | E43 |
| 9 | Review-due date dedup | MEDIUM | E43 |
| 10 | Dead ImportedCourseDetail.tsx (559 lines) | LOW | E54 |
| 11 | Backfill E43 S01-S03 lessons learned | LOW | E43 |

---

## Retrospective Summary

**Source:** `docs/implementation-artifacts/epic-53-retro-2026-03-30.md`

### Key Takeaways

1. **Pre-implementation edge case reviews eliminate review rounds.** All 4 EC-HIGH findings addressed during implementation resulted in 100% first-pass rate, saving an estimated 3-6 fix commits.
2. **Composable export architecture scales linearly.** Adding 3 new export types required zero changes to existing modules. The orchestrator pattern keeps complexity contained.
3. **Unmaintained packages are not worth the risk for niche features.** Hand-building .apkg with sql.js + JSZip produced a more maintainable 417-line module than wrapping an abandoned dependency.

### Action Items (9 total)

| # | Action | Owner | Type |
|---|--------|-------|------|
| 1 | Add smoke E2E tests for all export UI integrations | Dana | Process |
| 2 | Document export pattern (including nowFn injection) | Charlie | Process |
| 3 | Extract shared yieldToUI() utility | Elena | Process |
| 4 | Add try-finally for sqlDb cleanup | Charlie | Tech debt |
| 5 | Add error-path test for sql.js dynamic import failure | Dana | Tech debt |
| 6 | Streak milestone over-emission (carried) | Charlie | Tech debt |
| 7 | Review-due date dedup (carried) | Charlie | Tech debt |
| 8 | Delete dead ImportedCourseDetail.tsx (carried) | Charlie | Tech debt |
| 9 | Backfill E43 S01-S03 lessons learned (carried) | Charlie | Tech debt |

### Team Agreements

- Export functions should accept an optional `now` parameter for deterministic testing
- When a utility is duplicated 3+ times, extract it immediately
- Pre-implementation edge case reviews are mandatory for epics involving file format generation or third-party dependencies
- Every Settings UI card needs at least a smoke E2E test

---

## Post-Epic Validation Status

| Validation | Status | File |
|------------|--------|------|
| Sprint status update | Done | `sprint-status.yaml` (epic-53: done) |
| Testarch trace | Done | `docs/reviews/testarch-trace-2026-03-30-epic-53.md` — CONCERNS (85%) |
| Adversarial review | Done | `docs/reviews/adversarial/adversarial-review-2026-03-30-epic-53.md` — PASS WITH 15 FINDINGS |
| Retrospective | Done | `docs/implementation-artifacts/epic-53-retro-2026-03-30.md` — 9 action items, 3 takeaways |
| Testarch NFR | Pending | Not yet executed |
| Known issues triage | Pending | M4 edge case findings not yet added to known-issues.yaml |

---

## Metrics

| Metric | Value | Assessment |
|--------|-------|-----------|
| Stories completed | 3/3 (100%) | On target |
| Duration | 1 day | Fast — composable architecture paid off |
| PRs merged | 3 (#172-#174) | Clean merge history |
| Review rounds | 3 total (avg 1.0/story) | Best rate across recent epics |
| Issues fixed | 8 (2+4+2) | Low issue count correlates with first-pass success |
| First-pass rate | 100% (3/3) | Best in recent history (E59: 60%, E54: 33%) |
| BLOCKERs | 0 | No blocking issues |
| Hardcoded colors | 0 | ESLint automation effective |
| Production incidents | 0 | Clean deployment |
| New code added | ~2,041 lines across 14 files | 4 new export modules |
| Unit tests added | 47 | Strong data transformation coverage |
| E2E tests added | 7 | UI visibility tests; download flow gaps noted |
| Adversarial findings | 15 (4C/5H/4M/2L) | C1 (raw HTML) is highest priority follow-up |
| Testarch coverage | 85% (17/20 ACs) | CONCERNS — S03 UI integration gaps |

---

## Conclusion

Epic 53 successfully delivers a complete PKM export pipeline — Markdown for Obsidian, .apkg for Anki, and a batch ZIP with README. The architecture is clean and composable, with the orchestrator pattern keeping the batch export to 122 lines. The 100% first-pass review rate validates the pre-implementation edge case review practice. The decision to replace the unmaintained `anki-apkg-export` package with a custom sql.js + JSZip implementation was the right call, eliminating both WASM deployment risk and supply chain concerns.

The primary follow-up items are: fixing raw HTML in flashcard Markdown export (C1 — critical for Obsidian usability), adding E2E tests for the Settings UI export flow (C3), and adding partial-failure resilience to the PKM bundle orchestrator (C4). The testarch trace's CONCERNS verdict on S03 UI integration tests reinforces that export button wiring needs E2E smoke coverage. Nine action items (3 process, 6 tech debt) carry forward, including 4 items from previous epics.

**Dependencies unlocked:** E74 (Notion Cloud Export) can now build on E53's export infrastructure.
