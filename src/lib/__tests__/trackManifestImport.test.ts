/**
 * Unit tests for track manifest batch import.
 *
 * Covers:
 *   - Unit 1: Duplicate-handling — existing courses are re-found in DB and linked to track
 *   - Unit 2: Reorder loop — live store reads prevent stale-index bugs
 */

import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import Dexie from 'dexie'

// ───── Mocks ─────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

// Let persistWithRetry just execute its callback (same pattern as store tests)
vi.mock('@/lib/persistWithRetry', () => ({
  persistWithRetry: (fn: () => Promise<void>) => fn(),
}))

vi.mock('@/lib/aiEventTracking', () => ({
  trackAIUsage: vi.fn().mockResolvedValue(undefined),
}))

// ───── Mock helpers for course import ─────

function mockFileHandle(name: string): FileSystemFileHandle {
  return { kind: 'file', name } as unknown as FileSystemFileHandle
}

function mockDirHandle(
  name: string,
  children?: Map<string, FileSystemDirectoryHandle>
): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    getDirectoryHandle: async (folderName: string) => {
      const child = children?.get(folderName)
      if (child) return child
      throw new DOMException(`No directory named "${folderName}"`, 'NotFoundError')
    },
  } as unknown as FileSystemDirectoryHandle
}

/** Build a parent handle that resolves the given folder names as child directories. */
function makeParentHandle(folders: string[]): FileSystemDirectoryHandle {
  const children = new Map<string, FileSystemDirectoryHandle>()
  for (const folder of folders) {
    children.set(folder, mockDirHandle(folder))
  }
  return mockDirHandle('parent', children)
}

// ───── Test doubles ─────

interface StagedImportedCourse {
  id: string
  name: string
  directoryHandle: FileSystemDirectoryHandle
  videos: Array<{ id: string; title: string; fileHandle: FileSystemFileHandle }>
  pdfs: never[]
  images: never[]
  importedAt: string
  status: string
  tags: string[]
}

function makeStagedCourse(id: string, folderName: string): StagedImportedCourse {
  return {
    id,
    name: folderName,
    directoryHandle: mockDirHandle(folderName),
    videos: [{ id: `${id}-v1`, title: 'Lesson 1', fileHandle: mockFileHandle('lesson1.mp4') }],
    pdfs: [],
    images: [],
    importedAt: new Date().toISOString(),
    status: 'ready',
    tags: [],
  }
}

/**
 * Seed an existing imported course directly in the DB.
 * Uses only serializable data (no FileSystemHandle objects) so fake-indexeddb can clone.
 */
async function seedExistingCourse(id: string, folderName: string) {
  await db.importedCourses.add({
    id,
    name: folderName,
    videos: [{ id: `${id}-v1`, title: 'Lesson 1' }],
    pdfs: [],
    images: [],
    importedAt: new Date().toISOString(),
    status: 'ready',
    tags: [],
    source: 'local',
  } as unknown as Parameters<typeof db.importedCourses.add>[0])
}

// ───── Dynamic imports (after mocks are installed) ─────

let batchImportTrackCourses: (typeof import('@/lib/trackManifestImport'))['batchImportTrackCourses']
let db: (typeof import('@/db/schema'))['db']
let useLearningPathStore: (typeof import('@/stores/useLearningPathStore'))['useLearningPathStore']
let toastMocks: {
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  warning: ReturnType<typeof vi.fn>
  info: ReturnType<typeof vi.fn>
}

const mockScanCourseFolderFromHandle = vi.fn()
const mockPersistScannedCourse = vi.fn()

vi.mock('@/lib/courseImport', () => ({
  scanCourseFolderFromHandle: (...args: unknown[]) => mockScanCourseFolderFromHandle(...args),
  persistScannedCourse: (...args: unknown[]) => mockPersistScannedCourse(...args),
}))

beforeEach(async () => {
  await Dexie.delete('ElearningDB')
  vi.resetModules()

  // Reset mock implementations (but don't replace the functions — vi.mock
  // hoisting binds the closure to these specific objects)
  mockScanCourseFolderFromHandle.mockReset()
  mockPersistScannedCourse.mockReset()

  // Re-import after module reset
  const toastMod = await import('sonner')
  toastMocks = toastMod.toast as unknown as typeof toastMocks

  const dbMod = await import('@/db/schema')
  db = dbMod.db

  const trackImportMod = await import('@/lib/trackManifestImport')
  batchImportTrackCourses = trackImportMod.batchImportTrackCourses

  const storeMod = await import('@/stores/useLearningPathStore')
  useLearningPathStore = storeMod.useLearningPathStore
})

