# Design Review — Settings Page

**Review Date**: 2026-03-26
**Reviewed By**: Claude Code (design-review agent via Playwright MCP)
**Route Tested**: `/settings` — `http://localhost:5173/settings`
**Source Files Audited**:
- `src/app/pages/Settings.tsx`
- `src/app/components/settings/EngagementPreferences.tsx`
- `src/app/components/settings/FontSizePicker.tsx`
- `src/app/components/settings/QuizPreferencesForm.tsx`
- `src/app/components/settings/SubscriptionCard.tsx`
- `src/app/components/settings/AccountDeletion.tsx`
- `src/app/components/settings/MyDataSummary.tsx`
- `src/app/components/settings/avatar-upload-zone.tsx`
- `src/app/components/figma/AIConfigurationSettings.tsx`
- `src/app/components/figma/ReminderSettings.tsx`
- `src/app/components/figma/CourseReminderSettings.tsx`
- `src/app/components/figma/YouTubeConfigurationSettings.tsx`

---

## Executive Summary

The Settings page is a well-structured, feature-rich implementation covering profile, appearance, accessibility, reminders, AI/YouTube configuration, quiz preferences, and data management. Design token compliance is excellent — no hardcoded hex colors were found anywhere in the settings surface. The three primary concerns requiring attention are: a heading hierarchy skip (H1 → H3) in the Account card, several switch/radio controls missing `aria-label` attributes on the underlying Radix primitive buttons, and a missing `variant="brand"` on the primary Save Profile button. Responsive layout passes at all three breakpoints with no horizontal overflow.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1: Heading hierarchy skips H2 — Account card uses `<h3>` directly after `<h1>`**

The `Account` section is rendered via `<CardTitle>`, which the shadcn Card component renders as an `<h3>`. This is the first card after the page `<h1 className="text-2xl font-bold">Settings</h1>`, creating a direct H1 → H3 skip. Screen readers announce headings in sequence for navigation; an H2 gap breaks this contract and can cause confusion for learners using heading navigation to jump between settings sections.

The hierarchy observed:
```
H1 — Settings
H3 — Account          ← skip (missing H2)
H2 — Your Profile
H2 — Appearance
...
H3 — Engagement Preferences
H3 — Data Management  ← jumps back to H3 after H4s
```

- **Location**: `src/app/pages/Settings.tsx:491` — `<CardTitle className="text-lg font-display leading-none">Account</CardTitle>`
- **Fix**: Replace `<CardTitle>` with `<h2>` styled to match, or pass an `asChild` prop if the component supports it. Alternatively, apply `className="text-lg font-display leading-none"` directly to an `<h2>` element, matching the pattern used in the Profile, Appearance, and Navigation cards (which correctly use `<h2>`).

---

### High Priority (Should fix before merge)

**H1: Theme radio group has no accessible label**

The Appearance section's `<RadioGroup value={theme} onValueChange={setTheme}>` has no `aria-label` or `aria-labelledby`. The individual `<RadioGroupItem>` buttons also have no `aria-label` — they rely solely on the wrapping `<label>` text, but the underlying Radix `<button role="radio">` emits no text content. Screen readers using Safari/VoiceOver may not announce the option label correctly when the button itself has no accessible name.

- **Location**: `src/app/pages/Settings.tsx:741` — `<RadioGroup value={theme} onValueChange={setTheme} className="mt-4">`
- **Evidence**: Live DOM check showed `ariaLabel: null` on all three theme radio buttons (system, light, dark).
- **Fix**: Add `aria-label="Theme"` to the `<RadioGroup>`. For each `<label>` + `<RadioGroupItem>` pair, add `aria-label` to the `RadioGroupItem` (e.g., `aria-label="System — Matches your device settings"`), following the pattern already used in `QuizPreferencesForm.tsx:129`.

**H2: Color Scheme radio group has no accessible label**

The `<RadioGroup>` for Color Scheme in `EngagementPreferences.tsx` also has no `aria-label` or `aria-labelledby`. The label "Color Scheme" is a nearby `<Label>` element but is not programmatically associated with the radio group.

- **Location**: `src/app/components/settings/EngagementPreferences.tsx:95` — `<RadioGroup value={colorScheme} ...>`
- **Fix**: Add `aria-label="Color scheme"` or associate the existing `<Label>` with an `id`/`aria-labelledby` pair.

**H3: Save Profile button missing `variant="brand"`**

