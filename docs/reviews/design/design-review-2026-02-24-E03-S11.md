# Design Review — E03-S11: Rich Text Toolbar Expansion

**Review Date**: 2026-02-24
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E03-S11 — Rich Text Toolbar Expansion
**Branch**: `feature/e03-s11-rich-text-toolbar-expansion`
**Changed Files**:
- `src/app/components/notes/NoteEditor.tsx` (primary — full rewrite from Markdown to TipTap)
- `tests/e2e/story-3-11.spec.ts` (E2E test spec)

**Affected Pages**: Lesson Player → Notes tab (`/courses/:courseId/:lessonId`)

---

## Executive Summary

E03-S11 replaces the previous Markdown textarea note editor with a full TipTap-powered rich text editor, adding highlight, task lists, link dialog, text alignment, typography auto-correction, word count, and mobile overflow menu. The implementation is architecturally sound and demonstrates strong accessibility intent — all toolbar buttons use semantic `<button>` elements with `aria-label` and `aria-pressed` attributes, focus rings are correctly implemented with `focus-visible:ring-2`, and touch targets meet the 44x44px minimum for all visible toolbar buttons. Three issues require attention before merge: a duplicate TipTap extension registration, a missing `role="toolbar"` on the toolbar container, and the ProseMirror editor lacking an accessible label.

---

## What Works Well

1. **Touch targets are exactly right** — every toolbar button renders at 44x44px (verified via computed `getBoundingClientRect()`), matching the WCAG 2.5.5 minimum for touch targets. The mobile overflow button is also 44x44px.

2. **Focus rings are excellent** — keyboard Tab navigation produces a crisp 2px solid blue outline (`rgb(37, 99, 235)`) with a 1px white offset ring. This is well above the WCAG 2.4.11 Focus Appearance minimum and is highly visible.

3. **`aria-pressed` is correctly synced** — computed background state matches `aria-pressed` attribute for all active buttons. When the cursor is inside highlighted text, Highlight button reports `aria-pressed="true"`; when in a task list, Task list button reports `aria-pressed="true"`. The `ToolbarButton` component correctly wires `active={editor.isActive(...)}` through.

4. **Link dialog is accessible** — opens with `DialogTitle`, `DialogDescription`, auto-focuses the URL input, Insert button is disabled until a valid URL protocol is entered (`https?://`, `/`, `video://`), and Escape correctly dismisses. This replaces the old `window.prompt()` anti-pattern cleanly.

5. **Word count is live and reactive** — updates immediately on every keystroke via TipTap's `CharacterCount` extension and the `onUpdate` callback. Verified "8 words" updating correctly.

6. **Autosave indicator uses proper semantics** — `aria-live="polite"` on the autosave indicator means screen readers will announce "Saved" without interrupting the user. The `hidden` attribute (not `display:none` via CSS) correctly removes it from the accessibility tree when idle.

7. **No hardcoded colours or inline styles** — the entire component uses Tailwind utility classes and theme tokens. No `style={}` attributes or hex literals found in the file.

8. **Card design token is correct** — `rounded-[24px]` and `bg-card` used on the editor container matches the design system card spec.

9. **Responsive overflow menu** — heading and alignment controls correctly collapse into a dropdown at mobile (`sm:hidden` / `hidden sm:flex` pattern), and the overflow button meets the 44x44px touch target.

10. **`prefers-reduced-motion` respected** — Tailwind's `transition-colors` class on toolbar buttons is automatically suppressed by the browser's `prefers-reduced-motion: reduce` media query.

---

## Findings by Severity

### High Priority (Should fix before merge)

**H1 — Duplicate TipTap extension: `underline`**
- **Location**: `src/app/components/notes/NoteEditor.tsx:151`
- **Evidence**: Console warning — `[tiptap warn]: Duplicate extension names found: ['underline']. This can lead to issues.` Confirmed by inspecting `@tiptap/starter-kit` source: StarterKit already includes and registers `@tiptap/extension-underline` internally (lines 84–85 of the compiled StarterKit). The explicit `Underline` import and registration at line 151 creates a second registration.
- **Impact**: TipTap's documentation explicitly states duplicate extension names can cause unpredictable behaviour — including commands not firing, state mismatches, or the wrong extension instance being used. In a note-taking tool, broken formatting commands directly damage the learner's ability to organise their notes.
- **Suggestion**: Remove the explicit `Underline` import (line 5) and the `Underline` entry in the extensions array (line 151). The StarterKit already provides underline support. If you need to customise underline options, use `StarterKit.configure({ underline: { /* options */ } })`.

