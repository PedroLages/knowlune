# Design Review Report

**Review Date**: 2026-03-22
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Story**: E22-S01 — Ollama Local AI Provider Integration
**Changed Files**:
- `src/app/components/figma/AIConfigurationSettings.tsx`
- `src/lib/aiConfiguration.ts`
**Affected Pages**: `/settings` (AI Configuration section)
**Viewports Tested**: 1440px (desktop), 768px (tablet), 375px (mobile)

---

## Executive Summary

The Ollama provider integration is well-executed. The conditional UI swap (URL field instead of password field, Advanced collapsible, relabelled Save button) is logically sound and follows the existing Settings panel pattern. ARIA semantics, error handling, and keyboard navigation are all correct. Two medium-priority issues were found — the Save button using `bg-primary` (dark navy) instead of `variant="brand"` (blue) per design system CTA conventions, and the Advanced toggle missing the app-standard `focus-visible:ring` treatment — plus one low-priority concern about the `code` element styling in the Advanced panel description.

---

## What Works Well

- The ARIA chain on validation errors is complete and correct: `aria-invalid="true"` on the input, `aria-describedby="connection-error"` pointing to the visible error element, wrapped in an `aria-live="polite" aria-atomic="true"` region. Screen readers will announce errors immediately on submission.
- The Advanced collapsible uses proper `aria-expanded` / `aria-controls` semantics (`aria-expanded="false/true"`, `aria-controls="ollama-advanced"` pointing to `id="ollama-advanced"`), which is the correct pattern for a disclosure widget.
- Validation error messages are specific and actionable: "Invalid URL format. Must start with http:// or https://" and "Ollama server URL is required" are both clear and guide recovery.
- The Direct Connection toggle row enforces `min-h-[44px]` explicitly, meeting the mobile touch target requirement. The Save URL button also enforces `min-h-[44px]`.
- The Advanced panel collapses back to its default (closed) state automatically when the provider is changed, which is good state hygiene.
- The `animate-in fade-in-0 slide-in-from-top-1 duration-200` animation on the Advanced panel reveal is purposeful and within the 150–350ms design system range. The global `prefers-reduced-motion: reduce` rule in `index.css` suppresses it for users who prefer less motion.
- All text contrast ratios pass WCAG AA: muted text (rgb 101, 104, 112) on white card = **5.57:1**, primary text (rgb 28, 29, 43) on white = **16.67:1**.
- No horizontal scroll at any tested viewport.
- Zero console errors introduced by this story (the pre-existing `DialogContent` missing title warning is unrelated).

---

## Findings by Severity

### HIGH — Should fix before merge

**H1: Save button uses `bg-primary` (dark navy) instead of `variant="brand"` (blue CTA)**

- **Location**: `src/app/components/figma/AIConfigurationSettings.tsx:311`
- **Evidence**: Computed `backgroundColor: rgb(28, 29, 43)` (`--primary: #1c1d2b`). The brand blue is `--brand: #5e6ad2`. The same button on other providers ("Save & Test Connection") has the same issue.
- **Impact**: The design system defines `variant="brand"` as the correct CTA treatment for primary actions. Using `bg-primary` (the dark sidebar/heading navy) for a submit button conflates two visually distinct semantic roles — navigation chrome colour vs. action colour. Users learn that blue = "do something important"; dark navy on a button creates an inconsistency that erodes pattern recognition over time, which matters more as the platform adds more AI feature CTAs.
- **Suggestion**: Change `<Button onClick={handleSave} ...>` to add `variant="brand"` (or equivalently remove the implicit default and use `variant="brand"`). The `min-h-[44px] rounded-lg` className overrides can stay.

### MEDIUM — Fix when possible

**M1: Advanced toggle button lacks the app-standard `focus-visible:ring` treatment**

- **Location**: `src/app/components/figma/AIConfigurationSettings.tsx:243`
- **Evidence**: Computed focus outline on the Advanced `<button>`: `oklab(0.708 0 0 / 0.5) solid 2px` (browser default). The shadcn Select trigger and Save button use `focus-visible:ring-[3px] focus-visible:ring-ring/50` from their component classes. The Advanced button has no `focus-visible` classes in its `className`.
- **Impact**: While a 2px browser-default outline is technically a visible focus indicator (passes WCAG 2.4.7), the inconsistency is noticeable when tabbing through the AI Config panel: the provider dropdown shows a brand-blue styled ring, then the Advanced toggle shows a grey browser outline, then the Save button shows no visible ring (shadcn suppresses the outline in favour of a ring-box-shadow that only fires with `:focus-visible`). The experience is jarring for keyboard users navigating through the form.
- **Suggestion**: Add `focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring outline-none` to the Advanced button's className to align with the app-standard focus treatment.

**M2: `<code>` element in Advanced description has no background highlight**

- **Location**: `src/app/components/figma/AIConfigurationSettings.tsx:266–267`
- **Evidence**: `<code className="font-mono">OLLAMA_ORIGINS=*</code>` renders with `backgroundColor: rgba(0, 0, 0, 0)` — fully transparent. The text is `rgb(101, 104, 112)` (muted foreground) in monospace, which is technically legible (5.57:1 contrast) but lacks the conventional code chip treatment that signals "this is a terminal command you should type".
- **Impact**: Users who are not familiar with Ollama may not recognise `OLLAMA_ORIGINS=*` as a shell environment variable to set. A subtle background chip (e.g. `bg-muted rounded px-1`) is the conventional affordance that says "this is copyable/terminal text", reducing the chance of users misreading it as regular descriptive text.
- **Suggestion**: Add `bg-muted rounded px-1 py-0.5` to the `<code>` element's className. This is a low-effort cosmetic change with a meaningful comprehension benefit for technical instructions.