The Save Profile Changes button at `Settings.tsx:713` does not specify a `variant` prop, causing it to render with the default shadcn variant (which in dark mode resolves to the dark surface color `rgb(28, 29, 43)` with white text — visually acceptable but semantically incorrect). The styling rules mandate `variant="brand"` for primary CTAs. Additionally, the button uses `hover:scale-[1.02]` transform without `motion-safe:` guard — this animation fires unconditionally even for users with `prefers-reduced-motion: reduce`.

- **Location**: `src/app/pages/Settings.tsx:713-717`
- **Evidence (computed)**: `backgroundColor: rgb(28, 29, 43)` in light mode (should be brand blue `rgb(37, 99, 235)` range).
- **Fix**: Add `variant="brand"` to the Button. Change `hover:scale-[1.02]` to `motion-safe:hover:scale-[1.02]`.

**H4: Three switches missing `aria-label` on the Radix primitive**

The switches for `show-immediate-feedback`, `shuffle-questions`, and `enable-reminders` have associated `<Label htmlFor="...">` elements, which is correct for mouse users. However, the underlying Radix `<button role="switch">` does not carry an `aria-label` attribute directly — it depends on the label association. In some assistive technology combinations (particularly on iOS), label-for associations with switch controls can be unreliable. The EngagementPreferences toggles correctly include `aria-label` on the Switch as a belt-and-suspenders approach.

- **Location**: `src/app/components/settings/QuizPreferencesForm.tsx:160, 182`; `src/app/components/figma/ReminderSettings.tsx` (enable-reminders switch)
- **Fix**: Add `aria-label="Show immediate feedback"` (etc.) to each `<Switch>` component to match the pattern already used in `EngagementPreferences.tsx:79`.

**H5: `aria-describedby` missing on Display Name and Bio inputs (character counter)**

The Display Name (`id="name"`) and Bio (`id="bio"`) inputs each have a visible character counter (`{count}/{limit}`) and helper text beneath them. Neither counter nor helper text is linked via `aria-describedby`, so screen reader users typing into these fields do not receive the character-limit hint or the contextual description.

- **Location**: `src/app/pages/Settings.tsx:663` (Input, id="name"), `src/app/pages/Settings.tsx:694` (Textarea, id="bio")
- **Evidence**: Playwright check confirmed `hasAriaDescribedby: false` for both fields.
- **Fix**: Assign ids to the counter spans (e.g., `id="name-counter"`, `id="bio-helper"`) and add `aria-describedby="name-counter name-helper"` to each input.

**H6: Search button touch target is 36px tall (below 44px minimum)**

The header search button measures 320×36px across all viewports. On mobile this is a tappable surface with no additional padding, falling 8px short of the 44px minimum touch target requirement.

- **Location**: Layout header component (not Settings-specific, but present on this page)
- **Evidence**: `searchBar: { width: 320, height: 36 }` measured at all three viewports.
- **Fix**: Apply `min-h-[44px]` to the search button in the Layout header.

---

### Medium Priority (Fix when possible)

**M1: Sidebar nav links measure 40px tall (4px short of 44px)**

All sidebar navigation `<a>` elements measure 172×40px at desktop and 231×40px at tablet — 4px below the 44px minimum. While not a blocker for desktop use where pointer precision is higher, this is worth fixing for consistency.

- **Location**: Layout sidebar component
- **Fix**: Add `min-h-[44px]` or additional vertical padding to sidebar nav items.

**M2: Multiple icon-only info-tip buttons are 16×16px**

Several information tooltip triggers (e.g., "API key information", "yt-dlp server information", "Whisper endpoint information") are rendered as 16×16px buttons. Even on desktop these are unusually small. They carry `aria-label` values which is good, but the physical target size should meet the WCAG 2.5.8 (Level AA in 2.2) minimum target size of 24×24px for icon-only controls, and ideally 44×44px for touch.

- **Location**: `src/app/components/figma/AIConfigurationSettings.tsx`, `YouTubeConfigurationSettings.tsx`
- **Fix**: Wrap tooltip triggers in a container with padding: `p-3` (to expand the clickable area without changing visual size), or increase the icon size.

**M3: `animate-in` entrance animations in Settings.tsx are not guarded with `motion-safe:`**

The upload progress indicator, error message, success indicator, and save confirmation all use `animate-in fade-in slide-in-from-top-1 duration-300` without `motion-safe:` guards. The global CSS in `src/styles/index.css` provides `prefers-reduced-motion: reduce` overrides, which is a good fallback, but Tailwind's `motion-safe:` prefix is the idiomatic approach and makes the intent clearer at the component level.

- **Location**: `src/app/pages/Settings.tsx:597, 613, 624, 722, 1033`
- **Fix**: Prefix these classes with `motion-safe:` (e.g., `motion-safe:animate-in motion-safe:fade-in`). The global CSS override provides a reasonable safety net for now.

