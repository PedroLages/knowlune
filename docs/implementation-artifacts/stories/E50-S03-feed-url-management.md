---
story_id: E50-S03
story_name: "Feed URL Management"
status: draft
started:
completed:
reviewed: false
review_started:
review_gates_passed: []
burn_in_validated: false
---

# Story 50.03: Feed URL Management

## Story

As a learner,
I want to generate and manage my calendar feed URL,
So that I can subscribe in my calendar app and revoke access if the URL is compromised.

## Acceptance Criteria

**AC1:** Given a user enables the calendar feed, when the toggle is switched on, then a 40-char hex token is generated and stored in Supabase.

**AC2:** Given a user with an active token, when they click "Regenerate", then the old token is deleted, a new one is created, and the feed URL updates.

**AC3:** Given a user clicks "Download .ics", when they have 2 study schedules, then a `.ics` file is downloaded containing 2 VEVENT components.

**AC4:** Given a user disables the calendar feed, when the toggle is switched off, then the token is deleted from Supabase and the old feed URL stops working.

## Tasks / Subtasks

- [ ] Task 1: Create `calendar_tokens` Supabase table (AC: 1, 2, 4)
  - [ ] 1.1 Create Supabase migration SQL for `calendar_tokens` table
  - [ ] 1.2 Columns: id (UUID PK), user_id (UUID FK → auth.users, CASCADE), token (TEXT UNIQUE), timezone (TEXT DEFAULT 'UTC'), created_at (TIMESTAMPTZ), last_accessed_at (TIMESTAMPTZ)
  - [ ] 1.3 Add `CONSTRAINT unique_user_token UNIQUE (user_id)` — one active token per user
  - [ ] 1.4 Add index: `CREATE INDEX idx_calendar_tokens_token ON calendar_tokens(token)`
  - [ ] 1.5 Add RLS policies for authenticated user access

- [ ] Task 2: Add token management to Zustand store (AC: 1, 2, 4)
  - [ ] 2.1 Add to `src/stores/useStudyScheduleStore.ts`:
    - `feedToken: string | null` state
    - `feedEnabled: boolean` state
  - [ ] 2.2 Implement `generateFeedToken()` — creates 40-char hex token via Supabase insert, returns feed URL
  - [ ] 2.3 Implement `regenerateFeedToken()` — deletes old row, inserts new token (old URL instantly invalidated)
  - [ ] 2.4 Implement `loadFeedToken()` — queries Supabase for current user's token
  - [ ] 2.5 Implement `disableFeed()` — deletes token row from Supabase (disables subscription)
  - [ ] 2.6 Token generation: Use Web Crypto API (NOT Node's crypto.randomBytes which crashes in browser): `Array.from(crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2, '0')).join('')` for 160-bit entropy (Edge case review HIGH EC-36)
  - [ ] 2.7 Add debounce/disable on feed toggle Switch during async Supabase operations to prevent race condition from rapid on/off toggling (Edge case review HIGH EC-38)

- [ ] Task 3: Add client-side `.ics` download function (AC: 3)
  - [ ] 3.1 Add `generateIcsDownload(schedules: StudySchedule[])` to `src/lib/icalFeedGenerator.ts`
  - [ ] 3.2 Map schedules to iCal format (reuse `mapScheduleToEvent()` from E50-S02)
  - [ ] 3.3 Create Blob with `text/calendar` MIME type
  - [ ] 3.4 Trigger browser download via `URL.createObjectURL()` + anchor click + `URL.revokeObjectURL()` cleanup
  - [ ] 3.5 Does NOT include SRS events (those require server-side flashcard query)

## Implementation Notes

**Architecture decisions:**
- Token stored in Supabase (server-side data), not Dexie — feed tokens must be accessible by the Express server for validation.
- One active token per user enforced by `unique_user_token` constraint — regeneration replaces the old token atomically.
- Token generation uses Web Crypto API `crypto.getRandomValues(new Uint8Array(20))` for 160-bit entropy — sufficient for unguessable URLs. Do NOT use Node's `crypto.randomBytes` (crashes in browser).
- Client-side `.ics` download reads from Dexie (offline-capable) but does NOT include SRS events (those require server-side flashcard aggregation).
- `URL.revokeObjectURL()` must be called after download to prevent memory leaks.

**Key files:**
- `src/stores/useStudyScheduleStore.ts` — Add feedToken state and token CRUD methods
- `src/lib/icalFeedGenerator.ts` — Add `generateIcsDownload()` function
- Supabase migration — NEW `calendar_tokens` table

**Dependencies:**
- E50-S01 (StudySchedule type and store must exist)
- E50-S02 (iCal mapping utilities: `mapScheduleToEvent()`)
- Supabase auth infrastructure (E19 — already exists)

## Testing Notes

**E2E tests:**
- Enable feed toggle → verify token created in Supabase
- Regenerate → verify old token deleted, new token different
- Disable toggle → verify token deleted
- Download .ics → verify file downloaded with correct VEVENT count

**Unit tests:**
- `generateFeedToken()` produces 40-char hex string
- `regenerateFeedToken()` creates different token each time
- `generateIcsDownload()` creates valid iCal Blob
- `generateIcsDownload()` with 0 schedules produces valid empty VCALENDAR

**Edge cases:**
- User enables feed twice rapidly (idempotent — should not create duplicate tokens)
- Regenerate when no token exists (should create new token, not error)
- Download .ics with 0 schedules (should produce valid but empty calendar file)
- Network failure during Supabase token generation (error handling with toast)

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

[Populated by /review-story — Playwright MCP findings]

## Code Review Feedback

[Populated by /review-story — adversarial code review findings]

## Challenges and Lessons Learned

[Document issues, solutions, and patterns worth remembering]
