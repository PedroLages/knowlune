---
title: "feat: URL batch import and import dialog redesign"
type: feat
status: active
date: 2026-06-28
origin: docs/brainstorms/2026-06-28-course-import-experience-requirements.md
deepened: 2026-06-28
---

# URL Batch Import and Import Dialog Redesign

## Overview

Add server URL batch import to BulkImportDialog so users can paste an nginx autoindex URL, discover subdirectories, select which folders to import as courses, and scan/import them — matching the existing local-folder batch flow. Redesign the import source selection UI in both BulkImportDialog and ImportWizardDialog to present all sources as equally visible first-class card options instead of hidden toggles or "or"-separated lists.

## Problem Frame

Users who self-host courses on an nginx-based file server can only import one course at a time via ImportWizardDialog's "Import from URL" toggle. The BulkImportDialog "Import Multiple Folders" flow is restricted to the local filesystem via `showDirectoryPicker()`. There is no way to batch-import multiple courses from a server URL. Additionally, the import source selection UI has grown organically: URL import is a hidden toggle in ImportWizardDialog rather than a first-class card option, and the card-based layout in BulkImportDialog's "choose" step needs consistent treatment across both dialogs.

## Requirements Trace

- **R1.** URL batch import entry point in BulkImportDialog (new card + 'enter-url' step)
- **R2.** Server sub-directory discovery and folder selection (reuse 'select-folders' step)
  - **R2.5** Error states during discovery (non-200, non-nginx, CORS, network, empty directory) surface friendly messages
  - **R2.6** Track-manifest.json detection at parent URL with auto-sort by manifest position
- **R3.** Server folder scanning in batch pipeline (reuse `scanCourseFolderFromServer`)
- **R4.** New `listServerSubDirectories()` function in `src/lib/courseImport.ts`
- **R5.** Batch URL import in Learning Tracks create-track flow
- **R6.** Import dialog source selection redesign (card-based consistent layout)
  - **R6.3** Consistent card-based layout using design tokens with responsive 2x2/1-column support
- **R7.** UX polish and error handling (error messages, loading states, keyboard nav)
  - **R7.6** Use `design-iterator` agent for screenshot-analyze-improve cycles post-implementation
  - **R7.7** Run `/design-review` for comprehensive design QA including accessibility audit

## Scope Boundaries

- **In scope**: URL batch import in BulkImportDialog, URL batch import in Learning Tracks create-track flow, source selection UX redesign in both BulkImportDialog and ImportWizardDialog, `listServerSubDirectories()` function.
- **Out of scope**: Google Drive batch import, YouTube batch import, redesign of review/importing/results steps (source-agnostic), new server types beyond nginx autoindex, renaming/restructuring the dialog component hierarchy.

### Deferred to Separate Tasks

- The exact card layout (2x2 grid vs 1-column list) for the redesigned source selection — deferred to the implementation or design iteration phase per R6.3.

## Context & Research

### Relevant Code and Patterns

