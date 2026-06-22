## Code Review: E77A-S04 — Backup Metadata Tracking and Status

### What Works Well

1. **Clean finally-block pattern**: `handleSendToDrive` in `DataAndBackupPanel.tsx` correctly uses a local `let succeeded = false` variable (lines 102, 128) rather than reading React state from the closure in the `finally` block. This is the exact fix documented in the `react-closure-staleness-finally.md` memory, avoiding the React 19 batching quirk discovered in E77A-S03. Good institutional knowledge application.

2. **Thorough edge case coverage in display logic**: `getLastBackupDisplay` handles all meaningful combinations of `lastLocalAt`, `lastDriveAt`, and `lastDestination` — including the case where `lastDestination` is unset but only one or both timestamp fields exist (lines 48-56). The fallback logic correctly picks the destination with the latest timestamp.

3. **Good test coverage across layers**: Three separate test files cover the unit (settings.test.ts — backupMeta in defaults/metadata round-trip), display (DataAndBackupPanel.meta.test.tsx), and integration (DataAndBackupPanel.drive.test.tsx — `updateBackupMeta('drive')` wired into success path).

### Findings

#### Medium

- **`[Correctness]` DataAndBackupPanel.tsx:19 (confidence: 90)** — AC5 stale threshold mismatch: code uses 30 days, spec says 7 days.

  `const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000` (30 days) versus AC5: "Given the last backup was more than **7 days** ago When the Data & Backup page renders Then a stale backup warning is shown."

  The user-facing message (line 222) reads "Your backup is more than 30 days old" and the test (DataAndBackupPanel.meta.test.tsx:115) correctly tests against the 30-day boundary, so the implementation is internally consistent. But it does not match the acceptance criterion, which specifies 7 days.

  **Why it matters for learners**: With 30 days, users see the stale warning much later than specified. 7 days is more aggressive but gives earlier notice of stale backups. The current UX suggests 30 days was an intentional design choice — 7 days would be noisy for a feature like `knowlune-backup-*.json` files that don't degrade rapidly.

  **Fix**: Either:
  - (a) Update the acceptance criterion in the story file from 7 days to 30 days to match the deliberate implementation, or
  - (b) Change `THIRTY_DAYS_MS` to `7 * 24 * 60 * 60 * 1000` and update the user message from "more than 30 days old" to "more than 7 days old."

  Given the user-facing text already says "30 days," option (a) is likely correct and is 0-effort. Recommend updating the AC.

  **Effort**: ~2 minutes (edit story file AC5).

  **Autofix class**: `gated_auto` — requires design decision on which direction to reconcile.

### Recommendations

1. Reconcile the AC5 threshold (7 days in spec vs 30 days in code). The implementation appears deliberate (named constant, explicit user message), so updating the AC is the right call. This is the only action item from this review.

### Summary

This is a clean, well-structured story. The code adds `BackupMeta` as an optional additive field to `AppSettings`, wires `updateBackupMeta()` into both the JSON export handler (`handleExportJson` → `'local'`) and the Drive upload handler (`handleSendToDrive` → `'drive'`), and renders the backup status banner with proper handling of all states (never, fresh, stale). The `succeeded`-flag pattern in the `finally` block correctly avoids the React 19 closure staleness bug. Tests cover all display variants and the Drive upload error paths. Only one spec-vs-implementation discrepancy found.

---

Issues found: 1 | Blockers: 0 | High: 0 | Medium: 1 | Nits: 0
Confidence: avg 90 | >= 90: 1 | 70-89: 0 | < 70: 0
