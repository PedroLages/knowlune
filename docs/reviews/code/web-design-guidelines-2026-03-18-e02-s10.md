# Web Design Guidelines Review: E02-S10 Caption & Subtitle Support

**Date:** 2026-03-18
**Story:** E02-S10 — Caption and Subtitle Support
**Reviewer:** Claude (automated)
**Files reviewed:**
- `src/app/components/figma/VideoPlayer.tsx`
- `src/app/pages/LessonPlayer.tsx`
- `src/app/pages/ImportedLessonPlayer.tsx`
- `src/lib/captions.ts`
- `src/data/types.ts`

---

## Summary

The implementation adds user-loaded caption/subtitle support (.srt and .vtt) to the VideoPlayer component. Captions are persisted in IndexedDB (Dexie) and restored on subsequent visits. The caption toggle button doubles as a file picker trigger when no captions are loaded.

Overall quality is **good** with a few findings that should be addressed.

---

## Accessibility (WCAG 2.1 AA)

### PASS

1. **Dynamic `aria-label` on caption button** — The button label correctly changes between "Load captions", "Enable captions", and "Disable captions" depending on state. This gives screen reader users clear context for the button's current action.

2. **`aria-pressed` conditional** — When no captions are loaded, `aria-pressed` is set to `undefined` (effectively removed), which is correct since "Load captions" is an action, not a toggle. When captions exist, `aria-pressed` correctly reflects the toggle state.

3. **Hidden file input pattern** — Using a visually hidden `<input type="file">` triggered programmatically by a button is a well-established accessible pattern. The button itself is keyboard-focusable and activatable.

4. **`data-testid` attributes** — Added `caption-toggle-button` and `caption-file-input` for test automation without polluting ARIA semantics.

### MEDIUM — Hidden file input lacks accessible label

**Location:** `VideoPlayer.tsx`, the hidden `<input>` element

The hidden file input has no `aria-label` or associated `<label>`. While it is visually hidden and activated programmatically (so sighted users never see it), some screen readers may still announce it in the accessibility tree as an unlabeled file input.

**Recommendation:** Add `aria-label="Select caption file"` to the hidden input, or add `aria-hidden="true"` since interaction is handled entirely through the button proxy.

```tsx
<input
  ref={captionInputRef}
  type="file"
  accept=".srt,.vtt"
  className="hidden"
  aria-hidden="true"
  data-testid="caption-file-input"
  onChange={handleCaptionFileChange}
/>
```

### LOW — No keyboard shortcut hint for caption toggle

The caption toggle button does not expose a tooltip or `title` indicating a keyboard shortcut (if one exists). Other video player controls (play/pause, mute) typically have shortcut hints. This is advisory, not a WCAG violation.

---

## Responsive Design

### PASS

1. **Button sizing** — The caption toggle uses `size-11` (44x44px), meeting the minimum touch target requirement of 44x44px for mobile.

2. **No new layout changes** — The feature reuses existing control bar layout patterns. No new breakpoint-specific code was needed, which is correct since the button fits into the existing flex row of controls.

### PASS — No concerns

The feature is purely additive to the existing control bar and does not introduce new layout elements that would need responsive handling.

---

## User Feedback Patterns

### PASS

1. **Toast notifications** — Both `LessonPlayer.tsx` and `ImportedLessonPlayer.tsx` use `toast.success()` on successful caption load and `toast.error()` on validation failure. This follows the project's established Sonner toast pattern.

2. **Error messages are user-friendly** — The `captions.ts` library returns descriptive errors: "Caption file is empty", "Invalid caption file: could not parse SRT format", "Unsupported file format. Use .srt or .vtt files". These are actionable.

3. **Button state feedback** — The caption button shows `bg-white/20` highlight when captions are active, and `opacity-40 cursor-not-allowed` when disabled. When `onLoadCaptions` is available, the button is always interactive (not grayed out), correctly signaling that clicking it will do something.

### LOW — No loading state during file parsing

For very large caption files, `file.text()` and parsing could take a noticeable moment. There is no intermediate loading indicator. For typical caption files (< 100KB), this is not a real issue, but it is worth noting.

---

## Design Consistency

### PASS

1. **Design tokens** — No hardcoded Tailwind colors detected. All color classes use the project's token system (`text-white`, `bg-white/20`, `bg-brand`, etc.).

2. **Component patterns** — Uses existing `Button` component with `variant="ghost"` and `size="icon"`, consistent with other video player controls.

3. **Icon usage** — Uses `Subtitles` from lucide-react, consistent with the project's icon library.

4. **`cn()` utility** — Conditional class merging uses the project's `cn()` helper, following established patterns.

### PASS — Consistent with existing video player controls

The caption button is visually identical in size, spacing, and hover behavior to the adjacent PiP, theater mode, and fullscreen buttons.

---

## Code Quality Observations

### PASS — Blob URL memory management

Both `LessonPlayer.tsx` and `ImportedLessonPlayer.tsx` properly revoke blob URLs via `URL.revokeObjectURL()` in three scenarios:
- When replacing a caption with a new one
- When loading persisted captions (revoking old URL first)
- On component unmount (cleanup effect)

This prevents memory leaks from orphaned blob URLs.

### PASS — Race condition prevention

The `useEffect` hooks for loading persisted captions use a `cancelled` flag to prevent state updates on unmounted components. This is the correct pattern for async effects.

### MEDIUM — Duplicated caption logic between LessonPlayer and ImportedLessonPlayer

The caption state management, blob URL tracking, `handleLoadCaptions` callback, and caption-loading `useEffect` are nearly identical in both page components (~50 lines each). This is not a design guidelines issue per se, but it creates a maintenance burden. Consider extracting a `useCaptionLoader(courseId, lessonId)` custom hook.

### LOW — Track key includes index

The `<track>` element key changed from `caption.language` to `` `${caption.language}-${index}` ``. While this fixes potential duplicate-key warnings when multiple tracks share a language, using array index in keys can cause reconciliation issues if the caption array is reordered. Given that captions are typically appended (not reordered), this is acceptable but worth documenting the assumption.

---

## Findings Summary

| # | Severity | Category | Finding |
|---|----------|----------|---------|
| 1 | MEDIUM | Accessibility | Hidden file input lacks `aria-label` or `aria-hidden="true"` |
| 2 | MEDIUM | Code Quality | Caption logic duplicated between LessonPlayer and ImportedLessonPlayer |
| 3 | LOW | Accessibility | No keyboard shortcut hint on caption toggle |
| 4 | LOW | UX | No loading indicator during large file parsing |
| 5 | LOW | Code Quality | Track key uses array index (safe given append-only usage) |

**Verdict:** No blockers. Two medium findings worth addressing; three low findings are advisory.
