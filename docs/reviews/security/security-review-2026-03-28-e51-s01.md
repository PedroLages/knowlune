## Security Review: E51-S01 — Settings Infrastructure & Display Section Shell

**Date:** 2026-03-28
**Phases executed:** 5/7
**Diff scope:** 11 files changed, 528 insertions, 9 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 3 categories checked |
| 4 | Dependencies | package.json changed | 0 findings |
| 5 | Auth & Access | N/A — no auth files changed | N/A |
| 6 | STRIDE | new component added | 3 threats evaluated |
| 7 | Configuration | N/A — no config files changed | N/A |

### Attack Surface Changes

This story introduces two attack vectors, both low-risk:

1. **localStorage read/write for 3 new settings fields** (`accessibilityFont`, `contentDensity`, `reduceMotion`). These are read from `localStorage`, parsed via `JSON.parse`, and rendered into UI state. No user-supplied free-text is introduced — all values are constrained enumerations or booleans.

2. **New npm dependency: `@fontsource/atkinson-hyperlegible@5.2.8`**. A static font asset package from the Fontsource project. No runtime JavaScript, no install scripts, no network calls.

No new API endpoints, no new user input fields (all controls are `disabled` in this shell), no new external integrations.

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

None.

#### Informational (awareness only)

- **`src/lib/settings.ts:67`** (confidence: 55): The `JSON.parse(raw)` call spreads parsed localStorage data into the settings object. While the new fields (`accessibilityFont`, `contentDensity`, `reduceMotion`) are properly validated post-parse (lines 69-77), pre-existing fields like `theme`, `colorScheme`, `displayName`, and `bio` are not validated by `getSettings()`. This is not a vulnerability introduced by this story — it is pre-existing behavior — but creates inconsistent validation depth. The new code sets a good pattern that could be extended to all fields in a future hardening pass.

- **`src/lib/settings.ts:67`** (confidence: 50): Prototype pollution via `JSON.parse` + spread is theoretically possible if an attacker controls localStorage content (e.g., via XSS). However, this requires a pre-existing XSS vulnerability, and the spread into a plain object with typed defaults limits practical impact. React's rendering pipeline does not execute object prototype methods. No action needed — this is defense-in-depth awareness only.

### Secrets Scan

Clean — no secrets detected in diff. The only matches were an import reference to `ChangePassword` (component name, not a credential) and a code comment referencing "tokens" in the design system context.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| A01: Broken Access Control | No | No | No protected routes or entitlement checks changed |
| A02: Cryptographic Failures | No | No | No key storage or token handling changed |
| A03: Injection | Yes | No | No `dangerouslySetInnerHTML`, no template injection, no unescaped user input. Settings values rendered via React JSX (auto-escaped). Controls are `disabled` in this shell. |
| A05: Security Misconfiguration | No | No | No Vite config, CSP, or CORS changes |
| A06: Vulnerable Components | Yes | No | `@fontsource/atkinson-hyperlegible@5.2.8` is a static font package (OFL-1.1 license). No runtime JS, no known CVEs, maintained by Fontsource org (multi-maintainer). |
| A07: Auth Failures | No | No | No auth flow changes |
| A08: Data Integrity Failures | Yes | No | New fields validated on read with allowlist pattern (lines 69-77). Corrupted values fall back to defaults. `try/catch` around `JSON.parse` returns defaults on malformed JSON. This is well-implemented. |
| A09: Logging Failures | No | No | No `console.log` of sensitive data added. No new logging statements in diff. |

### STRIDE Analysis (DisplayAccessibilitySection component)

| Threat | Applicable? | Assessment |
|--------|------------|------------|
| Spoofing | No | No identity involved — local display preferences only |
| Tampering | Low risk | User can tamper with own localStorage settings. Validated on read. No server-side impact. |
| Repudiation | No | No auditable actions — cosmetic preferences only |
| Information Disclosure | No | No sensitive data in these settings fields |
| Denial of Service | No | No expensive operations. Reset is a simple object merge + localStorage write. |
| Elevation of Privilege | No | Display settings do not gate access to any features |

### What's Done Well

1. **Input validation on read**: The new `getSettings()` code validates all three new fields against allowlists (`VALID_CONTENT_DENSITY`, `VALID_REDUCE_MOTION`) and type-checks the boolean. This prevents corrupted localStorage from propagating invalid values into the component tree — a mature defensive pattern.

2. **Graceful degradation**: The `try/catch` around `JSON.parse` with fallback to defaults means even completely corrupted localStorage cannot crash the settings page. This is good resilience engineering.

3. **Controls shipped disabled**: All toggle switches are rendered with `disabled` prop, meaning no user interaction can modify state through these controls until the feature is fully implemented. This reduces the attack surface of the shell to zero interactive vectors.

---
Phases: 5/7 | Findings: 0 total (2 informational) | Blockers: 0 | False positives filtered: 2

**False positives filtered:**
1. Prototype pollution via JSON.parse — requires pre-existing XSS, limited by React rendering model (confidence 50, below threshold)
2. Pre-existing validation gap on older fields — not introduced by this story, not a vulnerability in current context (confidence 55, below threshold)

---
*This automated review supplements but does not replace professional security audits. For production deployments handling sensitive data or payments, engage a qualified security firm.*
