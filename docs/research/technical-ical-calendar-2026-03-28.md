---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'iCal/ICS Feed Generation for Web Applications'
research_goals: 'Enable Knowlune users to subscribe to a calendar feed URL in Google Calendar/Apple Calendar showing scheduled study blocks and spaced repetition review reminders'
user_name: 'Pedro'
date: '2026-03-28'
web_research_enabled: true
source_verification: true
---

# iCal/ICS Calendar Feed Generation: Comprehensive Technical Research for Knowlune

**Date:** 2026-03-28
**Author:** Pedro
**Research Type:** Technical

---

## Executive Summary

This report presents a comprehensive technical analysis of iCal/ICS feed generation for Knowlune's learning platform. The goal is to enable users to subscribe to a personalized calendar feed URL in Google Calendar, Apple Calendar, or Outlook that displays their scheduled study blocks and spaced repetition review reminders.

The iCalendar format (RFC 5545) is a mature, universally supported standard with straightforward event modeling. For Knowlune's architecture (React + TypeScript frontend, Express proxy server, self-hosted Supabase), the recommended approach is a **server-side dynamic feed endpoint** using the `ical-generator` npm package, secured with per-user opaque tokens stored in Supabase. Client-side `.ics` file download should be offered as a complementary one-time export feature.

**Key Findings:**

- The iCal format requires only 4 properties per event (UID, DTSTAMP, DTSTART, SUMMARY) making generation straightforward
- `ical-generator` is the best library choice: 300K+ weekly downloads, full TypeScript support, built-in VTIMEZONE handling, and native HTTP response helpers
- Calendar apps refresh subscribed feeds on their own schedule (5 min to 24 hrs) -- this is an inherent limitation, not a bug
- Per-user signed token URLs (not JWT, not OAuth) are the industry-standard security model for calendar feeds, matching how Google Calendar, Todoist, and Canvas LMS implement it
- Knowlune's existing `CourseReminder` type maps cleanly to RRULE weekly recurrence patterns

**Recommendations:**

1. Use `ical-generator` (server-side) on the Express proxy for subscription feeds
2. Use the `ics` package (client-side) for one-time `.ics` file downloads
3. Generate per-user opaque tokens stored in Supabase `calendar_tokens` table
4. Serve feeds at `GET /api/calendar/:token.ics` with `text/calendar` content type
5. Map `CourseReminder.days[]` directly to RRULE `BYDAY` parameters

---

## Table of Contents

