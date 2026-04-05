/**
 * File API mock utilities for unit tests.
 *
 * Provides helpers for creating mock File and Blob objects that work in
 * jsdom/Vitest environments where the full File API is unavailable.
 *
 * @see Epic 88 retrospective — action item for audiobook/M4B test infrastructure
 */

/**
 * Create a mock File with the given content and metadata.
 */
export function createMockFile(
  content: string | ArrayBuffer | Uint8Array,
  name: string,
  options?: { type?: string; lastModified?: number }
): File {
  const blob =
    content instanceof ArrayBuffer || content instanceof Uint8Array
      ? new Blob([content], { type: options?.type })
      : new Blob([content], { type: options?.type ?? 'text/plain' })

  return new File([blob], name, {
    type: options?.type ?? blob.type,
    lastModified: options?.lastModified ?? Date.now(),
  })
}

/**
 * Create a mock M4B audiobook file (empty but valid for metadata parsing mocks).
 */
export function createMockM4bFile(
  name = 'audiobook.m4b',
  sizeKb = 100
): File {
  const buffer = new ArrayBuffer(sizeKb * 1024)
  return createMockFile(buffer, name, {
    type: 'audio/mp4',
  })
}

/**
 * Create a mock EPUB file.
 */
export function createMockEpubFile(
  name = 'book.epub',
  sizeKb = 50
): File {
  const buffer = new ArrayBuffer(sizeKb * 1024)
  return createMockFile(buffer, name, {
    type: 'application/epub+zip',
  })
}

/**
 * Create a mock MP3 file.
 */
export function createMockMp3File(
  name = 'chapter-01.mp3',
  sizeKb = 500
): File {
  const buffer = new ArrayBuffer(sizeKb * 1024)
  return createMockFile(buffer, name, {
    type: 'audio/mpeg',
  })
}

/**
 * Create a mock image file (for cover art testing).
 */
export function createMockImageFile(
  name = 'cover.jpg',
  sizeKb = 20
): File {
  const buffer = new ArrayBuffer(sizeKb * 1024)
  return createMockFile(buffer, name, {
    type: 'image/jpeg',
  })
}

/**
 * Create a FileList-like object from an array of Files.
 * jsdom's FileList constructor is not available, so we build a compatible object.
 */
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      for (const file of files) yield file
    },
  } as unknown as FileList

  files.forEach((file, i) => {
    Object.defineProperty(fileList, i, { value: file, enumerable: true })
  })

  return fileList
}

/**
 * Mock the Cache API for testing BookContentService caching behavior.
 * Returns a cleanup function to restore original caches.
 */
export function mockCacheApi(): {
  cache: Map<string, Response>
  cleanup: () => void
} {
  const cache = new Map<string, Response>()
  const originalCaches = globalThis.caches

  const mockCacheStorage = {
    open: async () => ({
      put: async (key: string, response: Response) => {
        cache.set(key, response.clone())
      },
      match: async (key: string) => {
        const cached = cache.get(key)
        return cached ? cached.clone() : undefined
      },
      delete: async (key: string) => cache.delete(key),
      keys: async () =>
        [...cache.keys()].map(
          (k) => new Request(k)
        ),
    }),
    delete: async () => true,
    has: async () => true,
    keys: async () => [],
    match: async () => undefined,
  } as unknown as CacheStorage

  Object.defineProperty(globalThis, 'caches', {
    value: mockCacheStorage,
    configurable: true,
    writable: true,
  })

  return {
    cache,
    cleanup: () => {
      Object.defineProperty(globalThis, 'caches', {
        value: originalCaches,
        configurable: true,
        writable: true,
      })
    },
  }
}
