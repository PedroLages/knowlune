/**
 * Avatar upload and image processing utilities
 * Handles image validation, compression, and format conversion for user avatars
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Maximum allowed file size in bytes (5MB)
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * Maximum compressed file size in bytes (500KB)
 */
export const MAX_COMPRESSED_SIZE = 500 * 1024 // 500KB

/**
 * Target avatar dimensions (square)
 */
export const AVATAR_DIMENSIONS = 256

/**
 * Initial compression quality (0.0-1.0)
 */
export const INITIAL_QUALITY = 0.75

/**
 * Supported image formats for upload
 */
export const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Output format for compressed avatar
 */
export const OUTPUT_FORMAT = 'image/webp'

/**
 * Minimum quality threshold before giving up on compression
 */
export const MIN_QUALITY = 0.4

/**
 * Quality reduction step for iterative compression
 */
export const QUALITY_STEP = 0.05

// ============================================================================
// Types
// ============================================================================

/**
 * Result of image file validation
 */
export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Options for avatar compression
 */
export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: string
}

/**
 * Crop region coordinates
 */
export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates an image file against size and format requirements
 * @param file - The file to validate
 * @returns Validation result with error message if invalid
 */
export function validateImageFile(file: File): ValidationResult {
  // Check file type
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported format. Allowed formats: ${SUPPORTED_FORMATS.map(f => f.split('/')[1])
        .join(', ')
        .toUpperCase()}`,
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const maxMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)
    const fileMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File size (${fileMB}MB) exceeds maximum (${maxMB}MB)`,
    }
  }

  return { valid: true }
}

// ============================================================================
// Image Processing
// ============================================================================

/**
 * Loads an image file into a canvas and draws it centered at specified dimensions
 * Maintains aspect ratio with center crop
 * @param file - The image file to load
 * @param width - Target width in pixels
 * @param height - Target height in pixels
 * @returns Promise resolving to a canvas element with the drawn image
 */
export async function loadImageToCanvas(
  file: File,
  width: number = AVATAR_DIMENSIONS,
  height: number = AVATAR_DIMENSIONS
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = e => {
      const img = new Image()

      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas 2D context'))
          return
        }

        // Calculate dimensions for center crop
        const sourceAspect = img.width / img.height
        const targetAspect = width / height

        let sourceWidth: number
        let sourceHeight: number
        let sourceX: number
        let sourceY: number

        if (sourceAspect > targetAspect) {
          // Source is wider, crop horizontally
          sourceHeight = img.height
          sourceWidth = img.height * targetAspect
          sourceX = (img.width - sourceWidth) / 2
          sourceY = 0
        } else {
          // Source is taller, crop vertically
          sourceWidth = img.width
          sourceHeight = img.width / targetAspect
          sourceX = 0
          sourceY = (img.height - sourceHeight) / 2
        }

        // Draw cropped and resized image
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height)

        resolve(canvas)
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Converts a canvas to a Blob with specified format and quality
 * @param canvas - The canvas to convert
 * @param format - MIME type (default: image/webp)
 * @param quality - Compression quality 0.0-1.0 (default: 0.75)
 * @returns Promise resolving to a Blob
 */
export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string = OUTPUT_FORMAT,
  quality: number = INITIAL_QUALITY
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('Failed to convert canvas to blob'))
          return
        }
        resolve(blob)
      },
      format,
      quality
    )
  })
}

/**
 * Compresses an image file to WebP format with size constraints
 * Uses center crop to maintain aspect ratio at target dimensions
 * Iteratively reduces quality if compressed size exceeds maximum
 * @param file - The image file to compress
 * @param options - Optional compression configuration
 * @returns Promise resolving to a compressed Blob
 */
