---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - 'docs/planning-artifacts/prd.md'
  - 'docs/planning-artifacts/architecture.md'
  - 'docs/planning-artifacts/ux-design-specification.md'
  - 'docs/planning-artifacts/epic-19-ux-specification.md'
  - 'docs/planning-artifacts/epics.md'
  - 'docs/plans/2026-03-14-epic-19-prerequisites.md'
scope: 'Epic 19 only — Platform & Entitlement refinement'
---

# Epic 19: Platform & Entitlement — Refined Epic Breakdown

## Overview

This document provides the refined epic and story breakdown for **Epic 19: Platform & Entitlement**, decomposing the requirements from the PRD (FR102-FR107), Architecture ADRs (Supabase Auth, Stripe, Entitlement, Premium Boundary), and Epic 19 UX Specification into implementable stories.

This is a refinement of the existing Epic 19 stories in `docs/planning-artifacts/epics.md` (lines 2835-3391), expanding coverage to address gaps in auth flows, infrastructure setup, data summary, and email verification.

## Requirements Inventory

### Functional Requirements

- FR102: User can create an account with email and password to access premium features, while all core features (import, playback, notes, streaks, analytics) remain fully functional without an account
- FR103: User can subscribe to the premium tier via Stripe Checkout hosted payment page, with subscription status updated immediately upon payment completion and cached locally with a 7-day TTL for offline access
- FR104: System validates premium entitlement on app launch (when online) and caches the result in IndexedDB; cached entitlement is honored for up to 7 days offline, after which premium features are temporarily disabled until re-validation
- FR105: User can view subscription status (plan, billing period, next billing date) in Settings, manage billing via Stripe Customer Portal, and cancel with premium access continuing until end of current billing period
- FR106: System displays upgrade CTAs in place of premium features for free-tier users, showing feature previews and descriptions; premium components are not bundled or lazy-loaded for free-tier users
- FR107: Premium code resides in an isolated `src/premium/` directory with separate build configuration; the open-source AGPL build excludes all premium code and passes all tests without premium dependencies

### NonFunctional Requirements

- NFR53: All learning data remains local — no network requests are made except to configured AI API endpoints and, when the user has opted into premium features, authentication and entitlement validation endpoints *(amended by Epic 19: auth/payment/entitlement traffic is user-initiated and consent-gated; core workflows make zero network requests)*
- NFR56: All core features (import, playback, notes, streaks, analytics, export) operate without authentication; premium features (AI, spaced review, advanced export) require an account and active subscription *(amended by Epic 19: auth is additive, never gates core workflows; see FR102)*
- NFR64: All learning data is stored locally with no server-side data transmission occurring without explicit per-feature user consent; account data (email, subscription status) is transmitted to authentication and payment providers only when the user explicitly creates an account or subscribes *(amended by Epic 19: account creation and payment are explicit user-initiated actions with informed consent via Privacy Policy and Terms of Service)*
- NFR-NEW: Email verification required before premium access is granted; core features work immediately after signup

### Additional Requirements

- Supabase Auth as auth provider (email/password, magic link, Google OAuth) — see Architecture ADR
- Supabase Edge Functions for serverless backend (create-checkout, create-portal, cancel-subscription, stripe-webhook, delete-account, validate-entitlement)
- Stripe Checkout (hosted) for payment collection — zero PCI scope
- Stripe Customer Portal for subscription management — zero custom billing UI
- Entitlement cache in Dexie.js schema v3 (`entitlements` table)
- Premium code boundary via Vite build exclusion plugin
- Bundle budget: ~40KB for Supabase SDK (dynamic import, loaded only for authenticated users)
- Supabase project infrastructure setup (project creation, env vars, Edge Function scaffolding, Stripe test keys)
- Password reset flow via Supabase Auth `resetPasswordForEmail()`
- 7-day soft-delete grace period for account deletion with restoration on sign-in
- RLS policies for entitlement tables in Supabase Postgres
- Research needed: Stripe product/price structure, email template branding, Edge Function patterns (Deno + Stripe SDK)

### UX Design Requirements

- UX-DR1: Auth Modal — shadcn Dialog (desktop) / Sheet (mobile), 3 tabs (Email/Password, Magic Link, Google OAuth), sign-in/sign-up toggle, validation states, legal links, keyboard/focus management, responsive behavior
- UX-DR2: Settings > Subscription Section — plan status card with badge variants, feature comparison table, cancel confirmation AlertDialog, loading/offline states, action buttons (Manage Billing, Cancel)
- UX-DR3: UpgradeCTA Component — reusable `card` and `inline` variants, responsive behavior, click behavior (auth gate -> Stripe Checkout), accessibility with role="region"
- UX-DR4: Trial Indicator — header badge with countdown, warning/destructive color states, responsive collapse to icon on mobile, click navigates to Settings
- UX-DR5: Trial Expiry Reminder — persistent Alert component, daily dismissal via localStorage, Subscribe Now / Remind Me Later buttons, responsive stacking
- UX-DR6: Legal Pages (/privacy, /terms) — standalone routes outside Layout, table of contents, print styles, back link, semantic HTML structure
- UX-DR7: Account Deletion Flow — 3-step flow (re-auth -> confirmation with "DELETE" input -> progress indicator), non-dismissible during processing
- UX-DR8: Data Summary Page (Settings > Account > My Data) — 3-card responsive grid (auth info, billing, local data), export button, privacy policy link

