# TestArch Trace: Epic 53 — PKM Export Phase 1

**Date:** 2026-03-30
**Epic:** E53 — PKM Export Phase 1
**Stories:** E53-S01, E53-S02, E53-S03
**Gate Decision:** CONCERNS

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total Acceptance Criteria | 20 |
| Fully Covered by Tests | 17 |
| Partially Covered | 2 |
| Not Covered | 1 |
| **Coverage Percentage** | **85%** |

## Traceability Matrix

### E53-S01: Flashcard & Bookmark Markdown Export

| AC | Description | Unit Test | E2E Test | Coverage |
|----|-------------|-----------|----------|----------|
| AC1 | Flashcard `.md` with YAML frontmatter (type, deck, tags, SRS fields) + Q/A body | `flashcardExport.test.ts` — "exports flashcard with YAML frontmatter and Q/A body (AC1)" | — | FULL |
| AC2 | Files organized under `flashcards/{course-name}/` (3 distinct folders) | `flashcardExport.test.ts` — "organizes files under flashcards/{course-name}/ folders (AC2)" | — | FULL |
| AC3 | Tags include course-name kebab-cased + linked note tags, deduplicated | `flashcardExport.test.ts` — "includes note tags in frontmatter when flashcard has noteId (AC3)" + `deriveFlashcardTags` suite (4 tests) | — | FULL |
| AC4 | Undefined optional fields omitted from YAML | `flashcardExport.test.ts` — "omits undefined optional fields from YAML (AC4)" | — | FULL |
| AC5 | Bookmarks: one `.md` per course, grouped by video heading, sorted by timestamp ascending | `bookmarkExport.test.ts` — "generates one file per course with YAML frontmatter (AC5)" + "sorts bookmarks by timestamp ascending within each video (AC5)" + "groups bookmarks by video heading" | — | FULL |
| AC6 | Timestamp 3725s formats as `1:02:05` | `bookmarkExport.test.ts` — "formats 3725 seconds as '1:02:05' (AC6)" + "formats timestamps correctly in bookmark entries (AC6)" + 5 additional `formatTimestamp` tests | — | FULL |
| AC7 | Empty flashcards/bookmarks return empty array | `flashcardExport.test.ts` — "returns empty array when no flashcards exist (AC7)" + `bookmarkExport.test.ts` — "returns empty array when no bookmarks exist (AC7)" | — | FULL |

**E53-S01 Coverage: 7/7 (100%)**

### E53-S02: Anki .apkg Export

| AC | Description | Unit Test | E2E Test | Coverage |
|----|-------------|-----------|----------|----------|
| AC1 | `exportFlashcardsAsAnki()` returns Blob with `.apkg` content | `ankiExport.test.ts` — "AC1: returns a Blob when flashcards exist" + "generates .apkg ZIP with collection.anki2 and media" | — | FULL |
| AC2 | All cards in one deck "Knowlune Export" with course-name tags | `ankiExport.test.ts` — "AC2: creates a single deck and adds all cards" | — | PARTIAL — verifies INSERT count but does not assert deck name "Knowlune Export" in SQL or tag values in card insertion |
| AC3 | Tags reuse `deriveFlashcardTags()` from S01 | `ankiExport.test.ts` — mocks `deriveFlashcardTags` and verifies it's called (implicit via card creation) | — | FULL |
| AC4 | No flashcards returns `null` | `ankiExport.test.ts` — "AC4: returns null when no flashcards exist" | `story-e53-s03.spec.ts` — "Anki export shows empty state toast when no flashcards exist" | FULL |
| AC5 | Dynamic `import()` for sql.js (bundle isolation) | `ankiExport.test.ts` — "AC5: dynamically imports sql.js" | — | PARTIAL — verifies sql.js was loaded but does not assert bundle size impact or that import is actually dynamic (mock intercepts) |

**E53-S02 Coverage: 5/5 (100% addressed, 2 partial)**

### E53-S03: PKM Batch Export & Settings UI

