# Test Coverage Review — E50-S02: iCal Feed Generation Endpoint

**Date:** 2026-04-04
**Story:** E50-S02 — iCal Feed Generation Endpoint
**Reviewer:** Test Coverage Agent
**Branch:** feature/e50-s02-ical-feed-generation-endpoint

---

## Coverage Assessment

### Unit Tests — MISSING

The story's Testing Notes specify unit tests for `mapDaysToRRule`, `mapScheduleToEvent`, and `generateICalFeed`. **No unit test files were added in this branch.**

**Gap:** `src/lib/icalFeedGenerator.ts` has 0% unit test coverage.

**AC Mapping:**

| Test Case (from story) | Covered? |
|------------------------|----------|
| `mapDaysToRRule(['monday', 'wednesday', 'friday'])` → `'MO,WE,FR'` | ❌ No test |
| `mapDaysToRRule(['saturday'])` → `'SA'` | ❌ No test |
| `mapScheduleToEvent()` produces valid ical-generator config | ❌ No test |
| UID format is `schedule-{id}@knowlune.app` | ❌ No test |
| Empty schedules → valid VCALENDAR | ❌ No test |
| `recurrence: 'daily'` → `RRULE:FREQ=DAILY` | ❌ No test |
| `reminderMinutes: 0` → no VALARM | ❌ No test |
| `reminderMinutes: 15` → `TRIGGER:-PT15M` | ❌ No test |

### E2E/API Tests — MISSING

No `tests/e2e/story-e50-s02.spec.ts` exists. The server route has no integration tests.

**Gap:** The Express route itself (`GET /:token.ics`) has no automated test coverage.

**AC Mapping:**

| AC | Test Coverage |
|----|---------------|
| AC1 — Content-Type + VCALENDAR | ❌ No test |
| AC2 — 3 schedules → 3 VEVENTs with RRULE | ❌ No test |
| AC3 — VALARM with TRIGGER:-PT15M | ❌ No test |
| AC4 — Invalid token → 404 | ❌ No test |
| AC5 — last_accessed_at updated | ❌ No test |

---

## Recommendation

Since this is a server-only endpoint (no UI), Playwright browser E2E tests are not appropriate. Instead:

1. **Unit tests** for `src/lib/icalFeedGenerator.ts` using Vitest — pure functions, easy to test:
   ```typescript
   // src/lib/__tests__/icalFeedGenerator.test.ts
   import { mapDaysToRRule, generateICalFeed } from '../icalFeedGenerator'
   // Mock schedule factory, test PRODID, VEVENTs count, RRULE, VALARM
   ```

2. **API integration tests** for `server/routes/calendar.ts` using Supertest:
   ```typescript
   // server/__tests__/routes/calendar.test.ts
   import request from 'supertest'
   // Mock Supabase client, test 200/404 responses, Content-Type header
   ```

The missing unit tests are the most valuable — `mapDaysToRRule` and `generateICalFeed` are pure functions that can be tested without mocking anything.

---

**Verdict:** ADVISORY — All 5 ACs lack automated test coverage. Unit tests for the generator utility are missing and recommended. The implementation appears correct (manually verified), but absence of tests means regressions won't be caught.
