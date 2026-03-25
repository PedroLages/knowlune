---
story_id: E19-S02
story_name: "Stripe Subscription Integration"
status: done
started: 2026-03-25
completed: 2026-03-25
reviewed: true
review_started: 2026-03-25
review_gates_passed: [build, lint, type-check, format-check, unit-tests, e2e-tests-skipped, design-review, code-review, code-review-testing]
review_scope: full
burn_in_validated: false
---

# Story 19.2: Stripe Subscription Integration

## Story

As a learner,
I want to subscribe to the premium tier via a secure checkout flow,
So that I can unlock AI-powered features and advanced learning tools.

## Acceptance Criteria

**Given** I am authenticated and on the free tier
**When** I click "Upgrade to Premium" in Settings or from any upgrade CTA
**Then** I am redirected to a Stripe Checkout hosted payment page
**And** no credit card data is entered on or transmitted through LevelUp

**Given** I complete payment on Stripe Checkout
**When** Stripe redirects me back to LevelUp
**Then** my subscription status is updated to "Premium"
**And** I see a confirmation message with my plan details
**And** all premium features become immediately available

**Given** Stripe Checkout redirects me back
**When** the subscription webhook has not yet been processed
**Then** the system polls for entitlement status for up to 10 seconds
**And** shows a "Activating your subscription..." loading state
**And** premium access activates as soon as the webhook completes

**Given** I cancel the Stripe Checkout flow
**When** I return to LevelUp without completing payment
**Then** my account remains on the free tier
**And** no charge is applied
**And** I see a message that the upgrade was not completed

**Given** the Stripe webhook fires for a new subscription
**When** the serverless function receives the event
**Then** the entitlement record is updated with subscription status, plan ID, and expiry date
**And** the entitlement is cached locally with a 7-day TTL for offline access

### Error State ACs

**Given** I click "Upgrade to Premium"
**When** the checkout session creation fails (network error, server error)
**Then** I see an error message: "Unable to start checkout. Please try again."
**And** I remain on the current page with no charge applied

**Given** I complete payment on Stripe Checkout
**When** the payment fails (card declined, insufficient funds, 3DS abandonment)
**Then** Stripe displays the error on the Checkout page
**And** I can retry with a different payment method or return to LevelUp
**And** no subscription is created

### Loading State ACs

**Given** I click "Upgrade to Premium"
**When** the checkout session is being created
**Then** the button shows a loading spinner and is disabled

## Tasks / Subtasks

- [ ] Task 1: Create Supabase Edge Function `create-checkout` (AC: 1, error states)
  - [ ] 1.1 Set up `supabase/functions/create-checkout/index.ts`
  - [ ] 1.2 Validate Supabase JWT and extract user ID
  - [ ] 1.3 Create Stripe Checkout session with success/cancel URLs
  - [ ] 1.4 Return checkout URL to client
- [ ] Task 2: Create Stripe webhook handler Edge Function (AC: 5)
  - [ ] 2.1 Set up `supabase/functions/stripe-webhook/index.ts`
  - [ ] 2.2 Verify Stripe webhook signature
  - [ ] 2.3 Handle `checkout.session.completed` event
  - [ ] 2.4 Handle `customer.subscription.updated` and `customer.subscription.deleted`
  - [ ] 2.5 Handle `invoice.payment_failed`
  - [ ] 2.6 Update entitlement record in Supabase
- [ ] Task 3: Create client-side checkout flow (AC: 1, 4, loading states)
  - [ ] 3.1 Create `useCheckout` hook or store action for checkout initiation
  - [ ] 3.2 Add loading/disabled state to upgrade button
  - [ ] 3.3 Handle redirect to Stripe Checkout
  - [ ] 3.4 Handle cancel return from Stripe
- [ ] Task 4: Create subscription activation flow (AC: 2, 3)
  - [ ] 4.1 Create checkout success/return page or handler
  - [ ] 4.2 Implement polling for entitlement status (up to 10s)
  - [ ] 4.3 Show "Activating your subscription..." loading state
  - [ ] 4.4 Display confirmation with plan details on activation
  - [ ] 4.5 Cache entitlement locally with 7-day TTL
- [ ] Task 5: Add "Upgrade to Premium" CTA in Settings (AC: 1)
  - [ ] 5.1 Add upgrade section to Settings page
  - [ ] 5.2 Conditionally show based on free tier status
