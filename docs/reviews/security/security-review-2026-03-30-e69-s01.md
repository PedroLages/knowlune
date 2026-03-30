## Security Review: E69-S01 — Storage Estimation Service and Overview Card

**Date:** 2026-03-30
**Phases executed:** 3/7
**Diff scope:** 10 files changed, 996 insertions, 8 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 5 categories checked |
| 4 | Dependencies | package.json changed | N/A — package.json not changed |
| 5 | Auth & Access | auth files changed | N/A — no auth files changed |
| 6 | STRIDE | new routes/components | N/A — no new routes, component embedded in existing page |
| 7 | Configuration | config files changed | N/A — no config files changed |

### Attack Surface Changes

This story introduces two new vectors, both low-risk:

1. **Storage API query** (`src/lib/storageEstimate.ts`): Calls `navigator.storage.estimate()` and reads Dexie table rows (read-only). No user input involved. No external network calls.
2. **sessionStorage dismiss state** (`src/app/components/settings/StorageManagement.tsx:256,283`): Reads/writes a single boolean key `storage-warning-dismissed`. No sensitive data. Cleared on tab close by design.

The remaining file changes (LocalVideoContent, PlayerSidePanel, YouTubeVideoContent) are formatting-only (whitespace/line-break changes) with zero logic changes.

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

None.

#### Informational (awareness only)

- **`src/lib/storageEstimate.ts:71`** (confidence: 45): **Blob-based size estimation may include serialized sensitive data in memory.** The `new Blob([JSON.stringify(row)])` call serializes sampled IndexedDB rows (including potentially large content like notes or embedded data) into temporary Blobs for size measurement. These Blobs are short-lived and garbage-collected, and no data leaves the browser. This is a theoretical concern only — there is no exfiltration path and the data already resides in the same origin's IndexedDB. No action required.

- **`src/app/components/settings/StorageManagement.tsx:35`** (confidence: 40): **sessionStorage key is a fixed, non-sensitive string.** The `DISMISS_KEY = 'storage-warning-dismissed'` stores only a `'true'` literal. An attacker with same-origin script execution (XSS) could toggle this, but the only effect is showing/hiding a non-critical warning banner. No security impact beyond what XSS already implies.

### Secrets Scan

Clean — no secrets, API keys, tokens, or credentials detected in the diff. No `.env` files modified or tracked. No console.log statements that output sensitive data.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| A01: Broken Access Control | No | No | No protected resources accessed; read-only local data queries |
| A02: Cryptographic Failures | No | No | No key storage, token handling, or crypto in this story |
| A03: Injection | Yes | No | All rendering uses React JSX (auto-escaped). No `dangerouslySetInnerHTML`, no template literals injected into DOM. Numeric values displayed via `formatFileSize()` and `Math.round()` — safe from XSS. Dexie queries use typed `.table()`, `.count()`, `.limit()` — not string-interpolated queries. |
| A05: Security Misconfiguration | No | No | No Vite, CSP, or CORS changes |
| A06: Vulnerable Components | No | No | No new dependencies added |
| A07: Auth Failures | No | No | No auth-related code changed |
| A08: Data Integrity Failures | Yes | No | Storage estimation is read-only; no writes to IndexedDB. `Promise.allSettled` correctly handles partial table failures without corrupting state. `Math.max(0, ...)` clamp on `uncategorizedBytes` prevents negative display values. |
| A09: Logging Failures | Yes | No | No `console.log` of sensitive data. Silent catches are justified with `// silent-catch-ok` comments and are appropriate for non-critical dashboard data. |

### What's Done Well

1. **Defensive async patterns.** `Promise.allSettled` is used throughout (`storageEstimate.ts:89,120`) so a single failing Dexie table does not crash the entire storage overview. Individual `try/catch` blocks in `estimateTableSize` provide an additional safety net.

2. **No sensitive data exposure.** The component only displays aggregate byte counts and percentage values — never raw IndexedDB row content. The sampling logic (`storageEstimate.ts:68-76`) reads rows transiently for size measurement only, and the row data never reaches the DOM.

3. **sessionStorage over localStorage.** The warning dismiss state uses `sessionStorage` (line 256, 283), which is cleared when the tab closes. This is the correct choice for ephemeral UI state — avoids persisting unnecessary data and reduces the storage surface area.

4. **React auto-escaping.** All dynamic values rendered in JSX (`{percent}%`, `formatFileSize(...)`) go through React's built-in escaping. No raw HTML injection vectors exist in the component.

---
Phases: 3/7 | Findings: 0 actionable (2 informational) | Blockers: 0 | False positives filtered: 2
