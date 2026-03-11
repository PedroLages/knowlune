'use client'

import * as React from 'react'
import { cropImage, getDefaultCropRegion, type CropRegion } from '@/lib/avatarUpload'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'
import { Button } from '@/app/components/ui/button'

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum preview canvas size for smooth dragging (60fps target)
 */
const MAX_PREVIEW_SIZE = 1000

/**
 * Minimum crop size in pixels
 */
const MIN_CROP_SIZE = 50

/**
 * Resize handle size
 */
const HANDLE_SIZE_DESKTOP = 12
const HANDLE_SIZE_MOBILE = 24

/**
 * Keyboard step sizes
 */
const MOVE_STEP = 10
const RESIZE_STEP = 10

// ============================================================================
// Types
// ============================================================================

interface AvatarCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageDataUrl: string
  onCropConfirm: (croppedBlob: Blob) => void
  onCropCancel: () => void
}

type DragMode = 'none' | 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'

// ============================================================================
// Component
// ============================================================================

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageDataUrl,
  onCropConfirm,
  onCropCancel,
}: AvatarCropDialogProps) {
  // Canvas refs
  const previewCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const sourceCanvasRef = React.useRef<HTMLCanvasElement>(null)

  // State
  const [cropRegion, setCropRegion] = React.useState<CropRegion | null>(null)
  const [dragMode, setDragMode] = React.useState<DragMode>('none')
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 })
  const [initialCrop, setInitialCrop] = React.useState<CropRegion | null>(null)
  const [scaleFactor, setScaleFactor] = React.useState(1)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  // Detect mobile on mount
  React.useEffect(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  // Load image and initialize canvases
  React.useEffect(() => {
    if (!open || !imageDataUrl) return

    const loadImageAndInitialize = async () => {
      const img = new Image()
      img.onload = () => {
        // Initialize source canvas (full resolution)
        const sourceCanvas = sourceCanvasRef.current
        if (sourceCanvas) {
          sourceCanvas.width = img.width
          sourceCanvas.height = img.height
          const ctx = sourceCanvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0)
          }
        }

        // Calculate preview scale
        const scale = Math.min(MAX_PREVIEW_SIZE / img.width, MAX_PREVIEW_SIZE / img.height, 1)
        setScaleFactor(scale)

        // Initialize preview canvas (downsampled)
        const previewCanvas = previewCanvasRef.current
        if (previewCanvas) {
          const previewWidth = img.width * scale
          const previewHeight = img.height * scale
          previewCanvas.width = previewWidth
          previewCanvas.height = previewHeight
          const ctx = previewCanvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, previewWidth, previewHeight)
          }
        }

        // Set default crop region (preview coordinates)
        const defaultCrop = getDefaultCropRegion(img.width, img.height)
        setCropRegion({
          x: defaultCrop.x * scale,
          y: defaultCrop.y * scale,
          width: defaultCrop.width * scale,
          height: defaultCrop.height * scale,
        })
      }
      img.src = imageDataUrl
    }

    loadImageAndInitialize()
  }, [open, imageDataUrl])

  // Draw crop overlay
  React.useEffect(() => {
    if (!cropRegion) return

    const canvas = previewCanvasRef.current
    const sourceCanvas = sourceCanvasRef.current
    if (!canvas || !sourceCanvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Redraw source image
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height)

    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Clear crop region
    ctx.clearRect(cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height)
    ctx.drawImage(
      sourceCanvas,
      cropRegion.x / scaleFactor,
      cropRegion.y / scaleFactor,
      cropRegion.width / scaleFactor,
      cropRegion.height / scaleFactor,
      cropRegion.x,
      cropRegion.y,
      cropRegion.width,
      cropRegion.height
    )

    // Draw crop border
    ctx.strokeStyle = 'rgb(59 130 246)' // brand color
    ctx.lineWidth = 2
    ctx.strokeRect(cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height)

    // Draw resize handles
    const handleSize = isMobile ? HANDLE_SIZE_MOBILE : HANDLE_SIZE_DESKTOP
    const handles = [
      { x: cropRegion.x, y: cropRegion.y }, // nw
      { x: cropRegion.x + cropRegion.width, y: cropRegion.y }, // ne
      { x: cropRegion.x, y: cropRegion.y + cropRegion.height }, // sw
      { x: cropRegion.x + cropRegion.width, y: cropRegion.y + cropRegion.height }, // se
    ]

    handles.forEach(handle => {
      ctx.fillStyle = 'rgb(59 130 246)' // brand color
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      )
      // Ring effect
      ctx.strokeStyle = 'rgb(250 245 238)' // background color
      ctx.lineWidth = 2
      ctx.strokeRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      )
    })
  }, [cropRegion, scaleFactor, isMobile])

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cropRegion) return

    const canvas = previewCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const handleSize = isMobile ? HANDLE_SIZE_MOBILE : HANDLE_SIZE_DESKTOP
    const handles = [
      { mode: 'resize-nw' as DragMode, x: cropRegion.x, y: cropRegion.y },
      { mode: 'resize-ne' as DragMode, x: cropRegion.x + cropRegion.width, y: cropRegion.y },
      { mode: 'resize-sw' as DragMode, x: cropRegion.x, y: cropRegion.y + cropRegion.height },
      {
        mode: 'resize-se' as DragMode,
        x: cropRegion.x + cropRegion.width,
        y: cropRegion.y + cropRegion.height,
      },
    ]

    // Check handles
    for (const handle of handles) {
      if (
        Math.abs(x - handle.x) < handleSize / 2 + 5 &&
        Math.abs(y - handle.y) < handleSize / 2 + 5
      ) {
        setDragMode(handle.mode)
        setDragStart({ x, y })
        setInitialCrop({ ...cropRegion })
        return
      }
    }

    // Check if inside crop region (move mode)
    if (
      x >= cropRegion.x &&
      x <= cropRegion.x + cropRegion.width &&
      y >= cropRegion.y &&
      y <= cropRegion.y + cropRegion.height
    ) {
      setDragMode('move')
      setDragStart({ x, y })
      setInitialCrop({ ...cropRegion })
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragMode === 'none' || !initialCrop) return

    const canvas = previewCanvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const dx = x - dragStart.x
    const dy = y - dragStart.y

    let newCrop = { ...initialCrop }

    if (dragMode === 'move') {
      // Move crop region
      newCrop.x = Math.max(0, Math.min(canvas.width - newCrop.width, initialCrop.x + dx))
      newCrop.y = Math.max(0, Math.min(canvas.height - newCrop.height, initialCrop.y + dy))
    } else if (dragMode.startsWith('resize-')) {
      // Resize crop region
      if (dragMode === 'resize-nw') {
        newCrop.x = Math.min(initialCrop.x + initialCrop.width - MIN_CROP_SIZE, initialCrop.x + dx)
        newCrop.y = Math.min(initialCrop.y + initialCrop.height - MIN_CROP_SIZE, initialCrop.y + dy)
        newCrop.width = initialCrop.width - (newCrop.x - initialCrop.x)
        newCrop.height = initialCrop.height - (newCrop.y - initialCrop.y)
      } else if (dragMode === 'resize-ne') {
        newCrop.y = Math.min(initialCrop.y + initialCrop.height - MIN_CROP_SIZE, initialCrop.y + dy)
        newCrop.width = Math.max(MIN_CROP_SIZE, initialCrop.width + dx)
        newCrop.height = initialCrop.height - (newCrop.y - initialCrop.y)
      } else if (dragMode === 'resize-sw') {
        newCrop.x = Math.min(initialCrop.x + initialCrop.width - MIN_CROP_SIZE, initialCrop.x + dx)
        newCrop.width = initialCrop.width - (newCrop.x - initialCrop.x)
        newCrop.height = Math.max(MIN_CROP_SIZE, initialCrop.height + dy)
      } else if (dragMode === 'resize-se') {
        newCrop.width = Math.max(MIN_CROP_SIZE, initialCrop.width + dx)
        newCrop.height = Math.max(MIN_CROP_SIZE, initialCrop.height + dy)
      }

      // Ensure crop stays within bounds
      newCrop.width = Math.min(newCrop.width, canvas.width - newCrop.x)
      newCrop.height = Math.min(newCrop.height, canvas.height - newCrop.y)
    }

    setCropRegion(newCrop)
  }

  const handlePointerUp = () => {
    setDragMode('none')
    setInitialCrop(null)
  }

  // Keyboard handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!cropRegion) return

    const canvas = previewCanvasRef.current
    if (!canvas) return

    let newCrop = { ...cropRegion }
    let handled = false

    // Arrow keys - move
    if (e.key === 'ArrowLeft') {
      newCrop.x = Math.max(0, cropRegion.x - MOVE_STEP)
      handled = true
    } else if (e.key === 'ArrowRight') {
      newCrop.x = Math.min(canvas.width - cropRegion.width, cropRegion.x + MOVE_STEP)
      handled = true
    } else if (e.key === 'ArrowUp') {
      newCrop.y = Math.max(0, cropRegion.y - MOVE_STEP)
      handled = true
    } else if (e.key === 'ArrowDown') {
      newCrop.y = Math.min(canvas.height - cropRegion.height, cropRegion.y + MOVE_STEP)
      handled = true
    }
    // +/- keys - resize
    else if (e.key === '+' || e.key === '=') {
      const newSize = Math.min(
        cropRegion.width + RESIZE_STEP,
        canvas.width - cropRegion.x,
        canvas.height - cropRegion.y
      )
      newCrop.width = newSize
      newCrop.height = newSize
      handled = true
    } else if (e.key === '-' || e.key === '_') {
      const newSize = Math.max(MIN_CROP_SIZE, cropRegion.width - RESIZE_STEP)
      newCrop.width = newSize
      newCrop.height = newSize
      handled = true
    }
    // Enter - confirm
    else if (e.key === 'Enter') {
      handleConfirm()
      handled = true
    }
    // Escape - cancel
    else if (e.key === 'Escape') {
      handleCancel()
      handled = true
    }

    if (handled) {
      e.preventDefault()
      setCropRegion(newCrop)
    }
  }

  // Confirm handler
  const handleConfirm = async () => {
    if (!cropRegion) return

    setIsLoading(true)

    try {
      // Convert preview coordinates to source coordinates
      const sourceCrop: CropRegion = {
        x: cropRegion.x / scaleFactor,
        y: cropRegion.y / scaleFactor,
        width: cropRegion.width / scaleFactor,
        height: cropRegion.height / scaleFactor,
      }

      // Crop at full resolution
      const croppedBlob = await cropImage(imageDataUrl, sourceCrop)

      onCropConfirm(croppedBlob)
    } catch (error) {
      console.error('Failed to crop image:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Cancel handler
  const handleCancel = () => {
    onCropCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl rounded-[24px]"
        onKeyDown={handleKeyDown}
        onPointerDown={e => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Crop Avatar</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Canvas container */}
          <div className="flex items-center justify-center bg-muted rounded-xl p-4">
            <div className="relative">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-[60vh] touch-none cursor-move"
                style={{ touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              {/* Hidden source canvas */}
              <canvas ref={sourceCanvasRef} className="hidden" />
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground text-center">
            Drag to move • Resize with corners • Arrow keys to adjust
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Cropping...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
