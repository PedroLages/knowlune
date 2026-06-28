/**
 * CourseServerSettings — Course content server management UI (E133-S01).
 *
 * Allows adding, editing, removing, and testing HTTP course file servers
 * (nginx instances serving course videos/PDFs). Each server's auth token
 * is stored in Supabase Vault, never in Dexie.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import { Server, Plus, Trash2, Wifi, WifiOff, RefreshCw, Key, ExternalLink } from 'lucide-react'
import { useCourseServerStore } from '@/stores/useCourseServerStore'
import type { CourseServer } from '@/data/types'
import { toast } from 'sonner'

const DEFAULT_SERVER_NAME = 'Unraid Academy'
const DEFAULT_SERVER_URL = 'http://192.168.2.200:8099'

/** Status indicator styling */
function StatusIndicator({ status }: { status: CourseServer['status'] }) {
  const config = {
    connected: { color: 'bg-success', label: 'Connected', Icon: Wifi },
    offline: { color: 'bg-destructive', label: 'Offline', Icon: WifiOff },
    'auth-failed': { color: 'bg-warning', label: 'Auth Failed', Icon: Key },
    unknown: { color: 'bg-muted-foreground/40', label: 'Unknown', Icon: RefreshCw },
  }[status]

  const Icon = config.Icon
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`inline-block size-2 rounded-full ${config.color}`} aria-hidden="true" />
      <Icon className="size-3" />
      {config.label}
    </span>
  )
}

export function CourseServerSettings() {
  const {
    servers,
    isLoaded,
    loadServers,
    addServer,
    updateServer,
    removeServer,
    checkServerStatus,
  } = useCourseServerStore()

  // Form state
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set())
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    loadServers()
  }, [loadServers])

  // Populate form when editing
  const editingServer = editingId ? servers.find(s => s.id === editingId) : null
  useEffect(() => {
    if (editingServer) {
      setName(editingServer.name)
      setUrl(editingServer.url)
      setAuthToken('')
    }
  }, [editingServer])

  const resetForm = useCallback(() => {
    setName('')
    setUrl('')
    setAuthToken('')
    setEditingId(null)
  }, [])

  const handleSave = async () => {
    if (!name.trim() || !url.trim()) {
      toast.error('Name and URL are required')
      return
    }
    setIsSaving(true)
    try {
      if (editingId) {
        const updates = { name: name.trim(), url: url.trim() }
        await updateServer(editingId, updates, authToken || undefined)
        toast.success('Server updated')
      } else {
        const server: CourseServer = {
          id: crypto.randomUUID(),
          name: name.trim(),
          url: url.trim(),
          status: 'unknown',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        await addServer(server, authToken || undefined)
        toast.success('Server added')
      }
      resetForm()
    } catch (err) {
      // Errors are already toasted by the store
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await removeServer(id)
      toast.success('Server removed')
      if (editingId === id) resetForm()
    } catch {
      // Errors already toasted by the store
    }
    setDeleteConfirmId(null)
  }

  const handleTestConnection = async (serverId: string) => {
    setCheckingIds(prev => new Set(prev).add(serverId))
    try {
      await checkServerStatus(serverId)
      // Brief delay for state to settle, then report status
      setTimeout(() => {
        const s = useCourseServerStore.getState().servers.find(s => s.id === serverId)
        if (s?.status === 'connected') {
          toast.success('Connection successful')
        } else if (s?.status === 'auth-failed') {
          toast.error('Authentication failed — check your token')
        } else {
          toast.error('Server unreachable')
        }
      }, 100)
    } finally {
      setCheckingIds(prev => {
        const next = new Set(prev)
        next.delete(serverId)
        return next
      })
    }
  }

  // Initial loading state
  if (!isLoaded) {
    return (
      <Card>
        <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-soft p-2">
              <Server className="size-5 text-brand" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-display">Course Content Servers</h2>
              <p className="text-sm text-muted-foreground mt-1">
                HTTP servers for direct course video and PDF access
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Server className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-display">Course Content Servers</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Serve course videos and PDFs via HTTP — no SMB mount needed
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Existing Servers */}
        {servers.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Saved Servers</h3>
            {servers.map(server => {
              const isChecking = checkingIds.has(server.id)

              return (
                <div
                  key={server.id}
                  className="rounded-xl border border-border bg-surface-elevated p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium truncate">{server.name}</h4>
                        <StatusIndicator status={server.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate font-mono">
                        {server.url}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-4 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleTestConnection(server.id)}
                        disabled={isChecking}
                        aria-label={`Test connection to ${server.name}`}
                      >
                        <RefreshCw className={`size-4 ${isChecking ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          resetForm()
                          setEditingId(server.id)
                        }}
                        aria-label={`Edit ${server.name}`}
                      >
                        <Server className="size-4" />
                      </Button>
                      <a
                        href={server.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center size-8 rounded-md hover:bg-accent hover:text-accent-foreground"
                        aria-label={`Open ${server.url} in new tab`}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                      <AlertDialog
                        open={deleteConfirmId === server.id}
                        onOpenChange={open => {
                          if (!open) setDeleteConfirmId(null)
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(server.id)}
                            aria-label={`Remove ${server.name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove server?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove &quot;{server.name}&quot; and its auth token. Courses
                              imported from this server will need a new source to play.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(server.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add / Edit Form */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">{editingId ? 'Edit Server' : 'Add a Server'}</h3>
          <div className="rounded-xl border border-border bg-surface-elevated p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="server-name">Name</Label>
                <Input
                  id="server-name"
                  placeholder={DEFAULT_SERVER_NAME}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server-url">URL</Label>
                <Input
                  id="server-url"
                  placeholder={DEFAULT_SERVER_URL}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="min-h-[44px] font-mono text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-token">
                Auth Token <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="server-token"
                type="password"
                placeholder={
                  editingId ? 'Leave empty to keep current' : 'Bearer token for protected servers'
                }
                value={authToken}
                onChange={e => setAuthToken(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="brand"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !name.trim() || !url.trim()}
                className="gap-2 min-h-[44px]"
              >
                <Plus className="size-4" />
                {editingId ? 'Save Changes' : 'Add Server'}
              </Button>
              {editingId && (
                <Button variant="ghost" size="sm" onClick={resetForm} className="min-h-[44px]">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* No servers empty state */}
        {servers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No servers configured. Add one to import courses via URL.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
