/**
 * Unit tests for track-cover detection, selection, and persistence helpers.
 *
 * Tests pure functions (isTrackCoverImage, resolveTrackCoverAutoSelection),
 * server listing (listServerTrackRoot), and local detection
 * (collectLocalTrackCoverCandidates) without depending on the full import
 * workflow or IndexedDB.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock sonner (needed by courseImport module) ──

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

// ── Mock fileSystem (needed for isImageFile, scanDirectory, etc.) ──

vi.mock('@/lib/fileSystem', () => ({
  showDirectoryPicker: vi.fn(),
  scanDirectory: vi.fn(),
  extractVideoMetadata: vi.fn(),
  extractPdfMetadata: vi.fn(),
  extractVideoMetadataFromFile: vi.fn(),
  extractPdfMetadataFromFile: vi.fn(),
  isSupportedVideoFormat: vi.fn(() => false),
  isSupportedFile: vi.fn(() => false),
  isImageFile: vi.fn((name: string) => {
    const ext = name.toLowerCase().slice(name.lastIndexOf('.'))
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)
  }),
  getVideoFormat: vi.fn(() => 'mp4'),
  SUPPORTED_VIDEO_EXTENSIONS: ['.mp4', '.mkv', '.avi', '.webm', '.ts'],
  SUPPORTED_DOCUMENT_EXTENSIONS: ['.pdf'],
  SUPPORTED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  SUPPORTED_FILE_EXTENSIONS: ['.mp4', '.mkv', '.avi', '.webm', '.ts', '.pdf'],
}))

// ── Mock stores ──

const mockUpdatePathCover = vi.fn()
vi.mock('@/stores/useLearningPathStore', () => ({
  useLearningPathStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector
        ? selector({ paths: [], entries: [] })
        : { paths: [], entries: [], updatePathCover: mockUpdatePathCover },
    {
      getState: () => ({
        paths: [] as Array<{
          id: string
          name: string
          coverImageUrl?: string
          coverPreset?: string
        }>,
        entries: [],
        updatePathCover: mockUpdatePathCover,
      }),
      setState: vi.fn(),
    }
  ),
}))

vi.mock('@/stores/useCourseImportStore', () => ({
  useCourseImportStore: {
    getState: () => ({ importedCourses: [], loadImportedCourses: vi.fn() }),
    setState: vi.fn(),
  },
}))

vi.mock('@/stores/useImportProgressStore', () => ({
  useImportProgressStore: {
    getState: () => ({
      startImport: vi.fn(),
      completeCourse: vi.fn(),
      updateScanProgress: vi.fn(),
      updateProcessingProgress: vi.fn(),
      cancelRequested: false,
    }),
  },
}))

vi.mock('@/stores/useNotificationStore', () => ({
  useNotificationStore: { getState: () => ({ create: vi.fn() }) },
}))

// ── Mock Supabase (needed by applyImportedTrackCover → uploadPathCover) ──

vi.mock('@/lib/auth/supabase', () => ({
  supabase: null,
}))

// ── Mock Dexie / db ──

vi.mock('@/db', () => ({
  db: {
    importedCourses: { where: vi.fn(() => ({ equals: vi.fn(() => ({ first: vi.fn() })) })), toArray: vi.fn(() => []), get: vi.fn() },
    importedVideos: { where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) },
    importedPdfs: { where: vi.fn(() => ({ equals: vi.fn(() => ({ toArray: vi.fn(() => []) })) })) },
    videoCaptions: { where: vi.fn(() => ({ equals: vi.fn(() => ({ delete: vi.fn() })) })), put: vi.fn() },
    authors: { get: vi.fn() },
    transaction: vi.fn((_mode: string, _tables: string[], fn: () => unknown) => fn()),
    learningPaths: { toArray: vi.fn(() => []), bulkPut: vi.fn(), get: vi.fn() },
    learningPathEntries: { toArray: vi.fn(() => []), bulkPut: vi.fn(), where: vi.fn(() => ({ equals: vi.fn(() => ({ primaryKeys: vi.fn(() => []) })) })) },
    syncQueue: { add: vi.fn() },
  },
}))

vi.mock('@/lib/sync/syncableWrite', () => ({
  syncableWrite: vi.fn((_table: string, _op: string, record: unknown) => Promise.resolve(record)),
  synthesizeRecordId: vi.fn(),
}))

// ── Now import the module under test ──

let isTrackCoverImage: (filename: string) => boolean
let TRACK_COVER_EXTENSIONS: readonly string[]
interface ServerTrackRootListing {
  directories: Array<{ name: string; url: string }>
  images: Array<{ name: string; url: string }>
}
type ServerResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }
let listServerTrackRoot: (url: string) => Promise<ServerResult<ServerTrackRootListing>>
interface TrackCoverCandidate {
  id: string
  filename: string
  source: 'local' | 'server' | 'manifest'
  previewUrl: string
  fileHandle?: FileSystemFileHandle
  serverUrl?: string
}
let collectLocalTrackCoverCandidates: (
  parentDirHandle: FileSystemDirectoryHandle
) => Promise<TrackCoverCandidate[]>
let applyImportedTrackCover: (opts: {
  trackId: string
  candidate: { id: string; filename: string; source: string; previewUrl: string; fileHandle?: FileSystemFileHandle; serverUrl?: string }
  isExplicitSelection: boolean
  preserveExisting: boolean
}) => Promise<string>

beforeEach(async () => {
  vi.clearAllMocks()
  const mod = await import('@/lib/courseImport')
  isTrackCoverImage = mod.isTrackCoverImage
  TRACK_COVER_EXTENSIONS = mod.TRACK_COVER_EXTENSIONS
  listServerTrackRoot = mod.listServerTrackRoot as typeof listServerTrackRoot
  collectLocalTrackCoverCandidates =
    mod.collectLocalTrackCoverCandidates as typeof collectLocalTrackCoverCandidates
  applyImportedTrackCover = mod.applyImportedTrackCover as typeof applyImportedTrackCover
})

// ── isTrackCoverImage ──────────────────────────────────────────

describe('isTrackCoverImage', () => {
  it('returns true for .jpg', () => {
    expect(isTrackCoverImage('cover.jpg')).toBe(true)
  })

  it('returns true for .jpeg', () => {
    expect(isTrackCoverImage('photo.jpeg')).toBe(true)
  })

  it('returns true for .png', () => {
    expect(isTrackCoverImage('banner.png')).toBe(true)
  })

  it('returns true for .webp', () => {
    expect(isTrackCoverImage('DevOps-Platform-Engineer.webp')).toBe(true)
  })

  it('returns false for .gif (not suitable for track banners)', () => {
    expect(isTrackCoverImage('animated.gif')).toBe(false)
  })

  it('returns false for .svg', () => {
    expect(isTrackCoverImage('logo.svg')).toBe(false)
  })

  it('returns false for .bmp', () => {
    expect(isTrackCoverImage('image.bmp')).toBe(false)
  })

  it('returns false for video files', () => {
    expect(isTrackCoverImage('lesson.mp4')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isTrackCoverImage('COVER.PNG')).toBe(true)
    expect(isTrackCoverImage('Image.JPG')).toBe(true)
  })
})

// ── TRACK_COVER_EXTENSIONS ─────────────────────────────────────

describe('TRACK_COVER_EXTENSIONS', () => {
  it('excludes .gif', () => {
    expect(TRACK_COVER_EXTENSIONS).not.toContain('.gif')
  })

  it('excludes .svg', () => {
    expect(TRACK_COVER_EXTENSIONS).not.toContain('.svg')
  })

  it('includes .jpg, .jpeg, .png, .webp', () => {
    expect(TRACK_COVER_EXTENSIONS).toContain('.jpg')
    expect(TRACK_COVER_EXTENSIONS).toContain('.jpeg')
    expect(TRACK_COVER_EXTENSIONS).toContain('.png')
    expect(TRACK_COVER_EXTENSIONS).toContain('.webp')
  })
})

// ── listServerTrackRoot ────────────────────────────────────────

describe('listServerTrackRoot', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    // Mock DOMParser to return parsed HTML
    const origParseFromString = DOMParser.prototype.parseFromString
    vi.spyOn(DOMParser.prototype, 'parseFromString').mockImplementation(
      function (this: DOMParser, html: string, type: DOMParserSupportedType) {
        const doc = origParseFromString.call(this, html, type)
        return doc
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function nginxListing(entries: string[]): string {
    const rows = entries
      .map(
        e =>
          `<a href="${e}">${e}</a>${e.endsWith('/') ? '       -' : '      23M'}`
      )
      .join('\n')
    return `<html><head><title>Index of /</title></head><body><h1>Index of /</h1><hr><pre><a href="../">../</a>\n${rows}\n</pre><hr></body></html>`
  }

  it('returns directories and root-level images', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          nginxListing([
            'Course1/',
            'Course2/',
            'cover.webp',
            'banner.png',
          ])
        ),
      headers: new Headers(),
    })

    const result = await listServerTrackRoot('http://example.com/track/')

    expect(result).toHaveProperty('ok', true)
    if (!result.ok) throw new Error('Expected ok')
    expect(result.data.directories).toHaveLength(2)
    expect(result.data.directories[0].name).toBe('Course1')
    expect(result.data.images).toHaveLength(2)
    expect(result.data.images[0].name).toBe('banner.png')
    expect(result.data.images[1].name).toBe('cover.webp')
  })

  it('excludes .gif and .svg from root images', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          nginxListing([
            'Course1/',
            'cover.webp',
            'animated.gif',
            'logo.svg',
          ])
        ),
      headers: new Headers(),
    })

    const result = await listServerTrackRoot('http://example.com/track/')

    expect(result).toHaveProperty('ok', true)
    if (!result.ok) throw new Error('Expected ok')
    expect(result.data.images).toHaveLength(1)
    expect(result.data.images[0].name).toBe('cover.webp')
  })

  it('does not return nested course images (only root-level)', async () => {
    // nginx autoindex only lists direct children — nested images would only
    // appear if we recursed. Since listServerTrackRoot does not recurse,
    // this test confirms that only immediate children are returned.
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          nginxListing(['Course1/', 'root-banner.jpg'])
        ),
      headers: new Headers(),
    })

    const result = await listServerTrackRoot('http://example.com/track/')

    expect(result).toHaveProperty('ok', true)
    if (!result.ok) throw new Error('Expected ok')
    expect(result.data.images).toHaveLength(1)
    expect(result.data.images[0].name).toBe('root-banner.jpg')
    // Course1/ is a directory, not an image
  })

  it('sorts images naturally by filename', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          nginxListing(['zebra.png', 'alpha.jpg', '10-cover.webp'])
        ),
      headers: new Headers(),
    })

    const result = await listServerTrackRoot('http://example.com/track/')

    expect(result).toHaveProperty('ok', true)
    if (!result.ok) throw new Error('Expected ok')
    expect(result.data.images[0].name).toBe('10-cover.webp')
    expect(result.data.images[1].name).toBe('alpha.jpg')
    expect(result.data.images[2].name).toBe('zebra.png')
  })

  it('returns validation error for empty URL', async () => {
    const result = await listServerTrackRoot('')

    expect(result).toHaveProperty('ok', false)
  })

  it('returns error when server is unreachable', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await listServerTrackRoot('http://example.com/track/')

    expect(result).toHaveProperty('ok', false)
  })
})

// ── collectLocalTrackCoverCandidates ───────────────────────────

/** Create a mock FileSystemFileHandle with a working getFile() method. */
function mockFileHandle(name: string): FileSystemFileHandle {
  return {
    kind: 'file',
    name,
    getFile: () => Promise.resolve(new File([new ArrayBuffer(8)], name)),
  } as unknown as FileSystemFileHandle
}