- [ ] Task 6: Testing with Stripe test mode
  - [ ] 6.1 Configure Stripe test mode API keys
  - [ ] 6.2 Test checkout flow end-to-end
  - [ ] 6.3 Test webhook handling with `stripe trigger` CLI

## Design Guidance

### Layout & Placement

**Subscription section in Settings** — Insert a new Card between "Account" and "Profile" sections. This is the natural position: the user sees their auth status (Account), then their subscription tier, then personalisation options.

**Card pattern** — Follow the established Settings card pattern:
- `CardHeader` with `border-b border-border/50 bg-surface-sunken/30`
- Icon in `rounded-full bg-gold-muted p-2` (gold to signal premium/value, not brand-blue)
- `CardTitle` with `text-lg font-display leading-none`
- Subtitle in `text-sm text-muted-foreground mt-1`

### Component Structure

1. **`SubscriptionCard`** — Settings section showing current tier + upgrade CTA (or active plan details)
   - Free tier state: Feature highlights + "Upgrade to Premium" button
   - Premium state: Plan name, renewal date, "Manage Subscription" link
   - Loading state: Skeleton placeholders while entitlement loads

2. **`CheckoutReturnHandler`** — Route component or inline handler for `/settings?checkout=success|cancel`
   - Success: Polling state → Confirmation state
   - Cancel: Toast + remain on free tier view

3. **`UpgradeCTA`** — Reusable compact CTA for use outside Settings (e.g., feature-gated sections)
   - Smaller footprint: icon + "Upgrade" text + gold accent

### Design Token Usage

| Element | Token | Rationale |
|---------|-------|-----------|
| Premium icon background | `bg-gold-muted` | Gold signals premium/value tier |
| Premium icon | `text-gold` | Consistent with gold theme |
| Upgrade button | `variant="brand"` | Primary CTA, follows brand button pattern |
| Feature list checkmarks | `text-success` | Positive/included indicator |
| Plan active badge | `bg-gold-muted text-gold` | Premium status indicator |
| Loading spinner | `text-brand` | Consistent with app-wide loading pattern |
| Error states | `text-destructive` + `toastError` | Matches Settings error patterns |
| Confirmation | `text-success` + `toastSuccess` | Matches Settings success patterns |

### Premium Feature Highlight (Free Tier View)

Display 3-4 key premium features in a compact list within the card:
- Use `Check` icon with `text-success` for included features
- Keep descriptions to one line each
- Examples: "AI Video Summaries", "Knowledge Gap Detection", "AI Learning Paths", "Auto Note Organization"

### Loading & Transition States

1. **Checkout initiation**: Button shows `Loader2` spinner (`animate-spin`) + disabled state. Use `aria-busy="true"` on button.
2. **Activation polling**: Full-card loading state with pulsing gold accent bar, "Activating your subscription..." text, and `Progress` component (indeterminate or stepped).
3. **Success confirmation**: Animate-in with `fade-in slide-in-from-top-1 duration-300` (matches existing Settings patterns). Show plan name + next billing date.
4. **Cancel return**: Toast notification via `toastError` ("Upgrade not completed") — no persistent UI change needed.

### Responsive Strategy

- **Mobile-first**: Stack feature list vertically, full-width CTA button
- **Desktop (1024px+)**: Feature list in 2-column grid, CTA button right-aligned or inline
- Touch targets: All interactive elements ≥ 44x44px (`min-h-[44px]` — matches existing Settings buttons)

### Accessibility

- Upgrade button: `aria-label="Upgrade to Premium plan"` (descriptive for screen readers)
- Loading state: `aria-live="polite"` region for "Activating your subscription..." announcement
- Feature list: Use semantic `<ul>` with `role="list"` for screen reader enumeration
- Confirmation: `aria-live="polite"` for success announcement
- Error: `role="alert"` for checkout failure messages
- Focus management: Return focus to upgrade section after checkout return (success or cancel)

### Visual Hierarchy

The subscription card should feel elevated compared to other settings cards — a subtle premium feel without being garish:
- Consider a thin `border-gold/20` or `shadow-gold` to differentiate from standard cards
- The gold token palette (`--gold`, `--gold-muted`, `--gold-foreground`) provides warmth without clashing with the brand-blue used elsewhere
- Keep the overall card structure identical to other Settings cards for consistency — the differentiation comes from color accent, not layout

## Implementation Notes

