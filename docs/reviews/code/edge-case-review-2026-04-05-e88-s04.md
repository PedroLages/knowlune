## Edge Case Review — E88-S04 (2026-04-05)

### Unhandled Edge Cases

**[M4bParserService.ts:32]** — `parseBlob(file)` with 0-byte file
> Consequence: `music-metadata` may throw an unexpected error or return undefined duration
> Guard: `if (file.size === 0) throw new Error('Empty file')`

**[M4bParserService.ts:37]** — `metadata.format.duration` is `undefined` or `NaN`
> Consequence: `totalDuration` becomes `0`, which is used for single-chapter fallback but could cause division-by-zero in downstream duration calculations
> Guard: `const totalDuration = Number(metadata.format.duration) || 0; if (totalDuration <= 0) console.warn('M4B duration unavailable')`

**[AudiobookImportFlow.tsx:175]** — `crypto.randomUUID()` availability in HTTP context
> Consequence: In non-secure contexts (HTTP, not HTTPS), `crypto.randomUUID()` throws. This is pre-existing across the app, not specific to E88-S04.
> Guard: Already handled by existing app infrastructure (localhost is secure context)

**[useAudioPlayer.ts:429]** — `audio.duration` is `NaN` or `Infinity` for M4B
> Consequence: `Math.min(audio.currentTime + seconds, NaN)` returns `NaN`, causing seek to fail silently
> Guard: `const maxTime = isFinite(audio.duration) ? audio.duration : Infinity`

**[useAudioPlayer.ts:304]** — Seeking to `startTime` before audio metadata loaded
> Consequence: If `audio.readyState < 1` when seeking (after the initial load), setting `currentTime` may be ignored by the browser
> Guard: The code already waits for `loadedmetadata` event before seeking (lines 276-294), so this is handled for the initial load. Subsequent chapter switches within the same file do not re-verify readyState.

---
**Total:** 5 unhandled edge cases found (2 HIGH, 3 LOW).
