## Edge Case Review — E21-S02 (2026-03-24)

### Unhandled Edge Cases

**VideoPlayer.tsx:347 `stepPlaybackSpeed`** — `localStorage manually edited to a non-standard speed (e.g., "1.1")`
> Consequence: `PLAYBACK_SPEEDS.indexOf(playbackSpeed)` returns `-1`. The `down` branch hits `currentIndex <= 0` (true for -1), announcing "Already at minimum speed" even though the speed is 1.1x. The `up` branch reads `PLAYBACK_SPEEDS[-1 + 1]` which is `PLAYBACK_SPEEDS[0]` (0.5), jumping the user down to 0.5x instead of up. Both behaviors are silently wrong.
> Guard: `const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed); if (currentIndex === -1) { changePlaybackSpeed(1); return; }`

---

**VideoPlayer.tsx:131-134 `useState` initializer** — `localStorage contains unparseable value (e.g., "abc" or "")`
> Consequence: `parseFloat("abc")` returns `NaN`, which becomes the playbackSpeed state. `PLAYBACK_SPEEDS.indexOf(NaN)` is always `-1`, so `stepPlaybackSpeed` misbehaves as described above. Additionally, `video.playbackRate = NaN` may cause browser-specific undefined behavior.
> Guard: `const parsed = parseFloat(saved); return PLAYBACK_SPEEDS.includes(parsed) ? parsed : 1`

---

**LessonPlayer.tsx:498-508 `handleFocusNotes`** — `notes panel is open but activeTab is not "notes" (e.g., user switched to bookmarks/materials/transcript tab)`
> Consequence: `document.querySelector('[contenteditable="true"]')` finds no element (NoteEditor is not rendered when the notes TabsContent is inactive), so `editor?.focus()` silently does nothing. The user presses N and nothing visible happens.
> Guard: `setActiveTab('notes')` inside `handleFocusNotes` before attempting focus, ensuring the notes tab is active regardless of current tab state.

---

**LessonPlayer.tsx:512-520 `pendingNoteFocus` useEffect** — `requestAnimationFrame fires before NoteEditor/TipTap has fully initialized its contenteditable element`
> Consequence: The panel opens (React state update) but TipTap's contenteditable may not be in the DOM by the next animation frame, especially on slower devices or when the editor loads asynchronously. `document.querySelector('[contenteditable="true"]')` returns null, focus silently fails.
> Guard: `const tryFocus = (retries = 5) => { requestAnimationFrame(() => { const el = document.querySelector('[contenteditable="true"]') as HTMLElement; if (el) el.focus(); else if (retries > 0) tryFocus(retries - 1); }); }; tryFocus();`

---

**LessonPlayer.tsx:505,515 `document.querySelector('[contenteditable="true"]')`** — `page has multiple contenteditable elements (e.g., search palette, command palette, or future contenteditable widgets)`
> Consequence: The querySelector picks the first matching element in DOM order, which may not be the NoteEditor. Focus lands on the wrong element. Currently low risk (only TipTap uses contenteditable), but fragile as the app grows.
> Guard: `document.querySelector('[data-testid="note-editor"] [contenteditable="true"]')` or pass a ref from NoteEditor via `forwardRef`/`useImperativeHandle`.

---

**VideoPlayer.tsx:610 `onFocusNotes` in ImportedLessonPlayer** — `user presses N on the imported lesson player page`
> Consequence: `onFocusNotes` is not passed to VideoPlayer in ImportedLessonPlayer.tsx (line 211-218), so `onFocusNotes?.()` is a no-op. The user presses N and nothing happens with no feedback. Not a crash, but a silent failure that breaks user expectations if they use N on imported lessons.
> Guard: Either wire `onFocusNotes` in ImportedLessonPlayer or announce "Notes not available" when the callback is missing: `if (onFocusNotes) { onFocusNotes() } else { announce('Notes not available on this page') }`

---

**VideoPlayer.tsx:600-601 `containerRef.current?.focus()` after speed change** — `containerRef.current is null (component unmounted between keypress and handler execution)`
> Consequence: Optional chaining prevents a crash, but the focus call is skipped. In practice this is nearly impossible since the keydown handler is cleaned up on unmount, but during fast navigation (React Router transition mid-keypress), the ref could be stale.
> Guard: Acceptable risk — optional chaining already prevents the crash. No action needed.

---

**Total:** 7 unhandled edge cases found.
