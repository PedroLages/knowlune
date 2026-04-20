// E97-S03: Tests for shouldShowInitialUploadWizard detection helper
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Dexie from 'dexie'
import { db } from '@/db'
import {
  shouldShowInitialUploadWizard,
  wizardCompleteKey,
  wizardDismissedKey,
} from '../shouldShowInitialUploadWizard'
import { hasUnlinkedRecords } from '../hasUnlinkedRecords'

vi.mock('../hasUnlinkedRecords', () => ({
  hasUnlinkedRecords: vi.fn().mockResolvedValue(false),
}))

beforeEach(async () => {
  await db.open()
  localStorage.clear()
  vi.mocked(hasUnlinkedRecords).mockResolvedValue(false)
})

afterEach(async () => {
  db.close()
  await Dexie.delete('ElearningDB')
  localStorage.clear()
  vi.clearAllMocks()
})

const USER = 'user-1'

async function seedPending() {
  await db.syncQueue.add({
    tableName: 'notes',
    recordId: 'n1',
    operation: 'put',
    payload: {},
    attempts: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

describe('shouldShowInitialUploadWizard', () => {
  it('returns false AND writes completion flag when DB is empty and flag not set', async () => {
    const result = await shouldShowInitialUploadWizard(USER)
    expect(result).toBe(false)
    expect(localStorage.getItem(wizardCompleteKey(USER))).not.toBeNull()
  })

  it('returns true (no flag write) when pending queue entries exist', async () => {
    await seedPending()
    const result = await shouldShowInitialUploadWizard(USER)
    expect(result).toBe(true)
    expect(localStorage.getItem(wizardCompleteKey(USER))).toBeNull()
  })

  it('returns true (no flag write) when unlinked records exist', async () => {
    vi.mocked(hasUnlinkedRecords).mockResolvedValueOnce(true)
    const result = await shouldShowInitialUploadWizard(USER)
    expect(result).toBe(true)
    expect(localStorage.getItem(wizardCompleteKey(USER))).toBeNull()
  })

  it('returns false when completion flag is already set, even with pending entries', async () => {
    localStorage.setItem(wizardCompleteKey(USER), '2020-01-01T00:00:00.000Z')
    await seedPending()
    const result = await shouldShowInitialUploadWizard(USER)
    expect(result).toBe(false)
    // Flag remains at the original value
    expect(localStorage.getItem(wizardCompleteKey(USER))).toBe('2020-01-01T00:00:00.000Z')
  })

  it('writes flag on short-circuit path (empty + unset)', async () => {
    expect(localStorage.getItem(wizardCompleteKey(USER))).toBeNull()
    await shouldShowInitialUploadWizard(USER)
    expect(localStorage.getItem(wizardCompleteKey(USER))).not.toBeNull()
  })

  it('propagates Dexie errors to the caller', async () => {
    const spy = vi.spyOn(db.syncQueue, 'where').mockImplementationOnce(() => {
      throw new Error('dexie boom')
    })
    await expect(shouldShowInitialUploadWizard(USER)).rejects.toThrow('dexie boom')
    spy.mockRestore()
  })

  it('returns false for empty userId (guard)', async () => {
    expect(await shouldShowInitialUploadWizard('')).toBe(false)
  })

  it('respects session-scoped dismissal flag (returns false) even with pending entries', async () => {
    localStorage.setItem(wizardDismissedKey(USER), '2026-01-01T00:00:00.000Z')
    await seedPending()
    const result = await shouldShowInitialUploadWizard(USER)
    expect(result).toBe(false)
    // No completion flag write — dismissal is session-scoped, not permanent.
    expect(localStorage.getItem(wizardCompleteKey(USER))).toBeNull()
  })
})
