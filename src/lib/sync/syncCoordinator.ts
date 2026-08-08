/**
 * Sync coordinator — the single application-level entry point for sync work.
 *
 * The engine remains responsible for moving rows to and from Supabase. This
 * coordinator owns when runs happen, status bookkeeping, and the bounded
 * first-upload progress state consumed by the upload wizard.
 */
import { db } from '@/db'
import { useSyncStatusStore } from '@/app/stores/useSyncStatusStore'
import { classifyError } from './classifyError'
import { syncEngine, type SyncRunResult } from './syncEngine'

export type SyncRequestReason =
  | 'auth'
  | 'initial-upload'
  | 'manual'
  | 'retry'
  | 'mutation'
  | 'periodic'
  | 'focus'
  | 'online'
  | 'reset'

export type InitialUploadPhase = 'idle' | 'original' | 'additional' | 'complete' | 'error'

export interface SyncFailureDetail {
  table: string
  recordId?: string
  message: string
  retryable: boolean
}

export interface InitialUploadProgress {
  phase: InitialUploadPhase
  processed: number
  total: number
  recentTable: string | null
  done: boolean
  error: Error | null
  additionalPendingCount: number
  failures: SyncFailureDetail[]
}

export interface SyncCoordinatorRequest {
  reason: SyncRequestReason
  /** Run the bounded initial-upload flow instead of an ordinary sync. */
  initialUpload?: boolean
  /** Optional user binding needed by the initial-link dialog. */
  userId?: string
  /** Rebuild dead-letter payloads from current Dexie rows before uploading. */
  rebuildFailed?: boolean
}

const EMPTY_PROGRESS: InitialUploadProgress = {
  phase: 'idle',
  processed: 0,
  total: 0,
  recentTable: null,
  done: false,
  error: null,
  additionalPendingCount: 0,
  failures: [],
}

const MAX_DRAIN_ATTEMPTS = 3
const RETRY_DELAY_MS = 150
const MUTATION_DEBOUNCE_MS = 200

let regularRun: Promise<SyncRunResult> | null = null
let initialUploadRun: Promise<SyncRunResult> | null = null
let mutationTimer: ReturnType<typeof setTimeout> | null = null
let initialUploadProgress: InitialUploadProgress = EMPTY_PROGRESS
const progressListeners = new Set<() => void>()

interface QueueSnapshot {
  ids: Set<number>
  total: number
}

interface SnapshotMeasurement {
  processed: number
  remaining: number
  recentTable: string | null
  failures: SyncFailureDetail[]
}

interface DrainSnapshotResult {
  result: SyncRunResult
  complete: boolean
}

function publishProgress(next: InitialUploadProgress): void {
  initialUploadProgress = next
  progressListeners.forEach(listener => listener())
}

function fallbackResult(): SyncRunResult {
  return {
    failedTables: [],
    deadLetterCount: 0,
    pendingCount: 0,
    tableFailures: [],
    assetFailures: [],
    completedAt: new Date().toISOString(),
    outcome: 'complete',
  }
}

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isFailure(result: SyncRunResult): boolean {
  return (
    result.failedTables.length > 0 || result.deadLetterCount > 0 || result.assetFailures.length > 0
  )
}

function resultMessage(result: SyncRunResult, failures: SyncFailureDetail[]): string {
  if (failures[0]?.message) return failures[0].message
  if (result.tableFailures[0]?.message) return result.tableFailures[0].message
  if (result.assetFailures[0]?.message) return result.assetFailures[0].message
  if (result.failedTables.length > 0) {
    return `Sync incomplete for ${result.failedTables.join(', ')}. Check the affected records and retry.`
  }
  if (result.deadLetterCount > 0) return `${result.deadLetterCount} change(s) need attention.`
  if (result.assetFailures.length > 0)
    return `${result.assetFailures.length} file upload(s) need attention.`
  if (result.pendingCount > 0)
    return `${result.pendingCount} change(s) are still waiting to upload.`
  return 'Sync failed'
}

