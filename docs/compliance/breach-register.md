# Breach Register

**GDPR Article 33(5) — Record of Personal Data Breaches**

**Last updated:** 2026-04-23
**Owner:** Pedro Lages (Controller / Operator)
**Story:** E119-S12
**Access:** Restricted to controller and any delegated DPO / legal counsel.

---

## Notes

- GDPR Art 33(5) requires the controller to document all personal data breaches, regardless of
  whether they are notified to the supervisory authority.
- All fields relating to data subjects use pseudonymised identifiers (UUID-based) — no names
  or email addresses in this register.
- Near-misses (potential breaches that did not result in actual exposure) should also be recorded
  in a separate "Near-miss Log" section below.
- Breach details requiring additional confidentiality should be maintained in an encrypted
  document referenced by the Incident ID only.

---

## Breach Log

| Incident ID | Date Detected (UTC) | Date ICO Notified | Date Users Notified | Severity | Data Categories Affected | Approx. No. Data Subjects | Root Cause Summary | Outcome / Resolution | Art 33 Filed | Art 34 Filed | ICO Reference | Notes |
|-------------|---------------------|-------------------|---------------------|----------|--------------------------|--------------------------|-------------------|---------------------|-------------|-------------|---------------|-------|
| REH-001 | 2026-04-23 (tabletop exercise) | N/A (rehearsal) | N/A (rehearsal) | HIGH (simulated) | Email, notes, bookmarks, AI history (simulated) | 47 (simulated) | service_role key exposed in public GitHub commit for 3h (simulated scenario) | Key rotated; runbook validated; gaps documented in Appendix A of breach-runbook.md | No (rehearsal) | No (rehearsal) | N/A | Tabletop rehearsal only — not a real incident. See breach-runbook.md Appendix A |

*← Replace this example row with real incidents. The REH-001 row is a rehearsal record and should remain for audit trail purposes.*

---

## Near-Miss Log

| Near-Miss ID | Date (UTC) | Description | Risk Assessment | Action Taken |
|-------------|-----------|-------------|-----------------|-------------|
| *(none yet)* | | | | |

---

## Column Definitions

| Column | Description |
|--------|-------------|
| Incident ID | Format: `INC-YYYY-NNN` for real incidents; `REH-YYYY-NNN` for rehearsals |
| Date Detected | ISO 8601 UTC datetime when the controller became aware |
| Date ICO Notified | ISO 8601 date; "N/A" if Art 33 threshold not met; "Pending" if within 72h window |
| Date Users Notified | ISO 8601 date; "N/A" if Art 34 threshold not met |
| Severity | Low / Medium / High / Critical (per breach-runbook.md Section 3) |
| Data Categories Affected | From ROPA categories: email, auth tokens, notes, bookmarks, embeddings, AI history, payment IDs, analytics events |
| Approx. No. Data Subjects | Best estimate; "Under investigation" acceptable initially |
| Root Cause Summary | 1–2 sentence plain-language description; full details in encrypted incident report |
| Outcome / Resolution | How the breach was contained and remediated |
| Art 33 Filed | Yes / No; if No, document reason in Notes |
| Art 34 Filed | Yes / No; if No, document reason in Notes |
| ICO Reference | ICO case reference number (provided after online submission) |
| Notes | Any additional context, lessons learned, or links to incident reports |

---

## Retention

This register is retained indefinitely as it forms part of the controller's Art 30 / Art 33(5)
documentation obligations. Individual incident details in the encrypted incident report are
retained for a minimum of 5 years from the date of the breach.
