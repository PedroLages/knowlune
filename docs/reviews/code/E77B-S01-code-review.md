## Code Review: E77B-S01 — Drive read-only scope and folder browser

### What Works Well

1. **Incremental OAuth scope design.** Requesting `drive.readonly` separately from the initial sign-in (not bundled) is the correct approach — it avoids permission-scope creep for users who never use Drive import. The localStorage flag optimization (`knowlune_drive_read_granted`) is a sensible fast-path that avoids an API call on every dialog open.

2. **Typed error hierarchy.** The `DriveScopeError`, `DriveNetworkError`, `DriveRateLimitError`, and `DriveApiError` classes with `DriveListResult<T>` discriminated union create a clean error contract. Every API surface returns well-structured errors, and the component always has a `ok: false` path to display to the user.

3. **Comprehensive tests.** 56 unit tests across 3 test files cover scope check, browsing, selection, retry, error states, empty states, and 401 retry logic. The test for 401 retry with token refresh is particularly well-structured, verifying both the retry count and the refreshed authorization header.

---

### Findings

#### High Priority

- **ImportWizardDialog.tsx:504 — Video format hardcoded to 'mp4' for all Drive-imported videos (confidence: 85)**

    WHAT: In `handleDriveFolderSelected`, video format is hardcoded to `'mp4' as const` regardless of the actual file:
    ```typescript
    format: 'mp4' as const,
    ```

    WHY: The local import path uses `getVideoFormat(f.name)` from `@/lib/fileSystem` to detect the correct format from the filename extension (mp4, webm, mkv, avi, ts). Hardcoding to 'mp4' means a .webm or .mkv file imported from Drive gets incorrect format metadata stored in IndexedDB. When later stories implement Drive file streaming (E77B-S03), the player code may use this format field to select codecs/mime types, leading to playback failures for non-MP4 files.

    FIX: Import and use `getVideoFormat` from `@/lib/fileSystem`:
    ```typescript
    import { getVideoFormat } from '@/lib/fileSystem'
    // ...
    format: getVideoFormat(f.name),
    ```

    EFFORT: ~2 minutes. autofix_class: manual

- **DriveFolderBrowser.tsx — Folder/file list has no keyboard navigation (role="listbox" without keyboard handlers) (confidence: 80)**

    WHAT: The file list container has `role="listbox"` and items have `role="option"` with `aria-selected`, but there are no keyboard event handlers (`onKeyDown` for arrow keys, Enter/Space).

    WHY: The `listbox` ARIA pattern requires keyboard support — users must be able to navigate items with arrow keys and select with Enter/Space. Without this, the folder browser is not operable by keyboard-only or screen reader users, violating WCAG 2.1 AA 2.1.1 (Keyboard) and 4.1.2 (Name, Role, Value). A user who relies on a keyboard cannot navigate Drive folders or select files.

    FIX: Add `onKeyDown` handlers to the list container that support ArrowDown/ArrowUp for navigation and Enter for folder open or item selection. Consider using a `useKeyboardNavigation` hook that tracks the focused item index and maps arrow keys to move focus between items.

    EFFORT: ~15-20 minutes. autofix_class: manual

#### Medium

- **ImportWizardDialog.tsx:516-531 — Drive import mapping silently drops audio files and misclassifies EPUBs (confidence: 85)**

    WHAT: Two problems in the `handleDriveFolderSelected` mapping:

    1. Audio files (mimeType `audio/*`) pass the `isSupportedForImport` filter in the folder browser but are silently dropped during import mapping — there's no field in `ScannedCourse` for them and they don't match any filter (`video/`, `application/pdf`, or `application/epub+zip`).

    2. EPUB files (`application/epub+zip`) are shoved into the `pdfs` array with no type discrimination:
    ```typescript
    pdfs: [
      ...pdfs.map(f => ({...})),
      ...epubs.map(f => ({...})),
    ],
    ```

    WHY: The plan document lists `audio/*` as a supported mime type alongside video, PDF, and EPUB. A user who selects a folder with audio files sees them in the folder browser (they pass the `supported` check in the list), selects the folder, and then the audio files vanish during import with no warning. EPUBs stored in the `pdfs` field lose their identity — the import summary shows incorrect counts, and any later code that needs to distinguish PDF from EPUB has no data to use.

    FIX: Either add an `ebooks`/`documents` array to `ScannedCourse` (a schema-level change) with a `mimeType` string field, or add a `mimeType` field to `ScannedPdf` so EPUBs can be distinguished from PDFs. For audio, either add an `audio` field or ensure audio files are captured somewhere — dropping them silently is data loss.

    EFFORT: ~20 minutes (schema + migration). autofix_class: manual

