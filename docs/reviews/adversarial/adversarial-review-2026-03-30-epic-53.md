# Adversarial Review: Epic 53 — PKM Export Phase 1

**Date:** 2026-03-30
**Reviewer:** Claude Opus 4.6 (adversarial)
**Epic:** E53 — PKM Export Phase 1 (Markdown + Anki .apkg)
**Stories:** E53-S01, E53-S02, E53-S03
**Verdict:** PASS WITH 15 FINDINGS (4 critical, 5 high, 4 medium, 2 low)

---

## Executive Summary

Epic 53 delivers Markdown export for flashcards and bookmarks, Anki .apkg generation, and a Settings UI for batch PKM/Anki downloads. The implementation is structurally clean: `flashcardExport.ts`, `bookmarkExport.ts`, and `ankiExport.ts` are well-factored modules with proper separation. The Anki implementation notably avoided the `anki-apkg-export` npm package entirely, hand-rolling the SQLite schema via `sql.js` ASM build -- a smart decision that sidesteps the unmaintained-dependency risk identified in the edge case review.

However, the epic has several serious gaps: HTML content is written raw into Markdown Q/A bodies (flashcards will contain Tiptap HTML tags in Obsidian), two of three story files have empty lessons-learned sections, zero E2E tests exercise actual export functionality (only UI visibility tests exist), the PKM bundle has no partial-failure resilience, and `Date.now()` is used directly in `ankiExport.ts` making the Anki ID generation non-deterministic and untestable.

---

## Findings

### CRITICAL

#### C1: Flashcard Markdown export writes raw HTML into Q/A body -- unreadable in Obsidian

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/flashcardExport.ts:156`

```typescript
const body = `# Q: ${fc.front}\n\n${fc.back}\n`
```

The Anki export correctly calls `stripHtml()` on `fc.front` and `fc.back` before adding cards (line 367-368 of `ankiExport.ts`). But the Markdown export does *not*. The `Flashcard` type stores Tiptap editor HTML in `front` and `back` fields. This means the Markdown file will contain:

```markdown
# Q: <p>What is <strong>React</strong>?</p>

<div data-tiptap="true"><p>A JavaScript library</p></div>
```

This is the primary export format for Obsidian users and it will look like garbage. The edge case review (EC-HIGH 1.5) explicitly flagged this for the Anki path and it was fixed there, but the same issue exists on the Markdown path and was missed.

**Fix:** Apply `htmlToMarkdown()` (from `noteExport.ts`) to `fc.front` and `fc.back` before writing the Q/A body. For the YAML frontmatter deck name, continue using `yamlString()`.

#### C2: Two of three story files have empty "Challenges and Lessons Learned" sections

**Files:**
- `/Volumes/SSD/Dev/Apps/Knowlune/docs/implementation-artifacts/stories/E53-S01-flashcard-bookmark-markdown-export.md:111`
- `/Volumes/SSD/Dev/Apps/Knowlune/docs/implementation-artifacts/stories/E53-S02-anki-apkg-export.md:120`

Both E53-S01 and E53-S02 still contain the placeholder text `[Document issues, solutions, and patterns worth remembering]`. E53-S02 in particular had significant implementation decisions worth documenting:
- Chose `sql.js` ASM build over the unmaintained `anki-apkg-export` package
- Hand-rolled the Anki SQLite schema template (220 lines of SQL)
- Used `crypto.subtle.digest('SHA-1')` for note GUIDs and checksums

E53-S01 also had the `yieldToUI()` pattern, YAML escaping, and filename dedup logic worth capturing. The `/review-story` lessons-learned gate should have blocked these.

#### C3: Zero E2E tests exercise actual export functionality -- only UI visibility is tested

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/tests/e2e/story-e53-s03.spec.ts`

The E2E test suite (77 lines) only verifies:
1. Export cards are visible on the Settings page
2. Buttons have correct `aria-label` attributes
3. Empty state toasts appear when clicking with no data

There are **zero tests** that:
- Seed IDB with flashcards/bookmarks/notes, trigger export, and verify a download event fires
- Verify the exported ZIP contains expected folder structure
- Verify the .apkg blob is non-zero bytes
- Test the `isExporting` disabled state during an active export (AC4)

The story spec (E53-S03 Testing Notes) explicitly lists: "Click Obsidian export -> intercept download event, verify ZIP triggers" and "Click Anki export -> intercept download event, verify .apkg triggers." These were not implemented. The unit tests partially compensate, but they mock everything -- the integration path from button click through to file download is completely untested.

