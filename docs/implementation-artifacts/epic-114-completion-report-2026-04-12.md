# Epic 114 Completion Report — Reader Accessibility & Comfort

**Date:** 2026-04-12
**Epic:** E114 — Reader Accessibility & Comfort
**Stories:** E114-S01 (Reading Ruler & Spacing Controls), E114-S02 (Continuous Scroll Mode)
**Status:** Done — all stories shipped, post-epic validation complete

---

## Executive Summary

Epic 114 delivered three accessibility features for the EPUB reader: a visual reading ruler for dyslexic readers, typographic spacing controls (letter and word spacing), and a continuous scroll mode for readers who prefer flowing text. Both stories shipped in two review rounds each. Nine issues were found and fixed across four review rounds; none reached production. Post-epic validation (traceability, NFR assessment, retrospective) completed on the same day with 13 additional tests added and one word spacing step deviation corrected.

---

## Delivery Summary

| Metric | Value |
|--------|-------|
| Stories delivered | 2/2 (100%) |
| Total review rounds | 4 (2 per story) |
| Total issues fixed | 9 (6 in S01, 3 in S02) |
| Severity breakdown | 1 HIGH, 3 MEDIUM, 3 LOW, 2 NIT |
| Unit tests at epic close | 69 passing (useReaderStore: 18, ReadingRuler: 9, EpubRenderer: 42) |
| Tests added post-epic (trace) | 13 |
| Post-epic fixes | 1 (word spacing step: 0.05 → 0.02 to match AC-6 spec) |
| Production incidents | 0 |
| PRs merged | #305 (E114-S01), #306 (E114-S02) |
| Duration | 2026-04-12 (single day) |

---

## Stories Delivered

### E114-S01: Reading Ruler and Letter/Word Spacing Controls

**PR:** #305 | **Review rounds:** 2 | **Issues fixed:** 6

**Features shipped:**
- `ReadingRuler` component: horizontal band following pointer/touch, deferred render, `pointer-events-none`, `aria-hidden="true"`
- Letter Spacing slider (0–0.3em, step 0.02em)
- Word Spacing slider (0–0.5em, step 0.02em)
- epub.js theme integration via `rendition.themes.default()` with explicit `'normal'` reset when zeroing
- All settings persisted to localStorage with validation on load

**Review findings and fixes:**

| Round | Severity | Finding | Fix |
|-------|----------|---------|-----|
| R1 | HIGH | ReadingRuler at z-20 with pointer-events-auto blocked all tap navigation zones | Switched to `pointer-events-none` + document-level `pointermove` listener |
| R1 | MEDIUM | Ruler activated before first pointer move, creating invisible interaction blocker | Deferred render: `yPosition` starts as `null`, band only renders after first move |
| R1 | MEDIUM | No component tests for ReadingRuler | Added 9 ReadingRuler component tests |
| R1 | LOW | Spacing reset omitted property rather than sending `'normal'` | Applied `'normal'` string when spacing value is 0 |
| R1 | LOW | No test for negative wordSpacing clamp | Added clamp boundary test |
| R1 | NIT | `getSettingsFromState` manually listed fields | Refactored to `Object.keys(DEFAULT_SETTINGS)` for automatic inclusion |

---

### E114-S02: Continuous Scroll Mode

**PR:** #306 | **Review rounds:** 2 | **Issues fixed:** 3

**Features shipped:**
- Continuous Scroll toggle in Reader Settings panel
- `scrolled-doc` / `paginated` flow switching via `rendition.flow()` at runtime
- Prev/next tap zones hidden in scroll mode; center toggle zone always rendered
- Touch swipe handlers disabled in scroll mode (native scroll passthrough)
- `scrollMode` persisted to localStorage

**Review findings and fixes:**

| Round | Severity | Finding | Fix |
|-------|----------|---------|-----|
| R1 | MEDIUM | Center tap zone hidden in scroll mode (prev/next siblings removed from flex row shifted its position) | Switched center zone to absolute positioning with fixed coordinates; always rendered |
| R1 | LOW | Theme not re-applied after `rendition.flow()` switch | Added `applyTheme()` call after `flow()` → `resize()` sequence |
| R1 | NIT | `overflow-y-auto` on container conflicted with epub.js scroll handling | Removed; epub.js manages scroll internally |

---

## Post-Epic Validation

### Traceability (testarch-trace)

| Priority | Total ACs | FULL coverage | PARTIAL | NONE | Coverage % |
|----------|-----------|---------------|---------|------|------------|
| MUST | 16 | 16 | 0 | 0 | 100% ✅ |
| SHOULD | 2 | 2 | 0 | 0 | 100% ✅ |
| **Total** | **18** | **18** | **0** | **0** | **100% ✅** |

