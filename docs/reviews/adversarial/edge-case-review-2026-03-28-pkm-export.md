# Edge Case Review: E53 — PKM Export Phase 1 (Markdown + Anki .apkg)

**Date:** 2026-03-28
**Reviewer:** Claude (Edge Case Hunter)
**Stories Reviewed:** E53-S01, E53-S02, E53-S03
**Total Findings:** 44

---

## Summary

The E53 PKM Export epic has solid happy-path coverage but significant gaps in defensive handling across YAML safety, Unicode/encoding, large dataset performance, browser compatibility, and third-party package resilience. The most critical issues are: WASM loading in production builds (Anki export silently failing), YAML injection through unsanitized content, and memory exhaustion on large exports.

**Severity Distribution:**
- HIGH: 14
- MEDIUM: 20
- LOW: 10

---

## 1. Anki .apkg Format Edge Cases

### 1.1 sql.js WASM binary missing in production build
- **Story:** E53-S02, Task 3.2
- **Scenario:** `sql.js` (dependency of `anki-apkg-export`) requires a `.wasm` file at runtime. Vite does not automatically copy WASM binaries to `dist/`. Works in dev (node_modules resolution) but fails silently in production.
- **Likelihood:** HIGH (will happen on first prod build)
- **Impact:** Anki export completely broken in production
- **Severity:** HIGH
- **Mitigation:** Configure `vite.config.ts` `optimizeDeps.exclude: ['sql.js']` or copy the WASM file to `public/`. Test with `npm run build && npx serve dist` before merging.

### 1.2 Dynamic import() failure with no fallback
- **Story:** E53-S02, Task 3.2
- **Scenario:** `import('anki-apkg-export')` fails due to network error, CSP block, or missing chunk. The outer try/catch in S03 catches it, but the error message ("Export failed -- try freeing disk space") is misleading.
- **Likelihood:** MEDIUM
- **Impact:** User gets wrong guidance; cannot self-resolve
- **Severity:** HIGH
- **Mitigation:** Wrap dynamic import in its own try/catch: `catch (e) { throw new Error('Anki export module failed to load. Try refreshing the page.') }`. Differentiate from data errors.

### 1.3 Field separator conflict in card content
- **Story:** E53-S02, Task 3.6
- **Scenario:** Flashcard front/back contains tab characters (`\t`) or unit separator (`\x1f`) which `anki-apkg-export` may use internally as field delimiters.
- **Likelihood:** LOW (rare in user content)
- **Impact:** Card front/back fields split incorrectly in Anki
- **Severity:** MEDIUM
- **Mitigation:** Sanitize before `addCard()`: `front.replace(/[\t\x1f]/g, ' ')`

### 1.4 UTF-8 encoding with emojis and CJK characters
- **Story:** E53-S02, Task 3.6
- **Scenario:** Flashcard content contains emojis or CJK characters. `anki-apkg-export` generates SQLite via `sql.js` -- encoding depends on how the package writes text to the database.
- **Likelihood:** MEDIUM (common for language learners)
- **Impact:** Mojibake or corrupt cards in Anki
- **Severity:** HIGH
- **Mitigation:** Manual verification required (Task 4). Add test with emoji content and CJK characters during manual Anki desktop import test. Document any encoding issues found.

### 1.5 HTML content passed directly to Anki cards
- **Story:** E53-S02, Task 3.6
- **Scenario:** Flashcard `front`/`back` fields may contain HTML from Tiptap editor. `anki-apkg-export.addCard()` likely expects plain text or basic HTML. Raw Tiptap HTML with custom attributes would render as garbage in Anki.
- **Likelihood:** HIGH (flashcards derived from notes will have HTML)
- **Impact:** Unreadable cards in Anki
- **Severity:** HIGH
- **Mitigation:** Apply `extractTextFromHtml()` (from `noteExport.ts`) to `front` and `back` before calling `addCard()`. Or use `htmlToMarkdown()` if Anki supports basic HTML.

