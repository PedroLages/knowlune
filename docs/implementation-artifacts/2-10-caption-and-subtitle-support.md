# Story 2.10: Caption and Subtitle Support

Status: done
Started: 2026-03-18
Completed: 2026-03-18
Reviewed: true
review_started: 2026-03-18
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests, design-review, code-review, code-review-testing, web-design-guidelines]

## Story

As a learner,
I want to load subtitle files alongside my videos,
so that I can follow along with captions for better comprehension.

## Acceptance Criteria

**AC1 — Load captions via file picker:**
Given the user has a video loaded in the player
When the user clicks a "Load Captions" button on the player controls
Then a file picker opens filtered for SRT and WebVTT files
And the user can select a caption file from their local file system

**AC2 — Display synchronized captions:**
Given a valid SRT or WebVTT file has been loaded
When the video plays
Then captions are displayed synchronized to video playback
And synchronization accuracy is within 200ms (NFR59)
And captions are visually styled for readability (semi-transparent background, white text)

**AC3 — Toggle caption visibility:**
Given captions are active
When the user presses the C key
Then caption visibility toggles on/off (NFR58)

**AC4 — Handle invalid files gracefully:**
Given the user loads an invalid or malformed caption file
When parsing fails
Then a toast notification explains the error within 1 second (NFR13)
And the video continues to play without captions

**AC5 — Persist caption file association:**
Given a caption file has been successfully loaded for a video
When the user returns to that video later
Then the caption file association is persisted
And captions load automatically on subsequent visits

## Tasks / Subtasks

- [ ] Task 1: SRT parser utility (AC: 2, 4)
  - [ ] 1.1 Create `src/lib/captions.ts` with `parseSRT(text: string): TranscriptCue[]`
  - [ ] 1.2 Convert SRT timestamps (`HH:MM:SS,mmm`) to seconds
  - [ ] 1.3 Convert parsed SRT to WebVTT blob URL for `<track src=>`
  - [ ] 1.4 Reuse `parseVTT()` logic from TranscriptPanel for WebVTT files
  - [ ] 1.5 Add validation: return error for empty/malformed files

- [ ] Task 2: Dexie schema v18 — caption associations table (AC: 5)
  - [ ] 2.1 Add `videoCaptions` table to `src/db/schema.ts` v18
  - [ ] 2.2 Schema: `'[courseId+videoId], courseId, videoId'`
  - [ ] 2.3 Store: `{ courseId, videoId, filename, content, format, createdAt }`
  - [ ] 2.4 Add `VideoCaptionRecord` type to `src/data/types.ts`
  - [ ] 2.5 Add table declaration to `db` type union

- [ ] Task 3: Caption CRUD helpers (AC: 1, 4, 5)
  - [ ] 3.1 Add to `src/lib/captions.ts`: `saveCaptionForVideo(courseId, videoId, file: File)`
  - [ ] 3.2 Add: `getCaptionForVideo(courseId, videoId): Promise<CaptionTrack | null>`
  - [ ] 3.3 Add: `removeCaptionForVideo(courseId, videoId)`
  - [ ] 3.4 `saveCaptionForVideo` reads file text, validates, stores raw content in Dexie
  - [ ] 3.5 `getCaptionForVideo` reads from Dexie, converts to blob URL, returns CaptionTrack

- [ ] Task 4: File picker + load flow in VideoPlayer (AC: 1, 2, 4)
  - [ ] 4.1 Add `onLoadCaptions?: (file: File) => void` prop to VideoPlayerProps
  - [ ] 4.2 Add hidden `<input type="file" accept=".srt,.vtt">` ref
  - [ ] 4.3 Wire existing Subtitles button: if no captions loaded, click opens file picker
  - [ ] 4.4 On file selected: call `onLoadCaptions(file)` callback
  - [ ] 4.5 Show toast on success ("Captions loaded: filename.srt")

- [ ] Task 5: LessonPlayer integration (AC: 1, 2, 4, 5)
  - [ ] 5.1 On mount: call `getCaptionForVideo()` → set as initial captions prop
  - [ ] 5.2 Handle `onLoadCaptions`: parse file → validate → save to Dexie → update captions state
  - [ ] 5.3 On parse error: show toast via Sonner with error message (NFR13)
  - [ ] 5.4 Update `captionSrc` derivation to include user-loaded captions
  - [ ] 5.5 Ensure TranscriptPanel and AISummaryPanel tabs appear when user loads captions