13 tests were added during the trace pass to fill gaps in `EpubRenderer.test.tsx`:
- 3 tests: letter-spacing applied to rendition (AC-7)
- 2 tests: `'normal'` reset on zero spacing (AC-8)
- 1 test: `scrolled-doc` flow in epubOptions (AC-2)
- 1 test: `paginated` flow in epubOptions (AC-3)
- 1 test: prev/next zones hidden in scroll mode (AC-4)
- 1 test: swipe handlers disabled in scroll mode (AC-4)
- 1 test: center zone active in scroll mode (AC-5)
- 1 test: theme re-apply after flow change (AC-7)
- 2 additional: spacing re-apply on value change (AC-7)

### NFR Assessment

| Domain | Verdict |
|--------|---------|
| Performance | ✅ PASS |
| Accessibility (WCAG 2.1 AA) | ✅ PASS |
| Reliability & Data Integrity | ✅ PASS |
| Correctness vs AC Specification | ✅ PASS (after fix) |
| Code Quality & Maintainability | ✅ PASS |

**One deviation corrected during NFR:** AC-6 specified word spacing `step 0.02em`; implementation used `step={0.05}`. Fixed in `ReaderSettingsPanel.tsx` (`step={0.05}` → `step={0.02}`). Severity: LOW.

---

## Engineering Patterns Extracted

Four reusable patterns emerged from this epic and are documented in the retrospective for addition to `docs/engineering-patterns.md`:

### 1. Full-viewport overlays: `pointer-events-none` + document-level listener

Any UI layer that must coexist with interactive elements below it (reading rulers, annotation overlays, highlight layers) must use `pointer-events-none` on the overlay container and capture events at the document level. Applying this rule at design time prevents the overlay from silently blocking all tap zones.

### 2. epub.js `rendition.themes.default()` is a merge patch

The API accumulates CSS properties — calling it twice merges results rather than replacing them. To clear a property, send the explicit CSS reset value (`'normal'`, `'0'`, etc.). Omitting the key has no effect on already-set properties.

### 3. epub.js flow switch requires explicit follow-up

`rendition.flow()` does not automatically resize or re-apply the theme. The correct sequence is: `flow()` → `resize()` → `applyTheme()`. Any feature toggling epub.js flow mode must include this sequence to avoid visual artifacts.

### 4. Absolute positioning for independent overlay tap zones

When tap zones are conditionally rendered siblings in a flex layout, removing one shifts the others. Fixed coordinates using absolute positioning make each zone's position independent of its siblings. Applied to all multi-zone tap target layouts where zones can be individually hidden.

### 5. Deferred render for position-dependent UI elements

Initialize position state as `null`; do not render the element until position is set by the first user interaction. Prevents invisible interaction blockers on activation.

---

## Known Issues Cross-Reference

- **Matched (already in register):** none
- **New issues added:** none
- **E2E coverage gap (accepted):** Both story E2E spec files (`story-e114-s01.spec.ts`, `story-e114-s02.spec.ts`) exist in the worktree but are not running in CI. Reader features require a loaded EPUB file, which exceeds current E2E infrastructure. This is a recurring gap for all reader-feature epics.

---

## Action Items Carried Forward to E115

| # | Action | Source | Status |
|---|--------|--------|--------|
| 1 | Add AC-to-UI trace step to story pre-review checklist | E112–E113 | Carried (10th consecutive non-completion) |
| 2 | Add numerator/denominator scope note to `engineering-patterns.md` | E112–E113 | Carried |
| 3 | Add formula-derivation step to story template | E112–E113 | Carried |
| 4 | Add `set(state => ...)` callback form note to `engineering-patterns.md` | E113 | Carried |
| 5 | Add "verify pattern at every call site" to story template | E113 | Carried |
| 6 | Add full-viewport overlay default pattern to `engineering-patterns.md` | **E114 (new)** | Before E115-S01 |
| 7 | Add epub.js theme merge behavior to `engineering-patterns.md` | **E114 (new)** | Before E115-S01 |
| 8 | Add epub.js flow switch sequence to `engineering-patterns.md` | **E114 (new)** | Before E115-S01 |

**Note:** Items 1–5 are carried from previous epics. The mechanism of capturing action items in retro documents has a 10-epic failure rate. Items 6–8 are new and currently only documented in the retrospective and story files.

---

## Sprint Status

```yaml
epic-114: done
114-1-reading-ruler-and-spacing: done
114-2-continuous-scroll-mode: done
epic-114-retrospective: done
```

**Next epic:** E115 — Custom Reading Challenges (1 story; depends on E107 reading stats infrastructure)

---

## Source Documents

| Document | Path |
|----------|------|
| Execution tracker | `docs/implementation-artifacts/epic-114-tracking-2026-04-12.md` |
| Story S01 | `docs/implementation-artifacts/stories/E114-S01.md` |
| Story S02 | `docs/implementation-artifacts/stories/E114-S02.md` |
| Traceability matrix | `docs/implementation-artifacts/traceability-e114-2026-04-12.md` |
| NFR assessment | `docs/implementation-artifacts/e114-nfr-assessment-2026-04-12.md` |
| Retrospective | `docs/implementation-artifacts/epic-114-retro-2026-04-12.md` |
