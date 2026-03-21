# E14-S04: Support Rich Text Formatting in Questions

## Context

Quiz questions currently render Markdown via `react-markdown` + `remark-gfm`, but with only one override: `<p>` → `<span>` for HTML-valid `<legend>` content. Code blocks, inline code, lists, bold, and italic all render with **default browser styles** — no design tokens, no `bg-surface-sunken`, no controlled typography. This story creates a shared `MarkdownRenderer` that styles all Markdown elements using LevelUp's design system and moves block-level content outside `<legend>` using `aria-labelledby`.

## Key Decision: Legend Pattern

**Current**: All 4 question components render `<Markdown>` inside `<legend>` with `<p>` → `<span>`.

**Problem**: Code blocks (`<pre>`) and lists (`<ul>`/`<ol>`) are block elements — invalid inside `<legend>`. This works visually in browsers but violates HTML spec and could break screen readers.

**Solution**: Move Markdown rendering outside `<legend>` using `aria-labelledby`:
```tsx
<fieldset>
  <legend className="sr-only">{plainTextFallback}</legend>
  <div id={labelId} aria-hidden="true">
    <MarkdownRenderer content={question.text} />
  </div>
  <RadioGroup aria-labelledby={labelId}>...</RadioGroup>
</fieldset>
```

Actually, simpler approach — drop `<legend>` entirely and use `aria-labelledby` on the group:
```tsx
<fieldset aria-labelledby={labelId}>
  <div id={labelId} data-testid="question-text">
    <MarkdownRenderer content={question.text} />
  </div>
  <RadioGroup>...</RadioGroup>
</fieldset>
```

This is cleaner: `<fieldset aria-labelledby>` is valid, block content in a `<div>` is valid, and screen readers get the same association.

## Tasks

### Task 1: Create `MarkdownRenderer` component (~20 min)

**File**: `src/app/components/quiz/MarkdownRenderer.tsx` (new)

Shared component wrapping `react-markdown` with styled overrides:

| Element | Tailwind Classes | Notes |
|---------|-----------------|-------|
| `pre` | `bg-surface-sunken rounded-lg p-4 overflow-x-auto my-3` | Horizontal scroll, design token bg |
| `code` (block, inside pre) | `text-foreground font-mono text-sm` | Monospace, inherits pre bg |
| `code` (inline) | `bg-muted text-foreground font-mono text-[0.875em] px-1.5 py-0.5 rounded` | Distinct from text |
| `ul` | `ml-6 space-y-1 list-disc` | Indented bullets |
| `ol` | `ml-6 space-y-1 list-decimal` | Indented numbers |
| `li` | `text-foreground` | Inherit text color |
| `strong` | (default) | Browser `<strong>` is fine |
| `em` | (default) | Browser `<em>` is fine |
| `p` | `my-2` | Spacing between paragraphs |

**Key implementation detail**: Distinguish inline `<code>` from block `<code>` (inside `<pre>`). React-markdown passes `className` with language info for fenced blocks. Use `node.position` or check if parent is `<pre>` to differentiate.

Props: `{ content: string; className?: string }`

### Task 2: Update `markdown-config.tsx` (~5 min)

**File**: `src/app/components/quiz/questions/markdown-config.tsx` (modify)

Keep existing exports for backward compatibility during transition:
- `REMARK_PLUGINS` stays
- `MARKDOWN_COMPONENTS` stays (still used if anything else references it)

The new `MarkdownRenderer` will define its own components internally.

### Task 3: Refactor all 4 question components (~25 min)

For each component, replace the `<legend>` pattern with `aria-labelledby`:

**Files to modify**:
- `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx`
- `src/app/components/quiz/questions/TrueFalseQuestion.tsx`
- `src/app/components/quiz/questions/MultipleSelectQuestion.tsx`
- `src/app/components/quiz/questions/FillInBlankQuestion.tsx`

**Before** (all 4 follow this pattern):
```tsx
<fieldset className="mt-6">
  <legend id={legendId} data-testid="question-text" className="text-lg lg:text-xl ...">
    <Markdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
      {question.text}
    </Markdown>
  </legend>
  <RadioGroup>...</RadioGroup>
</fieldset>
```

