## Exploratory QA Report: E77A-S04 — Backup Metadata Tracking and Status

**Date:** 2026-06-22
**Routes tested:** 1 (`/settings?section=integrations`)
**Health score:** 90/100

### Health Score Breakdown

| Category    | Score | Weight | Weighted   |
| ----------- | ----- | ------ | ---------- |
| Functional  | 85    | 30%    | 25.5       |
| Edge Cases  | 90    | 15%    | 13.5       |
| Console     | 85    | 15%    | 12.75      |
| UX          | 85    | 15%    | 12.75      |
| Links       | 100   | 10%    | 10.0       |
| Performance | 100   | 10%    | 10.0       |
| Content     | 100   | 5%     | 5.0        |
| **Total**   |       |        | **90/100** |

### Top Issues

1. Aria-label on "Send to Drive" button is inconsistent with visual button text when token state is unknown ("Connect Google Drive" vs "Send to Drive").
2. Two pre-existing console errors from sync engine (`quiz_attempts.updated_at` and `ai_usage_events.updated_at` missing columns).
3. JSON export guard could allow rapid duplicate export initiation due to React state batching.

### Bugs Found

#### BUG-001: Aria-label inconsistency on Send to Drive button when token state is unknown

**Severity:** Low
**Category:** UX
**Route:** `/settings?section=integrations`
**AC:** General

**Steps to Reproduce:**

1. Navigate to Settings > Integrations & Data as a logged-in user
2. Scroll to the "Google Drive Backup" section
3. Inspect the "Send to Drive" button's aria-label and visual text

**Expected:** The aria-label should match the visual button text. When the button says "Send to Drive", the aria-label should also convey "Send to Drive", not "Connect Google Drive".

**Actual:** When `knownTokenState` is `'untested'` (initial page load), the button visually reads "Send to Drive" but the aria-label reads "Connect Google Drive". This is because the aria-label logic checks `knownTokenState === 'present'` vs everything else, while the button text checks `knownTokenState === 'present' || knownTokenState === 'untested'` vs `knownTokenState === 'absent'`.

**Evidence:**

- Button text: "Send to Drive" (line 302 of DataAndBackupPanel.tsx)
- Aria-label: "Connect Google Drive" (line 286 of DataAndBackupPanel.tsx)
- The aria-label condition at line 285 checks `knownTokenState === 'present'`, defaulting to "Connect Google Drive" for both 'untested' and 'absent' states. But the button text shows "Send to Drive" for 'untested', creating an inconsistency.

**File:** `src/app/components/settings/DataAndBackupPanel.tsx`
**Lines:** 285-290 (aria-label) vs 299-303 (button text)

### AC Verification

| AC# | Description                                                                                                                                  | Status | Notes                                                                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Given a backup is created locally When the export completes Then `lastLocalAt` metadata is updated with the current timestamp                | Pass   | Verified by clicking JSON export button and checking localStorage. `lastLocalAt` was set to the export timestamp. Also verified via unit tests (7 `updateBackupMeta` tests all pass).                                      |
| 2   | Given a backup is uploaded to Google Drive When the drive upload completes Then `lastDriveAt` metadata is updated with the current timestamp | Pass   | Verified by directly calling `updateBackupMeta('drive')` in-browser and checking localStorage. `lastDriveAt` was correctly set. Unit tests confirm the same. Full Drive upload E2E requires valid Google OAuth token.      |
| 3   | Given the user opens Settings > Data & Backup When the page loads Then the last backup timestamps are displayed for each backup type         | Pass   | All three states verified: "No backup yet" (empty), "Last backup: 5 minutes ago (Local)" (recent local), "Last backup: 10 minutes ago (Drive)" (recent drive). Banner correctly shows destination label and relative time. |
| 4   | Given the last backup was more than 30 days ago When the Data & Backup page renders Then a stale backup warning is shown                     | Pass   | Seeded a backup 45 days old - banner shows "Last backup was about 2 months ago (Local)" with `data-stale="true"`, red icon, and descriptive text about creating a fresh backup.                                            |

### Console Health

| Level    | Count                                      | Notable                                                                                                                                                                                                                                                                                                               |
| -------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Errors   | 83 total (81 Supabase 400s, 2 sync engine) | The 400 errors from supabase endpoints (`supabase.co`) are expected in dev without valid Supabase config. Two sync engine errors for `quiz_attempts.updated_at` and `ai_usage_events.updated_at` missing columns are pre-existing and unrelated to E77A-S04. Zero application-level errors from backup/metadata code. |
| Warnings | 2                                          | "Unable to determine content-length from response headers" from embedding model download (pre-existing, unrelated to story).                                                                                                                                                                                          |
| Info     | 22                                         | Normal initialization logs (Perf, SessionStore, EmbeddingWorker). No debug logs in production code paths.                                                                                                                                                                                                             |

### What Works Well

1. **Reactive UI**: The backup status banner uses a `settingsUpdated` custom event listener to reactively update when `updateBackupMeta` is called, without requiring a page reload. This was verified by dynamically modifying localStorage with different backup metadata states and seeing the banner update within 1 second.

2. **All three states handled gracefully**: The "never backed up" state provides an encouraging onboarding message, the "recent backup" state is green and concise, and the "stale backup" state clearly shows the problem with actionable guidance. The data attribute system (`data-stale`, `data-never`) enables proper test targeting.

3. **Sentinel value resilience**: When `lastLocalAt` and `lastDriveAt` are both `0` (falsy sentinel values), the code correctly falls back to "No backup yet" state, treating `0` the same as `undefined`. This prevents incorrect "Jan 1, 1970" display scenarios.

4. **Destination fallback logic**: When `lastDestination` is not explicitly set, the code intelligently falls back to whichever destination has the latest timestamp. Tested with both local and Drive backups - correctly picked the more recent Drive backup (1 minute ago) over the older local backup (5 days ago) and displayed "(Drive)" label.

---

Health: 90/100 | Bugs: 1 | Blockers: 0 | ACs: 4/4 verified