- [ ] Task 6: ImportedLessonPlayer integration (AC: 1, 2, 4, 5)
  - [ ] 6.1 Same flow as Task 5 but for ImportedLessonPlayer page
  - [ ] 6.2 Use courseId + videoId from imported course context

- [ ] Task 7: E2E tests (AC: 1–5)
  - [ ] 7.1 Create `tests/e2e/story-e02-s10.spec.ts`
  - [ ] 7.2 Test: Load valid WebVTT file → captions appear
  - [ ] 7.3 Test: Load valid SRT file → captions appear
  - [ ] 7.4 Test: C key toggles captions on/off
  - [ ] 7.5 Test: Load invalid file → error toast, video continues
  - [ ] 7.6 Test: Return to video → captions auto-load from persistence
  - [ ] 7.7 Test: File picker filters for .srt and .vtt only

## Design Guidance

### Design Philosophy

Seamless integration into the existing VideoPlayer — the caption loading flow should feel native, as if it was always there. No new UI invention needed.

### Subtitles Button — Dual Behavior

The existing `Subtitles` button (VideoPlayer.tsx:1031-1046) gains dual behavior:

| State | Click Action | Visual | aria-label |
|-------|-------------|--------|------------|
| No captions loaded | Opens file picker | `opacity-100 text-white hover:bg-white/20` | "Load captions" |
| Captions loaded + enabled | Toggles off | `bg-white/20` (active indicator) | "Disable captions" |
| Captions loaded + disabled | Toggles on | `opacity-100`, no bg highlight | "Enable captions" |

**Remove `opacity-40 cursor-not-allowed` state** — button is always interactive.

### Hidden File Input

Use hidden `<input type="file" accept=".srt,.vtt">` triggered programmatically. Cross-browser compatible (no `showOpenFilePicker()`).

### Caption Display Styling

Existing `video::cue` in theme.css:356-363 already satisfies AC2 (semi-transparent background, white text, WCAG AA+ ~15:1 contrast). No changes needed. Do NOT use CSS variables inside `::cue` — hardcoded values are intentional.

### Toast Patterns

| Scenario | Type | Message |
|----------|------|---------|
| Success | `toast.success()` | "Captions loaded: filename.srt" |
| Parse error | `toast.error()` | "Invalid caption file: could not parse SRT format" |
| Empty file | `toast.error()` | "Caption file is empty" |

### Accessibility

- Button already meets 44px touch target (`size-11`), in tab order, C key toggle works
- Update `aria-label` dynamically based on state
- Keep `aria-pressed` for toggle state

### Data-testid Attributes

| Element | data-testid |
|---------|-------------|
| File input | `caption-file-input` |
| Subtitles button | `caption-toggle-button` |

### Component Flow

`onLoadCaptions` callback flows up from VideoPlayer → LessonPlayer/ImportedLessonPlayer, which handles parsing, validation, Dexie persistence, and error toasts. VideoPlayer stays presentational.

## Dev Notes

### Existing Infrastructure to Reuse

**VideoPlayer already supports captions** — the rendering pipeline is complete:
- `captions?: CaptionTrack[]` prop → renders `<track>` elements (VideoPlayer.tsx:718-727)
- `captionsEnabled` state + localStorage persistence (VideoPlayer.tsx:143-145)
- `toggleCaptions()` function + C keyboard shortcut (VideoPlayer.tsx:299-314)
- Subtitles button in controls bar (VideoPlayer.tsx:1031-1044)
- Caption track visibility managed via `textTracks` API (VideoPlayer.tsx:176-182)

**TranscriptPanel has a VTT parser** — reusable for validation:
- `parseVTT(text)` in TranscriptPanel.tsx parses WebVTT format
- Handles `HH:MM:SS.mmm` and `MM:SS.mmm` timestamps
- Returns `TranscriptCue[]` (startTime, endTime, text)

