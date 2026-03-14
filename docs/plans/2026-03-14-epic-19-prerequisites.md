# Epic 19 Prerequisites Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve all blockers identified in the Epic 19 review so stories can enter implementation.

**Architecture:** Documentation-only changes across PRD, Architecture, Epics, and UX spec. No code changes. Amend contradicting NFRs, add Architecture Decision sections for auth/entitlement/Stripe/premium boundary, define Dexie schema v3, update story format with dependencies and error/loading ACs, resolve conflicting Epic 19 document, and create UX text specifications.

**Tech Stack:** Markdown documentation (PRD, Architecture, Epics, UX spec)

---

## Task 1: Amend NFR53, NFR56, NFR64 in PRD

**Files:**
- Modify: `docs/planning-artifacts/prd.md:1255` (NFR53)
- Modify: `docs/planning-artifacts/prd.md:1261` (NFR56)
- Modify: `docs/planning-artifacts/prd.md:1275` (NFR64)

**Context:** FR102-FR107 already exist at lines 1147-1154. Three NFRs contradict Epic 19's requirements. Each needs amendment with explicit carve-outs for auth/payment/entitlement traffic.

**Step 1: Amend NFR53 (line 1255)**

Replace:
```
- NFR53: All data remains local — no network requests are made except to configured AI API endpoints; verified by monitoring network tab during a full workflow (import, study, notes, progress)
```

With:
```
- NFR53: All learning data remains local — no network requests are made except to configured AI API endpoints and, when the user has opted into premium features, authentication and entitlement validation endpoints *(amended by Epic 19: auth/payment/entitlement traffic is user-initiated and consent-gated; core workflows make zero network requests)*
```

**Step 2: Amend NFR56 (line 1261)**

Replace:
```
- NFR56: Application operates without authentication — no login, registration, or session management required (personal single-user tool)
```

With:
```
- NFR56: All core features (import, playback, notes, streaks, analytics, export) operate without authentication; premium features (AI, spaced review, advanced export) require an account and active subscription *(amended by Epic 19: auth is additive, never gates core workflows; see FR102)*
```

**Step 3: Amend NFR64 (line 1275)**

Replace:
```
- NFR64: All learning data is stored locally with no server-side data transmission occurring without explicit per-feature user consent
```

With:
```
- NFR64: All learning data is stored locally with no server-side data transmission occurring without explicit per-feature user consent; account data (email, subscription status) is transmitted to authentication and payment providers only when the user explicitly creates an account or subscribes *(amended by Epic 19: account creation and payment are explicit user-initiated actions with informed consent via Privacy Policy and Terms of Service)*
```

**Step 4: Commit**

```bash
git add docs/planning-artifacts/prd.md
git commit -m "docs: amend NFR53, NFR56, NFR64 for Epic 19 auth/payment carve-outs"
```

---

## Task 2: Add Architecture Decisions for Auth, Entitlement, Stripe, Premium Boundary

**Files:**
- Modify: `docs/planning-artifacts/architecture.md` — insert new section after line 1022 (after "File System Integration", before "Decision Impact Analysis")

**Context:** The Architecture doc has 12 core decisions. We're adding 4 more following the exact same pattern: Decision → Rationale → Bundle Size → Key Features → Implementation Pattern → Affects.

**Step 1: Insert new section after line 1022**

Add the following section between "File System Integration" (ends ~line 1022) and "Decision Impact Analysis" (starts line 1023):