#### C4: PKM bundle orchestrator has no partial-failure resilience -- one sub-exporter failure kills entire export

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/pkmExport.ts:25-73`

If `exportFlashcardsAsMarkdown()` throws (e.g., corrupted IDB data), the entire PKM export fails -- including the notes and bookmarks that exported successfully. There is no try/catch around individual sub-exporters.

The edge case review (EC 11.2) explicitly identified this as MEDIUM severity and recommended wrapping each sub-exporter in individual try/catch, collecting partial results, and appending a warning to the README. This was not implemented.

**Fix:** Wrap each sub-exporter call in its own try/catch. On partial failure, include successfully exported files and add a warning section to the README.

### HIGH

#### H1: `Date.now()` used directly in ankiExport.ts for Anki card/note IDs -- non-deterministic

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/ankiExport.ts:321`

```typescript
const now = Date.now()
const topDeckId = now
const topModelId = now + 1
```

`Date.now()` is called at line 321, and from it derives deck ID, model ID, card IDs (`now + 100 + i`), and note IDs. This:
1. Violates the project's ESLint rule `test-patterns/deterministic-time` (though only enforced in test files)
2. Makes the function impossible to snapshot-test deterministically
3. Creates a subtle bug: if two exports happen within the same millisecond (unlikely but possible with fast hardware), card IDs collide

The `bookmarkExport.ts` correctly accepts `now: Date = new Date()` as a parameter (line 63), enabling deterministic testing. `ankiExport.ts` should follow the same pattern.

#### H2: No `useRef` guard against double-click race condition on export buttons

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/Settings.tsx:358-380`

Both `handleExportPkm()` and `handleExportAnki()` use `if (isExporting) return` as the sole guard against concurrent execution. React state updates are batched, so a rapid double-click can fire two handler invocations before `setIsExporting(true)` propagates.

The edge case review (EC 11.1) specifically recommended adding `useRef(false)` as an immediate synchronous guard. No `exportingRef` or equivalent ref-based guard exists in the Settings page.

**Fix:** Add `const exportingRef = useRef(false)` and check/set it synchronously at the top of each handler.

#### H3: Anki GUID generation is content-based but includes time-dependent deck ID

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/ankiExport.ts:373`

```typescript
const noteGuid = await sha1Guid(`${topDeckId}${front}${back}`)
```

The GUID incorporates `topDeckId` which is `Date.now()`. This means re-exporting the same flashcards produces different GUIDs every time. If a user imports two exports into the same Anki profile, they get duplicate cards instead of updates. Anki uses GUIDs to detect duplicates across imports.

**Fix:** Remove `topDeckId` from the GUID input. Use a stable seed like `fc.id` or just `front + back`.

#### H4: Bookmark export uses video `filename` as heading -- raw filenames are ugly

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/bookmarkExport.ts:116`

```typescript
const videoName = videoMap.get(lessonId) || lessonId
```

The video map is built from `v.filename` (line 84), not `v.title`. Bookmark headings will display raw filenames like `## 03-hooks-in-depth.mp4` instead of cleaned-up lesson titles. If the video has a `title` field, it should be preferred. Falling back to `lessonId` (a UUID) when the video is not found produces an incomprehensible heading.

**Fix:** Use `v.title || v.filename` when building the video map. Use a human-readable fallback like `'Untitled Video'` instead of `lessonId`.

#### H5: `handleExportPkm` reports "No learning data to export" via `toastSuccess` instead of `toastInfo`

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/app/pages/Settings.tsx:367`

```typescript
toastSuccess.exported('No learning data to export')
```

Telling the user "no data to export" through a success toast (green checkmark) is semantically wrong. Same issue on line 393 for `handleExportAnki`. The Anki empty state uses `toastSuccess.exported('No flashcards to export...')` which shows a green success icon for what is actually an informational/warning message. This is confusing UX.

### MEDIUM

#### M1: Flashcard front text used directly in filenames without HTML stripping

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/flashcardExport.ts:160`

```typescript
let baseName = sanitizeFilename(fc.front.slice(0, 50))
```

If `fc.front` is `<p>What is React?</p>`, `sanitizeFilename` will produce something like `p-What-is-React-p.md` because angle brackets are stripped but the `p` tag text remnants remain. Should call `stripHtml()` first.

#### M2: YAML frontmatter in flashcard export does not sanitize numeric fields against NaN/Infinity

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/flashcardExport.ts:81-88`

FSRS fields like `stability`, `difficulty`, `reps`, `lapses`, `elapsed_days`, `scheduled_days` are written directly to YAML without validation:

```typescript
`stability: ${flashcard.stability}`,
```

If any field is `NaN` or `Infinity` (from corrupted IDB data), the YAML will contain `stability: NaN` which breaks YAML parsers. The edge case review (EC 5.1) recommended `Number.isFinite()` guards.

#### M3: `exportPkmBundle` counts README in the reported file total -- inflated count

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/pkmExport.ts:61-69`

