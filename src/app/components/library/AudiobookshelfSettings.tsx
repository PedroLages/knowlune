/**
 * AudiobookshelfSettings — dialog for managing Audiobookshelf server connections.
 *
 * Users can add, edit, test, and remove ABS server connections with API key auth.
 * The "Test Connection" button validates URL + API key against the ABS /api/ping
 * endpoint, then fetches libraries for the user to select which to sync.
 *
 * Sub-components (separate files):
 *   AudiobookshelfServerListView  — empty state + server list + Add button
 *   AudiobookshelfServerForm      — add/edit form with API key, HTTP warning, test result
 *   DeleteServerDialog            — confirmation alert dialog
 *
 * @module AudiobookshelfSettings
 * @since E101-S02
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { useAudiobookshelfStore } from '@/stores/useAudiobookshelfStore'
import { testConnection, fetchLibraries } from '@/services/AudiobookshelfService'
import { toastSuccess } from '@/lib/toastHelpers'
import type { AudiobookshelfServer } from '@/data/types'
import { AudiobookshelfServerListView } from './AudiobookshelfServerListView'
import { AudiobookshelfServerForm, type AbsFormTestResult } from './AudiobookshelfServerForm'
import { DeleteServerDialog } from './DeleteServerDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AudiobookshelfSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormMode = 'list' | 'add' | 'edit'

// ─── Main Component ───────────────────────────────────────────────────────────

export function AudiobookshelfSettings({ open, onOpenChange }: AudiobookshelfSettingsProps) {
  const servers = useAudiobookshelfStore(s => s.servers)
  const loadServers = useAudiobookshelfStore(s => s.loadServers)
  const addServer = useAudiobookshelfStore(s => s.addServer)
  const updateServer = useAudiobookshelfStore(s => s.updateServer)
  const removeServer = useAudiobookshelfStore(s => s.removeServer)

  const [mode, setMode] = useState<FormMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([])

  // Test connection state
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<AbsFormTestResult | null>(null)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AudiobookshelfServer | null>(null)

  // Track existing API key for edit mode (so we only update if user types a new one)
  const [existingApiKey, setExistingApiKey] = useState<string>('')

  useEffect(() => {
    if (open) {
      loadServers()
    }
  }, [open, loadServers])

  const resetForm = useCallback(() => {
    setName('')
    setUrl('')
    setApiKey('')
    setSelectedLibraryIds([])
    setTestResult(null)
    setEditingId(null)
    setExistingApiKey('')
    setIsTesting(false)
    setIsSaving(false)
  }, [])

  const handleOpenAdd = useCallback(() => {
    resetForm()
    setMode('add')
  }, [resetForm])

  const handleOpenEdit = useCallback(
    (server: AudiobookshelfServer) => {
      resetForm()
      setEditingId(server.id)
      setName(server.name)
      setUrl(server.url)
      setApiKey('') // Never pre-fill raw API key — show placeholder
      setExistingApiKey(server.apiKey)
      setSelectedLibraryIds(server.libraryIds)
      setMode('edit')
    },
    [resetForm]
  )

  const handleBack = useCallback(() => {
    resetForm()
    setMode('list')
  }, [resetForm])

  const handleTestConnection = useCallback(async () => {
    const effectiveApiKey = apiKey.trim() || existingApiKey
    if (!url.trim()) {
      setTestResult({ ok: false, message: 'Please enter a server URL.' })
      return
    }
    if (!effectiveApiKey) {
      setTestResult({ ok: false, message: 'Please enter an API key.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    // 1. Test connection to verify URL + API key
    const connResult = await testConnection(url.trim(), effectiveApiKey)
    if (!connResult.ok) {
      setTestResult({ ok: false, message: connResult.error })
      setIsTesting(false)
      return
    }

    // 2. Fetch libraries so user can select which to sync
    const libResult = await fetchLibraries(url.trim(), effectiveApiKey)
    if (!libResult.ok) {
      setTestResult({
        ok: true,
        message: `Connected — ABS v${connResult.data.serverVersion}. Could not fetch libraries.`,
      })
      setIsTesting(false)
      return
    }

    const libCount = libResult.data.length
    const libNames = libResult.data.map(l => l.name).join(', ')
    setTestResult({
      ok: true,
      message: `Connected — v${connResult.data.serverVersion} · ${libCount === 1 ? libNames : `${libCount} libraries: ${libNames}`}`,
      libraries: libResult.data,
    })

    // Auto-select all libraries if none were previously selected
    setSelectedLibraryIds(prev => (prev.length === 0 ? libResult.data.map(lib => lib.id) : prev))

    setIsTesting(false)
  }, [url, apiKey, existingApiKey])

  const handleLibraryToggle = useCallback((libraryId: string) => {
    setSelectedLibraryIds(prev =>
      prev.includes(libraryId) ? prev.filter(id => id !== libraryId) : [...prev, libraryId]
    )
  }, [])

  const handleSave = useCallback(async () => {
    if (!url.trim()) {
      setTestResult({ ok: false, message: 'Please enter a server URL.' })
      return
    }

    setIsSaving(true)
    const effectiveApiKey = apiKey.trim() || existingApiKey
    const now = new Date().toISOString()

    try {
      if (mode === 'edit' && editingId) {
        const updates: Partial<Omit<AudiobookshelfServer, 'id'>> = {
          name: name.trim() || url.trim(),
          url: url.trim(),
          libraryIds: selectedLibraryIds,
          status: 'connected',
          updatedAt: now,
        }
        // Only update API key if user typed a new one
        if (apiKey.trim()) {
          updates.apiKey = apiKey.trim()
        }
        await updateServer(editingId, updates)
        toastSuccess.saved('Server updated')
      } else {
        const newServer: AudiobookshelfServer = {
          id: crypto.randomUUID(),
          name: name.trim() || url.trim(),
          url: url.trim(),
          apiKey: effectiveApiKey,
          libraryIds: selectedLibraryIds,
          status: 'connected',
          lastSyncedAt: undefined,
          createdAt: now,
          updatedAt: now,
        }
        await addServer(newServer)
        toastSuccess.saved('Server added')
      }

      resetForm()
      setMode('list')
    } catch {
      // silent-catch-ok — store already shows toast.error; stay on form so user can retry
    } finally {
      setIsSaving(false)
    }
  }, [
    name,
    url,
    apiKey,
    existingApiKey,
    selectedLibraryIds,
    mode,
    editingId,
    addServer,
    updateServer,
    resetForm,
  ])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    await removeServer(deleteTarget.id)
    setDeleteTarget(null)
    toastSuccess.saved('Server removed')
  }, [deleteTarget, removeServer])

  const dialogTitle =
    mode === 'list' ? 'Audiobookshelf Servers' : mode === 'add' ? 'Add Server' : 'Edit Server'
  const dialogDescription =
    mode === 'list'
      ? 'Connect to Audiobookshelf servers to browse and sync audiobooks.'
      : mode === 'add'
        ? 'Enter your Audiobookshelf server URL and API key.'
        : 'Update server connection details.'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-lg"
          aria-describedby="abs-settings-description"
          data-testid="abs-settings"
        >
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription id="abs-settings-description">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto">
            {mode === 'add' || mode === 'edit' ? (
              <AudiobookshelfServerForm
                name={name}
                url={url}
                apiKey={apiKey}
                selectedLibraryIds={selectedLibraryIds}
                isTesting={isTesting}
                isSaving={isSaving}
                testResult={testResult}
                isEditMode={mode === 'edit'}
                onNameChange={setName}
                onUrlChange={v => {
                  setUrl(v)
                  setTestResult(null)
                }}
                onApiKeyChange={v => {
                  setApiKey(v)
                  setTestResult(null)
                }}
                onLibraryToggle={handleLibraryToggle}
                onTest={handleTestConnection}
                onSave={handleSave}
                onBack={handleBack}
              />
            ) : (
              <AudiobookshelfServerListView
                servers={servers}
                onAdd={handleOpenAdd}
                onEdit={handleOpenEdit}
                onDelete={setDeleteTarget}
                onReauthenticate={handleOpenEdit}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteServerDialog
        target={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
