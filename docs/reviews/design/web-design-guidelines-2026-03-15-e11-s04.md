# Web Design Guidelines Review: E11-S04 Data Export UI

**Date:** 2026-03-15
**Reviewer:** Claude Opus 4.6 (static code review)
**Scope:** Settings.tsx Data Management section (lines 560-804)
**File:** `src/app/pages/Settings.tsx`

---

## Summary

The Data Management / Export UI is well-implemented with strong accessibility practices, proper design token usage, and good error handling UX. The implementation uses semantic HTML, consistent ARIA labeling on export buttons, and leverages the shadcn/ui component library correctly. A few issues were identified, mostly at MEDIUM or LOW severity.

**Verdict:** PASS with minor improvements recommended.

---

## Findings

### 1. Missing `aria-label` on Import button

**Severity:** MEDIUM
**Line:** 714-722

The "Import" button that triggers the hidden file input lacks an `aria-label`, unlike all four export buttons which properly have descriptive labels.

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => importFileRef.current?.click()}
  className="gap-2"
>
```

**Fix:** Add `aria-label="Import data from JSON backup file"`.

---

### 2. Hidden file input lacks accessible labeling

**Severity:** MEDIUM
**Lines:** 726-732

The hidden `<input type="file">` has no `aria-label` or associated `<label>`. While it is triggered programmatically via the Import button, screen readers may still encounter it in certain navigation modes.

```tsx
<input
  ref={importFileRef}
  type="file"
  accept=".json"
  onChange={handleImport}
  className="hidden"
/>
```

**Fix:** Add `aria-label="Select JSON file for import"` and optionally `tabIndex={-1}` to prevent focus.

---

### 3. `bg-warning/10` is an opacity modifier on a design token, not a dedicated token

**Severity:** LOW
**Line:** 653

The Achievements Export icon background uses `bg-warning/10` which applies 10% opacity to the `--warning` token. While this does use the design token system (not a hardcoded color), there is no dedicated `--warning-soft` token analogous to `--success-soft` and `--brand-soft` used by the other export cards.

```tsx
<div className="rounded-lg bg-warning/10 p-2 mt-0.5">
```

**Recommendation:** Consider adding a `--warning-soft` token to `theme.css` for consistency with `--success-soft` and `--brand-soft`. This is a nice-to-have, not a violation.

---

### 4. No `disabled` state on Import button during active export

**Severity:** LOW
**Lines:** 714-722

Export buttons correctly disable via `disabled={isExporting}`, but the Import button does not. A user could attempt to import while an export is in progress, which could cause data conflicts or confusing behavior.

**Fix:** Add `disabled={isExporting}` to the Import button.

---

### 5. Danger Zone reset button lacks `aria-label`

**Severity:** LOW
**Line:** 762

The destructive "Reset" button inside the AlertDialog trigger does not have an explicit `aria-label`. Its visible text "Reset" is acceptable but ambiguous out of context.

**Fix:** Add `aria-label="Reset all data"` to the Reset button.

---

### 6. Export progress indicator lacks `role="status"` for live region

**Severity:** MEDIUM
**Lines:** 678-692

The export progress container appears/disappears dynamically but lacks `role="status"` or `aria-live="polite"`, meaning screen readers may not announce progress updates to the user.

```tsx
<div
  className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300"
  data-testid="export-progress"
>
```

**Fix:** Add `role="status"` and `aria-live="polite"` to the progress container div.

---

### 7. No responsive layout adaptation for export card action buttons

**Severity:** LOW
**Lines:** 581-618, 622-646, 650-675

The export cards use `flex items-start justify-between` which works well on desktop but on narrow viewports the description text and buttons may become cramped. The Full Data Export card has two buttons side-by-side which could overflow on very small screens.

**Recommendation:** Consider adding `flex-wrap` or switching to a stacked layout at mobile breakpoints for the dual-button row (JSON + CSV).

---

## Positive Observations

These are well-done patterns worth highlighting:

1. **Design token compliance** -- All colors use design tokens (`bg-brand-soft`, `text-brand`, `text-success`, `bg-destructive`, `text-muted-foreground`, `text-warning`, `text-destructive`). No hardcoded Tailwind color classes detected.

2. **Semantic HTML** -- Proper heading hierarchy (`h3` for section titles, `h4` for card titles within the CardContent), decorative icons marked `aria-hidden="true"`, semantic `<Button>` elements (not divs).

3. **ARIA labels on export buttons** -- All four export actions have descriptive `aria-label` attributes ("Export all data as JSON", "Export all data as CSV", "Export notes as Markdown", "Export achievements as Open Badges").

4. **Error handling UX** -- Comprehensive try/catch with user-facing toast messages via `toastError`. Edge cases handled (empty notes, empty achievements, non-JSON import files, FileReader errors). Progress state properly cleaned up in `finally` blocks.

5. **Destructive action protection** -- Reset uses `AlertDialog` with confirmation, clear warning text, and destructive button variant. Dialog description explicitly suggests exporting first.

6. **Button states** -- Export buttons properly disable during export (`disabled={isExporting}`). Guard clause `if (isExporting) return` at the top of each handler provides double protection.

7. **Progress feedback** -- Visual progress bar with phase text ("Preparing export...") provides clear feedback during async operations. Animation entrance with `animate-in fade-in`.

8. **Component library usage** -- Proper use of shadcn/ui primitives (Card, Button, Progress, AlertDialog, Separator) rather than custom implementations.

---

## Summary Table

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Missing `aria-label` on Import button | MEDIUM | Open |
| 2 | Hidden file input lacks accessible labeling | MEDIUM | Open |
| 3 | No `--warning-soft` design token | LOW | Advisory |
| 4 | Import button not disabled during export | LOW | Open |
| 5 | Reset button lacks descriptive `aria-label` | LOW | Open |
| 6 | Progress indicator missing `role="status"` / `aria-live` | MEDIUM | Open |
| 7 | Dual-button row may overflow on narrow screens | LOW | Advisory |

**BLOCKERs:** 0
**HIGH:** 0
**MEDIUM:** 3
**LOW:** 4

---

*Generated by Claude Opus 4.6 (static code review -- no browser automation)*
