## Edge Case Review — E19-S02 (2026-03-25)

### Unhandled Edge Cases

---

**[create-checkout/index.ts:9]** — `STRIPE_SECRET_KEY` env var is unset or empty

> Consequence: The `!` non-null assertion on `Deno.env.get('STRIPE_SECRET_KEY')!` causes the Stripe client to be instantiated with `undefined`, which will throw an opaque runtime error on the first API call rather than at startup with a clear message.
> Guard: `const key = Deno.env.get('STRIPE_SECRET_KEY'); if (!key) throw new Error('STRIPE_SECRET_KEY is required');`

---

**[create-checkout/index.ts:14]** — `STRIPE_PRICE_ID` env var is unset

> Consequence: Same `!` assertion. `stripe.checkout.sessions.create` will pass `undefined` as the price, yielding a confusing Stripe API error ("No such price: undefined") instead of a clear startup failure.
> Guard: Add a startup check: `if (!STRIPE_PRICE_ID) throw new Error('STRIPE_PRICE_ID is required');`

---

**[create-checkout/index.ts:52-55]** — `user.email` is null (phone-auth or SSO without email)

> Consequence: `stripe.customers.list({ email: undefined })` returns all customers (no filter), so `existingCustomers.data[0]` picks a random unrelated customer. A checkout session is then created under someone else's Stripe customer record.
> Guard: `if (!user.email) return new Response(JSON.stringify({ error: 'Account has no email — cannot create checkout' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });`

---

**[create-checkout/index.ts:52-59]** — Multiple Stripe customers share the same email

> Consequence: `limit: 1` picks the first match, which may be a different user's customer record. The checkout session would be associated with the wrong customer, mixing subscription billing between users.
> Guard: After finding a customer, verify `existingCustomers.data[0].metadata.supabase_user_id === user.id`, or always look up by metadata rather than email: `stripe.customers.search({ query: 'metadata["supabase_user_id"]:"' + user.id + '"' })`.

---

**[create-checkout/index.ts:21-95]** — Non-POST HTTP methods (GET, PUT, DELETE) are not rejected

> Consequence: Any HTTP method is accepted and processed. A GET request would fail at `req.json()` (line 69) but return a generic 500 error instead of 405 Method Not Allowed.
> Guard: After the OPTIONS check, add: `if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });`

---

**[create-checkout/index.ts:70]** — `origin` is attacker-controlled from request body

> Consequence: A malicious client can set `body.origin` to `https://evil.com`, and the Stripe session `success_url` / `cancel_url` will redirect the user to an attacker-controlled domain after checkout, enabling phishing or session token theft.
> Guard: Validate `origin` against an allowlist: `const ALLOWED_ORIGINS = [Deno.env.get('APP_URL'), 'http://localhost:5173'].filter(Boolean); if (!ALLOWED_ORIGINS.includes(origin)) return new Response(JSON.stringify({ error: 'Invalid origin' }), { status: 400 });`

---

**[create-checkout/index.ts:73-81]** — User already has an active premium subscription

> Consequence: Nothing prevents a premium user from creating another checkout session. They could end up with duplicate Stripe subscriptions and double-billing.
> Guard: Before creating the session, query the entitlements table: `const { data: ent } = await supabaseClient.from('entitlements').select('tier').eq('user_id', user.id).single(); if (ent?.tier === 'premium') return new Response(JSON.stringify({ error: 'Already subscribed' }), { status: 409 });`

---

**[stripe-webhook/index.ts:15]** — `STRIPE_WEBHOOK_SECRET` env var is unset

> Consequence: `constructEventAsync` is called with `undefined` as the secret. Depending on the Stripe SDK version, this may accept all signatures (bypassing verification) or throw an unclear error.
> Guard: `const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET'); if (!WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is required');`

---

**[stripe-webhook/index.ts:88-94]** — `checkout.session.completed` fires but `client_reference_id` and `metadata.supabase_user_id` are both null

> Consequence: The event is silently dropped with only a `console.error`. Stripe receives a 200 (line 197) and will not retry. The user paid but never gets their entitlement — a lost payment with no alerting.
> Guard: Return a 500 to force Stripe retry, and/or add an external alerting mechanism (e.g., Sentry, email): `return new Response(JSON.stringify({ error: 'Missing user ID' }), { status: 500 });`

---

**[stripe-webhook/index.ts:99-103]** — `session.subscription` is null (one-time payment mode)

> Consequence: `subscription` stays null, so `upsertEntitlement` is called with `stripeSubscriptionId: undefined`, `planId: undefined`, and `expiresAt: undefined`. The user gets premium tier with no expiry tracking — no renewal/cancellation lifecycle.
> Guard: This should be impossible for `mode: 'subscription'` checkouts, but add a defensive check: `if (!session.subscription) { console.error('checkout.session.completed: no subscription ID', session.id); break; }`

---

**[stripe-webhook/index.ts:120-141]** — `customer.subscription.updated` race condition with `checkout.session.completed`

> Consequence: Stripe often fires `customer.subscription.updated` immediately after `checkout.session.completed`. If the update event arrives before the checkout handler has copied `supabase_user_id` into subscription metadata (line 100-102), `subscription.metadata.supabase_user_id` is undefined and the event is silently dropped.
> Guard: For `customer.subscription.updated` when metadata is missing, fall back to looking up the customer's user_id from the entitlements table by `stripe_customer_id`: `const { data } = await supabaseAdmin.from('entitlements').select('user_id').eq('stripe_customer_id', subscription.customer).single();`

