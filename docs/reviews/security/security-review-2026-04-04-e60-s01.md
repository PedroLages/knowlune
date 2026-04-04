## Security Review: E60-S01 — Knowledge Decay Alert Trigger

**Date:** 2026-04-04
**Phases executed:** 5/7
**Diff scope:** 56 files changed, 1579 insertions, 253 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 3 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 6 categories checked |
| 4 | Dependencies | package.json changed | N/A — no package.json changes |
| 5 | Auth & Access | auth files changed | N/A — no auth files changed |
| 6 | STRIDE | new routes/components | 1 new service function assessed |
| 7 | Configuration | config files changed | N/A — no config files changed |

### Attack Surface Changes

This story introduces three new attack surface elements:

1. **New event bus event type `knowledge:decay`** — Carries `topic` (string from IndexedDB note tags) and `retention` (number) into the notification creation pipeline. The topic string originates from user-created note tags stored in IndexedDB, not from external/untrusted input.

2. **New notification type `knowledge-decay`** — Title and message fields interpolate the `topic` string and `retention` number into notification records persisted in IndexedDB. These are rendered via React JSX text nodes (auto-escaped).

3. **Dexie schema migration v32** — Adds `knowledgeDecay` boolean field to `notificationPreferences` table. Data-only migration with no schema index changes.

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

None.

#### Informational (awareness only)

- **`src/services/NotificationService.ts:253-254`** (confidence: 45): Topic names from IndexedDB note tags are interpolated into notification `title` and `message` fields via template literals. These strings are rendered as React JSX text children in `Notifications.tsx:247,257`, which auto-escapes HTML. No `dangerouslySetInnerHTML` is used anywhere in the notification rendering path. **No XSS risk present** — React's default escaping handles this correctly. Noting for awareness only: if a future change renders notification content as raw HTML, this would need sanitization.

- **`src/services/NotificationService.ts:76-90`** (confidence: 40): The `hasKnowledgeDecayToday()` dedup function performs a table scan with `.filter()` callback on all `knowledge-decay` notifications. For a personal learning app with low notification volume, this has negligible performance impact. Not a security concern, but worth noting that dedup relies on client-side date comparison which users could theoretically manipulate by changing system clock — this is by design for a client-side app and not a meaningful attack vector.

- **`src/db/schema.ts:1175-1192`** (confidence: 40): The v32 migration uses `.modify()` to add a default `knowledgeDecay: true` field. This is safe — it only writes to records where the field is `undefined`, and the migration is idempotent. The checkpoint test was correctly updated to allow `migrationVersion >= checkpointVersion` for data-only migrations.

### Secrets Scan

Clean — no secrets detected in diff. The grep for API keys, tokens, passwords, and secrets returned no matches in the changed code.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No premium gating or route guards changed |
| CS2: Client-Side Injection (XSS) | Yes | No | Topic names interpolated via template literals, rendered as React text nodes (auto-escaped). No `dangerouslySetInnerHTML`, `ref.innerHTML`, or `href={variable}` in changed code. |
| CS3: Sensitive Data in Client Storage | No | No | No API keys or auth tokens involved; only notification preferences (boolean) added to IndexedDB |
| CS5: Client-Side Integrity | Yes | No | Dexie v32 migration is safe and idempotent. Defaults `knowledgeDecay: true` only when field is `undefined`. Schema test updated to v32. |
| CS7: Client-Side Security Logging | Yes | No | `console.error` statements log generic error messages only — no user data, topics, or retention values in error logs |
| CS9: Client-Side Communication | No | No | No postMessage handlers or cross-window communication added |
| A05: Security Misconfiguration | No | No | No Vite config, CSP, or CORS changes |
| A06: Vulnerable Components | No | No | No new dependencies added |
| A07: Auth Failures | No | No | No auth-related changes |

### What's Done Well

1. **React auto-escaping relied upon correctly.** Notification title and message containing user-derived topic names are rendered as JSX text children, not via `dangerouslySetInnerHTML`. This is the secure pattern for displaying user-generated content in React.

2. **Event bus type safety.** The `knowledge:decay` event type is added to the `AppEvent` discriminated union in `eventBus.ts`, ensuring TypeScript enforces correct payload shape at compile time. No runtime type confusion possible.

3. **Dedup-by-topic-and-date pattern.** The `hasKnowledgeDecayToday()` function correctly deduplicates notifications per topic per day, preventing notification spam from the startup check. The pattern mirrors the existing `hasReviewDueToday()` and `hasSrsDueToday()` implementations, maintaining consistency.

4. **Idempotent migration.** The v32 Dexie migration guards with `if (pref.knowledgeDecay === undefined)` before writing, making it safe to run multiple times without data corruption.

5. **Non-critical failure handling.** The `checkKnowledgeDecayOnStartup()` call is wrapped in `.catch()` with a descriptive console.error, ensuring a failure in retention calculation never blocks app startup.

---
Phases: 5/7 | Findings: 0 actionable (3 informational) | Blockers: 0 | False positives filtered: 2
