---
title: "feat: Fix note list rendering + add Markdown paste/import-export to the notes editor"
type: feat
status: active
date: 2026-06-07
---

# feat: Fix note list rendering + add Markdown paste/import-export to the notes editor

## Overview

Two related changes to the lesson notes editor (`src/app/components/notes/NoteEditor.tsx`):

- **Option A — Fix list rendering (the actual reported bug).** When a user types `- ` the TipTap bullet-list input rule fires and creates a real `<ul><li>` node, but no bullet marker or indentation is shown, so a list looks identical to a paragraph. Root cause: the editor content relies on Tailwind's `prose` classes, but `@tailwindcss/typography` is **not installed/registered**, and Tailwind Preflight strips list markers (`ul,ol { list-style: none; margin: 0; padding: 0 }`). Headings still look styled only because `theme.css` has element-level base CSS for `h1`–`h4`. Fix with scoped `.tiptap` list CSS.

- **Option B — Make it feel like a Markdown editor.** Add the official first-party `@tiptap/markdown` extension so users can **paste Markdown and have it auto-format**, while keeping the WYSIWYG editing experience and the existing **HTML storage format** unchanged. No data migration.

This deliberately excludes "true raw-Markdown storage" (Option C from discussion), which would require migrating every existing note from HTML→Markdown and custom serializers for non-representable custom nodes (video timestamps, frame capture).

## Problem Frame

A user typing Markdown shortcuts in lesson notes sees `# Heading` style correctly but `- list item` renders as plain text — the dash "disappears" on space (the input rule consumed it) but no bullet appears. The user also expects general "Markdown editor" behavior (paste Markdown, export Markdown). The editor is a TipTap WYSIWYG that stores HTML; it understands Markdown *input rules* live but has never rendered list markers and has no Markdown paste/parse layer.

## Requirements Trace

- R1. Bullet lists (`<ul>`) typed in the notes editor render with a visible marker and indentation.
- R2. Ordered lists (`<ol>`) render with numbers and indentation.
- R3. Nested lists render with appropriate nested markers/indentation.
- R4. The fix applies to both the editable editor (`NoteEditor`) and the read-only renderer (`ReadOnlyContent`).
- R5. Task lists (checkboxes) continue to render correctly (no regression from existing `taskList` CSS at `src/styles/index.css` lines 52–68).
- R6. Pasting Markdown text into the editor auto-converts it to formatted rich text (headings, lists, bold/italic, links, code).
- R7. Existing notes (stored as HTML) continue to load, edit, and save as HTML with no data migration and no behavioral regression.
- R8. The new dependency is compatible with the currently resolved TipTap version without forcing a coordinated upgrade of all `@tiptap/*` packages.
- R9. After any package-manifest change, a security vulnerability scan is run (per project dependency rule), and only scanner-recommended fixes related to this change are applied.

## Scope Boundaries

- Not changing the storage format — notes remain HTML (`editor.getHTML()` → Dexie).
- Not installing `@tailwindcss/typography` (would restyle other `prose` consumers: `src/app/pages/legal/PrivacyPolicy.tsx`, `src/app/components/figma/FeaturedAuthor.tsx`).
- Not converting the at-rest bulk export pipeline to native `getMarkdown()` (it operates on stored HTML strings without a live editor — Turndown stays). See Deferred.
- Not adding a split-pane raw-Markdown source view / preview editor (Option C).
- Not adding custom Markdown serializers for non-standard nodes (video `video://` timestamps, frame capture, YouTube embeds, details) — these only exist in HTML storage and are intentionally not round-tripped through Markdown.

### Deferred to Separate Tasks

- **Native `getMarkdown()` for single-active-note export/copy:** Could replace Turndown for the *live editor* case (e.g. a "Copy as Markdown" button) in a future iteration. Bulk/at-rest export in `src/lib/noteExport.ts` would still need Turndown (or a headless `generateJSON` + `MarkdownManager` serializer), so this is out of scope here.
- **Coordinated TipTap upgrade to 3.26.x:** Would allow using the latest `@tiptap/markdown`. Separate dependency-upgrade task with its own regression pass.

