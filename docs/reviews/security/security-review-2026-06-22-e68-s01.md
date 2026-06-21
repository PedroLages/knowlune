## Security Review: E68-S01 — Model Download Progress UI

**Date:** 2026-06-22
**Phases executed:** 8/8
**Diff scope:** 21 files changed, 2878 insertions(+), 406 deletions(-)

### Phases Executed

| Phase | Name | Triggered By | Findings |
|-------|------|-------------|----------|
| 1 | Attack Surface | Always | 4 vectors identified |
| 2 | Secrets Scan | Always | Clean |
| 3 | OWASP Top 10 | Always | 6 categories checked |
| 4 | Dependencies | package.json changed | 0 new findings |
| 5 | Auth & Access | No auth files changed | N/A |
| 6 | STRIDE | New components added | 2 threats evaluated |
| 7 | Configuration | .gitignore changed | 0 findings |
| 8 | Config Security | Always-on (secrets) + .mcp.json checked | 0 findings (pre-existing) |

### Attack Surface Changes

4 new attack vectors introduced by this story:

1. **CustomEvent 'model-download-progress'** — New event protocol: WorkerCoordinator dispatches this CustomEvent on `window` with progress data (`progress`, `status`, `file`, `loaded`, `total` fields). Consumed by `useModelDownloadProgress` hook and `EmbeddingModelProgressToast`. Only numeric progress and enum status strings are rendered in the UI.

2. **CustomEvent 'worker-crash'** — New event protocol: WorkerCoordinator dispatches this on `window` with `workerId` and `error.message` strings. Consumed by `EmbeddingModelProgressToast` to surface failures. Error message rendered as Sonner toast text (React-escaped).

3. **Web Worker model download (23MB via Transformers.js)** — `embedding.worker.ts` lazy-downloads `Xenova/all-MiniLM-L6-v2` from HuggingFace CDN. Fixed model name, no user input in URL. Offline detection (`navigator.onLine`) guards the download attempt.

4. **Pre-warm idle timer** — `App.tsx` introduces a 3-second `setTimeout` followed by `requestIdleCallback` to trigger model warm-up. Gated on `navigator.deviceMemory >= 4GB`. The warm-up payload is a no-op single-space embed request with a 60-second timeout.

### Findings

**No security findings.** All attack surface changes are in code that operates within expected trust boundaries:

- Web Workers are same-origin module workers (bundled by Vite).
- CustomEvents are same-window only — cross-origin scripts cannot dispatch them.
- All UI rendering uses React JSX (auto-escaped). No `dangerouslySetInnerHTML` or `href={variable}` patterns.
- The model integrity check (output dimension verification) provides defense-in-depth against corrupted/substituted models.
- No user-supplied URLs, file paths, or input that could lead to injection.
- No secrets, API keys, or sensitive data in the diff.

### Secrets Scan

**Clean** — No secrets detected in the diff. The grep matched only document references in `epic-68-77-tracking-2026-06-21.md` (story names containing "AuthCallback", "AuthorProfile", etc.), not actual credentials.

Pre-existing observation (not introduced by this story): `.mcp.json` contains a Google API key in plaintext (`X-Goog-Api-Key` header). This file is properly listed in `.gitignore` and is not tracked by git (verified: `git ls-files --error-unmatch .mcp.json` exits 1). The key was present before this story's changes.

### OWASP Coverage

| Category | Applicable? | Finding? | Details |
|----------|------------|----------|---------|
| CS1: Broken Client-Side Access Control | No | No | No new routes or auth changes |
| CS2: Client-Side Injection (XSS) | Yes | No | All UI rendering via React JSX. No `dangerouslySetInnerHTML`. No `href={variable}`. Toast text from `worker-crash` event is React string-escaped. |
| CS3: Sensitive Data in Client Storage | No | No | No changes to BYOK, localStorage, or IndexedDB storage of secrets |
| CS5: Client-Side Integrity | Yes | No | CustomEvent protocol is well-typed with requestId routing. Model integrity check validates output dimension (384). |
| CS7: Client-Side Security Logging | Yes | No | `console.log/warn/error` calls use only public/operational info (model name, workerId, deviceMemory). No secrets logged. |
| CS9: Client-Side Communication | Yes | No | Web Worker postMessage is same-origin (module worker). CustomEvents are same-window. No cross-origin postMessage handlers. |
| A05: Security Misconfiguration | Yes | No | `.gitignore` updated to exclude `.mcp.json`, `.claude/settings.local.json`, review story state, and deepsec artifacts. |
| A06: Vulnerable Components | Yes | No | `protobufjs 7.6.4` override added to address CVE in transitive dependency. Existing npm audit findings (high/critical) affect devDependencies and pre-existing deps, not introduced by this story. |
| A07: Auth Failures | No | No | No auth changes in this story |

### STRIDE Threat Model

New/modified components analyzed:

**EmbeddingModelProgressToast component:**
- **Spoofing**: N/A — no identity involved
- **Tampering**: A same-origin script could dispatch fake `model-download-progress` events, but the impact is limited to UI state (showing/hiding toasts). No data modification or execution risk.
- **Repudiation**: N/A
- **Information Disclosure**: No sensitive data transmitted through the event protocol. Progress is numeric, file names are ML model artifacts.
- **Denial of Service**: None — the event handler debounces at 500ms and has a 120s stall timeout.
- **Elevation of Privilege**: N/A

**embedding.worker.ts (Web Worker):**
- **Spoofing**: N/A — worker is spawned same-origin
- **Tampering**: Transformers.js model download uses HTTPS. Model integrity check verifies output dimension (384-d). Defensive against corrupted/substituted models, though limited to dimension-only verification.
- **Repudiation**: N/A
- **Information Disclosure**: No user data sent to external services during model download. Inference runs locally.
- **Denial of Service**: Worker pool limited to 3 workers. Idle termination after 60s. Memory gating via `deviceMemory >= 4GB` prevents OOM on low-memory devices.
- **Elevation of Privilege**: N/A — worker has no additional privileges

### What's Done Well

1. **Model integrity verification** (`embedding.worker.ts:165-183`): The pipeline runs a quick inference on a test input and verifies the output dimension is 384 before accepting the model. This provides defense-in-depth against corrupted downloads, CDN compromise, or MITM-substituted models.

2. **Event lifecycle management** (`EmbeddingModelProgressToast.tsx:266-281`): The component properly cleans up all event listeners, timers, and toasts on unmount, preventing memory leaks and ghost toasts.

3. **Concurrency guard on model loading** (`embedding.worker.ts:134-135`): The `pipelineInitPromise` pattern ensures only one model download happens even if multiple embed requests arrive simultaneously, preventing redundant 23MB downloads and race conditions.

---

Phases: 8/8 | Findings: 0 total | Blockers: 0 | False positives filtered: 0
