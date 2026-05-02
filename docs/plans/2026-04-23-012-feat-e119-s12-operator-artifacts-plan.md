---
title: "feat: Operator Artifacts — ROPA, DPA, Breach Runbook, Sub-processors"
type: feat
status: active
date: 2026-04-23
origin: docs/brainstorms/2026-04-23-e119-s12-operator-artifacts-requirements.md
---

# feat: Operator Artifacts — ROPA, DPA, Breach Runbook, Sub-processors

## Overview

Deliver the complete set of GDPR operator/controller artifacts for Knowlune: a Record of Processing
Activities (ROPA), a Data Processing Agreement with Supabase, a sub-processor register, a breach
response runbook with tabletop rehearsal notes, a breach register template, a TypeScript
sub-processor registry, and a CI-gated drift-check script that blocks new un-registered
dependencies from entering production.

## Problem Frame

Knowlune processes EU personal data. Without ROPA, DPA, and breach documentation, a regulatory
inquiry or real breach event has no documented answers. The 72-hour Art 33 window requires
pre-written response templates; the Art 30 obligation requires a ROPA. The sub-processor drift
check catches new external services before they are shipped without DPA coverage.

See origin: docs/brainstorms/2026-04-23-e119-s12-operator-artifacts-requirements.md

## Requirements Trace

- R1. ROPA — Art 30 table-driven, one row per processing activity (AC-1)
- R2. DPA with Supabase — Art 28 compliant (AC-2)
- R3. Sub-processor register with DPA version links (AC-3)
- R4. Breach runbook — 72h Art 33 + Art 34 templates, decision tree (AC-4)
- R5. Breach register — empty pseudonymised template (AC-5)
- R6. `subprocessorRegistry.ts` typed module (AC-6)
- R7. `verify-subprocessors.ts` drift-check script (AC-7)
- R8. CI job for sub-processor drift check (AC-8)
- R9. Tabletop rehearsal appendix in breach runbook (AC-9)

## Scope Boundaries

- No live execution of the breach runbook
- No annual review execution (S13)
- No ICO checklist walk (S13)
- Sub-processor drift check compares package.json deps + env var references against
  the registry; it does not auto-register new entries (operator must do that manually)

## Output Structure

    docs/compliance/
      ropa.md
      dpa-supabase.md
      subprocessors.md
      breach-runbook.md
      breach-register.md
    src/lib/compliance/
      subprocessorRegistry.ts
    scripts/compliance/
      verify-subprocessors.ts
    .github/workflows/
      ci.yml  (modified — add verify-subprocessors job)

## Context & Research

### Relevant Code and Patterns

- `docs/compliance/retention.md` — retention column values for ROPA
- `docs/compliance/privacy-notice.md` — processing activities already named
- `docs/compliance/consent-inventory.md` — lawful basis per purpose
- `src/lib/compliance/retentionPolicy.ts` — pattern for typed compliance modules
- `src/lib/compliance/noticeVersion.ts` — pattern for simple typed exports
- `.github/workflows/ci.yml` — existing CI job structure to extend
- `scripts/grep-gate-credentials.sh` — pattern for a CI-safe bash/TS script gate

### Institutional Learnings

- ES2020 target: no `Promise.any`; use `Promise.allSettled`
- Scripts run via `npx tsx` (tsx is available as a devDep through ts-node)
- CI jobs follow the same Node setup pattern: `actions/setup-node@v4` + `npm ci`

### External References

- GDPR Art 28 (DPA), Art 30 (ROPA), Art 33/34 (breach notification)
- EDPB Template Processor Agreement (available via edpb.europa.eu)
- ICO Guide to Data Protection — breach notification checklist

## Key Technical Decisions

- **Markdown for DPA/ROPA**: Legal documents as markdown keeps them diffable, reviewable via PR,
  and version-controlled. No PDF tooling required.
- **TypeScript registry module**: `subprocessorRegistry.ts` is a pure-data module (no imports from
  Dexie/React) so the verify script can import it directly via `tsx` without a full Vite build.
- **Drift check scope**: Scan `package.json` dependencies + `.env.example` / env var names
  against the registry. Packages with no network calls (pure utilities) are allowlisted inside
  the script. The script exits non-zero when a package is found that matches a known
  "external-service" heuristic (e.g., `@supabase/`, `stripe`, `@anthropic-ai/`, `@ai-sdk/`)
  and is not listed in the registry.
