/**
 * OpdsCatalogSettings — dialog for managing OPDS catalog connections.
 *
 * Users can add, edit, test, and remove OPDS catalog URLs with optional
 * basic auth credentials. The "Test Connection" button validates the URL
 * is a valid OPDS (Atom/XML) feed before saving.
 *
 * @module OpdsCatalogSettings
 * @since E88-S01
 */

import { useCallback, useEffect, useState } from 'react'
import { Globe, Loader2, Pencil, Plus, Trash2, CheckCircle2, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Separator } from '@/app/components/ui/separator'
import { useOpdsCatalogStore } from '@/stores/useOpdsCatalogStore'
import { validateCatalog, type OpdsCatalogMeta } from '@/services/OpdsService'
import { toastSuccess } from '@/lib/toastHelpers'
import type { OpdsCatalog } from '@/data/types'

interface OpdsCatalogSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormMode = 'list' | 'add' | 'edit'

interface TestResult {
  ok: boolean
  message: string
  meta?: OpdsCatalogMeta
}

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
  const [testResult, setTestResult] = useState<TestResult | null>(null)

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
      // Auto-fill name if empty
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
      await updateCatalog(editingId, {
        name: name.trim(),
        url: url.trim(),
        auth,
      })
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-lg"
          aria-describedby="opds-catalog-settings-description"
          data-testid="opds-catalog-settings"
        >
          <DialogHeader>
            <DialogTitle>
              {mode === 'list' && 'OPDS Catalogs'}
              {mode === 'add' && 'Add Catalog'}
              {mode === 'edit' && 'Edit Catalog'}
            </DialogTitle>
            <DialogDescription id="opds-catalog-settings-description">
              {mode === 'list' && 'Connect to OPDS catalogs to browse and import books.'}
              {mode === 'add' && 'Enter the URL of an OPDS catalog to connect.'}
              {mode === 'edit' && 'Update catalog connection details.'}
            </DialogDescription>
          </DialogHeader>

          {mode === 'list' && (
            <div className="flex flex-col gap-4">
              {catalogs.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Globe className="size-12 text-muted-foreground/40" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">No catalogs connected yet.</p>
                  <p className="text-xs text-muted-foreground max-w-xs text-center">
                    Connect to a Calibre-Web or other OPDS-compatible server to browse your book
                    collection.
                  </p>
                </div>
              )}

              {catalogs.length > 0 && (
                <ul
                  className="flex flex-col divide-y divide-border/50"
                  role="list"
                  aria-label="Connected OPDS catalogs"
                >
                  {catalogs.map(catalog => (
                    <li
                      key={catalog.id}
                      className="flex items-center justify-between gap-3 py-3"
                      data-testid={`opds-catalog-item-${catalog.id}`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-foreground truncate">
                          {catalog.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">{catalog.url}</span>
                        {catalog.lastSynced && (
                          <span className="text-xs text-muted-foreground">
                            Last synced:{' '}
                            {new Date(catalog.lastSynced).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(catalog)}
                          className="size-9"
                          aria-label={`Edit ${catalog.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(catalog)}
                          className="size-9 text-destructive hover:text-destructive"
                          aria-label={`Remove ${catalog.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Separator />

              <Button
                variant="brand-outline"
                onClick={handleOpenAdd}
                className="min-h-[44px] w-full"
                data-testid="add-opds-catalog-btn"
              >
                <Plus className="mr-2 size-4" />
                Add Catalog
              </Button>
            </div>
          )}

          {(mode === 'add' || mode === 'edit') && (
            <form
              className="flex flex-col gap-4"
              onSubmit={e => {
                e.preventDefault()
                handleSave()
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="opds-name">Name</Label>
                <Input
                  id="opds-name"
                  placeholder="My Calibre Library"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                  data-testid="opds-name-input"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="opds-url">Catalog URL</Label>
                <Input
                  id="opds-url"
                  type="url"
                  placeholder="https://calibre.local/opds"
                  value={url}
                  onChange={e => {
                    setUrl(e.target.value)
                    setTestResult(null) // Reset test result when URL changes
                  }}
                  data-testid="opds-url-input"
                />
              </div>

              <Separator />

              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground select-none">
                  Authentication (optional)
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="opds-username">Username</Label>
                    <Input
                      id="opds-username"
                      placeholder="Username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      autoComplete="username"
                      data-testid="opds-username-input"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="opds-password">Password</Label>
                    <Input
                      id="opds-password"
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      data-testid="opds-password-input"
                    />
                  </div>
                </div>
              </details>

              {/* Test result */}
              {testResult && (
                <div
                  className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                    testResult.ok
                      ? 'bg-success-soft text-success-foreground'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                  role="status"
                  aria-live="polite"
                  data-testid="opds-test-result"
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="min-h-[44px]"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleTestConnection}
                  disabled={isTesting || !url.trim()}
                  className="min-h-[44px]"
                  data-testid="opds-test-btn"
                >
                  {isTesting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Test Connection
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  disabled={isSaving || !name.trim() || !url.trim()}
                  className="min-h-[44px] ml-auto"
                  data-testid="opds-save-btn"
                >
                  {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove &ldquo;{deleteTarget?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the catalog connection. Books already imported from this catalog will
              not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[44px]"
              data-testid="opds-confirm-delete-btn"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