### 1.6 anki-apkg-export package maintenance concern
- **Story:** E53-S02, Implementation Notes
- **Scenario:** The `anki-apkg-export` npm package was last published ~2019. May have unpatched vulnerabilities, incompatibility with modern browser APIs, or break with newer sql.js versions.
- **Likelihood:** MEDIUM
- **Impact:** Export breaks on browser updates; no upstream fix available
- **Severity:** HIGH
- **Mitigation:** Pin exact version. Implement CSV fallback export (front, back, tags columns) as documented in the story's risk section. Consider forking if critical bugs found.

---

## 2. YAML Frontmatter Safety

### 2.1 Flashcard front/back text in Q/A heading breaks YAML-adjacent content
- **Story:** E53-S01, AC1
- **Scenario:** Flashcard front contains YAML-breaking characters: colons (`What is this: a test`), quotes, newlines, pipe characters, hash marks. If written as `# Q: What is this: a test`, the YAML parser won't break (it's in body), but if any of this appears in frontmatter fields it will.
- **Likelihood:** HIGH (colons are common in questions)
- **Impact:** Obsidian fails to parse note metadata
- **Severity:** HIGH
- **Mitigation:** Wrap all YAML string values in double quotes and escape internal quotes (pattern exists in `noteExport.ts:generateBulkFrontmatter`). Verify this pattern is replicated for flashcard and bookmark frontmatter.

### 2.2 Note tags with special YAML characters
- **Story:** E53-S01, Task 1.1
- **Scenario:** Tags like `c++`, `q&a`, `node:crypto`, or tags containing brackets/quotes would break YAML array syntax if not properly quoted.
- **Likelihood:** MEDIUM
- **Impact:** YAML parse failure in Obsidian
- **Severity:** MEDIUM
- **Mitigation:** Quote each tag in the YAML array: `tags: ["c++", "q&a"]` -- the existing `noteExport.ts` pattern does this, but verify `deriveFlashcardTags` output is also quoted.

### 2.3 Course/lesson names with colons or quotes
- **Story:** E53-S01, Task 2.3; E53-S01, AC5
- **Scenario:** Course named `C++: Advanced Topics` or `He said "hello"` -- these break YAML if not properly escaped in frontmatter.
- **Likelihood:** HIGH (course names often contain colons)
- **Impact:** Corrupted YAML frontmatter
- **Severity:** HIGH
- **Mitigation:** Apply the same `courseName.replace(/"/g, '\\"')` escaping from `noteExport.ts`. Wrap in double quotes.

### 2.4 Missing course/lesson names (null/undefined)
- **Story:** E53-S01, Task 1.2, Task 2.2
- **Scenario:** Flashcard/bookmark references a `courseId` for a deleted course. `courseMap.get(courseId)` returns `undefined`. Written as `course: "undefined"` in YAML.
- **Likelihood:** MEDIUM (orphaned data after course deletion)
- **Impact:** Misleading metadata in exported files
- **Severity:** MEDIUM
- **Mitigation:** Fallback: `courseMap.get(courseId) || 'Unknown Course'` (pattern already in `exportService.ts:268`). Verify reuse.

### 2.5 Flashcard createdAt/updatedAt undefined or invalid
- **Story:** E53-S01, AC1
- **Scenario:** If `createdAt` is somehow undefined (data migration issue), YAML would contain `created: "undefined"`.
- **Likelihood:** LOW
- **Impact:** Broken date queries in Obsidian
- **Severity:** LOW
- **Mitigation:** `const created = flashcard.createdAt || new Date().toISOString()`

---

## 3. Large Exports

### 3.1 JSZip memory exhaustion on 1000+ files
- **Story:** E53-S03, Task 3.5 (via `fileDownload.ts:downloadZip`)
- **Scenario:** User has 1000+ notes, 500+ flashcards. JSZip holds all file content in memory simultaneously during `generateAsync()`. With notes containing base64 images, total memory could exceed 500MB.
- **Likelihood:** MEDIUM (power users)
- **Impact:** Browser tab crashes with no error feedback
- **Severity:** HIGH
- **Mitigation:** Use `zip.generateAsync({ type: 'blob', streamFiles: true })` for streaming. Add cumulative size tracking; warn at 200MB, abort at 500MB with user-facing message.

