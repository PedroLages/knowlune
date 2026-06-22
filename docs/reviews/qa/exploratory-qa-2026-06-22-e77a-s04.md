## Exploratory QA Report: E77A-S04 — Backup Metadata Tracking and Status

**Date:** 2026-06-22
**Routes tested:** 1 (`/settings?section=integrations`)
**Health score:** 80/100

### Health Score Breakdown

| Category    | Score | Weight | Weighted   |
| ----------- | ----- | ------ | ---------- |
| Functional  | 60    | 30%    | 18.0       |
| Edge Cases  | 80    | 15%    | 12.0       |
| Console     | 80    | 15%    | 12.0       |
| UX          | 90    | 15%    | 13.5       |
| Links       | 100   | 10%    | 10.0       |
| Performance | 90    | 10%    | 9.0        |
| Content     | 100   | 5%     | 5.0        |
| **Total**   |       |        | **80/100** |

### Top Issues

1. AC3 (custom destination) is unimplemented — `updateBackupMeta()` only supports 'local' and 'drive' types
2. AC5 stale threshold uses 30 days in code vs 7 days specified in acceptance criteria
3. Destination label can misrepresent which source produced the latest backup when timestamps and lastDestination are out of sync

### Bugs Found

#### BUG-001: AC3 Custom destination not implemented

**Severity:** High
**Category:** Functional
**Route:** `/settings?section=integrations`
**AC:** AC3

**Steps to Reproduce:**

1. Review the `updateBackupMeta` function signature in `src/lib/exportService.ts`
2. Review the `BackupMeta` interface in `src/lib/settings.ts`

**Expected:** The function and type should support a 'custom' destination option per AC3: "Given a backup is sent to a custom destination... Then lastDestination metadata is updated."

**Actual:** `updateBackupMeta(destination: 'local' | 'drive')` only accepts 'local' or 'drive'. The `lastDestination` type in `BackupMeta` is also restricted to `'local' | 'drive'`. No custom destination flow exists in the UI or export pipeline.

**Evidence:**

- Type definition: `lastDestination?: 'local' | 'drive'`
- Function: `export function updateBackupMeta(destination: 'local' | 'drive'): void`

---

#### BUG-002: AC5 stale threshold mismatch — code uses 30 days, AC specifies 7 days

**Severity:** High
**Category:** Functional
**Route:** `/settings?section=integrations`
**AC:** AC5

**Steps to Reproduce:**

1. Set backupMeta with `lastLocalAt` set to 10 days ago (which is > 7 days per AC, but < 30 days per code)
2. Navigate to Settings > Data & Backup
3. Observe the backup status banner

**Expected (per AC5):** Stale warning should appear when backup is more than 7 days old.

**Actual:** Stale warning only appears after 30 days (`THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000`). A 10-day-old backup shows "Your data is up to date" with `data-stale="false"`.

**Evidence:**

- Code: `const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000` (DataAndBackupPanel.tsx:19)
- AC: "Given the last backup was more than 7 days ago... Then a stale backup warning is shown."
- Test result: 10-day backup shows `data-stale: false` and "Your data is up to date."

---

#### BUG-003: Destination label can misrepresent backup source when timestamps and lastDestination diverge

**Severity:** Medium
**Category:** UX
**Route:** `/settings?section=integrations`
**AC:** General

**Steps to Reproduce:**

1. Set backupMeta with: `{ lastLocalAt: <1 hour ago>, lastDriveAt: <1 day ago>, lastDestination: 'drive' }`
2. Navigate to Settings > Data & Backup
3. Observe the banner reads "Last backup: about 1 hour ago (Drive)"

**Expected:** The banner should accurately reflect that the most recent backup was Local (1 hour ago), not Drive.

**Actual:** The timestamp correctly uses the latest of both `lastLocalAt` and `lastDriveAt`, but the label comes from `lastDestination`, which may point to an older destination. This creates a misleading display where the timestamp is from one source but the label says another.

**Evidence:**

```javascript
const latestTimestamp = Math.max(lastLocalAt ?? 0, lastDriveAt ?? 0)  // max of both
// ...
if (lastDestination === 'drive') {
    destLabel = 'Drive'  // always uses lastDestination, not the source of the latest timestamp
```

**Note:** This scenario is unlikely in normal use (since `updateBackupMeta` updates `lastDestination` to match the destination being written). It only manifests with manually crafted or migrated data.

### AC Verification

| AC# | Description                                       | Status      | Notes                                                                                                               |
| --- | ------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Local backup creates `lastLocalAt` timestamp      | **Pass**    | `updateBackupMeta('local')` correctly writes `lastLocalAt` (verified via function call and localStorage inspection) |
| 2   | Drive backup creates `lastDriveAt` timestamp      | **Pass**    | `updateBackupMeta('drive')` correctly writes `lastDriveAt` and updates `lastDestination`                            |
| 3   | Custom destination updates `lastDestination`      | **Fail**    | No custom destination flow exists. Type and function only support 'local' and 'drive'                               |
| 4   | Backup timestamps displayed on Data & Backup page | **Pass**    | Banner correctly shows "just now", "X days ago", "about X months ago" with destination label                        |
| 5   | Stale backup warning for > threshold              | **Partial** | Stale warning is displayed at 30+ days (implementation), but AC specifies 7 days (BUG-002)                          |

### Console Health

| Level    | Count | Notable                                                                                                                                                        |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Errors   | 41    | All are pre-existing Supabase sync errors (400 on missing columns `quiz_attempts.updated_at` and `ai_usage_events.updated_at`). None introduced by this story. |
| Warnings | 1     | Playwright/Vite content-length warning (not app-related)                                                                                                       |
| Info     | 1     | React DevTools download suggestion                                                                                                                             |

**Story-specific console issues:** None. The backup metadata feature introduces no new console errors or warnings.

### What Works Well

1. **Empty state UX**: The "No backup yet" state is clearly presented with helpful guidance text ("Export your data or connect Google Drive to keep a safe copy") and a visual warning icon. New users immediately understand their backup status.

2. **Timestamp display**: The `formatRelativeTime` helper provides human-friendly output including "just now" for very recent backups and relative time strings from `date-fns` for older ones.

3. **Robust edge case handling**: Null `backupMeta`, empty objects, and missing timestamps all degrade gracefully to the "No backup yet" state instead of crashing or showing garbled data.

4. **State persistence**: Backup metadata is stored in localStorage and survives navigation between settings sections, full page reloads, and hard refreshes.

---

Health: 80/100 | Bugs: 3 | Blockers: 0 | High: 2 | Medium: 1 | ACs: 3/5 verified (1 pass, 1 partial, 1 fail)
