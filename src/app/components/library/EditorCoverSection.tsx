/**
 * Cover preview and upload section for the book metadata editor.
 *
 * Uses the same aspect ratio as the grid cards:
 *   audiobook → square (1:1)
 *   epub/pdf/mobi → portrait (2:3)
 *
 * @since E83-S05
 */

import { useEffect, useState, type RefObject } from 'react'
import { BookOpen, Headphones, Loader2, Search, Upload } from 'lucide-react'
import { Button } from '@/app/components/ui/button'

interface EditorCoverSectionProps {
  coverPreviewUrl: string | null
  title: string
  format: 'audiobook' | 'epub' | 'pdf' | 'mobi'
  isFetchingCover: boolean
  isSearching: boolean
  isSaving: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onSearchCovers: () => void
  onCoverUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function EditorCoverSection({
  coverPreviewUrl,
  title,
  format,
  isFetchingCover,
  isSearching,
  isSaving,
  fileInputRef,
  onSearchCovers,
  onCoverUpload,
}: EditorCoverSectionProps) {
  const [imgError, setImgError] = useState(false)
  useEffect(() => {
    setImgError(false)
  }, [coverPreviewUrl])
  const showImage = coverPreviewUrl && !imgError

  const isAudiobook = format === 'audiobook'
  // Match grid card exactly: square for audiobook, 2:3 portrait for others
  const aspectClass = isAudiobook ? 'aspect-square' : 'aspect-[2/3]'
  // Fixed width — right column takes remaining space for buttons
  const coverWidthClass = isAudiobook ? 'w-[140px]' : 'w-[100px]'
  const PlaceholderIcon = isAudiobook ? Headphones : BookOpen

  return (
    <div className="flex items-center gap-5">
      {/* Cover — format-matched aspect ratio */}
      <div className={`relative shrink-0 ${coverWidthClass}`}>
        <div className={`relative ${aspectClass} rounded-xl overflow-hidden`}>
          {showImage ? (
            <img
              src={coverPreviewUrl}
              alt={`Cover of ${title}`}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
              data-testid="editor-cover-preview"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <PlaceholderIcon className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
          {isFetchingCover && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </div>
          )}
        </div>
      </div>

      {/* Buttons — intrinsic width, vertically centered */}
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSearchCovers}
          disabled={isSearching || isFetchingCover || isSaving}
          data-testid="search-covers-button"
        >
          {isSearching ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="mr-2 h-3.5 w-3.5" />
          )}
          Search Covers &amp; Metadata
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSaving}
          data-testid="upload-cover-button"
        >
          <Upload className="mr-2 h-3.5 w-3.5" />
          Upload cover
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
