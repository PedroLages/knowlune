/**
 * Zustand store for course content server connections (E133-S01).
 *
 * Manages CourseServer CRUD with Dexie persistence. Routes every write
 * through `syncableWrite` so the server row participates in the Supabase
 * sync pipeline. Auth tokens travel separately through the vault-credentials
 * broker — `authToken` is accepted as an out-of-band argument on `addServer` /
 * `updateServer` and never touches the Dexie row.
 *
 * Pattern: mirrors `useAudiobookshelfStore` (E101-S02 / E95-S05).
 *
 * @module useCourseServerStore
 * @since E133-S01
 */

import { create } from 'zustand'
import { toast } from 'sonner'
import type { CourseServer } from '@/data/types'
import { db } from '@/db/schema'
import { syncableWrite } from '@/lib/sync/syncableWrite'
import { verifyConnection } from '@/lib/courseServerService'
import {
  getCourseServerToken,
  invalidateCourseServerToken,
} from '@/lib/credentials/courseServerTokenResolver'
import { storeCredentialWithStatus, deleteCredential } from '@/lib/vaultCredentials'
import { emitTelemetry } from '@/lib/credentials/telemetry'

/**
 * Thrown by `addServer` / `updateServer` when the Vault write fails because
 * the user is not signed into Supabase. Callers (the Save handler) catch
 * this specifically to render an actionable "Sign in to save" toast without
 * writing an orphan Dexie row.
 */
export class VaultUnauthenticatedError extends Error {
  constructor(message = 'Sign in to save credentials') {
    super(message)
    this.name = 'VaultUnauthenticatedError'
  }
}

interface CourseServerStoreState {
  servers: CourseServer[]
  isLoaded: boolean

  loadServers: () => Promise<void>

  /**
   * Persist a new server. `authToken` is stored in Supabase Vault first;
   * on vault failure the Dexie row is NOT written (no partial state).
   */
  addServer: (server: CourseServer, authToken?: string) => Promise<void>

  /**
   * Update a server. Pass `authToken` ONLY when the credential is actually
   * changing; omit to preserve the existing vault entry.
   */
  updateServer: (
    id: string,
    updates: Partial<Omit<CourseServer, 'id'>>,
    authToken?: string
  ) => Promise<void>

  removeServer: (id: string) => Promise<void>

  getServerById: (id: string) => CourseServer | undefined

  /** Run a connectivity check against a server and update its status. */
  checkServerStatus: (serverId: string) => Promise<void>
}

export const useCourseServerStore = create<CourseServerStoreState>((set, get) => ({
  servers: [],
  isLoaded: false,

  loadServers: async () => {
    if (get().isLoaded) return
    try {
      const servers = await db.courseServers.toArray()
      set({ servers, isLoaded: true })
    } catch (err) {
      console.error('[CourseServerStore] Failed to load servers:', err)
      toast.error('Failed to load course servers.')
    }
  },

  addServer: async (server: CourseServer, authToken?: string) => {
    // Vault-first: if the vault write fails, do not write the metadata row.
    if (authToken) {
      const vaultResult = await storeCredentialWithStatus('cs-server', server.id, authToken)
      if (!vaultResult.ok) {
        if (vaultResult.reason === 'unauthenticated') {
          throw new VaultUnauthenticatedError()
        }
        toast.error('Could not save server auth token', {
          description: vaultResult.message ?? 'Vault write failed. Try again.',
        })
        throw new Error(vaultResult.message ?? 'Vault write failed')
      }
      invalidateCourseServerToken(server.id)
    }

    try {
      await syncableWrite(
        'courseServers',
        'add',
        server as unknown as Record<string, unknown> & { id: string }
      )
      set(state => ({ servers: [...state.servers, server] }))
    } catch (err) {
      if (authToken) {
        emitTelemetry('sync.vault.potential_orphan', {
          kind: 'cs-server',
          id: server.id,
          stage: 'add',
        })
      }
      console.error('[CourseServerStore] Failed to add server:', err)
      toast.error('Failed to save course server.')
      throw err
    }
  },

  updateServer: async (
    id: string,
    updates: Partial<Omit<CourseServer, 'id'>>,
    authToken?: string
  ) => {
    if (authToken !== undefined) {
      if (authToken) {
        const vaultResult = await storeCredentialWithStatus('cs-server', id, authToken)
        if (!vaultResult.ok) {
          if (vaultResult.reason === 'unauthenticated') {
            throw new VaultUnauthenticatedError()
          }
          toast.error('Could not save updated auth token', {
            description: vaultResult.message ?? 'Vault write failed.',
          })
          throw new Error(vaultResult.message ?? 'Vault write failed')
        }
        invalidateCourseServerToken(id)
      } else {
        // Empty string means remove the credential
        await deleteCredential('cs-server', id)
        invalidateCourseServerToken(id)
      }
    }

    try {
      const record = { ...updates, id } as unknown as Record<string, unknown> & { id: string }
      await syncableWrite('courseServers', 'put', record)
      set(state => ({
        servers: state.servers.map(s => (s.id === id ? { ...s, ...updates } : s)),
      }))
    } catch (err) {
      console.error('[CourseServerStore] Failed to update server:', err)
      toast.error('Failed to update course server.')
      throw err
    }
  },

  removeServer: async (id: string) => {
    try {
      await syncableWrite('courseServers', 'delete', id)
      await deleteCredential('cs-server', id)
      invalidateCourseServerToken(id)
      set(state => ({
        servers: state.servers.filter(s => s.id !== id),
      }))
    } catch (err) {
      console.error('[CourseServerStore] Failed to remove server:', err)
      toast.error('Failed to remove course server.')
      throw err
    }
  },

  getServerById: (id: string) => {
    return get().servers.find(s => s.id === id)
  },

  checkServerStatus: async (serverId: string) => {
    const server = get().servers.find(s => s.id === serverId)
    if (!server) return

    set(state => ({
      servers: state.servers.map(s =>
        s.id === serverId ? { ...s, status: 'unknown' as const } : s
      ),
    }))

    try {
      const token = await getCourseServerToken(serverId)
      const result = await verifyConnection(server.url, token)

      if (result.ok) {
        set(state => ({
          servers: state.servers.map(s =>
            s.id === serverId ? { ...s, status: 'connected' as const } : s
          ),
        }))
      } else if (result.status === 401 || result.status === 403) {
        set(state => ({
          servers: state.servers.map(s =>
            s.id === serverId ? { ...s, status: 'auth-failed' as const } : s
          ),
        }))
      } else {
        set(state => ({
          servers: state.servers.map(s =>
            s.id === serverId ? { ...s, status: 'offline' as const } : s
          ),
        }))
      }
    } catch {
      set(state => ({
        servers: state.servers.map(s =>
          s.id === serverId ? { ...s, status: 'offline' as const } : s
        ),
      }))
    }
  },
}))
