/**
 * Unit Tests: youtubeUrlParser.ts
 *
 * Tests YouTube URL parsing for all supported formats:
 * - Standard watch URLs
 * - Short URLs (youtu.be)
 * - Embed URLs
 * - Shorts URLs
 * - Playlist URLs
 * - Videos within playlists
 * - Invalid URLs
 * - Multi-URL parsing
 */

import { describe, it, expect } from 'vitest'
import { parseYouTubeUrl, parseMultipleYouTubeUrls, isYouTubeUrl } from '@/lib/youtubeUrlParser'

describe('youtubeUrlParser.ts', () => {
  describe('parseYouTubeUrl', () => {
    it('parses standard watch URL', () => {
      const result = parseYouTubeUrl('https://youtube.com/watch?v=abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.type).toBe('video')
      expect(result.playlistId).toBeUndefined()
    })

    it('parses www.youtube.com watch URL', () => {
      const result = parseYouTubeUrl('https://www.youtube.com/watch?v=abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.type).toBe('video')
    })

    it('parses playlist URL', () => {
      const result = parseYouTubeUrl('https://youtube.com/playlist?list=PLxyz')
      expect(result.valid).toBe(true)
      expect(result.playlistId).toBe('PLxyz')
      expect(result.type).toBe('playlist')
      expect(result.videoId).toBeUndefined()
    })

    it('parses youtu.be short URL', () => {
      const result = parseYouTubeUrl('https://youtu.be/abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.type).toBe('video')
    })

    it('parses watch URL with both videoId and playlistId', () => {
      const result = parseYouTubeUrl('https://youtube.com/watch?v=abc123DEF_-&list=PLxyz')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.playlistId).toBe('PLxyz')
      expect(result.type).toBe('video-in-playlist')
    })

    it('parses embed URL', () => {
      const result = parseYouTubeUrl('https://youtube.com/embed/abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.type).toBe('embed')
    })

    it('parses youtube-nocookie.com embed URL', () => {
      const result = parseYouTubeUrl('https://youtube-nocookie.com/embed/abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.type).toBe('embed')
    })

    it('parses shorts URL', () => {
      const result = parseYouTubeUrl('https://youtube.com/shorts/abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.type).toBe('short')
    })

    it('parses music.youtube.com URL', () => {
      const result = parseYouTubeUrl('https://music.youtube.com/watch?v=abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.type).toBe('video')
    })

    it('parses m.youtube.com mobile URL', () => {
      const result = parseYouTubeUrl('https://m.youtube.com/watch?v=abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
    })

    it('parses live URL', () => {
      const result = parseYouTubeUrl('https://youtube.com/live/abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.type).toBe('video')
    })

    it('handles HTTP (not HTTPS) URLs', () => {
      const result = parseYouTubeUrl('http://youtube.com/watch?v=abc123DEF_-')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
    })

    it('returns invalid for non-YouTube URL', () => {
      const result = parseYouTubeUrl('https://example.com')
      expect(result.valid).toBe(false)
      expect(result.videoId).toBeUndefined()
      expect(result.playlistId).toBeUndefined()
    })

    it('returns invalid for empty string', () => {
      const result = parseYouTubeUrl('')
      expect(result.valid).toBe(false)
    })

    it('returns invalid for malformed URL', () => {
      const result = parseYouTubeUrl('not-a-url')
      expect(result.valid).toBe(false)
    })

    it('returns invalid for YouTube URL with no video or playlist ID', () => {
      const result = parseYouTubeUrl('https://youtube.com/about')
      expect(result.valid).toBe(false)
    })

    it('returns invalid for ftp protocol', () => {
      const result = parseYouTubeUrl('ftp://youtube.com/watch?v=abc123DEF_-')
      expect(result.valid).toBe(false)
    })

    it('trims whitespace from URL', () => {
      const result = parseYouTubeUrl('  https://youtube.com/watch?v=abc123DEF_-  ')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
    })

    it('preserves original URL in result', () => {
      const url = 'https://youtube.com/watch?v=abc123DEF_-'
      const result = parseYouTubeUrl(url)
      expect(result.originalUrl).toBe(url)
    })

    it('handles youtu.be with list parameter', () => {
      const result = parseYouTubeUrl('https://youtu.be/abc123DEF_-?list=PLtest123')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('abc123DEF_-')
      expect(result.playlistId).toBe('PLtest123')
      expect(result.type).toBe('video-in-playlist')
    })
  })

  describe('parseMultipleYouTubeUrls', () => {
    it('parses multiple URLs, one per line', () => {
      const input = `https://youtube.com/watch?v=abc123DEF_-
https://example.com
https://youtu.be/xyz789ABC_-`

      const results = parseMultipleYouTubeUrls(input)
      expect(results).toHaveLength(3)
      expect(results[0].valid).toBe(true)
      expect(results[0].videoId).toBe('abc123DEF_-')
      expect(results[1].valid).toBe(false)
      expect(results[2].valid).toBe(true)
      expect(results[2].videoId).toBe('xyz789ABC_-')
    })

    it('skips empty lines', () => {
      const input = `https://youtube.com/watch?v=abc123DEF_-

https://youtu.be/xyz789ABC_-
`
      const results = parseMultipleYouTubeUrls(input)
      expect(results).toHaveLength(2)
    })

    it('returns empty array for empty input', () => {
      expect(parseMultipleYouTubeUrls('')).toHaveLength(0)
    })

    it('returns empty array for whitespace-only input', () => {
      expect(parseMultipleYouTubeUrls('   \n  \n  ')).toHaveLength(0)
    })
  })

  describe('isYouTubeUrl', () => {
    it('returns true for youtube.com', () => {
      expect(isYouTubeUrl('https://youtube.com/watch?v=test')).toBe(true)
    })

    it('returns true for youtu.be', () => {
      expect(isYouTubeUrl('https://youtu.be/test')).toBe(true)
    })

    it('returns true for music.youtube.com', () => {
      expect(isYouTubeUrl('https://music.youtube.com/watch?v=test')).toBe(true)
    })

    it('returns false for non-YouTube URL', () => {
      expect(isYouTubeUrl('https://example.com')).toBe(false)
    })

    it('returns false for invalid URL', () => {
      expect(isYouTubeUrl('not-a-url')).toBe(false)
    })

    it('trims whitespace', () => {
      expect(isYouTubeUrl('  https://youtube.com  ')).toBe(true)
    })
  })
})