**M4: Heading inconsistency — some section cards use `<h2>`, others use `<CardTitle>` (renders as `<h3>`)**

Across the settings page, card headings are split between raw `<h2>` elements and `<CardTitle>` (which renders as `<h3>`). This is inconsistent and makes the heading outline unpredictable:

- Account → H3 (via CardTitle)
- Your Profile → H2
- Appearance → H2
- Navigation → H2
- Font Size → H2
- Age Range → H2
- Engagement Preferences → H3 (via CardTitle in sub-component)
- Study Reminders → H3 (via CardTitle in sub-component)
- AI Configuration → H3 (via CardTitle)
- Data Management → H3 (via CardTitle)

Sub-components (EngagementPreferences, QuizPreferencesForm, etc.) using `CardTitle` naturally produce H3. A decision should be made: either all top-level settings cards use H2 (and sub-components use CardTitle/H3 for their own inner structure), or a consistent approach is applied.

- **Fix**: Settings-page-level cards (Account, Data Management) should use `<h2>` directly. Sub-component cards (Engagement, Reminders, AI, Quiz) can keep `CardTitle` as H3 if the page-level cards are correct H2s — that produces a valid H1 → H2 → H3 hierarchy.

**M5: `<DialogContent>` missing Description — React warning triggered at tablet viewport**

A React warning `Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}` was captured from the browser console at 768px viewport. This suggests a Dialog (likely the AuthDialog or a Sheet) rendered at tablet is missing its `<DialogDescription>` or an explicit `aria-describedby={undefined}` opt-out.

- **Location**: Unknown sub-component (detected at 768px); likely `src/app/components/auth/AuthDialog.tsx`
- **Fix**: Add a `<DialogDescription>` to every `DialogContent`, or pass `aria-describedby={undefined}` if no description is semantically needed.

---

### Nitpicks (Optional)

**N1: Appearance card and Navigation card `<CardHeader>` lack the sunken background treatment**

The Appearance and Navigation cards use bare `<CardHeader>` without the `border-b border-border/50 bg-surface-sunken/30` classes that all other setting cards use. This creates a subtle visual inconsistency in the header treatment.

- **Location**: `src/app/pages/Settings.tsx:735, 813`

**N2: `<div>` root element in `Settings()` return — consider `<section>` or wrapping semantics**

The Settings page returns a plain `<div>` as its root. A `<section aria-labelledby="settings-heading">` (with the H1 having `id="settings-heading"`) would provide a proper landmark region for screen reader users.

**N3: "Danger Zone" and "Reset All Data" are both `<h4>` — consider making Danger Zone an `<h3>` subsection**

Within Data Management (H3/H4 level), the "Danger Zone" section header is an `<h4>`. "Reset All Data" is also an `<h4>`, making them siblings rather than parent/child. "Danger Zone" as an `<h3>` subsection header within Data Management, with "Reset All Data" as `<h4>`, would better express the grouping intent.

---

## What Works Well

1. **Design token compliance is excellent.** Zero hardcoded hex colors were found across all 12 files audited. The codebase consistently uses `text-brand`, `bg-brand-soft`, `text-destructive`, `text-muted-foreground`, `text-success`, `text-warning`, etc. This is a strong foundation for reliable dark mode.

2. **Touch target compliance on primary actions is solid.** All Button components in the settings surface correctly apply `min-h-[44px]`, including export buttons, import, reset, re-apply defaults, sign-in/sign-up, and save. This is the right level of care for a form-heavy settings page.

3. **Dark mode implementation is visually correct.** Switching to dark theme shows `body: rgb(26, 27, 38)`, card surfaces at `rgb(36, 37, 54)`, `brand-soft` at `rgb(42, 44, 72)`, and text colors that all appear to maintain readable contrast. No white-on-white or black-on-black issues were observed.

4. **`SubscriptionCard.tsx` shows exemplary motion-safe usage.** All `Loader2` spinners across 8 instances correctly use `motion-safe:animate-spin`, demonstrating the right pattern. This should be propagated to `Settings.tsx`'s own animation classes.

5. **No horizontal overflow at any viewport.** All three viewport tests (375px, 768px, 1440px) returned `hasHorizontalOverflow: false`. The single-column max-width layout (`max-w-2xl`) degrades cleanly across breakpoints.

6. **Character counters provide helpful visual feedback.** The `getCounterColor` function correctly transitions through `text-muted-foreground → text-warning → text-destructive` at 80% and 95% capacity. This is a thoughtful progressive disclosure of urgency.