describe('collectLocalTrackCoverCandidates', () => {
  it('returns supported root images sorted by filename', async () => {
    // Build a mock directory handle with image and non-image files
    const mockHandle: FileSystemDirectoryHandle = {
      kind: 'directory',
      name: 'TrackRoot',
      values: () =>
        (async function* () {
          yield mockFileHandle('cover.webp')
          yield mockFileHandle('banner.png')
          yield { kind: 'file', name: 'readme.txt' } as unknown as FileSystemFileHandle
          yield mockFileHandle('animated.gif')
          yield { kind: 'directory', name: 'Course1' } as FileSystemDirectoryHandle
        })(),
    } as unknown as FileSystemDirectoryHandle

    const candidates = await collectLocalTrackCoverCandidates(mockHandle)

    expect(candidates).toHaveLength(2)
    expect(candidates[0].filename).toBe('banner.png')
    expect(candidates[1].filename).toBe('cover.webp')
    expect(candidates[0].source).toBe('local')
    expect(candidates[0].previewUrl).toMatch(/^blob:/)
  })

  it('returns empty array when no images found', async () => {
    const mockHandle: FileSystemDirectoryHandle = {
      kind: 'directory',
      name: 'Empty',
      values: () =>
        (async function* () {
          yield { kind: 'file', name: 'readme.txt' } as unknown as FileSystemFileHandle
          yield { kind: 'directory', name: 'Course1' } as FileSystemDirectoryHandle
        })(),
    } as unknown as FileSystemDirectoryHandle

    const candidates = await collectLocalTrackCoverCandidates(mockHandle)

    expect(candidates).toHaveLength(0)
  })

  it('ignores GIF files (not suitable for track banners)', async () => {
    const mockHandle: FileSystemDirectoryHandle = {
      kind: 'directory',
      name: 'Root',
      values: () =>
        (async function* () {
          yield mockFileHandle('banner.gif')
          yield mockFileHandle('cover.jpg')
        })(),
    } as unknown as FileSystemDirectoryHandle

    const candidates = await collectLocalTrackCoverCandidates(mockHandle)

    expect(candidates).toHaveLength(1)
    expect(candidates[0].filename).toBe('cover.jpg')
  })
})

