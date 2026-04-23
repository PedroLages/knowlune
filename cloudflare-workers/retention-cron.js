/**
 * Cloudflare Worker: retention-cron
 *
 * A minimal scheduled Worker that fires daily at 03:00 UTC (configured in
 * wrangler.toml) and calls the Supabase Edge Function `retention-tick` with
 * the shared secret header.
 *
 * Environment (set as Cloudflare Worker secrets):
 *   SUPABASE_FUNCTIONS_URL  — Base URL, e.g. https://<project>.supabase.co/functions/v1
 *   RETENTION_TICK_SECRET   — Shared secret matching the Edge Function env var
 *
 * See docs/deployment/retention-cron-setup.md for full operational runbook.
 */

export default {
  /**
   * Scheduled handler — invoked by Cloudflare cron (wrangler.toml [triggers]).
   * @param {ScheduledEvent} _event
   * @param {object} env — Worker environment bindings (secrets + vars)
   * @param {ExecutionContext} ctx
   */
  async scheduled(_event, env, ctx) {
    const url = `${env.SUPABASE_FUNCTIONS_URL}/retention-tick`

    ctx.waitUntil(
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-retention-secret': env.RETENTION_TICK_SECRET,
        },
        body: JSON.stringify({}),
      })
        .then(async (res) => {
          const body = await res.text()
          if (res.ok || res.status === 207) {
            console.log(`[retention-cron] retention-tick responded ${res.status}: ${body}`)
          } else {
            console.error(`[retention-cron] retention-tick failed with ${res.status}: ${body}`)
          }
        })
        .catch((err) => {
          console.error(`[retention-cron] fetch to retention-tick threw: ${err.message}`)
        })
    )
  },

  /**
   * HTTP handler — returns 200 for health checks.
   * The cron Worker does not serve user traffic; this exists for
   * `wrangler dev` testing and manual invocation verification.
   */
  async fetch(_request, _env, _ctx) {
    return new Response(
      JSON.stringify({ status: 'ok', worker: 'retention-cron' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  },
}
