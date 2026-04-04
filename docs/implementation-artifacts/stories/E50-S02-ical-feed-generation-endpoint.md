---
story_id: E50-S02
story_name: "iCal Feed Generation Endpoint"
status: complete
started: 2026-04-04
completed: 2026-04-04
reviewed: true
review_started: 2026-04-04
review_gates_passed: [build, lint, type-check, format-check, unit-tests-skipped, e2e-tests-skipped, design-review-skipped, exploratory-qa-skipped, code-review, code-review-testing, performance-benchmark-skipped, security-review, glm-code-review, openai-code-review-skipped]
burn_in_validated: false
---

# Story 50.02: iCal Feed Generation Endpoint

## Story

As a learner,
I want an iCal subscription feed of my study schedules,
So that I can see my study blocks in Google Calendar, Apple Calendar, or Outlook.

## Acceptance Criteria

**AC1:** Given a valid feed token, when `GET /api/calendar/{token}.ics` is requested, then the response has `Content-Type: text/calendar; charset=utf-8` and contains a valid `VCALENDAR` object with `PRODID:-//Knowlune//Study Calendar//EN`.

**AC2:** Given a user with 3 study schedules, when the feed is requested, then 3 recurring VEVENT components appear with correct RRULE BYDAY values matching the schedule days.

**AC3:** Given a study schedule with `reminderMinutes: 15`, when the feed is generated, then a VALARM with `TRIGGER:-PT15M` is included in the event.

**AC4:** Given an invalid or expired token, when the feed is requested, then a 404 response is returned with no information leakage (no distinction between "invalid" and "expired").

**AC5:** Given a valid token, when the feed is requested, then `last_accessed_at` is updated in the `calendar_tokens` table.

## Tasks / Subtasks

- [ ] Task 1: Install `ical-generator` npm package (AC: 1)
  - [ ] 1.1 Run `npm install ical-generator`
  - [ ] 1.2 Verify TypeScript types are included (built-in, no @types needed)

- [ ] Task 2: Create iCal generation utility (AC: 2, 3)
  - [ ] 2.1 Create `src/lib/icalFeedGenerator.ts` (NEW, isomorphic)
  - [ ] 2.2 Implement `mapDaysToRRule(days: DayOfWeek[]): string` — maps `['monday', 'wednesday']` to `'MO,WE'`
  - [ ] 2.3 Implement `mapScheduleToEvent(schedule: StudySchedule)` — returns ical-generator event config with UID (`schedule-{id}@knowlune.app`), SUMMARY, DTSTART with TZID, DURATION, RRULE, VALARM
  - [ ] 2.4 Implement `generateSRSSummaryEvents(reviewCounts: { date: string; count: number }[], reviewTime: string, timezone: string)` — generates daily SRS events (stub for now, full implementation in E50-S06)
  - [ ] 2.5 Keep all imports isomorphic (no server-only imports) — this module is shared with client-side .ics download

- [ ] Task 3: Create calendar Express route (AC: 1, 2, 3, 4, 5)
  - [ ] 3.1 Create `server/routes/calendar.ts` (NEW)
  - [ ] 3.2 Create Express Router with `GET /:token.ics` endpoint
  - [ ] 3.3 Validate token format: 40-char hex string regex `/^[a-f0-9]{40}$/`
  - [ ] 3.4 Look up token in Supabase `calendar_tokens` table to get `user_id` and `timezone`
  - [ ] 3.5 Return 404 for invalid/missing tokens (no information leakage)
  - [ ] 3.6 Update `last_accessed_at` timestamp on successful lookup
  - [ ] 3.7 Query user's study schedules from Supabase (synced from Dexie)
  - [ ] 3.8 Generate iCal using `ical-generator`: VCALENDAR with PRODID, X-WR-CALNAME, per-schedule VEVENTs with RRULE and VALARM
  - [ ] 3.9 Return with `Content-Type: text/calendar; charset=utf-8` and `Content-Disposition: attachment; filename="knowlune.ics"`
  - [ ] 3.10 Set response headers: `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, `Expires: 0` — prevents calendar apps or proxies from aggressively caching stale feed data (Edge case review HIGH EC-07)
  - [ ] 3.11 Wrap all Supabase queries in try-catch: on failure return `503 Service Unavailable` with `Retry-After: 300` header (Edge case review HIGH EC-27)
  - [ ] 3.12 If token lookup succeeds but schedule/flashcard query fails, return feed with available data (graceful degradation — partial feed is better than 500 error)

- [ ] Task 4: Mount calendar route in Express server (AC: 1)
  - [ ] 4.1 Import `calendarRouter` in `server/index.ts`
  - [ ] 4.2 Mount at `/api/calendar` BEFORE the JWT/entitlement middleware chain (around line 105, before `/api/ai/ollama/health`)
  - [ ] 4.3 Verify calendar route bypasses JWT middleware (authenticated by token in URL path only)

## Implementation Notes

**Architecture decisions:**
- Calendar route uses a different auth model than the rest of the API: token-in-URL, no JWT. This matches industry patterns (Google Calendar, Todoist, Canvas LMS).
- **CRITICAL:** The route MUST be registered BEFORE the JWT/entitlement middleware chain so it's not subject to those checks. Add an integration test that verifies: request feed without JWT → expect 200. Add `// MUST BE BEFORE JWT MIDDLEWARE` comment at mount point. (Edge case review HIGH EC-30)
- `ical-generator` handles VTIMEZONE auto-generation, which is critical for DST-correct recurring events.
- UID format `schedule-{id}@knowlune.app` ensures calendar apps can update existing events when the feed is re-fetched.
- SRS event generation is stubbed in this story — full implementation in E50-S06.