- **BulkImportDialog** (`src/app/components/figma/BulkImportDialog.tsx`): 6-step dialog (`choose` -> `select-folders` -> `scanning` -> `review` -> `importing` -> `results`), `DialogStep` type, `FolderEntry`/`ImportItem` interfaces, concurrent scanning with `MAX_CONCURRENCY=5`, `abortRef` cancellation pattern, source cards with icon+title+description.
- **ImportWizardDialog** (`src/app/components/figma/ImportWizardDialog.tsx`): 3-step wizard (`select` -> `details` -> `path`), current "Import from URL" toggle pattern, single-server-scan via `scanCourseFolderFromServer`.
- **courseImport.ts** (`src/lib/courseImport.ts`): `scanCourseFolderFromServer()`, `scanCourseFolderFromHandle()`, `ScannedCourse` type, `persistScannedCourse()` — core import functions.
- **courseServerService.ts** (`src/lib/courseServerService.ts`): `fetchDirectoryListing()`, `parseAutoindex()`, `ServerResult<T>` type — nginx autoindex parsing.
- **trackManifestImport.ts** (`src/lib/trackManifestImport.ts`): `readTrackManifest()`, `batchImportTrackCourses()` — track manifest batch import.
- **CurriculumComposer** (`src/app/components/figma/CurriculumComposer.tsx`): Hosts `BulkImportDialog` as sub-dialog via `InlineCoursePicker`, listens for `COURSE_IMPORTED` custom event, `onComplete` callback receives `courseIds[]`.
- **InlineCoursePicker** (`src/app/components/figma/InlineCoursePicker.tsx`): `showBatchImportAction`/`onBatchImport` props to trigger `BulkImportDialog`.
- **useStableCallback** (`src/app/hooks/useStableCallback.ts`): Shared hook for stable callback refs, used by BulkImportDialog.
- **useImportProgressStore** (`src/stores/useImportProgressStore.ts`): Per-course progress tracking, `cancelRequested` for cancellation support.
- **Design tokens in theme.css**: `bg-brand-soft`, `text-brand-soft-foreground`, `rounded-xl`, `bg-background`, `bg-accent`/`hover:bg-accent`, `ring-focus-ring`, `min-h-[44px]` — all used in existing import dialogs and patterns to follow.

### Institutional Learnings

- `completedSuccessfullyRef` guard prevents premature `onComplete` callbacks on external dialog dismissal (see `docs/solutions/design-patterns/batch-course-import-track-creation-callback-stable-ref-patterns-2026-05-10.md`).
- Every `await` in a dialog action handler needs try-catch with state recovery — without it, a rejection leaves the dialog stuck with no recovery (see `docs/solutions/developer-experience/track-import-consolidation-lessons-2026-05-10.md`).
- Non-serializable objects (`FileSystemDirectoryHandle`) use `useRef`, not `useState` — important as `serverUrl` is a plain string and avoids this issue entirely.
- Prop mirroring pattern: use existing prop naming conventions (`showBatchImportAction`/`onBatchImport`).
- The singleton guard (`wizardOpenCount`) in ImportWizardDialog must be preserved.

### External References

- No external research needed — the codebase has strong local patterns for all components involved.

## Key Technical Decisions

1. **Extend FolderEntry/ImportItem with optional `serverUrl` field and make `handle` nullable** rather than creating separate types or a discriminated union. The scanning step already branches on source type, so optional/nullable fields are the minimal change. Making `handle` nullable (`FileSystemDirectoryHandle | null`) accommodates both local folders (non-null handle) and server folders (null handle).
2. **Reuse existing `select-folders` step UI** for server-discovered folders. The checkbox list is source-agnostic (just names + selection state). Adding `serverUrl` to FolderEntry allows this without UI changes.
3. **Reuse existing concurrency infrastructure** (`MAX_CONCURRENCY=5`, `Promise.race` loop, `abortRef`) for server scanning — it already works for local handles and adapts cleanly to URL-based items.
4. **Add `listServerSubDirectories()` as a thin wrapper** around `fetchDirectoryListing()` for the batch-flow entry point, rather than modifying the existing single-course flow.

## Open Questions

### Resolved During Planning

- **R5.3 - Prop threading for track context**: The existing `BulkImportDialog` already receives `onComplete(courseIds, trackId?)` — no prop threading changes are needed because `BulkImportDialog` to `CurriculumComposer` communication already flows through this callback. The URL batch import card is a new source selector within the existing dialog shell, not a change to the dialog's external API.
- **Icon for "Import Multiple from URL" card**: Use `Globe` from lucide-react (suggested), deferred to implementation for final choice.

### Deferred to Implementation

- **Exact card layout (2x2 grid vs 1-column list) for redesigned source selection** (R6.3): A visual design decision best explored with the `design-iterator` agent during implementation. The plan ensures the card markup supports both layouts with minimal refactoring.
- **Final error message strings** for URL validation and fetch failures: Implementation should test realistic failure scenarios and tune messages accordingly.

## Implementation Units

