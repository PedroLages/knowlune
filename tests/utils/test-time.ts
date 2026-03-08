/**
 * Test Time Utilities
 *
 * Provides deterministic date/time values for E2E tests to eliminate
 * non-deterministic time-based behavior.
 *
 * Usage:
 *   import { FIXED_DATE, getRelativeDate, formatDate } from './test-time'
 *
 *   // Use fixed reference date
 *   const today = new Date(FIXED_DATE)
 *
 *   // Get relative dates
 *   const yesterday = getRelativeDate(-1)
 *   const nextWeek = getRelativeDate(7)
 *
 *   // Format dates consistently
 *   const formatted = formatDate(new Date(FIXED_DATE), 'MMM DD, YYYY')
 */

/**
 * Fixed reference date for all tests: January 15, 2025 at 12:00 PM UTC
 * This provides a stable baseline for time-dependent test scenarios.
 */
export const FIXED_DATE = '2025-01-15T12:00:00.000Z'

/**
 * Fixed reference timestamp (milliseconds since epoch)
 */
export const FIXED_TIMESTAMP = new Date(FIXED_DATE).getTime()

/**
 * Get a date relative to FIXED_DATE
 * @param days - Number of days to add (negative for past dates)
 * @returns ISO string for the calculated date
 */
export function getRelativeDate(days: number): string {
  const date = new Date(FIXED_DATE)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

/**
 * Get a timestamp relative to FIXED_TIMESTAMP
 * @param days - Number of days to add (negative for past timestamps)
 * @returns Timestamp in milliseconds
 */
export function getRelativeTimestamp(days: number): number {
  return FIXED_TIMESTAMP + days * 24 * 60 * 60 * 1000
}

/**
 * Add minutes to FIXED_DATE
 * @param minutes - Number of minutes to add (negative for past times)
 * @returns ISO string for the calculated date
 */
export function addMinutes(minutes: number): string {
  const date = new Date(FIXED_DATE)
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

/**
 * Add hours to FIXED_DATE
 * @param hours - Number of hours to add (negative for past times)
 * @returns ISO string for the calculated date
 */
export function addHours(hours: number): string {
  const date = new Date(FIXED_DATE)
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

/**
 * Get a date relative to FIXED_DATE with day and minute offsets
 * @param days - Number of days to add
 * @param minutes - Number of minutes to add
 * @returns ISO string for the calculated date
 */
export function getRelativeDateWithMinutes(days: number, minutes: number): string {
  const date = new Date(FIXED_DATE)
  date.setDate(date.getDate() + days)
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

/**
 * Format a date string for display
 * Supports common date format patterns
 */
export function formatDate(
  dateString: string,
  format: 'MMM DD, YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY' = 'MMM DD, YYYY'
): string {
  const date = new Date(dateString)

  const month = date.toLocaleString('en-US', { month: 'short' })
  const monthNum = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()

  switch (format) {
    case 'MMM DD, YYYY':
      return `${month} ${day}, ${year}`
    case 'YYYY-MM-DD':
      return `${year}-${monthNum}-${day}`
    case 'MM/DD/YYYY':
      return `${monthNum}/${day}/${year}`
    default:
      return date.toISOString()
  }
}

/**
 * Common relative dates for testing
 */
export const TEST_DATES = {
  today: FIXED_DATE,
  yesterday: getRelativeDate(-1),
  tomorrow: getRelativeDate(1),
  lastWeek: getRelativeDate(-7),
  nextWeek: getRelativeDate(7),
  lastMonth: getRelativeDate(-30),
  nextMonth: getRelativeDate(30),
  threeMonthsAgo: getRelativeDate(-90),
  sixMonthsAgo: getRelativeDate(-180),
  oneYearAgo: getRelativeDate(-365),
} as const

/**
 * Common timestamps for testing
 */
export const TEST_TIMESTAMPS = {
  today: FIXED_TIMESTAMP,
  yesterday: getRelativeTimestamp(-1),
  tomorrow: getRelativeTimestamp(1),
  lastWeek: getRelativeTimestamp(-7),
  nextWeek: getRelativeTimestamp(7),
  lastMonth: getRelativeTimestamp(-30),
  nextMonth: getRelativeTimestamp(30),
} as const
