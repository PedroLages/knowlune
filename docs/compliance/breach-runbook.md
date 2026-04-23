# Breach Response Runbook

**GDPR Articles 33 & 34 — Personal Data Breach Response**

**Version:** 1.0
**Last updated:** 2026-04-23
**Owner:** Pedro Lages (Controller / DPO-equivalent)
**Story:** E119-S12
**ICO breach report portal:** https://ico.org.uk/for-organisations/report-a-breach/

---

> **How to use this runbook.** When a potential breach is detected, work through sections 1–4
> sequentially. Use the decision tree in section 4 to determine notification obligations.
> Complete the Art 33 template (section 5) if ICO notification is required. Record the incident
> in `docs/compliance/breach-register.md` regardless of notification outcome.

---

## 1. Detection Signals

A personal data breach is any accidental or unlawful destruction, loss, alteration, unauthorised
disclosure of, or access to, personal data (GDPR Art 4(12)).

**Watch for these signals:**

| Signal | Source | Action |
|--------|--------|--------|
| Supabase security advisory email | privacy@supabase.com / security@supabase.com | Treat as potential breach; begin triage immediately |
| Unusual Supabase auth logs (mass password resets, failed logins from unknown IPs) | Supabase Dashboard → Auth → Users | Investigate; preserve logs |
| Sentry error spike referencing user IDs or auth tokens in stack traces | Sentry dashboard | Check if PII is leaking; stop logging if so |
| GitHub Security Alert — dependency with CVE | GitHub Dependabot | Assess exploitability against Knowlune's use of the package |
| User report of suspicious activity ("someone accessed my account") | privacy@knowlune.com | Treat as confirmed breach indicator; begin triage |
| Processor (Supabase) breach notification | 24h SLA per `docs/compliance/dpa-supabase.md` Section 9 | Escalate immediately to Art 33 assessment |
| API key found in public repository or paste site | Manual discovery / GitGuardian | Rotate key immediately; begin triage |
| Cloudflare DDoS or WAF alert with data exfiltration pattern | Cloudflare dashboard | Investigate traffic logs; preserve |

---

## 2. Immediate Triage (First 2 Hours)

**Document the time you became aware.** The 72-hour ICO notification clock starts at this moment.

### 2.1 Contain

- [ ] Identify the vector: compromised credential? Misconfigured RLS? Vulnerable dependency?
- [ ] If a Supabase key is compromised: **rotate immediately** in Supabase Dashboard → Settings → API
- [ ] If an env var / secret is exposed in a public repo: revoke via the relevant service dashboard, then rotate all related secrets
- [ ] If a user account is compromised: disable the session in Supabase Auth → Users → Revoke sessions
- [ ] If a dependency vulnerability is actively exploited: remove the package or apply the patch; deploy immediately

### 2.2 Assess Scope

Document answers to the following:

1. **What data was exposed?** (categories: auth tokens, email, learning content, payment identifiers, embeddings)
2. **How many data subjects are affected?** (approximate number is sufficient for Art 33)
3. **Has the data been accessed externally?** (confirmed vs suspected)
4. **Is the breach ongoing or contained?**
5. **Which systems are affected?** (Supabase DB, Storage bucket, client-side IndexedDB, Sentry)

### 2.3 Preserve Evidence

- [ ] Export relevant Supabase auth logs
- [ ] Screenshot Sentry error events
- [ ] Export Cloudflare access logs if applicable
- [ ] Do NOT delete logs or modify data until the incident is closed

---

## 3. Severity Classification

| Severity | Criteria | Likely Art 33? | Likely Art 34? |
|----------|----------|---------------|----------------|
| **Low** | No confirmed unauthorised access; potential vulnerability only; no personal data confirmed exposed | No | No |
| **Medium** | Personal data accessed without authorisation but: low risk to data subjects (e.g., anonymised usage events), small number of subjects, no sensitive categories, promptly contained | Likely yes (assess per decision tree) | Likely no |
| **High** | Personal data with moderate risk: email addresses, learning content, AI conversation history exposed; larger number of subjects; or uncertain scope | Yes | Case-by-case |
| **Critical** | High-risk data exposed: passwords (pre-hash), financial identifiers, health/special-category data (Knowlune does not process special-category data currently); mass exposure; ongoing breach; or malicious actor confirmed | Yes — file within 72h | Yes (unless law enforcement objects) |

---

## 4. Notify-or-Not Decision Tree

