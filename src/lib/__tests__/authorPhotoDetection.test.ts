import { describe, it, expect } from 'vitest'
import { scoreAuthorPhoto, detectAuthorPhoto } from '@/lib/authorDetection'
import type { ScannedImage } from '@/lib/courseImport'

/** Helper to create a ScannedImage with minimal fields for testing. */
function makeImage(filename: string, path?: string): ScannedImage {
  return {
    filename,
    path: path ?? filename,
    fileHandle: {} as FileSystemFileHandle,
  }
}

describe('scoreAuthorPhoto', () => {
  // --- Exact name matches ---
  it('scores 100 for "author.jpg" in root', () => {
    expect(scoreAuthorPhoto(makeImage('author.jpg'))).toBe(100)
  })

  it('scores 100 for "profile.png" in root', () => {
    expect(scoreAuthorPhoto(makeImage('profile.png'))).toBe(100)
  })

  it('scores 100 for "avatar.webp" in root', () => {
    expect(scoreAuthorPhoto(makeImage('avatar.webp'))).toBe(100)
  })

  it('scores 100 for "instructor.jpg" in root', () => {
    expect(scoreAuthorPhoto(makeImage('instructor.jpg'))).toBe(100)
  })

  it('scores 100 for "headshot.png" in root', () => {
    expect(scoreAuthorPhoto(makeImage('headshot.png'))).toBe(100)
  })

  it('scores 100 for "portrait.jpg" in root', () => {
    expect(scoreAuthorPhoto(makeImage('portrait.jpg'))).toBe(100)
  })

  it('is case-insensitive for exact names', () => {
    expect(scoreAuthorPhoto(makeImage('AUTHOR.JPG'))).toBe(100)
    expect(scoreAuthorPhoto(makeImage('Profile.PNG'))).toBe(100)
  })

  // --- Exact name in nested directory ---
  it('scores 60 for "author.jpg" in a non-author directory', () => {
    expect(scoreAuthorPhoto(makeImage('author.jpg', 'assets/author.jpg'))).toBe(60)
  })

  it('scores 60 for "profile.png" in images/', () => {
    expect(scoreAuthorPhoto(makeImage('profile.png', 'images/profile.png'))).toBe(60)
  })

  // --- Author directory ---
  it('scores 90 for exact name in an author directory', () => {
    expect(scoreAuthorPhoto(makeImage('photo.jpg', 'about/photo.jpg'))).toBe(90)
  })

  it('scores 90 for "author.png" in instructor/', () => {
    expect(scoreAuthorPhoto(makeImage('author.png', 'instructor/author.png'))).toBe(90)
  })

  it('scores 20 for generic image in an author directory', () => {
    expect(scoreAuthorPhoto(makeImage('image001.jpg', 'about/image001.jpg'))).toBe(20)
  })

  it('scores 20 for generic image in bio/', () => {
    expect(scoreAuthorPhoto(makeImage('cover.jpg', 'bio/cover.jpg'))).toBe(20)
  })

  // --- Partial name matches ---
  it('scores 40 for "author-photo.jpg" in root', () => {
    expect(scoreAuthorPhoto(makeImage('author-photo.jpg'))).toBe(40)
  })

  it('scores 40 for "profile_pic.png" in root', () => {
    expect(scoreAuthorPhoto(makeImage('profile_pic.png'))).toBe(40)
  })

  it('scores 70 for partial name in author directory', () => {
    expect(
      scoreAuthorPhoto(makeImage('author-photo.jpg', 'about/author-photo.jpg'))
    ).toBe(70)
  })

  // --- No match ---
  it('scores 0 for unrelated image in root', () => {
    expect(scoreAuthorPhoto(makeImage('cover.jpg'))).toBe(0)
  })

  it('scores 0 for generic image in generic directory', () => {
    expect(scoreAuthorPhoto(makeImage('image.jpg', 'assets/image.jpg'))).toBe(0)
  })

  it('scores 0 for course-related image', () => {
    expect(scoreAuthorPhoto(makeImage('thumbnail.png', 'resources/thumbnail.png'))).toBe(0)
  })
})

describe('detectAuthorPhoto', () => {
  it('returns null for empty image list', () => {
    expect(detectAuthorPhoto([])).toBeNull()
  })

  it('returns null for null/undefined input', () => {
    expect(detectAuthorPhoto(null as unknown as ScannedImage[])).toBeNull()
  })

  it('returns the highest-scoring candidate', () => {
    const images = [
      makeImage('cover.jpg'),           // 0
      makeImage('author-photo.jpg'),    // 40
      makeImage('author.jpg'),          // 100
      makeImage('thumbnail.png'),       // 0
    ]
    const result = detectAuthorPhoto(images)
    expect(result).not.toBeNull()
    expect(result!.filename).toBe('author.jpg')
  })

  it('returns null when no images match', () => {
    const images = [
      makeImage('cover.jpg'),
      makeImage('thumbnail.png'),
      makeImage('banner.gif'),
    ]
    expect(detectAuthorPhoto(images)).toBeNull()
  })

  it('prefers exact match over partial match', () => {
    const images = [
      makeImage('author-headshot.jpg'),  // 40
      makeImage('profile.png'),          // 100
    ]
    const result = detectAuthorPhoto(images)
    expect(result!.filename).toBe('profile.png')
  })

  it('prefers root exact match over directory exact match', () => {
    const images = [
      makeImage('avatar.jpg', 'images/avatar.jpg'),  // 60
      makeImage('instructor.png'),                      // 100
    ]
    const result = detectAuthorPhoto(images)
    expect(result!.filename).toBe('instructor.png')
  })

  it('returns the only matching candidate even with low score', () => {
    const images = [
      makeImage('cover.jpg'),                          // 0
      makeImage('slide.png', 'about/slide.png'),       // 20
    ]
    const result = detectAuthorPhoto(images)
    expect(result).not.toBeNull()
    expect(result!.filename).toBe('slide.png')
  })
})
