import { useState, useRef, useCallback } from 'react'
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
import type { LearningPath } from '@/data/types'

/**
 * Gradient presets available for path covers.
 * Mirrors the PathCardHeader gradients but as named keys.
 */
const GRADIENT_PRESETS = [
  { key: 'cyan-blue', label: 'Cyan → Blue', from: 'from-cyan-400', to: 'to-blue-600' },
  { key: 'emerald-green', label: 'Emerald → Green', from: 'from-emerald-400', to: 'to-green-600' },
  { key: 'purple-indigo', label: 'Purple → Indigo', from: 'from-purple-500', to: 'to-indigo-700' },
  { key: 'orange-blue', label: 'Orange → Blue', from: 'from-orange-400', to: 'to-blue-500' },
  { key: 'pink-purple', label: 'Pink → Purple', from: 'from-pink-400', to: 'to-purple-600' },
  { key: 'amber-orange', label: 'Amber → Orange', from: 'from-amber-400', to: 'to-orange-600' },
  { key: 'teal-cyan', label: 'Teal → Cyan', from: 'from-teal-400', to: 'to-cyan-600' },
  { key: 'rose-red', label: 'Rose → Red', from: 'from-rose-400', to: 'to-red-600' },
] as const

interface PathCoverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  path: LearningPath
}

export function PathCoverDialog({ open, onOpenChange, path }: PathCoverDialogProps) {
  const updatePathCover = useLearningPathStore(s => s.updatePathCover)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(path.coverPreset ?? null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const hasExistingCover = !!path.coverImageUrl

  // Reset state when dialog opens
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedPreset(path.coverPreset ?? null)
        setUploadPreview(null)
        setUploadFile(null)
        setIsUploading(false)
        setIsRemoving(false)
      }
      onOpenChange(open)
    },
    [onOpenChange, path.coverPreset]
  )

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Unsupported format. Use JPEG, PNG, or WebP.')
      return
    }

    setUploadFile(file)
    setSelectedPreset(null)
    const url = URL.createObjectURL(file)
    setUploadPreview(url)
  }, [])

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
    const prevCoverPreset = path.coverPreset
    try {
      // Update store first so a failed storage delete does not leave state
      // referencing a cover that was already removed from the bucket.
      await updatePathCover(path.id, {
        coverImageUrl: undefined,
        coverPreset: undefined,
      })
      if (prevCoverUrl) {
        try {
          await deletePathCover(path.id)
        } catch {
          // Revert store update so state stays consistent with storage
          await updatePathCover(path.id, {
            coverImageUrl: prevCoverUrl,
            coverPreset: prevCoverPreset,
          })
          throw new Error('Failed to remove cover from storage')
        }
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
  const isBusy = isUploading || isRemoving

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
                    'aspect-video rounded-lg bg-gradient-to-br transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                    preset.from,
                    preset.to,
                    selectedPreset === preset.key
                      ? 'ring-2 ring-brand ring-offset-2 scale-105'
                      : 'hover:scale-105'
                  )}
                  onClick={() => {
                    setSelectedPreset(preset.key)
                    setUploadPreview(null)
                    setUploadFile(null)
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