### LOW — Optional

**L1: Provider selector uses a hardcoded `w-48` width that is not responsive**

- **Location**: `src/app/components/figma/AIConfigurationSettings.tsx:204` (SelectTrigger `className="mt-1 w-48"`)
- **Evidence**: Computed width is 192px at all viewports (desktop, tablet, mobile). This is pre-existing and applies to all providers, not just Ollama.
- **Impact**: On 375px mobile, 192px for a 13-character label ("Ollama (Local)") is proportionally large relative to the 266px content area. The selector works correctly but appears visually heavier than needed. A responsive `w-48 sm:w-48` or simply `w-full max-w-[12rem]` would adapt better.
- **Suggestion**: Consider `w-full sm:w-48` as a follow-up cleanup — applies to all providers, not Ollama-specific.

---

## Detailed Findings

### H1: Save button colour token
```
Button computed backgroundColor:  rgb(28, 29, 43)  [--primary: #1c1d2b  — dark navy]
Expected for CTA per design system: rgb(94, 106, 210) [--brand: #5e6ad2   — brand blue]
File: src/app/components/figma/AIConfigurationSettings.tsx:311
Fix:  add variant="brand" to <Button>
```

### M1: Advanced toggle focus ring
```
Advanced button focus outline: oklab(0.708 0 0 / 0.5) solid 2px  [browser default]
SelectTrigger focus ring:      focus-visible:ring-[3px] focus-visible:ring-ring/50  [app standard]
File: src/app/components/figma/AIConfigurationSettings.tsx:243
Fix:  add "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring outline-none"
```

### M2: Code element styling
```
<code> backgroundColor: rgba(0,0,0,0)  [no background]
Conventional treatment: bg-muted rounded px-1 py-0.5
File: src/app/components/figma/AIConfigurationSettings.tsx:266
```

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (normal text) | Pass | Muted text 5.57:1, primary text 16.67:1 |
| Text contrast ≥3:1 (large text) | Pass | All headings well above threshold |
| Keyboard navigation — tab order | Pass | URL input → Advanced toggle → Save URL (logical) |
| Keyboard activation (Enter/Space on buttons) | Pass | All buttons respond to keyboard |
| Focus indicators visible | Partial | Advanced toggle uses browser-default outline, not app-standard ring (M1) |
| Heading hierarchy | Pass | H3 for AI Configuration, consistent with other Settings sections |
| ARIA labels on icon buttons | Pass | Direct Connection switch has `aria-label="Direct connection to Ollama server"` |
| `aria-expanded` on disclosure | Pass | Advanced toggle correctly sets `aria-expanded` true/false |
| `aria-controls` links to panel | Pass | `aria-controls="ollama-advanced"` points to `id="ollama-advanced"` |
| Form labels associated with inputs | Pass | `htmlFor="api-key"` / `id="api-key"`, `htmlFor="ollama-direct"` / `id="ollama-direct"` |
| Error announced to screen readers | Pass | `aria-live="polite"` region, `aria-invalid="true"`, `aria-describedby` chain |
| `prefers-reduced-motion` | Pass | Global rule in `index.css` suppresses `animate-in` animations |
| Semantic HTML | Pass | `<button type="button">` for Advanced toggle, no `<div onClick>` |

---

## Responsive Design Verification

| Viewport | Status | Notes |
|----------|--------|-------|
| Desktop (1440px) | Pass | All elements render correctly. Card `border-radius: 24px`. Advanced container renders within card bounds. |
| Tablet (768px) | Pass | No horizontal scroll. scrollWidth 757px < clientWidth 768px. All elements reflow correctly. |
| Mobile (375px) | Pass* | No horizontal scroll. All button heights ≥44px. URL input and provider selector are 36px (pre-existing shadcn `h-9` default, not a regression from this story). |

*The 36px input/selector height on mobile is noted as a pre-existing systemic issue with the shadcn `Input` and `SelectTrigger` defaults in this settings panel, affecting all providers equally.

---

## Recommendations

1. **Fix H1 first** — change the Save button to `variant="brand"`. It is a one-word change and aligns the most visible interactive element with the design system's CTA convention. This is especially important as more AI features are added and users develop muscle memory for the settings flow.

2. **Fix M1 alongside H1** — adding the `focus-visible:ring` classes to the Advanced toggle button is also a minimal change and brings keyboard navigation to a consistent standard across the entire AI Config panel.

3. **Fix M2 opportunistically** — the `<code>` chip background is a 15-second cosmetic fix (`bg-muted rounded px-1 py-0.5`) that meaningfully improves comprehension for a technical instruction. Worth doing in the same PR if fixing H1 and M1.

4. **Track L1 as a backlog item** — the `w-48` hardcoded selector width is pre-existing and applies globally. Raise it in the Settings page backlog rather than addressing it in this story.
