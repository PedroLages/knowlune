# E19-S02: Stripe Subscription Integration — Implementation Plan

## Context

Knowlune needs a premium subscription tier. E19-S01 established Supabase Auth (sign-up, sign-in, session management). E19-S02 adds the payment flow: users click "Upgrade to Premium" → redirect to Stripe Checkout → webhook updates entitlement → client confirms activation. No credit card data touches Knowlune — Stripe's hosted page handles all PCI-sensitive operations.

**Architecture ADR (from `docs/planning-artifacts/architecture.md:1128`):** Stripe Checkout (hosted redirect), Supabase Edge Functions for server-side operations, 0 KB client-side Stripe bundle.

## Scope Boundaries

| In E19-S02 | Deferred to E19-S03+ |
|------------|---------------------|
| `create-checkout` Edge Function | `useEntitlementStore` full lifecycle |
| `stripe-webhook` Edge Function | `useIsPremium()` hook |
| SubscriptionCard in Settings | App-launch entitlement validation |
| Checkout redirect + return polling | Offline degradation logic |
| Minimal entitlement cache (Dexie v23) | Premium feature gating (E19-S05) |
| CSP updates for Supabase | Stripe Customer Portal (E19-S04) |
| Supabase DB `entitlements` table | Trial flow (E19-S08) |

## Tasks

### Task 1: Supabase DB Schema — `entitlements` table
**Files:** `supabase/migrations/001_entitlements.sql` (new)

Create the entitlements table in Supabase with RLS:
```sql
CREATE TABLE public.entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'trial', 'premium')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own entitlement"
  ON public.entitlements FOR SELECT
  USING (auth.uid() = user_id);
```

**Manual step:** Run migration on Pedro's self-hosted Supabase (titan.local). The webhook handler needs write access (service_role key), users only need SELECT via RLS.

**Commit after this task.**

---

### Task 2: Supabase Edge Function — `create-checkout`
**Files:** `supabase/functions/create-checkout/index.ts` (new)

Flow:
1. Verify Supabase JWT from `Authorization` header
2. Extract `user_id` from JWT
3. Look up or create Stripe customer (by email)
4. Create Stripe Checkout Session with:
   - `success_url: {origin}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url: {origin}/settings?checkout=cancel`
   - `customer` (Stripe customer ID)
   - `mode: 'subscription'`
   - `line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]`
   - `client_reference_id: user_id` (for webhook correlation)
5. Return `{ url: session.url }` to client

**Environment variables** (Edge Function secrets, NOT client-side):
- `STRIPE_SECRET_KEY` — Stripe API secret key
- `STRIPE_PRICE_ID` — Price ID for the premium plan
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret

**Dependencies:** `stripe` npm package (Deno import from npm: or esm.sh)

**Commit after this task.**

---

### Task 3: Supabase Edge Function — `stripe-webhook`
**Files:** `supabase/functions/stripe-webhook/index.ts` (new)

Flow:
1. Read raw request body + `Stripe-Signature` header
2. Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
3. Handle events (idempotent — duplicate events are no-ops):

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upsert entitlement: `tier='premium'`, set `stripe_customer_id`, `stripe_subscription_id`, `plan_id`, `expires_at` |
| `customer.subscription.updated` | Update `tier`, `plan_id`, `expires_at` based on subscription status |
| `customer.subscription.deleted` | Set `tier='free'`, clear plan/expiry |
| `invoice.payment_failed` | Set `tier` based on subscription status (may stay premium if retrying) |

4. Use Supabase `service_role` key for DB writes (bypasses RLS)
5. Return `200` to Stripe on success

**Idempotency:** Check `updated_at` timestamp — skip if event would produce same state. Use `event.id` tracking if needed for deduplication.

**Commit after this task.**

---

### Task 4: CSP + Environment Updates
**Files:**
- `index.html` — Add Supabase to CSP `connect-src`
- `.env.example` — Add Stripe public key placeholder

**CSP changes** (in `index.html` meta tag):
```
connect-src 'self' ws: wss: https://huggingface.co https://*.huggingface.co https://*.hf.co https://raw.githubusercontent.com http://titan.local:8000;
```

Add the Supabase URL to `connect-src` so the client can call Edge Functions. No other Stripe domains needed — checkout is a full page redirect (not iframe or SDK).

