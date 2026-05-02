# Annual Compliance Review Checklist

**Owner:** Pedro Lages (Controller / Operator)
**Review cycle:** Annual — first review due **2027-Q2**
**Story:** E119-S13
**Last updated:** 2026-04-23

This checklist is the repeatable runbook for Pedro to verify that Knowlune's GDPR compliance
infrastructure — built across E119 (S01–S13) — continues to operate correctly each year. It is
written to be completed without reference to story files.

---

## Scope

This review covers all data-protection obligations for Knowlune, a solo-operated personal
learning platform. Data subjects: registered beta users. Supervisory authority: UK ICO.

---

## Review Checklist

Complete all items before marking the review as "done". Record the date and outcome in the
[Review Log](#review-log) at the bottom of this document.

---

### 1. Privacy Notice Currency

- [ ] Re-read [`docs/compliance/privacy-notice.md`](privacy-notice.md).
- [ ] Compare each section against actual product features deployed since last review.
  - New features that collect or process personal data must be reflected in the notice.
  - AI providers: verify `docs/compliance/subprocessors.md` and `src/lib/compliance/providerMeta.ts` match the notice.
- [ ] If any material change is needed, bump `CURRENT_NOTICE_VERSION` in
  `src/lib/compliance/noticeVersion.ts` and deploy. The `LegalUpdateBanner` re-ack flow
  (E119-S02) will automatically prompt existing users on next login.
- [ ] Check that the notice is accessible at `/legal/privacy` and renders correctly.

**Evidence location:** `docs/compliance/privacy-notice.md`, `src/lib/compliance/noticeVersion.ts`

---

### 2. Retention Job Verification

- [ ] Open Supabase Dashboard → Edge Functions → `retention-tick`.
- [ ] Confirm invocation logs show daily runs without error for the past 365 days.
- [ ] Review the audit log table (`compliance_audit_log`) for any `retention_skipped` or
  `retention_error` entries.
- [ ] If any gap is found: triage the cause, re-run manually if rows were missed, document in
  this file.

**Evidence location:** Supabase Dashboard → Logs → `retention-tick`
**Reference:** `scripts/jobs/retention-tick.ts`, `docs/compliance/retention.md`

---

### 3. Sub-processor Register Currency

- [ ] Run the drift-check script:
  ```bash
  npx tsx scripts/compliance/verify-subprocessors.ts
  ```
  Must exit 0. Any `[UNLISTED]` output is a blocker — register the package before proceeding.
- [ ] Compare `docs/compliance/subprocessors.md` against `src/lib/compliance/subprocessorRegistry.ts`.
  Every sub-processor in the registry must have a corresponding entry in the document with a
  current DPA/ToS URL.
- [ ] For each sub-processor, verify the DPA/ToS URL is still valid (not 404 or redirected to a
  materially different document).

**Evidence location:** `docs/compliance/subprocessors.md`, `scripts/compliance/verify-subprocessors.ts`

---

### 4. DPA Addenda Refresh

- [ ] For each sub-processor in `docs/compliance/subprocessors.md`, check the "Version / Date
  Accepted" column.
- [ ] If any DPA has been superseded by the provider in the past year, re-accept and update the
  date in the document.
- [ ] Priority sub-processors to check: Supabase (primary processor), Cloudflare, Stripe.
- [ ] For new sub-processors added during the year: ensure a DPA is in place before they process
  personal data.

**Evidence location:** `docs/compliance/subprocessors.md`, `docs/compliance/dpa-supabase.md`

---

### 5. Consent Records vs. User Count

- [ ] Query total user count from Supabase Dashboard → Authentication → Users.
- [ ] Query `user_consents` table: `SELECT purpose, COUNT(*) FROM user_consents GROUP BY purpose`.
- [ ] For each consent purpose in `docs/compliance/consent-inventory.md`, compare consent row count
  against the user count.
  - **Expected:** users who have not interacted with consent toggles will have 0 rows (opt-out is
    the default for all consent purposes). Row count < user count is normal.
  - **Flag:** if `ai_tutor` or `ai_embeddings` consent rows exist for users who should not have
    them (e.g., deleted accounts), investigate.
- [ ] Verify the ROPA (`docs/compliance/ropa.md`) processing purposes are consistent with the
  `user_consents` purpose keys.

**Evidence location:** Supabase Dashboard, `docs/compliance/consent-inventory.md`

---

### 6. Breach Register Review

- [ ] Open [`docs/compliance/breach-register.md`](breach-register.md).
- [ ] For any open breach incidents (where "Outcome / Resolution" is blank or "under investigation"):
  - Determine whether ICO notification is overdue (72-hour window from detection, per Art. 33).
  - Follow `docs/compliance/breach-runbook.md` for resolution steps.
- [ ] Add any near-misses discovered during the year to the Near-miss Log section.
- [ ] Confirm the breach register is stored in an access-controlled location.

**Evidence location:** `docs/compliance/breach-register.md`, `docs/compliance/breach-runbook.md`

---

### 7. Acknowledgement Rate Report

- [ ] Run the ack-rate report for the current notice version:
  ```bash
  SUPABASE_URL=<your-url> SUPABASE_SERVICE_KEY=<service-role-key> \
    npx tsx scripts/compliance/ack-rate-report.ts
  ```
- [ ] Record the output (total users, acked count, ack%) in the [Review Log](#review-log).
- [ ] If ack rate < 95%:
  1. Review the list of unacknowledged user IDs.
  2. Confirm that affected users are seeing `LegalUpdateBanner` on login (check Supabase
     auth logs for recent sign-ins by those users).
  3. If unacknowledged users have not signed in for > 30 days: `SoftBlockGate` is already
     enforced on their next session (E119-S02).
  4. Send a follow-up email to unacknowledged users (see follow-up process below).

**Evidence location:** `scripts/compliance/ack-rate-report.ts`

---

### 8. Notice Version Review

- [ ] Confirm `CURRENT_NOTICE_VERSION` in `src/lib/compliance/noticeVersion.ts` is current.
- [ ] If the notice changed materially during the year:
  1. Bump `CURRENT_NOTICE_VERSION` to `YYYY-MM-DD.1` (where `YYYY-MM-DD` is the effective date).
  2. Commit, deploy.
  3. Confirm `LegalUpdateBanner` fires for existing users on next login.
  4. Run `scripts/compliance/ack-rate-report.ts` weekly for 30 days.

**Evidence location:** `src/lib/compliance/noticeVersion.ts`

---

## Follow-up Process for Unacknowledged Users (Post-30-Day Window)

When a user reaches 30 days without acknowledging the current notice version:

1. **Soft-block is already enforced** — `SoftBlockGate` appears on their next login (E119-S02).
   They cannot use write features until they acknowledge.

2. **Email follow-up** (within 7 days of the 30-day mark):
   - Use the ack-rate report to identify affected users.
   - Send a manual email from the Knowlune support address with subject:
     "Action required: Please review and acknowledge our updated Privacy Notice."
   - Include a direct link to `/legal/privacy` and instructions to log in and click "Acknowledge".

3. **After 60 days without acknowledgement:**
   - Review on a case-by-case basis. Options:
     - Continue soft-block (user can acknowledge at any time).
     - If the account shows no activity for 60+ days, document as inactive and note in breach
       register if GDPR Art. 17 erasure is triggered by inactivity policy.

4. **Record outcomes** in this document's Review Log.

---

## ICO Reporting

- If a data breach requiring ICO notification is identified during this review:
  follow `docs/compliance/breach-runbook.md` immediately — do not wait for the review to complete.
- For the annual accountability submission (if required by ICO for your organisation size):
  use `docs/compliance/ico-sme-checklist-2026.md` as the evidence base.

---

## Review Log

| Review Date | Reviewer | Ack Rate | Sub-processors | Retention Job | Notice Version | Breach Items | Outcome | Notes |
|-------------|----------|----------|----------------|--------------|----------------|--------------|---------|-------|
| _(first review: 2027-Q2)_ | | | | | | | | |

---

## Next Review Date

**2027-Q2** (calendar reminder to be set by Pedro)

---

*This document was created as part of E119-S13 (Annual Review + ICO Checklist + Beta User Re-ack).*
*Reference: [`docs/compliance/README.md`](README.md)*
