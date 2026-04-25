---
title: "WCAG 2.2 Aggregator Suite Patterns: Hybrid Detection, ESM Test Specs, Template-Literal Regex"
date: 2026-04-25
problem_type: best-practice
category: best-practices
module: tests/audit
tags:
  - accessibility
  - wcag-2.2
  - playwright
  - test-patterns
  - esm
  - regex
related_story: E66-S06
related_pr: "https://github.com/PedroLages/knowlune/pull/447"
---

# WCAG 2.2 Aggregator Suite Patterns

## Context

E66-S06 closed Knowlune's WCAG 2.2 epic by adding an aggregator audit suite + a stakeholder-readable compliance report. Three implementation patterns from this story are reusable across any future a11y aggregator work or audit-style E2E spec.

## Guidance

### 1. Aggregator vs duplication boundary

When you already have per-criterion E2E specs (`target-size.spec.ts`, `focus-not-obscured.spec.ts`, `focus-indicators.spec.ts`), the aggregator should **only add coverage for criteria that are not yet tested elsewhere**. Re-running existing specs inside the aggregator doubles runtime, produces duplicate failure noise, and confuses triage.

Knowlune's `tests/audit/wcag-2.2-compliance.spec.ts` only covers SC 2.5.7, 3.3.7, 3.3.8, 3.2.6 — the four criteria without dedicated specs. Existing specs stay authoritative for 2.4.11, 2.4.13, 2.5.8 and are auto-discovered by Playwright's `testDir: './tests'`.

The compliance report cross-references all per-criterion specs by file path so stakeholders see the full picture even though one spec only owns a subset.

### 2. Hybrid runtime + source-grep detection for sortable contracts

Pure runtime DOM checks fail on routes that need seeded fixtures (e.g., `LearningPathDetail` requires an active path). Pure source-grep produces false positives on `useSortable` imports without active rendering.

The hybrid:

- **Source sentinel** over a maintained allowlist of files that *should* expose move-up/down buttons. Asserts each file imports `MoveUpDownButtons` or contains an `aria-label="Move ... up|down"` pattern.
- **Runtime check** on a single reachable route (`/library` reading queue) that gracefully annotates "no entries seeded" rather than failing when the list is empty.

Two `useSortable` callsites are intentionally excluded because their move-button contract lives in a sibling/parent rendering component (`ReadingQueue.tsx` -> `ReadingQueueView.tsx`) or are documented partial gaps (`ClipListPanel.tsx`). The compliance report tracks these explicitly so they don't regress silently.

### 3. ESM `__dirname` reconstruction for Playwright specs

Playwright specs run as ESM under Vite. `__dirname` is undefined; using it gives `ReferenceError: __dirname is not defined in ES module scope` and Playwright reports "No tests found".

```typescript
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..')
```

Use this whenever an audit spec needs to read source files via `fs.readFileSync` for source-grep sentinels.

### 4. Template-literal aria-label regex

Many components emit aria-labels via JSX template literals: `aria-label={`Move ${book.title} up in queue`}`. A regex like `aria-label=["'][^"']*Move[^"']*up` won't match because the value is wrapped in `{` ` ` `}`.

```typescript
// Matches `aria-label="Move ... up"`, `'Move ... down'`, AND
// `aria-label={`Move ${title} up`}` style usages.
const MOVE_LABEL_PATTERN =
  /aria-label=(?:[{][`"']|[`"'])[^`"']*[Mm]ove[^`"']*?\b(up|down)\b/
```

The leading delimiter alternation `(?:[{][`"']|[`"'])` admits either a quote-only or `{` `` `-prefixed value. The `[^`"']*` body excludes all three quote characters so the match terminates at the right boundary even when `${expr}` interpolations appear inside.

### 5. Paste-blocking detection for SC 3.3.8

To assert a password input doesn't block paste (WCAG 2.5.7 / 3.3.8 password-manager support), dispatch a synthetic `ClipboardEvent` and read `event.defaultPrevented`:

```typescript
const defaultPrevented = await passwordInput.evaluate((el) => {
  const event = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: new DataTransfer(),
  })
  el.dispatchEvent(event)
  return event.defaultPrevented
})
expect(defaultPrevented).toBe(false)
```

Cleaner than integrating with the OS clipboard, deterministic, runs in chromium without flakiness.

## Why This Matters

- **Avoids duplicate test runtime** when an aggregator pattern is added on top of mature per-criterion specs.
- **Catches both runtime and source-level regressions** for contract patterns where one alone produces false negatives or false positives.
- **Prevents the most common ESM/regex traps** when audit specs need to grep source files for design contracts (move buttons, autocomplete attributes, focus styles, etc.).

## When to Apply

- Adding aggregator suites on top of existing per-feature E2E specs (a11y, security, performance audits).
- Asserting a JSX-level design contract (component import, aria-label pattern) where a runtime DOM walk can't reach every callsite.
- Any Playwright spec that needs to read source files via `fs`.
- Any audit that asserts paste-allowed behavior on input controls.

## References

- Story: `docs/implementation-artifacts/stories/E66-S06-compliance-report-automated-testing.md`
- Plan: `docs/plans/2026-04-25-006-feat-e66-s06-compliance-report-automated-testing-plan.md`
- Spec: `tests/audit/wcag-2.2-compliance.spec.ts`
- Report: `docs/reviews/accessibility/wcag-2.2-compliance-report.md`
- PR: <https://github.com/PedroLages/knowlune/pull/447>