- **Dependencies:** Story 19.1 (authentication — Supabase JWT required)
- **Checkout via:** Supabase Edge Function `create-checkout`
- **Webhook handler:** `supabase/functions/stripe-webhook/index.ts`
- **Stripe events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- **Test strategy:** Stripe test mode API keys + `stripe trigger` CLI for webhook simulation
- **Security:** No credit card data touches Knowlune — all payment handled by Stripe Checkout hosted page

## Implementation Plan

See [plan](plans/e19-s02-stripe-subscription-integration.md) for implementation approach.

## Testing Notes

[Test strategy, edge cases discovered, coverage notes]

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

**Report:** `docs/reviews/design/design-review-2026-03-25-e19-s02.md`

**Review pass 2** — all findings resolved:
- B-01: Added `--gold-soft-foreground` token for WCAG AA badge contrast (4.5:1)
- H-01: Manage Subscription button now has `min-h-[44px]` touch target
- H-02: Pre-existing heading hierarchy (KI-014)
- H-03: Replaced inline shadow with `shadow-studio-gold` utility
- M-01: Loader2 spinners use `motion-safe:animate-spin`
- M-02: Activating body text left-aligned (removed `text-center`)

## Code Review Feedback

**Reports:**
- `docs/reviews/code/code-review-2026-03-25-e19-s02.md`
- `docs/reviews/code/code-review-testing-2026-03-25-e19-s02.md`
- `docs/reviews/code/edge-case-review-2026-03-25-e19-s02.md`

**Review pass 2** — all findings resolved:
- **Blockers (2):** Webhook replay protection timestamp mismatch fixed (use eventTime not wall clock), env var validation added for SUPABASE_URL/SERVICE_ROLE_KEY
- **Security (5):** Env var validation in both edge functions, resolveUserId throws on DB errors (Stripe retries), checkout URL validated client-side, origin validation documented
- **Correctness (4):** Mount/checkout effect race condition fixed, signal-aware polling sleep, fallback timer stored in ref with cleanup, fake timer test isolation
- **UI/UX (4):** Gold badge WCAG AA contrast, motion-safe spinners, touch target on Manage button, shadow utility
- **Tests (5 new):** Poll timeout fallback, cancel persists free tier, URL param cleanup, invalid param handling, deterministic test dates

## Challenges and Lessons Learned

- **Settings tests needed Router context after adding `useSearchParams`**: Adding checkout return handling via `useSearchParams` broke existing Settings unit tests. Fix was wrapping renders in `<MemoryRouter>` — a common pattern when page components gain routing hooks.
- **Schema test versioning must track Dexie migrations**: Adding the `entitlements` table (v23) required updating both the expected table list and version number in `schema.test.ts`. This is easy to forget when adding new tables.
- **Stripe Checkout is the right abstraction for PCI compliance**: By redirecting to Stripe's hosted page, no credit card data enters Knowlune's domain — simplifying security and avoiding PCI DSS scope entirely.
- **Supabase Edge Functions for serverless webhook handling**: Using Deno-based edge functions for both `create-checkout` and `stripe-webhook` keeps the backend lightweight and serverless. Webhook signature verification via `Stripe.webhooks.constructEventAsync` is critical for security.
- **Polling pattern for webhook race condition**: The checkout return handler polls entitlement status for up to 10 seconds because the Stripe webhook may arrive after the user is redirected back. This avoids showing stale "free tier" state while the webhook processes.
- **CSP configuration for Stripe**: `index.html` needed `connect-src` and `frame-src` updates to allow Stripe Checkout redirects and API calls — missing this would silently block the checkout flow.
- **Entitlement caching with 7-day TTL**: Local Dexie storage of entitlement status enables offline access to premium features. The TTL ensures stale entitlements are re-validated when the user comes back online.
- **React 19 `useRef` requires explicit initial value**: `useRef<T>()` with no argument now fails type-check in React 19. Use `useRef<T>(undefined)` for refs that start empty (e.g., timer refs). Caught during `/finish-story` validation.
- **validate-blockers.sh false positives after code shifts**: The blocker validation script checks if a non-empty line exists at the reported line number. When fixes shift line numbers, unrelated code at the old line triggers false "unresolved" results. Workaround: update the report to mark blockers as resolved after fixing them.
- **Two review passes required**: 38 commits across implementation, two full review passes, and two fix cycles. The first pass caught 2 blockers + 4 HIGH issues; the second verified all fixes. Complex payment integrations benefit from dedicated `/review-story` before `/finish-story`.