- [ ] **Unit 1: Add `listServerSubDirectories()` function**

    **Goal:** Create a reusable function that takes a server URL, calls `fetchDirectoryListing()`, filters for directory entries, and returns structured results. This is the foundation for all URL batch import flows.

    **Requirements:** R4

    **Dependencies:** None

    **Files:**
    - Modify: `src/lib/courseImport.ts`
    - Modify: `src/lib/courseServerService.ts` (if `fetchDirectoryListing` needs a public sub-directory filter helper)

    **Approach:**
    - Add exported function `listServerSubDirectories(url: string): Promise<ServerResult<{name: string; url: string}[]>>` to `src/lib/courseImport.ts`.
    - Validate URL before fetching: reject non-http/https, empty URLs, and URLs with obvious malformation (e.g., no hostname).
    - Call `fetchDirectoryListing(url)`; on success, filter `files` entries where `type === 'directory'` and map to `{name, url}` objects.
    - Return type consistent with the existing `ServerResult<T>` type in `courseServerService.ts`: `{ ok: true; data: ... }` or `{ ok: false; error: string }` (the actual field is `ok`, not `success` — see `courseServerService.ts` line 30).
    - On network error, distinguish: network failure, non-200 response, CORS failure, invalid URL, empty directory (no sub-directories found but no error).
    - URL validation logic should be a shared helper that both this function and the dialog's URL input validation can use.

    **Patterns to follow:**
    - Return type: mirror `ServerResult<T>` from `courseServerService.ts` (already the pattern used by `fetchDirectoryListing` and `verifyConnection`).
    - URL validation: mirror the existing checks in `scanCourseFolderFromServer` for consistency.

    **Test scenarios:**
    - Happy path: valid nginx autoindex URL with sub-directories -> returns array of `{name, url}` entries.
    - Edge case: URL with no sub-directories (empty directory) -> returns `{ ok: true, data: [] }` (empty array with `ok: true`).
    - Edge case: URL with trailing slash vs without -> both should work identically.
    - Error path: invalid URL (no protocol, malformed) -> returns `{ ok: false, error: "..." }`.
    - Error path: non-200 response (404, 500) -> returns descriptive error.
    - Error path: non-nginx server (HTML page without autoindex) -> `fetchDirectoryListing` returns parse error, surfaced as friendly message.
    - Error path: network error (unreachable host, timeout) -> returns network error message.
    - Integration: result entries have correctly composed subdirectory URLs (parent URL + folder name).

    **Verification:**
    - `listServerSubDirectories` is exported and importable from `courseImport.ts`.
    - Returns correct shape for all error/success paths.
    - URL helper validation rejects malformed input before making any network request.

