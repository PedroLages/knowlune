# Design Review Report — E19-S01: Authentication Setup

**Review Date**: 2026-03-25
**Reviewed By**: Claude Code (design-review agent via Playwright)
**Branch**: `feature/e19-s01-authentication-setup`
**Changed Files**:
- `src/app/components/auth/AuthDialog.tsx` (new)
- `src/app/components/auth/EmailPasswordForm.tsx` (new)
- `src/app/components/auth/MagicLinkForm.tsx` (new)
- `src/app/components/auth/GoogleAuthButton.tsx` (new)
- `src/app/pages/Settings.tsx` (modified — account card)

**Affected Pages**: `/settings`, AuthDialog (overlay, triggered from any page in future)

---

## Executive Summary

The authentication UI is a well-structured addition to Knowlune. The three-tab dialog pattern (Email/Password, Magic Link, Google OAuth) is clear and learner-friendly. The implementation shows strong attention to touch targets, semantic HTML, and error-handling patterns. Two issues require attention before merge: a WCAG AA contrast failure on brand link text in dark mode, and tab triggers below the 44px minimum touch target height on both mobile and desktop.

---

## What Works Well

- **Design consistency**: The dialog uses `rounded-[24px]` (verified 24px computed), `p-6`, and `sm:max-w-md` (448px computed) — fully aligned with design tokens and the rest of the app.
- **Settings page Account card**: Solid visual hierarchy with Shield/LogOut icon, brand-colored "Sign Up" primary CTA alongside "Sign In" outline variant, correctly uses `variant="brand"` and `variant="brand-outline"`. Both buttons measure 44px height on desktop.
- **Form accessibility basics**: All three form inputs in `EmailPasswordForm` have proper `<label htmlFor>` associations. `auth-email`, `auth-password`, and `auth-confirm-password` IDs all correctly linked.
- **Keyboard navigation**: Dialog closes on Escape. Tab order moves logically from tab list → email input → password input. Focus ring on inputs is a clearly visible 3px box-shadow ring (confirmed via computed styles).
- **Error handling**: `role="alert"` on error containers, retry button for network errors, resend cooldown for magic link. No silent failures.
- **Loading states**: Spinner + dynamic label ("Creating account…", "Signing in…", "Sending…") with disabled inputs while loading. `aria-busy` on forms.
- **MagicLink success state**: `role="status"` with `aria-live="polite"` on the sent confirmation — correct implementation.
- **Background color**: Body background confirmed as `rgb(250, 245, 238)` — matches `#FAF5EE` token exactly. No horizontal scroll at any breakpoint.
- **prefers-reduced-motion**: Stylesheet contains the media query (confirmed present).
- **No console errors**: Zero errors or warnings during all test flows.
- **autoComplete attributes**: Correctly set — `new-password`/`current-password` for password manager integration.
- **Google icon**: `aria-hidden="true"` present on SVG icons in tabs and button.

---

## Findings by Severity

### Blockers (Must fix before merge)

**B1 — WCAG AA contrast failure: brand link text in dark mode**

- **Location**: `AuthDialog.tsx:120-127`, `AuthDialog.tsx:132-148` (mode toggle button + legal links). Also affects `MagicLinkForm.tsx` mode toggle.
- **Evidence**: Measured contrast ratio of `text-brand` links (`rgb(96, 105, 192)`) against dark dialog background (`rgb(26, 27, 38)`) = **3.48:1** — below the 4.5:1 WCAG AA minimum for normal-weight text at this size.
- **Light mode**: 4.33:1 — also marginally below 4.5:1 (technically a fail for normal text, though borderline).
- **Impact**: Learners using dark mode (common for evening study sessions) may not be able to read the "Sign In" / "Sign Up" mode-toggle link or legal text links clearly. This is a fundamental inclusion issue.
- **Suggestion**: Use `text-brand-soft-foreground` instead of `text-brand` for link text on the dialog background in both light and dark modes. This token is designed exactly for this scenario. Or apply `hover:underline` as a supplementary cue while increasing the base color weight.

