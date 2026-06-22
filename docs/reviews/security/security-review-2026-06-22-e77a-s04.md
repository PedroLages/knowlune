## Security Review: E77A-S04 — Backup metadata tracking and status

**Date:** 2026-06-22
**Phases executed:** 4/8
**Diff scope:** 19 files changed, 1946 insertions, 662 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 0 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 5 categories checked |
| 8 | Config Security | Always-on | Clean |

Phases 4-7 not triggered: no package.json changes, no auth files changed, no new routes/components, no config files changed.

### Attack Surface Changes

This story adds backup metadata tracking (`BackupMeta` interface with `lastLocalAt`, `lastDriveAt`, `lastDestination`) to `AppSettings` in localStorage, and a backup status banner in the Data & Backup settings panel. No new API endpoints, no new user input fields, no new network requests, no new third-party integrations.

**Key change:** `updateBackupMeta` writes timestamps to localStorage via `saveSettings`. Called from two trusted internal paths:
- `SettingsPageContext.tsx` — after local JSON export completes
- `DataAndBackupPanel.tsx` — after Google Drive upload succeeds

### Findings

No findings. The diff introduces no security-relevant attack surface.

### Secrets Scan

Clean — no API keys, tokens, passwords, or other secrets detected in the diff.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS2: Client-Side Injection (XSS) | Yes | No | All dynamic content rendered through React JSX auto-escaping. No `dangerouslySetInnerHTML`, no `href={variable}`, no `ref.current.innerHTML`, no `data:` or `javascript:` protocols. |
| CS3: Sensitive Data in Client Storage | Yes | No | `backupMeta` stores only timestamps (number) and destination label (`'local'`/`'drive'`). No secrets, tokens, or PII. The `app-settings` key is correctly in the export allowlist. |
| CS5: Client-Side Integrity | Yes | No | `Date.now()` timestamps are correct and deterministic. The `destination` parameter relies on TypeScript type enforcement (no runtime validation), but all call sites use hardcoded `'local'` or `'drive'` strings. `saveSettings` merges partial objects correctly. |
| CS7: Client-Side Security Logging | Yes | No | No new `console.log` of sensitive data. Only `console.warn` for Supabase profile sync failure — pre-existing, not introduced in this diff. |
| CS9: Client-Side Communication | Yes | No | `window.dispatchEvent(new Event('settingsUpdated'))` fires with no payload. The handler in `DataAndBackupPanel` only re-reads settings. No data leakage via events. |
| A05: Security Misconfiguration | No | N/A | No config files changed. |

### What's Done Well

1. **Export allowlist extended correctly**: The `backupMeta` is stored as part of `app-settings` in localStorage, which is already in the `EXPORTABLE_LS_PREFIXES` allowlist. The export correctly includes backup metadata (appropriate — no secrets are stored in it).

2. **Event-driven UI update without data leakage**: The `settingsUpdated` custom event carries no payload — it merely signals a reload. The component re-reads settings from localStorage directly, avoiding any data injection through the event mechanism.

3. **Graceful error handling in date formatting**: `formatRelativeTime` wraps `formatDistanceToNow` in a try/catch, returning `'unknown'` if the timestamp is malformed. The `getLastBackupDisplay` function handles both `undefined` and `0` timestamps correctly through explicit `!== undefined` checks.

---
Phases: 4/8 | Findings: 0 total | Blockers: 0 | False positives filtered: 0
