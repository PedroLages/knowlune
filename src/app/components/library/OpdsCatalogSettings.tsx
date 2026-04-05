/**
 * OpdsCatalogSettings — dialog for managing OPDS catalog connections.
 *
 * Users can add, edit, test, and remove OPDS catalog URLs with optional
 * basic auth credentials. The "Test Connection" button validates the URL
 * is a valid OPDS (Atom/XML) feed before saving.
 *
 * Sub-components (separate files):
 *   CatalogListView      — empty state + catalog list + Add button
 *   CatalogForm          — add/edit form with auth, HTTP warning, and test result
 *   DeleteCatalogDialog  — confirmation alert dialog
 *
 * @module OpdsCatalogSettings
 * @since E88-S01
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import { useOpdsCatalogStore } from '@/stores/useOpdsCatalogStore'
import { validateCatalog } from '@/services/OpdsService'
import { toastSuccess } from '@/lib/toastHelpers'
import type { OpdsCatalog } from '@/data/types'
import { CatalogListView } from './CatalogListView'
import { CatalogForm, type CatalogFormTestResult } from './CatalogForm'
import { DeleteCatalogDialog } from './DeleteCatalogDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpdsCatalogSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormMode = 'list' | 'add' | 'edit'

// ─── Main Component ───────────────────────────────────────────────────────────

export function OpdsCatalogSettings({ open, onOpenChange }: OpdsCatalogSettingsProps) {
  const catalogs = useOpdsCatalogStore(s => s.catalogs)
  const loadCatalogs = useOpdsCatalogStore(s => s.loadCatalogs)
  const addCatalog = useOpdsCatalogStore(s => s.addCatalog)
  const updateCatalog = useOpdsCatalogStore(s => s.updateCatalog)
  const removeCatalog = useOpdsCatalogStore(s => s.removeCatalog)

  const [mode, setMode] = useState<FormMode>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Test connection state
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<CatalogFormTestResult | null>(null)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<OpdsCatalog | null>(null)

  useEffect(() => {
    if (open) {
      loadCatalogs()
    }
  }, [open, loadCatalogs])

  const resetForm = useCallback(() => {
    setName('')
    setUrl('')
    setUsername('')
    setPassword('')
    setTestResult(null)
    setEditingId(null)
    setIsTesting(false)
    setIsSaving(false)
  }, [])

  const handleOpenAdd = useCallback(() => {
    resetForm()
    setMode('add')
  }, [resetForm])

  const handleOpenEdit = useCallback(
    (catalog: OpdsCatalog) => {
      resetForm()
      setEditingId(catalog.id)
      setName(catalog.name)
      setUrl(catalog.url)
      setUsername(catalog.auth?.username ?? '')
      setPassword(catalog.auth?.password ?? '')
      setMode('edit')
    },
    [resetForm]
  )

  const handleBack = useCallback(() => {
    resetForm()
    setMode('list')
  }, [resetForm])

  const handleTestConnection = useCallback(async () => {
    if (!url.trim()) {
      setTestResult({ ok: false, message: 'Please enter a catalog URL.' })
      return
    }
    setIsTesting(true)
    setTestResult(null)

    const auth =
      username.trim() || password.trim()
        ? { username: username.trim(), password: password.trim() }
        : undefined

    const result = await validateCatalog(url.trim(), auth)

    if (result.ok) {
      setTestResult({
        ok: true,
        message: `Connected to "${result.meta.title}" (${result.meta.entryCount} entries)`,
        meta: result.meta,
      })
      if (!name.trim() && result.meta.title) {
        setName(result.meta.title)
      }
    } else {
      setTestResult({ ok: false, message: result.error })
    }

    setIsTesting(false)
  }, [url, username, password, name])

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setTestResult({ ok: false, message: 'Please enter a catalog name.' })
      return
    }
    if (!url.trim()) {
      setTestResult({ ok: false, message: 'Please enter a catalog URL.' })
      return
    }

    setIsSaving(true)
    const auth =
      username.trim() || password.trim()
        ? { username: username.trim(), password: password.trim() }
        : undefined

    if (mode === 'edit' && editingId) {
      await updateCatalog(editingId, { name: name.trim(), url: url.trim(), auth })
      toastSuccess.saved('Catalog updated')
    } else {
      const newCatalog: OpdsCatalog = {
        id: crypto.randomUUID(),
        name: name.trim(),
        url: url.trim(),
        auth,
        createdAt: new Date().toISOString(),
      }
      await addCatalog(newCatalog)
      toastSuccess.saved('Catalog added')
    }

    setIsSaving(false)
    resetForm()
    setMode('list')
  }, [name, url, username, password, mode, editingId, addCatalog, updateCatalog, resetForm])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    await removeCatalog(deleteTarget.id)
    setDeleteTarget(null)
    toastSuccess.saved('Catalog removed')
  }, [deleteTarget, removeCatalog])

  const dialogTitle =
    mode === 'list' ? 'OPDS Catalogs' : mode === 'add' ? 'Add Catalog' : 'Edit Catalog'
  const dialogDescription =
    mode === 'list'
      ? 'Connect to OPDS catalogs to browse and import books.'
      : mode === 'add'
        ? 'Enter the URL of an OPDS catalog to connect.'
        : 'Update catalog connection details.'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-lg"
          aria-describedby="opds-catalog-settings-description"
          data-testid="opds-catalog-settings"
        >
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription id="opds-catalog-settings-description">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>

          {mode === 'list' && (
            <CatalogListView
              catalogs={catalogs}
              onAdd={handleOpenAdd}
              onEdit={handleOpenEdit}
              onDelete={setDeleteTarget}
            />
          )}

          {(mode === 'add' || mode === 'edit') && (
            <CatalogForm
              name={name}
              url={url}
              username={username}
              password={password}
              isTesting={isTesting}
              isSaving={isSaving}
              testResult={testResult}
              onNameChange={setName}
              onUrlChange={v => {
                setUrl(v)
                setTestResult(null) // Reset test result when URL changes
              }}
              onUsernameChange={setUsername}
              onPasswordChange={setPassword}
              onTest={handleTestConnection}
              onSave={handleSave}
              onBack={handleBack}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteCatalogDialog
        target={deleteTarget}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
