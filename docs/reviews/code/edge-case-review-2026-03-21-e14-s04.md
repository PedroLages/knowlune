## Edge Case Review — E14-S04 (2026-03-21)

### Unhandled Edge Cases

**MarkdownRenderer.tsx:42** — `question.text is undefined or null`
> Consequence: react-markdown receives non-string children, may throw or render 'undefined'
> Guard: `<Markdown ...>{content ?? ''}</Markdown>`

**MarkdownRenderer.tsx:7-28** — `Markdown contains [link](url) in question text`
> Consequence: Unstyled link navigates away from quiz, losing progress
> Guard: `a: ({href, children}) => <span>{children}</span>`

**MarkdownRenderer.tsx:7-28** — `Markdown contains ![img](url) in question text`
> Consequence: Unconstrained image overflows container, breaks mobile layout
> Guard: `img: ({src, alt}) => <img src={src} alt={alt} className="max-w-full h-auto" />`

**MarkdownRenderer.tsx:7-28** — `Markdown contains GFM table (remarkGfm enabled)`
> Consequence: Wide table overflows container with no horizontal scroll on mobile
> Guard: `table: ({children}) => <div className="overflow-x-auto"><table>{children}</table></div>`

**MarkdownRenderer.tsx:25** — `Deeply nested lists (3+ levels) on 375px viewport`
> Consequence: Compounding ml-6 indentation pushes list content off-screen on mobile
> Guard: `Cap ml-6 indentation or use max-w with overflow-x-auto on list container`

**MarkdownRenderer.tsx:18-24** — `Fenced code block without language specifier`
> Consequence: Block code gets inline styling classes (bg-muted, padding, rounded) before pre CSS override
> Guard: `code: ({node, children, className}) => { const isBlock = node?.position !== undefined && !className; ... }`

---
**Total:** 6 unhandled edge cases found.
