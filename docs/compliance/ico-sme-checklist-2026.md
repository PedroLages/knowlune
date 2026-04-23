# ICO SME Self-Assessment Checklist 2026

**Organisation:** Knowlune (sole trader — Pedro Lages, Controller/Operator)
**Date completed:** 2026-04-23
**Completed by:** Pedro Lages
**Reference:** ICO SME Web Hub — https://ico.org.uk/for-organisations/sme-web-hub/checklists/
  *(accessed 2026-04-23)*
**Story:** E119-S13

This checklist records Knowlune's self-assessment against the ICO's SME accountability
requirements. It is intended as evidence of accountability under GDPR Article 5(2) and should
be reviewed alongside the full compliance documentation suite in `docs/compliance/`.

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| **PASS** | Requirement is met; evidence is documented |
| **N/A** | Requirement does not apply to Knowlune in its current form; rationale given |
| **ACCEPTED RISK** | Requirement partially met; gap documented with rationale and remediation plan |

---

## 1. Lawfulness, Fairness and Transparency

*GDPR Art. 5(1)(a), Art. 6, Art. 13/14*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 1.1 | We have identified at least one lawful basis for all our processing activities | PASS | `docs/compliance/ropa.md`, `docs/compliance/consent-inventory.md` | Contract, consent, and legitimate interest bases documented per processing activity |
| 1.2 | We document our lawful basis for processing in our Records of Processing Activities | PASS | `docs/compliance/ropa.md` | All 39+ sync tables documented with lawful basis |
| 1.3 | Where we rely on consent, we obtain it freely, specifically, and unambiguously | PASS | `docs/compliance/consent-inventory.md`, `src/app/components/settings/sections/PrivacySection.tsx` | Per-purpose toggles; bundling prohibited; `ai_tutor`, `ai_embeddings`, `voice_transcription`, `analytics_telemetry`, `marketing_email` each independently granted/withdrawn |
| 1.4 | We have a clear privacy notice available to individuals at the point of data collection | PASS | `docs/compliance/privacy-notice.md`, `/legal/privacy` route | Notice shown at signup (checkbox); accessible from footer and settings |
| 1.5 | Our privacy notice is written in plain, clear language | PASS | `docs/compliance/privacy-notice.md` | Written for a non-expert audience; avoids legalese in user-facing sections |
| 1.6 | Our privacy notice tells people what we do with their data, why, and for how long | PASS | `docs/compliance/privacy-notice.md`, `docs/compliance/retention.md` | Retention periods documented per data category; cross-referenced in notice |
| 1.7 | We inform people about their rights under GDPR | PASS | `docs/compliance/privacy-notice.md` Section "Your Rights" | Art. 15–22 rights enumerated with contact mechanism (email to Pedro) |

---

## 2. Purpose Limitation

*GDPR Art. 5(1)(b)*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 2.1 | We only collect personal data for specified, explicit and legitimate purposes | PASS | `docs/compliance/ropa.md`, `docs/compliance/consent-inventory.md` | Each processing purpose is separately specified; no bundled or unspecified collection |
| 2.2 | We do not use personal data for new purposes incompatible with the original purpose without a new lawful basis | PASS | `docs/compliance/ropa.md` | All purposes are static and documented; any new processing purpose would require a ROPA update and notice bump |
| 2.3 | We document our purposes in our ROPA | PASS | `docs/compliance/ropa.md` | 39 sync tables + 7 compliance tables + 5 Supabase system tables documented |

---

## 3. Data Minimisation

*GDPR Art. 5(1)(c)*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 3.1 | We only collect personal data that is adequate and relevant to the purposes | PASS | `docs/compliance/ropa.md` | Email required for auth; learning data required for core service; consent purposes off by default |
| 3.2 | We do not collect excessive data | PASS | `docs/compliance/consent-inventory.md` | AI embeddings and telemetry require opt-in; not collected by default |
| 3.3 | We review the data we hold and delete data we no longer need | PASS | `docs/compliance/retention.md`, `scripts/jobs/retention-tick.ts` | Retention TTL enforced daily by Edge Function cron (E119-S11) |

---

## 4. Accuracy