---

### High Priority (Should fix before merge)

**H1 — Tab triggers below 44px touch target minimum**

- **Location**: `AuthDialog.tsx:89-102` (TabsList/TabsTrigger for Email, Magic Link, Google)
- **Evidence**: All three tab triggers measure **29px height** at desktop (1440px) and on mobile (375px). The design principles require ≥44px for all interactive elements on touch devices.
- **Impact**: On a phone or tablet, learners with larger fingers or motor impairments may mis-tap and accidentally select the wrong auth method, creating friction at the critical sign-in moment.
- **Suggestion**: Add `className="h-11"` (44px) to the `TabsList` component, or apply `min-h-[44px]` to each `TabsTrigger`. The shadcn/ui `TabsList` accepts height classes directly.

**H2 — Dialog has both `aria-label` and `aria-labelledby` pointing to the same text**

- **Location**: `AuthDialog.tsx:75` (`aria-label={title}`) + Radix's auto-generated `aria-labelledby` pointing to the `DialogTitle` with identical text.
- **Evidence**: `aria-label="Create your Knowlune account"` and `aria-labelledby="radix-_r_1m_"` where the title element (`id="radix-_r_1m_"`) reads "Create your Knowlune account". Redundant labeling — `aria-label` overrides `aria-labelledby` for screen readers, rendering the `DialogTitle` semantically unused as the dialog label.
- **Impact**: Screen readers announce the label from `aria-label` and then re-announce the visible title text, creating a double-announcement for the dialog heading. It's confusing, not harmful — but it's inaccurate.
- **Suggestion**: Remove the `aria-label={title}` prop from `DialogContent`. Radix's `DialogTitle` already provides `aria-labelledby` automatically. The title will correctly label the dialog.

**H3 — `autoComplete="username"` on sign-in email field is non-standard**

- **Location**: `EmailPasswordForm.tsx:92`
- **Evidence**: `autoComplete={isSignUp ? 'email' : 'username'}` — in sign-in mode this emits `autocomplete="username"`. The field is `type="email"` and collects an email address, not a username.
- **Impact**: Password managers (1Password, Bitwarden, iOS Keychain) may fail to autofill saved credentials when they expect `autocomplete="email"` but find `"username"`. This breaks a core usability expectation for returning learners.
- **Suggestion**: Change to `autoComplete="email"` for both modes. The `"username"` value is for text-based usernames, not email addresses. Per HTML spec, `"email"` is the correct token for email input fields used as login identifiers.

---

### Medium Priority (Fix when possible)

**M1 — Close button on AuthDialog has no visible label for screen readers**

- **Location**: `AuthDialog.tsx:74-75` — the Radix `DialogContent` renders a close button automatically. Computed check shows `aria-label` is missing on the close button.
- **Evidence**: `closeBtnAriaLabel: "no aria-label"` — the button renders as `<button>Close</button>` with text content "Close", so this is not a complete blocker (the text "Close" is accessible), but the button text is invisible (icon-only) in Radix's default rendering.
- **Impact**: Screen reader users can activate it, but the button text must be confirmed visible. Medium severity because the fallback text "Close" is accessible even without an aria-label.
- **Suggestion**: Verify the close button renders visible text or add `aria-label="Close dialog"` explicitly via `DialogClose`.

**M2 — Missing `aria-describedby` on inputs when no error is present**

- **Location**: `EmailPasswordForm.tsx:94`, `EmailPasswordForm.tsx:112`, `EmailPasswordForm.tsx:130`
- **Evidence**: `aria-describedby` is only conditionally set when the error message mentions the field's keyword. In the default (no-error) state, password fields have no description pointing users to the "At least 8 characters" placeholder text.
- **Impact**: Screen reader users don't hear the 8-character requirement until they've already committed an error. Proactive announcement would reduce form failure rates.
- **Suggestion**: Add a static helper text element below the password field (e.g., `<p id="password-hint" className="text-xs text-muted-foreground">At least 8 characters</p>`) and set `aria-describedby="password-hint"` on the input permanently. This removes the placeholder from its current dual role as both example text and requirement hint.

