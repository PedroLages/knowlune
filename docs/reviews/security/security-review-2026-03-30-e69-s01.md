## Security Review: E69-S01 — Storage Estimation Service and Overview Card

**Date:** 2026-03-30
**Phases executed:** 4/7
**Diff scope:** 15 files changed, 1661 insertions, 31 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 8 categories checked, 0 findings |
| 4 | Dependencies | package.json changed | N/A — no package.json changes |
| 5 | Auth & Access | auth files changed | N/A — no auth files changed |
| 6 | STRIDE | new routes/components | Executed (new component) — 0 actionable threats |
| 7 | Configuration | config files changed | N/A — no config files changed |

### Attack Surface Changes

This story introduces two new attack surface elements:

1. **Storage estimation service** (`src/lib/storageEstimate.ts`) — Reads all Dexie table metadata (counts) and samples up to 5 rows per table. Exposes size estimates via `getStorageOverview()`. Uses `navigator.storage.estimate()` for quota data.

2. **StorageManagement UI component** (`src/app/components/settings/StorageManagement.tsx`) — Renders storage data as charts and text. Uses `sessionStorage` for warning dismiss state. No user input fields, no forms, no external network calls.

Both are read-only surfaces with no user-supplied input that reaches data queries or DOM rendering unsafely.

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

None.

#### Informational (awareness only)

- **`src/lib/storageEstimate.ts:62-85`** (confidence: 45): The `estimateTableSize` function reads sample rows from every Dexie table, including tables that may contain sensitive data (e.g., `embeddings`, `notes`). In the current architecture this data never leaves the browser — it is serialized only to measure `Blob` size and the serialized content is immediately discarded (not stored or transmitted). This is not a vulnerability today but is worth noting: if a future story adds telemetry or error reporting that captures function return values, the sampling logic could inadvertently serialize sensitive content. **No action required** — the current implementation is safe.

- **`src/lib/storageEstimate.ts:76`** (confidence: 40): `new Blob([JSON.stringify(row)]).size` is used for size estimation. For tables with very large rows (e.g., embedded PDFs stored as base64), this creates a transient memory spike. This is mitigated by the `sampleSize=5` limit and the fact that `Promise.allSettled` processes tables sequentially within each category. Not a security vulnerability but a potential DoS vector if sample size were increased without bounds. **No action required** at current sample size.

- **`src/app/components/settings/StorageManagement.tsx:310`** (confidence: 35): `sessionStorage.setItem(DISMISS_KEY, 'true')` stores the warning dismiss state. An attacker with XSS access could set this to suppress storage warnings. This is an extremely low-impact vector — if an attacker has XSS they have far more damaging options. The `try/catch` around sessionStorage access is correct for environments where storage is unavailable.

### Secrets Scan

Clean — no secrets, API keys, tokens, or credentials detected in the diff. No `.env` files modified or tracked. No `console.log` statements in new code.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| A01: Broken Access Control | No | No | No protected resources involved. Storage estimates are the user's own data, rendered locally. |
| A02: Cryptographic Failures | No | No | No cryptographic operations. No key storage changes. |
| A03: Injection | Yes | No | All rendering uses React JSX (auto-escaped). No `dangerouslySetInnerHTML`. Numeric values displayed via `formatFileSize()` and `Math.round()`. Dexie queries use typed `.table()`, `.count()`, `.limit()` — not string-interpolated. |
| A05: Security Misconfiguration | No | No | No Vite config, CSP, or CORS changes. |
| A06: Vulnerable Components | No | No | No new dependencies added. |
| A07: Auth Failures | No | No | No authentication logic changed. |
| A08: Data Integrity Failures | Yes | No | Storage estimates are read-only derivations. No writes to IndexedDB. `sessionStorage` write is limited to a single boolean dismiss flag. Component uses `Promise.allSettled` to gracefully handle partial failures without corrupting state. |
| A09: Logging Failures | Yes | No | No `console.log` of sensitive data. Silent catches annotated with `// silent-catch-ok` comments and are appropriate for non-critical dashboard data. |

### STRIDE Assessment (StorageManagement component)

| Threat | Applicable? | Analysis |
|--------|------------|----------|
| Spoofing | No | No identity claims. Component renders local data for local user. |
| Tampering | Low | Storage estimates are ephemeral (React state). An attacker with DevTools access could modify displayed values, but this has no security impact — the data is informational only. |
| Repudiation | No | No auditable actions taken by this component. |
| Information Disclosure | Low | Table names and approximate sizes are rendered. This reveals the schema structure (table names like `embeddings`, `flashcards`) but this is already visible in DevTools > Application > IndexedDB. No actual row content is displayed. |
| Denial of Service | Low | `estimateTableSize` reads up to 5 rows per table across ~11 tables. Bounded and non-blocking. Refresh button has a `refreshing` guard preventing concurrent calls. |
| Elevation of Privilege | No | No privilege boundaries crossed. Read-only local data. |

### What's Done Well

1. **No user input reaches data queries.** The storage estimation service uses hardcoded table names from `CATEGORY_MAP` — no user-supplied strings are passed to `db.table()`. This eliminates injection risk entirely.

2. **Robust error boundaries.** Both the service (`Promise.allSettled` with per-table fallback to 0) and the component (cancelled flag, error state, try/catch around sessionStorage) handle failures gracefully without exposing error details to the UI.

3. **No sensitive data rendered.** The component only displays aggregate byte counts and category labels — never actual row content from IndexedDB. The sampling in `estimateTableSize` serializes rows transiently for size measurement only.

4. **Correct React patterns.** The `useEffect` cleanup with `cancelled` flag prevents state updates on unmounted components. The `refreshing` guard prevents concurrent refresh calls that could cause race conditions.

---
Phases: 4/7 | Findings: 0 actionable (3 informational) | Blockers: 0 | False positives filtered: 2

*Filtered: (1) "silent catch blocks" — all annotated with `// silent-catch-ok` and render appropriate error UI; (2) "sessionStorage without encryption" — dismiss flag is non-sensitive boolean, encryption would be unnecessary overhead.*

---
*This automated review supplements but does not replace professional security audits. For production deployments handling sensitive data or payments, engage a qualified security firm.*