```markdown
### Authentication & Identity

#### Auth Provider: Supabase Auth

**Decision:** Use Supabase Auth for user authentication with email/password, magic link, and Google OAuth support.

**Rationale:**
- Managed auth service with zero backend maintenance (no auth server to deploy or scale)
- Built-in support for email/password, magic link (passwordless), and OAuth providers
- Generous free tier (50,000 MAUs) covers solo-dev launch phase
- JavaScript SDK handles token storage, refresh, and session management automatically
- Row Level Security (RLS) available if server-side data is added later
- Open-source (can self-host if vendor lock-in becomes a concern)

**Bundle Size:** ~40 KB gzipped (@supabase/supabase-js)

**Key Features:**
- `supabase.auth.signUp()` / `signInWithPassword()` / `signInWithOtp()` / `signInWithOAuth()`
- Automatic token refresh via `onAuthStateChange()` listener
- Session stored in localStorage by Supabase SDK (not manually in IndexedDB)
- Magic link emails sent via Supabase's built-in email service (or custom SMTP)
- Google OAuth via Supabase dashboard configuration (no server code needed)

**Implementation Pattern:**
```typescript
// src/lib/auth/supabase.ts — Supabase client singleton
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// src/stores/useAuthStore.ts — Auth state (Zustand)
interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}
```

**Affects:** All premium features, Settings page, upgrade CTAs, entitlement system

---

#### Entitlement System: Local Cache with Server Validation

**Decision:** Validate premium entitlement against a serverless function on app launch (when online), cache result in IndexedDB with 7-day TTL, and expose an `isPremium()` reactive hook for UI gating.

**Rationale:**
- Local-first: cached entitlement allows premium features to work offline for up to 7 days
- Server validation prevents entitlement spoofing (cache is convenience, server is truth)
- Reactive hook enables declarative premium gating in React components
- 7-day TTL balances offline usability with subscription accuracy

**Bundle Size:** 0 KB (uses existing Dexie.js + Zustand + fetch)

**Key Features:**
- `useIsPremium()` hook returns `{ isPremium: boolean, loading: boolean, tier: 'free' | 'trial' | 'premium' }`
- Automatic validation on app launch if online and cache is stale
- Graceful degradation: expired cache disables premium features, shows upgrade CTA
- Distinguishes server-unreachable (honor cache) from server-returns-denied (disable premium)

**Implementation Pattern:**
```typescript
// src/lib/entitlement/isPremium.ts
interface EntitlementCache {
  tier: 'free' | 'trial' | 'premium'
  expiresAt: string       // ISO date, server-set
  cachedAt: string        // ISO date, client-set
  stripeCustomerId: string
  planId: string | null
}

// src/stores/useEntitlementStore.ts — Entitlement state (Zustand)
interface EntitlementState {
  tier: 'free' | 'trial' | 'premium'
  loading: boolean
  cachedAt: Date | null
  validate: () => Promise<void>  // Called on app launch
}

// React hook for components
export function useIsPremium(): { isPremium: boolean; loading: boolean; tier: string } {
  const tier = useEntitlementStore((s) => s.tier)
  const loading = useEntitlementStore((s) => s.loading)
  return { isPremium: tier !== 'free', loading, tier }
}
```

**Affects:** All premium feature components, upgrade CTAs, Settings subscription panel

---

#### Payment Processing: Stripe Checkout + Customer Portal

**Decision:** Use Stripe Checkout (hosted) for payment collection and Stripe Customer Portal for subscription management. A single serverless function (Supabase Edge Function) handles webhook events.

**Rationale:**
- Stripe Checkout hosted page: zero PCI scope (no card data touches LevelUp)
- Stripe Customer Portal: managed UI for billing, invoices, cancellation (zero custom UI)
- Supabase Edge Functions: co-located with auth provider, Deno runtime, free tier includes 500K invocations/month
- Single webhook handler: idempotent processing of subscription lifecycle events
- Trial support: Stripe natively supports 14-day free trials on subscriptions

**Bundle Size:** 0 KB (Stripe Checkout is a redirect, not a client-side SDK)

**Key Features:**
- Checkout session created by Edge Function (not client-side) to protect Stripe secret key
- Webhook handler verifies signatures, processes events idempotently
- Events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Entitlement updated server-side, client polls or re-validates on redirect return
- Customer Portal session created by Edge Function, opened via redirect

**Implementation Pattern:**
```typescript
// supabase/functions/stripe-webhook/index.ts (Supabase Edge Function)
// Handles: POST /functions/v1/stripe-webhook
// Verifies Stripe signature, updates entitlement record in Supabase DB
// Returns 200 to Stripe on success (idempotent — duplicate events are no-ops)

// supabase/functions/create-checkout/index.ts (Supabase Edge Function)
// Handles: POST /functions/v1/create-checkout
// Auth: requires Supabase JWT
// Creates Stripe Checkout Session with trial_period_days: 14
// Returns { url: string } for client redirect