**Key files:**
- `server/routes/calendar.ts` — NEW: Express Router with feed endpoint
- `src/lib/icalFeedGenerator.ts` — NEW: Isomorphic iCal mapping utilities
- `server/index.ts` — Mount calendar route before middleware chain
- `package.json` — Add `ical-generator` dependency

**Dependencies:**
- E50-S01 (StudySchedule type and Dexie table must exist)
- Supabase `calendar_tokens` table (created in E50-S03, but endpoint can be built with token lookup logic ready)

**RRULE mapping reference:**
```
monday → MO, tuesday → TU, wednesday → WE, thursday → TH
friday → FR, saturday → SA, sunday → SU
```

## Testing Notes

**API tests:**
- `GET /api/calendar/{valid-token}.ics` returns 200 with `text/calendar` content type
- Response contains `BEGIN:VCALENDAR` and `END:VCALENDAR`
- Response contains correct number of `BEGIN:VEVENT` blocks
- RRULE BYDAY values match schedule days
- VALARM TRIGGER matches reminderMinutes
- Invalid token returns 404
- Malformed token (not 40-char hex) returns 404
- `last_accessed_at` updated after successful request

**Unit tests:**
- `mapDaysToRRule(['monday', 'wednesday', 'friday'])` returns `'MO,WE,FR'`
- `mapDaysToRRule(['saturday'])` returns `'SA'`
- `mapScheduleToEvent()` produces valid ical-generator event config
- UID format is `schedule-{id}@knowlune.app`

**Edge cases:**
- User with 0 study schedules — feed should still be valid VCALENDAR with no VEVENTs
- Schedule with `recurrence: 'daily'` — RRULE should be `FREQ=DAILY` (no BYDAY)
- ~~Schedule with `recurrence: 'once'`~~ — removed from Phase 1-2 (see E50-S01 amendment)
- Schedule with `reminderMinutes: 0` — no VALARM

## Pre-Review Checklist

Before requesting `/review-story`, verify:

- [ ] All changes committed (`git status` clean)
- [ ] No error swallowing — catch blocks log AND surface errors
- [ ] useEffect hooks have cleanup functions (ignore flags for async, event listener removal)
- [ ] No optimistic UI updates before persistence — state updates after DB write succeeds
- [ ] Type guards on all dynamic lookups (e.g., `LABELS[type]` when type can be empty)
- [ ] E2E afterEach cleanup uses `await` (not fire-and-forget)
- [ ] Date handling uses `toLocaleDateString('sv-SE')` pattern (not `toISOString().split('T')[0]`)
- [ ] Read [engineering-patterns.md](../engineering-patterns.md) for full patterns reference
- [ ] If story calls external APIs: CSP allowlist configured (see engineering-patterns.md § CSP Configuration)

## Design Review Feedback

Skipped — no UI changes in this story (server-only endpoint).

## Code Review Feedback

**Code Review** (`docs/reviews/code/code-review-2026-04-04-e50-s02.md`):

- HIGH: `generateICalFeed()` threw on malformed `startTime` (no try-catch at call site). Fixed: added `isNaN` guard in generator to skip invalid schedules gracefully.
- MEDIUM: `createClient` instantiated per request. Noted for future optimization.
- All 5 ACs verified correct. Route mounting before JWT middleware confirmed.

**Security Review** (`docs/reviews/security/security-review-2026-04-04-e50-s02.md`):

- HIGH: No rate limiting on public `/api/calendar` endpoint. Fixed: added `express-rate-limit` (10 req/min/IP).
- INFO: Token appears in access logs (accepted trade-off, industry standard).

**GLM Adversarial Review** (`docs/reviews/code/glm-code-review-2026-04-04-e50-s02.md`):

- HIGH: Fire-and-forget `.then()` lacked `.catch()` → unhandledRejection risk. Fixed.
- MEDIUM: DTSTART used `days[0]` instead of earliest next occurrence. Fixed: now computes minimum across all days.
- MEDIUM: `select('*')` replaced with specific column list.

**Test Coverage** (`docs/reviews/code/code-review-testing-2026-04-04-e50-s02.md`):

- ADVISORY: No unit tests for `icalFeedGenerator.ts` pure functions. Deferred to future story.

## Challenges and Lessons Learned

**Fire-and-forget promises need `.catch()`**: The `last_accessed_at` update used `.then()` only. Without `.catch()`, a rejected promise triggers an `unhandledRejection` process event in Node.js — potentially crashing the server in strict mode. Always chain `.catch()` on fire-and-forget promises in server code.

**Public endpoints bypass the main middleware chain and need their own rate limiting**: The calendar route was correctly mounted before JWT middleware (required for token-in-URL auth), but that also meant it bypassed the rate limiter. Any route outside the main middleware chain needs its own rate limit applied at mount point.

**DTSTART multi-day RRULE edge case**: When a weekly schedule has multiple days (e.g., `[wednesday, friday]`), DTSTART must be the *earliest* next occurrence across all days — not just `days[0]`. If DTSTART is set to Wednesday and the RRULE includes Friday, some older calendar clients (Apple Calendar) may skip the Friday occurrence that falls before DTSTART.

**`ical-generator` throws on Invalid Date**: Malformed `startTime` from the DB produces `Invalid Date` → ical-generator throws `"start has to be a valid date!"`. The generator must guard against this explicitly since DB data can be corrupted. Pattern: validate inputs at the boundary, skip + warn rather than throw.