**.env.example additions:**
```env
# Stripe — public key only (secret key is in Edge Function env)
# VITE_STRIPE_PRICE_ID=price_xxx  # Optional: can hardcode in Edge Function
```

**Note:** No `@stripe/stripe-js` package needed. Checkout is a `window.location.href` redirect — 0 KB bundle impact per architecture ADR.

**Commit after this task.**

---

### Task 5: Dexie Schema v23 — `entitlements` table
**Files:** `src/db/schema.ts`

Add a new Dexie version for local entitlement caching:
```typescript
db.version(23).stores({
  // ... all 25 existing v22 tables (must redeclare) ...
  entitlements: 'userId',  // NEW: local entitlement cache
})
```

TypeScript interface:
```typescript
interface CachedEntitlement {
  userId: string
  tier: 'free' | 'trial' | 'premium'
  stripeCustomerId?: string
  planId?: string
  expiresAt?: string  // ISO date
  cachedAt: string    // ISO date — for 7-day TTL check
}
```

**Commit after this task.**

---

### Task 6: Client-Side Checkout Service
**Files:** `src/lib/checkout.ts` (new)

Functions:
```typescript
/** Initiates checkout by calling create-checkout Edge Function */
export async function startCheckout(): Promise<{ url: string } | { error: string }>

/** Polls Supabase entitlements table until tier !== 'free' or timeout */
export async function pollEntitlement(
  maxWaitMs?: number,  // default 10000
  intervalMs?: number  // default 1000
): Promise<CachedEntitlement | null>

/** Caches entitlement to Dexie */
export async function cacheEntitlement(entitlement: CachedEntitlement): Promise<void>

/** Reads cached entitlement from Dexie */
export async function getCachedEntitlement(userId: string): Promise<CachedEntitlement | null>
```

`startCheckout` flow:
1. Get session from `useAuthStore` → extract access token
2. Call `supabase.functions.invoke('create-checkout', { body: {} })`
3. Return `{ url }` on success, `{ error }` on failure

`pollEntitlement` flow:
1. Query Supabase DB directly: `supabase.from('entitlements').select('*').single()`
2. If tier !== 'free' → cache locally, return entitlement
3. If tier === 'free' → wait `intervalMs`, retry
4. After `maxWaitMs` → return null (timeout)

**Commit after this task.**

---

### Task 7: SubscriptionCard Component
**Files:** `src/app/components/settings/SubscriptionCard.tsx` (new)

Three states based on auth + entitlement:

**State 1: Not authenticated** — Hidden (Account card handles auth flow)

**State 2: Free tier** (authenticated, no premium entitlement):
```
┌────────────────────────────────────────────┐
│  [Crown icon]  Subscription                │  ← CardHeader with gold-muted bg
│  Upgrade to unlock premium features        │
├────────────────────────────────────────────┤
│  ┌──────┐                                  │
│  │ Free │   Basic features included        │  ← Badge variant="secondary"
│  └──────┘                                  │
│                                            │
│  ✓ AI Video Summaries                      │  ← Feature list
│  ✓ Knowledge Gap Detection                 │
│  ✓ AI Learning Paths                       │
│  ✓ Auto Note Organization                  │
│                                            │
│  [Upgrade to Premium]                      │  ← variant="brand", full-width
└────────────────────────────────────────────┘
```

**State 3: Premium** (active subscription):
```
┌────────────────────────────────────────────┐
│  [Crown icon]  Subscription                │
│  Manage your plan and billing              │
├────────────────────────────────────────────┤
│  ┌─────────┐                               │
│  │ Premium │   Monthly                     │  ← Badge with bg-brand
│  └─────────┘                               │
│                                            │
│  Status: ✓ Active                          │  ← text-success
│  Next billing: April 14, 2026             │  ← text-muted-foreground
└────────────────────────────────────────────┘
```

**State 4: Activation polling** (checkout return with `?checkout=success`):
```
┌────────────────────────────────────────────┐
│  [Loader spinning]  Activating...          │
│  Setting up your premium subscription      │
├────────────────────────────────────────────┤
│  [Progress bar - indeterminate]            │
│  This usually takes a few seconds...       │
└────────────────────────────────────────────┘
```