**H2 — Toolbar `div` lacks `role="toolbar"` and `aria-label`**
- **Location**: `src/app/components/notes/NoteEditor.tsx:308–311`
- **Evidence**: `toolbar.getAttribute('role')` returns `null`; `toolbar.getAttribute('aria-label')` returns `null`. The toolbar container is a plain `<div>` with `data-testid="note-editor-toolbar"` and `flex-wrap`.
- **Impact**: Without `role="toolbar"`, screen readers announce this as a generic container, not a formatting toolbar. Users navigating by ARIA landmarks cannot locate it as a distinct region. ARIA 1.1 specifies `role="toolbar"` for collections of formatting controls. Without `aria-label`, the toolbar has no name even if the role were present.
- **Suggestion**: Add `role="toolbar"` and `aria-label="Text formatting"` (or `aria-labelledby` pointing to a visually hidden label) to the toolbar `div`:
  ```tsx
  <div
    data-testid="note-editor-toolbar"
    role="toolbar"
    aria-label="Text formatting"
    className="flex items-center gap-1 px-4 py-2 border-b border-border bg-muted/30 flex-wrap"
  >
  ```

**H3 — ProseMirror editor has no accessible label**
- **Location**: `src/app/components/notes/NoteEditor.tsx:164` (editorProps.attributes)
- **Evidence**: `pm.getAttribute('aria-label')` returns `null`. TipTap renders a `<div contenteditable="true">` which screen readers may not announce as a text editor, and without an accessible name screen reader users have no way to know what the editing region is for.
- **Impact**: A screen reader user tabbing into the editor will encounter an unlabelled `contenteditable` div. VoiceOver and NVDA may announce it as "edit text" without context, leaving the learner unable to confirm they are in the notes editor for this lesson.
- **Suggestion**: Add `aria-label` and `aria-multiline` to the editor's rendered element via `editorProps.attributes`:
  ```tsx
  editorProps: {
    attributes: {
      class: 'prose prose-sm dark:prose-invert max-w-none min-h-[250px] outline-none px-5 py-4',
      'aria-label': 'Lesson notes',
      'aria-multiline': 'true',
    },
  }
  ```

### Medium Priority (Fix when possible)

**M1 — Toolbar wraps to 2 rows at desktop and tablet viewports**
- **Location**: `src/app/components/notes/NoteEditor.tsx:310`
- **Evidence**: At 1440px desktop within the lesson player's notes panel (718px wide), the toolbar wraps — the "Add Timestamp" button occupies its own second row. At 768px tablet the "Insert link" and "Add Timestamp" buttons wrap to a second row. The toolbar uses `flex-wrap`, which allows this.
- **Impact**: The two-row toolbar consumes 108px in height (measured via `scrollHeight`), taking vertical space from the note editing area. The visual inconsistency between "Insert link" (a formatting control) appearing below the separator on a second row is confusing.
- **Suggestion**: Consider moving "Add Timestamp" to the right of the status bar (below the editor) rather than in the toolbar, or using a more compact toolbar design (e.g., `size-9` / 36px buttons) that fits within a single row while still meeting the 44px tap target via padding on the touch container. Alternatively, a separator between formatting controls and "Add Timestamp" that also acts as a flex grow spacer (`ml-auto` is already applied to the timestamp button) could make the two-row treatment more intentional.

**M2 — Task list checkboxes are 13x13px (below 44x44px touch target)**
- **Location**: TipTap `TaskItem` extension renders native `<input type="checkbox">` elements.
- **Evidence**: `checkbox.getBoundingClientRect()` returns `{ width: 13, height: 13 }`. `meetsMinTarget: false`.
- **Impact**: On mobile, 13x13px checkboxes are extremely difficult to tap accurately. Learners using touch interfaces will frequently miss the checkbox, which is the core interaction of a task list — tracking completed study tasks.
- **Suggestion**: Add a global CSS override for TipTap task list checkboxes. In `src/styles/index.css` or the TipTap editor's CSS scope:
  ```css
  .ProseMirror ul[data-type="taskList"] li > label > input[type="checkbox"] {
    width: 1.25rem;   /* 20px */
    height: 1.25rem;
    cursor: pointer;
    accent-color: theme(colors.blue.600);
  }
  /* Increase tap target via the label wrapper */
  .ProseMirror ul[data-type="taskList"] li > label {
    min-width: 2.75rem; /* 44px */
    min-height: 2.75rem;
    display: flex;
    align-items: center;
  }
  ```

