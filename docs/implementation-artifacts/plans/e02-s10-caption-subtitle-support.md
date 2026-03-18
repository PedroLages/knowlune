# E02-S10: Caption and Subtitle Support — Implementation Plan

## Context

Epic 2 was reopened for deferred story 2-10 (FR88). The VideoPlayer already has 80% of the caption infrastructure — `<track>` rendering, `captionsEnabled` toggle, C key shortcut, Subtitles button. What's missing: file loading (SRT/WebVTT), parsing, Dexie persistence, and wiring the load flow into LessonPlayer/ImportedLessonPlayer.

All dependencies (Stories 2-1 through 2-9) are done. Risk level: LOW.

## Implementation Steps

### Step 1: SRT/WebVTT Parser Utility — `src/lib/captions.ts` (CREATE)

**Purpose:** Parse SRT and WebVTT files, convert SRT→WebVTT blob URLs for native `<track>` element.

- Extract `parseVTT()` from `TranscriptPanel.tsx:19-44` (reuse, don't duplicate)
- Add `parseSRT(text: string): TranscriptCue[]` — parse SRT timestamps (`HH:MM:SS,mmm → seconds`)
- Add `srtToWebVTT(srtText: string): string` — string conversion (replace commas with dots, add `WEBVTT` header)
- Add `createCaptionBlobUrl(content: string, format: 'srt' | 'vtt'): string` — creates blob URL; converts SRT→WebVTT first
- Add `validateCaptionFile(text: string, format: 'srt' | 'vtt'): { valid: boolean; error?: string }` — checks for empty, malformed
- Add `detectCaptionFormat(filename: string): 'srt' | 'vtt' | null` — from file extension

**Reuse:** `parseTime()` helper from TranscriptPanel.tsx:11-17 (handles both `HH:MM:SS.mmm` and `MM:SS.mmm`).

**Key constraint:** SRT uses commas (`00:00:01,000`), WebVTT uses dots (`00:00:01.000`). The `parseTime()` helper already handles this via `.replace(',', '.')`.

### Step 2: Dexie Schema v18 — `src/db/schema.ts` (MODIFY)

**Purpose:** Add `videoCaptions` table for persisting caption file associations.

- Add `db.version(18).stores({...})` redeclaring ALL 19 v17 stores + new `videoCaptions` table
- Schema: `'[courseId+videoId], courseId, videoId'` (compound primary key)
- Add table declaration to db type

**Critical:** Must redeclare all existing v17 stores in v18 or Dexie deletes them.

### Step 3: VideoCaptionRecord Type — `src/data/types.ts` (MODIFY)

**Purpose:** Add type for the new Dexie table.

```typescript
export interface VideoCaptionRecord {
  courseId: string
  videoId: string
  filename: string
  content: string    // Raw SRT/WebVTT text (~50-200KB)
  format: 'srt' | 'vtt'
  createdAt: string  // ISO date
}
```

### Step 4: Caption CRUD Helpers — `src/lib/captions.ts` (extend from Step 1)

**Purpose:** Dexie read/write for caption associations.

- `saveCaptionForVideo(courseId, videoId, file: File): Promise<void>` — read file text, validate, store in Dexie
- `getCaptionForVideo(courseId, videoId): Promise<CaptionTrack | null>` — read from Dexie, create blob URL, return CaptionTrack
- `removeCaptionForVideo(courseId, videoId): Promise<void>` — delete from Dexie

**Design:** Store raw text content in Dexie (not file handles). File handles require re-prompting permissions on return visits.

### Step 5: VideoPlayer File Input — `src/app/components/figma/VideoPlayer.tsx` (MODIFY)

**Purpose:** Add file picker trigger and `onLoadCaptions` callback.

Changes:
1. Add `onLoadCaptions?: (file: File) => void` to `VideoPlayerProps`
2. Add hidden `<input type="file" accept=".srt,.vtt" data-testid="caption-file-input">` with ref
3. Modify Subtitles button behavior:
   - **No captions loaded + `onLoadCaptions` defined:** Click opens file picker (remove `opacity-40 cursor-not-allowed`)
   - **Captions loaded:** Click toggles visibility (existing behavior)
4. Add `data-testid="caption-toggle-button"` to Subtitles button
5. On file selected: call `onLoadCaptions(file)` callback
6. Update `aria-label` to "Load captions" when no captions present

**Preserve:** All existing props (`onPlayStateChange`, `theaterMode`, `onTheaterModeToggle`, bookmarks). Wrap any new callbacks in `useCallback` per Story 2-9 lessons.

### Step 6: LessonPlayer Integration — `src/app/pages/LessonPlayer.tsx` (MODIFY)

**Purpose:** Wire caption loading, persistence, and auto-restore.

Changes:
1. On mount: `getCaptionForVideo(courseId, lessonId)` → set as initial captions state
2. Add `handleLoadCaptions` callback (wrapped in `useCallback`):
   - Read file → detect format → validate → if invalid: `toast.error(...)` → return
   - Save to Dexie via `saveCaptionForVideo()`
   - Create blob URL → update captions state
   - Show `toast.success('Captions loaded: filename.srt')`
3. Pass `onLoadCaptions={handleLoadCaptions}` to VideoPlayer
4. Merge user-loaded captions with any existing `videoResource.metadata?.captions`
5. Cleanup: revoke blob URL on unmount or replacement (`URL.revokeObjectURL()`)

**Toast import:** Already present at line 60: `import { toast } from 'sonner'`

### Step 7: ImportedLessonPlayer Integration — `src/app/pages/ImportedLessonPlayer.tsx` (MODIFY)

**Purpose:** Same caption flow as Step 6 but for imported courses.

- Same `getCaptionForVideo()` on mount, same `handleLoadCaptions` callback
- Uses `courseId` + `lessonId` from route params (already available)
- Pass `onLoadCaptions` and `captions` props to VideoPlayer

### Step 8: Update E2E Tests — `tests/e2e/story-e02-s10.spec.ts` (MODIFY)

**Purpose:** Refine ATDD tests now that implementation details are known.

- Adjust selectors to match actual `data-testid` attributes
- Ensure navigation routes match the real lesson player routes
- May need to update course seeding if `createOperativeSixCourse()` doesn't match needed structure
- Verify file input interaction pattern works with Playwright's `setInputFiles()`

## Files Changed

| File | Action | Step |
|------|--------|------|
| `src/lib/captions.ts` | CREATE | 1, 4 |
| `src/db/schema.ts` | MODIFY | 2 |
| `src/data/types.ts` | MODIFY | 3 |
| `src/app/components/figma/VideoPlayer.tsx` | MODIFY | 5 |
| `src/app/pages/LessonPlayer.tsx` | MODIFY | 6 |
| `src/app/pages/ImportedLessonPlayer.tsx` | MODIFY | 7 |
| `tests/e2e/story-e02-s10.spec.ts` | MODIFY | 8 |

## Key Patterns to Follow

- **Toast:** `import { toast } from 'sonner'` → `toast.success(msg)` / `toast.error(msg)`
- **Dexie schema:** Redeclare ALL existing stores when adding v18
- **Blob URLs:** Create with `URL.createObjectURL()`, revoke on cleanup
- **Callbacks:** Wrap in `useCallback` at parent (LessonPlayer) before passing to VideoPlayer
- **Design tokens:** Use `bg-brand`, `text-destructive` etc. Never hardcode colors
- **Test IDs:** `data-testid="caption-file-input"`, `data-testid="caption-toggle-button"`

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no ESLint violations (design tokens, test patterns)
3. Load a WebVTT file → captions appear on video
4. Load an SRT file → captions appear (converted to WebVTT internally)
5. Press C → captions toggle off/on
6. Load invalid file → error toast, video continues playing
7. Navigate away → return → captions auto-load from Dexie
8. `npx playwright test tests/e2e/story-e02-s10.spec.ts --project=chromium` — all tests pass

## Commit Strategy

Granular commits after each step:
1. `feat(E02-S10): add SRT/WebVTT parser utility`
2. `feat(E02-S10): add Dexie v18 schema with videoCaptions table`
3. `feat(E02-S10): add caption CRUD helpers and persistence`
4. `feat(E02-S10): add file picker to VideoPlayer controls`
5. `feat(E02-S10): wire caption loading in LessonPlayer`
6. `feat(E02-S10): wire caption loading in ImportedLessonPlayer`
7. `test(E02-S10): update E2E tests for caption support`