**M3 — Light mode brand link text is borderline non-compliant**

- **Location**: `AuthDialog.tsx:120-148`, `MagicLinkForm.tsx` toggle button
- **Evidence**: `text-brand` links in light mode measure **4.33:1** against `#FAF5EE` background. WCAG AA requires 4.5:1. The difference is small (0.17 below threshold) but it is a technical violation.
- **Impact**: Low-vision learners using light mode may have slightly reduced readability on the "Sign In"/"Sign Up" toggle link.
- **Note**: This is the same root cause as B1 — both would be resolved by switching to `text-brand-soft-foreground` on link text within the dialog.

**M4 — Google SVG icon colours are hardcoded hex values**

- **Location**: `AuthDialog.tsx:21-35`, `GoogleAuthButton.tsx:10-24`
- **Evidence**: `fill="#4285F4"`, `fill="#34A853"`, `fill="#FBBC05"`, `fill="#EA4335"` — four hardcoded hex colours in each file (8 total across both).
- **Impact**: These are intentional Google brand colours and should not change with theme tokens, so this is low functional risk. However, it triggers the `design-tokens/no-hardcoded-colors` ESLint rule. The icon is duplicated in both files.
- **Suggestion**: Extract the Google SVG into a single shared component (e.g., `src/app/components/auth/GoogleIcon.tsx`) to eliminate duplication. For the brand colors inside the SVG, add an ESLint disable comment with justification: `// eslint-disable-next-line design-tokens/no-hardcoded-colors -- Google brand colors are non-negotiable per brand guidelines`.

---

### Nitpicks (Optional)

**N1 — Mode toggle button touch target is 29×131px (height too short)**

Same underlying issue as H1 — the "Sign In" / "Sign Up" mode toggle inline button (`<button type="button">`) in the dialog footer has height ~24px (line height of the surrounding text). While it is technically a button, its clickable region is very small. Consider `py-2` or `inline-flex items-center min-h-[44px]` to grow the tap target without affecting layout.

**N2 — "Privacy Policy" and "Terms of Service" links open in new tab without visual indicator**

- **Location**: `AuthDialog.tsx:132-148`
- `target="_blank"` is used but there is no `(opens in new tab)` visually hidden text or external link icon. This is a minor WCAG 2.1 advisory (not a failure) but is a common learner expectation.

**N3 — Icon in Account card header does not convey auth state semantics**

- **Location**: `Settings.tsx:458-461`
- The icon switches between `<Shield>` (unauthenticated) and `<LogOut>` (authenticated), which is semantically clean. However, the LogOut icon in the header of the card (not the button) might confuse learners who expect the header icon to be purely decorative/categorical rather than action-indicating.

---

## Detailed Findings — Evidence Table

| # | Finding | File:Line | Computed Evidence | WCAG | Priority |
|---|---------|-----------|-------------------|------|----------|
| B1 | Brand link text contrast fails dark mode | `AuthDialog.tsx:120` | 3.48:1 (need 4.5:1) | 1.4.3 | Blocker |
| H1 | Tab trigger height 29px (need 44px) | `AuthDialog.tsx:89` | `height: 29px` computed | 2.5.5 | High |
| H2 | Redundant aria-label + aria-labelledby | `AuthDialog.tsx:75` | Both present, same text | 4.1.2 | High |
| H3 | autocomplete="username" on email field | `EmailPasswordForm.tsx:92` | `autocomplete: "username"` | 1.3.5 | High |
| M1 | Close button accessible name | `AuthDialog.tsx:74` | Rendered text "Close" present | 4.1.2 | Medium |
| M2 | No static aria-describedby for password hint | `EmailPasswordForm.tsx:99-115` | No hint ID in default state | 1.3.1 | Medium |
| M3 | Brand link contrast borderline in light mode | `AuthDialog.tsx:120` | 4.33:1 (need 4.5:1) | 1.4.3 | Medium |
| M4 | Google icon colours hardcoded, duplicated | Both files | `fill="#4285F4"` et al. | — | Medium |

