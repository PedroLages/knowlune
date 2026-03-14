# Epic 19: Platform & Entitlement — UX Specification

**Type:** Text-based UX specification (no Figma)
**Author:** Claude Code
**Date:** 2026-03-14
**Epic:** Epic 19 — Platform & Entitlement
**Status:** Draft

---

## Table of Contents

1. [Auth Modal](#1-auth-modal)
2. [Settings > Subscription Section](#2-settings--subscription-section)
3. [Upgrade CTA Component](#3-upgrade-cta-component)
4. [Trial Indicator](#4-trial-indicator)
5. [Trial Expiry Reminder](#5-trial-expiry-reminder)
6. [Legal Pages](#6-legal-pages-privacy-terms)
7. [Account Deletion Flow](#7-account-deletion-flow)
8. [Data Summary Page](#8-data-summary-page-settings--account--my-data)

---

## 1. Auth Modal

### Component

shadcn `Dialog` (desktop/tablet) / shadcn `Sheet` with `side="bottom"` (mobile <640px, full-screen).

### Layout

```
┌──────────────────────────────────────┐
│  [X]                                 │  ← DialogClose, top-right
│                                      │
│        LevelUp Logo (centered)       │
│        "Sign in to LevelUp"          │  ← h2, font-display
│                                      │
│   ┌──────┬────────────┬──────────┐   │
│   │Email │ Magic Link │  Google  │   │  ← Tabs component
│   └──────┴────────────┴──────────┘   │
│                                      │
│   ┌──────────────────────────────┐   │
│   │  [Tab content — see below]   │   │
│   └──────────────────────────────┘   │
│                                      │
│   Don't have an account? Sign Up     │  ← Toggle link, text-brand
│                                      │
│   By continuing you agree to our     │
│   Privacy Policy and Terms of Service│  ← text-muted-foreground, text-sm
└──────────────────────────────────────┘
```

Width: `max-w-md` (28rem). Padding: `p-6`. Border radius: `rounded-[24px]`.

### Tabs

Use shadcn `Tabs` with `TabsList` + `TabsTrigger` + `TabsContent`.

**Tab 1 — Email/Password:**

| Field | Component | Validation | Error message |
|-------|-----------|------------|---------------|
| Email | `Input` type="email" | Required, valid email format | "Enter a valid email address" |
| Password | `Input` type="password" | Required, min 8 chars, 1 uppercase, 1 number | "Password must be at least 8 characters with 1 uppercase letter and 1 number" |

- Sign Up mode adds "Confirm Password" field with match validation: "Passwords do not match"
- Submit button: `Button` with `bg-brand hover:bg-brand-hover text-brand-foreground`, full width
- Loading state: button shows `Loader2` icon (lucide-react) with `animate-spin`, disabled, text changes to "Signing in..."

**Tab 2 — Magic Link:**

| Field | Component | Validation | Error message |
|-------|-----------|------------|---------------|
| Email | `Input` type="email" | Required, valid email format | "Enter a valid email address" |

- Submit button: "Send Magic Link" — same styling as above
- Success state: replace form with check-circle icon (`CheckCircle` from lucide-react) + "Check your email for a sign-in link" message, `text-success`
- Resend link after 60s countdown, `text-muted-foreground` until active

**Tab 3 — Google:**

- Single button: outline variant with Google "G" icon (inline SVG or lucide `Chrome` as placeholder)
- Button text: "Continue with Google"
- Full width, `variant="outline"`, `h-12`

### Sign In / Sign Up Toggle

- Bottom of dialog: "Don't have an account? **Sign Up**" / "Already have an account? **Sign In**"
- Toggle link uses `text-brand hover:underline`
- Switching modes preserves the active tab selection
- Sign Up mode shows additional "Confirm Password" field on Email tab only

### Validation States

- **Error:** `Input` gets `border-destructive` ring. Error text below in `text-destructive text-sm`, linked via `aria-describedby`
- **Success:** `Input` gets `border-success` ring (post-submission)
- **Server error:** Alert banner inside dialog using shadcn `Alert` with `variant="destructive"`: e.g., "Invalid credentials" or "Email already registered"

### Legal Links

- "Privacy Policy" and "Terms of Service" — `text-brand` links, open `/privacy` and `/terms` in new tab (`target="_blank" rel="noopener"`)
- Text: `text-sm text-muted-foreground`, centered below form

### Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| >=640px | Centered `Dialog` with backdrop overlay (`bg-black/50`) |
| <640px | Full-screen `Sheet` with `side="bottom"`, slides up, rounded-t-[24px], 100dvh max height with scroll |

### Keyboard & Focus

- Focus trapped within dialog (built into Radix Dialog)
- `Escape` closes dialog
- `Tab` cycles through: close button, tab triggers, form fields, submit button, toggle link, legal links
- Auto-focus on first input field when dialog opens
- `Enter` submits the active form

### Accessibility

- `Dialog` root: `aria-label="Sign in to LevelUp"` (changes to "Create your LevelUp account" in Sign Up mode)
- Form field errors: `aria-invalid="true"` on input, error `<p>` with `id` referenced by `aria-describedby` on input
- Loading state: submit button gets `aria-disabled="true"`, `aria-busy="true"` on form
- Tab triggers: default Radix Tabs ARIA (automatic `role="tablist"`, `role="tab"`, `role="tabpanel"`)
- Success messages: wrap in `role="status"` with `aria-live="polite"`

---

## 2. Settings > Subscription Section

### Integration Point

Add a new tab to the existing Settings page (`src/app/pages/Settings.tsx`). The Settings page currently uses sections — add "Subscription" as a new navigable section, consistent with the existing pattern (Profile, Notifications, Data Management, etc.).

### Section Header

```
Subscription
Manage your plan and billing
```

h2 heading + `text-muted-foreground` description, matching existing Settings section headers.

### Plan Status Card

Use shadcn `Card` with `CardHeader` + `CardContent`.

```
┌────────────────────────────────────────────┐
│  Current Plan                              │
│                                            │
│  ┌──────────┐                              │
│  │ Premium  │   Monthly · $9.99/mo         │  ← Badge + text
│  └──────────┘                              │
│                                            │
│  Status: Active                            │  ← text-success for active
│  Next billing: April 14, 2026             │  ← text-muted-foreground
│                                            │
│  [Manage Billing]  [Cancel Subscription]   │  ← Button variants
└────────────────────────────────────────────┘
```

**Badge variants by plan:**

| Plan | Badge | Token |
|------|-------|-------|
| Free | `variant="secondary"` | Default styling |
| Premium | `variant="default"` with `bg-brand text-brand-foreground` | Brand colors |
| Trial | `variant="outline"` with `text-warning border-warning` | Warning colors |

**Billing period display:** "Monthly" or "Yearly" + price. Use `text-muted-foreground` for secondary info.

**Status values:**

| Status | Color | Icon |
|--------|-------|------|
| Active | `text-success` | `CheckCircle` |
| Trial | `text-warning` | `Clock` |
| Canceled | `text-destructive` | `XCircle` |
| Past Due | `text-destructive` | `AlertTriangle` |

### Free Tier View

When user is on Free plan, replace the plan card content:

```
┌────────────────────────────────────────────┐
│  Current Plan                              │
│                                            │
│  ┌──────┐                                  │
│  │ Free │   Basic features included        │
│  └──────┘                                  │
│                                            │
│  [Upgrade to Premium]                      │  ← bg-brand, prominent
│                                            │
│  ┌────────────────────────────────────────┐ │
│  │ Feature Comparison                     │ │
│  ├──────────────┬──────────┬─────────────┤ │
│  │ Feature      │   Free   │   Premium   │ │
│  ├──────────────┼──────────┼─────────────┤ │
│  │ Courses      │  3 max   │  Unlimited  │ │
│  │ AI Tutor     │    —     │     ✓       │ │
│  │ AI Notes     │    —     │     ✓       │ │
│  │ Export Data  │  Basic   │    Full     │ │
│  │ Priority     │    —     │     ✓       │ │
│  │  Support     │          │             │ │
│  └──────────────┴──────────┴─────────────┘ │
└────────────────────────────────────────────┘
```

Use shadcn `Table` (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`).
- Check marks: `Check` icon in `text-success`
- Dashes: `Minus` icon in `text-muted-foreground`
- "Unlimited" and feature values: `font-medium`

### Action Buttons

| Button | Variant | Action |
|--------|---------|--------|
| Upgrade to Premium | `bg-brand hover:bg-brand-hover text-brand-foreground` | Opens Stripe Checkout (or Auth modal if unauthenticated) |
| Manage Billing | `variant="outline"` | Opens Stripe Customer Portal |
| Cancel Subscription | `variant="ghost"` with `text-destructive` | Opens cancel confirmation AlertDialog |

### Cancel Confirmation

Use shadcn `AlertDialog`.

```
┌──────────────────────────────────────┐
│  Cancel your subscription?           │  ← AlertDialogTitle
│                                      │
│  Your subscription will remain       │
│  active until April 14, 2026.       │
│                                      │
│  You'll lose access to:              │
│  ✗ AI Tutor conversations            │  ← text-destructive, XCircle icon
│  ✗ AI-powered note organization      │
│  ✗ Unlimited course imports          │
│  ✗ Priority support                  │
│                                      │
│  You'll keep:                        │
│  ✓ Your course progress              │  ← text-success, CheckCircle icon
│  ✓ Your notes and highlights         │
│  ✓ Free tier features                │
│                                      │
│  [Keep Subscription]  [Cancel Plan]  │
└──────────────────────────────────────┘
```

- "Keep Subscription" — `AlertDialogCancel` (default styling)
- "Cancel Plan" — `AlertDialogAction` with `bg-destructive text-destructive-foreground`
- Loss list: each item prefixed with `XCircle` icon in `text-destructive`
- Keep list: each item prefixed with `CheckCircle` icon in `text-success`

### Loading State

Use `Skeleton` components matching the card layout while subscription data is fetched:
- Skeleton for badge: `Skeleton className="h-6 w-20 rounded-full"`
- Skeleton for text lines: `Skeleton className="h-4 w-48"` (x3)
- Skeleton for buttons: `Skeleton className="h-10 w-32"` (x2)
- Wrap with `DelayedFallback` pattern (consistent with existing page loaders)

### Offline State

When offline or data is stale:
- Show cached data with reduced opacity on action buttons
- Banner at top of card: `text-muted-foreground text-sm` — "Last updated: [date]. Connect to the internet to manage your subscription."
- Action buttons: `disabled` state, tooltip on hover explaining "Internet connection required"

---

## 3. Upgrade CTA Component

### Component Name

`UpgradeCTA` — reusable across all premium feature gating points.

### File Location

`src/app/components/figma/UpgradeCTA.tsx`

### Props Interface

```typescript
interface UpgradeCTAProps {
  variant: 'card' | 'inline'
  featureName: string        // e.g., "AI Tutor"
  description: string        // e.g., "Get personalized AI tutoring for any course"
  icon?: LucideIcon          // Feature-specific icon, defaults to Lock
  className?: string
}
```

### Card Variant

```
┌──────────────────────────────────────────┐
│  🔒  AI Tutor                            │  ← Lock icon + feature name (h4)
│                                          │
│  Get personalized AI tutoring for any    │  ← text-muted-foreground
│  course topic with our premium plan.     │
│                                          │
│  [Upgrade to Premium →]                  │  ← Button, bg-brand
└──────────────────────────────────────────┘
```

- Background: `bg-brand-soft`
- Border: `border border-brand/20` (brand color at 20% opacity)
- Border radius: `rounded-[24px]`
- Padding: `p-6`
- Icon: `Lock` from lucide-react, `text-brand`, `w-5 h-5`
- Feature name: `font-medium text-foreground`
- Description: `text-sm text-muted-foreground`, max 2 lines
- Button: `bg-brand hover:bg-brand-hover text-brand-foreground rounded-xl`
- Arrow: `ArrowRight` icon inside button, `w-4 h-4 ml-1`

### Inline Variant

```
┌─────────────────────────────────────────────────────────┐
│  🔒 AI Tutor — Premium feature  [Upgrade]               │
└─────────────────────────────────────────────────────────┘
```

- Background: `bg-brand-soft`
- Border: `border border-brand/20`
- Border radius: `rounded-xl`
- Padding: `px-4 py-2`
- Layout: `flex items-center gap-3` — single horizontal row
- Icon: `Lock`, `text-brand`, `w-4 h-4`
- Text: `text-sm` — "{featureName} — Premium feature"
- Button: `variant="outline" size="sm"` with `text-brand border-brand hover:bg-brand hover:text-brand-foreground`

### Click Behavior

1. If user is authenticated: redirect to Stripe Checkout
2. If user is not authenticated: open Auth Modal first, then redirect to Stripe Checkout after successful auth

### Responsive Behavior

| Breakpoint | Card Variant | Inline Variant |
|------------|-------------|----------------|
| >=1024px | Horizontal layout if within grid, otherwise vertical | Single row |
| 640–1023px | Vertical stack | Single row |
| <640px | Vertical stack, full width, `p-4` | Wraps: icon+text on row 1, button on row 2 (`flex-wrap`) |

### Accessibility

- `role="region"` with `aria-label="Premium feature: {featureName}"`
- Button: `aria-label="Upgrade to premium to unlock {featureName}"`
- Lock icon: `aria-hidden="true"`

---

## 4. Trial Indicator

### Position

Header bar (`src/app/components/Layout.tsx`), right-aligned section, inserted **before** the notification bell icon.

### Layout

```
... [Trial: 12 days left] [🔔] [Avatar ▼]
```

### Component

shadcn `Badge` with `variant="outline"`.

### States

| Condition | Badge Style | Content |
|-----------|-------------|---------|
| >3 days remaining | `variant="outline"` + `text-warning border-warning` | "Trial: X days left" |
| <=3 days remaining | `variant="outline"` + `text-destructive border-destructive` | "Trial: X days left" |
| Trial expired | Hidden (user sees free tier UI instead) | — |

### Interaction

- `cursor-pointer` on badge
- Click: navigates to `/settings` and scrolls to Subscription section (use `useNavigate` + hash or scroll-into-view)
- Hover: tooltip — "Click to manage your subscription"

### Responsive Behavior

| Breakpoint | Display |
|------------|---------|
| >=640px | Full badge: "Trial: X days left" |
| <640px | Compact: `Clock` icon (lucide-react, `w-4 h-4`) + "X" (just the number). Badge remains same colors. Min touch target 44x44px via padding. |

### Accessibility

- `role="status"` on the badge
- `aria-label="Trial period: X days remaining. Click to manage subscription"`
- `aria-live="polite"` — updates silently when day count changes (no announcement on every render, just on actual day change)

---

## 5. Trial Expiry Reminder

### Component

shadcn `Alert` (not toast — this is persistent until dismissed).

### Position

Top of main content area, **below** the header and **above** page content. Inside the `<Outlet />` wrapper area in `Layout.tsx`, or as the first child within each page component.

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠ Your trial ends in 3 days. Subscribe now to keep premium     │
│    features.                                                     │
│                                          [Subscribe Now] [Later] │
└──────────────────────────────────────────────────────────────────┘
```

### Styling

- Background: `bg-warning/10` (warning color at 10% opacity)
- Border: `border-warning/30`
- Border radius: `rounded-xl`
- Icon: `AlertTriangle` from lucide-react, `text-warning`
- Text: `text-foreground text-sm`
- Margin: `mb-4` (spacing before page content)

### Action Buttons

| Button | Variant | Action |
|--------|---------|--------|
| Subscribe Now | `size="sm" bg-brand hover:bg-brand-hover text-brand-foreground` | Navigate to Stripe Checkout |
| Remind Me Later | `variant="ghost" size="sm" text-muted-foreground` | Dismiss alert, store dismissal date in localStorage |

### Display Rules

- Show when: trial has <=7 days remaining
- Frequency: maximum once per calendar day
- Dismissal: "Remind Me Later" stores `lastTrialReminderDismissed: "YYYY-MM-DD"` in localStorage
- Re-shows: next calendar day (compare stored date vs current date)
- Never shows: if user is on free plan (no trial) or premium (active subscription)

### Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| >=640px | Horizontal: icon + text on left, buttons on right (`flex justify-between items-center`) |
| <640px | Stacked: icon + text on top, buttons below (`flex-col gap-2`), buttons full width |

### Accessibility

- `role="alert"` on the `Alert` component
- `aria-live="polite"` — announced by screen readers when it appears
- Dismiss button: `aria-label="Dismiss trial reminder until tomorrow"`
- Subscribe button: standard button semantics

---

## 6. Legal Pages (/privacy, /terms)

### Routes

Two new public routes — **outside** the `Layout` component (no sidebar, no header):

| Route | Page |
|-------|------|
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |

Add to `src/app/routes.tsx` as sibling routes to the Layout-wrapped routes (not nested under `Layout`).

### Page Layout

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ← Back to LevelUp                                      │  ← Link, top-left
│                                                          │
│              Privacy Policy                              │  ← h1, centered
│              Effective: March 1, 2026                    │  ← text-muted-foreground
│                                                          │
│  ┌────────────────────────┐                              │
│  │ Table of Contents      │                              │  ← sticky on desktop
│  │ 1. Information We...   │                              │
│  │ 2. How We Use...       │                              │
│  │ 3. Data Storage...     │                              │
│  │ ...                    │                              │
│  └────────────────────────┘                              │
│                                                          │
│  1. Information We Collect                               │  ← h2, scroll target
│  Lorem ipsum dolor sit amet...                           │
│                                                          │
│  2. How We Use Your Information                          │  ← h2, scroll target
│  Lorem ipsum dolor sit amet...                           │
│                                                          │
│  ...                                                     │
│                                                          │
│              © 2026 LevelUp. All rights reserved.        │
└──────────────────────────────────────────────────────────┘
```

### Styling

- Container: `max-w-3xl mx-auto px-6 py-12` (720px max width)
- Background: `bg-background` (inherits app background)
- Heading (h1): `font-display text-3xl font-medium text-center mb-2`
- Effective date: `text-center text-sm text-muted-foreground mb-10`
- Section headings (h2): `font-display text-xl font-medium mt-10 mb-4`, with `id` attributes for anchor links
- Body text: `text-base text-foreground leading-relaxed` (line-height 1.7)
- Lists: `list-disc pl-6 space-y-2 text-foreground`
- Links within text: `text-brand hover:underline`

### Back Link

- Position: top-left of page, `mb-8`
- Icon: `ArrowLeft` from lucide-react, `w-4 h-4`
- Text: "Back to LevelUp"
- Style: `text-brand hover:underline flex items-center gap-2`
- Action: `navigate('/')` — goes to app root

### Table of Contents

- Auto-generated from h2 headings on the page
- Card with `bg-card rounded-[24px] p-6 mb-10`
- Title: "Table of Contents" in `font-medium text-sm uppercase tracking-wide text-muted-foreground mb-3`
- Links: `text-brand text-sm hover:underline`, numbered list
- Desktop (>=1024px): optionally `sticky top-6` in a sidebar column using CSS grid
- Mobile (<1024px): inline card above content, not sticky

### Print Styles

Add `@media print` styles:
- Hide back link and table of contents
- Remove background colors
- `max-width: 100%`
- Standard serif font for readability
- Page break rules: `break-inside: avoid` on sections

### Accessibility

- Semantic structure: `<main>`, `<article>`, `<nav>` for ToC
- Skip link: "Skip to content" at top of page (standard pattern)
- Heading hierarchy: single h1, sequential h2s
- ToC navigation: `<nav aria-label="Table of contents">`

---

## 7. Account Deletion Flow

### Entry Point

Settings page > Account section (existing data management area) > "Delete My Account" button.

```
┌────────────────────────────────────────────┐
│  Danger Zone                               │  ← h3, text-destructive
│  ──────────────────────────────────        │  ← Separator
│                                            │
│  Permanently delete your account and all   │
│  associated data. This cannot be undone.   │  ← text-muted-foreground
│                                            │
│  [Delete My Account]                       │  ← variant="destructive"
└────────────────────────────────────────────┘
```

Button: `variant="destructive"` — `bg-destructive text-destructive-foreground`.

### Step 1: Re-Authentication (Conditional)

Only shown if the user's current session is older than 5 minutes (security measure).

Use shadcn `Dialog`:

```
┌──────────────────────────────────────┐
│  Confirm your identity               │  ← DialogTitle
│                                      │
│  For security, please re-enter your  │
│  password to continue.               │  ← DialogDescription
│                                      │
│  Password: [________________]        │  ← Input type="password"
│                                      │
│  [Cancel]  [Continue]                │
└──────────────────────────────────────┘
```

- "Cancel" — `DialogClose` / ghost variant
- "Continue" — `bg-brand text-brand-foreground`
- Validation: incorrect password shows inline error `text-destructive`
- On success: proceeds to Step 2

### Step 2: Confirmation Dialog

Use shadcn `AlertDialog` (blocks interaction, requires explicit action):

```
┌──────────────────────────────────────────┐
│  Delete your account?                     │  ← AlertDialogTitle
│                                           │
│  This action is permanent and cannot      │
│  be undone.                               │  ← AlertDialogDescription
│                                           │
│  What will be deleted:                    │
│  ✗ Your account and login credentials     │  ← text-destructive
│  ✗ All billing and subscription data      │
│  ✗ AI conversation history                │
│  ✗ Custom learning preferences            │
│                                           │
│  What will be kept (local only):          │
│  ✓ Course progress (in browser storage)   │  ← text-success
│  ✓ Notes (in browser storage)             │
│  ✓ Downloaded exports                     │
│                                           │
│  Type DELETE to confirm:                  │
│  [________________]                       │  ← Input, monospace
│                                           │
│  [Cancel]  [Delete My Account]            │
└──────────────────────────────────────────┘
```

**Deletion items list:**
- Each prefixed with `XCircle` icon, `text-destructive`

**Kept items list:**
- Each prefixed with `CheckCircle` icon, `text-success`

**Confirmation input:**
- `Input` with `font-mono uppercase tracking-widest`
- Placeholder: `Type "DELETE" to confirm`
- Validation: exact match "DELETE" (case-insensitive comparison, display uppercase)

**Delete button:**
- `AlertDialogAction` with `bg-destructive text-destructive-foreground`
- `disabled` until confirmation input matches "DELETE"
- Text: "Delete My Account"

**Cancel button:**
- `AlertDialogCancel`, default styling

### Step 3: Deletion Progress

After confirmation, replace the AlertDialog content with a progress view (or show a new Dialog):

```
┌──────────────────────────────────────┐
│  Deleting your account...            │  ← DialogTitle
│                                      │
│  ✓ Canceling subscription            │  ← text-success, completed
│  ✓ Removing billing data             │  ← text-success, completed
│  ● Deleting account data...          │  ← text-brand, in progress
│  ○ Signing out                       │  ← text-muted-foreground, pending
│                                      │
│  ████████████░░░░░░░░  60%           │  ← Progress component
│                                      │
│  Please don't close this window.     │  ← text-muted-foreground text-sm
└──────────────────────────────────────┘
```

**Step indicators:**
- Completed: `CheckCircle` icon, `text-success`
- In progress: `Loader2` icon with `animate-spin`, `text-brand`
- Pending: `Circle` icon (outline), `text-muted-foreground`

Use shadcn `Progress` for the bar. No close button during deletion (non-dismissible dialog).

**On completion:** redirect to home page (`/`) with the auth modal shown, confirming "Your account has been deleted."

### Keyboard & Focus

- Step 1 dialog: auto-focus password field
- Step 2 dialog: auto-focus cancel button (not delete — prevent accidental destructive action)
- Confirmation input: no auto-focus (requires intentional navigation)
- Step 3: no interactive elements, focus stays on dialog title
- `Escape` works in Steps 1 and 2 (dismiss), disabled in Step 3 (in progress)

### Accessibility

- Step transitions: `aria-live="assertive"` announces step changes
- Progress bar: `aria-valuemin="0" aria-valuemax="100" aria-valuenow="{percent}"` (built into shadcn Progress)
- Destructive action: WCAG requires confirmation beyond a single click — the "type DELETE" pattern satisfies this
- Step list: `role="list"` with `aria-label="Deletion progress"`

---

## 8. Data Summary Page (Settings > Account > "My Data")

### Entry Point

Settings page > Account section > "My Data" button or link. Could be a sub-section of the existing data management area, or a dedicated view.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  My Data                                                 │  ← h2
│  Overview of data associated with your account           │  ← text-muted-foreground
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Auth Info    │  │ Billing      │  │ Local Data   │   │
│  │              │  │              │  │              │   │
│  │ Email:       │  │ Customer:    │  │ Courses: 12  │   │
│  │ pedro@...    │  │ cus_••••4x2  │  │ Notes: 47    │   │
│  │              │  │              │  │ Sessions: 89 │   │
│  │ Provider:    │  │ Status:      │  │              │   │
│  │ Google       │  │ Active       │  │              │   │
│  │              │  │              │  │              │   │
│  │ Created:     │  │ Plan:        │  │              │   │
│  │ Jan 2, 2026  │  │ Premium      │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                          │
│  [Export My Data]                   [View Privacy Policy] │
└──────────────────────────────────────────────────────────┘
```

### Cards

Use shadcn `Card` with `CardHeader` + `CardContent`. Three cards in a responsive grid.

**Card 1 — Authentication:**

| Label | Value | Notes |
|-------|-------|-------|
| Email | User's email | Full display |
| Auth Provider | "Email/Password", "Google", or "Magic Link" | Based on auth method |
| Account Created | Formatted date (e.g., "January 2, 2026") | `text-muted-foreground` |

- Card icon: `User` (lucide-react) in `CardHeader`
- Title: "Authentication"

**Card 2 — Billing:**

| Label | Value | Notes |
|-------|-------|-------|
| Customer ID | Masked: `cus_••••{last4}` | Only show last 4 chars |
| Status | "Active", "Trial", "Canceled", etc. | Color-coded like subscription section |
| Plan | "Free", "Premium" | Badge component |

- Card icon: `CreditCard` (lucide-react)
- Title: "Billing"
- If no billing data (free, never subscribed): show "No billing data" in `text-muted-foreground`

**Card 3 — Local Data:**

| Label | Value | Notes |
|-------|-------|-------|
| Courses | Count (e.g., "12 courses") | Number only, not content |
| Notes | Count (e.g., "47 notes") | Number only |
| Study Sessions | Count (e.g., "89 sessions") | Number only |

- Card icon: `HardDrive` (lucide-react)
- Title: "Local Data"
- Note below: `text-xs text-muted-foreground` — "Stored in your browser. Not synced to any server."

### Grid Layout

| Breakpoint | Columns |
|------------|---------|
| >=1024px | 3 columns (`grid-cols-3 gap-4`) |
| 640–1023px | 2 columns + 1 below (`grid-cols-2 gap-4`) |
| <640px | 1 column stacked (`grid-cols-1 gap-4`) |

### Card Styling

- Border radius: `rounded-[24px]`
- Each card: `bg-card` background
- Labels: `text-sm text-muted-foreground`
- Values: `text-base font-medium text-foreground`
- Vertical spacing between label/value pairs: `space-y-3`

### Action Buttons

| Button | Variant | Action |
|--------|---------|--------|
| Export My Data | `variant="outline"` with `Download` icon | Downloads JSON file containing all user data |
| View Privacy Policy | `variant="ghost"` with `ExternalLink` icon | Opens `/privacy` in new tab |

**Export format:** JSON file named `levelup-data-export-{YYYY-MM-DD}.json` containing:
- Authentication metadata (email, provider, creation date — no passwords)
- Subscription status (plan, billing period — no payment details)
- Local data counts (not content — content is already in browser)

**Button row:** `flex gap-3 mt-6`, buttons side by side on desktop, stacked on mobile (<640px).

### Loading State

Each card shows `Skeleton` placeholders while data loads:
- Card header: `Skeleton className="h-5 w-24"`
- Each value: `Skeleton className="h-4 w-32"` (x3 per card)
- Use `DelayedFallback` wrapper

### Accessibility

- Cards: `role="region"` with `aria-label` matching card title
- Masked customer ID: `aria-label="Customer ID ending in {last4}"`
- Export button: `aria-label="Export my data as JSON file"`
- Data counts: plain text, no special ARIA needed

---

## Cross-Cutting Concerns

### Design Token Usage

All components in this spec must use design tokens from `src/styles/theme.css`. Key mappings:

| Semantic Use | Token | Never Use |
|-------------|-------|-----------|
| Primary actions | `bg-brand` / `hover:bg-brand-hover` | `bg-blue-600` |
| Primary text on brand bg | `text-brand-foreground` | `text-white` |
| Destructive actions | `bg-destructive` / `text-destructive` | `bg-red-500` |
| Success indicators | `text-success` | `text-green-600` |
| Warning indicators | `text-warning` | `text-orange-500` |
| Muted/secondary text | `text-muted-foreground` | `text-gray-500` |
| Soft brand background | `bg-brand-soft` | `bg-blue-50` |
| Card backgrounds | `bg-card` | `bg-white` |
| Page background | `bg-background` | `bg-[#FAF5EE]` |

### Shared Animation Patterns

- Dialog/Sheet entrance: built-in Radix animations (no custom needed)
- Loading spinners: `Loader2` with `animate-spin` from lucide-react
- Skeleton pulse: built-in shadcn Skeleton animation
- Button press: no transform needed (handled by shadcn defaults)

### Error Handling Pattern

All network-dependent operations (auth, billing, subscription management) should display errors using:

1. **Inline errors** (form validation): `text-destructive text-sm` below the field
2. **Banner errors** (server/network): shadcn `Alert` with `variant="destructive"` inside the dialog/card
3. **Toast errors** (background operations): `toastError()` from `src/lib/toastHelpers.ts`

### Component Dependency Map

```
Auth Modal
├── Dialog / Sheet (responsive)
├── Tabs, TabsList, TabsTrigger, TabsContent
├── Input, Button, Label
├── Alert (server errors)
└── lucide: Loader2, CheckCircle, X, Mail, Chrome

Subscription Section
├── Card, CardHeader, CardContent
├── Badge
├── Table, TableHeader, TableBody, TableRow, TableHead, TableCell
├── AlertDialog (cancel confirmation)
├── Skeleton, DelayedFallback
├── Button
└── lucide: CheckCircle, XCircle, Clock, AlertTriangle, CreditCard

UpgradeCTA
├── Card (card variant)
├── Button
└── lucide: Lock, ArrowRight

Trial Indicator
├── Badge
├── Tooltip
└── lucide: Clock

Trial Expiry Reminder
├── Alert
├── Button
└── lucide: AlertTriangle

Legal Pages
├── (no shadcn dependencies — pure HTML/Tailwind)
└── lucide: ArrowLeft

Account Deletion
├── Dialog (re-auth)
├── AlertDialog (confirmation)
├── Input
├── Progress
├── Button
└── lucide: XCircle, CheckCircle, Circle, Loader2, Trash2

Data Summary
├── Card, CardHeader, CardContent
├── Skeleton, DelayedFallback
├── Button
└── lucide: User, CreditCard, HardDrive, Download, ExternalLink
```
