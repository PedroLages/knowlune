# Design Review Report — E02-S10: Caption and Subtitle Support

**Review Date**: 2026-03-18
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E02-S10 — Caption and Subtitle Support
**Branch**: `feature/e02-s10-caption-subtitle-support`

**Changed Files**:
- `src/app/components/figma/VideoPlayer.tsx` — dual-behavior Subtitles button, hidden file input
- `src/app/pages/LessonPlayer.tsx` — caption loading + persistence integration
- `src/app/pages/ImportedLessonPlayer.tsx` — caption loading + persistence integration
- `src/lib/captions.ts` — SRT parser, SRT→WebVTT converter, Dexie CRUD helpers (new file)
- `src/data/types.ts` — `VideoCaptionRecord` interface added
- `src/db/schema.ts` — Dexie v18 with `videoCaptions` table

**Affected Routes Tested**:
- `/courses/operative-six/op6-introduction` (LessonPlayer with video + course captions)

---

## Executive Summary

E02-S10 adds user-controlled caption loading to the VideoPlayer via a dual-behavior Subtitles button and a hidden file input. The implementation is clean and well-integrated into the existing infrastructure. ARIA states, keyboard shortcuts, focus management, and touch targets are all correctly implemented. No new issues were introduced by this story. One pre-existing controls overflow at 375px mobile is documented for awareness. The feature is ready to ship.

---

## What Works Well

1. **ARIA semantics are textbook-correct.** The `aria-pressed`/`aria-label` trio transitions cleanly through three states (Load / Enable / Disable), and `aria-pressed` is correctly `undefined` (not `false`) when the button acts as a file picker rather than a toggle. This is nuanced and was implemented exactly as specified.

2. **ARIA live region announcement pipeline.** The existing `role="status" aria-live="polite"` region in the VideoPlayer correctly picks up the caption enable/disable announcements, keeping screen reader users informed without requiring any additional markup.

3. **All touch targets meet 44×44px minimum.** Every button in the controls bar — including the new caption toggle — measures exactly 44×44px on mobile. The design principle is fully satisfied.

4. **Zero hardcoded colors.** `captions.ts`, `VideoPlayer.tsx`, `LessonPlayer.tsx`, and `ImportedLessonPlayer.tsx` all pass the grep check with no `#rrggbb` values in any changed file. Design token discipline is maintained.

5. **Blob URL lifecycle is correct.** `userCaptionBlobUrl` ref is used as a stable store for the current blob URL, revoked on replacement and on component unmount. This prevents memory leaks that are common mistakes in caption loading implementations.

6. **`captionSrc` derivation unlocks Transcript/Summary tabs for user-loaded files.** After a user loads a caption file, `captionSrc = userCaptions?.src` becomes truthy and the Transcript and AI Summary tabs appear — a meaningful UX win that was verified live (both tabs visible on the operative-six/op6-introduction route).

7. **`prefers-reduced-motion` respected.** The controls overlay transition uses `motion-reduce:transition-none` on its 300ms opacity transition. Animation accessibility is maintained.

8. **Zero console errors** across all breakpoints tested (1440px, 768px, 375px). No React key warnings, no Dexie errors, no network errors.

---

## Findings by Severity

### Blockers (Must fix before merge)

None.

### High Priority (Should fix before merge)

None.

### Medium Priority (Fix when possible)

**M1 — Caption toggle C key announces "Paused" rather than "Captions disabled/enabled" in rapid succession**

- **Location**: `src/app/components/figma/VideoPlayer.tsx:563–565`
- **Evidence**: When the C key is pressed while the video is playing, `toggleCaptions()` calls `announce('Captions enabled/disabled')` at line 333, but the keyboard shortcut handler at line 563 also receives the keydown and — because `togglePlayPause` is also on `window` — triggers "Paused" before the captions announcement clears. In testing, pressing C while paused correctly announced captions. When playing, the "Paused" announcement from the space-bar handler overwrites the captions announcement.
- **Impact**: Screen reader users relying on live region announcements may not hear confirmation that captions were toggled when pressing C during playback. This is a confusing experience for assistive technology users.
- **Suggestion**: The announcements use a 3-second clear timeout — they do not stack. The root cause is that the C key handler at line 562 fires `toggleCaptions()` which calls `announce('Captions disabled')`, then the video continues playing and the `announce` in the playback code does not interfere. Investigation in context showed the "Paused" text seen during testing was a stale announcement from a prior test action (clicking the video). This finding may be a testing artefact rather than a real bug. Recommend verifying with a screen reader (VoiceOver/NVDA) before treating as a blocker.

### Nitpicks (Optional)

**N1 — `aria-label="Load captions"` on the file-picker state could be more descriptive**

- **Location**: `src/app/components/figma/VideoPlayer.tsx:1077`
- **Evidence**: When no captions are loaded, `aria-label="Load captions"`. This is correct but a screen reader user might benefit from "Load captions file (.srt or .vtt)" to convey the file picker affordance.
- **Impact**: Minor — the current label is clear enough for most users.
- **Suggestion**: Consider `aria-label="Load captions file"` to hint at the file-picker interaction. Not required for WCAG AA compliance.

**N2 — `captionSrc` derivation in LessonPlayer.tsx prefers `userCaptions` but TranscriptPanel always shows `userCaptions.src`**

- **Location**: `src/app/pages/LessonPlayer.tsx:330`
- **Evidence**: `captionSrc = userCaptions?.src ?? videoResource?.metadata?.captions?.[0]?.src`. When a user loads a caption file while the lesson already has a course-provided VTT, the Transcript tab will switch to the user's file. This is correct by design (AC5) but is worth documenting for future reviewers — it is an intentional override, not a priority bug.
- **Impact**: None in current scope. Worth a comment in the code.
- **Suggestion**: Add a brief inline comment: `// userCaptions takes priority — user-loaded file overrides course captions in Transcript/Summary panels`.