**M3 — Radix `DialogContent` missing description warning**
- **Location**: `src/app/components/notes/NoteEditor.tsx:516`
- **Evidence**: Console warning — `Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}`. The `DialogDescription` component is present in the JSX (line 519–521), but the Radix UI version installed emits this warning when the description element is conditionally rendered or when the component version doesn't recognise `DialogDescription` as the expected slot.
- **Impact**: Low functional impact since the description is actually rendered (confirmed by `<p ref=e761>Enter the URL for this link.</p>` in the accessibility snapshot), but the console noise could mask real issues in future.
- **Suggestion**: Verify the shadcn/ui Dialog component version matches what Radix UI expects. Check that `DialogDescription` has `data-slot="dialog-description"` attribute (added in newer shadcn versions). If using the version from the project's component library, ensure it hasn't been downgraded by a `npx shadcn@latest add` run (see project memory's shadcn install gotchas).

### Low Priority (Fix when possible)

**L1 — Separators are `decorative={false}` but provide limited semantic value in this context**
- **Location**: `src/app/components/notes/NoteEditor.tsx:345, 381, 409, 420`
- **Evidence**: All 4 separators render as `role="separator" aria-orientation="vertical"` with `aria-hidden` absent. This means screen readers will announce them (e.g., VoiceOver says "separator").
- **Impact**: In a toolbar context, separators that announce themselves add navigation friction — screen reader users must Tab past them or they're announced unexpectedly. The ARIA `toolbar` role typically expects separators to be used with `aria-disabled` or `aria-orientation` to group controls, but announcing them verbally is non-standard.
- **Suggestion**: If the toolbar gets `role="toolbar"` (H2 above), consider making separators `decorative` (`decorative={true}` / `aria-hidden="true"`) since the grouping is already communicated visually and the toolbar pattern doesn't require announced separators. Alternatively, leave them semantic if the design intention is explicit grouping for screen readers.

**L2 — Word count contrast is a narrow pass at 12px**
- **Location**: `src/app/components/notes/NoteEditor.tsx:502`
- **Evidence**: Word count text is `rgb(100, 116, 139)` (Tailwind `text-muted-foreground`) at 12px on a white card background. Contrast ratio: **4.76:1** against white. WCAG AA requires 4.5:1 for text below 18pt/14pt bold — this just passes, but leaves very little margin.
- **Impact**: At 12px on an off-white or warm background, this text is very close to the accessibility threshold. If the card background is ever changed or if dark mode is used, this could fall below compliance.
- **Suggestion**: Either increase font size to 13px (`text-[13px]`) or use a slightly darker muted foreground for this specific status bar text. Alternatively, `text-slate-600` (`rgb(71, 85, 105)`) would give a contrast ratio of ~6.5:1 at the same size.

### Nitpicks (Optional)

**N1 — "Add Timestamp" has no `aria-pressed` attribute**
- **Location**: `src/app/components/notes/NoteEditor.tsx:485–494`
- **Evidence**: `button.getAttribute('aria-pressed')` returns `null` for "Add Timestamp". This is a `<Button>` component (not `ToolbarButton`), so it doesn't get `aria-pressed`.
- **Impact**: Minor — "Add Timestamp" is an action button (inserts content), not a toggle, so `aria-pressed` is not semantically appropriate. However, it has no visual active state styling (correct) so the absence is intentional. No fix needed.

**N2 — Mobile: "Add Timestamp" is isolated on its own third row**
- **Location**: `src/app/components/notes/NoteEditor.tsx:485`
- **Evidence**: At 375px mobile, button layout is: Row 1 (Bold, Italic, Underline, Highlight, Bullet list), Row 2 (Ordered list, Task list, Code block, Insert link, More options), Row 3 (Add Timestamp alone).
- **Impact**: The lonely third row looks unfinished and wastes vertical space on a narrow screen. Related to M1 above.
- **Suggestion**: See M1 suggestion. Moving "Add Timestamp" out of the toolbar to the status bar area would resolve this on all viewports.

**N3 — Typography extension auto-correction is invisible to users**
- **Location**: `src/app/components/notes/NoteEditor.tsx:155`
- **Evidence**: The `Typography` extension is added silently — no tooltip, no indicator, no user-facing documentation that "..." becomes "…" or "--" becomes "—".
- **Impact**: Very minor — Typography auto-correction is a quality-of-life feature. Most users will appreciate it implicitly. However, some users may be confused when their typed text changes.
- **Suggestion**: Consider adding a status bar tooltip or settings option to disable auto-correction, especially for technical notes where literal `...` or `->` may be important.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 | Pass | Word count: 4.76:1 on white (narrow margin — see L2) |
| Keyboard navigation | Pass | Tab moves through all toolbar buttons in logical order |
| Focus indicators visible | Pass | 2px blue ring with white offset under keyboard navigation |
| Heading hierarchy | Pass | Editor prose uses standard H1/H2/H3 via Tiptap |
| ARIA labels on icon buttons | Pass | All toolbar `<button>` elements have `aria-label` |
| `aria-pressed` on toggle buttons | Pass | Verified synced with visual active state |
| Toolbar has `role="toolbar"` | Fail | Plain `<div>` — see H2 |
| Editor contenteditable labelled | Fail | No `aria-label` on ProseMirror div — see H3 |
| Semantic HTML | Pass | `<button>` elements used throughout (no `div onClick`) |
| Form labels associated | Pass | Link dialog input is auto-focused; placeholder present |
| `prefers-reduced-motion` | Pass | Tailwind `transition-colors` respects media query |
| Autosave `aria-live` | Pass | `aria-live="polite"` on save indicator |
| Touch targets ≥44x44px (toolbar) | Pass | All toolbar buttons verified at 44x44px |
| Touch targets ≥44x44px (task checkboxes) | Fail | 13x13px — see M2 |
| No horizontal scroll | Pass | Verified at 375px, 768px, 1440px |
| Dialog accessible (keyboard) | Pass | Escape closes, Insert disabled until valid URL |
| Duplicate TipTap extension | Fail | `underline` registered twice — see H1 |

---

## Responsive Design Verification

**Desktop (1440px)**
- Pass: No horizontal scroll
- Pass: All toolbar buttons visible and accessible
- Note: Toolbar wraps to 2 rows within the 718px notes panel — "Add Timestamp" on its own row (see M1)
- Pass: `bg-body` = `rgb(250, 245, 238)` (#FAF5EE) — correct
- Pass: Card border radius = 24px — correct

**Tablet (768px)**
- Pass: No horizontal scroll
- Pass: Sidebar correctly hidden (collapsed per localStorage seed)
- Pass: Overflow menu button is hidden (768px > 640px `sm:` breakpoint, so alignment/heading controls show inline)
- Note: Toolbar wraps to 2 rows — "Insert link" and "Add Timestamp" fall to row 2 (see M1)
- Pass: All buttons meet 44px touch target

**Mobile (375px)**
- Pass: No horizontal scroll
- Pass: Overflow button visible and 44x44px
- Pass: Overflow menu contains Heading and Alignment options
- Note: "Add Timestamp" isolated on 3rd toolbar row (see N2/M1)
- Fail: Task list checkboxes 13x13px (see M2)

---

## Console Errors and Warnings

| Message | Severity | Notes |
|---------|----------|-------|
| Google Fonts CSP block | Info | Pre-existing; unrelated to this story |
| `pdfjs-dist` TT undefined function: 32 | Info | Pre-existing PDF.js warning; unrelated |
| TipTap duplicate extension `underline` | High | See H1 — must fix |
| Radix DialogContent missing description | Medium | See M3 — investigate |

---

## Code Health Analysis

**Strengths:**
- TypeScript: `NoteEditorProps` interface is well-defined with correct types. No `any` types found.
- Imports: All use `@/` alias correctly (`@/app/components/ui/*`).
- Latest-ref pattern correctly applied to avoid stale closures in `useEffect` and `useCallback`.
- Debounced + max-wait save strategy is a solid implementation for autosave (3s debounce, 10s hard cap).
- `ToolbarButton` extracted as a sub-component — single responsibility, correctly typed via `React.ButtonHTMLAttributes<HTMLButtonElement>` spread.
- Force-save on unmount implemented correctly using a ref to capture the latest editor instance.

**Concerns:**
- The `StarterKit.configure({ link: { ... } })` configures a `link` extension via StarterKit, but a separate `Link` import is not in the file — the link extension comes bundled with StarterKit. This works but may be confusing to future maintainers who expect to see an explicit `Link` import alongside `Highlight`, `TaskList`, etc.
- `TextStyle` and `Color` are imported and registered but no colour-picker UI is exposed in the toolbar. These extensions are unused dead weight for now. Consider removing until a colour picker is implemented to reduce bundle size.

---

## Recommendations

**Priority order:**

1. **Fix H1 first** — Remove the explicit `Underline` import/extension registration. This is a one-line deletion that eliminates a confirmed console warning and potential runtime bug. Zero risk.

2. **Fix H2 and H3 together** — Add `role="toolbar"` + `aria-label` to the toolbar container and `aria-label` + `aria-multiline` to `editorProps.attributes`. These are additive changes with no visual impact that unlock the editor for screen reader users. Estimated 5 minutes of work.

3. **Fix M2 (task checkbox touch targets)** — Add CSS overrides for `.ProseMirror ul[data-type="taskList"]` checkboxes. Most impactful for mobile learners who want to use task lists to track study progress.

4. **Discuss M1 (toolbar wrapping)** — Whether "Add Timestamp" stays in the toolbar or moves to the status bar is a design decision worth a brief conversation. The current implementation works but the wrapping is visually unpolished.

---

## Files Reviewed

- `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/src/app/components/notes/NoteEditor.tsx`
- `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/tests/e2e/story-3-11.spec.ts` (not tested directly — reviewed via git diff)