7. **Data export buttons are well-labeled.** All export/import buttons carry `aria-label` attributes with descriptive format text ("Export all data as JSON", "Import data from JSON backup file"), which is excellent for screen reader users.

---

## Detailed Findings

### Finding 1: H1 → H3 heading skip on Account card

- **Issue**: `<CardTitle>` renders as `<h3>`. The Account card is the first card after `<h1>Settings</h1>`, creating a direct H1 → H3 skip.
- **Location**: `src/app/pages/Settings.tsx:491`
- **Evidence**: Playwright heading hierarchy inspection: `[H1 Settings, H3 Account, H2 Your Profile, ...]`
- **Impact**: Screen reader users navigating by heading (e.g., pressing H in NVDA) will encounter a structural gap. WCAG 1.3.1 (Level A) requires proper structural hierarchy. This is a common but significant barrier for learners with visual impairments.
- **Suggestion**: Use `<h2 className="text-lg font-display leading-none">Account</h2>` directly, matching the style of the Profile, Appearance, and Navigation cards that already use `<h2>`.

### Finding 2: Theme RadioGroup missing accessible label

- **Issue**: The Appearance card's theme picker `<RadioGroup>` has no `aria-label` or `aria-labelledby`.
- **Location**: `src/app/pages/Settings.tsx:741`
- **Evidence**: `radioGroups[0]: { ariaLabel: null, ariaLabelledby: null, childCount: 3 }`
- **Impact**: Screen reader users navigating into the radio group have no announced group name. They hear "System, selected" without knowing this is the "Theme" choice.
- **Suggestion**: `<RadioGroup aria-label="Theme" ...>`. Also add `aria-label` to each `RadioGroupItem` with value + description (e.g., `aria-label="System — Matches your device settings"`).

### Finding 3: Save Profile button defaults to wrong variant

- **Issue**: Primary CTA uses no `variant` prop; defaults to `"default"` instead of `"brand"`.
- **Location**: `src/app/pages/Settings.tsx:713-717`
- **Evidence**: `saveButton.backgroundColor = rgb(28, 29, 43)` — this is the `default` dark surface color, not brand blue.
- **Impact**: Minor in light mode (the default variant is visually dark and acceptable), but semantically incorrect. In dark mode the button blends with the card surface more than intended. The design system rule is explicit: primary CTAs use `variant="brand"`.
- **Suggestion**: Add `variant="brand"` to the Button. Also add `motion-safe:` to `hover:scale-[1.02]`.

### Finding 4: Display Name and Bio inputs missing `aria-describedby` for character counters

- **Issue**: Both inputs have visible helper text and character counters but no `aria-describedby` linkage.
- **Location**: `src/app/pages/Settings.tsx:663` (name input), `694` (bio textarea)
- **Evidence**: `{ id: "name", hasAriaDescribedby: false }` and `{ id: "bio", hasAriaDescribedby: false }`
- **Impact**: A screen reader user typing in the display name field will not be announced the character limit or the helper text "This is how others will see your name across the platform." They have no way to discover these without navigating away from the field.
- **Suggestion**:
  ```tsx
  // Add ids to the counter and description elements:
  <span id="name-counter" ...>{displayNameCount}/{DISPLAY_NAME_LIMIT}</span>
  <p id="name-helper" ...>This is how others will see your name...</p>
  // Then on the Input:
  <Input id="name" aria-describedby="name-counter name-helper" ... />
  ```

### Finding 5: Multiple unlabeled checkbox inputs (3 instances)

- **Issue**: Three checkbox `<input type="checkbox">` elements have no `id`, no `aria-label`, and no associated `<label>`.
- **Location**: Detected in DOM; likely in `AIConfigurationSettings.tsx` consent toggles or reminder day-of-week checkboxes
- **Evidence**: `[{ tag: INPUT, id: none, type: checkbox }, ...]` — three instances
- **Impact**: Screen readers announce these as "checkbox" with no name — learners cannot determine what is being toggled. This fails WCAG 1.3.1 and 4.1.2 (Level A).
- **Suggestion**: Audit the consent toggle and reminder checkbox groups to ensure every checkbox has either `id` + `<label htmlFor>` or `aria-label`.

### Finding 6: One unlabeled textarea (in addition to the bio textarea which is correctly labeled)