- [ ] **Unit 2: Add URL batch import entry point to BulkImportDialog**

    **Goal:** Add an "Import Multiple from URL" card to the BulkImportDialog 'choose' step, a new `'enter-url'` dialog step, and URL input with validation and scan trigger.

    **Requirements:** R1

    **Dependencies:** Unit 1 (`listServerSubDirectories`)

    **Files:**
    - Modify: `src/app/components/figma/BulkImportDialog.tsx`
    - Test: `src/app/components/figma/BulkImportDialog.test.tsx` (or relevant test file)

    **Approach:**
    - Add `'enter-url'` to the `DialogStep` type union.
    - Add a fourth card to the 'choose' step grid (alongside "Import Single Folder", "Import Multiple Folders", "Build from YouTube") with:
      - Icon: `Globe` (or chosen icon) in `rounded-full bg-brand-soft` container
      - Title: "Import Multiple from URL"
      - Description: "Paste a server URL to batch import courses"
      - Consistent hover/focus/active states via existing card pattern
    - Add the `'enter-url'` step rendering:
      - URL input field (`Input` component)
      - "Scan" button (`Button variant="brand"`)
      - Guidance text: "Paste the server URL containing course folders"
      - "Back" button returning to 'choose' step
    - URL validation before scanning:
      - Reject empty input, non-http/https protocols
      - Show inline error message below input (red text using `text-destructive` token)
    - Keyboard navigation: Enter in URL input triggers scan, Escape returns to choose step.
    - "Scan" button calls `listServerSubDirectories(url)`.
    - On success with results: transition to `'select-folders'` step with discovered subdirectories.
    - On error: show inline error with descriptive message.
    - On success with empty results: show explanatory message with suggestions (e.g., "No course folders found at this URL. Check that the server exposes subdirectories via nginx autoindex.").

    **Patterns to follow:**
    - Existing card styling in 'choose' step: `rounded-xl border`, hover `bg-accent`, `focus-visible:ring-2 ring-focus-ring`, icon circle pattern.
    - URL input: mirror design from ImportWizardDialog's existing URL input but in card context.
    - Error display: `text-destructive` text, inline below input (visible on interaction or validation).
    - Test IDs: `data-testid="bulk-import-choose-url"`, `data-testid="bulk-import-scan-url-btn"`, etc.

    **Test scenarios:**
    - Happy path: user sees fourth card in 'choose' step, clicks it, transitions to 'enter-url' step.
    - Happy path: user types valid URL, presses Enter, scan begins -> progress indicator shows.
    - Happy path: scan returns subdirectories -> transitions to 'select-folders' step.
    - Edge case: user types empty URL, presses Enter -> inline validation error shown, no network call.
    - Edge case: user types `ftp://` URL -> validation rejects, inline error shown.
    - Edge case: user types garbage string -> validation rejects, inline error shown.
    - Edge case: user clicks "Back" from 'enter-url' -> returns to 'choose' step with selection state preserved.
    - Edge case: scan fails with network error -> inline error shown, scan button re-enabled.
    - Edge case: scan returns empty list -> explanatory message shown with suggestions.
    - Edge case: mobile viewport (375px) -> cards stack vertically, touch targets >= 44x44px.

    **Verification:**
    - Card visible in 'choose' step with correct icon, title, and description.
    - Clicking card transitions to URL input view.
    - URL validation prevents invalid/scannable-but-wrong input before network calls.
    - Successful scan transitions to folder selection.
    - All error states surface user-friendly messages.