### 3.2 Browser blob URL size limits
- **Story:** E53-S03, Task 3.5
- **Scenario:** Safari has historically limited blob URLs to ~500MB. Chrome limits vary by available memory. Very large ZIPs may fail to trigger download.
- **Likelihood:** LOW (extreme case)
- **Impact:** Download fails silently
- **Severity:** MEDIUM
- **Mitigation:** Wrap `downloadBlob()` in try/catch. If blob creation fails, suggest exporting in smaller batches.

### 3.3 Progress callback inaccuracy with empty sub-exporters
- **Story:** E53-S03, Task 1.2
- **Scenario:** Notes exporter has 1000 items (40% weight), flashcards has 0 (40% weight), bookmarks has 50 (20% weight). Progress jumps from 40% to 80% instantly, then slowly crawls to 100%.
- **Likelihood:** HIGH (common to have uneven data)
- **Impact:** Confusing UX -- progress bar appears stuck or jumps
- **Severity:** LOW
- **Mitigation:** Dynamically reweight based on item counts: if a sub-exporter returns 0 items, redistribute its weight to others.

### 3.4 Main thread blocking during ZIP generation
- **Story:** E53-S03 (via `fileDownload.ts:downloadZip`)
- **Scenario:** `zip.generateAsync()` still runs significant CPU work on the main thread despite being async. With 1000+ files, UI freezes for several seconds.
- **Likelihood:** MEDIUM
- **Impact:** App appears unresponsive; user may close tab
- **Severity:** MEDIUM
- **Mitigation:** Pass `onUpdate` callback to `generateAsync` for progress. Consider Web Worker for ZIP generation if performance profiling shows >2s freeze.

---

## 4. HTML Edge Cases in Turndown Conversion

### 4.1 Base64 data URI images bloat markdown files
- **Story:** E53-S01 (via `noteExport.ts:htmlToMarkdown`)
- **Scenario:** Notes with embedded images from Tiptap contain base64 data URIs (`<img src="data:image/png;base64,...">` potentially megabytes each). Turndown converts these to markdown image syntax, preserving the full base64 string.
- **Likelihood:** MEDIUM (users paste screenshots)
- **Impact:** Individual markdown files become multi-MB; ZIP bloats significantly
- **Severity:** HIGH
- **Mitigation:** Add Turndown rule to either strip base64 images or extract them as separate files in the ZIP with relative path references.

### 4.2 HTML tables not converted to markdown
- **Story:** E53-S01 (via `noteExport.ts:htmlToMarkdown`)
- **Scenario:** Tiptap supports tables. Turndown has no built-in table support -- tables are output as raw HTML within the markdown.
- **Likelihood:** MEDIUM (tables are a common Tiptap feature)
- **Impact:** Tables show as HTML in Obsidian rather than rendered tables
- **Severity:** MEDIUM
- **Mitigation:** Install `turndown-plugin-gfm` and register the tables plugin: `turndownService.use(gfm.tables)`.

### 4.3 Deeply nested HTML (10+ levels)
- **Story:** E53-S01 (via `noteExport.ts:htmlToMarkdown`)
- **Scenario:** Content pasted from external sources may have excessive nesting. Turndown produces deeply indented markdown.
- **Likelihood:** LOW
- **Impact:** Unreadable markdown with extreme indentation
- **Severity:** LOW
- **Mitigation:** Accept as cosmetic issue. Optionally flatten nesting beyond 5 levels.

### 4.4 Empty content notes
- **Story:** E53-S01 (via `noteExport.ts:htmlToMarkdown`)
- **Scenario:** Note with `content: ""` or `content: "<p></p>"`. Turndown returns empty string. File contains only YAML frontmatter.
- **Likelihood:** MEDIUM
- **Impact:** Empty markdown file in export -- minor
- **Severity:** LOW
- **Mitigation:** Filter out empty-content notes from export, or add `(empty note)` placeholder text.

### 4.5 Code blocks containing backticks
- **Story:** E53-S01 (via `noteExport.ts:htmlToMarkdown`)
- **Scenario:** Code block content contains triple backticks. Turndown's fenced code block conversion may not escape inner backticks correctly.
- **Likelihood:** LOW (programming content)
- **Impact:** Broken code fences in markdown
- **Severity:** MEDIUM
- **Mitigation:** Test with content containing backticks in code blocks. Turndown should handle this by using more backticks for the fence (````), but verify.

