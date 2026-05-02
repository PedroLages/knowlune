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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import {
  useAudiobookshelfStore,
  VaultUnauthenticatedError,
} from '@/stores/useAudiobookshelfStore'
import { toast } from 'sonner'
import { testConnection, fetchLibraries } from '@/services/AudiobookshelfService'
import { toastSuccess } from '@/lib/toastHelpers'
import type { AudiobookshelfServer } from '@/data/types'
import { checkCredential } from '@/lib/vaultCredentials'
import { getAbsApiKey } from '@/lib/credentials/absApiKeyResolver'
import { AudiobookshelfServerListView } from './AudiobookshelfServerListView'
import { AudiobookshelfServerForm, type AbsFormTestResult } from './AudiobookshelfServerForm'
import { DeleteServerDialog } from './DeleteServerDialog'
import { useMissingCredentials } from '@/app/hooks/useMissingCredentials'
import { useDeepLinkFocus } from '@/app/hooks/useDeepLinkFocus'

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

  // E97-S05 AC4: credential status for badge rendering
  const { statusByKey } = useMissingCredentials()

  // E97-S05 AC2: API key input ref for deep-link focus
  const apiKeyInputRef = useRef<HTMLInputElement>(null)

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

  // Track whether an existing API key is configured in the vault for the
  // server being edited. We never load the plaintext into form state — we
  // only ask "is a credential configured?" via checkCredential() so the UI
  // can surface "already configured" messaging and skip the re-entry
  // prompt when the user isn't rotating the key. When the user actually
  // submits "Test Connection" or "Save" without a new apiKey typed in, we
  // read the live credential once via getAbsApiKey and pass it to the ABS
  // API (never stored in React state).
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false)
  // Suppress unused-variable lint until the form passes this down for the
  // placeholder copy update — tracked as a follow-up polish item.
  void hasExistingApiKey

  useEffect(() => {
    if (open) {
      loadServers()
    }
  }, [open, loadServers])

  // Stable ref so useDeepLinkFocus's onFocus closure always calls the latest handleOpenEdit
  const handleOpenEditRef = useRef<(server: AudiobookshelfServer) => void>(() => {})

  // E97-S05 AC2: deep-link focus — opens edit form for the focused server and
  // focuses the API key input field.
  // Intentional: RAF hop required for dialog-mounted inputs.
  useDeepLinkFocus('abs', (id: string) => {
    const server = servers.find(s => s.id === id)
    if (!server) return
    handleOpenEditRef.current(server)
    requestAnimationFrame(() => {
      apiKeyInputRef.current?.focus()
    })
  })

  const resetForm = useCallback(() => {
    setName('')
    setUrl('')
    setApiKey('')
    setSelectedLibraryIds([])
    setTestResult(null)
    setEditingId(null)
    setHasExistingApiKey(false)
    setIsTesting(false)
    setIsSaving(false)
  }, [])

  const handleOpenAdd = useCallback(() => {
    resetForm()
    setMode('add')
  }, [])

  const handleOpenEdit = useCallback(
    (server: AudiobookshelfServer) => {
      resetForm()
      setEditingId(server.id)
      setName(server.name)
      setUrl(server.url)
      setApiKey('') // Never pre-fill raw API key — show placeholder
      setSelectedLibraryIds(server.libraryIds)
      setMode('edit')
      // Kick off a "configured?" probe so the UI can treat a blank apiKey
      // input as "keep existing" rather than "clear credential".
      checkCredential('abs-server', server.id)
        .then(configured => setHasExistingApiKey(configured))
        .catch(() => setHasExistingApiKey(false))
    },
    [resetForm]
  )

  // Keep the ref in sync with the latest handleOpenEdit (used by deep-link focus callback)
  useEffect(() => {
    handleOpenEditRef.current = handleOpenEdit
  }, [handleOpenEdit])

  const handleBack = useCallback(() => {
    resetForm()
    setMode('list')
  }, [resetForm])

  const handleTestConnection = useCallback(async () => {
    if (!url.trim()) {
      setTestResult({ ok: false, message: 'Please enter a server URL.' })
      return
    }
    // Resolve the effective apiKey: prefer the freshly typed value; otherwise
    // fall back to the stored vault credential for the server being edited.
    let effectiveApiKey = apiKey.trim()
    if (!effectiveApiKey && editingId) {
      effectiveApiKey = (await getAbsApiKey(editingId)) ?? ''
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
  }, [url, apiKey, editingId])

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
    const now = new Date().toISOString()

    try {
      if (mode === 'edit' && editingId) {
        const updates: Partial<Omit<AudiobookshelfServer, 'id'>> = {
          name: name.trim() || url.trim(),
          url: url.trim(),
          libraryIds: selectedLibraryIds,
          status: 'connected',
        }
        const nextApiKey = apiKey.trim() || undefined
        await updateServer(editingId, updates, nextApiKey)
        toastSuccess.saved('Server updated')
      } else {
        const typedApiKey = apiKey.trim()
        if (!typedApiKey) {
          setTestResult({ ok: false, message: 'Please enter an API key.' })
          setIsSaving(false)
          return
        }
        const newServer: AudiobookshelfServer = {
          id: crypto.randomUUID(),
          name: name.trim() || url.trim(),
          url: url.trim(),
          libraryIds: selectedLibraryIds,
          status: 'connected',
          lastSyncedAt: undefined,
          createdAt: now,
          updatedAt: now,
        }
        await addServer(newServer, typedApiKey)
        toastSuccess.saved('Server added')
      }

      resetForm()
      setMode('list')
    } catch (err) {
      // silent-catch-ok — store already shows a generic toast.error for non-
      // auth failures; we only add a targeted toast when the Vault write
      // failed because the user is not signed into Supabase (common root
      // cause of the misleading "API key missing" sync error).
      if (err instanceof VaultUnauthenticatedError) {
        setTestResult({
          ok: false,
          message: 'Sign in to save credentials. Audiobookshelf keys are stored in your account.',
        })
        toast.error('Sign in required to save credentials', {
          description:
            'Audiobookshelf API keys are stored in your Knowlune account. Sign in (top right) and try again.',
          duration: 8000,
        })
      }
    } finally {
      setIsSaving(false)
    }
  }, [name, url, apiKey, selectedLibraryIds, mode, editingId, addServer, updateServer, resetForm])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    await removeServer(deleteTarget.id)
    setDeleteTarget(null)
    toastSuccess.saved('Server removed')
  }, [deleteTarget, removeServer])

  // Dynamic dialog title and description based on mode
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
            <DialogDescription id="abs-settings-description">{dialogDescription}</DialogDescription>
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
                apiKeyInputRef={apiKeyInputRef}
              />
            ) : (
              <AudiobookshelfServerListView
                servers={servers}
                onAdd={handleOpenAdd}
                onEdit={handleOpenEdit}
                onDelete={setDeleteTarget}
                onReauthenticate={handleOpenEdit}
                statusByKey={statusByKey}
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