async function queueFailures(): Promise<SyncFailureDetail[]> {
  const deadLetters = await db.syncQueue.where('status').equals('dead-letter').toArray()
  return deadLetters.map(entry => ({
    table: entry.failure?.table ?? entry.tableName,
    recordId: entry.failure?.recordId ?? entry.recordId,
    message: entry.failure?.message ?? entry.lastError ?? 'This change could not be uploaded.',
    retryable: entry.failure?.retryable ?? false,
  }))
}

function resultFailures(result: SyncRunResult): SyncFailureDetail[] {
  return [
    ...result.tableFailures.map(failure => ({
      table: failure.table,
      message: failure.message,
      retryable: true,
    })),
    ...result.assetFailures.map(failure => ({
      table: failure.table,
      recordId: failure.recordId,
      message: failure.message,
      retryable: failure.retryable,
    })),
  ]
}

async function collectFailures(result: SyncRunResult): Promise<SyncFailureDetail[]> {
  return [...(await queueFailures()), ...resultFailures(result)]
}

async function normalizeResult(result: SyncRunResult): Promise<SyncRunResult> {
  const [pendingCount, deadLetterCount] = await Promise.all([
    db.syncQueue.where('status').equals('pending').count(),
    db.syncQueue.where('status').equals('dead-letter').count(),
  ])
  const hasFailures =
    result.failedTables.length > 0 || deadLetterCount > 0 || result.assetFailures.length > 0
  return {
    ...result,
    pendingCount,
    deadLetterCount,
    outcome: hasFailures || pendingCount > 0 ? 'partial' : 'complete',
  }
}

async function applyResult(result: SyncRunResult, allowPending: boolean): Promise<SyncRunResult> {
  const normalized = await normalizeResult(result)
  const status = useSyncStatusStore.getState()
  const failures = await collectFailures(normalized)

  if (isFailure(normalized)) {
    status.setFailures?.(failures)
    status.setStatus('error', resultMessage(normalized, failures))
  } else if (normalized.pendingCount === 0) {
    status.markSyncComplete()
  } else if (!allowPending) {
    status.setStatus('error', resultMessage(normalized, failures))
  } else {
    // A bounded initial-upload batch may legitimately discover newer writes
    // after its snapshot. Keep the global state truthful while it drains them.
    status.setStatus('syncing')
  }

  await status.refreshPendingCount()
  return normalized
}

async function runEngineCycle(
  rebuildFailed: boolean,
  allowPending: boolean
): Promise<SyncRunResult> {
  const status = useSyncStatusStore.getState()
  status.setStatus('syncing')
  try {
    if (rebuildFailed) await syncEngine.retryFailed({ rebuildPayloads: true })
    const result = (await syncEngine.fullSync()) ?? fallbackResult()
    return await applyResult(result, allowPending)
  } catch (error) {
    const message = typeof error === 'string' ? error : classifyError(error)
    status.setStatus('error', message)
    await status.refreshPendingCount()
    throw error
  }
}

async function snapshotPending(exclude: ReadonlySet<number> = new Set()): Promise<QueueSnapshot> {
  const rows = await db.syncQueue.where('status').equals('pending').toArray()
  const ids = new Set(
    rows.map(row => row.id).filter((id): id is number => typeof id === 'number' && !exclude.has(id))
  )
  return { ids, total: ids.size }
}

async function measureSnapshot(snapshot: QueueSnapshot): Promise<SnapshotMeasurement> {
  const rows = await db.syncQueue.toArray()
  const byId = new Map(rows.map(row => [row.id, row]))
  let processed = 0
  let recentTable: string | null = null
  let latestUpdatedAt = ''
  const failures: SyncFailureDetail[] = []

  for (const id of snapshot.ids) {
    const row = byId.get(id)
    if (!row) {
      // The row was uploaded successfully or superseded by a newer queued
      // version. Either way, it is settled for this bounded snapshot; any
      // replacement is shown in the next (additional changes) phase.
      processed += 1
      continue
    }
    if (row.status === 'dead-letter') {
      failures.push({
        table: row.failure?.table ?? row.tableName,
        recordId: row.failure?.recordId ?? row.recordId,
        message: row.failure?.message ?? row.lastError ?? 'This change could not be uploaded.',
        retryable: row.failure?.retryable ?? false,
      })
      continue
    }
    if (row.updatedAt >= latestUpdatedAt) {
      latestUpdatedAt = row.updatedAt
      recentTable = row.tableName
    }
  }

  return {
    processed,
    remaining: snapshot.total - processed - failures.length,
    recentTable,
    failures,
  }
}