### FR Coverage Map

| FR | Stories | Description |
|----|---------|-------------|
| FR102 | 19.0a, 19.0b, 19.1 | Account creation with email/password, magic link, Google OAuth |
| FR103 | 19.0b, 19.2 | Stripe Checkout subscription flow |
| FR104 | 19.3 | Entitlement validation + offline caching |
| FR105 | 19.4 | Subscription management in Settings |
| FR106 | 19.5 | Upgrade CTAs replacing premium features |
| FR107 | 19.6 | Premium code isolation + build separation |
| NFR53/56/64 | 19.1, 19.3 | Core features without auth, data locality |
| NFR-NEW | 19.1 | Email verification before premium |
| UX-DR1 | 19.1 | Auth Modal |
| UX-DR2 | 19.4 | Subscription section |
| UX-DR3 | 19.5 | UpgradeCTA component |
| UX-DR4/5 | 19.8 | Trial indicator + reminder |
| UX-DR6 | 19.7 | Legal pages |
| UX-DR7 | 19.9 | Account deletion flow |
| UX-DR8 | 19.10 | Data summary page |

## Epic List

### Epic 19: Platform & Entitlement

Users can create accounts, subscribe to premium features via Stripe, and manage their subscription — enabling the open-core business model while preserving full functionality of the free core.

**FRs covered:** FR102, FR103, FR104, FR105, FR106, FR107
**NFRs covered:** NFR53 (amended), NFR56 (amended), NFR64 (amended), NFR-NEW (email verification)
**UX-DRs covered:** UX-DR1 through UX-DR8
**Phase:** 4 (Post-MVP)

#### Story Phases

**Phase A — Foundation (blocks everything):**
- Story 19.0a: Platform Research & Architecture Decisions
- Story 19.0b: Supabase & Stripe Infrastructure Setup

**Phase B — Core Auth & Payments:**
- Story 19.1: Authentication (email, magic link, Google OAuth, password reset, email verification)
- Story 19.2: Stripe Subscription Integration
- Story 19.3: Entitlement System & Offline Caching

**Phase C — User-Facing Features:**
- Story 19.4: Subscription Management
- Story 19.5: Premium Feature Gating & Upgrade CTAs
- Story 19.7: Legal Pages & Compliance

**Phase D — Growth & Compliance:**
- Story 19.8: Free Trial Flow
- Story 19.6: Premium Code Boundary & Build Separation
- Story 19.9: GDPR Compliance & Account Deletion
- Story 19.10: Data Summary Page

---

## Epic 19: Platform & Entitlement

Users can create accounts, subscribe to premium features via Stripe, and manage their subscription — enabling the open-core business model while preserving full functionality of the free core.

---

### Story 19.0a: Platform Research & Architecture Decisions

As a developer,
I want to research and document all platform architecture decisions before implementation,
So that infrastructure setup and feature stories have clear, validated technical specs to follow.

**Acceptance Criteria:**

**Given** the project needs Supabase Auth configuration
**When** I research auth provider options
**Then** I document decisions for: email template branding (custom vs default), password requirements, magic link expiry time, Google OAuth redirect URLs, email verification flow (verify-before-premium)
**And** the decisions are recorded as an ADR addendum in the Architecture doc

**Given** the project needs Stripe payment integration
**When** I research pricing structure
**Then** I document decisions for: monthly vs yearly plans (incorporating existing pricing concepts), price points, trial length (14 days confirmed or adjusted), product/price IDs naming convention, webhook endpoint URL pattern
**And** a Stripe product configuration checklist is produced

**Given** the project needs server-side entitlement storage
**When** I design the Supabase Postgres schema
**Then** I document: entitlement table schema, RLS policies (who can read/write), indexes needed, and how it relates to the Dexie v3 client-side cache
**And** the schema is reviewed for GDPR compliance (what data is stored, retention policy)

**Given** the project uses Supabase Edge Functions (Deno runtime)
**When** I research Stripe SDK compatibility with Deno
**Then** I document: which Stripe SDK version works with Deno, any workarounds needed, CORS configuration for Edge Functions, secret management pattern (Supabase Vault vs env vars)
**And** a starter Edge Function template is defined

**Given** all research is complete
**When** I compile the output
**Then** the deliverables include:
1. ADR addendum (auth config, Stripe structure, RLS design)
2. Stripe product configuration checklist
3. Supabase Postgres schema definition
4. Edge Function starter template
5. Environment variable inventory (`.env.local` template)

**Dependencies:** None (foundation story)

**Testing Requirements:** All deliverables are documentation — validated by peer review of ADR addendum and schema design

---

### Story 19.0b: Supabase & Stripe Infrastructure Setup

As a developer,
I want the Supabase project and Stripe account configured and locally testable,
So that all subsequent stories can build on working infrastructure without setup delays.

**Acceptance Criteria:**

