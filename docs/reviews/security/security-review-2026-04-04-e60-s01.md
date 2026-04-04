## Security Review: E60-S01 — Knowledge Decay Alert Trigger

**Date:** 2026-04-04
**Phases executed:** 4/7
**Diff scope:** 50 files changed, 807 insertions, 205 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 3 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 6 categories checked |
| 4 | Dependencies | package.json changed | N/A — no package.json changes |
| 5 | Auth & Access | auth files changed | N/A — no auth files changed |
| 6 | STRIDE | new routes/components | N/A — no new routes/components |
| 7 | Configuration | config files changed | N/A — no config files changed |

### Attack Surface Changes

This story introduces three new attack surface vectors, all scoped to client-side data processing:

1. **New event bus event type (`knowledge:decay`)** — Emits user-controlled topic names and numeric retention values through the in-memory event bus. Data originates from IndexedDB (local-only).

2. **IndexedDB schema migration (v32)** — Adds `knowledgeDecay` boolean preference field with a `modify()` upgrade. The migration only adds a default value (`true`) where the field is undefined.

3. **Startup data scan (`checkKnowledgeDecayOnStartup`)** — Reads all notes and review records from IndexedDB at app startup. Processes them synchronously to detect decaying topics. New notification records are written back to IndexedDB.

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

- **`src/services/NotificationService.ts:76`** (confidence: 72): **Non-deterministic date usage in dedup logic.** The `hasKnowledgeDecayToday()` function uses `new Date()` to compute the current date string for dedup comparison. While not a security vulnerability per se, this creates a subtle integrity issue: if the user's system clock is manipulated (e.g., set back one day), the dedup check would allow duplicate notifications for the same topic on the same actual calendar day. This is consistent with the existing `hasSrsDueToday()` pattern in the same file, so it is an inherited pattern rather than a new introduction.

  **Exploit:** User changes system clock to bypass daily dedup, generating excessive notifications. Low impact since all data is local and user-controlled.

  **Fix:** Accept a `now` parameter (as the `retentionMetrics.ts` functions already do) to enable deterministic testing and consistent time source. Not a blocking issue.

#### Informational (awareness only)

- **`src/services/NotificationService.ts:253-254`** (confidence: 60): **User-controlled string in notification title/message.** The `event.topic` value (derived from note tags in IndexedDB) is interpolated into notification `title` and `message` fields. React's JSX auto-escaping prevents XSS when these strings are rendered. However, if a future code path were to render notifications using `dangerouslySetInnerHTML`, the topic string would need sanitization. Currently safe — noted for awareness only.

- **`src/services/NotificationService.ts:301`** (confidence: 55): **`console.error` on startup failure.** The `checkKnowledgeDecayOnStartup` catch block logs errors to console. This is appropriate for non-critical startup checks and matches the existing `checkSrsDueOnStartup` pattern. No sensitive data is logged (only the error object). The `// silent-catch-ok` annotation is present.

- **`src/db/schema.ts` (v32 migration)** (confidence: 50): **Migration modifies existing records.** The v32 migration uses `toCollection().modify()` to add a default `knowledgeDecay: true` field. This is safe — it only adds a boolean field where undefined, does not delete or overwrite existing data, and follows the same pattern as prior migrations (v29-v31). Dexie handles the upgrade transaction atomically.

### Secrets Scan

Clean — no secrets detected in diff.

Test keys found in test files (`src/lib/__tests__/modelDiscovery.test.ts`) are clearly fake placeholder values (`sk-or-v1-testkey1234567890...`) and do not represent real credentials. These were reformatted (not introduced) by this diff.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No premium gating or route guards changed |
| CS2: Client-Side Injection (XSS) | Yes | No | Topic strings interpolated in JSX — auto-escaped by React. No `dangerouslySetInnerHTML` in diff |
| CS3: Sensitive Data in Client Storage | No | No | Only boolean preference added to IndexedDB. No API keys or tokens involved |
| CS5: Client-Side Integrity | Yes | No | Dexie migration v32 is atomic, adds default value only. Dedup logic checks date + topic combination |
| CS7: Client-Side Security Logging | Yes | No | `console.error` logs error objects only, no sensitive data. Annotated with `silent-catch-ok` |
| CS9: Client-Side Communication | No | No | No postMessage, cross-window, or iframe changes |
| A05: Security Misconfiguration | No | No | No config file changes (Vite, CSP, CORS) |
| A06: Vulnerable Components | No | No | No dependency changes |
| A07: Auth Failures | No | No | No auth-related code changed |

### What's Done Well

1. **Consistent dedup pattern.** The `hasKnowledgeDecayToday()` dedup check mirrors the established `hasSrsDueToday()` pattern, preventing notification spam with a date + topic compound key.

2. **Hardcoded actionUrl.** The notification's `actionUrl` is set to the static string `'/review'` rather than constructing a URL from user input, eliminating open redirect or `javascript:` protocol risks.

3. **Pure function for retention calculation.** The `getTopicRetention()` function in `retentionMetrics.ts` accepts a `now` parameter for deterministic testing, and the `NotificationService` correctly uses it. The retention logic is side-effect-free and well-separated from the notification creation.

4. **Preference-gated notifications.** The new `knowledge-decay` type is properly wired into the `TYPE_TO_FIELD` mapping and the preference store defaults, meaning the existing preference-check middleware in `handleEvent()` will respect the user's opt-out toggle.

---
Phases: 4/7 | Findings: 0 Blockers, 0 High, 1 Medium, 3 Informational | False positives filtered: 2
