## Security Review: E69-S01 — Storage Estimation Service & Overview Card (R3)

**Date:** 2026-03-30
**Phases executed:** 4/7
**Diff scope:** 19 files changed, 2416 insertions, 32 deletions (source files: 6 changed)

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 4 categories checked |
| 4 | Dependencies | package.json changed | N/A — no package.json changes |
| 5 | Auth & Access | auth files changed | N/A — no auth files changed |
| 6 | STRIDE | new routes/components | 1 new component, assessed |
| 7 | Configuration | config files changed | N/A — no config files changed |

### Attack Surface Changes

This story adds a **read-only storage estimation service** and a **display-only UI card**. The attack surface expansion is minimal:

1. **IndexedDB read access via Dexie** (`src/lib/storageEstimate.ts`): The `estimateTableSize` function reads rows from all mapped Dexie tables using `table.limit(sampleSize).toArray()`. This is read-only access to the application's own database — no new write paths, no external data ingestion, no user-controlled table names.

2. **navigator.storage.estimate() API** (`src/lib/storageEstimate.ts:114`): Delegates to existing `storageQuotaMonitor` module. This is a standard browser API with no security implications — it returns opaque usage/quota numbers with no ability to read other origins' data.

3. **sessionStorage write** (`StorageManagement.tsx:287`): Single key `storage-warning-dismissed` written to sessionStorage for dismiss state. Minimal surface.

4. **No new network calls, no new user input fields, no new route definitions.**

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

None.

#### Informational (awareness only)

- **`src/lib/storageEstimate.ts:88`** (confidence: 55): The `estimateTableSize` function uses `JSON.stringify(row)` to estimate row size via `new Blob([...]).size`. If a row contains circular references, `JSON.stringify` would throw. However, this is caught by the surrounding try/catch which returns 0, and IndexedDB structured clone data should not contain circular references. No action needed.

- **`src/app/components/settings/StorageManagement.tsx:230`** (confidence: 50): The inline `style` attribute on the category color dot uses `chartConfig[cat.category].color` which resolves to CSS custom properties (e.g., `var(--chart-1)`). This is safe — no user-controlled data flows into the style value.

- **`src/app/components/settings/StorageManagement.tsx:287`** (confidence: 45): sessionStorage is used for dismiss state. If sessionStorage is unavailable (e.g., private browsing in some browsers), the catch block silently handles the error. This is a resilience pattern, not a vulnerability.

### Secrets Scan

Clean — no secrets detected in diff. The only match was the import name `ChangePassword` which is a component reference, not an exposed credential.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| A01: Broken Access Control | No | No | No protected routes or premium gating involved. Read-only storage display. |
| A02: Cryptographic Failures | No | No | No key storage, token handling, or cryptographic operations. |
| A03: Injection | Yes | No | No `dangerouslySetInnerHTML`, no template injection, no user-controlled strings rendered unsanitized. All display values go through `formatFileSize()` which returns typed strings. React's JSX auto-escaping applies. |
| A05: Security Misconfiguration | No | No | No Vite config, CSP, or CORS changes. |
| A06: Vulnerable Components | No | No | No new dependencies added (no package.json changes). |
| A07: Auth Failures | No | No | No authentication or session management changes. |
| A08: Data Integrity Failures | Yes | No | IndexedDB access is read-only (sampling via `table.limit().toArray()`). No schema migrations, no writes. `Promise.allSettled` ensures partial failures don't corrupt the overview result. |
| A09: Logging Failures | Yes | No | No `console.log` statements in the diff. Silent catches are annotated with `// silent-catch-ok` comments and are appropriate (non-critical estimation failures should not block the UI). |

### STRIDE Assessment (StorageManagement component)

| Threat | Risk | Assessment |
|--------|------|------------|
| **Spoofing** | None | No identity or auth involved. |
| **Tampering** | Low | Storage estimates are read-only from IndexedDB. A user could tamper with their own IndexedDB data, but this only affects their own displayed estimates — no security impact. |
| **Repudiation** | None | No auditable actions performed. Display-only component. |
| **Information Disclosure** | Low | Storage sizes by category are displayed to the user who owns the data. No cross-origin data exposure. `navigator.storage.estimate()` is intentionally imprecise per spec to prevent fingerprinting. |
| **Denial of Service** | Low | `estimateTableSize` reads sample rows from each table. With very large tables, this is bounded by `sampleSize=5` default. `Promise.allSettled` prevents one slow table from blocking others. No unbounded loops. |
| **Elevation of Privilege** | None | No privilege boundaries involved. |

### What's Done Well

1. **Defensive error handling throughout**: Both `estimateTableSize` and `getStorageOverview` use `Promise.allSettled` to ensure individual table/category failures don't cascade. The UI gracefully degrades to error and "API unavailable" states.

2. **No new external data ingestion**: The entire feature reads from the user's own IndexedDB and a standard browser API. No new attack vectors from external sources.

3. **React JSX auto-escaping**: All dynamic values (`formatFileSize()`, percentage calculations) are rendered via JSX interpolation, which automatically escapes content. No raw HTML insertion anywhere in the diff.

4. **Clean separation of concerns**: The estimation logic is isolated in `src/lib/storageEstimate.ts` with pure data functions, while the UI component handles only rendering. This limits the blast radius of any future bugs.

---
Phases: 4/7 | Findings: 0 actionable (3 informational) | Blockers: 0 | False positives filtered: 2 (circular JSON theoretical risk downgraded; sessionStorage unavailability is handled)
