## Edge Case Review — E19-S02 (2026-03-25)

**Reviewer:** Edge Case Hunter (bmad-review-edge-case-hunter)
**Scope:** `git diff main...HEAD` — all changed files in feature/e19-s02-stripe-subscription-integration
**Focus areas:** Stripe webhooks, checkout sessions, polling, entitlement caching, state transitions

### Unhandled Edge Cases

---

**[stripe-webhook/index.ts:22-25]** — `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` env var is unset
> Consequence: `createClient` receives `undefined`, producing an opaque runtime error on first DB query instead of clear startup failure
> Guard: `const url = Deno.env.get('SUPABASE_URL'); if (!url) throw new Error('SUPABASE_URL required');`

---

**[create-checkout/index.ts:47-48]** — `SUPABASE_URL` or `SUPABASE_ANON_KEY` env var is unset
> Consequence: Same as above — `createClient(undefined!, undefined!)` produces opaque Supabase SDK error deep in auth flow
> Guard: `if (!Deno.env.get('SUPABASE_URL') || !Deno.env.get('SUPABASE_ANON_KEY')) return new Response(JSON.stringify({error:'Server misconfigured'}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}});`

---

**[stripe-webhook/index.ts:55-64]** — Replay protection timestamp comparison uses string ordering on ISO dates
> Consequence: `existing.updated_at > eventTime` compares strings. If Supabase returns `+00:00` suffix while `eventTime` uses `Z`, ASCII ordering breaks (`+` < `Z`). A stale event could overwrite a newer one, re-granting premium after cancellation.
> Guard: `if (existing && new Date(existing.updated_at).getTime() > new Date(eventTime).getTime())`

---

**[stripe-webhook/index.ts:55-64]** — Replay protection uses read-then-write without DB-level locking
> Consequence: Two concurrent webhook events for the same user (e.g., `checkout.session.completed` + `customer.subscription.updated` fired simultaneously by Stripe) both read `updated_at` before either write lands, so both proceed. The final DB state depends on write ordering, not event ordering.
> Guard: Use conditional UPDATE: `UPDATE entitlements SET ... WHERE user_id = $1 AND updated_at < $eventTime` as a single atomic operation instead of SELECT then UPSERT.

---

**[stripe-webhook/index.ts:154]** — `subscription.items.data[0]?.price.id` does not guard `subscription.items` or `.data` being undefined
> Consequence: If Stripe returns a subscription object with `items` missing (API shape change, expansion not requested), accessing `.data` throws TypeError
> Guard: `planId: subscription.items?.data?.[0]?.price?.id`

---

**[stripe-webhook/index.ts:137-160]** — `stripe.subscriptions.update()` fails after `checkout.session.completed`
> Consequence: If subscription was immediately cancelled between session completion and webhook processing, the update call throws. The outer catch returns 500 and Stripe retries, but repeated retries keep failing. The user paid but never gets entitlement.
> Guard: Wrap subscription update in its own try/catch; if it fails, still upsert entitlement using session data (customer ID, userId), then log the metadata copy failure separately.

---

**[stripe-webhook/index.ts:166-191]** — `customer.subscription.updated` with unresolvable user ID returns 200 to Stripe
> Consequence: If neither subscription metadata nor `stripe_customer_id` DB lookup resolves a user, the event is dropped with console.error but 200 is returned. Stripe will not retry. User's tier is never updated for plan changes.
> Guard: `return new Response(JSON.stringify({ error: 'Cannot resolve user' }), { status: 500 })` to force Stripe retry.

---

**[stripe-webhook/index.ts:218-245]** — `invoice.payment_failed` with unresolvable user ID silently dropped
> Consequence: Same as above — failed payment not attributed to a user means their premium tier is never downgraded despite payment failure
> Guard: Return 500 for unresolvable users on payment failure events.

---

**[stripe-webhook/index.ts:136-139]** — `checkout.session.completed` with null `session.subscription` returns 200 after only breaking from switch
> Consequence: The `break` falls through to the return-200 at line 252. Stripe will not retry. If the checkout was somehow created as `mode: 'payment'` instead of `mode: 'subscription'`, the user paid but gets no entitlement and no retry.
> Guard: Return 500 instead of break: `return new Response(JSON.stringify({ error: 'No subscription on checkout session' }), { status: 500 });`

---

**[checkout.ts:57]** — `Date.now()` used for deadline calculation is non-monotonic
> Consequence: System clock jumps (NTP sync, VM suspend/resume, mobile device sleep) cause premature timeout or extended polling. On mobile, device entering sleep then waking skips `Date.now()` forward by sleep duration, immediately expiring the deadline.
> Guard: `const start = performance.now(); while (performance.now() - start < maxWaitMs)`

---