- [ ] **Unit 3: Server folder discovery and selection in BulkImportDialog**

    **Goal:** Extend `FolderEntry` and `ImportItem` interfaces with optional `serverUrl` fields, wire server-discovered folders into the existing `'select-folders'` step UI, and handle track-manifest detection from server URLs.

    **Requirements:** R2

    **Dependencies:** Unit 2 (new card + step, scan trigger)

    **Files:**
    - Modify: `src/app/components/figma/BulkImportDialog.tsx`
    - Test: `src/app/components/figma/BulkImportDialog.test.tsx`

    **Approach:**
    - Extend `FolderEntry` interface, making `handle` nullable (server-sourced entries have no local handle):
      ```typescript
      interface FolderEntry {
        handle: FileSystemDirectoryHandle | null   // null for server-sourced entries
        name: string
        selected: boolean
        serverUrl?: string   // NEW: URL to this folder on the server
      }
      ```
    - Extend `ImportItem` interface, making `handle` nullable:
      ```typescript
      interface ImportItem {
        folderName: string
        handle: FileSystemDirectoryHandle | null   // null for server-sourced entries
        status: ImportItemStatus
        error?: string
        scannedCourse?: ScannedCourse
        videoCount?: number
        pdfCount?: number
        serverUrl?: string   // NEW: source URL for server-fetched course
      }
      ```
    - When transitioning from `'enter-url'` to `'select-folders'`, populate `FolderEntry[]` from `listServerSubDirectories` results: each entry gets `name` from the result name, `serverUrl` from the result url, and `handle` set to `null`.
    - The existing `'select-folders'` step renders checkbox list from `FolderEntry[]` — it displays `entry.name` and tracks selection state, which works transparently for server entries since the UI only reads `name` and `selected`.
    - Source type discrimination: `entry.handle === null && entry.serverUrl !== undefined` = server-sourced; `entry.handle !== null` = local-filesystem-sourced. This guides branching in subsequent steps.
    - Track-manifest detection (R2.6): call a new async function `fetchTrackManifest(parentUrl)` that fetches `{parentUrl}/track-manifest.json` and parses it. If found, auto-sort folders by manifest position and store manifest data, identical to the local-flow behavior. Add to `src/lib/trackManifestImport.ts` or `courseImport.ts`.
    - Error handling (R2.5): wrap the discovery call in try-catch, show friendly error messages for each failure type. Do not crash the dialog.

    **Patterns to follow:**
    - `FolderEntry` is a local interface in BulkImportDialog — extend in place.
    - Track manifest detection: mirror `readTrackManifest()` logic from `trackManifestImport.ts` for the HTTP variant.
    - The `disabled` state for the "Scan N Folders" button in 'select-folders' is driven by `selectedCount === 0` — works automatically.

    **Test scenarios:**
    - Happy path: server-discovered folders appear in checkbox list with correct names.
    - Happy path: Select All / Deselect All works for server-sourced folders.
    - Happy path: selection count indicator updates correctly.
    - Happy path: track-manifest.json exists at parent URL -> folders sorted by manifest position.
    - Edge case: server returns 0 folders -> "no folders found" message, back button to URL input.
    - Edge case: mixed server and local folders in same dialog (should not happen in normal flow, but state management should handle gracefully).
    - Error path: track-manifest.json fetch fails (404) -> continue without manifest sorting, no error shown (manifest is optional).
    - Error path: track-manifest.json is malformed -> continue without manifest, log warning.
    - Integration: `ImportItem` created from server folder retains `serverUrl` field through the scanning step.

    **Verification:**
    - Server-discovered folders render in the same checkbox list as local folders.
    - Selection behavior is identical.
    - Track-manifest optional detection works without blocking.
    - Error states don't crash the dialog.

- [ ] **Unit 4: Server folder scanning in the batch import pipeline**

    **Goal:** When scanning server-sourced folders in the `'scanning'` step, call `scanCourseFolderFromServer()` instead of `scanCourseFolderFromHandle()`, reusing the existing concurrent scanning infrastructure.

    **Requirements:** R3

    **Dependencies:** Unit 3 (serverUrl on ImportItem)

    **Files:**
    - Modify: `src/app/components/figma/BulkImportDialog.tsx`
    - Test: `src/app/components/figma/BulkImportDialog.test.tsx` or `src/lib/courseImport.test.ts`

    **Approach:**
    - In the `handleScanFolders` function (or equivalent scanning loop in BulkImportDialog), detect whether each item is server-sourced by checking `item.serverUrl`.
    - Branch the per-item scan call:
      - If `serverUrl` is present: call `scanCourseFolderFromServer(item.serverUrl, serverId?)`
      - Otherwise: call `scanCourseFolderFromHandle(item.handle)`
    - **Return type mismatch**: `scanCourseFolderFromServer` returns `Promise<ScannedCourse>` directly, while `scanCourseFolderFromHandle` returns `Promise<BulkScanResult>`. The scanning loop expects `BulkScanResult`. Wrap the server result: `{ status: 'success'; course: scannedCourse }` on success, or `{ status: 'error'; folderName: item.folderName; message: error.message }` on error.
    - Reuse the existing `MAX_CONCURRENCY=5`, `Promise.race` loop, and `abortRef` cancellation — these are already source-agnostic infrastructure.
    - The scanning results populate `scannedCourses` (a `Map<string, ScannedCourse>`) — the review step operates on `ScannedCourse` objects and is already source-agnostic.
    - Cancellation: `abortRef.current` and `useImportProgressStore.getState().cancelRequested` must be checked in the server scan branch just as in the local branch.
    - **Retry path**: The existing `handleRetry` function uses `item.handle` to rescan local items. For server-sourced items, retry must use `item.serverUrl` instead. Branch in `handleRetry` based on whether `handle` or `serverUrl` is present.
    - After scanning, the `'review'` step displays course cards with import details — this works unchanged because `ScannedCourse` already supports `source: 'server'` and `serverId`/`serverPath` fields.

    **Patterns to follow:**
    - Existing scanning loop structure in `handleScanFolders` — `Promise.race` with `MAX_CONCURRENCY`.
    - `abortRef` pattern as used in the existing local scanning path.

    **Test scenarios:**
    - Happy path: server-sourced items scanned via `scanCourseFolderFromServer` -> results populate `scannedCourses` map correctly.
    - Happy path: mixed local and server items in the same batch (theoretical, not expected in normal flow) -> each scanned with correct function.
    - Edge case: `scanCourseFolderFromServer` returns error for a folder -> item status set to `'error'`, scanning continues for remaining items.
    - Edge case: user cancels during server scanning -> `abortRef` set, scanning stops, partial results shown in review step.
    - Edge case: all server items fail -> review step shows all errors, user can go back.
    - Integration: scanned `ScannedCourse` from server has correct `source: 'server'`, `serverId`, `serverPath` populated.
    - Integration: review step renders server-scanned courses identically to locally-scanned courses.
    - Integration: `persistScannedCourse` handles server-sourced courses (should already work — `ImportedCourse` already has `serverId` and `serverPath` fields).

    **Verification:**
    - Server-sourced courses scan, persist, and appear in the import results.
    - Concurrent scanning runs with correct concurrency limit.
    - Cancellation works correctly during server scanning.
    - Review and results steps show server-sourced courses identically to local ones.

