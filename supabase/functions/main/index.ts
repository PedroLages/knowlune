// Supabase self-hosted Edge Runtime main service router.
// Routes /functions/v1/<function-name> requests to the corresponding
// function module in /home/deno/functions/<function-name>/index.ts
//
// No external imports — uses Deno built-in crypto for JWT verification
// so the main service boots without DNS/network access.

const JWT_SECRET = Deno.env.get('JWT_SECRET')
const VERIFY_JWT = Deno.env.get('VERIFY_JWT') === 'true'

// Worker resource limits — keep in sync with Supabase defaults.
const WORKER_MEMORY_LIMIT_MB = 150
const WORKER_TIMEOUT_MS = 60 * 1000
const WORKER_CREATE_TIMEOUT_MS = 10 * 1000

// Environment variables safe to forward to worker functions.
// Each worker is a separate Deno process but shares the parent env by default.
// Forwarding everything would leak unrelated secrets (e.g., Kong admin creds)
// into every function. Allowlist only what user functions need.
const WORKER_ENV_ALLOWLIST = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'APP_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID',
  'VAULT_ENC_KEY',
  'DENO_REGION',
  'VERIFY_JWT',
  'RETENTION_TICK_SECRET',
]

console.log('main function started')

function errorResponse(msg: string, status: number): Response {
  // Use `error` field so downstream clients can rely on a single failure shape.
  // Older callers that still check `msg` receive the same payload under both keys.
  return new Response(JSON.stringify({ success: false, error: msg, msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function verifyJWT(token: string): Promise<boolean> {
  if (!JWT_SECRET) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false

    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const data = encoder.encode(`${parts[0]}.${parts[1]}`)
    const sig = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    )
    const sigValid = await crypto.subtle.verify('HMAC', key, sig, data)
    if (!sigValid) return false

    // exp / nbf validation — previous implementation only checked the signature.
    const payloadJson = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        )
      )
    ) as { exp?: number; nbf?: number }
    const now = Math.floor(Date.now() / 1000)
    if (typeof payloadJson.exp === 'number' && payloadJson.exp < now) return false
    if (typeof payloadJson.nbf === 'number' && payloadJson.nbf > now) return false

    return true
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const { pathname } = url
  const pathParts = pathname.split('/')
  const serviceName = pathParts[1]

  if (!serviceName || serviceName === '') {
    return errorResponse('missing function name in request', 400)
  }

  if (VERIFY_JWT) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse('Missing authorization header', 401)
    }
    const token = authHeader.slice(7)
    const valid = await verifyJWT(token)
    if (!valid) {
      return errorResponse('Invalid JWT', 401)
    }
  }

  const servicePath = `/home/deno/functions/${serviceName}`

  // Forward only allowlisted env vars to worker processes.
  const envVars: Array<[string, string]> = []
  for (const key of WORKER_ENV_ALLOWLIST) {
    const value = Deno.env.get(key)
    if (value !== undefined) envVars.push([key, value])
  }

  try {
    // Bound worker creation so a slow module graph doesn't hang the router.
    const workerCreate = // @ts-expect-error — EdgeRuntime global injected by supabase/edge-runtime
      EdgeRuntime.userWorkers.create({
        servicePath,
        memoryLimitMb: WORKER_MEMORY_LIMIT_MB,
        workerTimeoutMs: WORKER_TIMEOUT_MS,
        noModuleCache: false,
        importMapPath: null,
        envVars,
      }) as Promise<{ fetch: (req: Request) => Promise<Response> }>

    const worker = await Promise.race([
      workerCreate,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`worker create timed out after ${WORKER_CREATE_TIMEOUT_MS}ms`)),
          WORKER_CREATE_TIMEOUT_MS
        )
      ),
    ])

    return await worker.fetch(req)
  } catch (e) {
    // Log for operator visibility — message only, no stack with potential secrets.
    const message = e instanceof Error ? e.message : String(e)
    console.error(`worker dispatch failed for ${serviceName}:`, message)
    return errorResponse(message, 500)
  }
})
