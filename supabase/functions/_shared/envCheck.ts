/**
 * Fail-closed environment variable check for Edge Functions.
 *
 * In deployed environments (DENO_REGION is set and not "local", or
 * KNOWLUNE_DEPLOYED is "true"), throws if the required env var is missing.
 *
 * In local dev (DENO_REGION not set, DENO_REGION="local", or
 * KNOWLUNE_DEPLOYED not "true"), returns the value (possibly empty) for
 * development convenience. Callers still check the result and may behave
 * differently without the secret.
 *
 * Usage (at module scope, before Deno.serve):
 *   const MY_SECRET = requireWorkerEnv('MY_SECRET')
 *
 * KI-E119-POST-005: fail-closed on missing secrets in deployed environments.
 */

export function requireWorkerEnv(key: string): string {
  const value = Deno.env.get(key)

  const isDeployed =
    (Deno.env.get('DENO_REGION') && Deno.env.get('DENO_REGION') !== 'local') ||
    Deno.env.get('KNOWLUNE_DEPLOYED') === 'true'

  if (isDeployed && (!value || value.length === 0)) {
    const msg =
      `[ENV-FAIL-CLOSED] Required environment variable "${key}" is not set ` +
      `or empty. The function cannot operate safely without it. ` +
      `Set ${key} in the Supabase Edge Function environment and ensure it is ` +
      `included in WORKER_ENV_ALLOWLIST (main/index.ts).`
    console.error(msg)
    throw new Error(msg)
  }

  return value || ''
}