- [ ] **Unit 5: Learning Tracks batch URL import integration**

    **Goal:** Verify that the new URL batch import card in BulkImportDialog works seamlessly within the Learning Tracks create-track flow (CurriculumComposer -> InlineCoursePicker -> BulkImportDialog -> courses appear in track). No code changes may be needed beyond Unit 2-4, but verify and add any missing prop threading.

    **Requirements:** R5

    **Dependencies:** Units 2-4

    **Files:**
    - Modify: `src/app/components/figma/BulkImportDialog.tsx` (if prop threading needed)
    - Modify: `src/app/components/figma/CurriculumComposer.tsx` (if integration gap found)
    - Test: manual/E2E verification or existing Learning Tracks test

    **Approach:**
    - The URL batch import card shall always be visible in BulkImportDialog across all calling contexts (unlike the YouTube import card which depends on the `onYouTubeImport` prop). This means no guard on rendering the URL card — it shows unconditionally in the 'choose' step.
    - Verify the existing flow: CurriculumComposer opens BulkImportDialog -> `onComplete` callback receives `courseIds[]` -> courses are added to the track via existing `COURSE_IMPORTED` custom event or direct state update.
    - If CurriculumComposer only listens for single-course `COURSE_IMPORTED` events but not batch completion, add batch completion handling to CurriculumComposer's `handleBatchImportComplete` (which already exists, named `onComplete` in the props).
    - Verify `InlineCoursePicker`'s batch import button prop `onBatchImport` already opens `BulkImportDialog` — if so, the URL card automatically appears.
    - End-to-end verification: CurriculumComposer -> InlineCoursePicker -> click batch import -> BulkImportDialog opens with URL card -> URL scan -> select folders -> scan -> review -> import -> courses appear in track.

    **Patterns to follow:**
    - Existing `onComplete` callback pattern in BulkImportDialog props.
    - `COURSE_IMPORTED` custom event: fire once for the batch with all course IDs (or fire once per course, depending on existing pattern — investigate during implementation).

    **Test scenarios:**
    - Happy path: CurriculumComposer opens BulkImportDialog, URL batch import completes, `onComplete` fires with courseIds, courses appear in track course list.
    - Edge case: user opens BulkImportDialog from non-track context (e.g., Courses page) — URL card visible but no track association needed.
    - Edge case: user cancels batch import from Learning Tracks flow — no courses added.
    - Integration: the `COURSE_IMPORTED` event fires for batch imports and CurriculumComposer picks it up.

    **Verification:**
    - Full end-to-end flow works: CurriculumComposer -> batch import URL -> courses visible in new track.
    - No regression: existing local batch import in track creation still works.

