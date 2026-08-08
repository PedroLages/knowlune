import { db } from '@/db'
import { toast } from 'sonner'
import { syncableWrite, type SyncableRecord } from './syncableWrite'
import { tableRegistry } from './tableRegistry'
import { syncEngine } from './syncEngine'

/** Bump when the repair payload or its target set changes. */
export const ACCOUNT_REPAIR_VERSION = 2

const REPAIR_TABLES = [
  'importedCourses',
  'importedVideos',
  'importedPdfs',
  'authors',
  'courseServers',
  'progress',
  'contentProgress',
  'learningPaths',
  'learningPathEntries',
] as const

type RepairTable = (typeof REPAIR_TABLES)[number]

interface RepairResult {
  repaired: number
  failed: number
  skipped: boolean
}

interface RepairMarker {
  version: number
  status: 'prepared' | 'complete'
  preparedAt?: string
  completedAt?: string
}

/**
 * Requeue owned local records after sign-in. This repairs data written before
 * authentication, and stale queue payloads created before syncableWrite used
 * the stamped record. It is intentionally idempotent and parent-first.
 */
export async function repairAccountData(userId: string): Promise<RepairResult> {
  // Keep lightweight UI/unit-test database doubles compatible; real Dexie
  // instances always expose syncMetadata.
  if (!db.syncMetadata || typeof db.syncMetadata.get !== 'function') {
    return { repaired: 0, failed: 0, skipped: true }
  }
  const marker = `account-repair:${userId}`
  const prior = await db.syncMetadata.get(marker)
  const priorMarker = prior?.value as RepairMarker | number | undefined
  if (
    (typeof priorMarker === 'object' &&
      priorMarker.version === ACCOUNT_REPAIR_VERSION &&
      priorMarker.status === 'complete') ||
    priorMarker === ACCOUNT_REPAIR_VERSION
  ) {
    return { repaired: 0, failed: 0, skipped: true }
  }

  await db.syncMetadata.put({
    table: marker,
    value: {
      version: ACCOUNT_REPAIR_VERSION,
      status: 'prepared',
      preparedAt: new Date().toISOString(),
    } satisfies RepairMarker,
  })

  let repaired = 0
  let failed = 0
  const orderedTables: readonly RepairTable[] = [
    'learningPaths',
    'importedCourses',
    'authors',
    'courseServers',
    'importedVideos',
    'importedPdfs',
    'progress',
    'contentProgress',
    'learningPathEntries',
  ]

  for (const tableName of orderedTables) {
    const rows = (await db.table(tableName).toArray()) as Array<Record<string, unknown>>
    for (const row of rows) {
      if (row.userId !== userId || row.isTemplate === true) continue
      if (tableName === 'learningPathEntries') {
        const pathId = typeof row.pathId === 'string' ? row.pathId : ''
        // Template ownership is determined by the parent path. Template rows
        // may not carry a local `isTemplate` flag at all.
        if (pathId.startsWith('template_')) continue
        const parent = pathId ? await db.learningPaths.get(pathId) : undefined
        if (parent?.isTemplate === true) continue
      }
      const entry = tableRegistry.find(item => item.dexieTable === tableName)
      const id = row.id
      if (
        (!entry?.compoundPkFields || entry.compoundPkFields.length === 0) &&
        (typeof id !== 'string' || id.length === 0)
      ) {
        continue
      }
      try {
        const queueRecordId =
          entry?.compoundPkFields && entry.compoundPkFields.length > 0
            ? entry.compoundPkFields.map(field => String(row[field] ?? '')).join('\u001f')
            : String(id ?? '')
        if (typeof db.syncQueue.toCollection === 'function') {
          await db.syncQueue
            .toCollection()
            .filter(
              queued =>
                queued.tableName === tableName &&
                queued.recordId === queueRecordId &&
                queued.status !== 'uploading'
            )
            .delete()
        }
        await syncableWrite(tableName, 'put', row as SyncableRecord)
        repaired += 1
      } catch (error) {
        failed += 1
        console.error(
          `[repairAccountData] Failed to requeue ${tableName}/${String(id ?? 'compound')}:`,
          error
        )
      }
    }
  }

  if (failed > 0) {
    toast.error(
      `${failed} local records could not be prepared for sync. Retry from this device after the error is resolved.`
    )
    return { repaired, failed, skipped: false }
  }

  // A repair is complete only after the regenerated queue has successfully
  // drained. If the browser is offline, leave the marker prepared so reload,
  // reconnect, or the next sign-in resumes instead of skipping the repair.
  syncEngine.setUser(userId)
  const syncResult = await syncEngine.fullSync()
  const pending = await db.syncQueue.where('status').equals('pending').count()
  const failedQueue = await db.syncQueue.where('status').equals('dead-letter').count()
  if (
    pending > 0 ||
    failedQueue > 0 ||
    (syncResult !== undefined &&
      (syncResult.outcome !== 'complete' || syncResult.failedTables.length > 0))
  ) {
    return { repaired, failed: 0, skipped: false }
  }

  await db.syncMetadata.put({
    table: marker,
    value: {
      version: ACCOUNT_REPAIR_VERSION,
      status: 'complete',
      completedAt: new Date().toISOString(),
    } satisfies RepairMarker,
  })
  return { repaired, failed: 0, skipped: false }
}