**Given** the architecture decisions from Story 19.0a
**When** I create the Supabase project
**Then** the project is provisioned with: Auth enabled (email/password, magic link, Google OAuth configured), email templates customized per ADR decisions, redirect URLs configured for localhost and production
**And** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env.local`

**Given** the Stripe product configuration checklist from 19.0a
**When** I set up the Stripe test environment
**Then** products and prices are created in Stripe test mode, webhook endpoint is configured pointing to the Supabase Edge Function URL, and `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are stored in Supabase Vault
**And** `stripe trigger checkout.session.completed` succeeds from the CLI

**Given** the Edge Function starter template from 19.0a
**When** I scaffold the 5 Edge Functions
**Then** `create-checkout`, `create-portal`, `cancel-subscription`, `stripe-webhook`, and `validate-entitlement` are scaffolded with: CORS headers, Supabase client initialization, Stripe client initialization, JWT verification middleware
**And** each function returns a 200 response with a placeholder body when called locally

**Given** the Postgres schema definition from 19.0a
**When** I create the entitlement table
**Then** the table exists with correct columns and indexes, RLS policies are applied, and a test query (insert + select) succeeds via the Supabase dashboard

**Given** the client-side Dexie schema needs updating
**When** I add the v3 migration
**Then** `db.version(3).stores({ entitlements: 'userId, tier, expiresAt, cachedAt, stripeCustomerId, planId' })` is defined
**And** the app launches without migration errors
**And** existing v2 data is preserved

**Given** local development needs to be testable
**When** I set up the Supabase CLI locally
**Then** `supabase start` launches local emulators, Edge Functions are deployable locally via `supabase functions serve`, and `stripe listen --forward-to` connects Stripe webhooks to the local Edge Function
**And** a developer setup guide is added to `docs/guides/development.md`

**Dependencies:** Story 19.0a (architecture decisions, schema definition, Edge Function template)

**Testing Requirements:** Infrastructure smoke test — Supabase auth signup succeeds, Edge Functions respond, Stripe webhook triggers, Dexie migration preserves data

---

### Story 19.1a: Email/Password Authentication & Email Verification

As a learner,
I want to create an account with email and password and verify my email,
So that I can securely access premium features while core features remain fully functional without an account.

**Acceptance Criteria:**

**Given** I am using LevelUp without an account
**When** I use any core feature (import, playback, notes, streaks, analytics)
**Then** all core features work identically to a logged-in user
**And** no login prompt blocks any core workflow

**Given** I click "Sign Up" and enter a valid email and password (min 8 chars, 1 uppercase, 1 number)
**When** the account is created
**Then** a verification email is sent to my address
**And** I see: "Check your email to verify your account"
**And** core features remain fully accessible while unverified

**Given** I signed up but have not verified my email
**When** I attempt to access a premium feature or start a subscription
**Then** I see: "Please verify your email to access premium features"
**And** a "Resend verification email" button is available

**Given** I click the verification link in my email
**When** the link is valid and unexpired
**Then** my email is marked as verified, I'm redirected with a success toast: "Email verified!"

**Given** I have a verified account
**When** I click "Sign In" and enter my credentials
**Then** I am authenticated, my entitlement status loads, and my local data is preserved

**Given** I am logged in
**When** I click "Sign Out" in Settings
**Then** my auth token is removed, I continue using core features, premium features show upgrade CTAs

**Given** I attempt to sign up with an already-registered email
**When** I submit the form
**Then** I see an error suggesting I sign in instead; no duplicate account is created

**Error States:**

**Given** I attempt to sign up or sign in
**When** the network is unavailable
**Then** I see: "Unable to connect. Please check your internet connection and try again."
**And** a "Retry" button is available, all core features remain accessible

**Loading States:**

**Given** I submit any authentication form
**When** the request is in progress
**Then** the submit button shows a loading spinner and is disabled, form inputs are disabled

**Given** the app launches and I was previously signed in
**When** the session is being restored
**Then** a brief loading indicator appears (not blocking — core features load immediately)

**Dependencies:** Story 19.0b (Supabase project configured, email auth enabled)
**UX Reference:** UX-DR1 (Auth Modal — Email/Password tab, validation states)
**Technical Details:**
- Auth provider: Supabase Auth (see Architecture ADR)
- Files: `src/lib/auth/supabase.ts`, `src/stores/useAuthStore.ts`
- Session management handled by Supabase SDK (localStorage)
- Password requirements: min 8 chars, 1 uppercase, 1 number (per UX spec)

---

### Story 19.1b: Alternative Auth Methods & Password Recovery

As a learner,
I want to sign in with Magic Link or Google, and recover my password if forgotten,
So that I have flexible, low-friction ways to access my account.

**Acceptance Criteria:**

**Magic Link:**

**Given** I choose the Magic Link tab and enter my email
**When** I click "Send Magic Link"
**Then** I see a check-circle icon with "Check your email for a sign-in link"
**And** a resend option appears after 60 seconds

**Given** I click a valid magic link (within 10 minutes, not already used)
**When** the link resolves
**Then** I am authenticated and redirected to where I was before

**Given** I click a magic link that is expired or already used
**When** the link is invalid
**Then** I see: "This link has expired or was already used. Please request a new one."
**And** a "Send New Link" button is available

**Google OAuth:**

**Given** I click "Continue with Google"
**When** I grant permission on Google's OAuth consent screen
**Then** I am redirected back to LevelUp authenticated
**And** my email is automatically verified (Google OAuth implies verified email)

