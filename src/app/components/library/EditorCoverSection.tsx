/**
 * Cover preview and upload section for the book metadata editor.
 *
 * Extracted from BookMetadataEditor to reduce component size.
 *
 * @since E83-S05
 */

import type { RefObject } from 'react'
import { BookOpen, Loader2, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface EditorCoverSectionProps {
  coverPreviewUrl: string | null
  title: string
  isFetchingCover: boolean
  isSaving: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onRefetchCover: () => void
  onCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function EditorCoverSection({
  coverPreviewUrl,
  title,
  isFetchingCover,
  isSaving,
  fileInputRef,
  onRefetchCover,
  onCoverUpload,
}: EditorCoverSectionProps) {
  return (
    <div className="flex gap-4">
      <div className="relative shrink-0">
        {coverPreviewUrl ? (
          <img
            src={coverPreviewUrl}
            alt={`Cover of ${title}`}
            className="h-32 w-24 rounded-lg object-cover"
            data-testid="editor-cover-preview"
          />
        ) : (
          <div className="flex h-32 w-24 items-center justify-center rounded-lg bg-muted">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {isFetchingCover && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onRefetchCover}
          disabled={isFetchingCover || isSaving}
          className="min-h-[44px]"
          data-testid="refetch-cover-button"
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Re-fetch from Open Library
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSaving}
          className="min-h-[44px]"
          data-testid="upload-cover-button"
        >
          <Upload className="mr-2 h-3.5 w-3.5" />
          Upload custom cover
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={onCoverUpload}
          data-testid="cover-file-input"
        />
      </div>
    </div>
  )
}
