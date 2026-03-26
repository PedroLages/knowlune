// E19-S02: Create Stripe Checkout Session
// Handles: POST /functions/v1/create-checkout
// Auth: requires Supabase JWT
// Returns: { url: string } for client redirect to Stripe Checkout

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Method guard — only POST allowed
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  // Env var validation — fail fast if misconfigured
  const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
  const STRIPE_PRICE_ID = Deno.env.get('STRIPE_PRICE_ID')
  if (!STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is required')
  if (!STRIPE_PRICE_ID) throw new Error('STRIPE_PRICE_ID is required')

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
  })

  try {
    // 1. Verify Supabase JWT and extract user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
    if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required')

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parse origin from request for redirect URLs
    // silent-catch-ok — server-side edge function, no toast available
    // eslint-disable-next-line error-handling/no-silent-catch -- server-side error handling
    const body = await req.json().catch(() => {
      console.warn('create-checkout: malformed request body')
      return {}
    })
    const origin = body.origin || Deno.env.get('APP_URL') || 'http://localhost:5173'

    // Origin validation — prevent open redirect
    // Note: APP_URL must exactly match the deployed domain (no trailing slash, no www prefix)
    const ALLOWED_ORIGINS = [Deno.env.get('APP_URL'), 'http://localhost:5173'].filter(Boolean)
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return new Response(JSON.stringify({ error: 'Invalid origin' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Check for existing premium subscription (duplicate guard)
    const { data: existingEnt } = await supabaseClient
      .from('entitlements')
      .select('tier')
      .eq('user_id', user.id)
      .single()
    if (existingEnt?.tier === 'premium') {
      return new Response(JSON.stringify({ error: 'Already subscribed to premium' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Look up or create Stripe customer by metadata (not email)
    // user.email can be null for phone-auth or SSO
    const customers = await stripe.customers.search({
      query: `metadata["supabase_user_id"]:"${user.id}"`,
    })
    let customerId = customers.data[0]?.id
    if (!customerId) {
      const newCustomer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = newCustomer.id
    }

    // 5. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/settings?checkout=cancel`,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
    })

    // 6. Return checkout URL
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    // silent-catch-ok — server-side edge function, returns error response
    console.error('create-checkout error:', err)
    return new Response(JSON.stringify({ error: 'Unable to start checkout. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