## Context & Research

### Relevant Code and Patterns

- `src/app/components/notes/NoteEditor.tsx` — main editor; `StarterKit` configured at lines ~293–303; extensions array ends ~386; `editorProps.attributes.class` uses `prose prose-sm dark:prose-invert ...` (~389–391); `onUpdate` saves `ed.getHTML()` (~417–447); lesson-change `setContent(initialContent)` defaults to HTML (~456–467).
- `src/app/components/notes/ReadOnlyContent.tsx` — read-only renderer; `StarterKit` only, class `prose prose-sm max-w-none`.
- `src/styles/index.css` — all TipTap visual styling is hand-written here (e.g. `taskList` rules lines 52–68, tables 242–274, details 171–221). This is the established pattern for editor CSS — **add list rules here**, mirroring the existing approach.
- `src/styles/theme.css` (~1128–1152) — element-level base CSS for `h1`–`h4` explains why headings look styled but lists do not.
- `src/styles/tailwind.css` — Tailwind v4 entry; confirms no `@plugin "@tailwindcss/typography"`.
- `src/app/components/notes/slash-command/SlashCommandList.tsx` — existing list commands (`List`, `ListOrdered`, `ListTodo`) prove list nodes exist; only their CSS is missing.
- `src/lib/noteExport.ts` — `htmlToMarkdown()` uses Turndown on stored HTML; called by `exportNoteAsMarkdown`, `exportCombinedMarkdown`, `exportNotesZip`, `exportSingleNoteAsMarkdown`. These run without a live editor.

### Institutional Learnings

- `docs/solutions/best-practices/course-lesson-notes-top3-implementation-lessons-2026-05-04.md` — prior notes-feature lessons.
- `tests/e2e/regression/story-3-11.spec.ts` — existing editor typography/auto-correction E2E; pattern for asserting editor rendering.

### External References

- TipTap official Markdown extension docs (`@tiptap/markdown`): bidirectional parse/serialize, MarkedJS-based, CommonMark + GFM. Flagged by TipTap as "early release — subject to change / edge cases."
- TipTap docs "Markdown Examples" → **Paste Markdown Detection** pattern: a custom `Extension` adding a ProseMirror `handlePaste` plugin that calls `editor.markdown.parse(text)` when `looksLikeMarkdown(text)` is true.
- The legacy third-party `tiptap-markdown` (aguingand) is **deprecated** — do not use.

### Dependency Compatibility (verified)

- Installed `@tiptap/*` resolve to **3.22.4** (from `^3.20.0` ranges).
- `@tiptap/markdown@3.26.0` (latest) has **strict** peer deps: `@tiptap/core@3.26.0`, `@tiptap/pm@3.26.0` (exact pins) → would force upgrading all ~25 TipTap packages.
- `@tiptap/markdown@3.22.4` exists with peer deps `@tiptap/core@3.22.4`, `@tiptap/pm@3.22.4` → **matches current resolution**. Recommended.
- `@tiptap/markdown` depends on transitive `marked@^17` (new dependency → triggers R9 security scan).

## Key Technical Decisions

- **A via scoped `.tiptap` CSS, not the typography plugin.** Mirrors the existing hand-written editor CSS in `src/styles/index.css` and avoids restyling unrelated `prose` consumers. Lower blast radius.
- **Pin `@tiptap/markdown` to exact `3.22.4`** (no caret) to satisfy the strict peer dependency against the currently resolved TipTap 3.22.4, avoiding a coordinated multi-package upgrade. Document the pin so a future `npm update` doesn't silently break the peer match.
- **Storage stays HTML.** `getHTML()`/`setContent(html)` paths unchanged; default `contentType` is `html`, so registering the Markdown extension should not change initial-content parsing. Verified by round-trip tests.
- **Native Markdown only at the live editor (paste).** Keep Turndown for at-rest bulk export because that pipeline has no editor instance.
- **Conservative paste heuristic.** `looksLikeMarkdown()` must avoid false positives (e.g. a sentence containing a hyphen). Only transform when clear block-level Markdown markers are present; otherwise fall through to default paste.