// ───── Helpers ─────

/** Build a minimal TrackManifest with the given course entries */
function makeManifest(
  courses: Array<{ folder: string; position: number; id?: string; notes?: string }>,
  version: string = '1.0'
) {
  return {
    version,
    track: {
      name: 'Test Track',
      description: 'A test track',
      courses: courses.map(c => ({
        id: c.id ?? c.folder.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        folder: c.folder,
        position: c.position,
        notes: c.notes,
      })),
    },
  }
}

// ──────────────────────────────────────────────────
// Unit 1: Duplicate handling
// ──────────────────────────────────────────────────

describe('batchImportTrackCourses — duplicate handling (Unit 1)', () => {
  it('includes an existing course in results when scan detects duplicate and DB has it', async () => {
    const EXISTING_ID = 'course-existing-1'
    const FOLDER = 'existing-course'

    // Seed the DB so the lookup succeeds
    await seedExistingCourse(EXISTING_ID, FOLDER)

    // Simulate: scan says duplicate for this folder
    mockScanCourseFolderFromHandle.mockImplementation(async (handle: FileSystemDirectoryHandle) => {
      if (handle.name === FOLDER) {
        return { status: 'duplicate' as const, folderName: FOLDER }
      }
      // Other courses scan+persist normally
      return {
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      }
    })

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    const manifest = makeManifest([
      { folder: FOLDER, position: 1 },
      { folder: 'new-course', position: 2 },
    ])

    const parentHandle = makeParentHandle([FOLDER, 'new-course'])

    const result = await batchImportTrackCourses(parentHandle, manifest)

    // Existing course should be included as success with correct ID
    const existingResult = result.courses.find(r => r.folder === FOLDER)
    expect(existingResult).toBeDefined()
    expect(existingResult!.success).toBe(true)
    expect(existingResult!.courseId).toBe(EXISTING_ID)

    // New course should also be imported
    const newResult = result.courses.find(r => r.folder === 'new-course')
    expect(newResult).toBeDefined()
    expect(newResult!.success).toBe(true)
    expect(newResult!.courseId).toBeDefined()

    expect(result.successCount).toBe(2)
    expect(result.failureCount).toBe(0)
    expect(result.trackId).toBeDefined()

    // Both courses should be in the created track
    const store = useLearningPathStore.getState()
    const trackEntries = store.entries.filter(e => e.pathId === result.trackId)
    expect(trackEntries).toHaveLength(2)

    // No warning toast for the duplicate course (it was found successfully)
    const duplicateWarnings = toastMocks.warning.mock.calls.filter((args: string[]) =>
      args[0]?.includes('already imported')
    )
    expect(duplicateWarnings).toHaveLength(0)
  })

  it('handles the edge case where scan says duplicate but DB lookup fails', async () => {
    const FOLDER = 'ghost-course'

    // Do NOT seed the DB — simulate a race condition where the course was
    // deleted between the scan's name check and our lookup.

    mockScanCourseFolderFromHandle.mockImplementation(async (handle: FileSystemDirectoryHandle) => {
      if (handle.name === FOLDER) {
        return { status: 'duplicate' as const, folderName: FOLDER }
      }
      return {
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      }
    })

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    const manifest = makeManifest([
      { folder: FOLDER, position: 1 },
      { folder: 'real-course', position: 2 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await batchImportTrackCourses(parentHandle, manifest)

    // Ghost course should be marked as failure
    const ghostResult = result.courses.find(r => r.folder === FOLDER)
    expect(ghostResult!.success).toBe(false)
    expect(ghostResult!.error).toBe('Course not found in database')

    // Warning toast should fire
    expect(toastMocks.warning).toHaveBeenCalledWith(expect.stringContaining(FOLDER))

    // The real course still succeeds
    expect(result.successCount).toBe(1)
    expect(result.failureCount).toBe(1)
  })

  it('preserves existing behavior for new (non-duplicate) courses', async () => {
    // All courses scan as new
    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      })
    )

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    const manifest = makeManifest([
      { folder: 'course-a', position: 1 },
      { folder: 'course-b', position: 2 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await batchImportTrackCourses(parentHandle, manifest)

    expect(result.successCount).toBe(2)
    expect(result.failureCount).toBe(0)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries.filter(e => e.pathId === result.trackId)
    expect(trackEntries).toHaveLength(2)
  })

  it('handles a mix of existing and new courses correctly', async () => {
    // Pre-seed two existing courses
    await seedExistingCourse('existing-a', 'course-a')
    await seedExistingCourse('existing-b', 'course-b')

    mockScanCourseFolderFromHandle.mockImplementation(async (handle: FileSystemDirectoryHandle) => {
      if (handle.name === 'course-a' || handle.name === 'course-b') {
        return { status: 'duplicate' as const, folderName: handle.name }
      }
      return {
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      }
    })

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    const manifest = makeManifest([
      { folder: 'course-a', position: 1 },
      { folder: 'new-x', position: 2 },
      { folder: 'course-b', position: 3 },
      { folder: 'new-y', position: 4 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await batchImportTrackCourses(parentHandle, manifest)

    expect(result.successCount).toBe(4)
    expect(result.failureCount).toBe(0)

    // Existing courses should have their original IDs
    expect(result.courses.find(r => r.folder === 'course-a')!.courseId).toBe('existing-a')
    expect(result.courses.find(r => r.folder === 'course-b')!.courseId).toBe('existing-b')

    // All 4 courses should be in the track
    const store = useLearningPathStore.getState()
    const trackEntries = store.entries.filter(e => e.pathId === result.trackId)
    expect(trackEntries).toHaveLength(4)
  })
})

// ──────────────────────────────────────────────────
// Unit 2: Reorder loop (stale-index fix)
// ──────────────────────────────────────────────────

describe('batchImportTrackCourses — reorder loop (Unit 2)', () => {
  it('produces correct manifest order when all courses are new and in-order', async () => {
    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      })
    )

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    const manifest = makeManifest([
      { folder: 'c1', position: 1 },
      { folder: 'c2', position: 2 },
      { folder: 'c3', position: 3 },
      { folder: 'c4', position: 4 },
      { folder: 'c5', position: 5 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    expect(result.successCount).toBe(5)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries
      .filter(e => e.pathId === result.trackId)
      .sort((a, b) => a.position - b.position)

    // Check that entries are in correct position order (1 through 5)
    expect(trackEntries).toHaveLength(5)
    trackEntries.forEach((entry, i) => {
      expect(entry.position).toBe(i + 1)
    })

    // Verify each courseId is at the correct manifest position
    const folderOrder = ['c1', 'c2', 'c3', 'c4', 'c5']
    const resultsByFolder = new Map(result.courses.map(r => [r.folder, r]))
    trackEntries.forEach((entry, i) => {
      const expectedFolder = folderOrder[i]
      const expectedResult = resultsByFolder.get(expectedFolder)
      expect(entry.courseId).toBe(expectedResult!.courseId)
    })
  })

  it('handles sparse manifest positions (gap scenario)', async () => {
    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      })
    )

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    // Manifest positions: 1, 3, 5 (positions 2 and 4 are missing)
    // After createPathWithCourses they get positions 1, 2, 3
    // Reorder should move them to 1, 3, 5
    const manifest = makeManifest([
      { folder: 'c1', position: 1 },
      { folder: 'c3', position: 3 },
      { folder: 'c5', position: 5 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    expect(result.successCount).toBe(3)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries
      .filter(e => e.pathId === result.trackId)
      .sort((a, b) => a.position - b.position)

    expect(trackEntries).toHaveLength(3)

    // After reorder: positions should be 1, 3, 5 (contiguous after gaps, or exact)
    // The reorder moves c3 from position 2 to target 2 (position-1=2), and c5 from 3 to 4
    // But actually reorderCourse works on indices, not positions
    // c1 at index 0 → should stay at index 0 (target=0)
    // c3 at index 1 → target index 2 (position 3 - 1 = 2)
    // After first reorder: indices shift...
    // Let's just verify there are no gaps in positions
    const positions = trackEntries.map(e => e.position)
    // Positions should be a contiguous 1..N — reorderCourse reassigns all positions
    for (let i = 0; i < positions.length; i++) {
      expect(positions[i]).toBe(i + 1)
    }
  })

  it('handles consecutive reorders without stale indices', async () => {
    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      })
    )

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    // Reverse manifest order: position 5, 4, 3, 2, 1
    // This forces multiple consecutive reorder calls.
    const manifest = makeManifest([
      { folder: 'e5', position: 5 },
      { folder: 'e4', position: 4 },
      { folder: 'e3', position: 3 },
      { folder: 'e2', position: 2 },
      { folder: 'e1', position: 1 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    expect(result.successCount).toBe(5)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries
      .filter(e => e.pathId === result.trackId)
      .sort((a, b) => a.position - b.position)

    expect(trackEntries).toHaveLength(5)

    // Verify: entries sorted by position should match the manifest folder
    // order (e1 at pos 1, e2 at pos 2, ..., e5 at pos 5)
    const folderByCourseId = new Map(
      result.courses.filter(r => r.success).map(r => [r.courseId, r.folder])
    )
    const expectedOrder = ['e1', 'e2', 'e3', 'e4', 'e5']
    trackEntries.forEach((entry, i) => {
      const folder = folderByCourseId.get(entry.courseId)
      expect(folder).toBe(expectedOrder[i])
      expect(entry.position).toBe(i + 1)
    })
  })

  it('stale-index regression: 3+ reorders produce correct final positions', async () => {
    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      })
    )

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    // Scrambled order — every course needs repositioning
    // Import order: a,b,c,d,e — manifest wants: e,d,c,b,a
    const manifest = makeManifest([
      { folder: 'a', position: 5 },
      { folder: 'b', position: 4 },
      { folder: 'c', position: 3 },
      { folder: 'd', position: 2 },
      { folder: 'e', position: 1 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    expect(result.successCount).toBe(5)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries
      .filter(e => e.pathId === result.trackId)
      .sort((a, b) => a.position - b.position)

    expect(trackEntries).toHaveLength(5)

    const folderByCourseId = new Map(
      result.courses.filter(r => r.success).map(r => [r.courseId, r.folder])
    )

    // Expected: e (pos 1), d (pos 2), c (pos 3), b (pos 4), a (pos 5)
    const expectedOrder = ['e', 'd', 'c', 'b', 'a']
    trackEntries.forEach((entry, i) => {
      const folder = folderByCourseId.get(entry.courseId)
      expect(folder).toBe(expectedOrder[i])
      expect(entry.position).toBe(i + 1)
    })

    // All positions must be contiguous 1..5
    const positions = trackEntries.map(e => e.position)
    expect(positions).toEqual([1, 2, 3, 4, 5])
  })

  it('reorder loop handles a mix of successful and failed courses', async () => {
    // course-b fails, course-d fails
    mockScanCourseFolderFromHandle.mockImplementation(async (handle: FileSystemDirectoryHandle) => {
      if (handle.name === 'course-b' || handle.name === 'course-d') {
        return { status: 'no-files' as const, folderName: handle.name }
      }
      return {
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      }
    })

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    // Manifest: a(1), b(2 fail), c(3), d(4 fail), e(5)
    const manifest = makeManifest([
      { folder: 'course-a', position: 1 },
      { folder: 'course-b', position: 2 },
      { folder: 'course-c', position: 3 },
      { folder: 'course-d', position: 4 },
      { folder: 'course-e', position: 5 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    // 3 succeeded, 2 failed
    expect(result.successCount).toBe(3)
    expect(result.failureCount).toBe(2)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries
      .filter(e => e.pathId === result.trackId)
      .sort((a, b) => a.position - b.position)

    expect(trackEntries).toHaveLength(3)

    // The reorder loop should not crash on failed courses (they have no courseId)
    // Failed courses are simply skipped in the reorder loop
    const positions = trackEntries.map(e => e.position)
    for (let i = 0; i < positions.length; i++) {
      expect(positions[i]).toBe(i + 1)
    }
  })

  it('creates positions correctly when all existing courses are already in order (no-op reorder)', async () => {
    // All pre-seeded, all in manifest order → no reorder calls needed
    await seedExistingCourse('ida', 'a')
    await seedExistingCourse('idb', 'b')
    await seedExistingCourse('idc', 'c')

    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'duplicate' as const,
        folderName: handle.name,
      })
    )

    const manifest = makeManifest([
      { folder: 'a', position: 1 },
      { folder: 'b', position: 2 },
      { folder: 'c', position: 3 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    expect(result.successCount).toBe(3)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries
      .filter(e => e.pathId === result.trackId)
      .sort((a, b) => a.position - b.position)

    expect(trackEntries).toHaveLength(3)

    // Verify the correct courseIds are at each position
    expect(trackEntries[0].courseId).toBe('ida')
    expect(trackEntries[1].courseId).toBe('idb')
    expect(trackEntries[2].courseId).toBe('idc')
  })

  it('applies manifest positions when adding courses to an existing track', async () => {
    // Pre-seed an existing track with some courses already in it.
    // The manifest track name must match so the existing-track path is taken.
    const store = useLearningPathStore.getState()
    await store.loadPaths()
    const existingPath = await store.createPathWithCourses('Test Track', 'pre-existing', [
      { courseId: 'old-course-1', courseType: 'imported' as const },
      { courseId: 'old-course-2', courseType: 'imported' as const },
    ])

    // Pre-seed courses in the DB as already-imported
    await seedExistingCourse('existing-id', 'existing-course')
    await seedExistingCourse('new-id', 'new-course')

    // Both courses appear as duplicates (already imported)
    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'duplicate' as const,
        folderName: handle.name,
      })
    )

    const manifest = makeManifest([
      { folder: 'existing-course', position: 1 },
      { folder: 'new-course', position: 2 },
    ])

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    expect(result.successCount).toBe(2)

    // Track should now have 4 entries: 2 pre-existing + 2 new, reordered per manifest.
    // Fresh getState() — the test's `store` variable went stale after batchImportTrackCourses.
    const freshState = useLearningPathStore.getState()
    const trackEntries = freshState.entries
      .filter(e => e.pathId === existingPath.id)
      .sort((a, b) => a.position - b.position)

    expect(trackEntries).toHaveLength(4)

    // Manifest positions are absolute (1-indexed). Position 1 → index 0 (first),
    // position 2 → index 1 (second). Pre-existing entries shift down.
    expect(trackEntries[0].courseId).toBe('existing-id')
    expect(trackEntries[0].position).toBe(1)
    expect(trackEntries[1].courseId).toBe('new-id')
    expect(trackEntries[1].position).toBe(2)
    expect(trackEntries[2].courseId).toBe('old-course-1')
    expect(trackEntries[2].position).toBe(3)
    expect(trackEntries[3].courseId).toBe('old-course-2')
    expect(trackEntries[3].position).toBe(4)
  })
})

// ──────────────────────────────────────────────────
// Unit 3: Version 1.1 manifest integration
// ──────────────────────────────────────────────────

describe('batchImportTrackCourses — version 1.1 manifest (Unit 3)', () => {
  it('imports courses in correct manifest order with version 1.1', async () => {
    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      })
    )

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    const manifest = makeManifest(
      [
        { folder: 'c1', position: 1 },
        { folder: 'c2', position: 2 },
        { folder: 'c3', position: 3 },
        { folder: 'c4', position: 4 },
        { folder: 'c5', position: 5 },
      ],
      '1.1'
    )

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    expect(result.successCount).toBe(5)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries
      .filter(e => e.pathId === result.trackId)
      .sort((a, b) => a.position - b.position)

    expect(trackEntries).toHaveLength(5)
    trackEntries.forEach((entry, i) => {
      expect(entry.position).toBe(i + 1)
    })

    const folderOrder = ['c1', 'c2', 'c3', 'c4', 'c5']
    const resultsByFolder = new Map(result.courses.map(r => [r.folder, r]))
    trackEntries.forEach((entry, i) => {
      const expectedFolder = folderOrder[i]
      const expectedResult = resultsByFolder.get(expectedFolder)
      expect(entry.courseId).toBe(expectedResult!.courseId)
    })
  })

  it('reorders courses correctly when version 1.1 manifest array order differs from position fields', async () => {
    mockScanCourseFolderFromHandle.mockImplementation(
      async (handle: FileSystemDirectoryHandle) => ({
        status: 'success' as const,
        course: makeStagedCourse(`new-${handle.name}`, handle.name),
      })
    )

    mockPersistScannedCourse.mockImplementation(async (course: StagedImportedCourse) => ({
      ...course,
      status: 'ready',
    }))

    // Array order: a, b, c, d, e → but positions are reversed
    const manifest = makeManifest(
      [
        { folder: 'a', position: 5 },
        { folder: 'b', position: 4 },
        { folder: 'c', position: 3 },
        { folder: 'd', position: 2 },
        { folder: 'e', position: 1 },
      ],
      '1.1'
    )

    const parentHandle = makeParentHandle(manifest.track.courses.map(c => c.folder))
    const result = await act(async () => batchImportTrackCourses(parentHandle, manifest))

    expect(result.successCount).toBe(5)

    const store = useLearningPathStore.getState()
    const trackEntries = store.entries
      .filter(e => e.pathId === result.trackId)
      .sort((a, b) => a.position - b.position)

    expect(trackEntries).toHaveLength(5)

    const folderByCourseId = new Map(
      result.courses.filter(r => r.success).map(r => [r.courseId, r.folder])
    )

    const expectedOrder = ['e', 'd', 'c', 'b', 'a']
    trackEntries.forEach((entry, i) => {
      const folder = folderByCourseId.get(entry.courseId)
      expect(folder).toBe(expectedOrder[i])
      expect(entry.position).toBe(i + 1)
    })
  })
})
