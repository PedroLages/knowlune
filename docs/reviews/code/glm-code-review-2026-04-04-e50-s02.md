## External Code Review: E50-S02 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-04
**Story**: E50-S02

### Findings

#### Blockers
- **[server/routes/calendar.ts:36 (confidence: 95)]**: `VITE_SUPABASE_URL` is a client-side env var (exposed by Vite via `VITE_` prefix). Using it on the server works if the env file loads, but this naming convention is misleading and risks confusion. However, the real issue is that if this file is ever imported in a Vite client bundle (it's under `server/` so unlikely), the env var would be exposed. **Minor concern.** The actual blocker-level issue: none found.

#### High Priority
- **[src/lib/icalFeedGenerator.ts:79 (confidence: 90)]**: `dtstart` can be `undefined` when `schedule.startTime` is malformed or missing (e.g., empty string). `":".split(':').map(Number)` yields `[NaN, NaN]`, producing `NaN` hours/minutes, making `refDate` an `Invalid Date`. This silently propagates into the ical output as broken DTSTART/DTEND lines. Fix: Add a guard: `if (isNaN(hours) || isNaN(minutes)) { console.warn(\`Skipping schedule ${schedule.id}: invalid startTime\`); continue }`.
- **[server/routes/calendar.ts:36 (confidence: 85)]**: `createClient` is called on **every request** — no connection reuse. While Supabase-js manages HTTP pooling internally, instantiating a new client per request is wasteful and can leak resources under load. Fix: Create the Supabase client once at module scope (lazily initialized), not inside the request handler.
- **[server/routes/calendar.ts:68-74 (confidence: 80)]**: Race condition / double-response risk. The `try` block calls `supabase.from(...).maybeSingle()` which could throw, and the `.then()` fire-and-forget update is started before the outer `try` completes. If the response is already sent (e.g., via `return` on line 64) and then `userId`/`timezone` are used after, this is safe — but if a future edit restructures the flow, the fire-and-forget could attempt to use an already-ended response. More critically: the `catch` on line 76 catches exceptions from the `try` block **including** any synchronous errors after `maybeSingle()`, but if `maybeSingle()` itself rejects **and** the `.then()` also rejects, the `.then()` rejection is unhandled (no `.catch()`), causing an `unhandledRejection` process event. Fix: Add `.catch()` to the fire-and-forget promise chain.
- **[src/lib/icalFeedGenerator.ts:99 (confidence: 78)]**: `dtstart.setHours(hours, minutes, 0, 0)` mutates a `Date` object that was returned from `getNextDayOccurrence`, which already set the hours. The `setHours` call is correct as an override, but when `recurrence !== 'weekly'` or `days.length === 0`, `dtstart` is the same object as `refDate` (no defensive copy). `setHours` then mutates `refDate` in place. This is currently harmless since `refDate` isn't reused, but it's fragile. Fix: Always create a new Date: `const dtstart = new Date(baseDate.getTime())` before mutating.

#### Medium
- **[src/lib/icalFeedGenerator.ts:94 (confidence: 85)]**: `getNextDayOccurrence` picks only `schedule.days[0]` as the DTSTART, but the RRULE `byDay` includes all days. If days are `[wednesday, friday]` and today is Thursday, DTSTART is set to next Wednesday, but the RRULE generates events for Wednesday **and** Friday. The first Friday occurrence would be **before** DTSTART (this Friday, 1 day from now vs next Wednesday, 6 days from now). Most iCal clients handle this correctly by skipping occurrences before DTSTART, but some (notably older Apple Calendar) may not. Fix: Compute DTSTART as the **earliest** next occurrence across all days in `schedule.days`, not just `days[0]`.
- **[src/lib/icalFeedGenerator.ts:107-110 (confidence: 75)]**: For daily recurrence, no end condition is set (no `COUNT` or `UNTIL`). This creates an infinite recurring event. Same for weekly (lines 111-116). While valid per RFC 5545, some calendar clients (Outlook) have performance issues with infinite recurrences. Fix: Consider adding an `until` date (e.g., 1 year out) or documenting that this is intentional per spec.
- **[server/routes/calendar.ts:88-99 (confidence: 72)]**: The `schedules` query uses `.eq('enabled', true)`, but the generator also checks `if (!schedule.enabled) continue` (line 67 of icalFeedGenerator.ts). The DB filter already handles this, making the client-side check redundant but harmless. However, the `select('*')` fetches all columns including potentially large fields not needed for iCal generation, wasting bandwidth. Fix: Replace `select('*')` with specific columns: `select('id, title, startTime, durationMinutes, recurrence, days, reminderMinutes, enabled')`.

#### Nits
- **[src/lib/icalFeedGenerator.ts:121-126 (confidence: 60)]**: The `generateSRSSummaryEvents` stub returns `void` instead of a string or event array. This isn't a bug yet since it's documented as a stub for E50-S06, but callers in the future will need a breaking signature change. Fix: Consider returning an empty array or string now to establish the contract.

---
Issues found: 8 | Blockers: 0 | High: 4 | Medium: 3 | Nits: 1