## Open Questions

### Resolved During Planning

- Which `@tiptap/markdown` version? → `3.22.4`, pinned, for peer-dep compatibility.
- Install `@tailwindcss/typography`? → No; scoped `.tiptap` CSS.
- Replace Turndown export with `getMarkdown()`? → No; export runs at-rest without an editor. Keep Turndown.
- Does the read-only renderer get the `.tiptap` class so the CSS applies? → TipTap applies the `tiptap` class to the editor DOM in both editable and read-only modes; **verify during implementation** and, if not, broaden the selector to `.tiptap, .ProseMirror` (the ProseMirror class is always present).

### Deferred to Implementation

- Exact `looksLikeMarkdown()` regex set and whether to also intercept `handlePaste` for the `text/plain` vs `text/html` clipboard branches — finalize against real paste payloads during implementation.
- Whether registering `Markdown` requires any `markedOptions` (`gfm`, `breaks`) tuning to match the existing GFM nodes (tables, task lists) — determine empirically via round-trip tests.

## Implementation Units

- [ ] **Unit A1: Add list-rendering CSS for the TipTap editor**

**Goal:** Bullet, ordered, and nested lists render with visible markers and indentation in both the editable and read-only editors.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None

**Files:**
- Modify: `src/styles/index.css`
- Test (optional E2E): `tests/e2e/regression/story-3-11.spec.ts` (or a new spec under `tests/e2e/`)

**Approach:**
- Add scoped rules near the existing TipTap section, e.g. `.tiptap ul { list-style: disc; padding-left: 1.5rem; }`, `.tiptap ol { list-style: decimal; padding-left: 1.5rem; }`, `.tiptap li { margin: 0.25rem 0; }`, plus nested-list markers (`.tiptap ul ul { list-style: circle }`, etc.).
- Ensure the existing `ul[data-type='taskList']` overrides (lines 52–68) still win for checklists — place generic list rules so the more specific task-list selector continues to remove markers for task lists.
- Verify the read-only renderer receives `.tiptap`; if not, use selector `.tiptap, .ProseMirror`.

**Patterns to follow:**
- Existing hand-written editor CSS in `src/styles/index.css` (task list, tables, details blocks).

**Test scenarios:**
- Happy path (manual/visual): typing `- item` then Enter shows a bulleted list with markers and indent.
- Happy path (manual/visual): typing `1. item` shows a numbered list.
- Edge case (manual/visual): a nested list (Tab to indent) shows a distinct nested marker.
- Regression (manual/visual): task-list checkboxes still render without a disc marker.
- Optional E2E: in the editor, create a bullet list and assert the `<li>`'s computed `list-style-type` is not `none` (and/or `<ul>` has non-zero padding-left).

**Verification:**
- Lists are visually distinguishable from paragraphs in editor and read-only views; task lists unaffected.

- [ ] **Unit B1: Add the `@tiptap/markdown` dependency (pinned) + security scan**

**Goal:** Make the official Markdown extension available without forcing a TipTap-wide upgrade.

**Requirements:** R8, R9

**Dependencies:** None

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Approach:**
- Add `@tiptap/markdown` pinned to exact `3.22.4` (no `^`) to match resolved `@tiptap/core@3.22.4` / `@tiptap/pm@3.22.4`.
- Add a short comment/Decision record (in this plan / PR description) noting the pin rationale and the strict peer dependency so future maintainers don't loosen it accidentally.
- Per project rule R9: after editing the manifest, run the security scanner; apply only the scanner-recommended fix that matches this change (e.g. for the new transitive `marked` dependency); ignore unrelated advisories; then re-scan to confirm.

**Patterns to follow:**
- Existing exact/caret conventions in `package.json` (note this is an intentional exact pin).

**Test scenarios:**
- Test expectation: none — dependency manifest change. Validation is install success + peer-dep resolution + clean security scan.

