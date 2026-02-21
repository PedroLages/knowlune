# Design Review Report — E02-S08: Chapter Progress Bar & Transcript Panel

**Review Date**: 2026-02-21
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Branch**: `feature/e02-s08-chapter-progress-bar-transcript-panel`
**Changed Files**:
- `src/app/components/figma/ChapterProgressBar.tsx` (new)
- `src/app/components/figma/TranscriptPanel.tsx` (new)
- `src/app/components/figma/VideoPlayer.tsx` (modified)
- `src/app/pages/LessonPlayer.tsx` (modified)
- `src/data/courses/operative-six.ts` (modified)
- `public/captions/op6-introduction.vtt` (new)

**Affected Pages**: `/courses/operative-six/op6-introduction`, `/courses/operative-six/op6-pillars-of-influence`
**Test Viewports**: 375px (mobile), 768px (tablet), 1440px (desktop)

---

## Executive Summary

E02-S08 adds chapter markers to the video progress bar and a Transcript tab powered by a VTT-parsing panel. Both features are functionally solid and architecturally clean — the new components are well-typed, composable, and backwards-compatible. One blocker exists on mobile: chapter marker buttons have touch targets of 16x28px, well under the 44x44px minimum. Two medium-priority issues round out the findings: a hardcoded inline height on the transcript container and transcript cues extending beyond the actual video duration in the sample data.

---

## What Works Well

- The chapter marker z-layering architecture is genuinely clever. Markers sit at `z-20`, the opaque range input sits at `z-10`, and the visual track uses `pointer-events-none` — so hover tooltips fire on markers while the range input continues to handle keyboard scrubbing and general click-to-seek. This is a low-complexity solution that avoids needing a custom scrubber implementation.
- Backward compatibility is clean. The lesson without chapters (`op6-pillars-of-influence`) renders an unmodified progress bar with no markers and no Transcript tab, exactly as before. The `chapters?: Chapter[]` optional prop on `ChapterProgressBar` and the `captionSrc &&` guard in `LessonPlayer` make this zero-config.
- The VTT parser is self-contained (no new dependency), handles both `HH:MM:SS.mmm` and `MM:SS.mmm` formats, guards against stale fetches with a cancellation flag, and surfaces a clear error state. That is thorough for an inline utility.
- Click-to-seek from transcript cues is confirmed working end-to-end: clicking the "2:00" cue moves the video `currentTime` to 120s, updates the progress bar to 83.1%, updates the displayed timestamp, and triggers the "Resuming from 2:00" resume toast.
- The ARIA live region for video announcements (`role="status" aria-live="polite"`) is already present in `VideoPlayer` and continues working correctly.
- Tab panels are properly labelled via `aria-labelledby` (Radix UI wires this automatically). The Transcript panel's `tabpanel` is correctly associated with its trigger.

---

## Findings by Severity

### Blockers (Must fix before merge)

#### B1 — Chapter marker touch targets too small on mobile
- **Location**: `src/app/components/figma/ChapterProgressBar.tsx:62-68`
- **Evidence**: At 375px viewport, chapter marker buttons measure 16x28px (computed via `getBoundingClientRect()`). The design standard requires a minimum of 44x44px on touch devices.
- **Root cause**: The button uses `w-4 h-full` where `w-4` = 16px and `h-full` resolves to the 28px progress container height (`py-3 -my-3`). By contrast, bookmark markers in the same component correctly apply `min-w-[44px] min-h-[44px]` — chapter markers do not.
- **Impact**: Learners on phones cannot reliably tap chapter markers to jump to sections. This is a primary use case on mobile where precision pointing is impossible and touch targets below 44px cause frequent mis-taps.
- **Suggestion**: Apply `min-w-[44px] min-h-[44px]` to the chapter marker button (same pattern already used for bookmark markers in the same file at line 86). The visual marker `<span>` inside remains narrow; only the invisible tap area grows.

---

### High Priority (Should fix before merge)

#### H1 — Hardcoded inline height on transcript container
- **Location**: `src/app/pages/LessonPlayer.tsx:414`
- **Evidence**:
  ```tsx
  <div className="bg-card rounded-2xl shadow-sm overflow-hidden" style={{ height: '400px' }}>
  ```
  This inline `style` attribute violates the project convention of using Tailwind utilities exclusively for layout. Confirmed by computed style check: the container renders at exactly 400px.
