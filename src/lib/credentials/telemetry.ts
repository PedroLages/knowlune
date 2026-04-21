/**
 * Thin telemetry shim for E95-S05 credential events.
 *
 * Knowlune has no global analytics pipeline yet — this module emits events via
 * `console.info` with a stable `[telemetry]` prefix so Supabase Functions logs /
 * browser devtools filters can surface them. When a real analytics client is
 * introduced, this single file is the only swap-in point.
 *
 * Event names follow the `sync.*` namespace called out in E95-S05 AC-7.
 *
 * @module credentials/telemetry
 * @since E95-S05
 */

export type CredentialTelemetryEvent =
  | 'sync.credential.auth_failed'
  | 'sync.migration.credential_uploaded'
  | 'sync.migration.credential_upload_failed'
  | 'sync.server_config.hydrated'
  | 'sync.vault.potential_orphan'

export function emitTelemetry(
  event: CredentialTelemetryEvent,
  payload: Record<string, unknown> = {}
): void {
  // Intentional: using console.info so it shows in prod logs but is visually
  // distinct from warnings/errors. Swap to a real analytics client later.
  // eslint-disable-next-line no-console
  console.info(`[telemetry] ${event}`, payload)
}
