# Compliance Documentation

**Owner:** Pedro Lages (Controller / Operator)
**Last updated:** 2026-04-23
**Epic:** E119 — GDPR Full Compliance

This directory contains the complete GDPR compliance documentation suite for Knowlune. These
documents represent the accountability layer for E119's technical compliance infrastructure.

Start here if you are reviewing compliance status, responding to a data subject request, or
preparing for an ICO enquiry.

---

## Documents

### Core Compliance

| Document | Purpose |
|----------|---------|
| [privacy-notice.md](privacy-notice.md) | The live privacy notice shown to users at `/legal/privacy`. Describes what data Knowlune collects, why, how long it is retained, and users' rights under UK/EU GDPR. |
| [consent-inventory.md](consent-inventory.md) | Authoritative list of every data processing purpose, its lawful basis, data categories, and withdrawal effects. Machine-readable purpose keys match `src/lib/compliance/consentService.ts`. |
| [ropa.md](ropa.md) | Records of Processing Activities (ROPA) — required by GDPR Art. 30. Documents all 51+ database tables, their data categories, lawful basis, and retention periods. |

### Sub-processors and Data Transfers

| Document | Purpose |
|----------|---------|
| [subprocessors.md](subprocessors.md) | Register of all third-party sub-processors (Supabase, Cloudflare, Stripe). Includes DPA/ToS acceptance dates and data transfer mechanisms. |
| [dpa-supabase.md](dpa-supabase.md) | Data Processing Agreement with Supabase (primary processor). Records DPA version, acceptance date, SCCs, and data location (AWS eu-west-1). |

### Retention and Data Lifecycle

| Document | Purpose |
|----------|---------|
| [retention.md](retention.md) | Data retention schedule — the authoritative human-readable counterpart to `src/lib/compliance/retentionPolicy.ts`. Specifies retention period and deletion mechanism for every data category. |

### Incident Response

| Document | Purpose |
|----------|---------|
| [breach-runbook.md](breach-runbook.md) | Step-by-step playbook for responding to a personal data breach. Covers containment, ICO notification (Art. 33 — 72-hour window), and user notification (Art. 34). |
| [breach-register.md](breach-register.md) | GDPR Art. 33(5) register of all personal data breaches and near-misses. Each entry records detection date, severity, affected data categories, resolution, and whether ICO was notified. |

### Annual Review and Regulatory Evidence

| Document | Purpose |
|----------|---------|
| [annual-review.md](annual-review.md) | Annual compliance review checklist. Pedro's repeatable runbook to verify that E119 infrastructure continues to operate correctly. First review: 2027-Q2. |
| [ico-sme-checklist-2026.md](ico-sme-checklist-2026.md) | ICO SME self-assessment checklist completed 2026-04-23. Records PASS/N/A/ACCEPTED RISK against all ICO accountability requirements. All 42 items passed. |

---

## Related Code

| Location | Purpose |
|----------|---------|
| `src/lib/compliance/` | TypeScript compliance library — `noticeVersion`, `noticeAck`, `consentService`, `consentEffects`, `retentionPolicy`, `subprocessorRegistry`, `exportBundle`, `emailTemplates` |
| `src/app/components/compliance/` | Compliance UI components — `LegalUpdateBanner`, `SoftBlockGate`, `ProviderReconsentModal` |
| `src/app/pages/legal/` | Legal pages — `PrivacyPolicy`, `TermsOfService`, `LegalUpdateBanner` |
| `scripts/compliance/` | CLI compliance scripts — `verify-subprocessors.ts` (CI drift-check), `ack-rate-report.ts` (weekly ack-rate report) |
| `scripts/jobs/` | Scheduled jobs — `retention-tick.ts` (daily retention enforcement) |
| `tests/e2e/compliance/` | End-to-end compliance test suite — notice ack, consent withdrawal, data export, provider change, beta re-ack, lifecycle |

---

## Quick Reference: Data Subject Rights

| Right | How to Fulfil | Time Limit |
|-------|--------------|-----------|
| Access (Art. 15) | Email Pedro — manual review + export | 1 month |
| Erasure (Art. 17) | Settings → Account → "Delete My Account" | 1 month; grace period 7 days |
| Portability (Art. 20) | Settings → Privacy → "Export my data" (ZIP) | 1 month |
| Rectification (Art. 16) | Email Pedro or update via account settings | 1 month |
| Object / Restrict (Art. 18, 21) | Settings → Privacy → consent toggles; immediate technical effect | 1 month |
| Withdraw Consent (Art. 7(3)) | Settings → Privacy → per-purpose toggle; immediate effect | Immediate |

---

## Supervisory Authority

**UK Information Commissioner's Office (ICO)**
- Website: https://ico.org.uk
- Register a complaint: https://ico.org.uk/make-a-complaint/
- SME Web Hub: https://ico.org.uk/for-organisations/sme-web-hub/

---

*E119 — GDPR Full Compliance epic completed 2026-04-23.*
