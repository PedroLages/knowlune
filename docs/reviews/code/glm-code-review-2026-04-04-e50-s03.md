## External Code Review: E50-S03 — GLM (glm-5.1)

**Model**: GLM (glm-5.1)
**Date**: 2026-04-04
**Story**: E50-S03

### Findings

#### Blockers
*(None)*

#### High Priority
*(None)*

#### Medium

- **[src/stores/useStudyScheduleStore.ts:165-180] (confidence: 85)**: `regenerateFeedToken` performs a non-atomic DELETE then INSERT. If the INSERT fails (e.g., network error, constraint violation), the old token is already deleted and the user has **no active token** — but `feedToken` in local state remains `null` (correctly reflects DB, but the old URL is already gone). More critically, if two browser tabs regenerate concurrently, the second INSERT could fail with a UNIQUE violation on `user_id` (since `generateFeedToken` uses upsert but `regenerateFeedToken` does a raw INSERT after delete). Fix: Use upsert (like `generateFeedToken` does) instead of raw INSERT after delete. This makes the operation idempotent: `supabase.from('calendar_tokens').upsert({ user_id: user.id, token, timezone }, { onConflict: 'user_id' })`. The delete-then-insert approach is only needed if you specifically want to guarantee the old token is invalidated *before* the new one exists — but since the operation is client-side and the window is tiny, upsert is safer.

- **[src/stores/useStudyScheduleStore.ts:102-109] (confidence: 72)**: `loadFeedToken` catches errors silently — it only `console.error`s but never notifies the user or sets any error state. If the feed was previously enabled (`feedEnabled: true` in persisted Zustand state) and the token load fails on a subsequent app visit, the UI will show the feed as enabled with a stale/null token and `getFeedUrl()` returns `null`, producing a broken UX with no feedback. Fix: Either set `feedEnabled: false, feedToken: null` in the catch block, or surface an error to the user so they know the feed state couldn't be verified.

#### Nits

- **[supabase/migrations/002_calendar_tokens.sql:8+19] (confidence: 60)**: The `unique_user_token` constraint (`UNIQUE (user_id)`) and the existing `token TEXT NOT NULL UNIQUE` are both defined, which is correct. However, the `UNIQUE (user_id)` constraint already implicitly creates an index on `user_id`, making `idx_calendar_tokens_token` the only necessary additional index. The explicit index on `token` is correct and good for lookups. No action needed — just noting the dual uniqueness is intentional.

- **[src/lib/icalFeedGenerator.ts:163] (confidence: 55)**: `generateIcsDownload` appends and immediately removes the anchor from `document.body`. In some browser security contexts (e.g., strict CSP or sandboxed iframes), `document.body.appendChild` may throw. This is a minor edge case since this is a user-triggered action in the main frame. Worth a try/catch if CSP is ever tightened.

---
Issues found: 4 | Blockers: 0 | High: 0 | Medium: 2 | Nits: 2