- **CI job placement**: Runs after `lint` (fast gate); not required by `ci-status` initially —
  added as `continue-on-error: false` so it blocks PRs.

## Open Questions

### Resolved During Planning

- Which tsx runner is available? `tsx` is in devDeps (used by vitest transforms). Scripts can use `npx tsx`.
- Do we need a separate tsconfig for scripts? No — scripts can use the root tsconfig; `tsx` handles it.

### Deferred to Implementation

- Exact Stripe / Anthropic / OpenAI DPA version URLs: operator to verify and update inline.
- Whether `@mlc-ai/web-llm` counts as a sub-processor: runs fully client-side (WASM), so likely not — implementer to note as "first-party client runtime" in the registry.

## Implementation Units

- [ ] **Unit 1: ROPA (`docs/compliance/ropa.md`)**

  **Goal:** Art 30-compliant record of processing activities table.

  **Requirements:** R1

  **Dependencies:** `docs/compliance/retention.md` (retention column), `docs/compliance/consent-inventory.md` (lawful basis)

  **Files:**
  - Create: `docs/compliance/ropa.md`

  **Approach:**
  - One row per processing activity: Authentication, Learning Content Storage, AI Tutoring,
    Billing, Telemetry/Analytics, Sync Operations
  - Columns: Activity | Controller | Processor | Purpose | Lawful Basis | Data Categories |
    Recipients/Sub-processors | Retention Period
  - Controller = Pedro Lages; Processor = Supabase Ireland Ltd (for server-side), self for
    client-side IndexedDB
  - Retention values pulled directly from `docs/compliance/retention.md`
  - Add document metadata block: last updated, owner, story reference

  **Test scenarios:**
  - Test expectation: none — pure documentation artifact; correctness validated by human review

  **Verification:**
  - `docs/compliance/ropa.md` exists with at least 6 processing activity rows
  - All Art 30 columns present

- [ ] **Unit 2: DPA with Supabase (`docs/compliance/dpa-supabase.md`)**

  **Goal:** Art 28-compliant Data Processing Agreement between controller (Pedro) and processor (Supabase).

  **Requirements:** R2

  **Dependencies:** Unit 1 (sub-processor list in DPA references ROPA activities)

  **Files:**
  - Create: `docs/compliance/dpa-supabase.md`

  **Approach:**
  - Parties section: Data Controller (Pedro Lages / Knowlune), Data Processor (Supabase Inc / Ireland Ltd)
  - Processing instructions: what data, for what purposes, duration
  - Confidentiality obligations
  - Art 32 security measures: encryption at rest, TLS in transit, access control, audit logs
  - Sub-processor list: Fly.io (Supabase hosting), AWS (Supabase storage)
  - Breach notification SLA: Processor notifies Controller within 24h of becoming aware
  - Return/deletion on termination: data export or secure deletion within 30 days
  - Signed date placeholder: `[SIGNED: 2026-04-23 — Pedro Lages]`
  - Note: controller and processor are the same person for current solo operation

  **Test scenarios:**
  - Test expectation: none — documentation artifact

  **Verification:**
  - All required Art 28 clauses present: instructions, confidentiality, Art 32, sub-processors,
    breach SLA, termination/deletion

- [ ] **Unit 3: Sub-processor Register (`docs/compliance/subprocessors.md`)**

  **Goal:** Human-readable list of all third-party services processing personal data on behalf of Knowlune.

  **Requirements:** R3

  **Dependencies:** None

  **Files:**
  - Create: `docs/compliance/subprocessors.md`

  **Approach:**
  - Table columns: Name | Role | Data Transferred | DPA/ToS URL | Version/Date Accepted | Notes
  - Entries: Supabase, Cloudflare, Stripe, Anthropic, OpenAI
  - First-party infra note: Ollama (Unraid) and Whisper (Speaches on Unraid) are self-hosted;
    no data leaves the operator's infrastructure; not sub-processors
  - `@mlc-ai/web-llm` runs in browser WASM — no data transferred externally; not a sub-processor
  - DPA URLs are placeholders marked `[operator to verify current URL]` where not publicly known
  - Sentry noted: error tracking; anonymised stack traces only; DPA link provided

  **Test scenarios:**
  - Test expectation: none — documentation artifact

  **Verification:**
  - All 5+ external services documented; first-party services noted as excluded