export async function compressAvatar(file: File, options: CompressionOptions = {}): Promise<Blob> {
  // Validate input file
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file')
  }

  const width = options.maxWidth || AVATAR_DIMENSIONS
  const height = options.maxHeight || AVATAR_DIMENSIONS
  const format = options.format || OUTPUT_FORMAT
  let quality = Math.min(options.quality || INITIAL_QUALITY, 1.0)

  // Load image to canvas with center crop
  const canvas = await loadImageToCanvas(file, width, height)

  // Iteratively compress until size is acceptable
  let blob = await canvasToBlob(canvas, format, quality)
  let attempts = 0
  const maxAttempts = 10

  while (blob.size > MAX_COMPRESSED_SIZE && quality > MIN_QUALITY && attempts < maxAttempts) {
    quality -= QUALITY_STEP
    quality = Math.max(quality, MIN_QUALITY)
    blob = await canvasToBlob(canvas, format, quality)
    attempts++
  }

  // If still too large, warn but return best effort
  if (blob.size > MAX_COMPRESSED_SIZE) {
    console.warn(
      `Avatar compressed to ${(blob.size / 1024).toFixed(1)}KB (target: ${(MAX_COMPRESSED_SIZE / 1024).toFixed(0)}KB). Quality reduced to ${(quality * 100).toFixed(0)}%`
    )
  }

  return blob
}

// ============================================================================
// File Conversion Helpers
// ============================================================================

/**
 * Converts a File or Blob to a data URL
 * Useful for image previews before upload
 * @param file - The file to convert
 * @returns Promise resolving to a data URL string
 */
export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = e => {
      const result = e.target?.result
      if (typeof result === 'string') {
        resolve(result)
      } else {
        reject(new Error('Failed to convert file to data URL'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Converts a Blob to a File object
 * Useful for creating form data with compressed images
 * @param blob - The blob to convert
 * @param filename - The filename to use
 * @returns A File object
 */
export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type })
}

/**
 * Generates a color for avatar fallback based on a name
 * Uses a deterministic algorithm to ensure same name always gets same color
 * @param name - The name to generate color for
 * @returns A hex color string
 */
export function getAvatarColor(name: string): string {
  // Deterministic color palette (10 pleasant colors)
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky
    '#F8B88B', // Peach
    '#52C4A0', // Green
  ]

  // Simple hash function
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

// ============================================================================
// Cropping Utilities
// ============================================================================

/**
 * Helper to load image from data URL
 * @param dataUrl - The data URL to load
 * @returns Promise resolving to an HTMLImageElement
 */
async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/**
 * Crops an image from a data URL using specified crop region
 * @param imageDataUrl - The source image as data URL
 * @param cropRegion - The region to crop
 * @returns Promise resolving to a WebP Blob
 */
export async function cropImage(imageDataUrl: string, cropRegion: CropRegion): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas 2D context')
  }

  // Load source image
  const img = await loadImage(imageDataUrl)

  // Set canvas to crop size
  canvas.width = cropRegion.width
  canvas.height = cropRegion.height

  // Draw cropped region
  ctx.drawImage(
    img,
    cropRegion.x,
    cropRegion.y,
    cropRegion.width,
    cropRegion.height, // Source
    0,
    0,
    cropRegion.width,
    cropRegion.height // Destination
  )

  // Convert to WebP blob
  return canvasToBlob(canvas, 'image/webp', 0.95)
}

/**
 * Calculates a default crop region centered on the image
 * Creates a square crop of the largest possible size
 * @param imageWidth - Width of the source image
 * @param imageHeight - Height of the source image
 * @returns A centered square crop region
 */
export function getDefaultCropRegion(imageWidth: number, imageHeight: number): CropRegion {
  const size = Math.min(imageWidth, imageHeight)
  return {
    x: (imageWidth - size) / 2,
    y: (imageHeight - size) / 2,
    width: size,
    height: size,
  }
}

// ============================================================================
// Export for convenience
// ============================================================================

/**
 * Combined avatar processing function
 * Validates, compresses, and converts to data URL in one call
 * @param file - The image file to process
 * @returns Promise resolving to { blob: Blob; dataUrl: string }
 */
export async function processAvatar(file: File): Promise<{
  blob: Blob
  dataUrl: string
}> {
  // Validate
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file')
  }

  // Compress
  const blob = await compressAvatar(file)

  // Create preview
  const dataUrl = await fileToDataUrl(blob)

  return { blob, dataUrl }
}