**Account linking:**

**Given** I signed up with email/password as `pedro@x.com`
**When** I later click "Continue with Google" using the same email
**Then** the accounts are linked automatically (Supabase auto-link config)
**And** I can sign in with either method going forward

**Given** I signed up with Google
**When** I later try email/password sign-in with the same email
**Then** I see: "This email is linked to Google sign-in. Use the Google button or request a magic link."

**Password reset:**

**Given** I click "Forgot password?" on the sign-in form
**When** I enter my email and submit
**Then** a password reset email is sent, I see: "Check your email for a password reset link"

**Given** I click a valid password reset link
**When** I enter and confirm a new password
**Then** my password is updated and I am signed in

**Google user password reset edge case:**

**Given** I signed up via Google OAuth (no password set)
**When** I click "Forgot Password" and enter my Google-linked email
**Then** I see: "You signed in with Google. Use the Google button to sign in."
**And** no password reset email is sent

**Dependencies:** Story 19.1a (email/password auth and Auth Modal UI exist)
**UX Reference:** UX-DR1 (Auth Modal — Magic Link tab, Google tab)
**Technical Details:**
- Magic link: `supabase.auth.signInWithOtp({ email })`
- Google OAuth: `supabase.auth.signInWithOAuth({ provider: 'google' })`
- Password reset: `supabase.auth.resetPasswordForEmail(email)`
- Account linking: Supabase dashboard > Auth > Settings > "Enable automatic linking"
- Account linking decision: must be researched in Story 19.0a (security implications)

---

### Story 19.2: Stripe Subscription Integration

As a learner,
I want to subscribe to the premium tier via a secure checkout flow,
So that I can unlock AI-powered features and advanced learning tools.

**Acceptance Criteria:**

**Given** I am authenticated, email-verified, and on the free tier
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
**Then** the entitlement record is created/updated in Supabase Postgres with subscription status, plan ID, and expiry date
**And** the webhook handler is idempotent (duplicate events are no-ops)

**Error States:**

**Given** I click "Upgrade to Premium"
**When** the checkout session creation fails (network error, server error)
**Then** I see: "Unable to start checkout. Please try again."
**And** I remain on the current page with no charge applied

**Given** I complete payment on Stripe Checkout
**When** the payment fails (card declined, insufficient funds, 3DS abandonment)
**Then** Stripe displays the error on the Checkout page
**And** I can retry with a different payment method or return to LevelUp
**And** no subscription is created

**Loading States:**

**Given** I click "Upgrade to Premium"
**When** the checkout session is being created
**Then** the button shows a loading spinner and is disabled

**Dependencies:** Story 19.1a (authentication — Supabase JWT required for checkout session creation)
**Boundary:** This story owns Stripe webhook → server-side entitlement writes. Story 19.3 owns client-side reads and caching.
**Technical Details:**
- Checkout via Supabase Edge Function `create-checkout` (see Architecture ADR)
- Webhook handler: `supabase/functions/stripe-webhook/index.ts`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Test strategy: Stripe test mode API keys + `stripe trigger` CLI for webhook simulation

---

### Story 19.3: Entitlement System & Offline Caching

As a learner,
I want my premium status to be validated and cached locally,
So that premium features work even when I'm offline or have intermittent connectivity.

**Acceptance Criteria:**

**Given** I have an active premium subscription
**When** the app launches and I am online
**Then** the system validates my entitlement against the server via `validate-entitlement` Edge Function
**And** caches the result in IndexedDB (Dexie `entitlements` table) with a 7-day expiry timestamp

**Given** I have a cached entitlement that is less than 7 days old
**When** the app launches and I am offline
**Then** the cached entitlement is honored
**And** all premium features are available

**Given** my cached entitlement is older than 7 days
**When** the app launches and I am offline
**Then** premium features are temporarily disabled
**And** a message explains that premium features require a periodic online check
**And** all core features remain fully functional

**Given** my cached entitlement has expired
**When** I come back online
**Then** the system automatically re-validates my entitlement
**And** premium features are restored if the subscription is still active
**And** no manual action is required

**Given** my subscription has been cancelled or expired
**When** the system validates my entitlement
**Then** premium features are disabled
**And** all my data (including data created with premium features) remains accessible and exportable
**And** I see a clear message about my subscription status with an option to resubscribe

**Given** the `useIsPremium()` hook is called
**When** I am not entitled to premium features
**Then** the premium component is not rendered
**And** an upgrade CTA is shown in its place
**And** no error or broken UI state occurs

**Error States:**

**Given** the app launches and I am online
**When** the entitlement validation endpoint is unreachable (network error, server 500)
**Then** the existing cached entitlement is honored (if cache exists and is <7 days old)
**And** no error is shown to the user (silent retry on next launch)

**Given** the app launches and I am online
**When** the entitlement validation returns an explicit denial (subscription cancelled/expired)
**Then** premium features are disabled immediately
**And** the cached entitlement is cleared
**And** I see a message with an option to resubscribe

**Loading States:**

**Given** the app launches with a stale entitlement cache
**When** re-validation is in progress
**Then** premium features show a brief skeleton/loading state (not blocked — core features load immediately)