1. [iCal/ICS Format Specification](#1-icalics-format-specification)
2. [JavaScript/TypeScript Library Comparison](#2-javascripttypescript-library-comparison)
3. [How Other Apps Implement Calendar Integration](#3-how-other-apps-implement-calendar-integration)
4. [Timezone Handling Best Practices](#4-timezone-handling-best-practices)
5. [Feed Hosting Architecture](#5-feed-hosting-architecture)
6. [Browser-Side vs Server-Side Generation](#6-browser-side-vs-server-side-generation)
7. [Knowlune-Specific Implementation Design](#7-knowlune-specific-implementation-design)
8. [VALARM Reminders for Study Notifications](#8-valarm-reminders-for-study-notifications)
9. [Security Architecture](#9-security-architecture)
10. [Risk Assessment and Limitations](#10-risk-assessment-and-limitations)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Sources and References](#12-sources-and-references)

---

## 1. iCal/ICS Format Specification

### 1.1 Overview

The iCalendar format is defined by [RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545) (Internet Calendaring and Scheduling Core Object Specification). An `.ics` file is a plain-text file with MIME type `text/calendar` containing one `VCALENDAR` object with nested components.

### 1.2 Minimal Valid Structure

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Knowlune//Study Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Knowlune Study Schedule
BEGIN:VEVENT
UID:reminder-abc123@knowlune.app
DTSTAMP:20260328T120000Z
DTSTART;TZID=America/New_York:20260330T090000
DTEND;TZID=America/New_York:20260330T100000
SUMMARY:Study: Introduction to Machine Learning
DESCRIPTION:Scheduled study block for your ML course
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

### 1.3 Required VEVENT Properties

Per RFC 5545 Section 3.6.1, a `VEVENT` component requires:

| Property | Required? | Description |
|----------|-----------|-------------|
| `UID` | **REQUIRED** | Globally unique identifier for the event. Must be persistent across feed updates. |
| `DTSTAMP` | **REQUIRED** | Timestamp of when the event object was created/last modified. |
| `DTSTART` | **REQUIRED** (when no METHOD) | Start date-time of the event. Also defines the first instance for recurring events. |
| `SUMMARY` | Optional but strongly recommended | Short title/subject displayed in calendar apps. |
| `DTEND` | Optional | End date-time (non-inclusive). Mutually exclusive with `DURATION`. |
| `DURATION` | Optional | Event duration. Mutually exclusive with `DTEND`. |
| `DESCRIPTION` | Optional | Longer text description. |
| `LOCATION` | Optional | Location string. |
| `STATUS` | Optional | `TENTATIVE`, `CONFIRMED`, or `CANCELLED`. |

_Source: [RFC 5545 Section 3.6.1](https://icalendar.org/iCalendar-RFC-5545/3-6-1-event-component.html)_

### 1.4 RRULE Recurrence Rules

The `RRULE` property defines recurring event patterns. This is critical for Knowlune since study reminders repeat on specific days of the week.

**RRULE Components:**

| Parameter | Description | Example |
|-----------|-------------|---------|
| `FREQ` | Frequency (DAILY, WEEKLY, MONTHLY, YEARLY) | `FREQ=WEEKLY` |
| `BYDAY` | Days of the week | `BYDAY=MO,WE,FR` |
| `INTERVAL` | Repeat interval | `INTERVAL=2` (every 2 weeks) |
| `COUNT` | Number of occurrences | `COUNT=52` |
| `UNTIL` | End date | `UNTIL=20261231T235959Z` |
| `WKST` | Week start day | `WKST=MO` |

**Knowlune-Relevant Examples:**

```ics
# Study every Monday, Wednesday, Friday at 9:00 AM
RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR

# Study every Tuesday and Thursday, for 12 weeks
RRULE:FREQ=WEEKLY;BYDAY=TU,TH;COUNT=24

# Daily review at 7:00 PM
RRULE:FREQ=DAILY

# Spaced repetition: review in 1 day, 3 days, 7 days, 14 days, 30 days
# (Cannot be expressed as a single RRULE -- use individual VEVENT instances with RDATE)
```

**Mapping `CourseReminder.days[]` to RRULE:**

Knowlune's `DayOfWeek` type (`'monday' | 'tuesday' | ... | 'sunday'`) maps directly to iCal's `BYDAY` abbreviations:

```typescript
const DAY_MAP: Record<DayOfWeek, string> = {
  monday: 'MO', tuesday: 'TU', wednesday: 'WE',
  thursday: 'TH', friday: 'FR', saturday: 'SA', sunday: 'SU'
}
// CourseReminder { days: ['monday', 'wednesday', 'friday'], time: '09:00' }
// => RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
```

_Source: [RFC 5545 Section 3.8.5.3](https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html), [iCal4j Recurrence Examples](https://www.ical4j.org/recurrences/)_

### 1.5 Spaced Repetition Events

For spaced repetition review reminders (variable intervals like 1d, 3d, 7d, 14d, 30d), `RRULE` cannot express irregular intervals. Two approaches:

1. **Individual VEVENTs**: Generate a separate `VEVENT` for each review date. Simple, explicit, and compatible with all calendar apps.
2. **RDATE property**: List specific recurrence dates with `RDATE:20260401T090000,20260403T090000,20260407T090000`. Less common but valid.

**Recommendation:** Use individual VEVENTs for spaced repetition reviews. They are easier to generate, update, and delete individually.

---

## 2. JavaScript/TypeScript Library Comparison

### 2.1 Library Overview

| Library | npm Weekly Downloads | Package Size | TypeScript | Browser Support | Maintenance | Key Feature |
|---------|---------------------|-------------|------------|-----------------|-------------|-------------|
| **ical-generator** | ~300K | ~692 kB (unpacked) | Yes (native) | Partial (no fs) | Active (v10.1.0, March 2026) | Full RFC 5545, VTIMEZONE, HTTP helpers |
| **ics** | ~80K | ~72 kB | Yes (types included) | Yes (Blob/download) | Active (v3.11.0) | Simple API, browser download support |
| **ical-gen** | <1K | Small | Yes (native) | Yes | Early draft, not production-ready | Fork of ical-generator, minimal |
| **ics-browser-gen** | <1K | Small | No | Yes (browser-only) | Low activity | Browser-focused .ics generator |
| **node-ical** | ~150K | ~200 kB | Yes | No (Node-only) | Active | **Parser** (not generator) |

_Sources: [ical-generator on npm](https://www.npmjs.com/package/ical-generator), [ics on npm](https://www.npmjs.com/package/ics), [ics on Socket](https://socket.dev/npm/package/ics)_

### 2.2 ical-generator (Recommended for Server-Side)

**Strengths:**
- Most popular iCal generation library (300K+ weekly downloads)
- Full TypeScript support with native type definitions
- Built-in VTIMEZONE generation using IANA timezone database
- HTTP response helpers (`calendar.serve(res)` for Express)
- Support for RRULE, VALARM, ATTENDEE, ORGANIZER, and all RFC 5545 features
- Active maintenance by sebbo2002 (latest release: March 2026)
- Optional integration with moment.js, Day.js, or Luxon for date handling (not required)

**Weaknesses:**
- Larger bundle size (~692 kB unpacked) -- not ideal for browser
- Uses Node.js `fs` module for file saving (not available in browser)
- Some features are server-oriented

**Example (Express endpoint):**

```typescript
import ical, { ICalCalendarMethod } from 'ical-generator'

app.get('/api/calendar/:token.ics', async (req, res) => {
  const calendar = ical({
    name: 'Knowlune Study Schedule',
    prodId: { company: 'Knowlune', product: 'Study Calendar' },
    method: ICalCalendarMethod.PUBLISH,
  })

  // Add recurring study block
  calendar.createEvent({
    id: 'reminder-abc123@knowlune.app',
    start: new Date('2026-03-30T09:00:00'),
    end: new Date('2026-03-30T10:00:00'),
    summary: 'Study: Introduction to ML',
    timezone: 'America/New_York',
    repeating: {
      freq: 'WEEKLY',
      byDay: ['MO', 'WE', 'FR'],
    },
  })

  calendar.serve(res) // Sets headers + sends response
})
```

_Source: [ical-generator GitHub](https://github.com/sebbo2002/ical-generator)_

### 2.3 ics (Recommended for Client-Side)

**Strengths:**
- Small package size (~72 kB)
- Works in both Node.js and browser environments
- Simple, functional API (`createEvents()` returns a string)
- Built-in Blob/File creation for browser downloads
- 2 dependencies only
- Good for one-time `.ics` file downloads

**Weaknesses:**
- Less feature-rich than ical-generator (no HTTP helpers, limited VTIMEZONE)
- Callback-based API (though also returns `{ error, value }`)
- No built-in timezone database

**Example (Browser download):**

```typescript
import { createEvents } from 'ics'

const { error, value } = createEvents([{
  start: [2026, 3, 30, 9, 0],
  end: [2026, 3, 30, 10, 0],
  title: 'Study: Introduction to ML',
  uid: 'reminder-abc123@knowlune.app',
  recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
}])

if (value) {
  const blob = new Blob([value], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'knowlune-study-schedule.ics'
  a.click()
  URL.revokeObjectURL(url)
}
```

_Source: [ics GitHub](https://github.com/adamgibbons/ics)_

### 2.4 Recommendation

| Use Case | Library | Why |
|----------|---------|-----|
| **Subscription feed** (Express endpoint) | `ical-generator` | Full RFC 5545, VTIMEZONE, HTTP helpers, active maintenance |
| **One-time download** (browser) | `ics` | Small bundle, browser-native Blob support |
| **Parsing incoming .ics** (if ever needed) | `node-ical` | Best parser, not a generator |

---

## 3. How Other Apps Implement Calendar Integration

### 3.1 Todoist

**Approach:** Server-generated iCal feed with per-project subscription URLs.

**Key Details:**
- Each Todoist project gets its own iCal feed URL
- The URL is accessed from Settings > Integrations > Calendar Subscription URL
- Creates a one-way sync (Todoist -> Calendar, not bidirectional)
- A new calendar is created in the calendar app for each subscribed project
- Refresh frequency depends on the calendar app (5 minutes to 24 hours)
- Tasks with due dates appear as all-day events; tasks with due times appear as timed events

**Relevance to Knowlune:** Todoist's model of per-project feeds maps well to per-course feeds. However, Knowlune should consider a single unified feed (all reminders) with optional per-course filtering.

_Source: [Todoist Help - Add a calendar feed](https://www.todoist.com/help/articles/add-a-todoist-calendar-feed-pAk3tk)_

### 3.2 Google Classroom

**Approach:** Native Google Calendar integration (not iCal-based).

**Key Details:**
- Each class creates a shared Classroom calendar visible in Google Calendar
- Only items with due dates appear in the calendar
- No direct iCal feed export for external calendar apps
- Users can access a "Secret address in iCal format" from Google Calendar settings for read-only subscription
- Syncing with non-Google calendars requires workarounds (Zapier, IFTTT)

**Relevance to Knowlune:** Google Classroom benefits from being a Google product with native Calendar integration. Knowlune needs the iCal approach since it cannot integrate natively with Google Calendar.

_Source: [Google Classroom Help - View due dates](https://support.google.com/edu/classroom/answer/6272985)_

### 3.3 Notion

**Approach:** No native iCal export. Third-party tools bridge the gap.

**Key Details:**
- Notion Calendar (acquired Cron) provides database viewing but not iCal export
- Third-party services (Export My Calendar, Notion to Calendar) generate iCal URLs from Notion databases via the Notion API
- Open-source projects like `notion2ical` and `notion-to-ics` exist on GitHub
- The Notion API provides database query capabilities, which external tools convert to `.ics` format

**Relevance to Knowlune:** Notion's lack of native iCal support shows it is a genuine gap in many productivity apps. Knowlune can differentiate by offering first-class calendar feed support.

_Source: [Notion to Calendar Blog](https://notiontocalendar.com/blog/how-to-get-a-notion-calendar-ical-links), [Export My Calendar](https://exportmycalendar.com/)_

### 3.4 Anki

**Approach:** No built-in calendar integration. Third-party tools emerging.

**Key Details:**
- Anki uses the FSRS algorithm (Free Spaced Repetition Scheduler) for scheduling reviews
- No native export to calendar formats
- Third-party service WhenToReview bridges Anki decks to calendar apps by analyzing review schedules and generating importable calendar reminders
- StudyCards AI offers spaced repetition planning with calendar export
- Community has long requested calendar integration (Quora, forums)

**Relevance to Knowlune:** The absence of calendar integration in Anki (the dominant spaced repetition app) represents a significant opportunity. Knowlune can offer what Anki users have been requesting for years.

_Source: [WhenToReview - Anki Integration Guide](https://whentoreview.com/en/anki-integration-guide/)_

### 3.5 Canvas LMS (Instructure)

**Approach:** Server-generated iCal feed with per-user subscription URL.

**Key Details:**
- Single iCal feed URL per user containing all courses' events and assignments
- Feed URL is accessible from Calendar sidebar > "Calendar Feed" link
- Contains events, assignments, and reserved Scheduler appointment slots
- Cannot filter by specific course (all-or-nothing)
- Requires re-import when enrolled in new courses
- Google Calendar may take up to 24 hours to sync

**Relevance to Knowlune:** Canvas's single-user-feed model is the simplest approach and should be Knowlune's primary implementation. Per-course feeds can be a future enhancement.

_Source: [Canvas LMS - Calendar iCal Feed](https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-view-the-Calendar-iCal-feed-to-subscribe-to-an-external/ta-p/617607)_

### 3.6 Summary Table

| App | Feed Type | Per-Course? | Security | Refresh | Native iCal? |
|-----|-----------|-------------|----------|---------|---------------|
| **Todoist** | Dynamic endpoint | Yes (per-project) | Token in URL | App-dependent | Yes |
| **Google Classroom** | Native Google Calendar | Yes (per-class) | Google auth | Real-time | No (Google-only) |
| **Notion** | None (third-party) | N/A | N/A | N/A | No |
| **Anki** | None (third-party) | N/A | N/A | N/A | No |
| **Canvas LMS** | Dynamic endpoint | No (all courses) | Token in URL | App-dependent | Yes |

---

## 4. Timezone Handling Best Practices

### 4.1 UTC vs Local Time with TZID

**The fundamental choice:** Store event times in UTC or local time with a timezone reference?

| Approach | Syntax | Best For | DST Handling |
|----------|--------|----------|--------------|
| **UTC** | `DTSTART:20260330T130000Z` | One-off global events, timestamps | Caller must convert; recurring events shift with DST |
| **Local + TZID** | `DTSTART;TZID=America/New_York:20260330T090000` | Recurring/location-based events | Automatic DST adjustment |

**Recommendation for Knowlune: Always use Local + TZID for study reminders.** A user who sets a study block at 9:00 AM expects it to remain at 9:00 AM regardless of daylight saving transitions. Using UTC would cause the event to shift by one hour during DST changes.

_Source: [CalConnect Dev Guide - Handling Dates and Times](https://devguide.calconnect.org/iCalendar-Topics/Handling-Dates-and-Times/)_

### 4.2 VTIMEZONE Component

The `VTIMEZONE` component defines timezone rules including DST transitions. It MUST include:

- `TZID` property (e.g., `America/New_York`)
- At least one `STANDARD` or `DAYLIGHT` sub-component
- Each sub-component requires: `DTSTART`, `TZOFFSETFROM`, `TZOFFSETTO`

```ics
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
END:DAYLIGHT
END:VTIMEZONE
```

**Key point:** `ical-generator` automatically generates correct VTIMEZONE components when you specify `timezone: 'America/New_York'` on events. This is a major reason to prefer it over hand-rolling iCal strings.

_Source: [RFC 5545 Section 3.6.5](https://icalendar.org/iCalendar-RFC-5545/3-6-5-time-zone-component.html)_

### 4.3 Practical Timezone Strategy for Knowlune

1. **Store user timezone in Supabase** (e.g., `user_settings.timezone = 'America/New_York'`)
2. **Detect timezone on client** using `Intl.DateTimeFormat().resolvedOptions().timeZone`
3. **Generate events with TZID** referencing the user's stored timezone
4. **Let ical-generator handle VTIMEZONE** generation automatically
5. **Use IANA timezone identifiers** (e.g., `America/New_York`, never `EST` or `UTC-5`)

### 4.4 DST Edge Cases

- **Spring forward:** A 2:30 AM event on March 8 (when clocks jump to 3:00 AM) may be skipped by some calendar apps. Avoid scheduling recurring events between 2:00-3:00 AM.
- **Fall back:** A 1:30 AM event on November 1 could occur twice. Calendar apps typically handle this correctly with VTIMEZONE data.
- **Cross-timezone:** If a user changes their timezone, existing feed events with the old TZID remain correct for historical data. New events use the new timezone.

_Source: [CopyProgramming - ICS Timezone & Daylight Savings Guide](https://copyprogramming.com/howto/ics-timezone-daylight-savings-code-example)_

---

## 5. Feed Hosting Architecture

### 5.1 Three Approaches

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Static file** | Pre-generated `.ics` file on disk/CDN | Simple, cacheable, fast | Stale data, must regenerate on every change |
| **Dynamic endpoint** | Express route generates `.ics` on request | Always current, per-user | Server load on each request |
| **Signed URL to static** | Pre-generated file at signed URL | Cacheable + secure | Complex cache invalidation |

### 5.2 Recommendation: Dynamic Endpoint

For Knowlune, a **dynamic Express endpoint** is the clear winner:

- Study reminders change frequently (users add/remove courses, adjust schedules)
- The Express proxy server already exists
- Supabase queries are fast for a single user's reminders
- Calendar apps only fetch the feed every few hours (low request volume)
- No cache invalidation complexity

**Architecture:**

```
Google Calendar                    Knowlune Express Server
   |                                    |
   |-- GET /api/calendar/abc123.ics --> |
   |                                    |-- Query Supabase for user reminders
   |                                    |-- Generate iCal with ical-generator
   |  <-- 200 text/calendar ----------- |
   |                                    |
   (refreshes every 3-24 hours)
```

### 5.3 Calendar App Refresh Rates

An important limitation: **calendar apps control when they refresh subscribed feeds.** The server cannot push updates.

| Calendar App | Typical Refresh Interval | Can User Force? |
|-------------|-------------------------|-----------------|
| Google Calendar | 12-24 hours | No (undocumented) |
| Apple Calendar | 5 min - 1 hour (configurable) | Yes (refresh manually) |
| Outlook | 3-24 hours | Yes (sync button) |
| Thunderbird | Configurable (default 30 min) | Yes |

**Mitigation:** Document this limitation in the UI. Consider adding a "Last synced" indicator and a manual "Download .ics" button for users who want immediate updates.

_Source: [Matt Rossman - Turning Data into Calendar Feeds](https://mattrossman.com/2025/01/06/turning-data-into-calendar-feeds/), [Neil.gg - Building an iCal Subscription](https://neil.gg/blog/building-an-ical-subscription/)_

---

## 6. Browser-Side vs Server-Side Generation

### 6.1 Comparison

| Aspect | Browser-Side | Server-Side |
|--------|-------------|-------------|
| **Subscription feed** | Not possible (no persistent URL) | Required (serves at stable URL) |
| **One-time download** | Excellent (Blob + download) | Unnecessary overhead |
| **VTIMEZONE generation** | Manual/limited | Automatic (ical-generator) |
| **Bundle size impact** | ~72 kB (ics) | 0 kB client impact |
| **Data access** | IndexedDB (Dexie) | Supabase |
| **Works offline** | Yes | No |

### 6.2 Can We Generate .ics Entirely Client-Side?

**Yes, for one-time downloads.** The `ics` npm package and raw string generation both work in the browser. A user can click "Download Schedule" and get an `.ics` file without any server involvement.

**No, for subscription feeds.** Calendar apps need a stable URL they can periodically fetch. This requires a server endpoint. There is no way to make Google Calendar poll a browser tab.

### 6.3 Hybrid Recommendation

1. **Server-side (ical-generator on Express):** Generate subscription feeds at `/api/calendar/:token.ics`
2. **Client-side (ics in React):** Offer "Download .ics" button for immediate one-time import
3. **Client-side data source:** For the download button, read from Dexie (works offline). For the subscription feed, read from Supabase (authoritative source after sync).

This hybrid approach keeps the client bundle small (only `ics` at ~72 kB) while leveraging `ical-generator`'s full feature set on the server.

---

## 7. Knowlune-Specific Implementation Design

### 7.1 Data Model Mapping

**Existing `CourseReminder` type** (from `src/data/types.ts:390-398`):

```typescript
interface CourseReminder {
  id: string          // UUID -> VEVENT UID
  courseId: string     // FK to course -> used for SUMMARY
  courseName: string  // -> VEVENT SUMMARY
  days: DayOfWeek[]   // -> RRULE BYDAY
  time: string        // "HH:MM" -> DTSTART time component
  enabled: boolean    // -> include/exclude from feed
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
}
```

**Mapping to VEVENT:**

| CourseReminder Field | iCal Property | Transformation |
|---------------------|---------------|----------------|
| `id` | `UID` | `${id}@knowlune.app` |
| `courseName` | `SUMMARY` | `Study: ${courseName}` |
| `days` | `RRULE:FREQ=WEEKLY;BYDAY=` | Map DayOfWeek to MO,TU,WE... |
| `time` | `DTSTART` | Combine with user timezone |
| `enabled` | (include/exclude) | Only include if `enabled === true` |
| `updatedAt` | `DTSTAMP` | Direct ISO mapping |

### 7.2 Spaced Repetition Reviews

For `ReviewRecord` events from the FSRS algorithm:

- Each scheduled review becomes an individual `VEVENT` (no RRULE)
- `DTSTART` = scheduled review date + user's preferred review time
- `SUMMARY` = `Review: ${flashcard.front}` or `Review: ${courseName}`
- `VALARM` with 15-minute trigger for push notification
- `CATEGORIES:review,spaced-repetition`

### 7.3 Express Endpoint Design

```typescript
// server/routes/calendar.ts
import ical, { ICalCalendarMethod, ICalEventRepeatingFreq } from 'ical-generator'

router.get('/api/calendar/:token.ics', async (req, res) => {
  const { token } = req.params

  // 1. Validate token and get user
  const { data: tokenRecord } = await supabase
    .from('calendar_tokens')
    .select('user_id, timezone')
    .eq('token', token)
    .single()

  if (!tokenRecord) return res.status(404).send('Not found')

  // 2. Fetch reminders
  const { data: reminders } = await supabase
    .from('course_reminders')
    .select('*')
    .eq('user_id', tokenRecord.user_id)
    .eq('enabled', true)

  // 3. Generate calendar
  const calendar = ical({
    name: 'Knowlune Study Schedule',
    prodId: { company: 'Knowlune', product: 'Study Calendar' },
    method: ICalCalendarMethod.PUBLISH,
    timezone: tokenRecord.timezone,
  })

  for (const reminder of reminders) {
    const [hours, minutes] = reminder.time.split(':').map(Number)
    const startDate = new Date()
    startDate.setHours(hours, minutes, 0, 0)

    calendar.createEvent({
      id: `${reminder.id}@knowlune.app`,
      start: startDate,
      duration: 60 * 60, // 1 hour default
      summary: `Study: ${reminder.course_name}`,
      timezone: tokenRecord.timezone,
      repeating: {
        freq: ICalEventRepeatingFreq.WEEKLY,
        byDay: reminder.days.map(d => DAY_MAP[d]),
      },
    })
  }

  // 4. Serve with correct headers
  calendar.serve(res)
})
```

---

## 8. VALARM Reminders for Study Notifications

### 8.1 Overview

The `VALARM` component (RFC 5545 Section 3.6.6) defines reminders that calendar apps can display as push notifications. This is particularly valuable for study reminders.

### 8.2 Required Properties

- `ACTION`: `DISPLAY` (shows notification), `AUDIO` (plays sound), or `EMAIL` (sends email)
- `TRIGGER`: When to fire, relative to event start. Negative duration = before event.

### 8.3 Example

```ics
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Study session starting in 15 minutes
TRIGGER:-PT15M
END:VALARM
```

### 8.4 Implementation with ical-generator

```typescript
calendar.createEvent({
  // ... event properties
  alarms: [
    {
      type: 'display',
      trigger: -15 * 60, // 15 minutes before (in seconds)
      description: 'Study session starting in 15 minutes',
    },
  ],
})
```

**Note:** Not all calendar apps honor VALARM from subscribed feeds. Google Calendar ignores VALARM in subscribed calendars (only uses its own notification settings). Apple Calendar respects VALARM. Consider documenting this limitation.

_Source: [RFC 5545 Section 3.6.6](https://icalendar.org/iCalendar-RFC-5545/3-6-6-alarm-component.html), [RFC 9074 - VALARM Extensions](https://datatracker.ietf.org/doc/html/rfc9074)_

---

## 9. Security Architecture

### 9.1 Industry Standard: Opaque Token URLs

The iCalendar protocol does not support authentication headers. Calendar apps send plain HTTP GET requests with no cookies, no Bearer tokens, and no OAuth. The universal solution is **security through URL secrecy** -- a long, random, opaque token embedded in the URL.

**How major platforms do it:**

| Platform | URL Pattern | Token Type |
|----------|-------------|-----------|
| Google Calendar | `/calendar/ical/[id]/private-[token]/basic.ics` | Opaque hash |
| Todoist | `/ical/[token]` | Opaque token |
| Canvas LMS | `/feeds/calendars/[token].ics` | Opaque token |

### 9.2 Knowlune Token Design

```
GET /api/calendar/aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789abcd.ics
                  ^--- 40-character random hex token
```

**Token properties:**
- 40 hex characters (160 bits of entropy -- same as Git SHA-1)
- Generated with `crypto.randomBytes(20).toString('hex')`
- Stored in Supabase `calendar_tokens` table
- One active token per user (regeneration revokes old token)
- No expiration (revoked explicitly by user)

### 9.3 Supabase Schema

```sql
CREATE TABLE calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  CONSTRAINT unique_user_token UNIQUE (user_id)
);

CREATE INDEX idx_calendar_tokens_token ON calendar_tokens(token);
```

### 9.4 Token Revocation

Users can regenerate their feed URL from Settings, which:
1. Generates a new random token
2. Updates the `calendar_tokens` row (UPSERT)
3. The old URL immediately stops working
4. User must re-subscribe in their calendar app with the new URL

_Source: [iCalendar.org - Security Considerations (RFC 7986)](https://icalendar.org/New-Properties-for-iCalendar-RFC-7986/7-security-considerations.html), [Microsoft Q&A - iCalendar Authentication](https://learn.microsoft.com/en-us/answers/questions/1695317/implementing-authentication-for-subscribing-to-an)_

---

## 10. Risk Assessment and Limitations

### 10.1 Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Google Calendar ignores VALARM | Medium | Document limitation; users set reminders in Google Calendar directly |
| Feed refresh delay (up to 24h) | Medium | Offer "Download .ics" for immediate updates; document in UI |
| Token URL leaked/shared | Medium | Allow token regeneration; track `last_accessed_at` for audit |
| Timezone changes mid-subscription | Low | Regenerate feed on timezone change; existing events remain correct |
| Large feed size (many courses/reviews) | Low | Paginate by date range (next 90 days); exclude past events |

### 10.2 Calendar App Compatibility

| Feature | Google Calendar | Apple Calendar | Outlook | Thunderbird |
|---------|----------------|----------------|---------|-------------|
| Subscribe via URL | Yes | Yes | Yes | Yes |
| RRULE support | Yes | Yes | Yes | Yes |
| VTIMEZONE support | Yes | Yes | Yes | Yes |
| VALARM support | **No** (subscribed feeds) | Yes | Partial | Yes |
| Auto-refresh | 12-24h | 5min-1h | 3-24h | Configurable |

### 10.3 Performance Considerations

- **Feed generation time:** Querying Supabase for one user's reminders + generating iCal should take <100ms
- **Concurrent requests:** Calendar apps poll independently; expect max 1 request per user per hour
- **Feed size:** A user with 10 courses, 5 reminders each = ~50 VEVENTs. An `.ics` file with 50 events is <10 KB.

---

## 11. Implementation Roadmap

### Phase 1: Core Feed (MVP)

1. Install `ical-generator` on Express server
2. Create `calendar_tokens` table in Supabase
3. Build `GET /api/calendar/:token.ics` endpoint
4. Map `CourseReminder` to VEVENT with RRULE
5. Add "Calendar Feed" section to Settings page with copy-to-clipboard URL
6. Include VALARM (15-minute pre-event reminder)

### Phase 2: Client-Side Download

1. Install `ics` package (frontend)
2. Add "Download Schedule (.ics)" button to course reminder UI
3. Generate `.ics` from Dexie data (works offline)

### Phase 3: Spaced Repetition Events

1. Query scheduled `ReviewRecord` entries
2. Generate individual VEVENTs for upcoming reviews (next 90 days)
3. Include review subject in SUMMARY
4. Add CATEGORIES for filtering

### Phase 4: Enhanced Features

1. Per-course feed URLs (optional filtering)
2. Study session duration tracking (actual vs scheduled)
3. Token usage analytics (`last_accessed_at`)
4. Calendar feed health check (warn if not accessed in 30+ days)

---

## 12. Sources and References

### Specifications

- [RFC 5545 - Internet Calendaring and Scheduling Core Object Specification](https://datatracker.ietf.org/doc/html/rfc5545)
- [RFC 9074 - VALARM Extensions for iCalendar](https://datatracker.ietf.org/doc/html/rfc9074)
- [iCalendar.org - Event Component (Section 3.6.1)](https://icalendar.org/iCalendar-RFC-5545/3-6-1-event-component.html)
- [iCalendar.org - RRULE (Section 3.8.5.3)](https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html)
- [iCalendar.org - VTIMEZONE (Section 3.6.5)](https://icalendar.org/iCalendar-RFC-5545/3-6-5-time-zone-component.html)
- [iCalendar.org - VALARM (Section 3.6.6)](https://icalendar.org/iCalendar-RFC-5545/3-6-6-alarm-component.html)
- [CalConnect Dev Guide - Handling Dates and Times](https://devguide.calconnect.org/iCalendar-Topics/Handling-Dates-and-Times/)
- [CalConnect Dev Guide - Recurrences](https://devguide.calconnect.org/iCalendar-Topics/Recurrences/)

### Libraries

- [ical-generator on npm (v10.1.0)](https://www.npmjs.com/package/ical-generator)
- [ical-generator GitHub (sebbo2002)](https://github.com/sebbo2002/ical-generator)
- [ics on npm (v3.11.0)](https://www.npmjs.com/package/ics)
- [ics GitHub (adamgibbons)](https://github.com/adamgibbons/ics)
- [node-ical GitHub](https://github.com/jens-maus/node-ical)
- [ics-browser-gen on npm](https://www.npmjs.com/package/ics-browser-gen)
- [ical-gen GitHub](https://github.com/Manc/ical-gen)
- [Bundlephobia - ical-generator](https://bundlephobia.com/package/ical-generator)

### App Implementation References

- [Todoist - Add a Calendar Feed](https://www.todoist.com/help/articles/add-a-todoist-calendar-feed-pAk3tk)
- [Google Classroom - View Due Dates in Calendar](https://support.google.com/edu/classroom/answer/6272985)
- [Notion to Calendar Blog](https://notiontocalendar.com/blog/how-to-get-a-notion-calendar-ical-links)
- [WhenToReview - Anki Integration Guide](https://whentoreview.com/en/anki-integration-guide/)
- [Canvas LMS - Calendar iCal Feed](https://community.canvaslms.com/t5/Canvas-Basics-Guide/How-do-I-view-the-Calendar-iCal-feed-to-subscribe-to-an-external/ta-p/617607)

### Architecture and Best Practices

- [Matt Rossman - Turning Data into Calendar Feeds (2025)](https://mattrossman.com/2025/01/06/turning-data-into-calendar-feeds/)
- [Neil.gg - Building an iCal Subscription](https://neil.gg/blog/building-an-ical-subscription/)
- [Isuru Priyaranjana - Publishing Public Calendars (Medium)](https://isuruiup.medium.com/publishing-public-calendars-to-be-subscribed-in-google-and-outlook-calendars-3e2f508a7260)
- [iCalendar.org - Security Considerations (RFC 7986)](https://icalendar.org/New-Properties-for-iCalendar-RFC-7986/7-security-considerations.html)
- [Microsoft Q&A - Implementing Authentication for iCalendar Feeds](https://learn.microsoft.com/en-us/answers/questions/1695317/implementing-authentication-for-subscribing-to-an)
- [CopyProgramming - ICS Timezone & DST Guide](https://copyprogramming.com/howto/ics-timezone-daylight-savings-code-example)
- [TextMagic - RRULE Generator Tool](https://freetools.textmagic.com/rrule-generator)
- [iCal4j - Recurrence Examples](https://www.ical4j.org/recurrences/)

### Tools

- [iCalendar Validator (RFC 5545 Compliant)](https://icalendar.dev/validator/)
- [RRULE Generator](https://freetools.textmagic.com/rrule-generator)
- [Understanding .ics Files with RFC 5545](https://dpnkr.in/blog/understanding-ics-file)

---

**Research Completion Date:** 2026-03-28
**Source Verification:** All technical claims cited with current sources
**Confidence Level:** High -- based on RFC specifications, npm package data, and verified platform documentation

_This technical research document serves as the architectural foundation for implementing iCal/ICS calendar feed generation in Knowlune, enabling users to subscribe to study schedules and spaced repetition reminders in their preferred calendar application._
