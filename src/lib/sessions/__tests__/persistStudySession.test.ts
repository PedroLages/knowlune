import { describe, it, expect, vi, beforeEach } from 'vitest'
import { persistStudySession } from '../persistStudySession'

vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: vi.fn(),
}))

import { syncableWrite } from '@/lib/sync/syncableWrite'

const mockSyncableWrite = syncableWrite as ReturnType<typeof vi.fn>

describe('persistStudySession', () => {
  beforeEach(() => {
    mockSyncableWrite.mockClear()
  })

  const mockSession = {
    id: 'session-1',
    courseId: 'course-1',
    startTime: '2026-04-28T10:00:00Z',
    endTime: '2026-04-28T10:30:00Z',
    duration: 1800,
    idleTime: 60,
    sessionType: 'mixed',
  }

  it('calls syncableWrite with table studySessions and operation add', async () => {
    mockSyncableWrite.mockResolvedValue(undefined)

    await persistStudySession('add', mockSession)

    expect(mockSyncableWrite).toHaveBeenCalledTimes(1)
    expect(mockSyncableWrite).toHaveBeenCalledWith('studySessions', 'add', mockSession)
  })

  it('calls syncableWrite with table studySessions and operation put', async () => {
    mockSyncableWrite.mockResolvedValue(undefined)

    await persistStudySession('put', mockSession)

    expect(mockSyncableWrite).toHaveBeenCalledTimes(1)
    expect(mockSyncableWrite).toHaveBeenCalledWith('studySessions', 'put', mockSession)
  })

  it('passes through the full session record', async () => {
    mockSyncableWrite.mockResolvedValue(undefined)
    const record = {
      id: 'session-2',
      extraField: 'value',
      nested: { deep: true },
      number: 42,
    }

    await persistStudySession('add', record)

    expect(mockSyncableWrite).toHaveBeenCalledWith('studySessions', 'add', record)
  })
})