**Dependencies:** Story 19.1a (auth — user identity for entitlement lookup), Story 19.2 (Stripe — webhook writes server-side entitlement)
**Boundary:** This story owns client-side entitlement reads, Dexie caching, and the `useIsPremium()` hook. Story 19.2 owns server-side writes via webhook.
**Technical Details:**
- Entitlement hook: `src/lib/entitlement/isPremium.ts` → `useIsPremium()`
- Returns: `{ isPremium: boolean, loading: boolean, tier: 'free' | 'trial' | 'premium' }`
- Dexie table: `entitlements` (schema v3, created in 19.0b)
- Cache TTL: 7 days (configurable via `ENTITLEMENT_CACHE_TTL_DAYS` constant)
- Test strategy: use `FIXED_DATE` pattern for cache expiry tests

---

### Story 19.4: Subscription Management

As a learner,
I want to view my subscription status and manage billing through Stripe,
So that I can update my payment method, cancel, or resubscribe without leaving the app.

**Acceptance Criteria:**

**Given** I am authenticated and have an active subscription
**When** I navigate to Settings > Subscription
**Then** I see my current plan name (Badge with brand colors), billing period ("Monthly"/"Yearly"), next billing date, and status (Active with CheckCircle in text-success)
**And** I see "Manage Billing" (variant="outline") and "Cancel Subscription" (variant="ghost", text-destructive) buttons

**Given** I click "Manage Billing"
**When** the Stripe Customer Portal opens
**Then** I can update my payment method, view invoices, and download receipts
**And** I am redirected back to LevelUp after making changes

**Given** I click "Cancel Subscription"
**When** a confirmation AlertDialog appears
**Then** the dialog shows what I'll lose (premium features listed with XCircle icons in text-destructive) and what I keep (data, core features listed with CheckCircle icons in text-success)
**And** I see "Keep Subscription" (AlertDialogCancel) and "Cancel Plan" (AlertDialogAction, bg-destructive) buttons

**Given** I confirm cancellation by clicking "Cancel Plan"
**When** the Edge Function calls `stripe.subscriptions.update({ cancel_at_period_end: true })`
**Then** I see a toast: "Subscription cancelled. Premium access until [end date]"
**And** the UI updates to show the cancelled state immediately

**Given** I have cancelled my subscription
**When** I navigate to Settings > Subscription
**Then** I see status "Canceled" (text-destructive, XCircle icon)
**And** "Access until [end of billing period date]" replaces the next billing date
**And** "Cancel Subscription" is replaced with "Resubscribe" (bg-brand)
**And** "Manage Billing" remains available for invoices/receipts

**Given** I am on the free tier
**When** I navigate to Settings > Subscription
**Then** I see a "Free" plan badge (variant="secondary"), an "Upgrade to Premium" brand button, and a feature comparison table (Free vs Premium) using shadcn Table

**Given** I previously cancelled and want to resubscribe
**When** I click "Resubscribe" or "Upgrade to Premium"
**Then** I am directed to Stripe Checkout (identical to first-time subscription flow)

**Error States:**

**Given** I click "Manage Billing" or "Cancel Subscription"
**When** the Stripe Portal session or cancellation Edge Function fails
**Then** I see: "Unable to open billing management. Please try again." or "Cancellation failed. Please try again."
**And** a "Retry" button is available

**Given** I navigate to Settings > Subscription
**When** the subscription data cannot be loaded (offline, server error)
**Then** I see the last cached status with a note: "Last updated [date]"
**And** action buttons are disabled with tooltip: "Requires internet connection"

**Loading States:**

**Given** I navigate to Settings > Subscription
**When** subscription data is being fetched
**Then** skeleton loaders appear (badge, text lines, buttons) using DelayedFallback pattern
**And** action buttons are disabled until data loads

**Dependencies:** Story 19.1a (auth), Story 19.2 (Stripe — Customer Portal), Story 19.3 (entitlement — subscription status display)
**UX Reference:** UX-DR2 (Settings > Subscription Section — plan card, feature comparison, cancel dialog, loading/offline states)
**Technical Details:**
- Subscription data: entitlement cache (Dexie) + Supabase Edge Function for fresh data
- "Manage Billing" → Edge Function `create-portal` → Stripe Customer Portal redirect
- "Cancel Plan" → Edge Function `cancel-subscription` → `stripe.subscriptions.update({ cancel_at_period_end: true })`
- Feature comparison: reference canonical tier matrix from open-core strategy
- Note: `cancel-subscription` is a new Edge Function (5th, add to 19.0b scaffold list)

---

### Story 19.5: Premium Feature Gating & Upgrade CTAs

As a learner on the free tier,
I want to see what premium features offer before upgrading,
So that I can make an informed decision about subscribing based on real feature previews.

**Acceptance Criteria:**

**Given** I am on the free tier
**When** I navigate to a page containing premium features (AI summaries, Q&A, spaced review)
**Then** the premium feature area shows an UpgradeCTA component (card or inline variant)
**And** the CTA includes the feature name, description, and lock icon
**And** the rest of the page functions normally with all core features visible

**Given** I click an upgrade CTA
**When** I am authenticated and verified
**Then** I am taken directly to the Stripe Checkout flow
**And** after completing, I return to the exact feature I was trying to access

