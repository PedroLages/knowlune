/**
 * Credential status aggregator — E97-S05
 *
 * Pure async function that classifies every credential the user has configured
 * and returns the banner-eligible "missing" list plus a per-id status map for
 * badge rendering (AC1, AC3, AC4).
 *
 * Design decisions:
 * - Non-throwing: errors from checkCredential are caught and classified as `missing` defensively.
 * - Parallel: uses Promise.allSettled (ES2020 — not Promise.any) to fan-out checks.
 * - No caching: the aggregator is always fresh; credentialCache in cache.ts is for
 *   positive credential reads only (different lifecycle concern).
 * - Ollama is excluded: serverUrl is not a Vault credential.
 * - AI banner entry is USER-LEVEL: at most one synthetic entry ({ id: '__ai-section__' })
 *   is added when all AI providers are local-only (Vault empty + providerKeys non-empty).
 *   Per-provider statusByKey entries continue to render per-row badges (AC3) independently.
 *
 * @module credentialStatus
 * @since E97-S05
 */

import type { OpdsCatalog, AudiobookshelfServer } from '@/data/types'
import type { AIConfigurationSettings } from '@/lib/aiConfiguration'
import { getConfiguredProviderIds } from '@/lib/aiConfiguration'
import { checkCredential } from '@/lib/vaultCredentials'

/** Four possible states for a credential. */
export type CredentialStatus = 'vault' | 'local' | 'missing' | 'anonymous'

/** A single missing credential entry suitable for banner rendering. */
export interface MissingCredential {
  kind: 'ai-provider' | 'opds-catalog' | 'abs-server'
  id: string
  displayName: string
  status: CredentialStatus
  /** True if the missing status is due to a transient network error, not a permanent absence. */
  transient?: boolean
}

/** Aggregated result returned by aggregateCredentialStatus(). */
export interface CredentialStatusResult {
  /** Credentials that need user attention — rendered as banner rows. */
  missing: MissingCredential[]
  /**
   * Per-credential status map used by badge components.
   * Key format: "<kind>:<id>"  e.g. "ai-provider:openai", "opds-catalog:abc123"
   */
  statusByKey: Record<string, CredentialStatus>
}

export interface AggregateInput {
  catalogs: OpdsCatalog[]
  servers: AudiobookshelfServer[]
  aiConfig: AIConfigurationSettings
}

/**
 * Classify all configured credentials and return the full status result.
 *
 * Runs checkCredential + getConfiguredProviderIds() in parallel via Promise.allSettled.
 * Never throws. On checkCredential failure a credential is classified missing with
 * transient:true so the banner errs on the side of "show me".
 */
