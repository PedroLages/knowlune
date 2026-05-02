/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Vite query-suffix dynamic imports used in tests for mock variants
// (e.g., `import('../module?null-client')` returns a test-only variant).
declare module '*?null-client'

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // Add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// File System Access API types (Chrome 86+)
interface FileSystemHandle {
  readonly kind: 'file' | 'directory'
  readonly name: string
  isSameEntry(other: FileSystemHandle): Promise<boolean>
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file'
  getFile(): Promise<File>
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory'
  values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FileSystemDirectoryHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>
}

// Build-time constant injected by Vite define (see vite.config.ts)
declare const __APP_VERSION__: string

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
  showOpenFilePicker(options?: {
    multiple?: boolean
    excludeAcceptAllOption?: boolean
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }): Promise<FileSystemFileHandle[]>
}