- [ ] **Unit 4: Breach Runbook (`docs/compliance/breach-runbook.md`)**

  **Goal:** Operational breach response playbook with Art 33 / Art 34 notification templates and a tabletop rehearsal appendix.

  **Requirements:** R4, R9

  **Dependencies:** Units 2, 3 (references DPA breach SLA and sub-processor list)

  **Files:**
  - Create: `docs/compliance/breach-runbook.md`

  **Approach:**
  - Sections:
    1. Detection Signals (anomaly alerts, user reports, Supabase security emails, Sentry spikes)
    2. Immediate Triage (first 2h): contain, assess scope, preserve evidence
    3. Severity Classification: Low / Medium / High / Critical with criteria
    4. Notify-or-Not Decision Tree: flowchart in ASCII or Markdown table — Art 33 threshold
       is "likely to result in a risk to rights and freedoms"
    5. 72h Art 33 ICO Notification Template (fill-in-blanks format)
    6. Art 34 User Notification Template (for high-risk breaches only)
    7. Post-Incident Review checklist
    8. **Appendix A: Tabletop Rehearsal Notes** — scenario: "Supabase database credential
       exposed in a public GitHub commit"; walk through detection → triage → classify → notify
       decision → draft Art 33 notification; record findings and gaps
  - ICO notification URL: `https://ico.org.uk/for-organisations/report-a-breach/`

  **Test scenarios:**
  - Test expectation: none — documentation artifact

  **Verification:**
  - All 7 sections present including Appendix A tabletop rehearsal
  - Art 33 template includes all GDPR-required fields: nature, categories/approximate number of
    data subjects, likely consequences, measures taken/proposed

- [ ] **Unit 5: Breach Register Template (`docs/compliance/breach-register.md`)**

  **Goal:** Empty pseudonymised breach log template.

  **Requirements:** R5

  **Dependencies:** Unit 4

  **Files:**
  - Create: `docs/compliance/breach-register.md`

  **Approach:**
  - Table columns: Incident ID (UUID) | Date Detected | Date Notified to ICO | Severity |
    Data Categories Affected | Approximate No. of Data Subjects | Root Cause Summary |
    Outcome / Resolution | Art 33 Filed (Y/N) | Art 34 Filed (Y/N) | Notes
  - One example row with all fields redacted/pseudonymised to show format
  - Note: register is maintained as a controlled document; access restricted to operator

  **Test scenarios:**
  - Test expectation: none — documentation artifact

  **Verification:**
  - File exists with all required columns; example row present

- [ ] **Unit 6: Sub-processor TypeScript Registry (`src/lib/compliance/subprocessorRegistry.ts`)**

  **Goal:** Machine-readable typed list of sub-processors, consumed by the drift-check script.

  **Requirements:** R6

  **Dependencies:** Unit 3

  **Files:**
  - Create: `src/lib/compliance/subprocessorRegistry.ts`

  **Approach:**
  - `SubProcessor` interface: `{ name: string; role: string; dpaUrl: string; dataTransferred: string[]; packagePatterns: string[] }`
  - `packagePatterns`: glob-style strings that the verify script matches against npm package names
    e.g., `['@supabase/*', 'supabase']` for Supabase
  - `SUBPROCESSOR_REGISTRY: readonly SubProcessor[]` export
  - `FIRST_PARTY_INFRA` string[] export listing packages that are self-hosted and excluded from
    the check (e.g., `['@mlc-ai/web-llm']`)
  - Pure module: no Dexie, React, Zustand imports
  - Follow pattern of `src/lib/compliance/retentionPolicy.ts`

  **Patterns to follow:**
  - `src/lib/compliance/retentionPolicy.ts` — pure typed compliance module pattern

  **Test scenarios:**
  - Happy path: `SUBPROCESSOR_REGISTRY` has at least 5 entries (Supabase, Cloudflare, Stripe, Anthropic, OpenAI)
  - Happy path: Each entry has non-empty `packagePatterns`
  - Happy path: `FIRST_PARTY_INFRA` contains `@mlc-ai/web-llm`
  - Edge case: No duplicate `name` entries in registry

  **Verification:**
  - TypeScript compiles without error (`npx tsc --noEmit`)
  - All 5+ sub-processors listed