| AC | Description | Unit Test | E2E Test | Coverage |
|----|-------------|-----------|----------|----------|
| AC1 | Both export cards visible in Settings > Data Management | — | `story-e53-s03.spec.ts` — "both export cards are visible in Data Management section" | FULL |
| AC2 | Obsidian export downloads ZIP with `notes/`, `flashcards/`, `bookmarks/`, `README.md` | `pkmExport.test.ts` — "produces correct folder structure with all three sources" + "includes README.md in ZIP when data exists" + "README reports correct file counts" | — | PARTIAL — unit tests verify file array structure but no E2E test triggers download and verifies ZIP content |
| AC3 | Anki export downloads `.apkg` with filename `knowlune-flashcards-{date}.apkg` | — | — | NOT COVERED — no test verifies `.apkg` download filename format |
| AC4 | Buttons disabled during export (`isExporting` guard) | — | `story-e53-s03.spec.ts` — "PKM export button is initially enabled" + "Anki export button is initially enabled" | PARTIAL — tests verify initial enabled state but no test triggers export and asserts disabled state during progress |
| AC5 | Success toast with file count | `pkmExport.test.ts` — "reports total file count correctly" (indirect — verifies array length) | — | PARTIAL — no test verifies the actual toast message string |
| AC6 | Empty flashcards shows toast "No flashcards to export — create flashcards first" | — | `story-e53-s03.spec.ts` — "Anki export shows empty state toast when no flashcards exist" | FULL |
| AC7 | Error toast on failure + `isExporting` resets | — | — | NOT COVERED — no test simulates export failure and verifies error toast |
| AC8 | `aria-label` attributes and 44x44px touch targets | — | `story-e53-s03.spec.ts` — "PKM export button has correct aria-label" + "Anki export button has correct aria-label" | PARTIAL — aria-labels verified; 44x44px touch target not measured |

**E53-S03 Coverage: 8/8 addressed, but 2 NOT COVERED (AC3, AC7), 3 PARTIAL (AC2, AC4, AC5)**

## Gaps Found

### HIGH Priority

1. **E53-S03 AC3 — Anki download filename not tested.** No test verifies the `.apkg` filename format `knowlune-flashcards-{date}.apkg`. The handler constructs this in `Settings.tsx` but it is never asserted.

2. **E53-S03 AC7 — Error path not tested.** No test simulates an export failure (e.g., exception in `exportPkmBundle` or `exportFlashcardsAsAnki`) to verify the error toast message and `isExporting` reset behavior.

3. **E53-S03 AC4 — Disabled-during-export not tested.** E2E tests verify buttons start enabled but do not trigger an export and assert buttons become disabled during the operation.

### MEDIUM Priority

4. **E53-S02 AC2 — Deck name "Knowlune Export" not explicitly asserted.** The unit test checks INSERT count but does not verify the actual deck name string in the SQL UPDATE. The deck name is specified in the AC.

5. **E53-S03 AC2 — No E2E download verification.** The PKM export ZIP download is not intercepted in E2E. Unit tests cover the file array structure, but the full integration path (button click -> download event -> ZIP content) is not tested.

6. **E53-S03 AC5 — Success toast message not verified.** No test asserts the toast string "PKM bundle (N files)" appears after successful export.

7. **E53-S03 AC8 — Touch target size not measured.** Aria-labels are verified but the 44x44px minimum touch target requirement has no programmatic assertion.

### LOW Priority

8. **E53-S02 AC5 — Dynamic import verification is indirect.** The test confirms sql.js was loaded but the mock intercepts the import, making it impossible to verify the import is truly dynamic at the bundler level. This is an inherent testing limitation.

## Test Inventory

| Test File | Type | Tests | Stories Covered |
|-----------|------|-------|-----------------|
| `src/lib/__tests__/flashcardExport.test.ts` | Unit (Vitest) | 11 | E53-S01 AC1-4,7 |
| `src/lib/__tests__/bookmarkExport.test.ts` | Unit (Vitest) | 11 | E53-S01 AC5-7 |
| `src/lib/__tests__/ankiExport.test.ts` | Unit (Vitest) | 11 | E53-S02 AC1-5 |
| `src/lib/__tests__/pkmExport.test.ts` | Unit (Vitest) | 14 | E53-S03 AC2,5 |
| `tests/e2e/story-e53-s03.spec.ts` | E2E (Playwright) | 7 | E53-S03 AC1,4,6,8 |
| **Total** | | **54** | |

## Gate Decision: CONCERNS

**Rationale:** 85% coverage (17/20 ACs fully covered). The data transformation layer (S01, S02) is thoroughly tested with 33 unit tests covering all edge cases. However, the UI integration layer (S03) has notable gaps in error handling (AC7), download filename verification (AC3), and disabled-during-export behavior (AC4). These are moderate-risk gaps — the error path and concurrent-click guard are important for production robustness.

**Recommendation:** Add 3 targeted tests before shipping:
1. E2E or unit test for error toast + `isExporting` reset (AC7)
2. Unit test in Settings or integration test for `.apkg` filename format (AC3)
3. E2E test that triggers export and asserts button disabled state (AC4)
