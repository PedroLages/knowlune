// E19-S02: Stripe Webhook Handler
// Handles: POST /functions/v1/stripe-webhook
// Auth: Stripe signature verification (no JWT — Stripe calls this directly)
// Events: checkout.session.completed, customer.subscription.updated,
//         customer.subscription.deleted, invoice.payment_failed

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
})

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

// Service-role client for DB writes (bypasses RLS)
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

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
async function upsertEntitlement(params: {
  userId: string
  tier: 'free' | 'trial' | 'premium'
  stripeCustomerId: string
  stripeSubscriptionId?: string
  planId?: string
  expiresAt?: string
}) {
  const { error } = await supabaseAdmin
    .from('entitlements')
    .upsert(
      {
        user_id: params.userId,
        tier: params.tier,
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId ?? null,
        plan_id: params.planId ?? null,
        expires_at: params.expiresAt ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (error) {
    console.error('Entitlement upsert failed:', error)
    throw new Error(`Failed to update entitlement: ${error.message}`)
  }
}

Deno.serve(async (req: Request) => {
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
      console.error('Webhook signature verification failed:', err)
      return new Response('Invalid signature', { status: 400 })
    }

    // 2. Handle events (idempotent — duplicate events are no-ops via upsert)
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id ?? session.metadata?.supabase_user_id
        if (!userId) {
          console.error('checkout.session.completed: missing user ID', session.id)
          break
        }

        // Retrieve the subscription and copy user ID into its metadata
        // so that future subscription lifecycle events can identify the user
        let subscription: Stripe.Subscription | null = null
        if (session.subscription) {
          subscription = await stripe.subscriptions.update(session.subscription as string, {
            metadata: { supabase_user_id: userId },
          })
        }

        await upsertEntitlement({
          userId,
          tier: 'premium',
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription?.id,
          planId: subscription?.items.data[0]?.price.id,
          expiresAt: subscription?.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : undefined,
        })

        console.log(`checkout.session.completed: user ${userId} upgraded to premium`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          console.warn('customer.subscription.updated: missing supabase_user_id metadata')
          break
        }

        const tier = mapSubscriptionToTier(subscription.status)

        await upsertEntitlement({
          userId,
          tier,
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          planId: subscription.items.data[0]?.price.id,
          expiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
        })

        console.log(`customer.subscription.updated: user ${userId} → ${tier} (${subscription.status})`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (!userId) {
          console.warn('customer.subscription.deleted: missing supabase_user_id metadata')
          break
        }

        await upsertEntitlement({
          userId,
          tier: 'free',
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          planId: undefined,
          expiresAt: undefined,
        })

        console.log(`customer.subscription.deleted: user ${userId} → free`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string | null

        if (!subscriptionId) break

        // Fetch subscription to get status and user ID
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const userId = subscription.metadata?.supabase_user_id
        if (!userId) break

        const tier = mapSubscriptionToTier(subscription.status)

        await upsertEntitlement({
          userId,
          tier,
          stripeCustomerId: invoice.customer as string,
          stripeSubscriptionId: subscriptionId,
          planId: subscription.items.data[0]?.price.id,
          expiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
        })

        console.log(`invoice.payment_failed: user ${userId} → ${tier} (sub status: ${subscription.status})`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // 3. Always return 200 to Stripe (prevents retries for handled events)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook handler error:', err)
    // Return 500 so Stripe retries
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