- [ ] **Unit 6: Import dialog source selection redesign and UX polish**

    **Goal:** Redesign the import source selection UI in both BulkImportDialog's 'choose' step and ImportWizardDialog's 'select' step to present all sources as equally visible first-class card options. Apply UX polish: better error messages, loading states, keyboard navigation, and responsive behavior.

    **Requirements:** R6, R7

    **Dependencies:** Units 2-4 (the redesign must include the new URL card added in Unit 2)

    **Files:**
    - Modify: `src/app/components/figma/BulkImportDialog.tsx`
    - Modify: `src/app/components/figma/ImportWizardDialog.tsx`
    - Test: `src/app/components/figma/ImportWizardDialog.test.tsx`
    - Test: `src/app/components/figma/BulkImportDialog.test.tsx`

    **Approach:**
    - **BulkImportDialog 'choose' step redesign:**
      - The current 3 cards (Import Single Folder, Import Multiple Folders, Build from YouTube) are already in a card grid with icon/title/description. Ensure the new URL card (Unit 2) matches this pattern exactly.
      - Ensure consistent: `rounded-xl border p-4`, `rounded-full bg-brand-soft` icon circle, `text-brand-soft-foreground` icon, card title, one-line description, `hover:bg-accent`, `focus-visible:ring-2 ring-focus-ring`, `min-h-[44px]` touch targets.
      - The card grid should support both 2x2 and 1-column layouts with minimal CSS changes — use `grid grid-cols-1 sm:grid-cols-2` pattern (adjust as needed).

    - **ImportWizardDialog 'select' step redesign:**
      - Convert the current vertical "or"-separated list (Select Folder / Import from Google Drive / Import from URL / drag-drop) into a card-based grid matching BulkImportDialog's pattern.
      - The "Import from URL" option currently toggles inline URL input. Replace with a card that, when clicked, opens the existing URL input view (either inline or as a sub-step — decide during implementation).
      - Options to include as cards: Select Folder (local), Import from Google Drive (premium gate), Import from URL (server), Import via Drag & Drop (dropzone hint).
      - Use consistent design tokens: `bg-background`, `border-border`, `bg-accent` hover, `rounded-xl`, brand icon circles.

    - **UX polish (R7):**
      - Better error messages: distinguish network error, invalid URL, CORS issue, server error — with specific detail in each case.
      - Loading spinners during scan operations (reuse existing `Progress` component or `Loader2` icon pattern).
      - Smooth step transitions: CSS transitions on step change or dialog step indicator improvements.
      - Keyboard navigation: Enter to submit URL (already in Unit 2), Escape to go back (already in Unit 2), Tab through cards.
      - Clearer empty states: if no server folders found, show explanatory message with suggestions ("Try checking the server URL or ensure folders exist at this location").
      - Responsive: test at 375px (mobile), 768px (tablet), 1440px (desktop).

    **Patterns to follow:**
    - Card layout: mirror existing BulkImportDialog 'choose' step cards exactly.
    - Design tokens: use tokens from `theme.css` exclusively (see Styling Rules in `.claude/rules/styling.md`).
    - Focus ring: `focus-visible:outline-none focus-visible:ring-2 ring-focus-ring`.
    - Touch targets: `min-h-[44px]` for all interactive elements.

    **Post-implementation (R7.6, R7.7):**
    - Run `compound-engineering:design:design-iterator` agent for screenshot-analyze-improve cycles on the redesigned source selection.
    - Run `/design-review` for comprehensive design QA including accessibility audit.

    **Test scenarios:**
    - Happy path: BulkImportDialog 'choose' shows 4 cards consistently styled.
    - Happy path: ImportWizardDialog 'select' shows all sources as cards with consistent styling.
    - Happy path: clicking each card transitions to the correct next step/dialog.
    - Edge case: ImportWizardDialog URL card — clicking it opens URL input (inline or sub-step).
    - Edge case: responsive layout at 375px — cards stack vertically, all touch targets >= 44px.
    - Edge case: responsive layout at 1440px — cards in 2x2 grid (or chosen layout), no broken alignment.
    - Edge case: keyboard navigation — Tab through cards, Enter to activate, Escape in sub-steps.
    - Edge case: error message readability — each error type shows distinctive human-readable text.
    - Accessibility: color contrast passes (design tokens already enforced), focus rings visible, aria labels on cards.
    - Design review: no Blocker findings at any viewport size.

    **Verification:**
    - Both dialogs show card-based source selection with consistent visual treatment.
    - All existing import flows (single local, single URL, Google Drive, YouTube, batch local) remain functional.
    - Design iteration and design review produce no Blocker findings.