**[checkout.ts:87]** — `setTimeout` sleep in polling loop is not abortable when `signal` fires mid-sleep
> Consequence: After `signal.abort()`, the polling continues for up to one full `intervalMs` (2 seconds) before the next `signal?.aborted` check, making unnecessary network requests after component unmount
> Guard: `await Promise.race([new Promise(r => setTimeout(r, intervalMs)), new Promise((_, rej) => { if (signal?.aborted) rej(); signal?.addEventListener('abort', rej, { once: true }); })])`

---

**[checkout.ts:68-76]** — `data.tier` from Supabase is not validated against `EntitlementTier` union
> Consequence: If DB contains an unexpected tier value (e.g., future migration adds `'enterprise'`), the raw string passes `tier !== 'free'` check and is treated as premium. Cached and displayed to user as a valid premium entitlement.
> Guard: `const validTiers = new Set(['free','trial','premium']); if (!validTiers.has(data.tier)) { console.warn('Unknown tier:', data.tier); continue; }`

---

**[checkout.ts:107-130]** — `getCachedEntitlement` returns stale premium tier after server-side cancellation
> Consequence: 7-day TTL means a user who cancels via Stripe portal sees "Premium" in the UI for up to 7 days. The local Dexie cache is never invalidated by the webhook — only by TTL expiry or manual refresh.
> Guard: On app load when online, fetch entitlement from Supabase if cached record is older than 1 hour. Alternatively, invalidate cache on any `customer.subscription.deleted` event via a push mechanism.

---

**[checkout.ts:119]** — TTL boundary: `daysSinceCached > 7` treats exactly 7.000 days as valid
> Consequence: An entry cached exactly 168.000 hours ago is considered valid. If requirement is "7-day TTL" meaning "expires at 7 days", the boundary is off by epsilon.
> Guard: Change to `>= 7` if intent is strict 7-day expiry, or document `> 7` as intentional (valid through the 7th day).

---

**[SubscriptionCard.tsx:34-55 vs 58-100]** — Load-entitlement effect races with checkout-return effect on mount
> Consequence: Both `useEffect`s fire on mount when `checkoutStatus='success'` and `user` are set. `loadEntitlement` reads cache (null for first checkout), eventually calls `setState('free')`. Checkout effect calls `setState('activating')`. If `loadEntitlement` resolves after `setState('activating')`, it overwrites with `setState('free')`, breaking the activation flow — user sees free tier after paying.
> Guard: In load-entitlement effect: `if (checkoutStatus === 'success') return;`

---

**[SubscriptionCard.tsx:102-121]** — `checkoutInProgress.current` reset in `finally` after successful redirect
> Consequence: After `window.location.href = url`, the `finally` block runs before navigation completes, resetting `checkoutInProgress.current = false`. If user hits browser back button during slow navigation, the guard is defeated and a second checkout session can be created.
> Guard: Only reset `checkoutInProgress.current` in the error branch, not in `finally`.

---

**[SubscriptionCard.tsx:118]** — `setTimeout(() => setIsCheckoutLoading(false), 5000)` timer ID not stored or cleared
> Consequence: If component unmounts during the 5-second window, `setIsCheckoutLoading(false)` fires on unmounted component. Timer leaks memory until it fires.
> Guard: Store timer ID in a ref, clear in useEffect cleanup or in the successful redirect path.

---

**[SubscriptionCard.tsx:235]** — Premium state renders nothing when `entitlement` is null
> Consequence: If `state === 'premium'` but `entitlement` is null (race condition between effects, corrupted cache returning null after state was set), the CardContent body is entirely empty — user sees gold card header "Subscription" with blank body.
> Guard: Add fallback: `{state === 'premium' && !entitlement && <div>...</div>}` with a reload/refresh prompt.

---

**[SubscriptionCard.tsx:251]** — `new Date(entitlement.expiresAt).toLocaleDateString(...)` with invalid date string
> Consequence: Corrupted cache or null-coerced-to-string `expiresAt` produces `Invalid Date`, displayed verbatim as "Next billing: Invalid Date"
> Guard: `const d = new Date(entitlement.expiresAt); const label = isNaN(d.getTime()) ? 'Unknown' : d.toLocaleDateString(...)`

---

**[Settings.tsx:202]** — `useRef(searchParams.get('checkout'))` captures value at component initialization before React Router hydration completes
> Consequence: On initial render, `searchParams` may not be populated yet (SSR, static generation, or React Router v7 lazy hydration). The ref captures `null`, and checkout return handling is skipped — user sees free tier after paying.
> Guard: Read `searchParams` inside the `useEffect` body rather than capturing in a ref at initialization.

---

**[create-checkout/index.ts:92-93]** — Stripe customer search query does not escape `user.id`
> Consequence: If `user.id` contains a double quote (unusual for UUIDs but possible with custom auth providers), the search query syntax breaks: `metadata["supabase_user_id"]:"contains"quote"` — Stripe returns an API error or incorrect results
> Guard: `query: 'metadata["supabase_user_id"]:"' + user.id.replace(/["\\]/g, '\\$&') + '"'`

---

**Total:** 21 unhandled edge cases found.
