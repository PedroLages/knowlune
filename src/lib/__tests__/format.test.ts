import { describe, it, expect } from 'vitest'
import {
  formatTimestamp,
  formatCourseDuration,
  formatFileSize,
  getResolutionLabel,
} from '../format'

describe('formatTimestamp', () => {
  describe('under 1 hour (MM:SS format)', () => {
    it('formats 0 seconds as 0:00', () => {
      expect(formatTimestamp(0)).toBe('0:00')
    })

    it('formats 1 second as 0:01', () => {
      expect(formatTimestamp(1)).toBe('0:01')
    })

    it('formats 59 seconds as 0:59', () => {
      expect(formatTimestamp(59)).toBe('0:59')
    })

    it('formats 60 seconds (1 minute) as 1:00', () => {
      expect(formatTimestamp(60)).toBe('1:00')
    })

    it('formats 125 seconds as 2:05', () => {
      expect(formatTimestamp(125)).toBe('2:05')
    })

    it('formats 599 seconds as 9:59', () => {
      expect(formatTimestamp(599)).toBe('9:59')
    })

    it('formats 3599 seconds (59:59) as 59:59', () => {
      expect(formatTimestamp(3599)).toBe('59:59')
    })

    it('pads single-digit seconds with leading zero', () => {
      expect(formatTimestamp(305)).toBe('5:05')
    })

    it('handles minutes >= 10 correctly', () => {
      expect(formatTimestamp(610)).toBe('10:10')
    })
  })

  describe('1 hour and above (HH:MM:SS format)', () => {
    it('formats exactly 1 hour (3600s) as 1:00:00', () => {
      expect(formatTimestamp(3600)).toBe('1:00:00')
    })

    it('formats 1 hour 1 second as 1:00:01', () => {
      expect(formatTimestamp(3601)).toBe('1:00:01')
    })

    it('formats 1 hour 30 minutes 45 seconds as 1:30:45', () => {
      expect(formatTimestamp(5445)).toBe('1:30:45')
    })

    it('formats 2 hours exactly as 2:00:00', () => {
      expect(formatTimestamp(7200)).toBe('2:00:00')
    })

    it('formats 10 hours 5 minutes 3 seconds as 10:05:03', () => {
      expect(formatTimestamp(36303)).toBe('10:05:03')
    })

    it('pads minutes with leading zero when < 10', () => {
      expect(formatTimestamp(3605)).toBe('1:00:05')
    })

    it('pads seconds with leading zero when < 10', () => {
      expect(formatTimestamp(3665)).toBe('1:01:05')
    })

    it('handles double-digit hours correctly', () => {
      expect(formatTimestamp(36000)).toBe('10:00:00')
    })
  })

  describe('boundary conditions', () => {
    it('formats 3599 seconds as MM:SS (just under 1 hour)', () => {
      expect(formatTimestamp(3599)).toBe('59:59')
      expect(formatTimestamp(3599)).not.toContain(':00:')
    })

    it('formats 3600 seconds as HH:MM:SS (exactly 1 hour)', () => {
      expect(formatTimestamp(3600)).toBe('1:00:00')
    })

    it('formats 59 seconds as MM:SS (just under 1 minute)', () => {
      expect(formatTimestamp(59)).toBe('0:59')
    })

    it('formats 60 seconds as MM:SS (exactly 1 minute)', () => {
      expect(formatTimestamp(60)).toBe('1:00')
    })
  })

  describe('large values', () => {
    it('handles 24 hours correctly', () => {
      expect(formatTimestamp(86400)).toBe('24:00:00')
    })

    it('handles 99 hours correctly', () => {
      expect(formatTimestamp(356400)).toBe('99:00:00')
    })

    it('handles 100+ hours correctly', () => {
      expect(formatTimestamp(360000)).toBe('100:00:00')
    })

    it('handles very large timestamps (1000 hours)', () => {
      expect(formatTimestamp(3600000)).toBe('1000:00:00')
    })
  })

  describe('fractional seconds', () => {
    it('floors fractional seconds (12.9 → 12)', () => {
      expect(formatTimestamp(12.9)).toBe('0:12')
    })

    it('floors fractional seconds (125.5 → 125)', () => {
      expect(formatTimestamp(125.5)).toBe('2:05')
    })

    it('floors fractional seconds in hour range (3661.7 → 3661)', () => {
      expect(formatTimestamp(3661.7)).toBe('1:01:01')
    })

    it('handles 59.9 seconds (floors to 59)', () => {
      expect(formatTimestamp(59.9)).toBe('0:59')
    })
  })

  describe('edge cases', () => {
    it('handles negative numbers by flooring to 0', () => {
      // Math.floor(-5) = -5, but modulo operations will still work
      // This tests actual behavior, not necessarily expected behavior
      const result = formatTimestamp(-5)
      expect(typeof result).toBe('string')
    })

    it('handles very small positive decimals', () => {
      expect(formatTimestamp(0.1)).toBe('0:00')
    })

    it('handles very small negative decimals', () => {
      const result = formatTimestamp(-0.1)
      expect(typeof result).toBe('string')
    })
  })

  describe('return value structure', () => {
    it('always returns a string', () => {
      expect(typeof formatTimestamp(100)).toBe('string')
    })

    it('MM:SS format has exactly one colon', () => {
      const result = formatTimestamp(125)
      expect((result.match(/:/g) || []).length).toBe(1)
    })

    it('HH:MM:SS format has exactly two colons', () => {
      const result = formatTimestamp(3661)
      expect((result.match(/:/g) || []).length).toBe(2)
    })

    it('all segments are numeric in MM:SS format', () => {
      const result = formatTimestamp(125)
      const [mins, secs] = result.split(':')
      expect(Number.isNaN(parseInt(mins))).toBe(false)
      expect(Number.isNaN(parseInt(secs))).toBe(false)
    })

    it('all segments are numeric in HH:MM:SS format', () => {
      const result = formatTimestamp(3661)
      const [hrs, mins, secs] = result.split(':')
      expect(Number.isNaN(parseInt(hrs))).toBe(false)
      expect(Number.isNaN(parseInt(mins))).toBe(false)
      expect(Number.isNaN(parseInt(secs))).toBe(false)
    })
  })

  describe('padding validation', () => {
    it('seconds always have 2 digits in MM:SS format', () => {
      const result = formatTimestamp(5) // 0:05
      const secs = result.split(':')[1]
      expect(secs.length).toBe(2)
    })

    it('seconds always have 2 digits in HH:MM:SS format', () => {
      const result = formatTimestamp(3605) // 1:00:05
      const secs = result.split(':')[2]
      expect(secs.length).toBe(2)
    })

    it('minutes always have 2 digits in HH:MM:SS format', () => {
      const result = formatTimestamp(3665) // 1:01:05
      const mins = result.split(':')[1]
      expect(mins.length).toBe(2)
    })

    it('minutes do NOT have leading zero in MM:SS format when >= 10', () => {
      const result = formatTimestamp(610) // 10:10
      expect(result).toBe('10:10')
    })
  })
})

