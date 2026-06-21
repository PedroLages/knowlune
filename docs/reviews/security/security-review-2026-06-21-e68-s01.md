## Security Review: E68-S01 — Model Download Progress UI

**Date:** 2026-06-21
**Phases executed:** 7/8
**Diff scope:** 16 files changed, 2108 insertions(+), 424 deletions(-)

### Phases Executed

| Phase | Name            | Triggered By           | Findings                                         |
| ----- | --------------- | ---------------------- | ------------------------------------------------ |
| 1     | Attack Surface  | Always                 | 3 vectors identified                             |
| 2     | Secrets Scan    | Always                 | Clean                                            |
| 3     | OWASP Top 10    | Always                 | 6 categories checked                             |
| 4     | Dependencies    | package.json changed   | Clean — protobufjs override is a proactive fix   |
| 5     | Auth & Access   | No auth files changed  | N/A                                              |
| 6     | STRIDE          | New components/workers | 1 threat enumerated                              |
| 7     | Configuration   | .gitignore changed     | Clean                                            |
| 8     | Config Security | Always-on (secrets)    | Clean — pre-existing .mcp.json key outside scope |

### Attack Surface Changes

Three new attack vectors introduced:

1. **External model download in Web Worker** (`src/ai/workers/embedding.worker.ts`): Downloads a 23MB model (`Xenova/all-MiniLM-L6-v2`) from Hugging Face's CDN over HTTPS. Model source is hardcoded (not user-configurable). Integrity check verifies output dimension (384). No SSRF vector — model URL is not configurable by users.

2. **CustomEvent-based progress dispatch** (`src/ai/workers/coordinator.ts:159`): Dispatches `model-download-progress` events via `window.dispatchEvent`. Same-origin only — an attacker would need XSS on the origin to forge events, which makes this a non-issue (they already own the page).

3. **Embedding model warm-up from App.tsx** (`src/app/App.tsx:97`): Pre-warms the model 3 seconds after mount using `requestIdleCallback`. Gated on `deviceMemory >= 4GB`. Silent catch on failure — no data leakage.

### Findings

**No blockers, high, or medium findings.** This diff introduces no exploitable security vulnerabilities. All findings are informational.

#### Informational (awareness only)

- **[src/ai/workers/embedding.worker.ts:155]** (confidence: 65, category: client-side-injection, autofix_class: advisory): **Model integrity verification relies on output dimension check only**

  The model integrity check at line 155 verifies only that the output dimension is 384. This provides basic protection against gross model substitution (e.g., loading a MobileNet instead of MiniLM), but would not catch a sophisticated attacker who compromised Hugging Face's CDN and served a malicious 384-dim model. Transformers.js does not natively support cryptographic model signing or SRI. The model download is over HTTPS (not plain HTTP), and the model identifier is hardcoded, which mitigates lower-tier threats (MITM, user-configurable URL). This is standard for the client-side ML ecosystem and requires no code change.

  **Exploit:** A compromised Hugging Face CDN could serve a malicious ONNX model that produces adversarially crafted embeddings (e.g., causing all embeddings to return the same vector, or influencing downstream similarity search results). The 384-dim check would not detect this.

  **Remediation:** No immediate fix available within the current architecture. For defense-in-depth: monitor the Hugging Face supply chain, pin to specific model revisions, and consider adding SRI for model files if Transformers.js supports it in a future version.

### Secrets Scan

**Clean** — No secrets detected in the diff. The grep matched only document references in `epic-68-77-tracking-2026-06-21.md` (story names containing "AuthCallback", "AuthorProfile", etc.), not actual credentials.

- `.env` files: Not tracked by git (confirmed via `git ls-files --error-unmatch`)
- `console.log` in changed files: Model name (`all-MiniLM-L6-v2`) — public information, not sensitive
- `.mcp.json`: Contains a Google API key (redacted — pre-existing, not introduced by this story's diff)

### OWASP Coverage

| Category                               | Applicable? | Finding? | Details                                                                                                                                                                                                       |
| -------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CS1: Broken Client-Side Access Control | No          | No       | No new routes or auth changes                                                                                                                                                                                 |
| CS2: Client-Side Injection (XSS)       | Yes         | No       | All toast strings are hardcoded (safe). No `dangerouslySetInnerHTML`, `href={variable}`, or `ref.current.innerHTML`. Sonner toasts use sanitized strings only. Worker uses no eval, no dynamic code execution |
| CS3: Sensitive Data in Client Storage  | No          | No       | No changes to BYOK, localStorage, or IndexedDB storage of secrets                                                                                                                                             |
| CS5: Client-Side Integrity             | Yes         | Info     | Model integrity verification (384-dim check) is basic but adequate for this architecture                                                                                                                      |
| CS7: Client-Side Security Logging      | Yes         | No       | `console.log` calls use only public info (model name, deviceMemory), no secrets                                                                                                                               |
| CS9: Client-Side Communication         | Yes         | No       | CustomEvent dispatch is same-origin only. Worker postMessage uses structured protocol with type guards and no eval                                                                                            |
| A05: Security Misconfiguration         | No          | No       | No config changes to CSP, CORS, or security headers                                                                                                                                                           |
| A06: Vulnerable Components             | Yes         | No       | protobufjs override (7.6.4) proactively fixes dependency CVEs                                                                                                                                                 |
| A07: Auth Failures                     | No          | No       | No auth changes in this story                                                                                                                                                                                 |

### STRIDE Threat Model

**New component: EmbeddingModelProgressToast (`src/app/components/embeddings/EmbeddingModelProgressToast.tsx`)**

| Threat                 | Applicable? | Assessment                                                                                       |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| Spoofing               | No          | No identity involved                                                                             |
| Tampering              | Low         | Progress events from CustomEvent could be forged, but only by same-origin JS (already malicious) |
| Repudiation            | No          | No audit trail needed for progress toasts                                                        |
| Information Disclosure | No          | No sensitive data in progress events                                                             |
| Denial of Service      | Low         | Spamming progress events could create racing toast updates, but requires prior XSS               |
| Elevation of Privilege | No          | Toast component has no auth context                                                              |

### What's Done Well

1. **Worker input validation** (`src/ai/workers/embedding.worker.ts:247`): The `onmessage` handler validates that `texts` is a non-empty array before processing, preventing malformed payloads from reaching the model pipeline.

2. **Hardcoded model identifier prevents SSRF**: The model URL (`Xenova/all-MiniLM-L6-v2`) is hardcoded in the worker — users cannot configure or override it. This eliminates SSRF vectors that would exist if the model source were user-configurable. The model downloads over HTTPS only (confirmed: `remoteHost: "https://huggingface.co/"` in Transformers.js env).

3. **Device-memory gating** (`src/app/App.tsx:105`): The warm-up is gated on `deviceMemory >= 4GB`, preventing memory exhaustion on low-resource devices. The timeout configuration (60s warm-up, 15s first-progress, 120s stall) provides appropriate defensive boundaries for the asynchronous model download flow.

---

Phases: 7/8 | Findings: 1 total (informational) | Blockers: 0 | False positives filtered: 0
