import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Upload } from 'lucide-react'

interface ImportDropZoneProps {
  /** Called with the dropped/selected files when the user provides files */
  onFilesDropped: (files: File[]) => void
  /** Whether file processing is in progress */
  disabled?: boolean
}

/**
 * Drop zone for drag-and-drop file import.
 * Provides an alternative to showDirectoryPicker() that can be automated in E2E tests.
 *
 * Includes a hidden file input (data-testid="import-file-input") for Playwright's
 * setInputFiles() API — the most reliable E2E automation path.
 *
 * Addresses KI-010: showDirectoryPicker() cannot be automated in Playwright.
 */
export function ImportDropZone({ onFilesDropped, disabled = false }: ImportDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        setIsDragOver(true)
      }
    },
    [disabled]
  )

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        setIsDragOver(true)
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (disabled) return

      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length > 0) {
        onFilesDropped(droppedFiles)
      }
    },
    [disabled, onFilesDropped]
  )

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files
      if (selectedFiles && selectedFiles.length > 0) {
        onFilesDropped(Array.from(selectedFiles))
      }
      // Reset input so the same files can be re-selected
      e.target.value = ''
    },
    [onFilesDropped]
  )

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }, [disabled])

  return (
    <div
      data-testid="import-drop-zone"
      role="button"
      tabIndex={0}
      aria-label="Drop course files here or click to browse"
      className={`
        flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4
        transition-colors cursor-pointer
        ${isDragOver ? 'border-brand bg-brand-soft/50' : 'border-muted-foreground/30 hover:border-brand/50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <Upload
        className={`size-5 ${isDragOver ? 'text-brand' : 'text-muted-foreground'}`}
        aria-hidden="true"
      />
      <p className="text-xs text-muted-foreground text-center">
        {isDragOver ? 'Drop files here' : 'Or drag & drop files here'}
      </p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp4,.mkv,.avi,.webm,.ts,.pdf"
        className="hidden"
        data-testid="import-file-input"
        onChange={handleFileInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
