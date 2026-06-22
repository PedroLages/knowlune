// E77B-S01: Drive Folder Browser
// Folder picker UI: shows Drive root, user navigates into folders, selects a course folder.
// Premium-gated via PremiumGate in ImportWizardDialog — the button that opens this dialog
// is wrapped in <PremiumGate>, so non-premium users never reach this component.

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import {
  Loader2,
  Folder,
  File,
  FolderOpen,
  ChevronRight,
  Search,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import {
  listFolder,
  isSupportedForImport,
  type DriveFile,
  type DriveFolderBrowserResult,
} from '@/lib/googleDriveFileService'
import { hasDriveReadScope, requestDriveReadScope } from '@/lib/googleDriveToken'

// ── Types ──────────────────────────────────────────────────────

interface DriveFolderBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFolderSelected: (result: DriveFolderBrowserResult) => void
}

type BrowserStep = 'check-scope' | 'browse' | 'confirm'

// ── Component ──────────────────────────────────────────────────

export function DriveFolderBrowser({
  open,
  onOpenChange,
  onFolderSelected,
}: DriveFolderBrowserProps) {
  const [step, setStep] = useState<BrowserStep>('check-scope')
  const [hasScope, setHasScope] = useState<boolean | null>(null)
  const [scopeCheckLoading, setScopeCheckLoading] = useState(true)
  const [currentFolderId, setCurrentFolderId] = useState('root')
  const [items, setItems] = useState<DriveFile[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([
    { id: 'root', name: 'My Drive' },
  ])
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // Verify drive.readonly scope on open
  useEffect(() => {
    if (!open) return

    let ignore = false

    setStep('check-scope')
    setScopeCheckLoading(true)
    setError(null)

    hasDriveReadScope()
      .then(granted => {
        if (ignore) return
        setHasScope(granted)
        if (granted) {
          setStep('browse')
          loadFolderContents('root')
        }
      })
      .catch(() => {
        if (ignore) return
        setHasScope(false)
      })
      .finally(() => {
        if (ignore) return
        setScopeCheckLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [open])

  const handleGrantScope = useCallback(async () => {
    setScopeCheckLoading(true)
    try {
      await requestDriveReadScope()
      // OAuth redirect — no return
    } catch {
      setError('Failed to start Google authentication. Please try again.')
      setScopeCheckLoading(false)
    }
  }, [])

  const loadFolderContents = useCallback(async (folderId: string) => {
    setLoading(true)
    setError(null)
    setSelectedFolder(null)

    try {
      const result = await listFolder(folderId)

      if (!result.ok) {
        setError(result.error)
        return
      }

      const sorted = sortDriveItems(result.data.files)
      setItems(sorted)
    } catch {
      setError('Failed to load folder contents.')
    } finally {
      setLoading(false)
    }
  }, [])

  const navigateToFolder = useCallback(
    (folderId: string, folderName: string) => {
      setCurrentFolderId(folderId)

      // Update breadcrumbs
      setBreadcrumbs(prev => {
        const idx = prev.findIndex(b => b.id === folderId)
        if (idx >= 0) {
          return prev.slice(0, idx + 1)
        }
        return [...prev, { id: folderId, name: folderName }]
      })

      loadFolderContents(folderId)
    },
    [loadFolderContents]
  )

  const navigateToBreadcrumb = useCallback(
    (index: number) => {
      const target = breadcrumbs[index]
      if (!target) return

      setCurrentFolderId(target.id)
      setBreadcrumbs(prev => prev.slice(0, index + 1))
      loadFolderContents(target.id)
    },
    [breadcrumbs, loadFolderContents]
  )

  const handleFolderClick = useCallback(
    (item: DriveFile) => {
      if (item.mimeType !== 'application/vnd.google-apps.folder') return
      navigateToFolder(item.id, item.name)
    },
    [navigateToFolder]
  )

  const handleRefresh = useCallback(() => {
    loadFolderContents(currentFolderId)
  }, [currentFolderId, loadFolderContents])

  const handleFolderSelect = useCallback((folderId: string) => {
    setSelectedFolder(prev => (prev === folderId ? null : folderId))
  }, [])

  const handleConfirmSelection = useCallback(async () => {
    if (!selectedFolder) return

    const selectedItem = items.find(i => i.id === selectedFolder)
    const folderName = selectedItem?.name ?? 'Selected Folder'
    const files = items.filter(
      i => i.mimeType !== 'application/vnd.google-apps.folder' && isSupportedForImport(i.mimeType)
    )

    // Append sub-folder files if we want a deeper scan — for now, use top-level files only
    onFolderSelected({
      folderId: selectedFolder,
      folderName,
      files,
    })

    onOpenChange(false)
  }, [selectedFolder, items, onFolderSelected, onOpenChange])

  const handleClose = useCallback(() => {
    setStep('check-scope')
    setHasScope(null)
    setScopeCheckLoading(true)
    setCurrentFolderId('root')
    setItems([])
    setBreadcrumbs([{ id: 'root', name: 'My Drive' }])
    setSelectedFolder(null)
    setLoading(false)
    setError(null)
    setSearchQuery('')
    onOpenChange(false)
  }, [onOpenChange])

  // Filter items by search query
  const filteredItems = searchQuery.trim()
    ? items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : items

  const selectedFolderData = selectedFolder ? items.find(i => i.id === selectedFolder) : null

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const list = filteredItems
      if (list.length === 0) return

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setFocusedIndex(prev => {
            const next = prev < 0 ? 0 : Math.min(prev + 1, list.length - 1)
            const el = document.querySelector<HTMLElement>(
              `[data-testid="drive-item-${list[next].id}"]`
            )
            el?.scrollIntoView({ block: 'nearest' })
            return next
          })
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setFocusedIndex(prev => {
            const next = prev <= 0 ? list.length - 1 : prev - 1
            const el = document.querySelector<HTMLElement>(
              `[data-testid="drive-item-${list[next].id}"]`
            )
            el?.scrollIntoView({ block: 'nearest' })
            return next
          })
          break
        }
        case 'Enter': {
          e.preventDefault()
          const idx = focusedIndex >= 0 ? focusedIndex : 0
          const item = list[idx]
          if (!item) return
          if (item.mimeType === 'application/vnd.google-apps.folder') {
            handleFolderClick(item)
          } else {
            handleFolderSelect(item.id)
          }
          break
        }
      }
    },
    [filteredItems, focusedIndex, handleFolderClick, handleFolderSelect]
  )

  // Reset focused index when items change
  useEffect(() => {
    setFocusedIndex(-1)
  }, [filteredItems])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-2xl max-h-[80vh] flex flex-col"
        aria-describedby="drive-folder-browser-description"
        data-testid="drive-folder-browser"
      >
        <DialogHeader>
          <DialogTitle>Import from Google Drive</DialogTitle>
          <DialogDescription id="drive-folder-browser-description">
            Browse your Google Drive and select a course folder to import.
          </DialogDescription>
        </DialogHeader>

        {/* Step: Check Scope */}
        {step === 'check-scope' && (
          <div className="flex flex-col items-center gap-4 py-8">
            {scopeCheckLoading ? (
              <div className="flex flex-col items-center gap-3" data-testid="drive-scope-checking">
                <Loader2 className="size-8 text-brand animate-spin" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Checking Google Drive access...</p>
              </div>
            ) : hasScope ? (
              <div className="flex flex-col items-center gap-3" data-testid="drive-scope-granted">
                <FolderOpen className="size-8 text-success" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">Google Drive access granted.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4" data-testid="drive-scope-required">
                <div className="rounded-full bg-warning/10 p-3">
                  <AlertTriangle className="size-6 text-warning" aria-hidden="true" />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                  <p className="text-sm font-medium">Google Drive Read Access Required</p>
                  <p className="text-xs text-muted-foreground">
                    To browse your Google Drive folders, Knowlune needs read-only access to your
                    Drive. You'll be redirected to Google to grant this permission.
                  </p>
                </div>
                {error && (
                  <p className="text-xs text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  variant="brand"
                  onClick={handleGrantScope}
                  disabled={scopeCheckLoading}
                  data-testid="drive-grant-scope-btn"
                  className="rounded-xl"
                >
                  {scopeCheckLoading ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    'Grant Access'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step: Browse */}
        {step === 'browse' && (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* Breadcrumb navigation */}
            <nav
              className="flex items-center gap-1 text-sm overflow-x-auto pb-1"
              data-testid="drive-breadcrumbs"
              aria-label="Folder breadcrumbs"
            >
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.id} className="flex items-center gap-1 shrink-0">
                  {index > 0 && (
                    <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />
                  )}
                  {index < breadcrumbs.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => navigateToBreadcrumb(index)}
                      className="text-brand hover:underline truncate max-w-[120px]"
                      aria-label={`Go to ${crumb.name}`}
                    >
                      {crumb.name}
                    </button>
                  ) : (
                    <span className="font-medium truncate max-w-[150px]" aria-current="page">
                      {crumb.name}
                    </span>
                  )}
                </span>
              ))}
            </nav>

            {/* Search */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter files and folders..."
                className="pl-9 rounded-xl"
                aria-label="Filter Drive contents"
                data-testid="drive-search-input"
              />
            </div>

            {/* Folder contents */}
            <div
              className="flex-1 overflow-y-auto border border-border rounded-xl min-h-[200px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-testid="drive-file-list"
              role="listbox"
              aria-label="Drive files and folders"
              aria-multiselectable={false}
              aria-live="polite"
              aria-activedescendant={
                focusedIndex >= 0 && filteredItems[focusedIndex]
                  ? `drive-item-${filteredItems[focusedIndex].id}`
                  : undefined
              }
              onKeyDown={handleListKeyDown}
              tabIndex={0}
            >
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 text-brand animate-spin" aria-hidden="true" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    className="rounded-xl"
                    data-testid="drive-retry-btn"
                  >
                    <RefreshCw className="size-3.5 mr-1.5" aria-hidden="true" />
                    Retry
                  </Button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-2 py-12"
                  data-testid="drive-empty-folder"
                >
                  <FolderOpen className="size-8 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery.trim() ? 'No files match your search.' : 'This folder is empty.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredItems.map((item, index) => {
                    const isFolder = item.mimeType === 'application/vnd.google-apps.folder'
                    const isSelected = selectedFolder === item.id
                    const isFocused = focusedIndex === index
                    const supported = isFolder || isSupportedForImport(item.mimeType)

                    if (isFolder) {
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                            isSelected ? 'bg-brand-soft/40' : 'hover:bg-muted/50'
                          } ${isFocused ? 'bg-muted/30' : ''}`}
                          onClick={() => handleFolderClick(item)}
                          role="option"
                          aria-selected={isSelected}
                          tabIndex={-1}
                          data-testid={`drive-item-${item.id}`}
                        >
                          <Folder className="size-5 shrink-0 text-brand" aria-hidden="true" />
                          <span className="flex-1 text-sm truncate">{item.name}</span>
                          {isSelected && (
                            <span className="text-xs text-brand font-medium">Selected</span>
                          )}
                        </div>
                      )
                    }

                    if (!supported) return null

                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-brand-soft/40' : 'hover:bg-muted/50'
                        } ${isFocused ? 'bg-muted/30' : ''}`}
                        onClick={() => handleFolderSelect(item.id)}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={-1}
                        data-testid={`drive-item-${item.id}`}
                      >
                        <File
                          className="size-5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-sm truncate">{item.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatFileSize(item.size)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedFolderData && (
              <p className="text-xs text-muted-foreground" data-testid="drive-selected-folder">
                Selected: {selectedFolderData.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="rounded-xl"
              data-testid="drive-cancel-btn"
            >
              Cancel
            </Button>
            {step === 'browse' && (
              <Button
                variant="brand"
                onClick={handleConfirmSelection}
                disabled={!selectedFolder || loading}
                className="rounded-xl"
                data-testid="drive-confirm-btn"
              >
                Select Folder
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Helpers ────────────────────────────────────────────────────

/** Sort folders first, then alphabetical. */
function sortDriveItems(items: DriveFile[]): DriveFile[] {
  return [...items].sort((a, b) => {
    const aIsFolder = a.mimeType === 'application/vnd.google-apps.folder'
    const bIsFolder = b.mimeType === 'application/vnd.google-apps.folder'
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1
    return a.name.localeCompare(b.name)
  })
}

/** Format file size in human-readable format. */
function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