**Given** I click an upgrade CTA
**When** I am not authenticated
**Then** I see the Auth Modal first
**And** after authentication + verification, I continue to Stripe Checkout

**Given** I am on the free tier and view the video player
**When** premium AI features are present
**Then** "Generate Summary" is replaced by an UpgradeCTA (inline variant)
**And** the AI Q&A panel shows a locked state with UpgradeCTA (card variant)

**Given** premium features are gated
**When** the app loads for a free-tier user
**Then** premium components are not lazy-loaded or bundled
**And** app bundle size is not increased by unused premium code

**Given** I have an active premium subscription
**When** I view a page with premium features
**Then** premium features render fully (no CTA, no lock icon)
**And** no upgrade prompts are shown

**Error States:**

**Given** I click an upgrade CTA
**When** the Stripe Checkout session creation fails
**Then** I see an inline error near the CTA: "Unable to start upgrade. Please try again."
**And** the CTA remains clickable for retry

**Given** I click an upgrade CTA while unauthenticated
**When** the auth flow fails or is cancelled
**Then** I return to the page with the CTA still visible
**And** no upgrade is initiated

**Dependencies:** Story 19.1a (auth — unauthenticated upgrade flow), Story 19.2 (Stripe — checkout redirect), Story 19.3 (entitlement — `useIsPremium()` hook)
**UX Reference:** UX-DR3 (UpgradeCTA component — card + inline variants, responsive, accessibility)
**Technical Details:**
- Gating scope (this story): AI Summary button, AI Q&A panel, Spaced Review entry point (3 features)
- CTA component: `src/app/components/figma/UpgradeCTA.tsx`
- Props: `variant: 'card' | 'inline'`, `featureName`, `description`, `icon?`
- Uses `useIsPremium()` to conditionally render premium vs CTA

---

### Story 19.7: Legal Pages & Compliance

As a learner,
I want to review the Privacy Policy and Terms of Service before creating an account,
So that I understand how my data is handled and what I agree to when using premium features.

**Acceptance Criteria:**

**Given** I navigate to `/privacy` or `/terms`
**When** the page loads
**Then** I see the full legal document with: title (h1), effective date, auto-generated table of contents, and clear section headings (h2s with anchor links)
**And** the page is accessible without logging in (public route outside Layout)

**Given** I am on the sign-up form
**When** I look for legal information
**Then** I see "Privacy Policy" and "Terms of Service" links (text-brand, open in new tab)
**And** legal footer text is in `text-sm text-muted-foreground`

**Given** the Privacy Policy or Terms has been updated
**When** I visit the app after the effective date changes
**Then** an in-app banner appears with a link to the updated document
**And** the banner has a "Dismiss" button that updates `localStorage` with the new effective date
**And** the banner does not reappear after dismissal (until next update)

**Given** I am on a legal page on desktop (>=1024px)
**When** I scroll through the document
**Then** the table of contents is sticky in a sidebar column

**Given** I want to print a legal page
**When** I use the browser print function
**Then** the back link and ToC are hidden, background colors removed, serif font applied, sections don't break across pages

**Given** I click "Back to LevelUp"
**When** the link activates
**Then** I navigate to the app root (`/`)

**Dependencies:** Story 19.1a (auth — sign-up form links to legal pages), Story 19.2 (Stripe — Checkout page links)
**UX Reference:** UX-DR6 (Legal Pages — standalone routes, ToC, print styles, semantic HTML)
**Technical Details:**
- Routes: `/privacy` and `/terms` as public routes outside Layout in `src/app/routes.tsx`
- Content format: React components (`.tsx`) in `src/app/pages/legal/` — no MDX dependency
- Content source: AI-generated draft, reviewed before launch
- Effective date: constant in each component (`EFFECTIVE_DATE = '2026-XX-XX'`)
- Change notification: compare `EFFECTIVE_DATE` against `localStorage.getItem('legal-acknowledged-date')`
- Accessibility: `<main>`, `<article>`, `<nav aria-label="Table of contents">`, single h1, sequential h2s
- Print styles: `@media print` block in component or shared CSS

---

### Story 19.8: Free Trial Flow

As a learner,
I want to try premium features for free before committing to a subscription,
So that I can evaluate whether the premium tier is worth paying for.

**Acceptance Criteria:**

**Given** I am authenticated, verified, and have never used a free trial
**When** I click "Start Free Trial" from an upgrade CTA or Settings
**Then** I am taken to Stripe Checkout with a 14-day trial configured
**And** a payment method is collected but not charged until the trial ends

**Given** I have an active trial
**When** I use the app
**Then** I see a Trial Indicator badge in the header (before notification bell) showing "Trial: X days left"
**And** all premium features are fully available
**And** the badge uses `text-warning border-warning` (>3 days) or `text-destructive border-destructive` (<=3 days)

**Given** my trial has <=7 days remaining
**When** I open the app
**Then** I see a Trial Expiry Reminder alert below the header: "Your trial ends in X days. Subscribe now to keep premium features."
**And** the reminder has "Subscribe Now" (bg-brand) and "Remind Me Later" (variant="ghost") buttons