---

## 5. Flashcard SRS Metadata

### 5.1 NaN or negative interval/easeFactor
- **Story:** E53-S01, Task 1.6
- **Scenario:** Corrupted IndexedDB data: `interval: -5`, `easeFactor: NaN`, or `reviewCount: Infinity`.
- **Likelihood:** LOW (data corruption)
- **Impact:** Invalid numbers in YAML frontmatter
- **Severity:** MEDIUM
- **Mitigation:** Sanitize before writing: `const safeInterval = Number.isFinite(fc.interval) && fc.interval >= 0 ? fc.interval : 0; const safeEase = Number.isFinite(fc.easeFactor) ? fc.easeFactor : 2.5;`

### 5.2 reviewedAt undefined written as string
- **Story:** E53-S01, AC4
- **Scenario:** AC4 specifically addresses this -- `reviewedAt: undefined` should omit the YAML line. But implementation could still write `reviewed_at: ""` or `reviewed_at: "undefined"` if the omission logic has an off-by-one.
- **Likelihood:** LOW (AC4 explicitly addresses it)
- **Impact:** Misleading metadata
- **Severity:** LOW
- **Mitigation:** Unit test: verify flashcard with `reviewedAt: undefined` produces YAML without `reviewed_at` line at all.

### 5.3 Very large reviewCount values
- **Story:** E53-S01, Task 1.6
- **Scenario:** `reviewCount: 999999999` from data corruption. Written to YAML as-is.
- **Likelihood:** LOW
- **Impact:** Minor -- misleading metadata
- **Severity:** LOW
- **Mitigation:** Cap at reasonable maximum: `Math.min(fc.reviewCount, 100000)` or leave uncapped and document as-is.

---

## 6. File Naming Collisions

### 6.1 Two flashcards with identical front text in same course
- **Story:** E53-S01, Task 1.4
- **Scenario:** Two flashcards both titled "What is React?" in the same course produce identical filenames.
- **Likelihood:** HIGH (common for iterative flashcards)
- **Impact:** Second file overwrites first in ZIP -- data loss
- **Severity:** HIGH
- **Mitigation:** Task 1.4 specifies counter suffix dedup. Verify implementation uses `usedFilenames` Set scoped per course folder (not global), matching the pattern in `exportService.ts:264-287`.

### 6.2 Two courses with identical names
- **Story:** E53-S03, AC2
- **Scenario:** User imports two courses both named "React Mastery". Both flashcard folders would be `flashcards/react-mastery/`.
- **Likelihood:** LOW (but possible with re-imports)
- **Impact:** Files from different courses mixed together
- **Severity:** MEDIUM
- **Mitigation:** Append course ID suffix if folder name collides: `flashcards/react-mastery-a1b2/`.

### 6.3 Sanitized filename is empty string
- **Story:** E53-S01, Task 1.3
- **Scenario:** Flashcard front text is entirely special characters (e.g., `???!!!`) -- `sanitizeFilename()` returns empty string after stripping all chars.
- **Likelihood:** LOW
- **Impact:** Empty filename causes OS/ZIP errors
- **Severity:** MEDIUM
- **Mitigation:** Fallback: `if (!baseName) baseName = 'flashcard-' + flashcard.id.slice(0, 8)` (pattern from `exportService.ts:279`).

### 6.4 Course name kebab-case produces empty string
- **Story:** E53-S01, Task 1.1
- **Scenario:** Course name is entirely non-alphanumeric characters. Kebab-case conversion yields empty string. Folder path becomes `flashcards//`.
- **Likelihood:** LOW
- **Impact:** Invalid folder path in ZIP
- **Severity:** MEDIUM
- **Mitigation:** `const courseSlug = kebabCase(courseName) || 'unknown-course'`

---

## 7. Browser Download Compatibility

