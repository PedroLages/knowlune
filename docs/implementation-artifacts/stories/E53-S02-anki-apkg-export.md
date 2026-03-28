---
story_id: E53-S02
story_name: "Anki .apkg Export"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 53.02: Anki .apkg Export

## Story

As a learner using Anki for spaced repetition,
I want to export my flashcards as an Anki-compatible .apkg file,
so that I can review my Knowlune flashcards in Anki with proper deck organization and tags.

## Acceptance Criteria

- [ ] AC1: Given flashcards exist in IndexedDB, when `exportFlashcardsAsAnki()` is called, then a Blob is returned with MIME-compatible `.apkg` content.
- [ ] AC2: Given flashcards span multiple courses, when exported to Anki, then all cards are in one deck named "Knowlune Export" with course-name tags per card.
- [ ] AC3: Given a flashcard linked to a note with tags `["react", "hooks"]` in course "React Mastery", when exported to Anki, then the Anki card has tags `["react-mastery", "react", "hooks"]` (reusing `deriveFlashcardTags()` from E53-S01).
- [ ] AC4: Given no flashcards exist, when `exportFlashcardsAsAnki()` is called, then `null` is returned without error (caller handles empty state).
- [ ] AC5: Given the `anki-apkg-export` package, when loaded during Anki export, then it is loaded via dynamic `import()` to keep the main bundle lean (~500KB sql.js excluded from initial load).

## Tasks / Subtasks

- [ ] Task 1: Install `anki-apkg-export` npm package (AC: 1)
  - [ ] 1.1 `npm install anki-apkg-export`
  - [ ] 1.2 Verify installation and check for TypeScript types

- [ ] Task 2: Create type declaration if needed (AC: 1)
  - [ ] 2.1 Check if `@types/anki-apkg-export` exists or package has built-in types
  - [ ] 2.2 If not, create `src/types/anki-apkg-export.d.ts` with `AnkiExport` class declaration (constructor, addCard, save)

- [ ] Task 3: Create `src/lib/ankiExport.ts` (AC: 1, 2, 3, 4, 5)
  - [ ] 3.1 Implement `exportFlashcardsAsAnki(onProgress?): Promise<Blob | null>`
  - [ ] 3.2 Use dynamic `import()`: `const { default: AnkiExport } = await import('anki-apkg-export')`
  - [ ] 3.3 Load flashcards, course map, note tag map (same data-loading pattern as S01)
  - [ ] 3.4 Reuse `deriveFlashcardTags()` from `flashcardExport.ts`
  - [ ] 3.5 Create single deck: `new AnkiExport('Knowlune Export')`
  - [ ] 3.6 Add each card: `apkg.addCard(card.front, card.back, { tags: derivedTags })`
  - [ ] 3.7 Return `null` if no flashcards (caller handles empty state)
  - [ ] 3.8 Progress callbacks through card iteration

- [ ] Task 4: Manual verification with Anki desktop (AC: 5)
  - [ ] 4.1 Generate a test `.apkg` and import into Anki desktop (v24+)
  - [ ] 4.2 Verify deck name "Knowlune Export", card content (front/back), and tags appear correctly
  - [ ] 4.3 Document any quirks in Implementation Notes

## Design Guidance

N/A — this story is purely data transformation logic with no UI components.

## Implementation Notes

**Key files to reference:**
- `src/lib/flashcardExport.ts` (from E53-S01) — `deriveFlashcardTags()` for tag reuse
- `src/lib/exportService.ts` — `ExportProgressCallback` type, `yieldToUI()`
- `src/lib/fileDownload.ts` — `downloadBlob()` for binary file download (used by S03)
- `src/data/types.ts:437-452` — `Flashcard` type

**New file to create:**
- `src/lib/ankiExport.ts` — `exportFlashcardsAsAnki()`
- `src/types/anki-apkg-export.d.ts` (if needed) — type declaration

**Technical decisions:**
- **Single deck approach:** One "Knowlune Export" deck with course-name tags per card. Anki users filter by tag. Simpler than multi-file ZIP of `.apkg` files.
- **SRS data caveat:** `anki-apkg-export` does not support importing SM-2 scheduling state. Anki uses its own scheduler. SRS metadata preserved in Markdown (S01) but not transferred to Anki's scheduler.
- **Risk: package maintenance.** If `anki-apkg-export` is unmaintained, fallback is CSV export with Anki-compatible columns (`front`, `back`, `tags`).

**New dependency:**
- `anki-apkg-export` — generates `.apkg` files (SQLite + ZIP). Bundles `sql.js` (~500KB gzipped). Dynamic import keeps it off main bundle.

**Edge case review findings (HIGH severity — must address):**
- **EC-HIGH: sql.js WASM binary missing in production builds.** `anki-apkg-export` depends on `sql.js` which loads a `.wasm` file at runtime. Vite must be configured to copy this to the build output. Add WASM config to `vite.config.ts` or use `sql.js` dist that bundles WASM inline. Test in `npm run build` + production serve. (Edge case review: `docs/reviews/adversarial/edge-case-review-2026-03-28-pkm-export.md`)
- **EC-HIGH: HTML content in flashcard front/back passed directly to Anki.** Strip HTML tags from `card.front`/`card.back` before adding to Anki deck, or convert to plain text. Anki renders HTML but raw Tiptap HTML may include unwanted `data-*` attributes.
- **EC-HIGH: `anki-apkg-export` unmaintained since ~2019.** Test thoroughly. If it fails with modern sql.js, prepare CSV fallback: `front\tback\ttags` format that Anki can import via File → Import.
- **EC-HIGH: Dynamic import() failure.** Wrap in try-catch with user-visible error: `toast.error('Anki export package failed to load. Try CSV export instead.')`

## Testing Notes

**E2E tests:**
- Seed IDB with flashcards via factories
- Call `exportFlashcardsAsAnki()` and verify Blob is returned
- Verify `null` returned when no flashcards exist
- Cannot easily verify `.apkg` internal structure in E2E — rely on manual Anki desktop import verification

**Manual verification (during development):**
- Import `.apkg` into Anki desktop -> verify cards, deck name, tags
- Check that multi-course tags appear correctly

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