---

## Accessibility Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Text contrast ≥4.5:1 (light mode) | Partial Fail | Title 15.37:1 PASS, description 5.14:1 PASS, brand links 4.33:1 FAIL (M3) |
| Text contrast ≥4.5:1 (dark mode) | Fail | Brand link text 3.48:1 — WCAG AA violation (B1) |
| Keyboard navigation | Pass | Tab order logical, Escape closes dialog |
| Focus indicators visible | Pass | 3px box-shadow ring on inputs, outline on tabs |
| Heading hierarchy | Pass | `<h2>` title inside dialog, no heading nesting issues |
| ARIA labels on icon buttons | Pass | Google SVGs have `aria-hidden="true"` |
| Form labels associated | Pass | All three inputs correctly linked via `htmlFor`/`id` |
| Semantic HTML | Pass | `<form>`, `<label>`, `<button type="submit">`, no clickable `<div>` |
| Live regions for dynamic content | Pass | MagicLink success state has `aria-live="polite"`, error containers have `role="alert"` |
| Redundant ARIA labeling | Fail | `aria-label` + `aria-labelledby` both on dialog (H2) |
| autoComplete tokens correct | Fail | `"username"` used for email field in sign-in mode (H3) |
| Touch targets ≥44px | Fail | Tab triggers 29px height (H1), mode toggle ~24px (N1) |
| prefers-reduced-motion | Pass | Media query present in stylesheets |
| No console errors | Pass | Zero errors or warnings in all test flows |
| Loading states for async ops | Pass | Spinner + label text + disabled inputs |
| Error recovery actions | Pass | Retry button for network errors, resend for magic link |

---

## Responsive Design Verification

**Mobile (375px)**: Partial Pass
- No horizontal scroll. Account card and buttons stack cleanly.
- Auth dialog fills width with `max-w-[calc(100%-2rem)]` — correct.
- Tab triggers 29px height — too small for touch (H1).
- Bottom navigation bar visible and not overlapping dialog.
- Screenshot: `/tmp/auth-dialog-mobile-clean.png`

**Tablet (768px)**: Pass
- Settings page sidebar collapses to a Sheet drawer — expected behavior.
- Dialog displays at correct width (448px max).
- No horizontal scroll.
- Screenshot: `/tmp/settings-tablet-clean.png`, `/tmp/auth-dialog-tablet.png`

**Desktop (1440px)**: Pass
- Persistent sidebar visible. Content area max-width well-proportioned.
- Dialog centers correctly at 448px max-width.
- Account card buttons both 44px height — meets target.
- Screenshot: `/tmp/settings-desktop-full.png`, `/tmp/auth-dialog-signup.png`

---

## Recommendations

1. **Fix dark mode brand link contrast immediately** (B1 + M3): Replace `text-brand` with `text-brand-soft-foreground` on the mode toggle button and legal links inside the dialog. This single token swap resolves both the blocker and the medium priority finding simultaneously.

2. **Increase tab trigger height to 44px** (H1): Add `className="h-11"` to the `<TabsList>` element in `AuthDialog.tsx`. This is a one-line change that satisfies WCAG 2.5.5 (Target Size) and the platform's own design principles.

3. **Remove redundant `aria-label` from DialogContent** (H2): Delete `aria-label={title}` from `<DialogContent>`. Radix handles dialog labeling via `<DialogTitle>` + `aria-labelledby` automatically. This cleans up the double-announcement without any visual change.

4. **Fix autocomplete token for sign-in email** (H3): Change `autoComplete={isSignUp ? 'email' : 'username'}` to `autoComplete="email"` in `EmailPasswordForm.tsx`. Password managers rely on this for autofill accuracy.

