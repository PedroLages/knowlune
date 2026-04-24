// Calendar Feed Edge Function — iCal subscription endpoint (E50-S02 port).
//
// GET /calendar/<feed_token>.ics
// Public endpoint: auth is the feed_token itself (calendar apps cannot send
// custom headers). Uses the service-role key to bypass RLS.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const TOKEN_REGEX = /^[a-f0-9]{40}$/

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
}

type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

interface StudySchedule {
  id: string
  title: string
  startTime: string
  durationMinutes: number
  recurrence: 'weekly' | 'daily'
  days: DayOfWeek[]
  reminderMinutes: number
  enabled: boolean
  timezone?: string
}

const DAY_TO_BYDAY: Record<DayOfWeek, string> = {
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
  sunday: 'SU',
}

const DAY_INDEX: Record<DayOfWeek, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

function textResponse(status: number, body: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS_HEADERS, ...extraHeaders },
  })
}

function escapeText(value: string): string {
  // RFC 5545 §3.3.11 — escape backslash, semicolon, comma; fold newlines to \n.
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatLocal(date: Date): string {
  // Floating local time YYYYMMDDTHHMMSS — used with TZID parameter.
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

function formatUTC(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

function foldLine(line: string): string {
  // RFC 5545 §3.1 — lines MUST NOT be longer than 75 octets; continuation lines
  // start with a single whitespace.
  if (line.length <= 75) return line
  const chunks: string[] = []
  let i = 0
  while (i < line.length) {
    chunks.push(i === 0 ? line.slice(i, i + 75) : ' ' + line.slice(i, i + 74))
    i += i === 0 ? 75 : 74
  }
  return chunks.join('\r\n')
}

function getNextDayOccurrence(day: DayOfWeek, ref: Date): Date {
  const diff = (DAY_INDEX[day] - ref.getDay() + 7) % 7
  const result = new Date(ref)
  result.setDate(result.getDate() + diff)
  return result
}

function buildICalFeed(schedules: StudySchedule[], timezone: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Knowlune//Study Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText('Knowlune Study Calendar')}`,
    `X-WR-TIMEZONE:${escapeText(timezone)}`,
  ]

  const dtstamp = formatUTC(new Date())

  for (const schedule of schedules) {
    if (!schedule.enabled) continue

    const parts = schedule.startTime.split(':')
    const hours = Number(parts[0])
    const minutes = Number(parts[1])
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) continue

    const now = new Date()
    const refDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0)

    let dtstart: Date
    if (schedule.recurrence === 'weekly' && schedule.days.length > 0) {
      const candidates = schedule.days.map((d) => getNextDayOccurrence(d, refDate))
      dtstart = candidates.reduce((earliest, d) => (d < earliest ? d : earliest))
    } else {
      dtstart = new Date(refDate.getTime())
    }
    dtstart.setHours(hours, minutes, 0, 0)

    const dtend = new Date(dtstart.getTime() + schedule.durationMinutes * 60 * 1000)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${schedule.id}@knowlune.pedrolages.net`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART;TZID=${timezone}:${formatLocal(dtstart)}`)
    lines.push(`DTEND;TZID=${timezone}:${formatLocal(dtend)}`)
    lines.push(`SUMMARY:${escapeText(schedule.title)}`)

    if (schedule.recurrence === 'daily') {
      lines.push('RRULE:FREQ=DAILY')
    } else if (schedule.recurrence === 'weekly' && schedule.days.length > 0) {
      const byday = schedule.days.map((d) => DAY_TO_BYDAY[d]).join(',')
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byday}`)
    }

    if (schedule.reminderMinutes > 0) {
      lines.push('BEGIN:VALARM')
      lines.push('ACTION:DISPLAY')
      lines.push(`DESCRIPTION:${escapeText(`Study reminder: ${schedule.title}`)}`)
      lines.push(`TRIGGER:-PT${schedule.reminderMinutes}M`)
      lines.push('END:VALARM')
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

async function lookupToken(
  token: string,
): Promise<{ user_id: string; timezone: string } | null> {
  const url = `${SUPABASE_URL}/rest/v1/calendar_tokens?select=user_id,timezone&token=eq.${encodeURIComponent(token)}&limit=1`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    console.error('[calendar] Token lookup failed:', res.status, await res.text())
    return null
  }
  const rows = (await res.json()) as Array<{ user_id: string; timezone: string | null }>
  if (rows.length === 0) return null
  return { user_id: rows[0].user_id, timezone: rows[0].timezone || 'UTC' }
}

async function fetchSchedules(userId: string): Promise<StudySchedule[]> {
  const url = `${SUPABASE_URL}/rest/v1/study_schedules?select=id,title,startTime,durationMinutes,recurrence,days,reminderMinutes,enabled,timezone&user_id=eq.${encodeURIComponent(userId)}&enabled=eq.true`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    console.error('[calendar] Schedule query failed:', res.status, await res.text())
    return []
  }
  return (await res.json()) as StudySchedule[]
}

function touchLastAccessed(token: string): void {
  // Fire-and-forget.
  const url = `${SUPABASE_URL}/rest/v1/calendar_tokens?token=eq.${encodeURIComponent(token)}`
  fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ last_accessed_at: new Date().toISOString() }),
  }).catch((err) => {
    console.error('[calendar] Failed to update last_accessed_at:', (err as Error).message)
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'GET') {
    return textResponse(405, 'Method Not Allowed', { Allow: 'GET, OPTIONS' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[calendar] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return textResponse(503, 'Service Unavailable', { 'Retry-After': '300' })
  }

  const { pathname } = new URL(req.url)

  // Path is expected to be /calendar/<token>.ics (possibly prefixed by the
  // function router, e.g. /functions/v1/calendar/<token>.ics).
  const match = pathname.match(/\/calendar\/([^/]+)$/)
  if (!match) return textResponse(404, 'Not Found')

  const filename = match[1]
  if (!filename.endsWith('.ics')) return textResponse(404, 'Not Found')

  const token = filename.slice(0, -4)
  if (!token || !TOKEN_REGEX.test(token)) return textResponse(404, 'Not Found')

  let tokenRow: { user_id: string; timezone: string } | null
  try {
    tokenRow = await lookupToken(token)
  } catch (err) {
    console.error('[calendar] Token lookup exception:', (err as Error).message)
    return textResponse(503, 'Service Unavailable', { 'Retry-After': '300' })
  }

  if (!tokenRow) return textResponse(404, 'Not Found')

  touchLastAccessed(token)

  let schedules: StudySchedule[] = []
  try {
    schedules = await fetchSchedules(tokenRow.user_id)
  } catch (err) {
    console.error('[calendar] Schedule query exception:', (err as Error).message)
  }

  const ical = buildICalFeed(schedules, tokenRow.timezone)

  return new Response(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline; filename="knowlune.ics"',
      ...CORS_HEADERS,
    },
  })
})