**After**:
```tsx
<fieldset className="mt-6" aria-labelledby={labelId}>
  <div id={labelId} data-testid="question-text" className="text-lg lg:text-xl text-foreground leading-relaxed pb-4">
    <MarkdownRenderer content={question.text} />
  </div>
  <RadioGroup>...</RadioGroup>
</fieldset>
```

**Per-component specifics**:
- **MultipleChoiceQuestion**: Remove `<legend>`, add `aria-labelledby` on `<fieldset>`. Remove `Markdown` import, add `MarkdownRenderer` import.
- **TrueFalseQuestion**: Same pattern.
- **MultipleSelectQuestion**: Same, but keep `aria-describedby={hintId}` on `<fieldset>` alongside `aria-labelledby`.
- **FillInBlankQuestion**: Same, plus keep `aria-labelledby={legendId}` on `<Input>` (already there — rename to `labelId` for consistency). The input's `aria-labelledby` points to the same div.

### Task 4: Unit tests for MarkdownRenderer (~15 min)

**File**: `src/app/components/quiz/__tests__/MarkdownRenderer.test.tsx` (new)

Test cases:
- Renders `<pre><code>` for fenced code blocks with `bg-surface-sunken`
- Renders inline `<code>` with `bg-muted` (not inside `<pre>`)
- Renders `<ul>` and `<ol>` with list styling
- Renders `<strong>` and `<em>` for bold/italic
- Renders `<p>` paragraphs with spacing
- Component accepts and applies className prop

### Task 5: Update existing unit tests (~10 min)

**Files**:
- `src/app/components/quiz/__tests__/MultipleChoiceQuestion.test.tsx`
- `src/app/components/quiz/__tests__/TrueFalseQuestion.test.tsx`
- Any other existing test files for question components

Update assertions that depend on `<legend>` element — now it's a `<div>` with `data-testid="question-text"`.

### Task 6: Verify E2E tests pass (~10 min)

Run the ATDD spec: `npx playwright test tests/e2e/story-14-4.spec.ts`

The tests expect:
- `<pre>` elements with `overflow-x: auto`
- `<code>` elements for inline code
- `<ul>` and `<ol>` for lists
- `<strong>` and `<em>` for emphasis
- `getByRole('radiogroup')` with `aria-labelledby` pointing to question text
- Mobile viewport (375px) without horizontal page scroll

### Task 7: Run full build + lint + existing tests (~5 min)

```bash
npm run build
npm run lint
npm run test:unit
npx playwright test tests/e2e/navigation.spec.ts tests/e2e/overview.spec.ts tests/e2e/courses.spec.ts
```

## Files Summary

| Action | File |
|--------|------|
| **Create** | `src/app/components/quiz/MarkdownRenderer.tsx` |
| **Create** | `src/app/components/quiz/__tests__/MarkdownRenderer.test.tsx` |
| **Modify** | `src/app/components/quiz/questions/MultipleChoiceQuestion.tsx` |
| **Modify** | `src/app/components/quiz/questions/TrueFalseQuestion.tsx` |
| **Modify** | `src/app/components/quiz/questions/MultipleSelectQuestion.tsx` |
| **Modify** | `src/app/components/quiz/questions/FillInBlankQuestion.tsx` |
| **Modify** | Existing unit test files (update legend → div assertions) |
| **Keep** | `src/app/components/quiz/questions/markdown-config.tsx` (no changes needed) |

## Verification

1. `npm run build` — no type errors
2. `npm run lint` — no design token violations
3. `npm run test:unit` — all unit tests pass
4. `npx playwright test tests/e2e/story-14-4.spec.ts` — all 8 ATDD tests pass
5. Visual check: Start dev server, navigate to a quiz with markdown question text, verify code blocks / lists / emphasis render correctly
6. Mobile check: Resize to 375px, verify no horizontal scroll on page, code blocks scroll independently