### 7.1 iOS Safari blob download restriction
- **Story:** E53-S03, Task 4.4 (via `fileDownload.ts:downloadBlob`)
- **Scenario:** iOS Safari does not support programmatic file downloads via anchor click + blob URL for all file types. ZIP and .apkg downloads may silently fail or open in a new tab instead of downloading.
- **Likelihood:** HIGH (for iOS users)
- **Impact:** Export appears to work but user receives nothing
- **Severity:** HIGH
- **Mitigation:** Detect iOS Safari and use `window.open(blobUrl)` fallback, or integrate FileSaver.js which handles cross-browser download quirks. At minimum, show a warning toast on iOS.

### 7.2 Firefox memory handling for large blobs
- **Story:** E53-S03
- **Scenario:** Firefox has different memory management for blob URLs. Very large blobs may trigger "out of memory" errors that are not caught by the standard try/catch around export logic.
- **Likelihood:** LOW
- **Impact:** Tab crash with no recovery
- **Severity:** LOW
- **Mitigation:** Accept as edge case. The size-limit mitigation from 3.1 covers this.

---

## 8. Empty States

### 8.1 PKM export with zero content downloads ZIP with only README
- **Story:** E53-S03, Task 3.4
- **Scenario:** All three sub-exporters return empty arrays. `exportPkmBundle` still generates `README.md`. `files.length` is 1 (the README), so the `=== 0` check passes and user downloads a ZIP with only a README.
- **Likelihood:** MEDIUM (new user clicks export before creating content)
- **Impact:** Confusing -- user gets a ZIP but it's essentially empty
- **Severity:** MEDIUM
- **Mitigation:** Check content file count (excluding README): `if (contentFiles.length === 0) { toast('No learning data to export'); return; }`. Only add README when there are actual content files.

### 8.2 Anki export with zero flashcards -- already handled
- **Story:** E53-S02, AC4
- **Scenario:** Returns `null`, caller shows toast.
- **Likelihood:** N/A
- **Impact:** N/A
- **Severity:** Handled (AC4 + S03 AC6)

