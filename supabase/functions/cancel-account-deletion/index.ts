// E119-S03: Cancel Account Deletion Edge Function
// Handles: POST /functions/v1/cancel-account-deletion
// Auth: requires Supabase JWT
//
// Reverses the soft-delete initiated by delete-account during the 7-day
// grace period. Clears pending_deletion_at from user metadata and
// reactivates the user account.
//
// Idempotent: if the user has no pending_deletion_at (already cancelled
// or never initiated), returns success without error.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Env var validation — fail fast if misconfigured
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required')

// Service-role admin client — used for auth.admin.* calls (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// CORS: match delete-account pattern
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Authenticate the request using the caller's JWT. Returns userId or an error Response. */
async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()

  if (error || !user) {
    return json({ success: false, error: 'Unauthorized' }, 401)
  }

  return { userId: user.id }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS })
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    const authResult = await authenticate(req)
    if (authResult instanceof Response) return authResult
    const { userId } = authResult

    // Step 1: Clear pending_deletion_at from user metadata.
    // This prevents retention-tick from hard-deleting the user after the grace period.
    // Idempotent: if already null, the update is a no-op.
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { pending_deletion_at: null },
    })

    if (metaError) {
      console.error('[cancel-account-deletion] failed to clear pending_deletion_at:', {
        message: metaError.message,
        status: metaError.status,
      })
      return json(
        { success: false, error: 'Failed to cancel deletion. Please try again.' },
        500
      )
    }

    // Step 2: Reactivate the user account.
    // Supabase soft-delete sets deleted_at; ban_duration: 'none' reactivates
    // the user so they can log in again during the grace period.
    // Note: on self-hosted Supabase, this clears the effective ban without
    // requiring direct DB access.
    const { error: reactivateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    })

    if (reactivateError) {
      // Log but don't fail — the metadata is already cleared; the user may
      // need to contact support if they cannot log in.
      console.warn('[cancel-account-deletion] reactivation warning:', {
        message: reactivateError.message,
        status: reactivateError.status,
      })
    }

    return json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cancel-account-deletion] unexpected error:', message)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
})