export async function aggregateCredentialStatus(input: AggregateInput): Promise<CredentialStatusResult> {
  const { catalogs, servers, aiConfig } = input
  const missing: MissingCredential[] = []
  const statusByKey: Record<string, CredentialStatus> = {}

  // ─── AI providers ───────────────────────────────────────────────────────────
  // Per-provider badge checks (AC3) — run in parallel
  const AI_PROVIDER_IDS = Object.keys(aiConfig.providerKeys ?? {}) as string[]
  // Also include current provider and legacy provider
  const allAiCandidates = new Set<string>(AI_PROVIDER_IDS)
  if (aiConfig.provider && aiConfig.provider !== 'ollama') {
    allAiCandidates.add(aiConfig.provider)
  }
  // Legacy apiKeyEncrypted maps to the selectedProvider
  if (aiConfig.apiKeyEncrypted && aiConfig.provider && aiConfig.provider !== 'ollama') {
    allAiCandidates.add(aiConfig.provider)
  }

  // Check Vault in parallel for each non-Ollama candidate
  const aiVaultChecks = await Promise.allSettled(
    Array.from(allAiCandidates).map(async (providerId) => {
      const configured = await checkCredential('ai-provider', providerId)
      return { providerId, configured }
    })
  )

  const aiVaultById = new Map<string, boolean>()
  for (const result of aiVaultChecks) {
    if (result.status === 'fulfilled') {
      aiVaultById.set(result.value.providerId, result.value.configured)
    } else {
      // Network error — treat as missing for safety
      // We can't extract providerId from rejected promise here, but Promise.allSettled
      // preserves order, so we handle by index
    }
  }

  // Re-process with index to handle failures
  const aiCandidateArray = Array.from(allAiCandidates)
  for (let i = 0; i < aiCandidateArray.length; i++) {
    const providerId = aiCandidateArray[i]
    const result = aiVaultChecks[i]
    const key = `ai-provider:${providerId}`

    if (result.status === 'fulfilled') {
      const inVault = result.value.configured
      if (inVault) {
        statusByKey[key] = 'vault'
      } else {
        // Check local fallback
        const hasLocal =
          !!(aiConfig.providerKeys?.[providerId as keyof typeof aiConfig.providerKeys]) ||
          (providerId === aiConfig.provider && !!aiConfig.apiKeyEncrypted)
        statusByKey[key] = hasLocal ? 'local' : 'missing'
      }
    } else {
      // Network error — classify as missing (defensive)
      statusByKey[key] = 'missing'
    }
  }

  // User-level AI banner trigger (R1): one synthetic entry when Vault is empty
  // AND user has local-only AI keys (providerKeys non-empty or legacy apiKeyEncrypted).
  // Runs getConfiguredProviderIds() which already does the parallel Vault check.
  const configuredProviderIds = await getConfiguredProviderIds()
  // Filter out ollama — it's not a Vault credential
  const vaultConfiguredIds = configuredProviderIds.filter(id => id !== 'ollama')

  const hasLocalAiKeys =
    Object.values(aiConfig.providerKeys ?? {}).some(k => !!k) ||
    !!aiConfig.apiKeyEncrypted

  if (vaultConfiguredIds.length === 0 && hasLocalAiKeys) {
    missing.push({
      kind: 'ai-provider',
      id: '__ai-section__',
      displayName: 'AI provider keys',
      status: 'missing',
    })
  }

  // ─── OPDS catalogs ──────────────────────────────────────────────────────────
  const opdsChecks = await Promise.allSettled(
    catalogs.map(async (catalog) => {
      const isAnonymous = !catalog.auth?.username
      if (isAnonymous) {
        return { catalog, status: 'anonymous' as CredentialStatus, transient: false }
      }
      try {
        const configured = await checkCredential('opds-catalog', catalog.id)
        return {
          catalog,
          status: configured ? ('vault' as CredentialStatus) : ('missing' as CredentialStatus),
          transient: false,
        }
      } catch {
        return { catalog, status: 'missing' as CredentialStatus, transient: true }
      }
    })
  )

  for (const result of opdsChecks) {
    if (result.status === 'fulfilled') {
      const { catalog, status, transient } = result.value
      const key = `opds-catalog:${catalog.id}`
      statusByKey[key] = status
      if (status === 'missing') {
        missing.push({
          kind: 'opds-catalog',
          id: catalog.id,
          displayName: catalog.name,
          status: 'missing',
          ...(transient ? { transient: true } : {}),
        })
      }
    } else {
      // Promise.allSettled inner async shouldn't reach here (inner try/catch),
      // but guard defensively
    }
  }

  // ─── ABS servers ────────────────────────────────────────────────────────────
  const absChecks = await Promise.allSettled(
    servers.map(async (server) => {
      try {
        const configured = await checkCredential('abs-server', server.id)
        return {
          server,
          status: configured ? ('vault' as CredentialStatus) : ('missing' as CredentialStatus),
          transient: false,
        }
      } catch {
        return { server, status: 'missing' as CredentialStatus, transient: true }
      }
    })
  )

  for (const result of absChecks) {
    if (result.status === 'fulfilled') {
      const { server, status, transient } = result.value
      const key = `abs-server:${server.id}`
      statusByKey[key] = status
      if (status === 'missing') {
        missing.push({
          kind: 'abs-server',
          id: server.id,
          displayName: server.name,
          status: 'missing',
          ...(transient ? { transient: true } : {}),
        })
      }
    }
  }

  return { missing, statusByKey }
}
