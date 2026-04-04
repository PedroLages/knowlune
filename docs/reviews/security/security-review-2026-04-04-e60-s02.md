## Security Review: E60-S02 — Content Recommendation Notification Handler

**Date:** 2026-04-04
**Phases executed:** 6/8
**Diff scope:** 11 files changed, 173 insertions, 12 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 3 vectors identified |
| 2 | Secrets Scan | Always | Clean (diff); 1 pre-existing config finding |
| 3 | OWASP Top 10 | Always | 6 categories checked, 0 findings |
| 4 | Dependencies | package.json not changed | N/A |
| 5 | Auth & Access | no auth files changed | N/A |
| 6 | STRIDE | new handler (not route/component) | N/A |
| 7 | Configuration | no config files changed | N/A |
| 8 | Config Security | Always-on | 1 pre-existing finding |

### Attack Surface Changes

This story adds a new **event handler** (`recommendation:match`) to the existing `NotificationService.ts`, following the identical pattern established by E60-S01. Three new attack vectors introduced:

1. **Event payload ingestion** — `courseId`, `courseName`, and `reason` strings flow from the internal event bus into IndexedDB storage and UI rendering.
2. **Dynamic URL construction** — `actionUrl: /courses/${event.courseId}` is passed to React Router's `navigate()`.
3. **Dexie v33 migration** — Schema upgrade modifies existing `notificationPreferences` rows.

### Findings

#### Blockers
None.

#### High Priority
None.

#### Medium
None.

#### Informational

- **`src/services/NotificationService.ts:300`** (confidence: 55): **No runtime validation on `event.courseId` before URL construction.** The `actionUrl` is built as `/courses/${event.courseId}`. If a future event emitter passes a malicious `courseId` containing path traversal characters (e.g., `../../settings`), it could navigate to unintended routes. However, this is mitigated by: (a) the event bus is internal with TypeScript typing, (b) React Router's `navigate()` resolves routes against the route table -- unknown paths render a 404, not arbitrary navigation, (c) no external emitter exists yet (E52 is future work). **No action required now**, but when E52 implements the emitter, validate `courseId` matches expected format (e.g., slug or UUID).

- **`src/services/NotificationService.ts:102`** (confidence: 50): **`metadata` type cast to `Record<string, unknown>`.** The dedup function casts `n.metadata as Record<string, unknown>` to access `courseId`. If IndexedDB data is corrupted or tampered with (via DevTools), this cast is safe because optional chaining (`?.courseId`) handles `undefined` gracefully. The worst case is dedup failure (duplicate notification created), not a crash or security issue.

- **`src/services/NotificationService.ts:96`** (confidence: 45): **`new Date().toLocaleDateString('sv-SE')` for dedup relies on system locale availability.** The `sv-SE` locale produces ISO-like `YYYY-MM-DD` strings. In extremely rare edge cases (browser without Swedish locale data), this could produce unexpected date formats and break dedup. This matches the E60-S01 pattern and is an accepted project convention per the story's lessons learned.

### Secrets Scan

**Diff:** Clean -- no secrets, API keys, tokens, or credentials detected in the story diff.

**Pre-existing configuration finding (not introduced by this story):**
- **`.mcp.json:15`**: Google API key (`X-Goog-Api-Key: AQ.Ab8R...`) is committed to git in plaintext. The file is tracked (`git ls-files` confirms) and is NOT in `.gitignore`. This was introduced in commit `f01a1d76` and later rotated in `db0abbcb`. **Recommendation:** Add `.mcp.json` to `.gitignore`, remove from git tracking (`git rm --cached .mcp.json`), and move the API key to an environment variable. This is a standing issue -- not blocking this story.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No premium gating or route protection changes |
| CS2: Client-Side Injection (XSS) | Yes | No | `courseName` and `reason` rendered via React JSX interpolation (`{notification.message}`), which auto-escapes. No `dangerouslySetInnerHTML`, no `ref.innerHTML`, no `href={variable}`. |
| CS3: Sensitive Data in Client Storage | No | No | Only notification metadata stored (courseId, courseName). No API keys, tokens, or PII. |
| CS5: Client-Side Integrity | Yes | No | Dexie v33 migration uses conditional `if (pref.recommendationMatch === undefined)` guard -- safe, idempotent, no data loss risk. |
| CS7: Client-Side Security Logging | No | No | No `console.log` statements in changed code. |
| CS9: Client-Side Communication | No | No | No postMessage handlers, no cross-window communication. |
| A05: Security Misconfiguration | No | No | No config file changes in diff. |
| A06: Vulnerable Components | No | No | No new dependencies. |
| A07: Auth Failures | No | No | No auth-related changes. |

### Configuration Security (Phase 8 Always-On Checks)

| Check | Result |
|-------|--------|
| 8.1 Secrets in config files | `.mcp.json` contains plaintext Google API key (pre-existing, not in diff) |
| 8.2 MCP Server Security | `.mcp.json` is tracked by git, not in `.gitignore`. Stitch MCP uses HTTPS (good). API key should be env var. |
| 8.5 .env File Tracking | Clean -- no `.env`, `.env.local`, or `.env.production` tracked by git |

### What's Done Well

1. **Consistent pattern reuse.** The handler follows E60-S01's established pattern exactly -- same dedup structure, same store.create shape, same event registration approach. This consistency reduces the chance of introducing novel vulnerabilities.

2. **Safe rendering pipeline.** All user-facing strings (`courseName`, `reason`) flow through React's JSX auto-escaping. No raw HTML rendering, no `dangerouslySetInnerHTML`, no DOM manipulation bypasses.

3. **Defensive Dexie migration.** The v33 upgrade callback checks `if (pref.recommendationMatch === undefined)` before setting the default, making the migration idempotent and safe to re-run.

4. **Internal-only `actionUrl` with React Router.** Using `navigate(actionUrl)` instead of `window.location` or `window.open` ensures the URL is resolved against the app's route table, eliminating open redirect risk.

---
Phases: 6/8 | Findings: 0 actionable (3 informational) | Blockers: 0 | False positives filtered: 2