## System-Wide Impact

- **Interaction graph:** Adding a new source type to BulkImportDialog extends the dialog's internal state machine (DialogStep union) and the FolderEntry/ImportItem interfaces. No changes to external consumers (CurriculumComposer, InlineCoursePicker) are needed because the dialog's prop API (`onComplete`, `onSingleImport`, `onYouTubeImport`) is unchanged.
- **Error propagation:** URL batch import failures are handled within the dialog — each item has its own error state. The dialog never throws uncaught errors. The `onComplete` callback only fires for successfully imported courses.
- **State lifecycle risks:** The `completedSuccessfullyRef` guard already prevents premature callbacks. The new URL source type uses the same state management as local sources (selectedItems, scannedCourses maps) — no new state lifecycle risks.
- **API surface parity:** The new URL batch import card is always visible (no prop guard), but the YouTube card remains guarded by `onYouTubeImport`. This is intentional and matches existing patterns.
- **Unchanged invariants:** All existing import flows continue working. The review, importing, and results steps are source-agnostic and unchanged. ImportWizardDialog's singleton guard is preserved.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| nginx autoindex HTML parsing breaks with server config changes | The existing `parseAutoindex()` function is already in production use. No changes to parsing logic. |
| CORS errors from user's nginx server | The existing infrastructure already works with CORS. Error messages distinguish CORS failures from other network errors. |
| Large number of sub-directories degrades UX | The scanning step already handles concurrency and cancellation. Folder selection is paginated only by scroll area (not paginated server-side — acceptable for typical course collections). |
| Track-manifest detection on server returns non-JSON | Handled gracefully: continue without manifest, no error shown to user. |
| Regression in single URL import (ImportWizardDialog) | The redesign is additive to BulkImportDialog and visual-only in ImportWizardDialog. The core scan/import logic is unchanged. Verify with existing tests. |

## Documentation / Operational Notes

- No documentation changes needed — the new import source is self-explanatory via the card UI.
- No rollout or monitoring needed — this is a client-only change with no server dependency.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-06-28-course-import-experience-requirements.md](../brainstorms/2026-06-28-course-import-experience-requirements.md)
- **Related code:**
  - `src/app/components/figma/BulkImportDialog.tsx` — primary target
  - `src/app/components/figma/ImportWizardDialog.tsx` — source selection redesign
  - `src/app/components/figma/CurriculumComposer.tsx` — track flow integration
  - `src/lib/courseImport.ts` — `listServerSubDirectories`, `scanCourseFolderFromServer`
  - `src/lib/courseServerService.ts` — `fetchDirectoryListing`
  - `src/lib/trackManifestImport.ts` — track manifest handling
  - `src/app/components/figma/InlineCoursePicker.tsx` — batch import trigger
- **Related solutions:**
  - `docs/solutions/design-patterns/batch-course-import-track-creation-callback-stable-ref-patterns-2026-05-10.md`
  - `docs/solutions/developer-experience/track-import-consolidation-lessons-2026-05-10.md`
  - `docs/solutions/best-practices/learning-paths-import-from-path-patterns-2026-05-03.md`
