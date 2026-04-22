// Supabase self-hosted Edge Runtime main service router.
// Routes /functions/v1/<function-name> requests to the corresponding
// function module in /home/deno/functions/<function-name>/index.ts
//
// No external imports — uses Deno built-in crypto for JWT verification
// so the main service boots without DNS/network access.

const JWT_SECRET = Deno.env.get('JWT_SECRET')
const VERIFY_JWT = Deno.env.get('VERIFY_JWT') === 'true'

console.log('main function started')

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
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    return crypto.subtle.verify('HMAC', key, sig, data)
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const { pathname } = url
  const path_parts = pathname.split('/')
  const service_name = path_parts[1]

  if (!service_name || service_name === '') {
    return new Response(JSON.stringify({ msg: 'missing function name in request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (VERIFY_JWT) {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ msg: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.slice(7)
    const valid = await verifyJWT(token)
    if (!valid) {
      return new Response(JSON.stringify({ msg: 'Invalid JWT' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const servicePath = `/home/deno/functions/${service_name}`
  console.error(`serving the request with ${servicePath}`)

  const memoryLimitMb = 150
  const workerTimeoutMs = 1 * 60 * 1000
  const noModuleCache = false
  const importMapPath = null
  const envVarsObj = Deno.env.toObject()
  const envVars = Object.keys(envVarsObj).map((k) => [k, envVarsObj[k]])

  try {
    // @ts-ignore — EdgeRuntime global injected by supabase/edge-runtime
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb,
      workerTimeoutMs,
      noModuleCache,
      importMapPath,
      envVars,
    })
    return await worker.fetch(req)
  } catch (e) {
    const error = { msg: e.toString() }
    return new Response(JSON.stringify(error), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