**File picker pattern exists** in ImportedLessonPlayer.tsx:
- Uses `window.showOpenFilePicker()` with file type filters
- Pattern: hidden input fallback for browsers without File System Access API

**Toast system** — Sonner is already integrated (used throughout app for notifications)

### Architecture Decisions

**Caption content stored in Dexie, not as file handles.** File System Access API handles require re-prompting for permissions on return visits, making them unsuitable for seamless auto-load. Store the raw text content (~50-200KB per caption file) directly in IndexedDB.

**SRT → WebVTT conversion at load time.** Browser `<track>` elements only support WebVTT natively. Convert SRT to WebVTT format and create a blob URL. This conversion is lightweight (string manipulation only).

**Blob URL lifecycle:** Create blob URL when captions are loaded or restored from Dexie. Revoke with `URL.revokeObjectURL()` on component unmount or when new captions replace old ones. Use a ref or cleanup effect.

**Single caption per video.** The AC doesn't mention multi-language support for user-loaded files. Store one caption association per `[courseId+videoId]` pair. If user loads a new file, it replaces the previous one.

### Key Constraints

- **NFR59:** Sync accuracy ≤200ms. Native `<track>` handles this automatically for WebVTT.
- **NFR58:** C key toggle — already implemented in VideoPlayer.
- **NFR13:** Error toast within 1 second — parse synchronously, show toast on failure.
- **Dexie v18:** Must redeclare ALL existing v17 stores (Dexie deletes undeclared tables).
- **No new dependencies.** SRT parsing is simple regex — no library needed.
- **Design tokens:** Use `bg-brand`, `text-destructive` etc. per styling.md. Never hardcode colors.

### SRT Format Reference

```
1
00:00:01,000 --> 00:00:04,000
First subtitle line

2
00:00:05,000 --> 00:00:08,000
Second subtitle line
```

Key differences from WebVTT: commas in timestamps (not dots), no `WEBVTT` header, index numbers required.

### File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/captions.ts` | CREATE | SRT parser, SRT→WebVTT converter, CRUD helpers |
| `src/data/types.ts` | MODIFY | Add `VideoCaptionRecord` interface |
| `src/db/schema.ts` | MODIFY | Add v18 with `videoCaptions` table |
| `src/app/components/figma/VideoPlayer.tsx` | MODIFY | Add `onLoadCaptions` prop, file input |
| `src/app/pages/LessonPlayer.tsx` | MODIFY | Wire caption loading + persistence |
| `src/app/pages/ImportedLessonPlayer.tsx` | MODIFY | Wire caption loading + persistence |
| `tests/e2e/story-e02-s10.spec.ts` | CREATE | E2E test spec |

### Testing Standards

- Follow patterns from existing E2E specs (see `tests/e2e/`)
- Seed `localStorage.setItem('eduvi-sidebar-v1', 'false')` before navigating (tablet sidebar issue)
- Use `data-testid` attributes for all new interactive elements
- File picker testing: use Playwright's `setInputFiles()` on the hidden file input
- For persistence test: load caption → navigate away → return → verify captions auto-loaded

### Previous Story Intelligence (from 2-9)

Key lessons from Story 2-9 (mini-player/theater mode):
- **Event bubbling:** When adding click handlers near `<video>`, always `e.stopPropagation()`.
- **Stable callbacks:** Any callback passed to VideoPlayer that appears in `useEffect` deps must be wrapped in `useCallback` at the parent (LessonPlayer).
- **Inline object deps:** Don't pass object literals as deps — destructure primitives or memoize.
- **Preserve existing features:** VideoPlayer's `onPlayStateChange`, `theaterMode`, `onTheaterModeToggle` props and LessonPlayer's mini-player structure must NOT be removed.

### Project Structure Notes

