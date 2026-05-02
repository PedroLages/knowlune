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
// The vault schema is not exposed via PostgREST. We call public-schema
// SECURITY DEFINER wrappers (migration: vault_credentials_public_wrappers).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_URL) throw new Error('SUPABASE_URL is required')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

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

function buildKey(userId: string, credentialType: CredentialType, credentialId: string): string {
  return `${userId}:${credentialType}:${credentialId}`
}

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

function parseCredentialType(value: string | null): CredentialType | null {
  if (VALID_CREDENTIAL_TYPES.includes(value as CredentialType)) {
    return value as CredentialType
  }
  return null
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async function storeCredential(
  userId: string,
  credentialType: CredentialType,
  credentialId: string,
  secret: string
): Promise<Response> {
  const name = buildKey(userId, credentialType, credentialId)
  const description = `E95-S02: ${credentialType} credential for user ${userId}`

  // Check if secret already exists
  const { data: existingId, error: lookupError } = await supabaseAdmin.rpc(
    'vault_get_secret_id_by_name',
    { p_name: name }
  )

  if (lookupError) {
    console.error('[vault-credentials] store: lookup error:', lookupError)
    return json({ error: 'Failed to check existing credential', details: lookupError.message }, 500)
  }

  if (existingId) {
    const { error: updateError } = await supabaseAdmin.rpc('vault_update_secret_by_name', {
      p_name: name,
      p_secret: secret,
    })
    if (updateError) {
      console.error('[vault-credentials] store: update error:', updateError)
      return json({ error: 'Failed to update credential', details: updateError.message }, 500)
    }
  } else {
    const { error: createError } = await supabaseAdmin.rpc('vault_create_secret', {
      p_secret: secret,
      p_name: name,
      p_description: description,
    })
    if (createError) {
      console.error('[vault-credentials] store: create error:', createError)
      return json({ error: 'Failed to store credential', details: createError.message }, 500)
    }
  }

  return json({ configured: true })
}

async function checkCredential(
  userId: string,
  credentialType: CredentialType,
  credentialId: string
): Promise<Response> {
  const name = buildKey(userId, credentialType, credentialId)

  const { data, error } = await supabaseAdmin.rpc('vault_get_secret_id_by_name', { p_name: name })

  if (error) {
    console.error('[vault-credentials] check: error:', error)
    return json({ configured: false })
  }

  return json({ configured: !!data })
}

async function readCredential(
  userId: string,
  credentialType: CredentialType,
  credentialId: string
): Promise<Response> {
  const name = buildKey(userId, credentialType, credentialId)

  const { data, error } = await supabaseAdmin.rpc('vault_read_secret_by_name', { p_name: name })

  if (error) {
    console.error('[vault-credentials] read: error:', error)
    return json({ error: 'Failed to read credential', details: error.message }, 500)
  }

  if (!data) {
    return json({ error: 'Credential not found' }, 404)
  }

  return json({ secret: data })
}

async function deleteCredential(
  userId: string,
  credentialType: CredentialType,
  credentialId: string
): Promise<Response> {
  const name = buildKey(userId, credentialType, credentialId)

  const { error } = await supabaseAdmin.rpc('vault_delete_secret_by_name', { p_name: name })

  if (error) {
    console.error('[vault-credentials] delete: error:', error)
    return json({ error: 'Failed to delete credential', details: error.message }, 500)
  }

  return json({ deleted: true })
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS })
  }

  const authResult = await authenticate(req)
  if (authResult instanceof Response) return authResult
  const { userId } = authResult

  const url = new URL(req.url)
  const pathname = url.pathname

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