Design tokens: `bg-gold-muted` for icon background, `text-gold` for icon, `shadow-gold` for subtle card elevation. Follows Settings Card pattern (`CardHeader` with `border-b border-border/50 bg-surface-sunken/30`).

UX spec reference: `docs/planning-artifacts/epic-19-ux-specification.md` § 2.

**Commit after this task.**

---

### Task 8: Integrate SubscriptionCard into Settings Page
**Files:** `src/app/pages/Settings.tsx`

Changes:
1. Import `SubscriptionCard`
2. Insert between Account card and Profile card (line ~523)
3. Only render when `user` is authenticated: `{user && <SubscriptionCard />}`
4. Read checkout query params (`?checkout=success|cancel`) on mount:
   - `checkout=success` + `session_id` → trigger polling in SubscriptionCard
   - `checkout=cancel` → show toast "Upgrade not completed" via `toastError`
   - Clean up query params from URL after processing (`window.history.replaceState`)

**Commit after this task.**

---

### Task 9: End-to-End Flow Testing
**Files:** No new test files (ATDD skipped per user choice)

Manual testing with Stripe test mode:
1. Configure Stripe test API keys in Supabase Edge Function secrets
2. Deploy Edge Functions to local Supabase: `supabase functions deploy create-checkout` and `supabase functions deploy stripe-webhook`
3. Set up Stripe webhook endpoint pointing to local Supabase
4. Test full flow:
   - Click "Upgrade to Premium" → verify redirect to Stripe Checkout
   - Use test card `4242 4242 4242 4242` → verify redirect back
   - Verify polling activates → webhook fires → entitlement cached → UI updates
   - Test cancel flow → verify toast and free tier preserved
   - Test error: kill Supabase → verify error toast on checkout initiation

**Stripe CLI for webhook testing:**
```bash
stripe listen --forward-to http://titan.local:8000/functions/v1/stripe-webhook
stripe trigger checkout.session.completed
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/stores/useAuthStore.ts` | Auth state, Supabase session |
| `src/lib/auth/supabase.ts` | Supabase client singleton |
| `src/lib/toastHelpers.ts` | Toast notification patterns |
| `src/app/pages/Settings.tsx` | Integration point for SubscriptionCard |
| `src/db/schema.ts` | Dexie schema (currently v22, add v23) |
| `src/styles/theme.css` | Gold tokens (`--gold`, `--gold-muted`) |
| `docs/planning-artifacts/epic-19-ux-specification.md` § 2 | Detailed UI spec |
| `docs/planning-artifacts/architecture.md:1128-1166` | Stripe architecture ADR |
| `index.html:16-31` | CSP meta tag |

## Reusable Patterns

- **Auth guard pattern**: `if (!supabase) return { error: NOT_CONFIGURED_MESSAGE }` (from `useAuthStore.ts`)
- **Settings Card pattern**: `CardHeader` with icon + title + subtitle (from `Settings.tsx:454-471`)
- **Toast helpers**: `toastSuccess.saved()`, `toastError.saveFailed()` (from `src/lib/toastHelpers.ts`)
- **Loading spinner**: `<Loader2 className="size-4 animate-spin" />` (used in 18+ files)
- **Button disabled pattern**: `disabled={isLoading}` + spinner (from auth forms)

## Verification

After implementation:
1. `npm run build` — verify no build errors (especially CSP and imports)
2. `npm run lint` — verify no ESLint violations (design tokens, error handling)
3. `npx tsc --noEmit` — verify TypeScript types
4. Manual Stripe test mode flow (Task 9 checklist above)
5. Verify Settings page renders correctly with:
   - Unauthenticated → no subscription card
   - Authenticated free → upgrade CTA visible
   - After checkout success → polling → premium card

## Commit Strategy

Make granular commits after each task as save points:
1. `feat(e19-s02): add entitlements table migration`
2. `feat(e19-s02): add create-checkout edge function`
3. `feat(e19-s02): add stripe-webhook edge function`
4. `feat(e19-s02): update CSP and env config`
5. `feat(e19-s02): add dexie v23 entitlements schema`
6. `feat(e19-s02): add checkout service`
7. `feat(e19-s02): add SubscriptionCard component`
8. `feat(e19-s02): integrate subscription card into settings`
