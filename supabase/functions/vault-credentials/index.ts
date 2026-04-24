// E95-S02: Vault Credentials Edge Function
// Handles: POST/GET/DELETE /functions/v1/vault-credentials
// Auth: requires Supabase JWT
//
// Routes:
//   POST   /vault/store-credential   — store or update a secret in Vault
//   GET    /vault/check-credential   — check if a secret exists (no plaintext returned)
//   GET    /vault/read-credential    — read a secret (plaintext — only at point-of-API-call)
//   DELETE /vault/delete-credential  — delete a secret from Vault
//
// Key naming: `{userId}:{credentialType}:{credentialId}`
// Credential types: ai-provider | opds-catalog | abs-server
//
// Raw secrets never appear in Postgres public tables, the Dexie sync queue,
// or browser localStorage. The Edge Function bridges the auth boundary:
// clients send their JWT, the function uses service-role to access vault.secrets.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Env var validation — fail fast if misconfigured
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

// Service-role client for Vault access (bypasses RLS — intentional)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

const VALID_CREDENTIAL_TYPES = ['ai-provider', 'opds-catalog', 'abs-server'] as const
type CredentialType = (typeof VALID_CREDENTIAL_TYPES)[number]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Build the vault secret name (user-scoped, no additional RLS required) */
function buildKey(userId: string, credentialType: CredentialType, credentialId: string): string {
  return `${userId}:${credentialType}:${credentialId}`
}

/** Authenticate the request — returns userId or an error Response */
async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Missing or malformed Authorization header' }, 401)
  }
  const token = authHeader.slice(7)
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    return json({ error: 'Invalid or expired token' }, 401)
  }
  return { userId: user.id }
}

/** Parse and validate credentialType from body or URL params */
function parseCredentialType(value: string | null): CredentialType | null {
  if (VALID_CREDENTIAL_TYPES.includes(value as CredentialType)) {
    return value as CredentialType
  }
  return null
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** POST /vault/store-credential */
async function storeCredential(
  userId: string,
  credentialType: CredentialType,
  credentialId: string,
  secret: string
): Promise<Response> {
  const name = buildKey(userId, credentialType, credentialId)
  const description = `E95-S02: ${credentialType} credential for user ${userId}`

  // Check if a secret with this name already exists
  const { data: existing, error: selectError } = await supabaseAdmin
    .from('vault.secrets')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (selectError) {
    console.error('[vault-credentials] store: select error:', selectError)
    return json({ error: 'Failed to check existing credential' }, 500)
  }

  if (existing?.id) {
    // Update existing secret
    const { error: updateError } = await supabaseAdmin.rpc('vault_update_secret', {
      secret: secret,
      id: existing.id,
    })
    if (updateError) {
      // Fallback: try raw SQL via rpc — vault.update_secret signature
      const { error: fallbackError } = await supabaseAdmin.rpc('vault_update_secret_by_id', {
        p_id: existing.id,
        p_secret: secret,
      })
      if (fallbackError) {
        console.error('[vault-credentials] store: update error:', updateError, fallbackError)
        return json({ error: 'Failed to update credential' }, 500)
      }
    }
  } else {
    // Create new secret
    const { error: createError } = await supabaseAdmin.rpc('vault_create_secret', {
      secret: secret,
      name: name,
      description: description,
    })
    if (createError) {
      console.error('[vault-credentials] store: create error:', createError)
      return json({ error: 'Failed to store credential' }, 500)
    }
  }

  return json({ configured: true })
}

/** GET /vault/check-credential */
async function checkCredential(
  userId: string,
  credentialType: CredentialType,
  credentialId: string
): Promise<Response> {
  const name = buildKey(userId, credentialType, credentialId)

  const { data, error } = await supabaseAdmin
    .from('vault.secrets')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (error) {
    console.error('[vault-credentials] check: error:', error)
    return json({ configured: false })
  }

  return json({ configured: !!data })
}

/** GET /vault/read-credential */
async function readCredential(
  userId: string,
  credentialType: CredentialType,
  credentialId: string
): Promise<Response> {
  const name = buildKey(userId, credentialType, credentialId)

  const { data, error } = await supabaseAdmin
    .from('vault.decrypted_secrets')
    .select('decrypted_secret')
    .eq('name', name)
    .maybeSingle()

  if (error) {
    console.error('[vault-credentials] read: error:', error)
    return json({ error: 'Failed to read credential' }, 500)
  }

  if (!data) {
    return json({ error: 'Credential not found' }, 404)
  }

  return json({ secret: data.decrypted_secret })
}

/** DELETE /vault/delete-credential */
async function deleteCredential(
  userId: string,
  credentialType: CredentialType,
  credentialId: string
): Promise<Response> {
  const name = buildKey(userId, credentialType, credentialId)

  const { error } = await supabaseAdmin.from('vault.secrets').delete().eq('name', name)

  if (error) {
    console.error('[vault-credentials] delete: error:', error)
    return json({ error: 'Failed to delete credential' }, 500)
  }

  return json({ deleted: true })
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS })
  }

  // Authenticate all requests
  const authResult = await authenticate(req)
  if (authResult instanceof Response) return authResult
  const { userId } = authResult

  const url = new URL(req.url)
  const pathname = url.pathname

  // Route: POST /vault/store-credential
  if (req.method === 'POST' && pathname.endsWith('/store-credential')) {
    let body: Record<string, string>
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const credentialType = parseCredentialType(body.credentialType)
    if (!credentialType) {
      return json(
        { error: `credentialType must be one of: ${VALID_CREDENTIAL_TYPES.join(', ')}` },
        400
      )
    }

    const credentialId = body.credentialId
    const secret = body.secret
    if (!credentialId || !secret) {
      return json({ error: 'credentialId and secret are required' }, 400)
    }

    return storeCredential(userId, credentialType, credentialId, secret)
  }

  // Route: GET /vault/check-credential
  if (req.method === 'GET' && pathname.endsWith('/check-credential')) {
    const credentialType = parseCredentialType(url.searchParams.get('credentialType'))
    if (!credentialType) {
      return json(
        { error: `credentialType must be one of: ${VALID_CREDENTIAL_TYPES.join(', ')}` },
        400
      )
    }
    const credentialId = url.searchParams.get('credentialId')
    if (!credentialId) {
      return json({ error: 'credentialId is required' }, 400)
    }
    return checkCredential(userId, credentialType, credentialId)
  }

  // Route: GET /vault/read-credential
  if (req.method === 'GET' && pathname.endsWith('/read-credential')) {
    const credentialType = parseCredentialType(url.searchParams.get('credentialType'))
    if (!credentialType) {
      return json(
        { error: `credentialType must be one of: ${VALID_CREDENTIAL_TYPES.join(', ')}` },
        400
      )
    }
    const credentialId = url.searchParams.get('credentialId')
    if (!credentialId) {
      return json({ error: 'credentialId is required' }, 400)
    }
    return readCredential(userId, credentialType, credentialId)
  }

  // Route: DELETE /vault/delete-credential
  if (req.method === 'DELETE' && pathname.endsWith('/delete-credential')) {
    const credentialType = parseCredentialType(url.searchParams.get('credentialType'))
    if (!credentialType) {
      return json(
        { error: `credentialType must be one of: ${VALID_CREDENTIAL_TYPES.join(', ')}` },
        400
      )
    }
    const credentialId = url.searchParams.get('credentialId')
    if (!credentialId) {
      return json({ error: 'credentialId is required' }, 400)
    }
    return deleteCredential(userId, credentialType, credentialId)
  }

  return json({ error: 'Not found' }, 404)
})