The README is added to `allFiles` (line 69), and `Settings.tsx:372` reports `files.length` in the toast. So a user with 10 notes, 5 flashcards, and 2 bookmark files sees "PKM bundle (18 files)" -- but 17 are actual content files. The off-by-one is minor but inaccurate.

#### M4: Edge case review's 44 findings were not tracked in `docs/known-issues.yaml`

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/docs/reviews/adversarial/edge-case-review-2026-03-28-pkm-export.md`

A thorough edge case review was conducted pre-implementation with 14 HIGH severity findings. The E53-S02 story file incorporated 4 of them as "must address" items (lines 78-83). However, the remaining 10 HIGH findings (iOS Safari downloads, JSZip memory exhaustion, base64 image bloat, YAML injection, file naming collisions, etc.) were neither implemented, tracked as known issues, nor explicitly deferred. They exist only in the review document. The post-epic workflow requires: "Review `docs/known-issues.yaml` for open items... schedule for a future epic, mark wont-fix, or fix now."

### LOW

#### L1: `bookmarkExport.ts` accepts `now` parameter for deterministic testing but `pkmExport.ts` does not pass it

**File:** `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/bookmarkExport.ts:63`

The `exportBookmarksAsMarkdown` function correctly accepts `now: Date = new Date()` for testability. But when called from `exportPkmBundle` (line 52 of `pkmExport.ts`), the `now` parameter is not forwarded -- it always uses the default `new Date()`. This means the PKM bundle's bookmark files have a different `exported` date than the README's `exportDate` if the export takes more than 1 second.

#### L2: Unit tests mock `sanitizeFilename` with a different implementation than the real one

**Files:**
- `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/__tests__/flashcardExport.test.ts:18-28`
- `/Volumes/SSD/Dev/Apps/Knowlune/src/lib/__tests__/bookmarkExport.test.ts:17-28`

Both test files mock `sanitizeFilename` with a regex-based implementation that may not match the real `sanitizeFilename` from `noteExport.ts`. If the real function has different behavior (e.g., handling Unicode, max length truncation), the tests would pass while the production code produces different filenames. Consider importing the real function or at minimum documenting why the mock diverges.

---

## Positive Observations

1. **Smart dependency decision:** Avoiding `anki-apkg-export` (unmaintained since 2019) and hand-rolling the Anki SQLite schema via `sql.js` ASM build eliminates the WASM binary deployment risk and the unmaintained dependency risk -- two of the highest severity items from the edge case review.

2. **Clean module architecture:** Each export format gets its own module (`flashcardExport.ts`, `bookmarkExport.ts`, `ankiExport.ts`) with `pkmExport.ts` as a thin orchestrator. Functions are exported and independently testable.

3. **Proper resource cleanup:** `ankiExport.ts` uses `try/finally` to ensure `sqlDb.close()` is called even when card insertion throws (line 414-416). This is tested.

4. **Comprehensive unit test coverage:** 4 test files covering all AC paths, edge cases (filename collisions, YAML escaping, empty states, progress callbacks). The `ankiExport.test.ts` is particularly thorough with 11 test cases including error paths.

5. **Consistent UI patterns:** The Settings page export cards exactly match the existing export card pattern (layout, spacing, design tokens, disabled state). This minimizes design review friction.

---

## Summary Table

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| C1 | CRITICAL | Raw HTML in Markdown Q/A body (flashcards unreadable in Obsidian) | Must fix |
| C2 | CRITICAL | 2/3 story files have empty lessons-learned sections | Must fix |
| C3 | CRITICAL | Zero E2E tests exercise actual export download flow | Must fix |
| C4 | CRITICAL | PKM bundle has no partial-failure resilience | Should fix |
| H1 | HIGH | `Date.now()` in ankiExport makes IDs non-deterministic | Should fix |
| H2 | HIGH | No useRef guard against double-click race on export buttons | Should fix |
| H3 | HIGH | Anki GUID includes time-dependent deck ID -- duplicates on reimport | Should fix |
| H4 | HIGH | Bookmark headings use raw filenames instead of video titles | Should fix |
| H5 | HIGH | Empty-state messages use success toast instead of info/warning | Should fix |
| M1 | MEDIUM | Flashcard filenames include HTML tag remnants | Should fix |
| M2 | MEDIUM | FSRS numeric fields not guarded against NaN/Infinity | Defer OK |
| M3 | MEDIUM | README counted in reported file total (off-by-one) | Defer OK |
| M4 | MEDIUM | Edge case review HIGH findings not tracked in known-issues.yaml | Must track |
| L1 | LOW | `now` parameter not forwarded from pkmExport to bookmarkExport | Defer OK |
| L2 | LOW | Unit test mocks sanitizeFilename with different implementation | Defer OK |