**Verification:**
- `npm ls @tiptap/markdown @tiptap/core @tiptap/pm` shows a single resolved 3.22.4 with no peer-dependency warnings; install completes; security scan reports no new actionable advisories attributable to this change.

- [ ] **Unit B2: Register the Markdown extension in the notes editor (HTML round-trip preserved)**

**Goal:** Enable `editor.markdown` (MarkdownManager) for parsing pasted Markdown, without changing HTML storage behavior.

**Requirements:** R6, R7

**Dependencies:** Unit B1

**Files:**
- Modify: `src/app/components/notes/NoteEditor.tsx`
- Test: `src/app/components/notes/__tests__/NoteEditor.test.tsx`

**Approach:**
- Add `Markdown` to the `useEditor` extensions array (alongside `StarterKit` and the other extensions).
- Keep `content: initialContent` and all `setContent(...)`/`getHTML()` calls unchanged — rely on the default `contentType: 'html'`. Do **not** pass `contentType: 'markdown'` anywhere.
- If round-trip tests reveal any serialization quirks with existing GFM nodes, configure `Markdown.configure({ markedOptions: { gfm: true } })` as needed (decide empirically).
- Do **not** add Markdown to `ReadOnlyContent.tsx` (not needed; avoids extra surface).

**Patterns to follow:**
- Existing extension registration and `.configure(...)` usage in `NoteEditor.tsx`.

**Test scenarios:**
- Happy path: mounting the editor with HTML `initialContent` (e.g. `<h1>` + `<ul><li>`) renders the same structure (no Markdown re-parsing of stored HTML).
- Integration: editing then reading back `getHTML()` returns valid HTML equivalent to prior behavior (round-trip; no content loss for headings, lists, bold/italic, links, code blocks).
- Integration: switching `initialContent` (lesson change) still loads as HTML via the existing effect at `NoteEditor.tsx` ~456–467.
- Edge case: a note containing a custom `video://` timestamp link still loads and saves unchanged (custom node not mangled by Markdown registration).

**Verification:**
- Existing `NoteEditor` tests pass; new round-trip tests confirm HTML-in/HTML-out parity with the Markdown extension registered.

- [ ] **Unit B3: Add a Paste-Markdown extension with a conservative heuristic**

**Goal:** Pasting Markdown text auto-converts to formatted rich text; pasting non-Markdown text behaves as before.

**Requirements:** R6, R7

**Dependencies:** Unit B2

**Files:**
- Create: `src/app/components/notes/paste-markdown.ts` (a small TipTap `Extension` adding a ProseMirror `handlePaste` plugin)
- Modify: `src/app/components/notes/NoteEditor.tsx` (register the extension)
- Test: `src/app/components/notes/__tests__/NoteEditor.test.tsx` (or a dedicated `paste-markdown` test)