- All new lib files go in `src/lib/` (existing pattern: `src/lib/bookmarks.ts`)
- Types in `src/data/types.ts` (existing `CaptionTrack`, `TranscriptCue` interfaces)
- Dexie schema versioning in `src/db/schema.ts` (currently v17)
- E2E tests in `tests/e2e/` (Playwright, Chromium-only for story dev)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7] — acceptance criteria
- [Source: docs/planning-artifacts/prd.md] — FR88, NFR13, NFR58, NFR59
- [Source: src/app/components/figma/VideoPlayer.tsx:40,718-727] — existing caption rendering
- [Source: src/app/components/figma/TranscriptPanel.tsx] — existing VTT parser
- [Source: src/db/schema.ts:390-412] — current Dexie v17 schema
- [Source: docs/implementation-artifacts/2-9-mini-player-theater-mode.md] — previous story lessons

## Challenges and Lessons Learned

### 1. E2E Test Route Mismatch — Imported vs Built-in Courses
**Challenge:** Tests originally used `seedImportedCourses()` to seed course data, then navigated to `/courses/operative-six/...` (LessonPlayer route). But imported courses live at `/imported-courses/` (ImportedLessonPlayer route) and require a separate `importedVideos` table entry with a `fileHandle`.

**Solution:** Switched to using the built-in `operative-six` course from `seedCourses` static data, which auto-seeds on app init. Tests navigate to `/courses/operative-six/op6-introduction` without any manual seeding.

**Pattern:** For LessonPlayer tests, prefer built-in seed data over manual `seedImportedCourses`. Reserve `seedImportedCourses` + `seedImportedVideos` for ImportedLessonPlayer-specific tests.

### 2. Zustand Store Race Condition — `waitForLoadState('networkidle')`
**Challenge:** `useCourseStore.courses` starts as `[]` and loads asynchronously via `loadCourses()` (triggered by Layout.tsx useEffect). When navigating directly to a lesson URL, LessonPlayer can render before the store finishes loading, showing "Lesson Not Found".

**Solution:** Add `await page.waitForLoadState('networkidle')` after every `page.goto()` call, including the initial `/` navigation in `beforeEach`. This ensures Zustand stores are hydrated from IndexedDB before assertions.

**Pattern:** Always use `networkidle` waits in E2E tests that depend on async Zustand store hydration. This matches the pattern used in story-e09b-s01 tests.

### 3. Unit Test Updates for Schema and Aria-Label Changes
**Challenge:** Dexie v17→v18 migration added `videoCaptions` table, breaking schema tests expecting v17 and 19 tables. Caption button aria-label changed from "Enable captions" to "Load captions" when no captions are loaded, breaking VideoPlayer unit tests.

**Solution:** Updated `schema.test.ts` to expect v18 with `videoCaptions` table. Updated `VideoPlayer.test.tsx` to expect "Load captions" for the no-captions state.

**Pattern:** When modifying Dexie schema or ARIA labels, always search for existing unit tests that assert on version numbers, table lists, or `getByRole` with the old label text.

### 4. Prettier Auto-Format on E2E Spec
**Challenge:** The E2E spec had minor formatting differences caught by the format-check gate.

**Solution:** Auto-formatted with `npx prettier --write`. Committed separately to keep formatting changes isolated from logic changes.

### 5. Async Callbacks Need Defensive Error Handling
**Challenge:** Code review caught that `handleLoadCaptions` (async callback) and `getCaptionForVideo().then()` had no try/catch or `.catch()`. IndexedDB failures (quota exceeded, DB upgrade race) would silently swallow errors — learners would see no feedback.

**Solution:** Wrapped all async caption operations in try/catch with toast error feedback and console.error logging.

**Pattern:** Any async callback that touches IndexedDB (Dexie) needs both validation-level error returns AND infrastructure-level try/catch. Validation handles expected cases (bad file format); try/catch handles unexpected failures (DB quota, corruption).

### 6. Reuse Existing Infrastructure Before Building New
**Challenge:** VideoPlayer already had full caption rendering support (`<track>` elements, C key toggle, localStorage persistence for enabled state). The SRT→WebVTT conversion was the only genuinely new parsing logic needed.

**Solution:** Built on existing `captions` prop, `captionsEnabled` state, and `toggleCaptions()` function. Only added: file input, `onLoadCaptions` callback, and dynamic button behavior.

**Pattern:** Before implementing a feature, audit the target component for existing hooks and props that can be extended rather than duplicated.

## Implementation Plan

See [plan](plans/e02-s10-caption-subtitle-support.md) for implementation approach.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
