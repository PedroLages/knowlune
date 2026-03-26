// E19-S02: Stripe Webhook Handler
// Handles: POST /functions/v1/stripe-webhook
// Auth: Stripe signature verification (no JWT — Stripe calls this directly)
// Events: checkout.session.completed, customer.subscription.updated,
//         customer.subscription.deleted, invoice.payment_failed

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

// Env var validation — fail fast if misconfigured
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')
if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is required')
if (!WEBHOOK_SECRET) throw new Error('STRIPE_WEBHOOK_SECRET is required')

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

// Env var validation — fail fast if misconfigured
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

// Service-role client for DB writes (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/** Maps Stripe subscription status to our tier enum */
function mapSubscriptionToTier(status: string): 'free' | 'trial' | 'premium' {
  switch (status) {
    case 'active':
      return 'premium'
    case 'trialing':
      return 'trial'
    case 'past_due':
      // Keep premium during grace period — Stripe retries payment
      return 'premium'
    default:
      return 'free'
  }
}

/** Upserts entitlement record for a user */
async function upsertEntitlement(
  params: {
    userId: string
    tier: 'free' | 'trial' | 'premium'
    stripeCustomerId: string
    stripeSubscriptionId?: string
    planId?: string
    expiresAt?: string
  },
  eventTime: string
) {
  // Event replay protection — skip if we already have a newer update
  const { data: existing } = await supabaseAdmin
    .from('entitlements')
    .select('updated_at')
    .eq('user_id', params.userId)
    .single()

  if (existing && existing.updated_at > eventTime) {
    console.warn(
      'Skipping stale webhook event, existing updated_at:',
      existing.updated_at,
      'event time:',
      eventTime
    )
    return
  }

  const { error } = await supabaseAdmin.from('entitlements').upsert(
    {
      user_id: params.userId,
      tier: params.tier,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      plan_id: params.planId ?? null,
      expires_at: params.expiresAt ?? null,
      updated_at: eventTime,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('Entitlement upsert failed:', error)
    throw new Error(`Failed to update entitlement: ${error.message}`)
  }
}

/** Resolves user ID from subscription metadata, falling back to stripe_customer_id lookup.
 *  Throws on DB errors (caller should return 500 for Stripe retry).
 *  Returns undefined only when user genuinely doesn't exist. */
async function resolveUserId(subscription: Stripe.Subscription): Promise<string | undefined> {
  let userId = subscription.metadata?.supabase_user_id
  if (!userId) {
    const { data, error } = await supabaseAdmin
      .from('entitlements')
      .select('user_id')
      .eq('stripe_customer_id', subscription.customer as string)
      .single()
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = "not found" — that's expected. Other errors are transient DB failures.
      throw new Error(`DB error resolving user ID: ${error.message}`)
    }
    userId = data?.user_id
  }
  return userId
}

Deno.serve(async (req: Request) => {
  // Method guard — only POST allowed
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    // 1. Verify Stripe webhook signature
    const body = await req.text()
    const signature = req.headers.get('Stripe-Signature')

    if (!signature) {
      return new Response('Missing Stripe-Signature header', { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET)
    } catch (err) {
      // silent-catch-ok: error logged server-side
      console.error('Webhook signature verification failed:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    const eventTime = new Date(event.created * 1000).toISOString()

    // 2. Handle events (idempotent — duplicate events are no-ops via upsert + replay protection)
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id ?? session.metadata?.supabase_user_id
        if (!userId) {
          console.error('checkout.session.completed: no user ID found', session.id)
          return new Response(JSON.stringify({ error: 'Missing user ID' }), { status: 500 })
        }

        // Null check — subscription may not exist for one-time payments
        if (!session.subscription) {
          console.error('checkout.session.completed: no subscription ID', session.id)
          break
        }

        // Retrieve the subscription and copy user ID into its metadata
        // so that future subscription lifecycle events can identify the user
        const subscription = await stripe.subscriptions.update(session.subscription as string, {
          metadata: { supabase_user_id: userId },
        })

        await upsertEntitlement(
          {
            userId,
            tier: 'premium',
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscription.id,
            planId: subscription.items.data[0]?.price.id,
            expiresAt: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : undefined,
          },
          eventTime
        )

        console.log(`checkout.session.completed: user ${userId} upgraded to premium`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = await resolveUserId(subscription) // throws on DB error → caught by outer try/catch → 500

        if (!userId) {
          console.warn('subscription.updated: user not found for subscription', subscription.id)
          break // User genuinely doesn't exist — acknowledge to Stripe (no retry)
        }

        const tier = mapSubscriptionToTier(subscription.status)

        await upsertEntitlement(
          {
            userId,
            tier,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            planId: subscription.items.data[0]?.price.id,
            expiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
          },
          eventTime
        )

        console.log(
          `customer.subscription.updated: user ${userId} → ${tier} (${subscription.status})`
        )
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = await resolveUserId(subscription) // throws on DB error → caught by outer try/catch → 500

        if (!userId) {
          console.warn('subscription.deleted: user not found for subscription', subscription.id)
          break // User genuinely doesn't exist — acknowledge to Stripe (no retry)
        }

        await upsertEntitlement(
          {
            userId,
            tier: 'free',
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            planId: undefined,
            expiresAt: undefined,
          },
          eventTime
        )

        console.log(`customer.subscription.deleted: user ${userId} → free`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string | null

        if (!subscriptionId) break

        // Fetch subscription to get status and user ID
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = await resolveUserId(subscription) // throws on DB error → 500
        if (!userId) {
          console.warn('invoice.payment_failed: user not found for subscription', subscriptionId)
          break
        }

        const tier = mapSubscriptionToTier(subscription.status)

        await upsertEntitlement(
          {
            userId,
            tier,
            stripeCustomerId: invoice.customer as string,
            stripeSubscriptionId: subscriptionId,
            planId: subscription.items.data[0]?.price.id,
            expiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
          },
          eventTime
        )

        console.log(
          `invoice.payment_failed: user ${userId} → ${tier} (sub status: ${subscription.status})`
        )
        break
      }

      default:
        // Stripe recommends acknowledging all events to prevent retries
        console.log(`Unhandled event type: ${event.type}`)
    }

    // 3. Always return 200 to Stripe (prevents retries for handled events)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // silent-catch-ok: error logged server-side
    console.error('Webhook handler error:', err)
    // Return 500 so Stripe retries
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