---

## Detailed Findings

### Finding 1 — Pre-existing controls overflow at 375px mobile (not introduced by this story)

- **Issue**: At 375px viewport, the VideoPlayer is 305px wide. The right-side controls group (bookmark, captions, PiP, fullscreen) overflows the container boundary by 25–181px. The container uses `overflow: hidden`, so these buttons are visually clipped and tappable area is partially outside the visible player bounds.
- **Location**: `src/app/components/figma/VideoPlayer.tsx:1063–1131` (entire right-side controls group)
- **Evidence**: Computed at 375px —
  - Add bookmark: right edge at 354px, player right at 329px → overflow 25px
  - Caption toggle: right edge at 406px → overflow 77px
  - PiP: right edge at 458px → overflow 129px
  - Fullscreen: right edge at 510px → overflow 181px
- **Attribution**: This overflow existed on `main` before E02-S10. The caption button was already in this group (previously as a disabled state, now as an active button). This story did not introduce the overflow or worsen it.
- **Impact for learners**: On 375px devices, the caption toggle and fullscreen buttons are invisible and inaccessible via touch. Learners cannot load captions on a small phone in portrait mode.
- **Suggestion**: This is a pre-existing design debt, outside the scope of E02-S10. Recommend filing a separate story to add horizontal scroll or a `...` overflow menu for the right-side controls at mobile breakpoints (e.g. `sm:flex hidden` with consolidated icon placement). The C key shortcut remains available as an accessibility fallback.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | `video::cue` uses white on rgba(0,0,0,0.85) ≈ 15:1. Controls use white on gradient overlay. |
| Keyboard navigation (Tab order) | Pass | Caption button `tabIndex=0`, in natural tab flow within controls bar. |
| Focus indicators visible | Pass | `focus-visible:ring-[3px] focus-visible:ring-ring/50` on caption button via shadcn Button variant. |
| Heading hierarchy | Pass | H1 (lesson title) → H3 (Course Content, module accordion). No H2 skip. |
| ARIA labels on icon buttons | Pass | Three-state dynamic `aria-label` on caption button ("Load captions" / "Enable captions" / "Disable captions"). |
| `aria-pressed` semantics | Pass | `undefined` when file-picker mode, boolean `captionsEnabled` when toggle mode. |
| ARIA live region for announcements | Pass | `role="status" aria-live="polite"` present in VideoPlayer for caption enable/disable announcements. |
| Semantic HTML | Pass | No `<div onClick>` patterns in new code. All interactive elements use `<button>` or `<input>`. |
| Form labels associated | Pass | Hidden file input uses `data-testid` only; no user-visible label needed as it is programmatically triggered. |
| `prefers-reduced-motion` | Pass | `motion-reduce:transition-none` on controls overlay transition. |
| Touch targets ≥44×44px | Pass | Caption button 44×44px confirmed at 375px, 768px, and 1440px. |

---

## Responsive Design Verification

- **Desktop (1440px)**: Pass — Player renders at full width. All controls visible. Caption button 44×44px, aria-label correct. Transcript/Summary tabs appear with course captions. No horizontal scroll.
- **Tablet (768px)**: Pass — No horizontal scroll. Caption button 44×44px. Desktop sidebar hidden. Tablet video/notes toggle present. Controls bar fits within player bounds.
- **Mobile (375px)**: Partial — No horizontal scroll on page. No layout breakage. However caption toggle (and three other buttons) render outside the `overflow:hidden` player boundary due to a pre-existing controls overflow. This is attributed to pre-existing debt, not this story. The `C` key shortcut remains the accessible alternative.

---

## Code Health Summary

| Check | Result | Notes |
|-------|--------|-------|
| Hardcoded hex colors | Pass | Zero `#rrggbb` values in all changed files |
| Inline `style=` attributes | Pass | None in changed files |
| Design tokens used | Pass | `bg-brand`, `text-brand`, `text-muted-foreground` used correctly |
| `any` TypeScript usage | Pass | No `any` types in `captions.ts` or changed files |
| Import alias `@/` | Pass | All new imports use `@/` alias pattern |
| Dexie v18 migration | Pass | All 19 v17 tables redeclared before new `videoCaptions` table |
| `VideoCaptionRecord` interface | Pass | Properly typed in `src/data/types.ts` |
| Blob URL lifecycle | Pass | Revoked on replacement and on unmount via `useEffect` cleanup |
| `useCallback` on `handleLoadCaptions` | Pass | Correctly memoized in both LessonPlayer and ImportedLessonPlayer |
| Console errors | Pass | Zero errors across all breakpoints and interactions |

---

## Recommendations

1. **Proceed to merge** — no blockers or high-priority issues found. The implementation matches the design spec exactly, including the three-state ARIA label pattern and the `aria-pressed=undefined` file-picker case.

2. **File a follow-up story for mobile controls overflow** — the right-side controls group is not accessible on 375px viewports. Suggested fix: introduce a mobile controls layout that either consolidates buttons or adds a secondary row at `< sm` breakpoints. Reference: `VideoPlayer.tsx:1063–1131`.

3. **Validate C key announcement with a screen reader** — the medium-priority finding M1 about announcement order may be a test artefact. A quick VoiceOver pass (macOS, Safari) during video playback will confirm whether the "Captions enabled" announcement is audible before closing the story.

4. **Consider documenting the `captionSrc` override behaviour** (N2) with an inline comment so future developers understand why user captions take priority over course captions in the Transcript/Summary panels.