- **Impact**: The fixed 400px does not adapt to content density. On short transcripts (e.g., 2–3 cues) most of the container is empty whitespace. On longer transcripts, the scrollable inner region shrinks to 264px (400px minus tab header height). A responsive height approach would serve learners better at all content lengths.
- **Suggestion**: Replace the inline style with a Tailwind utility. `h-[400px]` produces the same output through the design system. If a responsive height is desired later, `max-h-[400px]` or a Tailwind arbitrary height would be the right vehicle — but even a direct swap to `h-[400px]` removes the inline-style violation.

#### H2 — Chapter marker `key` prop uses array index
- **Location**: `src/app/components/figma/ChapterProgressBar.tsx:59`
- **Evidence**: `<Tooltip key={idx}>` — the index is used as a React list key for both chapter tooltips (line 59) and transcript cues (TranscriptPanel line 114).
- **Impact**: Chapter data is fixed at render time so this is low-risk in practice today. However, if chapters were ever reordered or dynamically filtered, React would reconcile incorrectly, potentially showing the wrong tooltip or stale state. Using a stable key (`chapter.title`, `chapter.time`, or a composite) is the conventional fix.
- **Suggestion**: Use `chapter.time` as the key for chapter markers (it is unique within a video) and `cue.startTime` for transcript cues. Both are already typed and stable within a given source.

---

### Medium Priority (Fix when possible)

#### M1 — VTT cue timestamps extend beyond actual video duration
- **Location**: `public/captions/op6-introduction.vtt` and `src/data/courses/operative-six.ts:57-62`
- **Evidence**: The video at `/courses/operative-six/op6-introduction` has a real duration of 144.45s (2:24). The VTT file defines cues at 0:00–0:30, 0:30–2:00, 2:00–4:00, and 4:00–6:00. Cues 3 and 4 reference times (2:00–6:00) that exceed the video duration. Chapter data similarly defines `{ time: 240, title: 'Program Structure' }` which is beyond 144s, causing that marker to be silently dropped (correctly guarded by `pct >= 100`).
- **Impact**: Learners clicking "The training objectives" cue at 2:00 will seek to the very end of the video (browser clamps the currentTime). This is not catastrophic, but it creates confusion — a visible transcript entry that cannot be "followed along" during playback. The "Program Structure" chapter marker never appears.
- **Suggestion**: Update `public/captions/op6-introduction.vtt` to fit within the actual 2:24 duration, and update `operative-six.ts` chapter times to match. This is test/sample data; the VTT parser and component logic are both correct — only the data calibration needs adjustment.

#### M2 — `captionSrc` hardcodes first caption track only
- **Location**: `src/app/pages/LessonPlayer.tsx:113`
- **Evidence**: `const captionSrc = videoResource?.metadata?.captions?.[0]?.src` — always takes index `[0]`.
- **Impact**: If a lesson ever defines multiple caption tracks (e.g., English + Spanish), only the first will populate the Transcript panel. The Transcript tab will appear with just the first language's content, with no indication that alternatives exist.
- **Suggestion**: This is an acceptable constraint for the current story scope (AC4 specifies "when captions data is present"). Document the limitation as a known constraint in a comment so future stories can extend it without confusion.

---

### Nitpicks (Optional)

#### N1 — Relative imports in LessonPlayer inconsistent with `@/` alias convention
- **Location**: `src/app/pages/LessonPlayer.tsx:4-15`
- **Evidence**: Lines 4–15 use relative paths (`'../components/ui/button'`) while lines 16–29 use `@/` aliases. The new `TranscriptPanel` import at line 8 follows the existing relative pattern in the file rather than the project convention.
- **Note**: This is a pre-existing pattern in `LessonPlayer.tsx` not introduced by this story. The two new components (`ChapterProgressBar.tsx`, `TranscriptPanel.tsx`) both use `@/` correctly throughout.
- **Suggestion**: A follow-up refactor to standardise all `LessonPlayer.tsx` imports to `@/` aliases would align with the project convention in `CLAUDE.md`.

