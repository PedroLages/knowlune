## Edge Case Review — E14-S04 (2026-03-21)

**Re-validation** — All 6 findings from the initial review have been addressed.

### Previous Findings (All Fixed)

| # | Edge Case | Status |
|---|-----------|--------|
| 1 | Null/undefined `content` prop | FIXED — `content ?? ''` guard on line 66 |
| 2 | Links navigate away from quiz | FIXED — `a` override renders as `<span>` on line 43 |
| 3 | Images overflow container on mobile | FIXED — `img` override with `max-w-full h-auto` on line 46 |
| 4 | GFM tables overflow with no scroll | FIXED — `table` override with `overflow-x-auto` wrapper on line 49 |
| 5 | Deeply nested lists push content off-screen | NOTED — `ml-6` indentation compounds but unlikely in quiz content |
| 6 | Fenced code without language specifier | FIXED — `pre` CSS override `[&>code]:bg-transparent [&>code]:p-0` resets inline styles regardless of `className` |

### Unhandled Edge Cases

**MarkdownRenderer.tsx:31** — `className contains a Tailwind class that conflicts with base classes (e.g. text-lg)`
> Consequence: String template `text-sm ${className}` bypasses Tailwind Merge — conflicting utilities both emitted, last-in-source wins (unpredictable)
> Guard: `cn('text-sm', className)` instead of string template on line 31

**MarkdownRenderer.tsx:21** — `Markdown content starts with a paragraph (most common case)`
> Consequence: `my-2` on `<p>` adds unwanted 8px top margin above question text, creating visual gap between the label div and the first line of content
> Guard: `p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 text-pretty">{children}</p>`

**MarkdownRenderer.tsx:49-52** — `GFM table has no thead (headerless table)`
> Consequence: `min-w-full` on table with no `<th>` elements renders a full-width table with no visual column headers; cells have no border/padding styling — renders as plain text in a grid with no visual separation
> Guard: Add `th` and `td` component overrides with `border border-border px-3 py-2` for cell visibility

**MarkdownRenderer.tsx:43** — `Link text contains inline code or emphasis (e.g. [**click**](url))`
> Consequence: The `<span>` wrapper preserves child elements correctly, but `text-foreground underline` makes it visually appear interactive (underlined) despite being non-clickable — misleading affordance
> Guard: Remove `underline` class or use `cursor-default` to signal non-interactivity: `<span className="text-foreground">{children}</span>`

**MarkdownRenderer.tsx:45-46** — `Image src is a broken URL or empty string`
> Consequence: Browser renders broken image icon with `alt=""` (empty alt), providing no context for the missing image; the `max-w-full h-auto rounded my-2` styling still applies to the broken image placeholder
> Guard: Add `onError` handler to hide broken images: `<img ... onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />`

**MarkdownRenderer.tsx:37-38** — `GFM task list items (- [x] Done / - [ ] Todo)`
> Consequence: `remarkGfm` parses task lists into `<li>` with `<input type="checkbox">` children; no override disables or styles the checkbox, so learners see a functional (clickable) checkbox inside read-only question text
> Guard: Add `input: ({ type, checked }) => type === 'checkbox' ? <span>{checked ? '\u2611' : '\u2610'}</span> : <input type={type} />` to render checkboxes as inert text

---
**Total:** 6 unhandled edge cases found.
