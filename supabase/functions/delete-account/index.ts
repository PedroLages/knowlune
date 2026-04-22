// E19-S09 / B4: Delete Account Edge Function
// Handles: POST /functions/v1/delete-account
// Auth: requires Supabase JWT
// Action: soft-deletes the calling user's auth record (sets deleted_at, 7-day grace period)
// No Stripe calls — keys not configured for production yet.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Env var validation — fail fast if misconfigured
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

// Service-role admin client — used for auth.admin.deleteUser (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Grace period in days — must match SOFT_DELETE_GRACE_DAYS in frontend */
const SOFT_DELETE_GRACE_DAYS = 7

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

  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
  if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required')

  // Verify JWT using the anon client (user-scoped — validates the token)
  const userClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY, {
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

    // Soft-delete: sets deleted_at on the auth.users row, does not hard-delete.
    // shouldSoftDelete=true is the Supabase Admin API flag for soft-delete.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId, true)

    if (deleteError) {
      console.error('[delete-account] admin.deleteUser error:', deleteError)

      // Idempotent: if user already has deleted_at set, the admin API returns a 422.
      // Treat this as a success — the deletion is already scheduled.
      if (
        deleteError.message?.includes('already been deleted') ||
        deleteError.status === 422
      ) {
        const scheduledDeletionAt = new Date(
          Date.now() + SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000
        ).toISOString()
        return json({ success: true, scheduledDeletionAt, alreadyScheduled: true })
      }

      return json({ success: false, error: 'Failed to delete account. Please try again.' }, 500)
    }

    const scheduledDeletionAt = new Date(
      Date.now() + SOFT_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    return json({ success: true, scheduledDeletionAt })
  } catch (err) {
    console.error('[delete-account] unexpected error:', err)
    return json({ success: false, error: 'Internal server error' }, 500)
  }
})
