import { useState, useRef } from 'react'
import { Upload, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarImage, AvatarFallback } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'

interface AvatarUploadZoneProps {
  currentAvatar: string | null
  onFileSelect: (file: File) => void
  onRemove: () => void
  isLoading?: boolean
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function AvatarUploadZone({
  currentAvatar,
  onFileSelect,
  onRemove,
  isLoading = false,
}: AvatarUploadZoneProps) {
  const [dragState, setDragState] = useState({
    isDragOver: false,
    dragDepth: 0,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    // Check file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Please upload a JPEG, PNG, or WebP image.')
      return false
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File is too large. Maximum size is 5MB.')
      return false
    }

    return true
  }

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      onFileSelect(file)
    }
  }

  // Track nested drag events to handle child elements properly
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragState(prev => ({
      isDragOver: true,
      dragDepth: prev.dragDepth + 1,
    }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragState(prev => {
      const newDepth = prev.dragDepth - 1
      return {
        isDragOver: newDepth > 0,
        dragDepth: newDepth,
      }
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragState({ isDragOver: false, dragDepth: 0 })

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    } else {
      toast.error('No file detected. Please try again.')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      {/* Avatar Preview */}
      <Avatar className="w-24 h-24 md:w-32 md:h-32 ring-2 ring-border">
        <AvatarImage src={currentAvatar || undefined} alt="Profile photo" />
        <AvatarFallback>
          <Upload className="w-8 h-8 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      {/* Drop Zone */}
      <div className="flex-1 w-full">
        <div
          role="button"
          tabIndex={isLoading ? -1 : 0}
          aria-label="Upload profile photo. Drag and drop or click to browse."
          aria-disabled={isLoading}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          onKeyDown={handleKeyDown}
          className={cn(
            'border-2 border-dashed rounded-[24px] p-4 md:p-6',
            'transition-all duration-200 min-h-[120px] md:min-h-[160px]',
            isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            dragState.isDragOver
              ? 'border-brand bg-brand-soft scale-[1.02]'
              : 'border-border bg-background hover:border-brand-hover hover:shadow-sm'
          )}
        >
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Upload
              className={cn(
                'w-8 h-8 transition-colors',
                dragState.isDragOver ? 'text-brand' : 'text-muted-foreground'
              )}
            />
            <p className="text-sm md:text-base text-foreground">
              {isLoading ? 'Uploading...' : 'Drag and drop your photo here'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Please wait' : 'or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Max 5MB • JPEG, PNG, or WebP</p>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInputChange}
          disabled={isLoading}
          className="hidden"
          aria-hidden="true"
        />

        {/* Remove button */}
        {currentAvatar && !isLoading && (
          <Button variant="outline" size="sm" onClick={onRemove} className="mt-3 w-full md:w-auto">
            <Trash2 className="w-4 h-4" />
            Remove Photo
          </Button>
        )}
      </div>
    </div>
  )
}
