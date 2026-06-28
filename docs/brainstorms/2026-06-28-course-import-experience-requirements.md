---
date: 2026-06-28
topic: course-import-experience
---

# Course Import Experience — URL Batch Import and Dialog Redesign

## Problem Frame

Users who self-host courses (e.g., on an nginx-based file server like the Knowlune Media Server) have no way to batch-import multiple courses from a server URL. The only URL import path handles single courses via `ImportWizardDialog`, while the `BulkImportDialog` "Import Multiple Folders" flow is restricted to the local filesystem via `showDirectoryPicker()`. Additionally, the Learning Tracks create-track flow inherits this limitation — users composing a curriculum can only batch-import from local directories. Finally, the import source selection UI has grown organically across two dialogs (BulkImportDialog, ImportWizardDialog) with inconsistent patterns: URL import is hidden behind a toggle in ImportWizardDialog rather than presented as a first-class option.

## Requirements

### R1: URL Batch Import Entry Point in BulkImportDialog

- R1.1. The BulkImportDialog "choose" step (source selection) shall add a fourth card option "Import Multiple from URL" alongside "Import Single Folder", "Import Multiple Folders", and "Build from YouTube".
- R1.2. The new card shall use the same visual pattern as existing cards: icon, title, and description text, with consistent hover/focus/active states.
- R1.3. A new dialog step `'enter-url'` shall be added to `DialogStep` type in BulkImportDialog.
- R1.4. The `'enter-url'` step shall display a URL input field, a "Scan" button, and clear guidance text explaining what URL to paste (e.g., "Paste the server URL containing course folders").
- R1.5. URL validation shall run before scanning: reject protocols other than http and https, obviously malformed URLs, and empty input with inline error messages.
- R1.6. The "Scan" button shall call a new `listServerSubDirectories()` function (per R4) and display discovered folders.
- R1.7. The user may press Enter in the URL input to trigger scanning (keyboard navigation support).
- R1.8. A "Back" button in the `'enter-url'` step shall return to the `'choose'` step.

### R2: Server Sub-Directory Discovery and Folder Selection

- R2.1. Server-discovered folders shall be displayed using the existing `'select-folders'` step UI: checkbox list with Select All / Deselect All, folder name display, and selection count indicator.
- R2.2. The `FolderEntry` interface shall gain an optional `serverUrl: string` field to support server-sourced folders alongside filesystem-handle-sourced folders.
- R2.3. The `ImportItem` interface shall gain an optional `serverUrl: string` field.
- R2.4. Each discovered server folder shall store the full URL to that specific subdirectory (the url value returned by `listServerSubDirectories`, composed from parent URL plus folder name) for later scanning.
- R2.5. Error states during discovery (non-200 response, non-nginx server, CORS failure, network error, empty directory) shall surface friendly messages to the user without crashing the dialog.
- R2.6. If the parent server URL contains a `track-manifest.json`, handle it identically to the local-flow manifest: auto-sort folders by manifest position, store manifest data, and pass it through to the batch import pipeline.

### R3: Server Folder Scanning

- R3.1. When scanning server-sourced folders, the scanning step shall call `scanCourseFolderFromServer()` (already exists at `src/lib/courseImport.ts:1292`) instead of `scanCourseFolderFromHandle()`.
- R3.2. The existing concurrent scanning infrastructure (`MAX_CONCURRENCY = 5`, `Promise.race` loop, progress tracking) shall be reused for server-sourced folders.
- R3.3. The review, importing, and results steps shall operate identically regardless of whether courses originated from server URLs or local filesystem — these steps are source-agnostic (they operate on `ScannedCourse` objects).
- R3.4. Cancellation support (abortRef) must apply to server scanning just as it does to local scanning.

### R4: `listServerSubDirectories(url)` Function

- R4.1. A new exported function `listServerSubDirectories(url: string)` shall be added to `src/lib/courseImport.ts`.
- R4.2. The function shall call `fetchDirectoryListing()` to parse nginx autoindex HTML, then filter for entries classified as directories and return them as `{name, url}` objects.
- R4.3. The function shall return a `Promise<ServerResult<{name: string; url: string}[]>>`, consistent with the existing `fetchDirectoryListing` return type pattern in `src/lib/courseServerService.ts`.
- R4.4. On success, the result shall contain the array of discovered sub-directory entries. On error, it shall contain a descriptive error message without throwing.
- R4.5. The function shall validate the URL before fetching.

### R5: Batch URL Import in Learning Tracks Create-Track Flow

- R5.1. The `InlineCoursePicker` batch import entry point (in `CurriculumComposer`) shall open `BulkImportDialog` with the new URL import option visible — this should work automatically since `InlineCoursePicker` already launches `BulkImportDialog`. Unlike the YouTube import card (which depends on the `onYouTubeImport` prop), the URL batch import card shall always be visible in BulkImportDialog across all calling contexts.
- R5.2. Courses imported via URL batch through the create-track flow shall be auto-added to the track being created via the existing `COURSE_IMPORTED` custom event and target path mechanism.
- R5.3. Verify end-to-end that `CurriculumComposer` -> `InlineCoursePicker` -> batch import URL -> courses appear in the new track. If prop threading for track context is needed, add it.

