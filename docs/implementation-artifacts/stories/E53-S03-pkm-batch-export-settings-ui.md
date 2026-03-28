---
story_id: E53-S03
story_name: "PKM Batch Export & Settings UI"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 53.03: PKM Batch Export & Settings UI

## Story

As a learner who wants a complete knowledge export,
I want to trigger PKM and Anki exports from the Settings page with progress feedback,
so that I can easily download all my learning data in formats compatible with Obsidian and Anki.

## Acceptance Criteria

- [ ] AC1: Given the Settings page, when viewing the Data Management section, then "PKM Export (Obsidian)" and "Flashcard Export (Anki)" cards are visible below existing export cards and above the progress indicator.
- [ ] AC2: Given notes, flashcards, and bookmarks exist in IndexedDB, when clicking the Obsidian export button, then a ZIP downloads with folder structure `notes/`, `flashcards/{course}/`, `bookmarks/{course}/`, and a root `README.md` containing export date and file counts.
- [ ] AC3: Given flashcards exist in IndexedDB, when clicking the Anki export button, then a `.apkg` file downloads with filename `knowlune-flashcards-{date}.apkg`.
- [ ] AC4: Given an export is in progress (`isExporting` is true), when any export button is clicked, then it does nothing (all export buttons show `disabled` state).
- [ ] AC5: Given the Obsidian export completes successfully, when the download triggers, then a success toast shows the file count (e.g., "PKM bundle (47 files)").
- [ ] AC6: Given no flashcards exist, when clicking the Anki export button, then a toast shows "No flashcards to export — create flashcards first" without error.
- [ ] AC7: Given the export fails (exception thrown), when the error is caught, then an error toast appears ("Export failed — try freeing disk space") and `isExporting` resets to false.
- [ ] AC8: Given both new export cards, when rendered, then they have proper `aria-label` attributes and meet 44x44px touch target minimum on mobile.

## Tasks / Subtasks

