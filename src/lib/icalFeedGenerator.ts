/**
 * iCal Feed Generator — Isomorphic utility for generating iCal feeds
 *
 * Shared between:
 * - Server: Express calendar route (E50-S02)
 * - Client: .ics file download (future)
 *
 * Uses ical-generator for RFC 5545-compliant output with automatic VTIMEZONE.
 */

import icalGenerator, { ICalCalendarMethod, ICalAlarmType, ICalEventRepeatingFreq, ICalWeekday } from 'ical-generator'
import type { DayOfWeek, StudySchedule } from '../data/types'

/** Map DayOfWeek to iCal BYDAY abbreviation */
const DAY_MAP: Record<DayOfWeek, ICalWeekday> = {
  monday: ICalWeekday.MO,
  tuesday: ICalWeekday.TU,
  wednesday: ICalWeekday.WE,
  thursday: ICalWeekday.TH,
  friday: ICalWeekday.FR,
  saturday: ICalWeekday.SA,
  sunday: ICalWeekday.SU,
}

/**
 * Maps DayOfWeek[] to RRULE BYDAY string.
 * Example: ['monday', 'wednesday'] → 'MO,WE'
 */
export function mapDaysToRRule(days: DayOfWeek[]): string {
  return days.map((d) => DAY_MAP[d]).join(',')
}

/**
 * Computes the next occurrence of a given day from a reference date.
 * Used to set DTSTART to the correct weekday for weekly recurrence.
 */
function getNextDayOccurrence(day: DayOfWeek, referenceDate: Date): Date {
  const dayIndex: Record<DayOfWeek, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  }
  const target = dayIndex[day]
  const current = referenceDate.getDay()
  const diff = (target - current + 7) % 7
  const result = new Date(referenceDate)
  result.setDate(result.getDate() + diff)
  return result
}

/**
 * Generates a complete iCal calendar from study schedules.
 *
 * @param schedules - Active study schedules
 * @param timezone - IANA timezone (e.g., "America/New_York")
 * @returns iCal string (VCALENDAR with VEVENTs)
 */
export function generateICalFeed(schedules: StudySchedule[], timezone: string): string {
  const calendar = icalGenerator({
    name: 'Knowlune Study Calendar',
    prodId: { company: 'Knowlune', product: 'Study Calendar', language: 'EN' },
    timezone,
    method: ICalCalendarMethod.PUBLISH,
  })

  for (const schedule of schedules) {
    if (!schedule.enabled) continue

    // Parse startTime "HH:MM"
    const [hours, minutes] = schedule.startTime.split(':').map(Number)

    // Create a reference date for DTSTART (today, with correct time)
    const now = new Date()
    const refDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0)

    // For weekly recurrence, set DTSTART to the first matching day
    const dtstart =
      schedule.recurrence === 'weekly' && schedule.days.length > 0
        ? getNextDayOccurrence(schedule.days[0], refDate)
        : refDate
    dtstart.setHours(hours, minutes, 0, 0)

    // Compute end time from duration
    const dtend = new Date(dtstart.getTime() + schedule.durationMinutes * 60 * 1000)

    const event = calendar.createEvent({
      id: `schedule-${schedule.id}@knowlune.app`,
      summary: schedule.title,
      start: dtstart,
      end: dtend,
      timezone,
    })

    // Set recurrence rule
    if (schedule.recurrence === 'daily') {
      event.repeating({ freq: ICalEventRepeatingFreq.DAILY })
    } else if (schedule.recurrence === 'weekly' && schedule.days.length > 0) {
      event.repeating({
        freq: ICalEventRepeatingFreq.WEEKLY,
        byDay: schedule.days.map((d) => DAY_MAP[d]),
      })
    }

    // Add alarm if reminderMinutes > 0
    if (schedule.reminderMinutes > 0) {
      event.createAlarm({
        type: ICalAlarmType.display,
        trigger: schedule.reminderMinutes * 60, // seconds before
        description: `Study reminder: ${schedule.title}`,
      })
    }
  }

  return calendar.toString()
}

/**
 * Stub for SRS summary events — full implementation in E50-S06.
 */
export function generateSRSSummaryEvents(
  _reviewCounts: { date: string; count: number }[],
  _reviewTime: string,
  _timezone: string
): void {
  // Stub — will generate VEVENT entries for daily SRS review blocks
}