*GDPR Art. 5(1)(d)*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 4.1 | We take reasonable steps to keep personal data accurate and up-to-date | PASS | Users can update email via Supabase auth; learning data is user-controlled | |
| 4.2 | We have a process for individuals to request rectification of their data | PASS | `docs/compliance/privacy-notice.md` Section "Your Rights" | Email request to Pedro; account settings allow email update |

---

## 5. Storage Limitation

*GDPR Art. 5(1)(e)*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 5.1 | We do not keep personal data longer than necessary | PASS | `docs/compliance/retention.md`, `scripts/jobs/retention-tick.ts` | Account-lifetime + 30d retention; retention job enforces TTL daily |
| 5.2 | We have a retention schedule | PASS | `docs/compliance/retention.md` | Typed retention policy in `src/lib/compliance/retentionPolicy.ts`; parity test in `src/lib/compliance/__tests__/retentionParity.test.ts` |
| 5.3 | We have a process to delete or anonymise data at the end of its retention period | PASS | `src/lib/compliance/retentionPolicy.ts`, `scripts/jobs/retention-tick.ts` | `hardDeleteUser` cascade deletes all user data; retention tick purges orphaned rows |

---

## 6. Integrity and Confidentiality (Security)

*GDPR Art. 5(1)(f), Art. 32*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 6.1 | We implement appropriate technical measures to keep personal data secure | PASS | Supabase Row-Level Security (RLS) enabled on all tables; TLS in transit; AES-256 encryption at rest (Supabase / AWS) | |
| 6.2 | We have appropriate organisational measures to keep personal data secure | PASS | Solo operator; no employees with separate access; service-role key held in Supabase Dashboard only | |
| 6.3 | We assess the risk of our processing to individuals and implement appropriate security | PASS | `docs/compliance/dpa-supabase.md`, `docs/compliance/subprocessors.md` | Supabase DPA accepted; Cloudflare edge protection; Stripe PCI-DSS Level 1 |
| 6.4 | We have a procedure for managing and reporting data breaches | PASS | `docs/compliance/breach-runbook.md`, `docs/compliance/breach-register.md` | 72-hour ICO notification window documented; tabletop exercise completed (REH-001) |
| 6.5 | We know when a breach must be reported to the ICO | PASS | `docs/compliance/breach-runbook.md` Section "ICO Notification Checklist" | Threshold: high risk to data subjects → mandatory; low risk → documented but not notified |
| 6.6 | We know when a breach must be reported to affected individuals | PASS | `docs/compliance/breach-runbook.md` | Art. 34 notification criteria documented; email template in `src/lib/compliance/emailTemplates.ts` |

---

## 7. Accountability

*GDPR Art. 5(2), Art. 24*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 7.1 | We have a record of our processing activities (ROPA) | PASS | `docs/compliance/ropa.md` | Machine-readable + human-readable; covers all 51+ tables |
| 7.2 | We can demonstrate compliance with the data protection principles | PASS | This checklist + `docs/compliance/` suite | E119 compliance infrastructure provides technical enforcement |
| 7.3 | We have data processing agreements with all our processors | PASS | `docs/compliance/dpa-supabase.md`, `docs/compliance/subprocessors.md` | DPA with Supabase (primary processor); ToS-level DPA with Cloudflare, Stripe |
| 7.4 | We carry out and document Data Protection Impact Assessments where required | ACCEPTED RISK | No formal DPIA completed | DPIA not legally required for low-risk processing by a sole trader with no high-risk processing (Art. 35 threshold not met). Knowlune does not process sensitive categories, perform automated profiling with legal effect, or engage in large-scale processing. To be reviewed if processing activities expand materially. |
| 7.5 | We implement data protection by design and by default | PASS | `docs/compliance/consent-inventory.md` — all consent purposes default to `off`; minimal data collection at signup | |
| 7.6 | We have appointed a DPO where required | N/A | Sole trader below DPO threshold (Art. 37) | No public authority, no large-scale systematic monitoring, no large-scale sensitive data processing |

---

## 8. Individual Rights