- **Issue**: A second `<textarea>` exists in the DOM with no `id`, `aria-label`, or label association.
- **Location**: Unknown sub-component (likely a notes/prompt input in AIConfigurationSettings)
- **Evidence**: `{ tag: TEXTAREA, id: none }` in form field audit
- **Impact**: Screen reader users encounter an unnamed text area with no context.
- **Suggestion**: Identify and add `aria-label` or `<label htmlFor>` to this textarea.

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Pass | H1 `rgb(28,29,43)` on `rgb(250,245,238)` — excellent contrast |
| Text contrast ≥4.5:1 (dark mode) | Pass | H1 `rgb(232,233,240)` on `rgb(26,27,38)` — excellent contrast |
| Muted text contrast (light) | Pass | `rgb(101,104,112)` on `rgb(255,255,255)` — ~4.7:1 |
| Brand-soft text (dark mode) | Pass | `rgb(160,168,235)` on `rgb(42,44,72)` — passes with `brand-soft-foreground` token |
| No horizontal overflow | Pass | All three breakpoints confirmed |
| Touch targets ≥44px (primary actions) | Pass | All Button components use `min-h-[44px]` |
| Touch targets ≥44px (search bar) | Fail | 36px tall — see H6 |
| Touch targets ≥44px (sidebar nav) | Fail | 40px tall — see M1 |
| Touch targets ≥44px (info tooltip triggers) | Fail | 16px — see M2 |
| Keyboard navigation — Tab order | Partial | First Tab lands on onboarding modal "Skip for now" (overlaid dialog), not page content |
| Focus indicators visible | Partial | CSS-based focus ring present; computed `:focus-visible` outline was empty at JS query time (browser limitation) |
| Heading hierarchy | Fail | H1 → H3 skip on Account card — see B1 |
| ARIA labels on icon-only buttons | Pass | Export, import, reset, sign-out all have aria-label |
| ARIA labels on switch controls | Partial | EngagementPreferences switches: Pass. QuizPreferences and Reminders switches: Fail — see H4 |
| Radio groups accessible name | Partial | Font size and Age range: Pass. Theme picker and Color scheme: Fail — see H1, H2 |
| Form labels associated | Partial | Display Name and Bio: labeled but missing aria-describedby. 3 checkboxes unlabeled. 1 textarea unlabeled. |
| aria-live on dynamic content | Pass | Export progress has `role="status" aria-live="polite"`. Upload error has `role="alert" aria-live="polite"`. |
| aria-describedby on character-count fields | Fail | Missing — see H5 |
| prefers-reduced-motion | Partial | Global CSS override present. SubscriptionCard correctly uses `motion-safe:`. Settings.tsx entrance animations lack `motion-safe:` guard — see M3 |
| Semantic HTML | Pass | CardTitle is `<h3>` (Radix), buttons use `<button>`, links use `<a>`. Foundational semantics are correct. |
| Dark mode appearance | Pass | Colors, surfaces, and brand tokens all resolve correctly in dark mode |
| No console errors | Pass | Zero errors across all viewports |
| Console warnings | Fail | `Missing 'Description' for {DialogContent}` at 768px — likely AuthDialog — see M5 |

---

## Responsive Design Verification

- **Mobile (375px)**: Pass — Single-column layout, no overflow, cards stack correctly. The theme picker grid (`grid-cols-1 sm:grid-cols-3`) correctly collapses to a single column. Export buttons stack vertically (`flex-col sm:flex-row`).
- **Tablet (768px)**: Pass — Two-column grids visible where applicable. No overflow. The "Navigation" heading duplicate appeared in the heading tree (likely the mobile sidebar drawer).
- **Desktop (1440px)**: Pass — Max-width `max-w-2xl` correctly constrains the settings form to a readable line length. Card border radius is `24px` as required. All sections visible.

---

## Recommendations

1. **Fix the H1→H3 heading skip immediately** (B1). This is the highest-impact accessibility fix, affecting all screen reader users navigating by heading. It is a one-line change: replace `<CardTitle>` with `<h2>` on the Account card and Data Management card in `Settings.tsx`.

2. **Audit and fix all radio group labels and switch aria-labels in a single pass** (H1, H2, H4). These are low-effort, high-impact fixes. Create a pattern: every `<RadioGroup>` must have `aria-label` or `aria-labelledby`; every `<Switch>` must have `aria-label` regardless of associated label presence.

3. **Add `aria-describedby` to character-counted inputs** (H5) and identify the unlabeled checkboxes and textarea (Finding 5, 6). A targeted grep for `id="none"` inputs in the figma components will surface these.

4. **Add `variant="brand"` to the Save Profile button** (H3) and propagate `motion-safe:` guards to entrance animations in `Settings.tsx`. These are quick wins that align implementation with the documented design system rules.

---

*Report generated by Claude Code design-review agent. Screenshots saved to `/tmp/settings-screenshots/`.*
