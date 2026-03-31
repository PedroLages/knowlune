---
story_id: E91-S13
story_name: "Caption Customization"
status: in-progress
started: 2026-03-30
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 91.13: Caption Customization

## Story

As a learner who uses captions/subtitles,
I want to customize the font size and background opacity of captions,
so that I can read them comfortably regardless of my visual needs or the video content.

## Acceptance Criteria

- AC1: Given the VideoPlayer controls bar, when captions are loaded and enabled, then a caption settings button (gear icon next to the caption toggle) is visible.
- AC2: Given the caption settings popover, when opened, then it shows a font size selector with options: Small (14px), Medium (18px, default), Large (24px).
- AC3: Given a font size selection, when the user picks a size, then the caption text rendered by the `<track>` element immediately updates to that size.
- AC4: Given the caption settings popover, when opened, then it shows a background opacity slider with range 0% to 100% (default 80%).
- AC5: Given an opacity adjustment, when the user moves the slider, then the caption background opacity updates in real time.
- AC6: Given caption customization settings, when the user navigates to another lesson or restarts the app, then the settings are persisted (localStorage) and restored.
- AC7: Given caption customization, when viewed on mobile, then the settings are accessible via the same popover/sheet.

**Note:** YouTube videos use YouTube's built-in caption controls; this customization applies to local video captions only.

## Tasks / Subtasks

- [ ] Task 1: Add localStorage keys and defaults (AC: 6)
  - [ ] 1.1 `STORAGE_KEY_CAPTION_FONT_SIZE = 'video-caption-font-size'` with default `'medium'`
  - [ ] 1.2 `STORAGE_KEY_CAPTION_BG_OPACITY = 'video-caption-bg-opacity'` with default `80`
  - [ ] 1.3 Load from localStorage in VideoPlayer initialization (same pattern as `STORAGE_KEY_CAPTIONS_ENABLED` at line 68)
- [ ] Task 2: Create `CaptionSettingsPopover` component (AC: 1, 2, 4)
  - [ ] 2.1 Create inline within `VideoPlayer.tsx` or as separate component in `src/app/components/figma/CaptionSettingsPopover.tsx`
  - [ ] 2.2 Font size: 3 radio buttons or segmented control — Small / Medium / Large
  - [ ] 2.3 Background opacity: `<Slider>` component from shadcn/ui (range 0-100, step 5)
  - [ ] 2.4 Trigger: Settings icon button next to caption toggle, only visible when captions are active
- [ ] Task 3: Apply caption font size via `::cue` CSS (AC: 3)
  - [ ] 3.1 Use CSS custom property `--caption-font-size` on the video container
  - [ ] 3.2 Add `video::cue { font-size: var(--caption-font-size, 18px); }` to global styles or scoped CSS
  - [ ] 3.3 Map sizes: Small=14px, Medium=18px, Large=24px
  - [ ] 3.4 Update CSS custom property when user changes size
- [ ] Task 4: Apply caption background opacity via `::cue` CSS (AC: 5)
  - [ ] 4.1 Use `video::cue { background-color: rgba(0, 0, 0, var(--caption-bg-opacity, 0.8)); }`
  - [ ] 4.2 Update CSS custom property when user moves slider
- [ ] Task 5: Persist settings to localStorage (AC: 6)
  - [ ] 5.1 On font size change: `localStorage.setItem(STORAGE_KEY_CAPTION_FONT_SIZE, size)`
  - [ ] 5.2 On opacity change: `localStorage.setItem(STORAGE_KEY_CAPTION_BG_OPACITY, String(opacity))`
- [ ] Task 6: Wire into VideoPlayer controls (AC: 1, 7)
  - [ ] 6.1 Add settings button next to caption toggle (line 1253 area)
  - [ ] 6.2 Only visible when `captionsEnabled && captions?.length > 0`
  - [ ] 6.3 Use `<Popover>` for desktop, same for mobile (Popover works on mobile in this context)
- [ ] Task 7: E2E tests
  - [ ] 7.1 Captions enabled → settings button visible
  - [ ] 7.2 Change font size → caption text size changes
  - [ ] 7.3 Change opacity → caption background changes
  - [ ] 7.4 Navigate to another lesson → settings preserved
  - [ ] 7.5 Captions disabled → settings button hidden

## Design Guidance

- Settings button: icon-only `variant="ghost"` with `Settings2` icon from lucide-react, `size-11` to match control bar buttons
- Popover: `w-64 p-4 space-y-4` with `bg-popover` background
- Font size selector: 3 buttons in a row with `data-active` state: `rounded-lg px-3 py-1.5 text-xs`
- Opacity slider: shadcn `<Slider>` component, `<label className="text-xs text-muted-foreground">`
- Position: next to the existing caption toggle button in the controls bar

## Implementation Notes

- The `::cue` pseudo-element controls caption styling. Browser support: Chrome, Firefox, Safari all support `font-size` and `background-color` on `::cue`.
- The VideoPlayer component is at `src/app/components/figma/VideoPlayer.tsx`. It already has `captionsEnabled` state and `STORAGE_KEY_CAPTIONS_ENABLED` localStorage key (line 68).
- The `<Slider>` component exists at `src/app/components/ui/slider.tsx`.
- For YouTube videos: YouTube's iframe player manages its own captions. This story applies ONLY to local video captions.
- The `LocalVideoContent.tsx` (line 270) passes `captions` to `VideoPlayer`. The `YouTubeVideoContent.tsx` does NOT use captions through VideoPlayer.

## Dependencies

None — can be implemented independently. Benefits from E91-S05 (Chapter Markers) being done first since both touch VideoPlayer.

## Testing Notes

- Load a `.srt` or `.vtt` file via the caption file picker, enable captions, then test customization
- Verify `::cue` styling works cross-browser (may need `-webkit-media-text-track-display` fallback)
- Test with prefers-reduced-motion: ensure opacity slider doesn't trigger animations