- [ ] Task 1: Create `src/lib/pkmExport.ts` (AC: 2, 5)
  - [ ] 1.1 Implement `exportPkmBundle(onProgress?): Promise<Array<{ name: string; content: string }>>`
  - [ ] 1.2 Orchestrate three exporters with weighted progress: `exportNotesAsMarkdown()` (40%), `exportFlashcardsAsMarkdown()` (40%), `exportBookmarksAsMarkdown()` (20%)
  - [ ] 1.3 Prefix note file names with `notes/` (notes don't already have folder prefix)
  - [ ] 1.4 Combine all file arrays
  - [ ] 1.5 Add root `README.md` with export date, file count table, folder structure docs

- [ ] Task 2: Add imports to `Settings.tsx` (AC: 1)
  - [ ] 2.1 Import `exportFlashcardsAsAnki` from `@/lib/ankiExport`
  - [ ] 2.2 Import `exportPkmBundle` from `@/lib/pkmExport`
  - [ ] 2.3 Import `FolderOpen`, `BrainCircuit` from `lucide-react` (verify icons exist; fallback: `FolderArchive`, `Layers`)
  - [ ] 2.4 Import `downloadBlob` from `@/lib/fileDownload`

- [ ] Task 3: Add `handleExportPkm()` handler (AC: 2, 4, 5, 7)
  - [ ] 3.1 Add after existing `handleExportBadges()` function
  - [ ] 3.2 Follow identical try/catch/finally pattern with `isExporting` guard
  - [ ] 3.3 Call `exportPkmBundle()` with progress callbacks
  - [ ] 3.4 If `files.length === 0`: toast "No learning data to export" and return
  - [ ] 3.5 `downloadZip(files, \`knowlune-pkm-export-${dateStr}.zip\`)`
  - [ ] 3.6 Success toast: `PKM bundle (${files.length} files)`

- [ ] Task 4: Add `handleExportAnki()` handler (AC: 3, 4, 6, 7)
  - [ ] 4.1 Add after `handleExportPkm()`
  - [ ] 4.2 Call `exportFlashcardsAsAnki()` with progress callbacks
  - [ ] 4.3 If result is `null`: toast "No flashcards to export — create flashcards first" and return
  - [ ] 4.4 `downloadBlob(blob, \`knowlune-flashcards-${dateStr}.apkg\`)`
  - [ ] 4.5 Success toast: `Flashcards (Anki)`

- [ ] Task 5: Add "PKM Export (Obsidian)" UI card (AC: 1, 8)
  - [ ] 5.1 Insert after "Achievements Export" card, before `{isExporting && ...}` progress indicator
  - [ ] 5.2 Follow existing card HTML pattern: `rounded-xl border border-border bg-surface-elevated p-4 hover:bg-surface-elevated/80 transition-colors`
  - [ ] 5.3 Icon: `FolderOpen` in `bg-brand-soft` rounded-lg container
  - [ ] 5.4 Title: "PKM Export (Obsidian)", Description: "Notes, flashcards, and bookmarks as Markdown with YAML frontmatter"
  - [ ] 5.5 Button: `variant="outline" size="sm"`, text "Obsidian", `Download` icon
  - [ ] 5.6 `onClick={handleExportPkm}`, `disabled={isExporting}`
  - [ ] 5.7 `aria-label="Export learning data as Obsidian-compatible Markdown"`
  - [ ] 5.8 `data-testid="export-pkm-button"`

- [ ] Task 6: Add "Flashcard Export (Anki)" UI card (AC: 1, 8)
  - [ ] 6.1 Insert after the PKM card
  - [ ] 6.2 Icon: `BrainCircuit` in `bg-success-soft` rounded-lg container
  - [ ] 6.3 Title: "Flashcard Export (Anki)", Description: "Anki-compatible .apkg deck with spaced repetition data"
  - [ ] 6.4 Button: `variant="outline" size="sm"`, text "Anki", `Download` icon
  - [ ] 6.5 `onClick={handleExportAnki}`, `disabled={isExporting}`
  - [ ] 6.6 `aria-label="Export flashcards as Anki deck"`
  - [ ] 6.7 `data-testid="export-anki-button"`

## Design Guidance

**Layout:** Follow the existing Settings Data Management export card pattern exactly. Each card has:
- Left side: colored icon container + title + description text
- Right side: outline button with Download icon
- Cards stack vertically with consistent spacing

**Design tokens (from styling.md):**
- PKM card icon background: `bg-brand-soft` (consistent with note-related actions)
- Anki card icon background: `bg-success-soft` (distinct color for different format)
- Never use hardcoded Tailwind colors (ESLint enforced)

**Accessibility:**
- `aria-label` on both buttons describing the action
- `data-testid` for E2E test targeting
- Buttons disabled during export with visual feedback
- Touch targets >= 44x44px on mobile

## Implementation Notes

**Key files to modify:**
- `src/app/pages/Settings.tsx` — add handlers + UI cards (existing export cards at lines 948-1064)

**New file to create:**
- `src/lib/pkmExport.ts` — `exportPkmBundle()` orchestrator

**Key files to reference:**
- `src/lib/flashcardExport.ts` (from E53-S01) — `exportFlashcardsAsMarkdown()`
- `src/lib/bookmarkExport.ts` (from E53-S01) — `exportBookmarksAsMarkdown()`
- `src/lib/ankiExport.ts` (from E53-S02) — `exportFlashcardsAsAnki()`
- `src/lib/exportService.ts` — `exportNotesAsMarkdown()`, `ExportProgressCallback`
- `src/lib/fileDownload.ts` — `downloadZip()`, `downloadBlob()`

**Settings page handler pattern:**
```
const handleExport = async () => {
  if (isExporting) return;
  setIsExporting(true);
  try {
    const result = await exportFunction((percent, phase) => {
      setExportProgress(percent);
      setExportPhase(phase);
    });
    // handle empty state
    // trigger download
    toast.success('...');
  } catch (err) {
    toast.error('Export failed — try freeing disk space');
  } finally {
    setIsExporting(false);
  }
};
```

## Testing Notes

**E2E tests (Playwright):**
- Navigate to Settings -> Data Management
- Verify both new export cards are visible (`data-testid="export-pkm-button"`, `data-testid="export-anki-button"`)
- Seed IDB with flashcards + bookmarks + notes via factories
- Click Obsidian export -> intercept download event, verify ZIP triggers
- Click Anki export -> intercept download event, verify `.apkg` triggers
- Verify all export buttons disabled during export
- Empty state: clear IDB -> click Anki -> verify toast "No flashcards to export"

**Manual verification:**
- Open downloaded ZIP in file manager -> verify folder structure
- Open Markdown files in Obsidian -> verify frontmatter parses, Q/A readable
- Import `.apkg` into Anki desktop -> verify cards, deck name, tags

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
