import { db } from '@/db'
import { toast } from 'sonner'
import { syncableWrite, type SyncableRecord } from './syncableWrite'
import { tableRegistry } from './tableRegistry'

/** Bump when the repair payload or its target set changes. */
export const ACCOUNT_REPAIR_VERSION = 1

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
  if (prior?.value === ACCOUNT_REPAIR_VERSION) {
    return { repaired: 0, failed: 0, skipped: true }
  }

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
      const entry = tableRegistry.find(item => item.dexieTable === tableName)
      const id = row.id
      if (
        (!entry?.compoundPkFields || entry.compoundPkFields.length === 0) &&
        (typeof id !== 'string' || id.length === 0)
      ) {
        continue
      }
      try {
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
      `${failed} local records could not be prepared for sync. We will retry automatically.`
    )
    return { repaired, failed, skipped: false }
  }

  await db.syncMetadata.put({ table: marker, value: ACCOUNT_REPAIR_VERSION })
  return { repaired, failed: 0, skipped: false }
}