function progressFor(
  phase: Extract<InitialUploadPhase, 'original' | 'additional'>,
  snapshot: QueueSnapshot,
  measurement: SnapshotMeasurement,
  additionalPendingCount: number
): InitialUploadProgress {
  return {
    phase,
    processed: measurement.processed,
    total: snapshot.total,
    recentTable: measurement.recentTable,
    done: false,
    error: null,
    additionalPendingCount,
    failures: measurement.failures,
  }
}

function failInitialUpload(message: string, failures: SyncFailureDetail[] = []): void {
  publishProgress({
    ...initialUploadProgress,
    phase: 'error',
    done: false,
    error: new Error(message),
    failures,
  })
}

async function drainSnapshot(
  phase: Extract<InitialUploadPhase, 'original' | 'additional'>,
  snapshot: QueueSnapshot,
  rebuildFailed: boolean
): Promise<DrainSnapshotResult> {
  let lastResult: SyncRunResult | null = null
  for (let attempt = 0; attempt < MAX_DRAIN_ATTEMPTS; attempt += 1) {
    lastResult = await runEngineCycle(rebuildFailed && attempt === 0, true)
    const measurement = await measureSnapshot(snapshot)
    const additionalPendingCount = (await snapshotPending(snapshot.ids)).total
    publishProgress(progressFor(phase, snapshot, measurement, additionalPendingCount))

    if (measurement.failures.length > 0 || isFailure(lastResult)) {
      const failures =
        measurement.failures.length > 0 ? measurement.failures : await collectFailures(lastResult)
      failInitialUpload(resultMessage(lastResult, failures), failures)
      return { result: lastResult, complete: false }
    }
    if (measurement.remaining === 0) return { result: lastResult, complete: true }
    await pause(RETRY_DELAY_MS)
  }

  const measurement = await measureSnapshot(snapshot)
  const message = `${measurement.remaining} change(s) are still waiting to upload. Retry to continue.`
  useSyncStatusStore.getState().setStatus('error', message)
  failInitialUpload(message, measurement.failures)
  return { result: lastResult ?? fallbackResult(), complete: false }
}

async function runInitialUpload(rebuildFailed: boolean): Promise<SyncRunResult> {
  const seenIds = new Set<number>()
  let snapshot = await snapshotPending(seenIds)
  let phase: Extract<InitialUploadPhase, 'original' | 'additional'> = 'original'
  let lastResult: SyncRunResult | null = null

  if (snapshot.total === 0) {
    lastResult = await runEngineCycle(rebuildFailed, true)
    if (isFailure(lastResult)) {
      const failures = await collectFailures(lastResult)
      failInitialUpload(resultMessage(lastResult, failures), failures)
      return lastResult
    }
    // A write can arrive between taking an empty snapshot and completing this
    // first engine cycle. Treat it as a separate follow-up batch rather than
    // reporting a contradictory successful zero-item upload.
    snapshot = await snapshotPending(seenIds)
    if (snapshot.total === 0) {
      publishProgress({ ...EMPTY_PROGRESS, phase: 'complete', done: true })
      return lastResult
    }
    phase = 'additional'
  }

  while (snapshot.total > 0) {
    snapshot.ids.forEach(id => seenIds.add(id))
    publishProgress({
      phase,
      processed: 0,
      total: snapshot.total,
      recentTable: null,
      done: false,
      error: null,
      additionalPendingCount: phase === 'original' ? 0 : snapshot.total,
      failures: [],
    })

    const drained = await drainSnapshot(phase, snapshot, rebuildFailed && phase === 'original')
    lastResult = drained.result
    if (!drained.complete) return lastResult

    snapshot = await snapshotPending(seenIds)
    if (snapshot.total === 0) break
    phase = 'additional'
  }

  // Each drain cycle is already a full upload + download. Once no newer queue
  // rows remain outside the snapshots above, a further engine run would only
  // introduce a race where new writes bypass the explicit additional phase.
  const finalResult = lastResult ?? fallbackResult()

  publishProgress({
    ...initialUploadProgress,
    phase: 'complete',
    processed: initialUploadProgress.total,
    done: true,
    additionalPendingCount: 0,
    error: null,
    failures: [],
  })
  return finalResult
}

