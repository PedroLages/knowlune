import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { Upload, Trash2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'
import { Label } from '@/app/components/ui/label'
import { Separator } from '@/app/components/ui/separator'
import { cn } from '@/app/components/ui/utils'
import { uploadPathCover, deletePathCover } from '@/lib/pathCoverUpload'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { GRADIENT_PRESETS } from '@/data/pathCoverGradients'
import type { LearningPath } from '@/data/types'

interface PathCoverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  path: LearningPath
  triggerRef?: React.RefObject<HTMLElement | null>
}

export function PathCoverDialog({ open, onOpenChange, path, triggerRef }: PathCoverDialogProps) {
  const updatePathCover = useLearningPathStore(s => s.updatePathCover)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Blob URL from `URL.createObjectURL` — must be revoked when replaced or cleared */
  const objectPreviewUrlRef = useRef<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(path.coverPreset ?? null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const hasExistingCover = !!path.coverImageUrl
  const isBusy = isUploading || isRemoving

  const revokeObjectPreview = useCallback(() => {
    if (objectPreviewUrlRef.current) {
      URL.revokeObjectURL(objectPreviewUrlRef.current)
      objectPreviewUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (objectPreviewUrlRef.current) {
        URL.revokeObjectURL(objectPreviewUrlRef.current)
        objectPreviewUrlRef.current = null
      }
    }
  }, [])

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (open: boolean) => {
      // Prevent dismiss while upload or remove is in progress
      if (!open && isBusy) return
      if (!open) {
        revokeObjectPreview()
        setSelectedPreset(path.coverPreset ?? null)
        setUploadPreview(null)
        setUploadFile(null)
        setIsUploading(false)
        setIsRemoving(false)
        // Restore focus to the trigger element (R9) — use rAF for reliable timing
        requestAnimationFrame(() => triggerRef?.current?.focus())
      }
      onOpenChange(open)
    },
    [onOpenChange, path.coverPreset, isBusy, triggerRef, revokeObjectPreview]
  )

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Unsupported format. Use JPEG, PNG, or WebP.')
      return
    }

    revokeObjectPreview()
    const url = URL.createObjectURL(file)
    objectPreviewUrlRef.current = url
    setUploadPreview(url)
    setUploadFile(file)
    setSelectedPreset(null)
  }, [revokeObjectPreview])

  const handleSave = useCallback(async () => {
    setIsUploading(true)
    try {
      if (uploadFile) {
        // Upload new cover image to Supabase Storage
        const publicUrl = await uploadPathCover(uploadFile, path.id)
        await updatePathCover(path.id, {
          coverImageUrl: publicUrl,
          coverPreset: undefined,
        })
        toast.success('Cover image updated')
      } else if (selectedPreset) {
        // Set gradient preset only
        await updatePathCover(path.id, {
          coverImageUrl: undefined,
          coverPreset: selectedPreset,
        })
        toast.success('Cover preset updated')
      }

      handleOpenChange(false)
    } catch (error) {
      // silent-catch-ok: store already handles errors
      toast.error(error instanceof Error ? error.message : 'Failed to update cover')
    } finally {
      setIsUploading(false)
    }
  }, [uploadFile, selectedPreset, path.id, updatePathCover, handleOpenChange])

  const handleRemove = useCallback(async () => {
    setIsRemoving(true)
    const prevCoverUrl = path.coverImageUrl
    try {
      // Update store first so a failed storage delete does not leave state
      // referencing a cover that was already removed from the bucket.
      await updatePathCover(path.id, {
        coverImageUrl: undefined,
        coverPreset: undefined,
      })
      if (prevCoverUrl) {
        // deletePathCover handles all errors internally (non-fatal cleanup).
        // The store has already been updated above, so a storage delete
        // failure does not leave stale state in the UI.
        await deletePathCover(path.id)
      }
      toast.success('Cover removed')
      handleOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove cover')
    } finally {
      setIsRemoving(false)
    }
  }, [path.id, path.coverImageUrl, path.coverPreset, updatePathCover, handleOpenChange])

  const canSave = selectedPreset || uploadFile

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(85vh,calc(100dvh-2rem))] min-h-0 flex-col gap-4 sm:max-w-md">
        <DialogHeader className="shrink-0 text-center sm:text-left">
          <DialogTitle>Change Cover</DialogTitle>
          <DialogDescription>
            Choose a gradient preset or upload your own image for {path.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain">
          {/* Upload section */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upload Image
            </Label>
            <Separator className="mb-3 mt-2" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Choose a cover image file"
            />
            {uploadPreview ? (
              <div className="relative rounded-xl overflow-hidden bg-muted aspect-video">
                <img
                  src={uploadPreview}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-8 bg-black/30 hover:bg-black/50 text-white rounded-full"
                  onClick={() => {
                    revokeObjectPreview()
                    setUploadPreview(null)
                    setUploadFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  aria-label="Remove uploaded image"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-20 border-2 border-dashed rounded-xl gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">Choose image file</span>
              </Button>
            )}
          </div>

          {/* Gradient presets */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gradient Presets
            </Label>
            <Separator className="mb-3 mt-2" />
            <div className="grid grid-cols-4 gap-2">
              {GRADIENT_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  className={cn(
                    'aspect-video rounded-lg bg-gradient-to-br transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                    preset.from,
                    preset.to,
                    selectedPreset === preset.key
                      ? 'ring-2 ring-inset ring-brand'
                      : 'hover:scale-[1.02]'
                  )}
                  onClick={() => {
                    revokeObjectPreview()
                    setUploadPreview(null)
                    setUploadFile(null)
                    setSelectedPreset(preset.key)
                  }}
                  aria-label={`${preset.label} gradient`}
                  aria-pressed={selectedPreset === preset.key}
                />
              ))}
            </div>
          </div>

          {/* Current cover preview — shown when path has a custom image */}
          {hasExistingCover && !uploadPreview && !selectedPreset && (
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Cover
              </Label>
              <Separator className="mb-3 mt-2" />
              <div className="relative rounded-xl overflow-hidden bg-muted aspect-video">
                <img
                  src={path.coverImageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Remove / reset section */}
          {(hasExistingCover || path.coverPreset) && (
            <>
              <Separator />
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
                onClick={handleRemove}
                disabled={isBusy}
              >
                <Trash2 className="size-4 mr-2" aria-hidden="true" />
                {isRemoving ? 'Removing...' : 'Remove Cover'}
              </Button>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="brand" onClick={handleSave} disabled={!canSave || isBusy}>
            {isUploading ? 'Uploading...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
