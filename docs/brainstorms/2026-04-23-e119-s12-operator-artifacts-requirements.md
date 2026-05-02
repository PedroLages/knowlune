# E119-S12 Requirements: Operator Artifacts — ROPA, DPA, Breach Runbook, Sub-processors

**Date:** 2026-04-23
**Story:** E119-S12

---

## Problem Statement

Knowlune processes personal data of EU data subjects. As controller/operator, Pedro needs the
full set of GDPR Article 30 / Article 28 documentation: a Record of Processing Activities (ROPA),
a Data Processing Agreement (DPA) with Supabase, a sub-processor register, a breach response
runbook, and a breach register. Without these, a DPA inquiry or regulatory audit has no documented
answers, and a real breach event would be handled ad-hoc rather than within the 72-hour Art 33 window.

Additionally, a TypeScript sub-processor registry and a CI-gated drift-check script ensure that
new npm dependencies or environment variables referencing external services are caught before
they enter production undocumented.

---

## Acceptance Criteria

| # | Criteria |
|---|----------|
| AC-1 | `docs/compliance/ropa.md` — table-driven, one row per processing activity (auth, content, AI tutoring, billing, telemetry, sync). Columns per Art 30: activity, controller, processor, purpose, lawful basis, data categories, recipients, retention. |
| AC-2 | `docs/compliance/dpa-supabase.md` — Art 28 compliant markdown DPA: parties, instructions, confidentiality, Art 32 security measures, sub-processor list, 24h breach SLA (processor→controller), return/deletion on termination. |
| AC-3 | `docs/compliance/subprocessors.md` — each sub-processor with DPA version link. Ollama + Whisper noted as first-party infra (not sub-processors). |
| AC-4 | `docs/compliance/breach-runbook.md` — detection signals, triage, severity classification, 72h Art 33 notification template, Art 34 user notification template, notify-or-not decision tree, tabletop rehearsal appendix. |
| AC-5 | `docs/compliance/breach-register.md` — empty table template (pseudonymised schema). |
| AC-6 | `src/lib/compliance/subprocessorRegistry.ts` — typed list of sub-processors: name, role, DPA link, data transferred. |
| AC-7 | `scripts/compliance/verify-subprocessors.ts` — scans package.json + env var references; compares against registry + subprocessors.md; exits non-zero on unlisted packages. |
| AC-8 | CI runs `verify-subprocessors.ts` on PRs via new job in ci.yml. |
| AC-9 | Tabletop breach rehearsal walk-through recorded in breach-runbook.md appendix. |

---

## Out of Scope

- Annual review execution (S13 delivers the checklist; first run is 2027-Q2).
- ICO SME checklist walk (S13).
- Enforcement of DPA e-signatures (this is a sole-trader controller/processor overlap; markdown suffices).

---

## Technical Context

- `docs/compliance/` already contains: `consent-inventory.md`, `privacy-notice.md`, `retention.md`.
- `src/lib/compliance/` already has: `consentEffects.ts`, `consentService.ts`, `emailTemplates.ts`, `exportBundle.ts`, `noticeAck.ts`, `noticeVersion.ts`, `providerMeta.ts`, `retentionPolicy.ts`.
- `retention.md` provides the retention column values for the ROPA.
- CI uses `.github/workflows/ci.yml`; verify-subprocessors job slots in after lint.
- Script must be runnable with `npx tsx` (already in devDeps via vite/ts setup).
- ES2020 target — no `Promise.any`.

---

## Open Questions

1. Which Stripe DPA version is currently accepted? (Use latest public URL as placeholder — operator to confirm.)
2. Anthropic and OpenAI DPAs: confirm accepted at org level or per-product?
3. Cloudflare: Pages + Workers DPA or unified agreement?

*(These are noted in subprocessors.md as "operator to verify" rather than blocking delivery.)*