```
Potential breach detected
        │
        ▼
Is it confirmed that personal data was destroyed,
lost, altered, disclosed, or accessed without authorisation?
        │
    No ──► Monitor; document as "near-miss" in breach register; no Art 33 required
        │
       Yes
        │
        ▼
Is the breach "unlikely to result in a risk to the
rights and freedoms of natural persons"?
(Low severity per Section 3 — anonymised data, no identified individuals, promptly contained)
        │
    Yes ──► Document in breach register; notify Supabase if they caused it; no ICO notification required
        │
       No (risk exists)
        │
        ▼
FILE ART 33 NOTIFICATION WITH ICO within 72 hours
Go to Section 5 ──►
        │
        ▼
Is the breach "likely to result in a HIGH risk to the
rights and freedoms of natural persons"?
(Mass exposure; sensitive data; financial harm probable; identity theft risk)
        │
    No ──► ICO only; no Art 34 user notification required
        │
       Yes
        │
        ▼
FILE ART 34 USER NOTIFICATION
Go to Section 6 ──►
```

**Reminder:** When in doubt, notify. Failure to notify within 72h must be justified and documented.
Regulatory guidance is to err on the side of notification.

---

## 5. Art 33 ICO Notification Template

**ICO online report:** https://ico.org.uk/for-organisations/report-a-breach/

Complete all fields before submitting. If information is unavailable at 72h, submit what is
available and supplement within a reasonable timeframe.

```
ORGANISATION DETAILS
--------------------
Organisation name: Knowlune (Pedro Lages, sole operator)
Sector: Online learning / EdTech
Contact for this incident: Pedro Lages <privacy@knowlune.com>
Data Protection Officer: Pedro Lages (SME — no mandatory DPO; controller acts as DPO-equivalent)

INCIDENT DETAILS
----------------
Date/time you became aware: [YYYY-MM-DD HH:MM UTC]
Date/time the breach occurred (if known): [YYYY-MM-DD HH:MM UTC or "Unknown"]
Date/time breach was contained (if contained): [YYYY-MM-DD HH:MM UTC or "Ongoing"]

NATURE OF THE BREACH
---------------------
Type of breach (tick all that apply):
  [ ] Confidentiality (unauthorised/accidental disclosure)
  [ ] Integrity (unauthorised/accidental alteration)
  [ ] Availability (accidental/unauthorised destruction or loss of access)

Description:
[2–3 sentences: what happened, how it was discovered, what vector was involved]

PERSONAL DATA INVOLVED
----------------------
Categories of data affected:
  [ ] Email addresses
  [ ] Password hashes / authentication tokens
  [ ] Learning content (notes, bookmarks, flashcards)
  [ ] AI conversation history
  [ ] Embedding vectors
  [ ] Payment identifiers (Stripe customer ID — NOT card details)
  [ ] Usage/analytics events
  [ ] Other: _______

Approximate number of data subjects affected: [NUMBER or RANGE or "Under investigation"]
Approximate number of personal data records affected: [NUMBER or RANGE or "Under investigation"]

LIKELY CONSEQUENCES
-------------------
[Describe probable impact on data subjects: risk of identity theft, financial harm, reputational
damage, emotional distress, etc. Be specific about why this risk is LOW / MEDIUM / HIGH.]

MEASURES TAKEN OR PROPOSED
---------------------------
Immediate measures:
- [e.g., Supabase API key rotated at HH:MM UTC on YYYY-MM-DD]
- [e.g., Affected sessions revoked for N users]
- [e.g., Vulnerable dependency patched and deployed]

Measures to prevent recurrence:
- [e.g., RLS policy tightened on affected table]
- [e.g., Secret scanning enabled in GitHub repository]

Have affected individuals been notified? [Yes / No / Pending]
If yes, how and when: [channel and date]
If no, why not: [e.g., "Risk is not high — Art 34 threshold not met"]
```

---

## 6. Art 34 User Notification Template

Use this template when the breach is assessed as **high risk** to data subjects (per Section 4
decision tree). Send via email to affected users using the registered email address on their
Knowlune account.

**Important:** Art 34 requires communication "without undue delay". Do not delay beyond 72h
after confirming high-risk status. Consult with ICO before notifying if law enforcement objects.

```
Subject: Important security notice regarding your Knowlune account

Dear [Name / "Knowlune user"],

We are writing to inform you of a security incident that may have affected your personal data
held by Knowlune.

WHAT HAPPENED
[One paragraph: plain language description of the breach. Example:
"On [date], we discovered that [describe incident]. This meant that [describe what data was
accessible or exposed]."]

WHAT DATA WAS INVOLVED
The following types of information may have been accessed or disclosed:
- [Category 1, e.g., "your email address"]
- [Category 2, e.g., "your learning notes and bookmarks"]
[List only what was actually involved — do not list categories that were not affected]

WHAT WE ARE DOING
We have taken the following immediate steps:
- [Action 1, e.g., "Rotated all system credentials that may have been compromised"]
- [Action 2, e.g., "Revoked your current login session as a precautionary measure"]
- [Action 3, e.g., "Notified the Information Commissioner's Office (ICO)"]

WHAT YOU SHOULD DO
- Change your Knowlune password immediately at: https://knowlune.pedrolages.net/settings
- If you use the same password elsewhere, change it on those services too
- Be cautious of unsolicited emails claiming to be from Knowlune
[Add any specific advice relevant to the data categories involved]

CONTACT US
If you have any questions or concerns, please contact us at privacy@knowlune.com.

We sincerely apologise for this incident and the concern it may cause.

Pedro Lages
Knowlune Controller / Operator
privacy@knowlune.com
```