- [ ] **Unit 7: Sub-processor Drift Check Script (`scripts/compliance/verify-subprocessors.ts`)**

  **Goal:** CLI script that exits non-zero when `package.json` contains a dependency matching a
  known-external-service pattern that is not in `subprocessorRegistry.ts`.

  **Requirements:** R7

  **Dependencies:** Unit 6

  **Files:**
  - Create: `scripts/compliance/verify-subprocessors.ts`

  **Approach:**
  - Read `package.json` from cwd; extract `dependencies` + `devDependencies` keys
  - For each package name, check if it matches any `packagePatterns` from `SUBPROCESSOR_REGISTRY`
    OR is in `FIRST_PARTY_INFRA` OR is in a hardcoded internal-only allowlist (pure utilities
    like `lodash`, `date-fns`, `react`, etc.)
  - "External service heuristic": flag packages whose names include known API client patterns
    (`@supabase/`, `stripe`, `@anthropic-ai/`, `@ai-sdk/`, `@sentry/`, `openai`) that are NOT
    in the registry
  - Output: list of flagged packages with `[UNLISTED]` prefix; exit 0 if none flagged
  - Run with `npx tsx scripts/compliance/verify-subprocessors.ts`
  - No network calls; pure filesystem + import

  **Test scenarios:**
  - Happy path: Running against current `package.json` exits 0 (all AI SDK packages registered)
  - Error path: A mock `package.json` with an unlisted `@openai/new-package` exits non-zero
  - Edge case: `devDependencies` only packages (build tools) do not trigger the check unless
    they match the external-service heuristic

  **Verification:**
  - `npx tsx scripts/compliance/verify-subprocessors.ts` exits 0 against current codebase
  - Adding a fake `@fake-external/api` to the heuristic list triggers exit 1

- [ ] **Unit 8: CI Integration (`.github/workflows/ci.yml`)**

  **Goal:** Add `verify-subprocessors` CI job that blocks PRs when new unregistered external dependencies are introduced.

  **Requirements:** R8

  **Dependencies:** Unit 7

  **Files:**
  - Modify: `.github/workflows/ci.yml`

  **Approach:**
  - Add a new `verify-subprocessors` job using the same Node setup pattern as existing jobs
  - Step: `npx tsx scripts/compliance/verify-subprocessors.ts`
  - Runs on `pull_request` + `push` to main/develop
  - Add to `ci-status` job's `needs` array so it blocks the status check
  - `continue-on-error: false` (hard failure)

  **Test scenarios:**
  - Test expectation: none — CI configuration; validated by manual review of YAML structure

  **Verification:**
  - YAML is valid (passes `npx js-yaml --quiet` or similar)
  - `ci-status` job `needs` includes `verify-subprocessors`

## System-Wide Impact

- **Interaction graph:** `verify-subprocessors.ts` imports `subprocessorRegistry.ts`; CI imports
  `verify-subprocessors.ts` as a run step. No production code affected.
- **Error propagation:** Script failures produce stderr output and exit non-zero; CI reports job
  failure on the PR.
- **State lifecycle risks:** None — all artifacts are static documents or pure-data modules.
- **API surface parity:** `subprocessorRegistry.ts` is the single source of truth; `subprocessors.md`
  is the human-readable counterpart. They must stay in sync (no automated parity check planned — 
  added to annual review checklist in S13).
- **Unchanged invariants:** No changes to existing `src/lib/compliance/` modules or Supabase schema.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| DPA URLs for Anthropic/OpenAI become stale | Marked as `[operator to verify]`; annual review checklist (S13) includes DPA refresh |
| `@ai-sdk/*` packages multiply in package.json and heuristic match is too broad | `packagePatterns` per registry entry are specific; unmatched `@ai-sdk/*` items flag correctly |
| tsx not available in CI | tsx is in devDependencies; `npm ci` installs it |

## Documentation / Operational Notes

- After S12 merges, `docs/compliance/` will have 8 of 11 required files (S13 adds README, annual-review, ico-checklist).
- The DPA is a real GDPR document even though controller = operator (Pedro) for current stage.
  Its value is institutional: establishes the separation formally the day infra operations delegate.

## Sources & References

- **Origin document:** docs/brainstorms/2026-04-23-e119-s12-operator-artifacts-requirements.md
- **Story file:** docs/implementation-artifacts/stories/E119-S12.md
- **Retention reference:** docs/compliance/retention.md
- **Privacy notice:** docs/compliance/privacy-notice.md
- **Consent inventory:** docs/compliance/consent-inventory.md
- **Pattern reference:** src/lib/compliance/retentionPolicy.ts
- **CI reference:** .github/workflows/ci.yml
- **GDPR Art 28:** https://gdpr.eu/article-28-processor/
- **GDPR Art 30:** https://gdpr.eu/article-30-records-of-processing-activities/
- **GDPR Art 33/34:** https://gdpr.eu/article-33-notification-of-a-personal-data-breach/