**Given** I dismiss the trial reminder
**When** I click "Remind Me Later"
**Then** the reminder is hidden for the rest of the calendar day
**And** it re-appears the next day (stored via `localStorage: trial-reminder-dismissed-date`)

**Given** my trial expires
**When** the trial period ends and Stripe charges the payment method
**Then** if the charge succeeds, my subscription converts to premium seamlessly
**And** the trial indicator disappears, replaced by premium status

**Given** I want to cancel my trial
**When** I navigate to Settings > Subscription and click "Cancel Trial"
**Then** the trial ends and no charge is applied
**And** premium features revert to showing upgrade CTAs

**Trial uniqueness:**

**Given** I have previously used a free trial (on this Stripe customer record)
**When** I click "Start Free Trial" or "Upgrade to Premium"
**Then** I am taken directly to a paid checkout (no trial option)
**And** the UI reflects "Subscribe" not "Start Free Trial"

**Grace period:**

**Given** my trial end date has passed
**When** Stripe is processing the first charge (up to 1 hour after trial end)
**Then** premium features remain active during this grace period
**And** if the charge succeeds, premium continues seamlessly
**And** if the charge fails, premium is disabled after the grace period

**Responsive:**

**Given** I am on mobile (<640px)
**When** the trial indicator is displayed
**Then** it shows a compact version: Clock icon + "X" (number only), min 44x44px touch target

**Error States:**

**Given** I click "Start Free Trial"
**When** the checkout session creation fails
**Then** I see: "Unable to start trial. Please try again."
**And** no payment method is collected

**Given** my trial has expired and payment fails
**When** Stripe cannot charge my card
**Then** premium features are disabled
**And** I see: "Your payment could not be processed. Please update your payment method."
**And** an "Update Payment Method" button opens Stripe Customer Portal

**Dependencies:** Story 19.1a (auth), Story 19.2 (Stripe — trial checkout), Story 19.3 (entitlement — trial tier), Story 19.4 (subscription management — cancel trial)
**UX Reference:** UX-DR4 (Trial Indicator), UX-DR5 (Trial Expiry Reminder)
**Technical Details:**
- Trial: Stripe Checkout `subscription_data.trial_period_days: 14`
- Trial tier: `tier: 'trial'` (distinct from `'premium'` in entitlement)
- Trial Indicator: `src/app/components/figma/TrialIndicator.tsx`
- One trial per customer: check `customer.subscriptions` before creating checkout
- Test strategy: Stripe test clocks for lifecycle; `FIXED_DATE` pattern for countdown UI

---

### Story 19.6: Premium Code Boundary & Build Separation

As a developer,
I want premium code to live in an isolated directory with a separate build configuration,
So that the open-source AGPL distribution never includes proprietary premium code.

**Acceptance Criteria:**

**Given** the project has a `src/premium/` directory
**When** the open-source build (`npm run build`) is produced
**Then** no files from `src/premium/` are included in the output bundle
**And** the build completes successfully without premium dependencies

**Given** the premium build (`npm run build:premium`) is produced
**When** `src/premium/index.ts` is included
**Then** premium components are lazy-loaded via dynamic imports
**And** they only load when `useIsPremium()` returns true

**Given** a file in `src/premium/`
**When** it is inspected
**Then** it contains a proprietary license header (`SPDX-License-Identifier: LicenseRef-LevelUp-Premium`)
**And** it does not import from other premium files in a circular manner

**Given** a core file attempts to import from `@/premium/*`
**When** the core build runs
**Then** the Vite plugin produces a build error
**And** the import is blocked at build time (not just tree-shaken)

**Given** the CI pipeline runs
**When** the core-only build is tested
**Then** all tests pass without `src/premium/` present
**And** no import errors or missing module warnings occur

**Dependencies:** Story 19.3 (entitlement — `useIsPremium()` used by premium gate)
**Technical Details:**
- Core build: `npm run build` (uses `vite.config.ts`)
- Premium build: `npm run build:premium` (uses `vite.config.premium.ts`)
- Import guard: Vite plugin that errors on `@/premium/*` imports during core build
- License header: `// SPDX-License-Identifier: LicenseRef-LevelUp-Premium`
- CI: core-only build verified in CI pipeline
- Testing: ESLint rule or Vite plugin test verifying import restriction

---

### Story 19.9: GDPR Compliance & Account Deletion

As a learner,
I want to delete my account and all associated data,
So that I can exercise my right to erasure and control my personal information.

**Acceptance Criteria:**

**Given** I navigate to Settings > Account > Danger Zone
**When** I click "Delete My Account" (variant="destructive")
**Then** if my session is older than 5 minutes, I am prompted to re-enter my password first
**And** if my session is recent (<5 mins), I proceed directly to the confirmation dialog

**Re-authentication (conditional):**

**Given** my session is older than 5 minutes
**When** the re-auth dialog appears
**Then** I see a password input with "For security, please re-enter your password to continue"
**And** incorrect password shows inline error in text-destructive
**And** success proceeds to the confirmation dialog

**Confirmation:**