---

## 7. Post-Incident Review Checklist

Complete within 14 days of breach containment.

- [ ] Root cause identified and documented in breach register
- [ ] Immediate mitigations verified (key rotation, patching, RLS fix)
- [ ] Long-term mitigations planned (add to backlog with priority)
- [ ] ICO notified (if required) and ICO reference number recorded in breach register
- [ ] Affected users notified (if Art 34 threshold met) and communication archived
- [ ] Processor (Supabase) informed and their incident report obtained
- [ ] Breach register (`docs/compliance/breach-register.md`) updated with full incident record
- [ ] Lessons learned documented and shared (internally)
- [ ] Privacy notice reviewed — does the breach reveal a processing activity not disclosed?
- [ ] Sub-processor list reviewed — did a sub-processor fail? Update DPA obligations if needed

---

## Appendix A: Tabletop Breach Rehearsal

**Date conducted:** 2026-04-23
**Participants:** Pedro Lages (sole operator)
**Scenario:** Supabase `service_role` API key accidentally committed to a public GitHub repository
in a CI configuration file.

### Scenario Walk-through

**T+0h — Discovery**
- Automated GitHub secret-scanning alert fires: `SUPABASE_SERVICE_ROLE_KEY` detected in commit
  `abc1234` pushed to `main` in a public fork.
- Repository is private but the key was exposed for approximately 3 hours before discovery.

**T+0h 05m — Contain**
- Log into Supabase Dashboard → Settings → API → Generate new service_role key.
- Old key revoked. Application redeployed with new key via GitHub Actions secret update.
- Verify old key is dead: `curl -H "apikey: [old-key]" https://[project].supabase.co/rest/v1/` → 401.

**T+0h 15m — Assess Scope**
1. Data categories accessible with service_role: ALL tables (bypasses RLS), all Storage buckets.
2. Number of data subjects: 47 beta users (Knowlune beta as of 2026-04-23).
3. Confirmed external access: Unknown — no Supabase audit logs available on free plan.
4. Breach ongoing: No (key rotated at T+0h 05m).
5. Systems affected: Supabase DB and Storage (all tables and buckets).

**T+0h 30m — Preserve Evidence**
- Screenshot of GitHub alert and commit details archived.
- Supabase auth logs exported for the 3-hour exposure window (limited to auth events on free plan).

**T+1h — Severity Classification**
- Severity: **HIGH** — service_role bypasses RLS; full database readable; all 47 beta users' data
  potentially exposed; no evidence of access but cannot be excluded.

**T+1h — Decision Tree**
- Confirmed breach: YES.
- Risk to data subjects: YES (email, learning data, AI history potentially readable).
- High risk: BORDERLINE — no financial data or special categories; small user base; limited
  window; promptly contained. Decision: treat as HIGH, file Art 33, assess Art 34.

**T+2h — Art 33 Draft**
- Completed Art 33 template from Section 5.
- Key fields: Nature = Confidentiality; data categories = email, notes, bookmarks, AI history;
  data subjects ≈ 47; window ≈ 3 hours; measures = key rotated, session audit in progress.

**T+68h — ICO Notification Filed**
- Art 33 filed online at ico.org.uk. ICO reference: [TO BE ASSIGNED].
- Art 34 decision: Not filed. Risk assessed as not "high risk" after review — no evidence of access,
  small window, no sensitive categories, prompt containment. Decision documented.

### Findings and Gaps Identified

| Finding | Action |
|---------|--------|
| Free-tier Supabase does not provide granular audit logs (read access per row) | Consider upgrading to Pro for PITR + enhanced logging; document as known gap |
| No alerting for Supabase key usage anomalies | Add Supabase → Webhooks → auth events to Sentry or similar |
| GitHub Actions secrets not scanned pre-commit | Add `gitleaks` or GitHub secret scanning to pre-commit hook |
| Breach register was empty before this exercise | Template created (breach-register.md); rehearsal incident recorded as REH-001 |
| No dedicated security email alias | privacy@knowlune.com doubles as security contact; acceptable for solo operator |

### Rehearsal Verdict

Runbook is functional for a solo-operator incident. Key gaps are tooling (audit logs, anomaly
alerting) rather than process. Process is clear and the 72h window is achievable.

**Next rehearsal scheduled:** 2027-Q2 (aligned with first annual review).