// ── applyImportedTrackCover ─────────────────────────────────────

describe('applyImportedTrackCover', () => {
  it('returns track-cover-skipped-preserved when existing track has coverImageUrl and preserveExisting is true', async () => {
    // Set up the learning path store to have an existing track with coverImageUrl
    const { useLearningPathStore } = await import('@/stores/useLearningPathStore')
    ;(useLearningPathStore as unknown as { getState: () => Record<string, unknown> }).getState = () => ({
      paths: [{ id: 'track-1', name: 'Test', coverImageUrl: 'https://existing.com/cover.jpg' }],
      entries: [],
      updatePathCover: mockUpdatePathCover,
    })

    const result = await applyImportedTrackCover({
      trackId: 'track-1',
      candidate: {
        id: 'c1',
        filename: 'new.webp',
        source: 'server',
        previewUrl: 'https://example.com/new.webp',
        serverUrl: 'https://example.com/new.webp',
      },
      isExplicitSelection: false,
      preserveExisting: true,
    })

    expect(result).toBe('track-cover-skipped-preserved')
    expect(mockUpdatePathCover).not.toHaveBeenCalled()
  })

  it('does not skip when isExplicitSelection is true (user chose manually)', async () => {
    const { useLearningPathStore } = await import('@/stores/useLearningPathStore')
    ;(useLearningPathStore as unknown as { getState: () => Record<string, unknown> }).getState = () => ({
      paths: [{ id: 'track-1', name: 'Test', coverImageUrl: 'https://existing.com/cover.jpg' }],
      entries: [],
      updatePathCover: mockUpdatePathCover,
    })

    // Explicit selection should attempt upload (it will fail because Supabase is mocked as null,
    // but the important part is that it doesn't short-circuit to 'skipped-preserved')
    const result = await applyImportedTrackCover({
      trackId: 'track-1',
      candidate: {
        id: 'c1',
        filename: 'new.webp',
        source: 'server',
        previewUrl: 'https://example.com/new.webp',
        serverUrl: 'https://example.com/new.webp',
      },
      isExplicitSelection: true,
      preserveExisting: true,
    })

    // Should NOT be 'track-cover-skipped-preserved' — it should have attempted upload
    expect(result).not.toBe('track-cover-skipped-preserved')
  })

  it('does not skip when existing track has no cover', async () => {
    const { useLearningPathStore } = await import('@/stores/useLearningPathStore')
    ;(useLearningPathStore as unknown as { getState: () => Record<string, unknown> }).getState = () => ({
      paths: [{ id: 'track-1', name: 'Test' }],
      entries: [],
      updatePathCover: mockUpdatePathCover,
    })

    const result = await applyImportedTrackCover({
      trackId: 'track-1',
      candidate: {
        id: 'c1',
        filename: 'new.webp',
        source: 'server',
        previewUrl: 'https://example.com/new.webp',
        serverUrl: 'https://example.com/new.webp',
      },
      isExplicitSelection: false,
      preserveExisting: true,
    })

    // Should NOT be 'track-cover-skipped-preserved' — track has no existing cover
    expect(result).not.toBe('track-cover-skipped-preserved')
  })
})