**Given** the confirmation AlertDialog appears
**When** I review the consequences
**Then** I see what will be deleted (account, billing data, AI history — XCircle icons, text-destructive)
**And** what will be kept (local course progress, notes, exports — CheckCircle icons, text-success)
**And** a confirmation input requiring me to type "DELETE" (case-insensitive, displayed uppercase)
**And** the "Delete My Account" button is disabled until "DELETE" is entered
**And** auto-focus is on the Cancel button (not delete — prevent accidental action)

**Deletion processing:**

**Given** I confirm deletion
**When** the process runs
**Then** a non-dismissible progress dialog shows steps: "Cancelling subscription..." → "Removing account data..." → "Complete"
**And** each step shows CheckCircle (done), Loader2 animate-spin (in progress), or Circle outline (pending)
**And** a Progress bar tracks overall completion
**And** Escape is disabled during processing

**Given** the deletion completes
**When** all steps succeed
**Then** I am redirected to home page (`/`) with a confirmation: "Your account has been deleted."
**And** my local learning data (courses, notes, progress) remains in the browser
**And** I can continue using core features

**Soft-delete grace period:**

**Given** I deleted my account within the last 7 days
**When** I sign in with my credentials
**Then** my account is restored and the deletion is cancelled
**And** my subscription is reactivated if it was still within the billing period
**And** I see: "Welcome back! Your account has been restored."

**Given** 7 days have passed since I confirmed deletion
**When** the grace period expires
**Then** the Supabase Edge Function permanently deletes: Stripe customer record, Supabase auth user
**And** the deletion is irreversible

**Error States:**

**Given** I confirm account deletion
**When** the Stripe customer deletion fails (open invoice, API error)
**Then** the deletion is aborted — no partial state
**And** I see: "Account deletion failed. Please resolve any open invoices and try again."
**And** my account and subscription remain active

**Given** I confirm account deletion
**When** the auth provider deletion fails after Stripe succeeds
**Then** the system retries auth deletion up to 3 times
**And** if all retries fail, the account is flagged for manual admin review
**And** I see: "Account deletion is being processed. You will receive confirmation within 48 hours."

**Dependencies:** Story 19.1a (auth — account identity, re-auth), Story 19.2 (Stripe — customer deletion), Story 19.3 (entitlement — cache clearing)
**UX Reference:** UX-DR7 (Account Deletion Flow — 3-step, re-auth, confirmation, progress)
**Technical Details:**
- Deletion endpoint: Supabase Edge Function `delete-account`
- Sequence: (1) Cancel subscription, (2) Mark account for soft-delete (7-day grace), (3) After grace: delete Stripe customer, delete Supabase auth user
- Re-auth: check session age via `supabase.auth.getSession()` → `created_at` timestamp
- Stripe retention: `stripe.customers.del()` marks as deleted; Stripe retains records per legal obligations
- Data export: extends existing export (FR85) with account-specific data

---

### Story 19.10: Data Summary Page

As a learner,
I want to see a summary of all data associated with my account,
So that I know what information is stored and can export it for my records.

**Acceptance Criteria:**

**Given** I navigate to Settings > Account > My Data
**When** the page loads
**Then** I see three cards in a responsive grid: Authentication, Billing, and Local Data

**Authentication card:**

**Given** I am authenticated
**When** the Authentication card loads
**Then** I see my email, auth provider ("Email/Password", "Google", or "Magic Link"), and account creation date
**And** the card has a User icon in the header

**Billing card:**

**Given** I have billing data (current or past subscription)
**When** the Billing card loads
**Then** I see masked customer ID (`cus_••••{last4}`), status (color-coded badge), and plan name
**And** the card has a CreditCard icon in the header

**Given** I have never subscribed (free tier only)
**When** the Billing card loads
**Then** I see "No billing data" in text-muted-foreground

**Local Data card:**

**Given** I have local learning data
**When** the Local Data card loads
**Then** I see counts: "X courses", "Y notes", "Z sessions"
**And** below: "Stored in your browser. Not synced to any server." (text-xs, text-muted-foreground)
**And** the card has a HardDrive icon in the header

**Export:**

**Given** I click "Export My Data"
**When** the export completes
**Then** a JSON file named `levelup-data-export-{YYYY-MM-DD}.json` downloads
**And** it contains: auth metadata (email, provider, creation date), subscription status (plan, billing period), and local data counts
**And** no passwords or full payment details are included

**Given** I click "View Privacy Policy"
**When** the link activates
**Then** `/privacy` opens in a new tab

**Responsive:**

**Given** I am on desktop (>=1024px)
**When** the page renders
**Then** cards are in a 3-column grid

**Given** I am on mobile (<640px)
**When** the page renders
**Then** cards stack in a single column

**Loading States:**

**Given** the page is loading
**When** data is being fetched
**Then** each card shows Skeleton placeholders using DelayedFallback wrapper

**Dependencies:** Story 19.1a (auth — account identity), Story 19.3 (entitlement — subscription data), Story 19.4 (subscription management — billing context)
**UX Reference:** UX-DR8 (Data Summary Page — 3-card grid, export, privacy link)
**Technical Details:**
- Auth data: `supabase.auth.getUser()` for email, provider, creation date
- Billing data: entitlement cache (Dexie) for status, tier
- Local data counts: Dexie queries (`db.courses.count()`, `db.notes.count()`, `db.studySessions.count()`)
- Export format: JSON with schema version for forward compatibility