- **docs/ops/supabase-google-drive-scope-setup.md:85 — Docs reference nonexistent function `checkDriveReadScope()` (confidence: 95)**

    WHAT: The OPS documentation verification section references `checkDriveReadScope()` but the actual exported function is `hasDriveReadScope()`.

    WHY: An operator following these instructions would get a TypeScript/IDE error, degrading trust in the ops runbook. The function was renamed during development but the docs weren't updated.

    FIX: Change `checkDriveReadScope()` to `hasDriveReadScope()` in the docs.

    EFFORT: ~1 minute. autofix_class: safe_auto

- **DriveFolderBrowser.tsx:3 — Comment claims "assertPremium()" but no runtime premium gate exists (confidence: 72)**

    WHAT: The component header says "Premium-gated — assertPremium() before any Drive API call" but the component has no premium check. The gating is only in the parent component's button via `<PremiumGate>`. Additionally, the `DriveFolderBrowser` dialog is rendered outside the `<PremiumGate>` wrapper:
    ```tsx
    <PremiumGate featureLabel="Google Drive import">
      <Button ... />    // ← Button is gated
    </PremiumGate>
    <DriveFolderBrowser ... />  // ← Dialog is NOT gated
    ```

    WHY: A non-premium user could open the dialog through React DevTools or by manipulating `driveFolderBrowserOpen` state (e.g., from browser console). While the Drive API calls require OAuth tokens, there is no explicit premium guard at the API call boundary. The comment is misleading — it says "assertPremium()" but no such call exists anywhere in the file.

    FIX: Either remove the misleading comment and accept the UI-layer gating as sufficient, or add a premium check at the entry of Drive API operations. The simplest fix is correcting the comment to describe actual behavior: "Premium-gated at the parent button level."

    EFFORT: 1 minute (comment fix). autofix_class: safe_auto

- **DriveFolderBrowser.tsx:167-184 — `handleConfirmSelection` has no error boundary (confidence: 70)**

    WHAT: The async callback `handleConfirmSelection` calls parent callbacks (`onFolderSelected`, `onOpenChange`) without a try/catch block. If either callback throws, the error is unhandled and React will log a potentially cryptic error.

    WHY: While the current parent implementation (`handleDriveFolderSelected`) is purely synchronous and unlikely to throw, this is an async callback without error handling. If a future story adds async work or throws from `onFolderSelected`, the error would crash with no user feedback and the dialog would close anyway (since `onOpenChange` is also in the try-not-caught region).

    FIX: Wrap the callback body in a try/catch that logs the error and optionally shows a toast:
    ```typescript
    const handleConfirmSelection = useCallback(async () => {
      if (!selectedFolder) return
      try {
        const selectedItem = items.find(i => i.id === selectedFolder)
        // ... rest of logic
        onOpenChange(false)
      } catch (error) {
        toast.error('Failed to select folder. Please try again.')
      }
    }, [selectedFolder, items, onFolderSelected, onOpenChange])
    ```

    EFFORT: ~3 minutes. autofix_class: manual

#### Low

- **DriveFolderBrowser.tsx:99-119 — `loadFolderContents` doesn't handle pagination via nextPageToken (confidence: 75)**

    WHAT: The Drive API returns `nextPageToken` when a folder has more than 100 files, but `loadFolderContents` ignores it and only loads the first page.

    WHY: The plan explicitly lists this as a test scenario: "Folder with >100 files → pagination loads all via `nextPageToken`." Users with large Drive folders (e.g., 300 files) would only see the first 100 files, potentially missing files they intended to import.

    FIX: Add pagination support — either auto-load all pages (with a loading indicator) or add a "Load more" button at the bottom of the list. The `listFolder` API already supports `pageToken`, so only the component logic needs updating.

    EFFORT: ~15 minutes. autofix_class: manual

---

### Recommendations

Priority order for fixes:

1. **Fix hardcoded `'mp4'` format** (HIGH) — A 2-minute fix that prevents incorrect metadata for non-MP4 videos imported from Drive. Most impactful because it affects all non-MP4 Drive imports and causes silent data quality issues.

2. **Fix EPUB/audio mapping gap** (MEDIUM) — Audio files are silently dropped and EPUBs are misclassified. Users who select folders with these file types experience data loss or incorrect metadata.

3. **Add keyboard navigation** (HIGH) — Real WCAG violation that blocks keyboard-only users from using the folder browser.

4. **Fix OPS doc** (MEDIUM) — 1-minute, zero-risk fix for `checkDriveReadScope` -> `hasDriveReadScope`.

5. **Add error boundary** (MEDIUM) — Defensive fix for `handleConfirmSelection`, prevents future race conditions.

6. **Fix premium gate comment** (MEDIUM) — Aligns documentation with reality.

7. **Add pagination** (LOW) — Edge case for large folders, non-critical.

---
Issues found: 7 | Blockers: 0 | High: 2 | Medium: 4 | Low: 1
Confidence: avg 80 | >= 90: 1 | 70-89: 5 | < 70: 1