---

**[stripe-webhook/index.ts:68]** — Webhook receives non-POST request

> Consequence: No method check exists. A GET request would fail at `req.text()` or signature verification, returning a 500 and triggering unnecessary Stripe retries.
> Guard: `if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });`

---

**[stripe-webhook/index.ts:86-194]** — Webhook event replay / out-of-order delivery

> Consequence: The upsert is based on `user_id` conflict, but there is no `updated_at` comparison. A replayed older event (e.g., an old `subscription.updated` with `status: 'active'`) can overwrite a newer `subscription.deleted` event, re-granting premium access after cancellation.
> Guard: Add a conditional upsert that only writes if the incoming `updated_at` is newer: include a `WHERE updated_at < NOW()` guard, or compare event timestamps: `if (event.created < existingRecord.stripe_event_timestamp) return;`

---

**[checkout.ts:47-89]** — `pollEntitlement` called when Supabase is self-hosted and slow to process webhook

> Consequence: The 10-second timeout is hardcoded. On a self-hosted Supabase instance (which the project uses per memory context), Edge Function cold starts plus webhook processing can easily exceed 10 seconds. The user sees "Subscription is being processed" even though payment succeeded.
> Guard: Increase default `maxWaitMs` to 30 seconds, or make it configurable. Also consider exponential backoff instead of fixed 1-second intervals.

---

**[checkout.ts:56-86]** — Polling loop does not abort on component unmount

> Consequence: The `cancelled` flag in `SubscriptionCard.tsx` prevents state updates, but the polling loop in `checkout.ts` itself continues making network requests for up to 10 seconds after the component unmounts (e.g., user navigates away from Settings).
> Guard: Accept an `AbortSignal` parameter: `pollEntitlement(maxWaitMs, intervalMs, signal?: AbortSignal)` and check `signal?.aborted` in the loop.

---

**[checkout.ts:107-128]** — `getCachedEntitlement` returns stale premium tier after subscription was cancelled server-side

> Consequence: The 7-day TTL means a user who cancels their subscription via Stripe's customer portal will still see "Premium" in the UI for up to 7 days, since the local Dexie cache is not invalidated by the webhook.
> Guard: On every app load (not just checkout return), fetch the entitlement from Supabase if the cached record is older than e.g., 1 hour, or provide a "Refresh" button. Alternatively, reduce TTL to 1 day.

---

**[SubscriptionCard.tsx:96-108]** — Double-click on "Upgrade to Premium" button

> Consequence: `isCheckoutLoading` prevents re-clicks, but `handleUpgrade` does not prevent concurrent invocations if React batches the state update. Two rapid clicks before the first `setIsCheckoutLoading(true)` is flushed could trigger two `startCheckout()` calls, creating two Stripe checkout sessions.
> Guard: Add a ref-based guard: `const checkoutInProgress = useRef(false); if (checkoutInProgress.current) return; checkoutInProgress.current = true;`

---

**[SubscriptionCard.tsx:77-79]** — `setTimeout` in activated state is not cleaned up on unmount

> Consequence: If the component unmounts during the 3-second celebration timeout (user navigates away), `setState('premium')` fires on an unmounted component. The `cancelled` flag from the outer effect does protect the `setState` call, but the timeout itself leaks.
> Guard: Store the timeout ID and clear it in the effect cleanup: `const timerId = setTimeout(...); return () => { cancelled = true; clearTimeout(timerId); }`

---

**[Settings.tsx:202-214]** — `checkoutParamRef.current` accepts arbitrary string values

> Consequence: The cast `as 'success' | 'cancel' | null` does not actually validate the value. A URL like `?checkout=hacked` passes the truthy check and is forwarded to `SubscriptionCard` as `checkoutStatus`. The component only checks for `'cancel'` and `'success'`, so an unknown value is silently ignored — but it still triggers the `useEffect` dependency change.
> Guard: Validate the param: `const raw = checkoutParamRef.current; const status = raw === 'success' || raw === 'cancel' ? raw : null;`

---

**[001_entitlements.sql:5-14]** — No index on `stripe_customer_id` or `stripe_subscription_id`

> Consequence: The webhook fallback lookup by `stripe_customer_id` (if implemented per the race condition guard above) would require a sequential scan. Even without that, debugging queries in the Supabase dashboard that filter by Stripe IDs will be slow as the table grows.
> Guard: `CREATE INDEX idx_entitlements_stripe_customer ON public.entitlements (stripe_customer_id);`

---

**[001_entitlements.sql:16-22]** — No RLS policy for INSERT/UPDATE/DELETE by users

> Consequence: This is intentionally service-role-only for writes, which is correct. However, there is no explicit `DENY` policy, meaning if a future migration adds a permissive policy, it could inadvertently allow user writes. This is a defense-in-depth concern, not a current bug.
> Guard: Add an explicit restrictive policy: `CREATE POLICY "Deny user writes" ON public.entitlements FOR ALL USING (false) WITH CHECK (false);` (service_role bypasses RLS anyway).

---

**[create-checkout/index.ts:16-18]** — CORS allows all origins (`*`)

> Consequence: Any website can invoke the `create-checkout` function via a cross-origin request (though the JWT is still required). Combined with the `origin` injection issue above, this widens the attack surface.
> Guard: Restrict `Access-Control-Allow-Origin` to the configured `APP_URL` or a known allowlist.

---

**Total:** 21 unhandled edge cases found.