#### N2 — `scrollIntoView({ behavior: 'smooth' })` not individually guarded for `prefers-reduced-motion`
- **Location**: `src/app/components/figma/TranscriptPanel.tsx:96`
- **Evidence**: `activeCueRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`
- **Note**: The global `@media (prefers-reduced-motion: reduce)` in `src/styles/index.css` does not affect the JavaScript `scrollIntoView` API — CSS motion reduction only applies to CSS animations and transitions, not JS-triggered scrolling.
- **Impact**: Minor. Users who prefer reduced motion will still experience smooth scroll on active cue changes. The practical difference is small (it's auto-scrolling list items, not a cinematic animation).
- **Suggestion**: For full `prefers-reduced-motion` compliance, read the preference via `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and use `{ behavior: 'instant' }` when true. This is a nitpick because the feature still works correctly without it.

#### N3 — Heading hierarchy skip on LessonPlayer page
- **Location**: `src/app/pages/LessonPlayer.tsx` / `src/app/components/Layout.tsx`
- **Evidence**: Page headings are `H1` ("Introduction") → `H3` ("Course Content") with no `H2` in between. This is a pre-existing pattern not introduced by this story.
- **Suggestion**: Note for a future accessibility pass.

---

## Acceptance Criteria Verification

| AC | Criterion | Status | Evidence |
|----|-----------|--------|---------|
| AC1 | Chapter marker lines at correct percentage positions | Pass | Markers at 20.77% (30s) and 83.07% (120s) of 144.45s duration, correctly computed |
| AC1 | Hover tooltip with chapter title and timestamp | Pass | Tooltip shows "0:30 — Course Overview" on hover, confirmed via Playwright |
| AC2 | Progress bar renders identically with no chapters | Pass | `op6-pillars-of-influence` shows clean progress bar, no markers |
| AC3 | Transcript tab in sidebar (below video tabs) | Pass | Tab appears as fourth tab in the tab list when `captionSrc` is present |
| AC3 | Scrollable cue list | Pass | `.overflow-y-auto` scroll container confirmed, 264px height within 400px card |
| AC3 | Active cue highlighting | Pass | `border-l-2 border-blue-600 bg-blue-50` applied to current cue at `currentTime` |
| AC3 | Click-to-seek | Pass | Clicking 2:00 cue seeks video to 120s, progress bar moves to 83.1% |
| AC4 | Transcript tab hidden when no captions | Pass | `op6-pillars-of-influence` (no captions) shows no Transcript tab |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast >= 4.5:1 | Pass | Active cue: near-white on dark blue; inactive cue: muted foreground on card background. Both pass in both light and dark modes |
| Keyboard navigation | Pass | Chapter marker buttons are focusable and labelled; range input handles keyboard scrubbing; transcript cue buttons are keyboard-activatable |
| Focus indicators visible | Pass | Inherited from global focus styles; video container has `focus-visible:outline-2 focus-visible:outline-blue-600` |
| Heading hierarchy | Partial | H1 -> H3 skip is a pre-existing issue not introduced by this story |
| ARIA labels on icon buttons | Pass | Chapter markers: `aria-label="Go to chapter: Course Overview at 0:30"`. Transcript cues are full-text buttons requiring no additional label |
| Semantic HTML | Pass | Transcript cues use `<button>`, chapter markers use `<button>`, progress uses `<input type="range">` |
| ARIA live region for announcements | Pass | `role="status" aria-live="polite"` in VideoPlayer continues working |
| Tab panels associated with triggers | Pass | Radix UI wires `aria-labelledby` automatically; verified programmatically |
| `prefers-reduced-motion` | Partial | CSS animations globally gated; `scrollIntoView({ behavior: 'smooth' })` in TranscriptPanel is not (see N2) |
| Mobile touch targets | Fail | Chapter marker buttons 16x28px on mobile — BLOCKER (see B1) |

---

## Responsive Design Verification

| Breakpoint | Status | Notes |
|------------|--------|-------|
| Mobile (375px) | Partial — Blocker | No horizontal scroll. Progress bar scales to 178px wide. Chapter markers render but touch targets are 16x28px (below 44x44px minimum). Transcript tab and cues would be accessible via keyboard. |
| Tablet (768px) | Pass | No horizontal scroll. Course content sidebar correctly hidden (`display: none`). Chapter markers render at correct percentage positions. Progress bar scales to 571px. |
| Desktop (1440px) | Pass | Course content sidebar visible. All elements laid out correctly. Chapter marker tooltips appear on hover. Transcript panel scrolls within fixed-height card. |

---

## Recommendations

1. **Fix B1 before merge**: Add `min-w-[44px] min-h-[44px]` to the chapter marker button in `ChapterProgressBar.tsx`. This mirrors the pattern already used for bookmark markers in the same component and is a one-line fix.

2. **Fix H1 before merge**: Replace `style={{ height: '400px' }}` on the transcript container in `LessonPlayer.tsx:414` with Tailwind `h-[400px]`. Removes the inline-style violation without changing rendered output.

3. **Update sample VTT data (M1) soon**: Calibrate `public/captions/op6-introduction.vtt` cue boundaries and `operative-six.ts` chapter times against the actual video duration (144.45s / 2:24). This is a data quality issue that will confuse future developers and produce misleading test results.

4. **Document the single-track limitation (M2)**: Add a comment at `LessonPlayer.tsx:113` noting that `captions[0]` is intentionally constrained to the first track and flagging where a multi-track selector would be added in a future story.
