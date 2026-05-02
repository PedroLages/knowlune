import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

export async function persistStudySession(
  operation: 'add' | 'put',
  session: SyncableRecord
): Promise<void> {
  await syncableWrite('studySessions', operation, session)
}
