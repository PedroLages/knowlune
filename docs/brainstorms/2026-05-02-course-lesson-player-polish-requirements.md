---
date: 2026-05-02
topic: course-lesson-player-polish
---

# Course Lesson Player Polish

## Problem Frame

The lesson player was recently refactored (toolbar merged into Layout header, `useLessonChromeStore` introduced), which regressed several UX flows. Additionally, several long-standing polish gaps in the lesson completion and playback experience need to be addressed. Affects all users taking courses with video or PDF lessons.

## Requirements

### Completion Flow

- **R1.** The completion celebration modal must appear as an overlay in theater mode, identical to normal mode. Currently the modal is hidden behind or obscured by the full-height video container when `data-theater-mode` is active (z-index conflict).
- **R2.** The player sidebar (`LessonsTab`) must show completion status for each lesson: a green `CheckCircle2` icon replacing the index number, with a strikethrough on the title text, matching the style already used in `LessonList` on the CourseOverview page. Applies to both video and PDF lesson types.
- **R3.** Companion PDFs (matched as materials to a video lesson) must be rendered as clickable sub-rows in the sidebar underneath their parent video. Currently `MaterialGroupRow` only renders the `primary` lesson and shows a material count badge — the actual PDF lessons are invisible and unnavigable from the sidebar. Each PDF sub-row must show its type icon (`FileText`), title, and completion status.
- **R3.** Companion PDFs (matched as materials to a video lesson) must be rendered as clickable sub-rows in the sidebar underneath their parent video. Currently `MaterialGroupRow` only renders the `primary` lesson and shows a material count badge — the actual PDF lessons are invisible and unnavigable from the sidebar. Each PDF sub-row must show its type icon (`FileText`), title, and completion status.

### Auto-Play

- **R4.** When auto-advance navigates to the next lesson, the video must start playing automatically (auto-play). Currently only navigation happens; the user must manually press play.
- **R5.** An auto-play toggle must be visible in the player UI (adjacent to existing playback controls or in the header). When off, auto-advance still navigates but does not auto-play.
- **R6.** The auto-play preference must persist across sessions (localStorage or settings store), defaulting to `true` (on).

### Transcript & AI Summary

- **R7.** When no transcript exists for a lesson, the Transcript tab must show a "Generate Transcript" button instead of a static empty state. The button triggers transcription via the existing Whisper infrastructure (`src/lib/whisper.ts`, with Speaches self-hosted provider).
- **R8.** When transcript generation completes, the Transcript tab automatically refreshes to show the new transcript, and the AI Summary tab becomes functional (or appears if it was hidden).

### Header Layout & AI Chat Accessibility (Regression Fix)

- **R9.** The `QAChatPanel` (AI chat) must be accessible on all screen sizes. Currently it is only rendered inline at `lg:` (≥1024px) and is absent from the tablet kebab menu. Root cause on desktop: the centered search bar competes for horizontal space with right-side header tools; at 100% browser zoom on common desktop widths, the LessonHeaderTools (including QAChatPanel, PomodoroTimer, theater/reading toggles) overflow or get clipped.
- **R10.** Add `QAChatPanel` to the tablet kebab menu (md–lg range) so it is reachable on medium screens.
- **R11.** On lesson pages, reposition the search bar to the left side of the header (replacing or adjacent to the back-to-course link) to free horizontal space for the right-side lesson tools. The search bar must not overlap with the right-side header tools at any viewport width.

### Note Link Suggestions (Intrusive Pop-Up Fix)

- **R12.** The "Note connection found" toast must not fire on every auto-save while the user is actively typing. Replace the intrusive Sonner toast with a subtle inline indicator (e.g., a badge near the note) that shows "N related notes found" — the user can click to explore link suggestions at their convenience rather than being interrupted mid-typing.

### Verification

- **V1.** When a lesson is manually marked complete via the header dropdown, the celebration modal and auto-advance countdown must still trigger (this already works — verify it is not broken by recent refactors).

## Success Criteria

- Completing a lesson in theater mode shows the confetti celebration modal on top of the video
- Completed lessons show a green checkmark with strikethrough in the player sidebar, updating immediately
- Companion PDFs appear as clickable sub-rows under their parent video in the sidebar, with FileText icon and completion status
- After auto-advance countdown, the next lesson loads and begins playing without user interaction
- Auto-play toggle is visible and its state survives page reload
- Lessons without transcripts offer a one-click "Generate Transcript" action that produces a usable transcript
- The AI chat button is reachable on viewports from 375px through desktop at 100% browser zoom
- On lesson pages, all right-side header tools are visible without horizontal overflow at standard desktop widths

## Scope Boundaries

- No redesign of the video player chrome or layout — incremental fixes only
- No auto-generation of transcripts on import (manual on-demand only)
- No changes to PDF viewer or reading mode
- No server-side transcript storage changes (existing Dexie + VTT flow remains)
- The theater mode keyboard shortcut (`T`) and behavior are otherwise unchanged

## Key Decisions

- **Modal over fullscreen (not minimal toast):** The celebration modal should appear consistently regardless of view mode; z-index fix rather than UX change.
- **Checkmark + strikethrough in sidebar:** Reuse the `LessonList` completion display pattern from CourseOverview for consistency.
- **Auto-play as default-on:** Auto-play defaults to `true` (on) with a visible toggle and persistent preference, matching YouTube/Udemy convention.
- **On-demand transcript generation:** Leverage existing Whisper/Speaches infrastructure rather than building new ingestion pipeline. Generate button in the Transcript tab empty state.
- **Polish, not redesign:** Keep changes scoped to fixes and small enhancements; defer broader video page redesign.

## Dependencies / Assumptions

- Speaches Whisper server is available and configured (user's Unraid instance)
- `VideoPlayer` component's `autoplay` prop works when set to `true` (already tested in preview surfaces)
- The completion modal z-index issue is a CSS stacking context problem in `data-theater-mode`, not a React portal issue

## Outstanding Questions

### Resolve Before Planning

- ~~What is the "pop-up" that appears when writing notes?~~ Resolved: identified as `triggerNoteLinkSuggestions` firing on every auto-save. Captured as R12.

### Deferred to Planning

- [Affects R1] Technical: Is the completion modal z-index conflict caused by the `h-[calc(100svh-1rem)]` container creating a new stacking context, or by a CSS rule targeting `data-theater-mode` that hides overlays?
- [Affects R2] Technical: Should the sidebar checkmark reuse the `useContentProgressStore` directly, or receive status via props from `UnifiedLessonPlayer`?
- [Affects R3] Technical: How should companion PDF sub-rows be indented/styled to distinguish them from primary lesson rows? Should they be collapsible under the parent video?
- [Affects R7] Technical: What is the exact Whisper API call flow from the browser? Does it go through a proxy or directly to the Speaches endpoint?
- [Affects R9] Technical: Should QAChatPanel also be added to the mobile BottomNav, or is the kebab menu sufficient for the md breakpoint?
- [Affects R11] Technical: What is the target left-side layout — search bar replacing the back link entirely, search bar inline with back link, or a collapsible search that expands on click?
- [Affects R11] Technical: Should the search repositioning apply only to lesson pages (`isLessonRoute`) or globally across all routes?
- [Affects R12] Technical: Where should the inline "N related notes" indicator be placed — inside the NotesTab near the note editor, or in the header/bottom bar?

## Next Steps

-> All outstanding questions resolved. Ready for `/ce:plan` for structured implementation planning.
