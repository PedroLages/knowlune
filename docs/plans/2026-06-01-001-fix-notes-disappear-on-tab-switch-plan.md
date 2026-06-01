---
title: Fix Notes Disappearing When Switching Tabs in Lesson Player
type: fix
status: active
date: 2026-06-01
deepened: 2026-06-01
---

# Fix Notes Disappearing When Switching Tabs in Lesson Player

## Overview

Fixes a bug where user-created notes in the lesson player's Notes tab disappear when the user switches to another tab (e.g., Bookmarks) and back. The root cause is that Radix UI `TabsContent` unmounts inactive tab content, destroying the `NotesTab` → `NoteEditor` component tree. The editor's 3-second debounced auto-save hasn't fired yet, so the note content never reaches Dexie. When the user returns to the Notes tab, `NotesTab` remounts and `loadNotesByLesson()` reloads from Dexie — finding nothing.

## Problem Frame

In the lesson player (`UnifiedLessonPlayer` → `BelowVideoTabs`), the Notes and Bookmarks tabs are rendered via Radix UI's `Tabs` component. Radix UI's `TabsContent` uses a `<Presence>` wrapper that unmounts children when the tab is not the active selection (unless `forceMount` is set). This is the default behavior for performance — but it destroys React state, including:

- The TipTap editor instance and its document state
- The 3-second debounce timer (and 10-second max-wait timer)
- The optimistic Zustand store state for in-flight saves

The user types a note → 3-second debounce timer starts → user switches to Bookmarks (or any other tab) → `NotesTab` unmounts → cleanup fires a fire-and-forget async save → React continues unmounting → user switches back → `NotesTab` remounts → `loadNotesByLesson()` queries Dexie → empty results (save never completed).

## Requirements Trace

- **R1.** Notes created in the Notes tab persist when the user switches to any other tab (Bookmarks, Transcript, AI Summary, Materials, Tutor) and returns.
- **R2.** Notes created in the Notes tab persist when the desktop Notes side panel is toggled (via `hideNotesTab`).
- **R3.** Existing notes that were previously saved correctly continue to load and display after tab switches.
- **R4.** The fix must not cause performance regressions from keeping multiple tabs mounted simultaneously.

## Scope Boundaries

- Only the lesson-player Notes tab (`BelowVideoTabs` → `TabsContent value="notes"`) is in scope.
- Course-level notes (`CourseNotesTab`) are out of scope — they use a different component and don't share the unmount issue.
- Bookmark persistence is out of scope — bookmarks use immediate Dexie writes (no debounce) and reload correctly on remount.
- Other tab contents (Transcript, AI Summary, Materials, Tutor) are out of scope — they either have no mutable user state or reload correctly.

## Context & Research

### Relevant Code and Patterns

