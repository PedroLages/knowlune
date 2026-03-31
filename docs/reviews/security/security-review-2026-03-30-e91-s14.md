## Security Review: E91-S14 — Clickable Note Timestamps

**Date:** 2026-03-30
**Phases executed:** 3/7
**Diff scope:** 4 files changed, 207 insertions, 6 deletions

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 2 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 3 categories checked |
| 4 | Dependencies | package.json unchanged | N/A |
| 5 | Auth & Access | no auth files changed | N/A |
| 6 | STRIDE | no new routes/pages | N/A |
| 7 | Configuration | no config files changed | N/A |

### Attack Surface Changes

1. **Custom `video://` protocol links in TipTap editor** — Notes now contain `<a href="video://123">` links that are parsed on click to seek video playback. The `video://` protocol is registered with TipTap's link extension.
2. **New callback props (`onSeek`, `currentTime`)** — PlayerSidePanel passes video seek callbacks through to NoteEditor. These are internal component props, not user-controllable.

### Findings

#### Blockers (critical vulnerabilities — must fix before merge)

None.

#### High Priority (should fix)

None.

#### Medium (fix when possible)

None.

#### Informational (awareness only)

- **NoteEditor.tsx:362** (confidence: 55): The `parseInt(href.replace('video://', ''), 10)` parsing is safe — `parseInt` returns `NaN` for non-numeric input, which is checked with `isNaN(seconds)` before calling `onVideoSeek`. The `video://` protocol is only added programmatically via `insertContent` (line 465), and TipTap's link extension with `protocols: ['video']` restricts recognized link protocols. No user-controlled URL injection path exists since links are created via the "Add Timestamp" button, not free-form URL input. Low risk of abuse.

- **NoteEditor.tsx:465** (confidence: 45): The `insertContent` call uses `currentVideoTime` (a number) to construct `video://${seconds}`. Since `currentVideoTime` flows from the video player as a numeric prop, there is no string injection vector. Template literal is safe here.

### Secrets Scan

Clean — no secrets detected in diff.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No access control changes |
| CS2: Client-Side Injection (XSS) | Yes | No | TipTap link handling uses `protocols` allowlist; `parseInt` + `isNaN` guard prevents injection via `video://` URLs; no `dangerouslySetInnerHTML` or `innerHTML` |
| CS3: Sensitive Data in Client Storage | No | No | Only note content stored (no secrets) |
| CS5: Client-Side Integrity | No | No | No schema or persistence changes |
| CS7: Client-Side Security Logging | No | No | No console.log of sensitive data |
| CS9: Client-Side Communication | No | No | No postMessage or cross-window communication |

### What's Done Well

1. **Safe protocol design** — Using a custom `video://` scheme with TipTap's `protocols` allowlist prevents `javascript:` or `data:` URLs from being recognized as valid timestamp links.
2. **Defensive parsing** — `parseInt` + `isNaN` guard ensures only valid numeric timestamps trigger seek, silently ignoring malformed values.
3. **`openOnClick: false`** — TipTap's default link click behavior is disabled, so the custom `handleClick` handler has full control over link activation, preventing browser navigation to `video://` URLs.

---
Phases: 3/7 | Findings: 0 actionable (2 informational) | Blockers: 0 | False positives filtered: 0
