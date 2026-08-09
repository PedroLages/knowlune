import { syncableWrite, type SyncableRecord } from '@/lib/sync/syncableWrite'

export async function persistStudySession(
  operation: 'add' | 'put',
  session: SyncableRecord
): Promise<void> {
  const clientRequestId =
    typeof session.clientRequestId === 'string' && session.clientRequestId.trim() !== ''
      ? session.clientRequestId
      : session.id

  await syncableWrite('studySessions', operation, {
    ...session,
    ...(clientRequestId ? { clientRequestId } : {}),
  })
}