### 8.3 Export for course with no content in PKM bundle
- **Story:** E53-S03
- **Scenario:** User has notes but zero flashcards and zero bookmarks. The `flashcards/` and `bookmarks/` folders are absent from ZIP. Not an error, but README file counts show "0 flashcards, 0 bookmarks".
- **Likelihood:** HIGH (many users won't use all features)
- **Impact:** Minor -- README mentions missing sections
- **Severity:** LOW
- **Mitigation:** README should only list sections that have content, or clarify "0 files" means "none created yet".

---

## 9. anki-apkg-export Package Risks

### 9.1 Package size impact on bundle
- **Story:** E53-S02, AC5
- **Scenario:** `anki-apkg-export` bundles `sql.js` (~500KB gzipped). Dynamic import keeps it off the initial bundle, but it's downloaded on first Anki export click.
- **Likelihood:** HIGH (will happen)
- **Impact:** 500KB+ download on first export -- slow on poor connections
- **Severity:** LOW
- **Mitigation:** Show loading indicator during dynamic import. AC5 already specifies dynamic import, which is correct.

### 9.2 sql.js WASM initialization race condition
- **Story:** E53-S02, Task 3.2
- **Scenario:** If user clicks Anki export twice quickly, two dynamic imports may race to initialize sql.js WASM, potentially causing conflicts.
- **Likelihood:** LOW (guarded by `isExporting` in S03)
- **Impact:** Corrupt .apkg generation
- **Severity:** LOW
- **Mitigation:** The `isExporting` guard in S03 prevents this. Verify the ref-based guard (see 10.1) is also in place.

---

## 10. Bookmark Timestamp Context

### 10.1 Bookmark referencing deleted video
- **Story:** E53-S01, Task 2.2
- **Scenario:** Bookmark has `lessonId` pointing to a video that was deleted. Video name lookup returns `undefined`.
- **Likelihood:** MEDIUM (after course re-imports)
- **Impact:** Heading shows `undefined` or empty in markdown
- **Severity:** MEDIUM
- **Mitigation:** `videoMap.get(bookmark.lessonId)?.title || 'Untitled Video'`

### 10.2 Bookmark with timestamp=0
- **Story:** E53-S01, Task 2.1
- **Scenario:** Bookmark at the very start of a video. `formatTimestamp(0)` must return `"0:00"`, not empty string or `"0"`.
- **Likelihood:** HIGH (common to bookmark video start)
- **Impact:** Missing or incorrect timestamp display
- **Severity:** MEDIUM
- **Mitigation:** Verify `formatTimestamp(0) === "0:00"` in unit tests. The testing notes mention this case but it's not in the acceptance criteria.

### 10.3 Bookmark with empty or undefined label
- **Story:** E53-S01, Task 2.2
- **Scenario:** `label` field is empty string. The `VideoBookmark` type specifies `label: string` (required), but user may save without entering text.
- **Likelihood:** MEDIUM
- **Impact:** Empty bullet point in markdown -- no context
- **Severity:** LOW
- **Mitigation:** `const label = bookmark.label?.trim() || '(no label)'`

---

## 11. Cross-Cutting Concerns

### 11.1 Double-click race condition on export buttons
- **Story:** E53-S03, AC4
- **Scenario:** User double-clicks export button. React state update (`setIsExporting(true)`) may not propagate before second click handler fires due to batching.
- **Likelihood:** MEDIUM
- **Impact:** Two concurrent exports -- duplicate downloads, corrupted state
- **Severity:** MEDIUM
- **Mitigation:** Use `useRef` in addition to state: `const exportingRef = useRef(false); if (exportingRef.current) return; exportingRef.current = true;`

### 11.2 Partial failure in PKM bundle (one sub-exporter throws)
- **Story:** E53-S03, Task 1.2
- **Scenario:** `exportFlashcardsAsMarkdown()` throws an error, but notes and bookmarks exported successfully. The entire PKM export fails, losing all partial results.
- **Likelihood:** LOW
- **Impact:** All-or-nothing failure when partial export would be useful
- **Severity:** MEDIUM
- **Mitigation:** Wrap each sub-exporter in individual try/catch. Collect partial results. Append warning to README: "Warning: Flashcard export failed -- other data included."

### 11.3 Misleading error toast message
- **Story:** E53-S03, AC7
- **Scenario:** Export fails due to IndexedDB read error. Toast says "Export failed -- try freeing disk space" which is incorrect guidance.
- **Likelihood:** MEDIUM
- **Impact:** User takes wrong corrective action
- **Severity:** LOW
- **Mitigation:** Differentiate error types: `DOMException` -> "Database error -- try refreshing"; `TypeError` -> "Export format error"; generic -> "Export failed".

### 11.4 Double-prefixed file paths in ZIP
- **Story:** E53-S03, Task 1.3
- **Scenario:** If `exportNotesAsMarkdown()` changes to return paths with folder prefixes in the future, the `notes/` prefix added by `pkmExport.ts` would create `notes/notes/file.md`.
- **Likelihood:** LOW (defensive concern)
- **Impact:** Wrong folder structure in ZIP
- **Severity:** LOW
- **Mitigation:** Strip leading path from note filenames before prefixing: `name.replace(/^notes\//, '')`. Or add an assertion.

---

## Recommendations by Priority

### Must-Fix Before Implementation (HIGH)

1. **WASM loading in production** (1.1) -- will break Anki export in all prod builds
2. **HTML content in Anki cards** (1.5) -- will produce unreadable cards for most users
3. **iOS Safari download** (7.1) -- silent failure for all iOS users
4. **Base64 image bloat** (4.1) -- can make exports unusably large
5. **YAML frontmatter escaping** (2.1, 2.3) -- common characters will break parsing
6. **File naming collision handling** (6.1) -- data loss for duplicate titles
7. **JSZip memory exhaustion** (3.1) -- tab crash for power users
8. **Package maintenance plan** (1.6) -- need fallback strategy documented

### Should-Fix During Implementation (MEDIUM)

9. Dynamic import error messaging (1.2)
10. Table conversion plugin (4.2)
11. Empty PKM export state (8.1)
12. Double-click race condition (11.1)
13. Partial failure resilience (11.2)
14. Bookmark deleted video fallback (10.1)
15. Course folder collision (6.2)
16. SRS data sanitization (5.1)
17. Progress callback accuracy (3.3)

### Nice-to-Have (LOW)

18. Bookmark label fallback (10.3)
19. Empty content note handling (4.4)
20. Firefox memory edge case (7.2)
21. Very large reviewCount cap (5.3)