// supabase/functions/create-portal/index.ts (Supabase Edge Function)
// Handles: POST /functions/v1/create-portal
// Auth: requires Supabase JWT
// Creates Stripe Customer Portal Session
// Returns { url: string } for client redirect
```

**Affects:** Settings subscription panel, upgrade CTAs, entitlement system, legal pages

---

#### Premium Code Boundary: Vite Build Exclusion

**Decision:** Premium features live in `src/premium/` with a proprietary license. The AGPL core build excludes this directory via a Vite plugin that errors on `@/premium/*` imports during core builds. Premium builds include it via a separate Vite config.

**Rationale:**
- Directory isolation is simpler than feature flags for license separation
- Build-time import guard prevents accidental coupling (not just tree-shaking)
- Separate Vite config (`vite.config.premium.ts`) enables different entry points and dependencies
- CI runs core-only build to verify no premium leakage

**Bundle Size:** 0 KB impact on core build (premium code excluded entirely)

**Key Features:**
- `npm run build` → AGPL core build (excludes `src/premium/`)
- `npm run build:premium` → Full build (includes `src/premium/`)
- ESLint rule or Vite plugin errors if `src/` (non-premium) imports from `@/premium/*`
- `src/premium/index.ts` exports lazy component factories and feature flags
- Core components use `useIsPremium()` + `React.lazy()` to conditionally load premium features

**Implementation Pattern:**
```typescript
// src/premium/index.ts — Premium entry point (proprietary license)
export const PremiumAISummary = lazy(() => import('./features/AISummary'))
export const PremiumSpacedReview = lazy(() => import('./features/SpacedReview'))

// Core component usage:
function VideoPlayerToolbar() {
  const { isPremium } = useIsPremium()
  return isPremium
    ? <Suspense fallback={<Skeleton />}><PremiumAISummary /></Suspense>
    : <UpgradeCTA feature="ai-summary" />
}
```

**Affects:** Build system, CI pipeline, all premium feature components, licensing compliance
```

**Step 2: Update Decision Impact Analysis (line 1023)**

After the existing "3. Intelligence & Polish" phase, add:

```markdown
4. **Platform & Entitlement (Epic 19):**
   - Supabase Auth integration (sign-up, sign-in, session management)
   - Stripe Checkout + Customer Portal via Edge Functions
   - Entitlement system with offline caching
   - Premium code boundary (`src/premium/`)
   - Legal pages (Privacy Policy, Terms of Service)
   - GDPR compliance (account deletion, data export)
```

And add to Cross-Component Dependencies:

```markdown
- **Auth → Entitlement:** Supabase JWT required for entitlement validation
- **Stripe → Entitlement:** Webhook events update subscription status, trigger entitlement cache refresh
- **Entitlement → Premium Features:** `useIsPremium()` gates all premium component rendering
- **Premium Boundary → Build System:** Vite plugin enforces import restrictions at build time
```

And update Performance Budget:

```markdown
- Supabase Auth SDK: 40 KB (premium-only, not loaded for free users)
- **Updated Total:** ~527 KB / 750 KB target ✅ (70% of budget)
```

**Step 3: Commit**

```bash
git add docs/planning-artifacts/architecture.md
git commit -m "docs: add auth, entitlement, Stripe, and premium boundary ADRs to Architecture"
```

---

## Task 3: Define Dexie.js Schema v3 in Architecture

**Files:**
- Modify: `docs/planning-artifacts/architecture.md:533` — insert after v2 schema

**Step 1: Add v3 schema after line 533**

Insert after the existing v2 block:

```typescript
// v3: Platform & Entitlement tables (Epic 19)
db.version(3).stores({
  entitlements: 'userId, tier, expiresAt, cachedAt, stripeCustomerId, planId'
})
// Note: Auth state is managed by Supabase SDK (localStorage), NOT Dexie.
// Only entitlement cache lives in IndexedDB for offline access.
// `userId` is the Supabase auth user ID (UUID).
```

**Step 2: Commit**

```bash
git add docs/planning-artifacts/architecture.md
git commit -m "docs: define Dexie.js schema v3 with entitlement table"
```

---

## Task 4: Add Auth/Entitlement/Stripe Data Flows to Architecture

**Files:**
- Modify: `docs/planning-artifacts/architecture.md` — insert after line 2712 (after "Momentum Scoring Flow")

**Step 1: Add data flows**

Insert after the existing data flow section:

```markdown
**Authentication Flow:**
```
User clicks "Sign Up" or "Sign In"
  → useAuthStore: Show auth modal/page
  → Supabase SDK: signUp() / signInWithPassword() / signInWithOtp() / signInWithOAuth()
  → Supabase: Returns session + JWT
  → useAuthStore: Update user state
  → useEntitlementStore: validate() → fetch entitlement from Edge Function
  → Dexie.js: Cache entitlement in `entitlements` table
  → UI: Premium features enabled if entitled
```

**Stripe Checkout Flow:**
```
User clicks "Upgrade to Premium"
  → Supabase Edge Function: create-checkout (POST with JWT)
  → Stripe API: Create Checkout Session (with trial_period_days if eligible)
  → Client: window.location.href = session.url (redirect to Stripe)
  → Stripe Checkout: User enters payment info
  → Stripe: Redirects back to LevelUp success URL
  → Client: Polls entitlement endpoint for up to 10 seconds
  → Stripe Webhook → Edge Function: Update entitlement in Supabase DB
  → Client: Entitlement validated, premium features activated
```

**Entitlement Validation Flow:**
```
App launches
  → useEntitlementStore: Check cached entitlement in Dexie `entitlements` table
  → If cache < 7 days old AND offline → honor cache, enable premium
  → If cache ≥ 7 days old AND offline → disable premium, show message
  → If online → fetch /functions/v1/validate-entitlement (with JWT)
    → If server unreachable → honor existing cache
    → If server returns valid → update Dexie cache, enable premium
    → If server returns expired/cancelled → clear cache, disable premium, show resubscribe CTA
```

**Account Deletion Flow:**
```
User clicks "Delete My Account" in Settings
  → Confirmation dialog: type "DELETE" to confirm
  → If active subscription: Cancel Stripe subscription first
  → Supabase Edge Function: delete-account (POST with JWT)
    → Stripe API: Delete customer record
    → Supabase Auth: Delete user
  → Client: Clear entitlement cache from Dexie
  → Client: Sign out, continue with core features (local data preserved)
```
```

**Step 2: Commit**

```bash
git add docs/planning-artifacts/architecture.md
git commit -m "docs: add auth, checkout, entitlement, and deletion data flows"
```

---

## Task 5: Add Premium Directory to Project Structure

**Files:**
- Modify: `docs/planning-artifacts/architecture.md:2211` — insert after `analytics/` directory

**Step 1: Insert premium directory structure after line 2211**

```
│   ├── premium/            # Premium features (proprietary license, excluded from AGPL build)
│   │   ├── index.ts        # Lazy component exports and feature flags
│   │   ├── features/       # Premium feature components
│   │   │   ├── AISummary.tsx
│   │   │   ├── AIQandA.tsx
│   │   │   ├── SpacedReview.tsx
│   │   │   └── AdvancedExport.tsx
│   │   └── LICENSE          # Proprietary license (not AGPL)
│   │
│   ├── lib/
│   │   ├── auth/            # Authentication utilities
│   │   │   ├── supabase.ts  # Supabase client singleton
│   │   │   └── guards.ts    # Route guards and auth helpers
│   │   └── entitlement/     # Entitlement validation
│   │       └── isPremium.ts # useIsPremium() hook and cache logic
│   │
```

**Step 2: Add Architectural Boundary for Premium**

Insert in the Architectural Boundaries section (after existing boundaries, ~line 2395):

```markdown
#### Premium Boundary (`src/premium/`)

**Responsibility:** Contains all proprietary premium feature implementations. Excluded from AGPL core build.
**Communication:** Core components access premium features ONLY through lazy imports from `src/premium/index.ts`, gated by `useIsPremium()` hook.
**Do NOT:** Import from `src/premium/` directly in any core file. Do not place shared utilities in `src/premium/` — use `src/lib/` for shared code.
**Pattern:** Lazy component factory with Suspense fallback

**Access Pattern:**
- Core → Premium: `useIsPremium()` check + `React.lazy(() => import('@/premium'))`
- Premium → Core: Premium features MAY import from core (`@/app/`, `@/lib/`, `@/stores/`)
- Never: Core importing Premium directly (enforced by build-time guard)
```

**Step 3: Commit**

```bash
git add docs/planning-artifacts/architecture.md
git commit -m "docs: add premium directory structure and architectural boundary"
```

---

## Task 6: Resolve Conflicting Epic 19 Document

**Files:**
- Rename: `docs/planning-artifacts/epic-19-engagement-adaptive-experience.md` → `docs/planning-artifacts/epic-20-engagement-adaptive-experience.md`
- Modify: renamed file — update title, story IDs, and internal references

**Step 1: Rename the file**

```bash
git mv docs/planning-artifacts/epic-19-engagement-adaptive-experience.md docs/planning-artifacts/epic-20-engagement-adaptive-experience.md
```

**Step 2: Update internal references in the renamed file**

Replace all occurrences:
- `# Epic 19:` → `# Epic 20:`
- `E19-S` → `E20-S` (all story IDs)
- `Epic 19` → `Epic 20` (in body text, except cross-references to other epics)

**Step 3: Check for references to "epic-19-engagement" in other files**

```bash
grep -r "epic-19-engagement" docs/ --include="*.md" -l
```

Update any references found.

**Step 4: Commit**

```bash
git add -A
git commit -m "docs: rename Engagement epic from 19 to 20 to resolve numbering conflict"
```

---

## Task 7: Update Epic 19 Stories with Dependencies, Technical Details, Error/Loading ACs

**Files:**
- Modify: `docs/planning-artifacts/epics.md:2442-2829` — all 9 Epic 19 stories

**Context:** Each story needs: (1) explicit `**Dependencies:**` line, (2) error state ACs, (3) loading state ACs. Following the format used by Epic 12+ stories.

**Step 1: Add to Story 19.1 (after last AC, before Story 19.2)**

```markdown
**Dependencies:** None (foundation story)

**Technical Details:**
- Auth provider: Supabase Auth (see Architecture ADR)
- Files: `src/lib/auth/supabase.ts`, `src/stores/useAuthStore.ts`
- Session management handled by Supabase SDK (localStorage)
- Password requirements: minimum 8 characters (Supabase default)

**Error State ACs:**

**Given** I attempt to sign up or sign in
**When** the network is unavailable or the auth provider is unreachable
**Then** I see an error message: "Unable to connect. Please check your internet connection and try again."
**And** a "Retry" button is available
**And** all core features remain accessible

**Given** I am using magic link sign-in
**When** I click a link that has expired (>10 minutes) or was already used
**Then** I see an error message: "This link has expired or was already used. Please request a new one."
**And** a "Send New Link" button is available

**Loading State ACs:**

**Given** I submit any authentication form
**When** the request is in progress
**Then** the submit button shows a loading spinner and is disabled
**And** form inputs are disabled to prevent duplicate submissions

**Given** the app launches and I was previously signed in
**When** the session is being restored
**Then** a brief loading indicator appears (not blocking — core features load immediately)
```

**Step 2: Add to Story 19.2 (after last AC)**

```markdown
**Dependencies:** Story 19.1 (authentication — Supabase JWT required for checkout session creation)

**Technical Details:**
- Checkout via Supabase Edge Function `create-checkout` (see Architecture ADR)
- Webhook handler: `supabase/functions/stripe-webhook/index.ts`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Test strategy: Stripe test mode API keys + `stripe trigger` CLI for webhook simulation

**Error State ACs:**

**Given** I click "Upgrade to Premium"
**When** the checkout session creation fails (network error, server error)
**Then** I see an error message: "Unable to start checkout. Please try again."
**And** I remain on the current page with no charge applied

**Given** I complete payment on Stripe Checkout
**When** the payment fails (card declined, insufficient funds, 3DS abandonment)
**Then** Stripe displays the error on the Checkout page
**And** I can retry with a different payment method or return to LevelUp
**And** no subscription is created

**Loading State ACs:**

**Given** I click "Upgrade to Premium"
**When** the checkout session is being created
**Then** the button shows a loading spinner and is disabled
```

**Step 3: Add to Story 19.3 (after last AC)**

```markdown
**Dependencies:** Story 19.1 (auth — user identity for entitlement lookup), Story 19.2 (Stripe — subscription creates entitlement)

**Technical Details:**
- Entitlement hook: `src/lib/entitlement/isPremium.ts` → `useIsPremium()`
- Returns: `{ isPremium: boolean, loading: boolean, tier: 'free' | 'trial' | 'premium' }`
- Dexie table: `entitlements` (schema v3, see Architecture)
- Cache TTL: 7 days (configurable via `ENTITLEMENT_CACHE_TTL_DAYS` constant)
- Test strategy: use `FIXED_DATE` pattern for cache expiry tests

**Error State ACs:**

**Given** the app launches and I am online
**When** the entitlement validation endpoint is unreachable (network error, server 500)
**Then** the existing cached entitlement is honored (if cache exists and is <7 days old)
**And** no error is shown to the user (silent retry on next launch)

**Given** the app launches and I am online
**When** the entitlement validation returns an explicit denial (subscription cancelled/expired)
**Then** premium features are disabled immediately
**And** the cached entitlement is cleared
**And** I see a message with an option to resubscribe

**Loading State ACs:**

**Given** the app launches with a stale entitlement cache
**When** re-validation is in progress
**Then** premium features show a brief skeleton/loading state (not blocked — core features load immediately)
```

**Step 4: Add to Story 19.4 (after last AC)**

```markdown
**Dependencies:** Story 19.1 (auth), Story 19.2 (Stripe — Customer Portal), Story 19.3 (entitlement — subscription status display)

**Technical Details:**
- Subscription data sourced from entitlement cache (Dexie) + Supabase Edge Function for fresh data
- "Manage Billing" → Edge Function `create-portal` → Stripe Customer Portal redirect
- Feature comparison: reference canonical tier matrix from open-core strategy

**Error State ACs:**

**Given** I click "Manage Billing" or "Cancel Subscription"
**When** the Stripe Portal session creation fails
**Then** I see an error message: "Unable to open billing management. Please try again."
**And** a "Retry" button is available

**Given** I navigate to Settings > Subscription
**When** the subscription data cannot be loaded (offline, server error)
**Then** I see the last cached subscription status with a note: "Last updated [date]"
**And** "Manage Billing" and "Cancel" buttons are disabled with tooltip: "Requires internet connection"

**Loading State ACs:**

**Given** I navigate to Settings > Subscription
**When** subscription data is being fetched
**Then** a skeleton loader appears for plan details
**And** action buttons are disabled until data loads
```

**Step 5: Add to Story 19.5 (after last AC)**

```markdown
**Dependencies:** Story 19.1 (auth — unauthenticated upgrade flow), Story 19.2 (Stripe — checkout redirect), Story 19.3 (entitlement — `useIsPremium()` hook)

**Technical Details:**
- Gating scope (this story): AI Summary button, AI Q&A panel, Spaced Review entry point (3 features)
- Remaining premium features gated in follow-up stories
- CTA component: `src/app/components/figma/UpgradeCTA.tsx`
- Uses `useIsPremium()` to conditionally render premium vs CTA

**Error State ACs:**

**Given** I click an upgrade CTA
**When** the Stripe Checkout session creation fails
**Then** I see an inline error near the CTA: "Unable to start upgrade. Please try again."
**And** the CTA remains clickable for retry

**Given** I click an upgrade CTA while unauthenticated
**When** the auth flow fails or is cancelled
**Then** I return to the page with the CTA still visible
**And** no upgrade is initiated

**AC for premium users:**

**Given** I have an active premium subscription
**When** I view a page with premium features
**Then** the premium features render fully (no CTA, no lock icon)
**And** no upgrade prompts are shown
```

**Step 6: Add to Story 19.6 (after last AC)**

```markdown
**Dependencies:** Story 19.3 (entitlement — `useIsPremium()` used by premium gate)

**Technical Details:**
- Core build: `npm run build` (uses `vite.config.ts`)
- Premium build: `npm run build:premium` (uses `vite.config.premium.ts`)
- Import guard: Vite plugin that errors on `@/premium/*` imports during core build
- License header: `// SPDX-License-Identifier: LicenseRef-LevelUp-Premium` + full proprietary notice
- CI: core-only build verified in CI pipeline (premium directory excluded)

**Testing Requirements:**
- CI runs `npm run build` (core-only) and verifies no errors
- CI runs `npm run build:premium` and verifies premium components are included
- ESLint rule or Vite plugin test: verify that importing from `@/premium/` in a core file produces a build error
```

**Step 7: Add to Story 19.7 (after last AC)**

```markdown
**Dependencies:** Story 19.1 (auth — sign-up form links to legal pages), Story 19.2 (Stripe — Checkout page links)

**Technical Details:**
- Routes: `/privacy` and `/terms` as public routes (no auth required)
- Content format: MDX files in `src/app/pages/legal/` (rendered at build time)
- Effective date tracked via frontmatter `effectiveDate` field
- Change notification: compare `effectiveDate` against `localStorage.getItem('legal-acknowledged-date')`
- Stripe disclosure: reference https://stripe.com/docs/checkout/compliance

**Error State ACs:**

**Given** I am not logged in
**When** I navigate to `/privacy` or `/terms`
**Then** I can view the full legal page without being redirected to login

**Loading State ACs:**

**Given** a material change has been made to the Privacy Policy or Terms
**When** I visit the app for the first time after the change
**Then** an in-app banner appears at the top of the page with a link to the updated document
**And** the banner has a "Dismiss" button that updates `localStorage` with the new effective date
```

**Step 8: Add to Story 19.8 (after last AC)**

```markdown
**Dependencies:** Story 19.1 (auth), Story 19.2 (Stripe — trial checkout), Story 19.3 (entitlement — trial tier), Story 19.4 (subscription management — cancel trial)

**Technical Details:**
- Trial configured via Stripe Checkout `subscription_data.trial_period_days: 14`
- Trial status is an entitlement tier: `tier: 'trial'` (distinct from `'premium'`)
- Trial indicator component: `src/app/components/figma/TrialIndicator.tsx` (header bar, right-aligned before notification bell)
- Reminder state: `localStorage.getItem('trial-reminder-dismissed-date')` — show max once per calendar day
- Test strategy: Stripe test clocks for trial lifecycle; `FIXED_DATE` pattern for countdown UI tests
- One trial per Stripe customer: enforced by checking `customer.subscriptions` for prior trial history before creating checkout session

**Error State ACs:**

**Given** I click "Start Free Trial"
**When** the checkout session creation fails
**Then** I see an error message: "Unable to start trial. Please try again."
**And** no payment method is collected

**Given** my trial has expired
**When** Stripe attempts the first charge and payment fails
**Then** premium features are disabled
**And** I see a message: "Your payment could not be processed. Please update your payment method to continue using premium features."
**And** a "Update Payment Method" button opens Stripe Customer Portal

**Trial uniqueness AC:**

**Given** I have previously used a free trial (on this Stripe customer record)
**When** I click "Start Free Trial" or "Upgrade to Premium"
**Then** I am taken directly to a paid checkout (no trial option)
**And** the UI reflects "Subscribe" not "Start Free Trial"

**Grace period AC:**

**Given** my trial end date has passed
**When** Stripe is processing the first charge (up to 1 hour after trial end)
**Then** premium features remain active during this grace period
**And** if the charge succeeds, premium continues seamlessly
**And** if the charge fails, premium is disabled after the grace period
```

**Step 9: Add to Story 19.9 (after last AC)**

```markdown
**Dependencies:** Story 19.1 (auth — account identity), Story 19.2 (Stripe — customer deletion), Story 19.3 (entitlement — cache clearing)

**Technical Details:**
- Deletion endpoint: Supabase Edge Function `delete-account`
- Sequence: (1) Cancel Stripe subscription, (2) Delete Stripe customer, (3) Delete Supabase auth user, (4) Clear local entitlement cache
- Stripe retention: `stripe.customers.del()` marks customer as deleted; Stripe retains records per legal obligations (7+ years for tax). The AC should reflect "deleted from LevelUp's perspective" not "deleted from Stripe's servers"
- Re-authentication: require password re-entry (or recent OAuth) before deletion (session must be <5 minutes old)
- Grace period: 7-day soft-delete — account marked for deletion, actual deletion after 7 days. User can cancel during grace period by signing in.
- Data export: extends existing export (FR85) with account-specific data (email, subscription history)

**Error State ACs:**

**Given** I confirm account deletion
**When** the Stripe customer deletion fails (open invoice, API error)
**Then** the deletion is aborted — no partial state
**And** I see an error message: "Account deletion failed. Please resolve any open invoices and try again."
**And** my account and subscription remain active

**Given** I confirm account deletion
**When** the auth provider deletion fails after Stripe succeeds
**Then** the system retries auth deletion up to 3 times
**And** if all retries fail, the account is flagged for manual admin review
**And** I see a message: "Account deletion is being processed. You will receive confirmation within 48 hours."

**Loading State ACs:**

**Given** I confirm account deletion by typing "DELETE"
**When** the deletion is in progress
**Then** a progress indicator shows the current step: "Cancelling subscription..." → "Removing account data..." → "Complete"
**And** all actions are disabled during processing
**And** the process completes within 30 seconds (NFR63)

**Re-authentication AC:**

**Given** I click "Delete My Account"
**When** my session is older than 5 minutes
**Then** I am prompted to re-enter my password (or re-authenticate via OAuth)
**Before** the deletion confirmation dialog appears
```

**Step 10: Commit**

```bash
git add docs/planning-artifacts/epics.md
git commit -m "docs: add dependencies, technical details, and error/loading ACs to all Epic 19 stories"
```

---

## Task 8: Create UX Text Specification for Auth, Subscription, and Upgrade Flows

**Files:**
- Create: `docs/planning-artifacts/epic-19-ux-specification.md`

**Context:** Full Figma wireframes are out of scope for this task. This creates a text-based UX specification documenting component placement, states, responsive behavior, and accessibility requirements — sufficient for implementation with design review after.

**Step 1: Create the UX specification file**

Create `docs/planning-artifacts/epic-19-ux-specification.md` with comprehensive text-based UX specs covering:

1. **Auth Modal/Page** — Sign-up/sign-in form with 3 methods, error states, loading states, mobile behavior
2. **Settings > Subscription** — Plan display, Manage Billing button, Cancel button, feature comparison
3. **Upgrade CTA Component** — Reusable component for all premium gating locations, responsive variants
4. **Trial Indicator** — Header placement, countdown format, responsive collapse
5. **Legal Pages** — Route layout, content structure, change notification banner
6. **Account Deletion** — Re-auth prompt, confirmation dialog, progress indicator
7. **Accessibility Requirements** — Focus management, ARIA labels, keyboard navigation for all new components
8. **Responsive Behavior** — Mobile (375px), tablet (768px), desktop (1440px) variants

Content should reference existing design tokens from `src/styles/theme.css` and existing shadcn/ui components from `src/app/components/ui/`.

**Step 2: Commit**

```bash
git add docs/planning-artifacts/epic-19-ux-specification.md
git commit -m "docs: create text-based UX specification for Epic 19 auth, subscription, and CTA flows"
```

---

## Verification

After all tasks are complete:

1. **Check NFR amendments** — Read NFR53, 56, 64 and verify they permit auth/payment traffic while preserving core-only guarantees
2. **Check Architecture ADRs** — Verify 4 new sections follow the existing Decision/Rationale/Bundle Size/Key Features/Implementation Pattern/Affects format
3. **Check Dexie schema v3** — Verify `entitlements` table is defined with correct indexes
4. **Check data flows** — Verify auth, checkout, entitlement validation, and deletion flows are documented
5. **Check Epic 19 document conflict** — Verify `epic-19-engagement-adaptive-experience.md` has been renamed to `epic-20-*` with updated story IDs
6. **Check story updates** — Verify all 9 stories have Dependencies, Technical Details, error ACs, and loading ACs
7. **Check UX spec** — Verify the new file covers auth, subscription, CTA, trial, legal, and deletion UX
8. **Run build** — `npm run build` to ensure no doc references broke anything (docs-only change, build should pass)
