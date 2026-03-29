import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'
import { Upload, Loader2 } from 'lucide-react'

/** Recursively reads all files from a dropped directory entry */
async function readEntriesRecursively(entry: FileSystemDirectoryEntry): Promise<File[]> {
  const files: File[] = []
  const reader = entry.createReader()

  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject))

  // readEntries returns batches of up to 100 entries — must loop until empty
  let batch: FileSystemEntry[]
  do {
    batch = await readBatch()
    for (const child of batch) {
      if (child.isFile) {
        const file = await new Promise<File>((resolve, reject) =>
          (child as FileSystemFileEntry).file(resolve, reject)
        )
        files.push(file)
      } else if (child.isDirectory) {
        const subFiles = await readEntriesRecursively(child as FileSystemDirectoryEntry)
        files.push(...subFiles)
      }
    }
  } while (batch.length > 0)

  return files
}

/** Extracts all files from a drop event, recursing into dropped directories */
async function extractFilesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items
  const files: File[] = []
  const directoryEntries: FileSystemDirectoryEntry[] = []

  // Check for directory entries via webkitGetAsEntry
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.()
    if (entry?.isDirectory) {
      directoryEntries.push(entry as FileSystemDirectoryEntry)
    } else if (entry?.isFile) {
      const file = dataTransfer.files[i]
      if (file) files.push(file)
    }
  }

  // If directories were dropped, recursively extract their files
  if (directoryEntries.length > 0) {
    for (const dir of directoryEntries) {
      const dirFiles = await readEntriesRecursively(dir)
      files.push(...dirFiles)
    }
  }

  // Fallback: if webkitGetAsEntry wasn't available, use dataTransfer.files
  if (files.length === 0 && directoryEntries.length === 0) {
    files.push(...Array.from(dataTransfer.files))
  }

  return files
}

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
  const [isExtracting, setIsExtracting] = useState(false)
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

      if (disabled || isExtracting) return

      setIsExtracting(true)
      // Extract files asynchronously — handles both individual files and dropped folders
      extractFilesFromDrop(e.dataTransfer)
        .then(droppedFiles => {
          if (droppedFiles.length > 0) {
            onFilesDropped(droppedFiles)
          }
        })
        .finally(() => setIsExtracting(false))
    },
    [disabled, isExtracting, onFilesDropped]
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
        ${isExtracting ? 'border-brand bg-brand-soft/50 animate-pulse' : isDragOver ? 'border-brand bg-brand-soft/50' : 'border-muted-foreground/30 hover:border-brand/50'}
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
      {isExtracting ? (
        <Loader2 className="size-5 text-brand animate-spin" aria-hidden="true" />
      ) : (
        <Upload
          className={`size-5 ${isDragOver ? 'text-brand' : 'text-muted-foreground'}`}
          aria-hidden="true"
        />
      )}
      <p className="text-xs text-muted-foreground text-center">
        {isExtracting
          ? 'Reading folder contents\u2026'
          : isDragOver
            ? 'Drop files here'
            : 'Or drag & drop files here'}
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
