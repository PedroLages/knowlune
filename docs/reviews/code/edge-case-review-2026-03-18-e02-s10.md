## Edge Case Review — E02-S10 (2026-03-18)

### Unhandled Edge Cases

**src/lib/captions.ts:27-32** — `parseTime receives string with 0 or 1 colon-separated parts`
> Consequence: NaN propagates into cue startTime/endTime, breaking track rendering
> Guard: `if (parts.length < 2) return 0`

**src/lib/captions.ts:97** — `User selects a multi-GB file with .srt/.vtt extension`
> Consequence: Browser tab freezes or OOMs reading huge file into string
> Guard: `if (file.size > 2 * 1024 * 1024) return { captionTrack: null, error: 'File too large (max 2MB)' }`

**src/lib/captions.ts:98** — `file.text() throws on unreadable or excessively large file`
> Consequence: Unhandled rejection crashes the caption load flow silently
> Guard: `try { const text = await file.text() } catch { return { captionTrack: null, error: 'Failed to read file' } }`

**src/lib/captions.ts:112** — `IndexedDB quota exceeded or Dexie write error on db.videoCaptions.put`
> Consequence: Unhandled promise rejection; user sees success toast but captions not persisted
> Guard: `try { await db.videoCaptions.put(record) } catch { return { captionTrack: null, error: 'Failed to save captions' } }`

**src/lib/captions.ts:80-89** — `SRT file has cue text that is purely numeric (e.g. '42') at end of file without trailing newline`
> Consequence: Numeric-only cue text lines stripped by sequence number removal regex
> Guard: `Use content-aware SRT parser that distinguishes sequence numbers by position, not just regex`

**src/app/pages/LessonPlayer.tsx:350** — `Dexie throws during getCaptionForVideo (corrupted DB, version mismatch)`
> Consequence: Unhandled promise rejection on every page load for that lesson
> Guard: `getCaptionForVideo(courseId, lessonId).then(...).catch(() => {})`

**src/app/pages/LessonPlayer.tsx:347-364** — `User navigates from lesson with persisted captions to lesson without`
> Consequence: Blob URL from previous lesson leaks; stale captions may display on new lesson
> Guard: `In cleanup: if (userCaptionBlobUrl.current) URL.revokeObjectURL(userCaptionBlobUrl.current); userCaptionBlobUrl.current = null; setUserCaptions(null)`

**src/app/pages/LessonPlayer.tsx:577** — `saveCaptionForVideo throws (file.text or Dexie error) inside handleLoadCaptions`
> Consequence: Unhandled rejection; no user feedback on unexpected failure
> Guard: `try { const result = await saveCaptionForVideo(...) } catch { toast.error('Failed to load captions'); return }`

**src/app/pages/ImportedLessonPlayer.tsx:109** — `Dexie throws during getCaptionForVideo on imported lesson mount`
> Consequence: Unhandled promise rejection on every imported lesson page load
> Guard: `getCaptionForVideo(courseId, lessonId).then(...).catch(() => {})`

**src/app/pages/ImportedLessonPlayer.tsx:93-120** — `Navigate between imported lessons — old lesson had captions, new one does not`
> Consequence: Stale captions from previous lesson display; blob URL leaked
> Guard: `Add else branch: setUserCaptions(null) and revoke old blob URL when no persisted track found`

**src/app/pages/ImportedLessonPlayer.tsx:133** — `saveCaptionForVideo throws inside handleLoadCaptions for imported lesson`
> Consequence: Unhandled rejection; no error feedback to user
> Guard: `try { const result = await saveCaptionForVideo(...) } catch { toast.error('Failed to load captions'); return }`

---
**Total:** 11 unhandled edge cases found.