### R6: Import Dialog Source Selection Redesign

- R6.1. All import sources in both BulkImportDialog "choose" step and ImportWizardDialog step 1 shall be presented as equally visible first-class card options — no hidden toggles.
- R6.2. The current "Import from URL" toggle button in ImportWizardDialog step 1 shall become a primary card option with its own icon, title, and description.
- R6.3. Use a consistent card-based layout across both dialogs: rounded-xl border, icon in a brand-soft circle, title, one-line description, hover bg-accent, focus-visible ring. The card design must accommodate both 2x2 grid and 1-column list layouts with minimal refactoring — the specific layout (2x2 vs 1-column) will be decided during implementation or design iteration.
- R6.4. All styling shall use design tokens from `src/styles/theme.css` exclusively — no hardcoded Tailwind colors. Follow the design system in `.claude/rules/styling.md`.
- R6.5. Touch targets shall be >= 44x44px on mobile.
- R6.6. Responsive behavior must be tested at 375px (mobile), 768px (tablet), and 1440px (desktop).

### R7: UX Polish and Error Handling

- R7.1. Better error messages for failed URL fetches: distinguish between network errors, invalid URLs, CORS issues, and server errors. Show human-readable messages with the specific error detail.
- R7.2. Loading skeletons or spinners during server scan operations.
- R7.3. Smooth transitions between dialog steps.
- R7.4. Keyboard navigation: Enter to submit URL, Escape to go back (where appropriate).
- R7.5. Clearer empty states: if no server folders found, show an explanatory message with suggestions.
- R7.6. After implementation, use the `compound-engineering:design:design-iterator` agent for screenshot-analyze-improve cycles.
- R7.7. Run `/design-review` for comprehensive design QA including accessibility audit.

## Success Criteria

1. `npm run build` passes with no errors.
2. `npx tsc --noEmit` produces zero type errors.
3. `npm run lint` produces no lint errors.
4. Courses page -> BulkImport *"Import Multiple from URL"*: paste a server URL -> scan discovers sub-folders -> select folders -> courses import successfully.
5. Learning Tracks -> Create Track -> Batch Import URL -> courses appear in the new track.
6. No regression: single URL import (ImportWizardDialog) still works.
7. No regression: local filesystem batch import (BulkImportDialog) still works.
8. `/design-review` produces no Blocker findings at mobile/tablet/desktop.
9. All existing import-related E2E tests pass.

## Scope Boundaries

- **In scope**: URL batch import in BulkImportDialog, URL batch import in Learning Tracks create-track flow, source selection UX redesign in both BulkImportDialog and ImportWizardDialog, server sub-directory discovery function.
- **Out of scope**: Google Drive batch import (single-folder Google Drive import already exists in ImportWizardDialog but batch Google Drive import is out of scope). YouTube batch import (already handled by YouTubeImportDialog). Redesign of the review/importing/results steps (these are source-agnostic and already functional). New server types beyond nginx autoindex (the existing `scanCourseFolderFromServer` and `fetchDirectoryListing` only support nginx autoindex).
- **Out of scope**: Renaming or restructuring the BulkImportDialog/ImportWizardDialog component hierarchy. The redesign is limited to source selection steps within existing dialog structures.

## Key Decisions

- **Extend FolderEntry/ImportItem with optional serverUrl fields**: Minimal change over creating separate types or a discriminated union. The scanning step already branches on whether it's processing local vs server items, so an optional field is sufficient.
- **Reuse existing 'select-folders' step UI**: The checkbox list for folder selection is source-agnostic (it just shows folder names and selection state). Adding a `serverUrl` to FolderEntry allows reusing this UI unchanged.
- **No new E2E tests in this brainstorm scope**: Testing strategy and test creation belong in planning. However, existing tests must not regress.

## Dependencies / Assumptions

- The existing `fetchDirectoryListing` in `src/lib/courseServerService.ts` handles nginx autoindex parsing and works correctly.
- The existing `scanCourseFolderFromServer()` function works correctly for single-folder server scanning and can be reused for batch scanning.
- The `useStableCallback` hook is available for prop callback stability.
- The existing `COURSE_IMPORTED` custom event and target path mechanisms for Learning Tracks integration are functional.

## Outstanding Questions

### Deferred to Planning

- R1.2 [Design] Exact icon to use for the "Import Multiple from URL" card (e.g., `Globe`, `Server`, `Cloud`, `Link`).
- R5.3 [Implementation] Whether `CurriculumComposer` requires prop threading for track context into `BulkImportDialog`. Investigate during planning.
- R6 [Design] Specific card layout (2x2 grid vs 1-column list) for the redesigned source selection in both dialogs. This is a visual design decision best explored during the design iteration phase.

## Next Steps
-> `/ce:plan` for structured implementation planning
