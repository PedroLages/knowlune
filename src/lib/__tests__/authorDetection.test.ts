import { describe, it, expect } from 'vitest'
import { detectAuthorFromFolderName } from '@/lib/authorDetection'

describe('detectAuthorFromFolderName', () => {
  // Separator patterns
  it('detects author from " - " separator', () => {
    expect(detectAuthorFromFolderName('Chase Hughes - Behavioral Analysis')).toBe('Chase Hughes')
  })

  it('detects author from " — " (em-dash) separator', () => {
    expect(detectAuthorFromFolderName('John Doe — Advanced React')).toBe('John Doe')
  })

  it('detects author from " – " (en-dash) separator', () => {
    expect(detectAuthorFromFolderName('Jane Smith – Data Science')).toBe('Jane Smith')
  })

  // Only first separator is used (author is before it)
  it('uses only the first separator when multiple exist', () => {
    expect(detectAuthorFromFolderName('Bob Martin - Clean Code - Part 1')).toBe('Bob Martin')
  })

  // Trimming
  it('trims whitespace from detected author name', () => {
    expect(detectAuthorFromFolderName('  Chase Hughes  -  Course  ')).toBe('Chase Hughes')
  })

  // No match cases
  it('returns null for plain folder names', () => {
    expect(detectAuthorFromFolderName('my-videos')).toBeNull()
  })

  it('returns null for underscore-separated names', () => {
    expect(detectAuthorFromFolderName('course_files_2024')).toBeNull()
  })

  it('returns null for single word', () => {
    expect(detectAuthorFromFolderName('videos')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(detectAuthorFromFolderName('')).toBeNull()
  })

  // Edge cases
  it('returns null when left side of separator is empty', () => {
    expect(detectAuthorFromFolderName(' - Course Name')).toBeNull()
  })

  it('returns null when left side is only whitespace', () => {
    expect(detectAuthorFromFolderName('   - Course Name')).toBeNull()
  })

  // Name validation: author name should look like a person's name (2+ words, letters only)
  it('returns null when left side is a single word (likely a category, not a name)', () => {
    expect(detectAuthorFromFolderName('Programming - Advanced Topics')).toBeNull()
  })

  it('detects multi-word author names', () => {
    expect(detectAuthorFromFolderName('Robert C. Martin - Clean Architecture')).toBe(
      'Robert C. Martin'
    )
  })

  it('detects author names with periods and initials', () => {
    expect(detectAuthorFromFolderName('J.K. Rowling - Writing Masterclass')).toBe('J.K. Rowling')
  })

  // Parenthetical year/edition suffixes should not affect detection
  it('ignores parenthetical suffixes in folder name', () => {
    expect(detectAuthorFromFolderName('Chase Hughes - Six Minute X-Ray (2023)')).toBe(
      'Chase Hughes'
    )
  })
})