- [src/app/components/course/BelowVideoTabs.tsx](src/app/components/course/BelowVideoTabs.tsx#L246-L403) — Tab container; renders `TabsContent` for each tab
- [src/app/components/course/tabs/NotesTab.tsx](src/app/components/course/tabs/NotesTab.tsx#L40-L277) — Notes tab; calls `loadNotesByLesson` on mount, passes `handleSave` to `NoteEditor`
- [src/app/components/notes/NoteEditor.tsx](src/app/components/notes/NoteEditor.tsx#L183-L217) — TipTap editor with debounced auto-save (3s debounce, 10s max-wait)
- [src/app/components/ui/tabs.tsx](src/app/components/ui/tabs.tsx#L78-L86) — Custom `TabsContent` wrapper (passes through all Radix props including `forceMount`)
- [src/stores/useNoteStore.ts](src/stores/useNoteStore.ts#L61-L70) — `loadNotesByLesson` replaces entire `notes` array with Dexie results
- [src/stores/useNoteStore.ts](src/stores/useNoteStore.ts#L138-L162) — `addNote` with optimistic update + `syncableWrite`

### Key Technical Detail: Radix UI Tab Lifecycle

Radix UI's `TabsContent` renders `<Presence present={forceMount || isSelected}>`. When `forceMount` is not set (default), inactive tabs are **unmounted from the DOM**, destroying all React state, refs, timers, and editor instances.

```tsx
// Radix source (node_modules/@radix-ui/react-tabs/dist/index.mjs:157):
<Presence present={forceMount || isSelected}>
  {({ present }) => (
    <Primitive.div ... hidden={!present}>
      {present && children}  // children only rendered when present=true
    </Primitive.div>
  )}
</Presence>
```

When `forceMount={true}`, children stay mounted but `hidden` attribute is toggled — state is preserved.

## Key Technical Decisions

- **D1. Use `forceMount` on Notes `TabsContent`**: The simplest, most reliable fix. Prevents the unmount/remount cycle entirely. Keeps the TipTap editor, debounce timers, and Zustand optimistic state intact across tab switches. Chosen over: (a) making the unmount save synchronous (not possible in React cleanup), (b) caching loaded notes by key (doesn't fix unsaved notes), (c) removing the debounce (degrades UX for active note-takers).

- **D2. Do NOT add `forceMount` to all tabs**: Only the Notes tab has mutable user state that depends on React lifecycle (TipTap editor, debounce timers). Other tabs either reload from Dexie on mount (Bookmarks, Transcript) or are read-only (AI Summary). Adding `forceMount` to all tabs would keep Transcript/AI Summary fetching on every tab, wasting resources.

- **D3. Defensive: eager-first-save for new notes**: As a defense-in-depth measure, when creating a new note (no `existingNote`), trigger an immediate save on first content change rather than waiting for the 3-second debounce. This ensures the note reaches Dexie before any potential unmount, even from causes other than tab switching (navigation, page refresh, etc.).

## Implementation Units

- [ ] **Unit 1: Add `forceMount` to Notes `TabsContent` in BelowVideoTabs**

**Goal:** Prevent the Notes tab from unmounting when the user switches to another tab.

**Requirements:** R1, R2, R4

**Dependencies:** None

**Files:**
- Modify: `src/app/components/course/BelowVideoTabs.tsx`

**Approach:**
- Add `forceMount` prop to the Notes `TabsContent` (the one with `value="notes"`). The custom `TabsContent` wrapper in `src/app/components/ui/tabs.tsx` already passes through all props via `{...props}`, so no UI component changes are needed.
- **Critical for R2:** Replace BOTH the Notes `TabsTrigger` (line 253) and `TabsContent` (line 291) conditional renders (`{!hideNotesTab && ...}`) with a CSS-based approach that keeps both elements always in the React tree. Apply `className={cn(hideNotesTab && 'hidden')}` to the trigger and `className={cn('mt-4', hideNotesTab && 'hidden')}` to the content. This ensures the entire Radix trigger-content pair survives the side-panel toggle — `forceMount` alone cannot prevent a parent conditional from removing either element.
- When `hideNotesTab` becomes true, the existing auto-switch useEffect (lines 107-120) moves `activeTab` away from `'notes'`, and the CSS `hidden` class keeps both trigger and content visually hidden.
- When `hideNotesTab` returns to false, `activeTab` stays at its current value (e.g. `'bookmarks'`). The user must manually click Notes to return to the tab. This is intentional — forcing a restore would cause an unexpected UI shift when the desktop side panel closes, and the side panel's own `NotesTab` instance already handles the note-editing use case independently.

**Patterns to follow:**
- The `forceMount` prop is a standard Radix UI pattern for preserving content state across tab switches.
- Only apply to the Notes tab — other tabs don't need it.

**Test scenarios:**
- Happy path: Create a note in the Notes tab, switch to Bookmarks, switch back to Notes — the note content and editor state are preserved.
- Happy path: Create a note, cycle through all tabs (Bookmarks → Transcript → AI Summary → Materials → Tutor), return to Notes — note is still there.
- Happy path (R3): On initial lesson load with forceMounted Notes tab, existing notes from Dexie are correctly loaded and displayed in the editor. Verify that `loadNotesByLesson` fires and the editor content matches the saved note.
- Happy path (R2): Desktop mode — create a note in the Notes tab, open the side Notes panel (which hides the tab's Notes via `hideNotesTab`), close the panel — tab Notes content is preserved.
- Edge case: Switch tabs mid-typing (before debounce fires) — the partially typed content is preserved when returning.
- Edge case: The `forceMount` Notes tab should not be visible or interactable when another tab is active (verify `data-state="inactive"` and `hidden` attribute).
- Edge case (R2/F1): When `hideNotesTab` is true, both the Notes TabsTrigger and TabsContent have the `hidden` CSS class applied — verify neither is interactable or visible in the DOM.
- Verification (R4): Open DevTools Performance tab, switch between tabs (Notes -> Bookmarks -> AI Summary -> Notes) 5 times, take a memory snapshot. The hidden forceMounted Notes tab should add no more than ~500KB vs baseline without forceMount. If a meaningful regression is found, add a visibility-based pause to the editor on tab blur.

**Verification:**
- Manually: Create a note, switch to Bookmarks, switch back. Note content is preserved.
- Automatically: Existing E2E/unit tests for `BelowVideoTabs` and `NotesTab` continue to pass.
- Performance (R4): Manual DevTools memory snapshot comparison as described above.

---

- [ ] **Unit 2: Eager-first-save for new notes in NoteEditor**

**Goal:** Ensure newly created notes are persisted to Dexie immediately on first content change, rather than waiting for the 3-second debounce.

**Requirements:** R1

**Dependencies:** Unit 1 (the `forceMount` fix is the primary fix; this is defense-in-depth)

**Files:**
- Modify: `src/app/components/notes/NoteEditor.tsx`

**Approach:**
- Add a `hasEverSavedRef` ref (initialized to `!!noteId` — true if editing an existing note).
- In the `onUpdate` handler, when `hasEverSavedRef.current` is `false`, call `doSave(html)` immediately (no debounce) and set `hasEverSavedRef.current = true`.
- Subsequent saves use the existing debounce mechanism.
- This ensures the first save fires synchronously via the TipTap `onUpdate` callback (which runs during ProseMirror transaction dispatch, not waiting for React commit), so even if the component unmounts immediately after, the Dexie write is initiated.

**Patterns to follow:**
- Use the existing `lastSavedContentRef` pattern in NoteEditor for tracking save state.
- Keep the debounce mechanism unchanged for subsequent edits (the debounce is desirable UX for active note-taking).

**Test scenarios:**
- Happy path: Create a new note (no existing note), type content, immediately switch tabs — the note is persisted and reloads correctly.
- Happy path: Edit an existing note, type content — the 3-second debounce is still used (no behavior change for existing notes).
- Edge case: Create a new note, type content, immediately close the browser tab — the note is persisted (the eager save fires during the `onUpdate` callback).

**Verification:**
- Unit test: Verify that `doSave` is called immediately (no debounce) on the first content change for a new note.
- Unit test: Verify that subsequent content changes still use the 3-second debounce.
- Manual: Create a note, switch tabs in under 1 second, verify note persists.

---

- [ ] **Unit 3: Await unmount save in NotesTab**

**Goal:** Ensure the fire-and-forget async save in `NoteEditor`'s unmount cleanup properly awaits completion before the component is destroyed.

**Requirements:** R1

**Dependencies:** Unit 1 (primary fix covers the tab-switch case; this is an additional safety net)

**Files:**
- Modify: `src/app/components/course/tabs/NotesTab.tsx`
- Modify: `src/app/components/notes/NoteEditor.tsx`

**Approach:**
- The current unmount handler in `NoteEditor` calls `onSaveRef.current?.(html, tags)` which is async but the cleanup function doesn't await it. React cleanup functions cannot be async (they run synchronously during the commit phase).
- Since Unit 1 (`forceMount`) eliminates the unmount-on-tab-switch scenario, and Unit 2 (eager first save) ensures new notes are persisted immediately, a complex synchronous Dexie write path is unnecessary.
- **Scope: Add error visibility to the existing fire-and-forget unmount save.** Wrap the save call in a try/catch that logs a warning on failure. Verify the `lastSavedContentRef` comparison works correctly with `initialContent` (video description seeding) — ensure the comparison uses the actual saved content, not the description seed.

**Rejected alternatives:**
- `flushPendingSave` ref callback with synchronous store action: Requires a synchronous Dexie write path. The complexity is not justified since Units 1 and 2 prevent the race condition.
- `React.startTransition` wrapper: Doesn't help — the save is async I/O, not React scheduling.

**Patterns to follow:**
- Keep the existing fire-and-forget pattern but add error visibility.
- No synchronous Dexie writes needed — Units 1 and 2 prevent the race condition.

**Test scenarios:**
- Integration: Navigate away from a lesson with unsaved notes → the unmount save fires → note appears in Dexie after navigation.
- Edge case: The `initialContent` (video description) is set → user types different content → unmount → note is saved with the typed content, not the description.

**Verification:**
- Manual: Type a note, immediately navigate to a different lesson via the sidebar. Return to the original lesson — note is there.
- Console: No uncaught promise rejections from the unmount save.

## System-Wide Impact

- **Interaction graph:** The Notes tab in `BelowVideoTabs` now stays mounted (CSS-hidden when `hideNotesTab`, not conditionally rendered). The `NotesPanel` (desktop side panel) renders its own `NotesTab` instance — but since `hideNotesTab` is only true when the side panel is open (`notesOpen`), and the auto-switch logic moves `activeTab` away from `'notes'`, the two instances are never simultaneously active. Both share the same `useNoteStore`, which is expected behavior.
- **Unchanged invariants:** The `loadNotesByLesson` behavior (replacing store notes on mount) is unchanged — with `forceMount`, it only fires once when the lesson first loads, not on every tab switch.
- **Performance:** One additional `NotesTab` stays mounted (hidden) — the TipTap editor is instantiated but not visible. On lesson change, `BelowVideoTabs` resets `activeTab` to `'notes'`, which triggers normal re-render. Performance impact is negligible — a single hidden DOM subtree.
- **Accessibility:** Radix UI's `<Presence>` wrapper already applies `hidden` attribute and `data-state="inactive"` to forceMounted-but-inactive content, excluding it from the accessibility tree and keyboard tab order. No additional a11y work is needed.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `forceMount` keeps the TipTap editor alive, consuming memory | TipTap editor is lightweight. If memory becomes a concern, we can add a `visibilitychange`-style pause when the tab is inactive. Not needed now — the editor is <50KB DOM. |
| Eager-first-save could trigger unnecessary writes (e.g., if the user types and immediately deletes) | The `doSave` function already deduplicates via `lastSavedContentRef` — identical content won't trigger a re-save. The eager save only fires once per new note. |
| Video description async fetch could overwrite user edits (NotesTab.tsx:74-94 seeds YouTube description as `initialContent`) | With `forceMount`, the editor stays alive, and the async `db.importedVideos.get()` could resolve after the user has typed content. Mitigation: Unit 3's `lastSavedContentRef` guard prevents re-seeding; if the user has typed, `lastSavedContentRef.current` differs from the description, so the save-on-unmount handles the user's content correctly. The editor's `setContent` effect already checks `currentHtml !== initialContent` before overriding. |

## Deferred Improvements

These are out of scope for this fix but noted as follow-up enhancements:

- **Unsaved-content indicator on Notes tab trigger**: When the user switches away from the Notes tab with unsaved edits, a visual badge/dot on the `TabsTrigger` would signal pending content. With `forceMount`, the content persists but is invisible — users have no awareness of hidden drafts. **Explicitly acknowledged UX regression** — deferred rather than in-scope because: (1) the indicator requires cross-component state coordination between `NoteEditor`'s internal save status and `BelowVideoTabs`' tab triggers, adding scope complexity to a targeted fix; (2) the primary bug (notes disappearing) is fully resolved by Units 1-3; (3) the indicator can be cleanly added as a follow-up with zero refactoring risk. The regression is accepted: users' data is safe (notes persist) but discoverability of hidden draft content is reduced until the indicator is added.
- **Unsaved-changes confirmation on lesson navigation**: If the user navigates to a different lesson while the Notes tab has unsaved content, there is no confirmation dialog. The unmount save (Unit 3) handles the technical persistence, but a UX confirmation would prevent accidental loss.

## Documentation / Operational Notes

- No new environment variables, API changes, or deployment concerns.
- The fix is purely client-side (React component behavior).
- No database migrations or schema changes.

## Sources & References

- Radix UI Tabs documentation: https://www.radix-ui.com/primitives/docs/components/tabs
- Radix UI `forceMount` pattern: `node_modules/@radix-ui/react-tabs/dist/index.d.mts:48`
- Related components: [BelowVideoTabs.tsx](src/app/components/course/BelowVideoTabs.tsx), [NotesTab.tsx](src/app/components/course/tabs/NotesTab.tsx), [NoteEditor.tsx](src/app/components/notes/NoteEditor.tsx)
- Note store: [useNoteStore.ts](src/stores/useNoteStore.ts)
