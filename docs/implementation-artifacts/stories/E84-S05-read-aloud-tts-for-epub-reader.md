# Story 84.5: Read-Aloud (TTS) for EPUB Reader

Status: backlog

## Story

As a learner,
I want to listen to the current chapter being read aloud,
so that I can consume books during activities like commuting where I can't hold the screen.

## Acceptance Criteria

1. **Given** the user has an EPUB book open in the reader **When** they click the "Read Aloud" button in the reader toolbar **Then** the browser's `speechSynthesis` API reads the visible page text aloud

2. **Given** TTS is active **When** the text is being spoken **Then** word-by-word highlighting follows along in the EPUB content using `SpeechSynthesisUtterance.onboundary` events

3. **Given** TTS is active **When** the user views the reader **Then** a TTS control bar appears with play/pause, stop, and speed controls (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)

4. **Given** TTS is playing **When** the user navigates to the next/previous page **Then** TTS pauses, the page turns, and TTS resumes reading from the start of the new page

5. **Given** TTS reaches the end of the visible page **When** all text has been spoken **Then** the reader auto-advances to the next page and TTS continues

6. **Given** the browser does not support `window.speechSynthesis` **When** the reader loads **Then** the "Read Aloud" button is hidden (no error shown)

7. **Given** TTS is active **When** the user closes the book or navigates away **Then** TTS stops and resources are cleaned up via `speechSynthesis.cancel()`

## Tasks / Subtasks

- [ ] Task 1: Create TTS service (AC: 1, 6, 7)
  - [ ] 1.1 Create `src/services/TtsService.ts`
  - [ ] 1.2 Implement `isTtsAvailable()` checking `window.speechSynthesis`
  - [ ] 1.3 Implement `speak(text, options)` with configurable rate
  - [ ] 1.4 Implement `pause()`, `resume()`, `stop()` controls
  - [ ] 1.5 Implement `onBoundary` callback for word highlighting
  - [ ] 1.6 Handle cleanup on unmount via `speechSynthesis.cancel()`

- [ ] Task 2: Extract visible page text from epub.js (AC: 1)
  - [ ] 2.1 Use `rendition.getContents()` to access the current page's DOM
  - [ ] 2.2 Extract text content via `textContent` property, preserving paragraph breaks
  - [ ] 2.3 Split text into sentences for better TTS pacing

- [ ] Task 3: Word-by-word highlighting (AC: 2)
  - [ ] 3.1 Map `SpeechSynthesisUtterance.onboundary` `charIndex` back to DOM nodes in the epub iframe
  - [ ] 3.2 Apply a temporary highlight class (`tts-active-word`) to the current word
  - [ ] 3.3 Remove highlight from previous word before highlighting next
  - [ ] 3.4 Auto-scroll within the page to keep the highlighted word visible

- [ ] Task 4: TTS control bar UI (AC: 3)
  - [ ] 4.1 Create `src/app/components/library/TtsControlBar.tsx`
  - [ ] 4.2 Use shadcn components: `Button` for play/pause/stop, `Select` for speed
  - [ ] 4.3 Position fixed at bottom of reader viewport
  - [ ] 4.4 Show current speed and a progress indicator (sentence N of M)
  - [ ] 4.5 Apply `variant="brand"` for the play button, `variant="ghost"` for stop

- [ ] Task 5: Page transition handling (AC: 4, 5)
  - [ ] 5.1 Listen for epub.js `relocated` event during TTS
  - [ ] 5.2 On manual page turn: pause TTS, extract new page text, resume
  - [ ] 5.3 On end-of-page: call `rendition.next()`, extract new page text, continue

## Dev Notes

### Web Speech API Considerations

- `speechSynthesis` is available in all modern browsers (Chrome, Firefox, Safari, Edge)
- Voice quality varies significantly by OS — macOS/iOS voices are generally better than Windows/Linux
- `speechSynthesis.getVoices()` returns available voices; prefer the default system voice
- The `onboundary` event fires with `charIndex` and `charLength` — this is the key for word highlighting
- Known issue: Chrome pauses `speechSynthesis` after ~15 seconds of continuous speech. Workaround: chunk text into sentence-length utterances and queue them sequentially

### Zero Bundle Cost

This feature uses only the native Web Speech API — **no new npm dependencies required**. The entire implementation is custom TypeScript code interfacing with browser APIs.

### Accessibility

- TTS control bar must be keyboard-accessible (Tab to focus, Space/Enter to activate)
- Announce TTS state changes via `aria-live="polite"` region
- Speed control must have an accessible label

### Dependencies on E84

- E84-S01 (epub.js integration) must be complete — needs `rendition` and `getContents()` APIs
- E84-S02 (page navigation) must be complete — needs `rendition.next()` and `relocated` event

### References

- [W3C EPUB TTS 1.0](https://www.w3.org/TR/epub-tts-10/)
- [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
- [MDN SpeechSynthesisUtterance.onboundary](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance/boundary_event)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