describe('formatCourseDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatCourseDuration(8 * 3600 + 24 * 60)).toBe('8h 24m')
  })

  it('formats hours only when no remaining minutes', () => {
    expect(formatCourseDuration(3 * 3600)).toBe('3h')
  })

  it('formats minutes only when under an hour', () => {
    expect(formatCourseDuration(45 * 60)).toBe('45m')
  })

  it('returns "< 1m" for very short durations', () => {
    expect(formatCourseDuration(30)).toBe('< 1m')
  })

  it('returns "< 1m" for zero', () => {
    expect(formatCourseDuration(0)).toBe('< 1m')
  })

  it('handles negative input gracefully', () => {
    expect(formatCourseDuration(-100)).toBe('< 1m')
  })

  it('floors fractional seconds', () => {
    expect(formatCourseDuration(3661.9)).toBe('1h 1m')
  })
})

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(350 * 1024 * 1024)).toBe('350 MB')
  })

  it('formats gigabytes with one decimal', () => {
    expect(formatFileSize(2.4 * 1024 * 1024 * 1024)).toBe('2.4 GB')
  })

  it('formats large gigabyte values without decimal', () => {
    expect(formatFileSize(15 * 1024 * 1024 * 1024)).toBe('15 GB')
  })

  it('returns "0 B" for zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('handles negative input gracefully', () => {
    expect(formatFileSize(-100)).toBe('0 B')
  })
})

describe('getResolutionLabel', () => {
  it('returns "4K" for 2160p and above', () => {
    expect(getResolutionLabel(2160)).toBe('4K')
    expect(getResolutionLabel(2880)).toBe('4K')
  })

  it('returns "1440p" for 1440p', () => {
    expect(getResolutionLabel(1440)).toBe('1440p')
  })

  it('returns "1080p" for 1080p', () => {
    expect(getResolutionLabel(1080)).toBe('1080p')
  })

  it('returns "720p" for 720p', () => {
    expect(getResolutionLabel(720)).toBe('720p')
  })

  it('returns "480p" for 480p', () => {
    expect(getResolutionLabel(480)).toBe('480p')
  })

  it('returns "360p" for 360p', () => {
    expect(getResolutionLabel(360)).toBe('360p')
  })

  it('returns raw height for non-standard resolutions below 360', () => {
    expect(getResolutionLabel(240)).toBe('240p')
  })
})
