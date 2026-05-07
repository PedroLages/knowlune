/**
 * useDownloadStore — Zustand store for reactive download state.
 *
 * Mirrors active download state at throttle rate (max 250ms update frequency).
 * Hydrated from Dexie on app mount via DownloadManager.initialize().
 *
 * @since offline-book-downloads (2026-05-07)
 */

import { create } from 'zustand'
import type { DownloadRecord, DownloadStatus } from '@/services/DownloadManager'

export interface PendingDownloadState {
  id: string
  bookId: string
  status: DownloadStatus
  progress: number
  totalSize: number
  opfsPath?: string
  checkpoint?: { byteOffset: number; etag?: string }
  error?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

interface DownloadStoreState {
  downloads: Map<string, PendingDownloadState>
  hydrated: boolean

  hydrate: (records: DownloadRecord[]) => void
  setHydrated: (val: boolean) => void
  setDownloadState: (bookId: string, patch: Partial<PendingDownloadState> & { status: DownloadStatus }) => void
  removeDownloadState: (bookId: string) => void
  hasActiveDownload: () => boolean
  getPendingDownload: () => PendingDownloadState | null
}

export const useDownloadStore = create<DownloadStoreState>((set, get) => ({
  downloads: new Map(),
  hydrated: false,

  hydrate: (records: DownloadRecord[]) => {
    const map = new Map<string, PendingDownloadState>()
    for (const rec of records) {
      map.set(rec.bookId, {
        id: rec.id,
        bookId: rec.bookId,
        status: rec.status,
        progress: rec.progress,
        totalSize: rec.totalSize,
        opfsPath: rec.opfsPath,
        checkpoint: rec.checkpoint,
        error: rec.error,
        retryCount: rec.retryCount,
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
      })
    }
    set({ downloads: map, hydrated: true })
  },

  setHydrated: (val: boolean) => set({ hydrated: val }),

  setDownloadState: (bookId: string, patch: Partial<PendingDownloadState> & { status: DownloadStatus }) => {
    const existing = get().downloads.get(bookId)
    const now = new Date().toISOString()
    const entry: PendingDownloadState = {
      id: existing?.id ?? crypto.randomUUID(),
      bookId,
      status: patch.status,
      progress: patch.progress ?? existing?.progress ?? 0,
      totalSize: patch.totalSize ?? existing?.totalSize ?? 0,
      opfsPath: patch.opfsPath ?? existing?.opfsPath,
      checkpoint: patch.checkpoint ?? existing?.checkpoint,
      error: patch.error ?? existing?.error,
      retryCount: patch.retryCount ?? existing?.retryCount ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    const next = new Map(get().downloads)
    next.set(bookId, entry)
    set({ downloads: next })
  },

  removeDownloadState: (bookId: string) => {
    const next = new Map(get().downloads)
    next.delete(bookId)
    set({ downloads: next })
  },

  hasActiveDownload: () => {
    for (const [, rec] of get().downloads) {
      if (rec.status === 'downloading' || rec.status === 'retrying') return true
    }
    return false
  },

  getPendingDownload: () => {
    for (const [, rec] of get().downloads) {
      if (rec.status === 'pending') return rec
    }
    return null
  },
}))

// Selector hooks for UI components
export function useDownloadState(bookId: string) {
  return useDownloadStore(s => s.downloads.get(bookId) ?? null)
}

export function useIsDownloaded(bookId: string): boolean {
  return useDownloadStore(s => s.downloads.get(bookId)?.status === 'downloaded')
}

export function useIsDownloading(bookId: string): boolean {
  const status = useDownloadStore(s => s.downloads.get(bookId)?.status)
  return status === 'downloading' || status === 'retrying' || status === 'pending'
}