async function runRegular(request: SyncCoordinatorRequest): Promise<SyncRunResult> {
  let result: SyncRunResult | null = null
  for (let attempt = 0; attempt < MAX_DRAIN_ATTEMPTS; attempt += 1) {
    result = await runEngineCycle(Boolean(request.rebuildFailed) && attempt === 0, true)
    if (isFailure(result) || result.pendingCount === 0) return result
    await pause(RETRY_DELAY_MS)
  }

  const message = `${result?.pendingCount ?? 0} change(s) are still waiting to upload. Retry to continue.`
  useSyncStatusStore.getState().setStatus('error', message)
  return result ?? fallbackResult()
}

export const syncCoordinator = {
  get isInitialUploadActive(): boolean {
    return initialUploadRun !== null
  },

  getInitialUploadProgress(): InitialUploadProgress {
    return initialUploadProgress
  },

  subscribeInitialUpload(listener: () => void): () => void {
    progressListeners.add(listener)
    return () => progressListeners.delete(listener)
  },

  /** Request one serialized full upload + download run. */
  request(request: SyncCoordinatorRequest): Promise<SyncRunResult> {
    if (request.initialUpload) {
      return this.startInitialUpload({
        rebuildFailed: request.rebuildFailed,
        userId: request.userId,
      })
    }
    if (initialUploadRun) return initialUploadRun
    if (regularRun) return regularRun
    regularRun = runRegular(request).finally(() => {
      regularRun = null
    })
    return regularRun
  },

  /** Start the bounded first-upload flow used by the account-link dialog. */
  startInitialUpload(
    options: { rebuildFailed?: boolean; userId?: string } = {}
  ): Promise<SyncRunResult> {
    if (initialUploadRun) return initialUploadRun
    if (options.userId) syncEngine.setUser(options.userId)
    initialUploadRun = (async () => {
      // Do not take the wizard snapshot while a previous normal run still owns
      // the queue. Its result is awaited, then this run captures a stable batch.
      if (regularRun) await regularRun
      return runInitialUpload(Boolean(options.rebuildFailed))
    })().finally(() => {
      initialUploadRun = null
      // Notify deferred background work that the bounded initial run is idle.
      publishProgress(initialUploadProgress)
    })
    return initialUploadRun
  },

  /** Rebuild failed payloads, then run a coordinated retry. */
  retryFailed(): Promise<SyncRunResult> {
    if (initialUploadRun) return initialUploadRun
    return this.request({ reason: 'retry', rebuildFailed: true })
  },

  /** Debounced mutation entry point used by syncable local writes. */
  nudge(): void {
    if (mutationTimer !== null) clearTimeout(mutationTimer)
    mutationTimer = setTimeout(() => {
      mutationTimer = null
      void this.request({ reason: 'mutation' }).catch(error => {
        console.error('[syncCoordinator] Mutation sync failed:', error)
      })
    }, MUTATION_DEBOUNCE_MS)
  },

  start(userId: string): Promise<SyncRunResult> {
    syncEngine.setUser(userId)
    return this.request({ reason: 'auth' })
  },

  stop(): void {
    if (mutationTimer !== null) {
      clearTimeout(mutationTimer)
      mutationTimer = null
    }
    syncEngine.stop()
    publishProgress(EMPTY_PROGRESS)
  },
}

/** Test-only reset for singleton coordinator state. */
export function __resetSyncCoordinatorForTests(): void {
  if (mutationTimer !== null) clearTimeout(mutationTimer)
  mutationTimer = null
  regularRun = null
  initialUploadRun = null
  publishProgress(EMPTY_PROGRESS)
}
