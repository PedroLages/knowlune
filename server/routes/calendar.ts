/**
 * Calendar Feed Route — iCal subscription endpoint (E50-S02)
 *
 * GET /api/calendar/:token.ics
 *
 * Authentication: Token-in-URL (no JWT). Matches industry patterns
 * (Google Calendar, Todoist, Canvas LMS). This route MUST be mounted
 * BEFORE the JWT/entitlement middleware chain.
 */

import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { generateICalFeed } from '../../src/lib/icalFeedGenerator.js'
import type { StudySchedule } from '../../src/data/types.js'

const router = Router()

/** 40-character hex token format */
const TOKEN_REGEX = /^[a-f0-9]{40}$/

router.get('/:token.ics', async (req, res) => {
  const { token } = req.params

  // Validate token format
  if (!token || !TOKEN_REGEX.test(token)) {
    res.status(404).send('Not Found')
    return
  }

  // Require Supabase config
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('[calendar] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    res.status(503).set('Retry-After', '300').send('Service Unavailable')
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  let userId: string
  let timezone: string

  // Look up token
  try {
    const { data: tokenRow, error } = await supabase
      .from('calendar_tokens')
      .select('user_id, timezone')
      .eq('token', token)
      .maybeSingle()

    if (error) {
      // silent-catch-ok — logs to console and returns 503 to client
      console.error('[calendar] Token lookup error:', error.message)
      res.status(503).set('Retry-After', '300').send('Service Unavailable')
      return
    }

    if (!tokenRow) {
      // AC4: No distinction between invalid and expired
      res.status(404).send('Not Found')
      return
    }

    userId = tokenRow.user_id
    timezone = tokenRow.timezone || 'UTC'

    // AC5: Update last_accessed_at (fire-and-forget is acceptable here)
    supabase
      .from('calendar_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('token', token)
      .then(({ error: updateErr }) => {
        if (updateErr) {
          console.error('[calendar] Failed to update last_accessed_at:', updateErr.message)
        }
      })
      // silent-catch-ok — server-side fire-and-forget, no UI to surface errors to
      .catch((err: Error) => {
        console.error('[calendar] Unexpected error updating last_accessed_at:', err.message)
      })
  } catch (err) {
    // silent-catch-ok — logs to console and returns 503 to client
    console.error('[calendar] Token lookup exception:', (err as Error).message)
    res.status(503).set('Retry-After', '300').send('Service Unavailable')
    return
  }

  // Fetch user's study schedules
  let schedules: StudySchedule[] = []
  try {
    const { data, error } = await supabase
      .from('study_schedules')
      .select('id, title, startTime, durationMinutes, recurrence, days, reminderMinutes, enabled, timezone')
      .eq('user_id', userId)
      .eq('enabled', true)

    if (error) {
      // Graceful degradation: return feed with no events rather than 500
      console.error('[calendar] Schedule query error:', error.message)
    } else {
      schedules = (data ?? []) as StudySchedule[]
    }
  } catch (err) {
    // Graceful degradation per Task 3.12
    console.error('[calendar] Schedule query exception:', (err as Error).message)
  }

  // Generate iCal feed
  const ical = generateICalFeed(schedules, timezone)

  // Set response headers
  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'attachment; filename="knowlune.ics"',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  })
  res.send(ical)
})

export default router