*GDPR Art. 15–22*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 8.1 | We have a process for handling subject access requests (Art. 15) | PASS | `docs/compliance/privacy-notice.md`; email to Pedro; 30-day response window | |
| 8.2 | We have a process for erasure requests (Art. 17) | PASS | `src/app/components/settings/AccountDeletion.tsx`; `src/lib/account/deleteAccount.ts`; `docs/compliance/breach-runbook.md` | 7-day grace period; `hardDeleteUser` cascade; email confirmation |
| 8.3 | We have a process for data portability (Art. 20) | PASS | `src/app/components/settings/sections/PrivacySection.tsx` ("Export my data" button); `supabase/functions/export-data/` | ZIP export of all personal data; E119-S05/S06 |
| 8.4 | We have a process for objection and restriction requests (Art. 18, 21) | PASS | `docs/compliance/privacy-notice.md`; email to Pedro; consent withdrawal via Settings → Privacy | Consent withdrawal has immediate technical effect (E119-S08) |
| 8.5 | We respond to rights requests within the required timescale (1 month) | PASS | Documented in `docs/compliance/privacy-notice.md`; solo operator can respond immediately for current user base | |
| 8.6 | We have a way for individuals to raise concerns | PASS | `docs/compliance/privacy-notice.md` — email address and ICO complaint link | |

---

## 9. International Data Transfers

*GDPR Art. 44–50, UK GDPR Chapter V*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 9.1 | We know whether we transfer personal data outside the UK/EEA | PASS | `docs/compliance/subprocessors.md` | Supabase: AWS `eu-west-1` (Ireland — EEA); Stripe: United States; Cloudflare: global edge |
| 9.2 | We have an appropriate transfer mechanism for international transfers | PASS | `docs/compliance/dpa-supabase.md`, `docs/compliance/subprocessors.md` | Supabase: Standard Contractual Clauses in DPA; Stripe: SCCs; Cloudflare: adequacy + SCCs |
| 9.3 | We document our transfer mechanisms | PASS | `docs/compliance/subprocessors.md` DPA column | Each sub-processor's transfer mechanism referenced |

---

## 10. Privacy Notices at Point of Collection

*GDPR Art. 13, 14*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 10.1 | We provide a privacy notice at the point of data collection | PASS | `src/app/components/auth/EmailPasswordForm.tsx` — privacy checkbox with link to `/legal/privacy` | Required at signup; linked from Settings |
| 10.2 | Our privacy notice is accessible and easy to find | PASS | `/legal/privacy` route; linked from Settings → Privacy | |
| 10.3 | We update our privacy notice when processing activities change materially | PASS | `src/lib/compliance/noticeVersion.ts` version bump mechanism; `LegalUpdateBanner` re-ack flow | E119-S01/S02 infrastructure |

---

## 11. Consent Management

*GDPR Art. 7*

| # | Checklist Item | Status | Evidence | Notes |
|---|---------------|--------|----------|-------|
| 11.1 | Where we rely on consent, it is freely given, specific, informed and unambiguous | PASS | `docs/compliance/consent-inventory.md`; separate per-purpose toggles | |
| 11.2 | We can demonstrate consent has been given | PASS | `user_consents` table (Supabase); `notice_acknowledgements` table; `docs/compliance/consent-inventory.md` | Consent ledger implemented E119-S07 |
| 11.3 | We make it as easy to withdraw consent as to give it | PASS | Settings → Privacy → per-purpose toggle; immediate technical effect | |
| 11.4 | We do not bundle consent with other terms | PASS | `docs/compliance/consent-inventory.md` — each consent purpose is independently granted/withdrawn | |
| 11.5 | We refresh consent periodically where appropriate | PASS | `LegalUpdateBanner` re-ack flow (E119-S02); notice version bump mechanism | |

---

## Summary

All 42 checklist items are either **PASS** or **N/A** (for inapplicable requirements).

The one **ACCEPTED RISK** item (7.4 — DPIA) is documented with rationale and does not represent
a current legal obligation for Knowlune's processing profile.

**No FAIL items.** E119 epic is compliant with ICO SME requirements as of 2026-04-23.

---

## Review Log

| Review Date | Reviewer | Changes Since Last Review | Overall Status |
|-------------|----------|--------------------------|----------------|
| 2026-04-23 | Pedro Lages | Initial completion (post-E119) | PASS |

---

*Next review: 2027-Q2 (alongside annual-review.md)*
*Reference: [`docs/compliance/README.md`](README.md)*
