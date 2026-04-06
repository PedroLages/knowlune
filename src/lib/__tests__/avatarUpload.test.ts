import { describe, it, expect } from 'vitest'
import {
  validateImageFile,
  getAvatarColor,
  getDefaultCropRegion,
  blobToFile,
  fileToDataUrl,
  compressAvatar,
  MAX_FILE_SIZE,
  MAX_COMPRESSED_SIZE,
  AVATAR_DIMENSIONS,
  SUPPORTED_FORMATS,
  OUTPUT_FORMAT,
  MIN_QUALITY,
  QUALITY_STEP,
  INITIAL_QUALITY,
} from '@/lib/avatarUpload'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(type: string, sizeBytes: number, name = 'test.jpg'): File {
  const buffer = new ArrayBuffer(sizeBytes)
  return new File([buffer], name, { type })
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('MAX_FILE_SIZE is 5MB', () => {
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024)
  })

  it('MAX_COMPRESSED_SIZE is 500KB', () => {
    expect(MAX_COMPRESSED_SIZE).toBe(500 * 1024)
  })

  it('AVATAR_DIMENSIONS is 256', () => {
    expect(AVATAR_DIMENSIONS).toBe(256)
  })

  it('SUPPORTED_FORMATS includes jpeg, png, webp', () => {
    expect(SUPPORTED_FORMATS).toContain('image/jpeg')
    expect(SUPPORTED_FORMATS).toContain('image/png')
    expect(SUPPORTED_FORMATS).toContain('image/webp')
  })

  it('OUTPUT_FORMAT is webp', () => {
    expect(OUTPUT_FORMAT).toBe('image/webp')
  })

  it('INITIAL_QUALITY is 0.75', () => {
    expect(INITIAL_QUALITY).toBe(0.75)
  })

  it('MIN_QUALITY is 0.4', () => {
    expect(MIN_QUALITY).toBe(0.4)
  })

  it('QUALITY_STEP is 0.05', () => {
    expect(QUALITY_STEP).toBe(0.05)
  })
})

// ---------------------------------------------------------------------------
// validateImageFile
// ---------------------------------------------------------------------------

describe('validateImageFile', () => {
  it('accepts valid JPEG file', () => {
    const file = makeFile('image/jpeg', 1024)
    const result = validateImageFile(file)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts valid PNG file', () => {
    const file = makeFile('image/png', 1024)
    expect(validateImageFile(file).valid).toBe(true)
  })

  it('accepts valid WebP file', () => {
    const file = makeFile('image/webp', 1024)
    expect(validateImageFile(file).valid).toBe(true)
  })

  it('rejects unsupported format (GIF)', () => {
    const file = makeFile('image/gif', 1024)
    const result = validateImageFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Unsupported format')
  })

  it('rejects unsupported format (BMP)', () => {
    const file = makeFile('image/bmp', 1024)
    expect(validateImageFile(file).valid).toBe(false)
  })

  it('rejects file exceeding MAX_FILE_SIZE', () => {
    const file = makeFile('image/jpeg', MAX_FILE_SIZE + 1)
    const result = validateImageFile(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('exceeds maximum')
  })

  it('accepts file exactly at MAX_FILE_SIZE', () => {
    const file = makeFile('image/jpeg', MAX_FILE_SIZE)
    expect(validateImageFile(file).valid).toBe(true)
  })

  it('error message includes file size in MB', () => {
    const file = makeFile('image/jpeg', 10 * 1024 * 1024)
    const result = validateImageFile(file)
    expect(result.error).toContain('10.0MB')
  })
})

// ---------------------------------------------------------------------------
// getAvatarColor
// ---------------------------------------------------------------------------

describe('getAvatarColor', () => {
  it('returns a hex color string', () => {
    const color = getAvatarColor('Alice')
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('is deterministic — same name returns same color', () => {
    expect(getAvatarColor('Bob')).toBe(getAvatarColor('Bob'))
  })

  it('different names can produce different colors', () => {
    // Not guaranteed for all pairs, but likely for these
    const colors = new Set(['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'].map(getAvatarColor))
    expect(colors.size).toBeGreaterThan(1)
  })

  it('handles empty string without throwing', () => {
    expect(() => getAvatarColor('')).not.toThrow()
    expect(getAvatarColor('')).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})

// ---------------------------------------------------------------------------
// getDefaultCropRegion
// ---------------------------------------------------------------------------

describe('getDefaultCropRegion', () => {
  it('returns centered square for landscape image', () => {
    const crop = getDefaultCropRegion(800, 400)
    expect(crop.width).toBe(400)
    expect(crop.height).toBe(400)
    expect(crop.x).toBe(200)
    expect(crop.y).toBe(0)
  })

  it('returns centered square for portrait image', () => {
    const crop = getDefaultCropRegion(400, 800)
    expect(crop.width).toBe(400)
    expect(crop.height).toBe(400)
    expect(crop.x).toBe(0)
    expect(crop.y).toBe(200)
  })

  it('returns full region for square image', () => {
    const crop = getDefaultCropRegion(500, 500)
    expect(crop.width).toBe(500)
    expect(crop.height).toBe(500)
    expect(crop.x).toBe(0)
    expect(crop.y).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// blobToFile
// ---------------------------------------------------------------------------

describe('blobToFile', () => {
  it('creates File from Blob with correct name and type', () => {
    const blob = new Blob(['data'], { type: 'image/webp' })
    const file = blobToFile(blob, 'avatar.webp')
    expect(file.name).toBe('avatar.webp')
    expect(file.type).toBe('image/webp')
    expect(file.size).toBe(blob.size)
  })
})

// ---------------------------------------------------------------------------
// fileToDataUrl
// ---------------------------------------------------------------------------

describe('fileToDataUrl', () => {
  it('converts a file to a data URL string', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' })
    const url = await fileToDataUrl(file)
    expect(url).toMatch(/^data:text\/plain;base64,/)
  })

  it('converts a blob to a data URL string', async () => {
    const blob = new Blob(['content'], { type: 'application/octet-stream' })
    const url = await fileToDataUrl(blob)
    expect(url).toMatch(/^data:/)
  })
})

// ---------------------------------------------------------------------------
// compressAvatar (validation layer only — canvas/image require real browser)
// ---------------------------------------------------------------------------

describe('compressAvatar', () => {
  it('throws for unsupported format', async () => {
    const file = makeFile('image/gif', 1024)
    await expect(compressAvatar(file)).rejects.toThrow('Unsupported format')
  })

  it('throws for file exceeding size limit', async () => {
    const file = makeFile('image/jpeg', MAX_FILE_SIZE + 1)
    await expect(compressAvatar(file)).rejects.toThrow('exceeds maximum')
  })
})