**Approach:**
- Follow TipTap's documented "Paste Markdown Detection" pattern: in `handlePaste`, read `event.clipboardData?.getData('text/plain')`; if `looksLikeMarkdown(text)` and `editor.markdown` is available, `editor.markdown.parse(text)` → `editor.commands.insertContent(json)` and return `true`; otherwise return `false` to fall through to default paste.
- `looksLikeMarkdown()` should be conservative: trigger on clear block markers — heading (`^#{1,6}\s`), list item (`^\s*[-*+]\s`), ordered list (`^\s*\d+\.\s`), fenced code (```` ``` ````), or multiple inline-bold/link patterns — and prefer not to transform a single short line that merely contains a hyphen.
- Ensure rich HTML pastes (when the clipboard already has `text/html`) keep default behavior so copying between editors isn't downgraded — only act on plain-text Markdown.

**Patterns to follow:**
- TipTap `Extension.create({ addProseMirrorPlugins() {...} })` with `@tiptap/pm/state` `Plugin`.
- Existing extension wiring in `NoteEditor.tsx`.

**Test scenarios:**
- Happy path: pasting `# Title\n\n- a\n- b` inserts a heading + bullet list.
- Happy path: pasting `**bold** and _italic_` inserts bold + italic marks.
- Edge case (no false positive): pasting `we use a state-of-the-art model - it works` inserts a plain paragraph (no list).
- Edge case: pasting an empty string / whitespace does nothing harmful (returns false / no crash).
- Integration: pasting Markdown into an existing note then `getHTML()` yields the expected HTML structure (so it persists correctly via the normal save path).
- Regression: pasting plain text still pastes as plain text.

**Verification:**
- Markdown paste produces formatted content; non-Markdown and rich-HTML pastes are unchanged; saved HTML reflects the pasted structure.

## System-Wide Impact

- **Interaction graph:** Registering `Markdown` overrides TipTap content commands (`setContent`, `insertContent`, adds `getMarkdown`). The `onUpdate` save path uses `getHTML()` and the lesson-change effect uses `setContent(html)` — both must stay HTML-default. Paste extension hooks ProseMirror `handlePaste` only.
- **Error propagation:** `editor.markdown.parse` should be guarded; on parse failure, fall through to default paste rather than throwing into the paste handler.
- **State lifecycle risks:** No storage change; debounced/eager save logic untouched. No migration of existing Dexie note content.
- **API surface parity:** `ReadOnlyContent` intentionally not given the Markdown extension; the CSS fix (A1) covers its list rendering. Other `prose` consumers (`PrivacyPolicy`, `FeaturedAuthor`) are untouched because the fix is `.tiptap`-scoped.
- **Integration coverage:** Round-trip HTML load/save and paste→getHTML scenarios are the cross-layer behaviors unit-level assertions on isolated functions won't fully prove.
- **Unchanged invariants:** Note storage format (HTML), export pipeline (`src/lib/noteExport.ts` Turndown-based), custom nodes (`video://` timestamps, frame capture, YouTube, details, tables), and task-list checkbox rendering all remain as-is.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Strict peer dep: a future `npm update` bumps `@tiptap/*` to 3.26.x while `@tiptap/markdown` stays 3.22.4 → peer conflict | Pin `@tiptap/markdown` to exact `3.22.4`; document the constraint in the PR; consider the coordinated-upgrade task (Deferred) when bumping TipTap |
| Markdown extension (TipTap-flagged "early release") changes default content parsing → existing HTML notes misrender | Keep default `contentType: 'html'`; add HTML round-trip tests (Unit B2); never pass `contentType: 'markdown'` on stored content |
| Paste heuristic false positives transform ordinary pasted text | Conservative `looksLikeMarkdown()`; only act on `text/plain` with clear block markers; explicit no-false-positive test |
| New transitive `marked` dependency introduces an advisory | Run security scan after manifest change; apply only scanner-recommended, change-related fixes; re-scan (R9) |
| Read-only renderer might not carry the `.tiptap` class | Verify during A1; fall back to `.tiptap, .ProseMirror` selector |
| Generic `.tiptap ul/ol` rules unintentionally affect task lists | Keep task-list selectors more specific; regression test/visual check |

## Documentation / Operational Notes

- Note the `@tiptap/markdown` exact pin and its rationale in the PR description.
- No rollout/migration steps; changes are client-side and storage-compatible.
- Consider a brief mention in notes/editor docs that pasting Markdown now auto-formats.

## Sources & References

- Editor: `src/app/components/notes/NoteEditor.tsx`
- Read-only: `src/app/components/notes/ReadOnlyContent.tsx`
- Editor CSS: `src/styles/index.css`
- Base element CSS: `src/styles/theme.css`
- Tailwind entry: `src/styles/tailwind.css`
- Export pipeline: `src/lib/noteExport.ts`
- Existing editor E2E: `tests/e2e/regression/story-3-11.spec.ts`
- TipTap Markdown docs (official `@tiptap/markdown`), "Paste Markdown Detection" example
- Verified dependency facts: `@tiptap/markdown@3.22.4` peer deps `@tiptap/core@3.22.4`/`@tiptap/pm@3.22.4`; transitive `marked@^17`; installed TipTap resolves to 3.22.4
