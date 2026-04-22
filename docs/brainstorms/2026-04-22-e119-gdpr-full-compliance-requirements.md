# E119 — GDPR Full Compliance (Umbrella Epic) — Requirements

**Date:** 2026-04-22
**Status:** Draft for `/ce:plan` decomposition
**Scope classification:** Deep / umbrella epic
**Author:** CE brainstorm (autopilot)

---

## 1. Problem & Context

Knowlune went live in beta on 2026-04-18 at `knowlune.pedrolages.net`, serving EU-resident users (Pedro as the initial user, with invite-based expansion planned). Personal data is stored in a self-hosted Supabase instance on an Unraid server in the EU, plus mirrored in Dexie IndexedDB on each user's browser via the Epic 92-95 sync engine (26 tables + 4 Storage buckets).

Because Knowlune:

- Is publicly addressable on the open internet,
- Processes personal data (email, auth identifiers, learning history, notes, highlights, voice clips, AI chat transcripts, learner models/profiles),
- Targets EU residents, and
- Is operated by an EU-based controller (Pedro Lages),

it falls squarely under the GDPR. A partial right-to-erasure capability shipped on 2026-04-22 (`src/lib/account/deleteAccount.ts` + `supabase/functions/delete-account/index.ts`), but the rest of the compliance surface is either absent or implicit.

This epic is the **umbrella of work** to bring Knowlune to defensible, end-to-end GDPR compliance — so that if a user files a DSAR, an EU DPA inquires, or a breach occurs, we have:

1. The **user-facing capabilities** (notice, access, export, erasure, consent) that the regulation requires,
2. The **operational artifacts** (ROPA, DPA, breach plan, retention policy) that a controller must maintain,
3. The **technical enforcement** (retention TTLs, consent gates, audit trails, access logs) that make those capabilities real rather than paper.

**Why umbrella, not individual stories?** Each article interacts with the others: a privacy notice (Art 13) must accurately describe what export (Art 15) returns, what retention (Art 5(1)(e)) enforces, and which consents (Art 7) are captured. Planning them jointly prevents divergence.

## 2. Goals & Non-Goals

### 2.1 Goals

- **G1 — Legal defensibility.** Knowlune can answer DSARs, erasure requests, and regulator inquiries with documented processes and working tooling, within the GDPR's statutory deadlines (typically 1 month).
- **G2 — User-facing transparency.** Every user can, from inside the app, find the privacy notice, see what we hold about them, export it in a portable format, withdraw consent, and delete their account.
- **G3 — Operational hygiene.** Pedro (as controller) maintains the artifacts a DPA expects to see on request: ROPA, DPA with the processor (self-hosted Supabase operator — Pedro wearing his infra-operator hat), retention policy, breach register, consent records.
- **G4 — Technical enforcement.** Retention, consent, and erasure are enforced by code (cron/TTL jobs, consent-gated features, cascade deletes, audit logs) — not just policy prose.
- **G5 — Sustainable carrying cost.** The resulting system is maintainable by a solo operator. No SaaS DSAR platforms, no enterprise GRC tooling. Markdown + scripts + minimal UI.

### 2.2 Non-Goals (explicit)

- **N1 — DPO appointment.** Knowlune does not meet GDPR Art 37 thresholds (no large-scale systematic monitoring, no special categories at scale). No DPO will be appointed; Pedro is controller-contact.
- **N2 — ePrivacy / cookie banner theatre.** Knowlune uses only strictly necessary first-party storage (auth session, sync state, local DB). No third-party ad/analytics cookies. A GDPR-style cookie banner is **not** in scope; a clear storage disclosure in the privacy notice is.
- **N3 — DPIA (Art 35).** Not required at current scale/risk profile (no systematic monitoring of public spaces, no special-category processing at scale, no automated decisions with legal effects). Re-evaluate if tutor/learner-model features cross into profiling with significant effects.
- **N4 — International data transfers / SCCs.** All data stays in the EU (EU-resident Supabase on Unraid, Cloudflare edge for static assets only). No Art 44-49 transfer mechanics in scope. If Cloudflare Pages/Workers process personal data in non-EU edge nodes in the future, re-scope.
- **N5 — Multi-tenant admin UX.** There is no admin console for reviewing DSARs as a queue. Pedro handles requests individually by email / direct contact.
- **N6 — Age gating / parental consent (Art 8).** Knowlune is not targeted at under-16s; account creation will state a 16+ self-attestation in the privacy notice. No formal age verification.
- **N7 — Automated Decision-Making disclosures (Art 22).** The AI tutor/learner-model does not produce decisions with legal or similarly significant effects on the user. Disclose the use of AI processing in the notice, but no Art 22 opt-out UI.

### 2.3 Explicit Article Coverage

| GDPR Article | In Scope? | Notes |
|---|---|---|
| **Art 5** (principles) | Yes | Materialised through retention policy, data minimisation review |
| **Art 6** (lawful basis) | Yes | Document lawful bases per processing purpose in ROPA |
| **Art 7** (consent) | Yes | Consent records for any processing relying on consent (AI features, optional telemetry) |
| **Art 8** (children) | No (N6) | Self-attestation only |
| **Art 12** (transparent info) | Yes | Plain-language privacy notice |
| **Art 13/14** (notice) | Yes | First-party data collection (13); no third-party enrichment (14 n/a) |
| **Art 15** (right of access) | Yes | Self-service data export = DSAR response |
| **Art 16** (rectification) | Yes | Implicitly covered — users can edit their own data inside the app; notice points this out |
| **Art 17** (erasure) | Yes | Complete the partial delete-account flow, add per-item deletion for sync-engine data |
| **Art 18** (restriction) | Yes (light) | Account disable = restriction; documented in notice |
| **Art 20** (portability) | Yes | Export must be structured, machine-readable (JSON + media as files) |
| **Art 21** (objection) | Yes (light) | Covered by consent withdrawal + deletion; documented in notice |
| **Art 22** (ADM) | No (N7) | Disclose AI processing; no legal-effect decisions |
| **Art 25** (PbD/PbD) | Yes | Retrofit where needed; design principle going forward |
| **Art 28** (processors) | Yes | DPA between Pedro-controller and self-hosted Supabase operator; list sub-processors (Cloudflare, Stripe, AI providers) |
| **Art 30** (ROPA) | Yes | Maintained as markdown in `docs/compliance/ropa.md` |
| **Art 32** (security) | Yes (light) | Reference existing security posture; don't re-implement |
| **Art 33/34** (breach) | Yes | Breach detection + 72h notification runbook |
| **Art 35** (DPIA) | No (N3) | Re-evaluate annually |
| **Art 44-49** (transfers) | No (N4) | All EU |

## 3. Users & Primary Scenarios

The consumer surface is a single persona — the Knowlune learner — but the compliance surface has three:

### 3.1 The Learner (data subject)

- **S1.** "I want to know what Knowlune does with my data before I sign up." → Privacy notice linked from signup, settings, and footer.
- **S2.** "I want to see everything you have about me." → Settings → Privacy → *Export my data* produces a ZIP with JSON + media within seconds for current user size; asynchronously via email for large exports if needed.
- **S3.** "I want to leave and take my data with me." → Export (Art 20) → confirm → delete (Art 17), all from settings.
- **S4.** "I want to delete one course / one note / one highlight and have it gone from server + device." → Works today implicitly via sync-engine tombstones; documented in notice, verified by tests.
- **S5.** "I withdraw consent for AI features." → Toggles off; pending AI requests cancelled; AI-derived artefacts (embeddings, learner model) either deleted or frozen per policy.
- **S6.** "I think my data leaked." → Clear contact path in notice; response SLA stated.

### 3.2 Pedro (controller / operator)

- **S7.** "A user emailed a DSAR." → Runbook: authenticate request, trigger export-on-behalf or ask user to self-export, deliver inside 1 month.
- **S8.** "An EU DPA wrote to me." → Hand them ROPA, DPA, retention policy, breach register.
- **S9.** "I suspect a breach." → Runbook: contain, assess, log in breach register, notify DPA within 72h if risk threshold met, notify users if high-risk.
- **S10.** "Annual compliance review." → Re-read ROPA, check retention jobs ran, verify consent records, refresh DPA addenda for sub-processor changes.

### 3.3 An EU Data Protection Authority (worst case)

- Receives a complaint; asks Pedro for his records. The artifacts in `docs/compliance/` must be sufficient without invention.

## 4. Functional Requirements

Grouped into six **workstreams** that `/ce:plan` can map to stories (likely 2-4 stories per workstream).

### 4.1 Workstream A — Transparency (Arts 12, 13)

- **A1.** Plain-language privacy notice published at a stable URL (`/legal/privacy`), versioned (date + semver), rendered inside the app and linkable externally.
- **A2.** Privacy notice contents covered: identity + contact of controller, purposes + lawful basis per purpose, categories of data, recipients (sub-processors named), retention periods per category, data-subject rights + how to exercise, complaint path to supervisory authority, existence of AI processing (Art 22 informational even though no legal-effect decisions).
- **A3.** Sub-processor list maintained and linked from notice: self-hosted Supabase (the instance Pedro operates), Cloudflare (CDN/edge), Stripe (billing), AI providers in use (OpenAI, Anthropic, Ollama-on-Unraid, Whisper-on-Unraid — Ollama/Whisper are first-party infra, not sub-processors).
- **A4.** Signup flow links the notice; users must acknowledge before account creation. Acknowledgement timestamp stored.
- **A5.** Material changes to the notice trigger in-app notification + re-acknowledgement for existing users.
- **A6.** Terms of Service document separately (references privacy notice). Minimal, solo-operator appropriate.

### 4.2 Workstream B — Access & Portability (Arts 15, 20)

- **B1.** Self-service *Export my data* action in Settings → Privacy.
- **B2.** Export is a ZIP containing: `data.json` (all user rows across all 26 sync tables, keyed by table), `media/` (all 4 Storage buckets' user-owned objects), `README.md` (index of what's inside, schema version, export timestamp, scope).
- **B3.** Export format is structured and machine-readable (JSON + original media formats). No PDFs.
- **B4.** Export is authenticated to the requesting user; includes only that user's rows (enforce via RLS + explicit user-id filter).
- **B5.** Export completes inline for typical user sizes (< 1GB). For large exports, generate async and email a signed, time-limited download link (7-day TTL).
- **B6.** Export includes data currently in both local Dexie and Supabase; dedupe by server-truth where sync-engine LWW applies.
- **B7.** Export is available even after account deletion is initiated — i.e., users can export *before* confirming final deletion (not *after*).
- **B8.** Exports themselves are NOT retained server-side beyond delivery TTL (no archive of exports).

### 4.3 Workstream C — Erasure (Art 17)

Builds on the partial delete-account flow shipped 2026-04-22 (`src/lib/account/deleteAccount.ts`, `supabase/functions/delete-account/index.ts`).

- **C1.** Complete the account-deletion flow: confirm all 26 tables + 4 buckets are scrubbed server-side; Dexie is wiped client-side; auth user row is deleted; Stripe customer is anonymised (not deleted — billing records retained per tax law, but PII minimised).
- **C2.** Document lawful-basis exceptions where full deletion is NOT performed: invoices (tax law, typically 6-10 years depending on jurisdiction), auth audit logs (short TTL then deleted), breach records referencing the user (kept in breach register, pseudonymised).
- **C3.** Deletion is verifiable — a post-delete probe (query by user-id across all tables) returns zero rows. Added as an automated test.
- **C4.** Per-item deletion (delete one note, one course, one highlight) propagates through sync engine correctly with tombstones; covered by existing Epic 92-95 tests but explicitly verified against GDPR erasure semantics.
- **C5.** Soft-delete / trash features (if any) have a documented hard-delete TTL so they don't become a silent retention backdoor.
- **C6.** Deletion confirmation email sent to the user's address on file (before the email is removed) so the user has a receipt.
- **C7.** Grace period: offer a 7-day "cancel deletion" window before the cascade runs, to reduce accidents. Clearly stated in UX + notice. (Autopilot decision: 7 days balances user safety vs. honouring GDPR promptness expectation — well within the 1-month window.)

### 4.4 Workstream D — Consent Management (Art 7)

- **D1.** Inventory processing activities by lawful basis. Most of Knowlune operates on "performance of a contract" (the learning service itself) — consent is not required. Consent is required for: optional AI processing beyond core flows, optional telemetry/analytics if added later, any marketing email beyond transactional.
- **D2.** Consent UI: per-purpose toggles in Settings → Privacy, with plain-language purpose + data categories per toggle.
- **D3.** Consent records: each grant/withdrawal is logged with `purpose`, `granted_at`, `withdrawn_at`, `notice_version_acknowledged`, `evidence` (how the consent was given — checkbox, toggle, signup).
- **D4.** Withdrawing consent is as easy as granting. Takes effect on next request + cancels pending work dependent on it + deletes-or-freezes derived data per documented policy.
- **D5.** No dark patterns: no pre-ticked boxes, no coupling of unrelated consents, no "consent or leave" for non-essential processing.
- **D6.** If AI providers change, users are re-prompted for consent before routing to the new provider (notice update + re-ack).

### 4.5 Workstream E — Retention & TTL (Art 5(1)(e))

- **E1.** Produce a retention policy matrix covering all 26 sync tables + 4 Storage buckets + auth tables + Stripe-side records + logs. Columns: table/bucket, data categories, lawful basis, retention period, deletion mechanism, owner.
- **E2.** Define TTLs per category. Initial defaults (refinable in plan phase):
  - User-generated content (notes, highlights, bookmarks, flashcards, courses): retained for account lifetime + 30 days after deletion (matches grace period + buffer).
  - AI chat transcripts: 365 days rolling unless user pins.
  - Embeddings / learner model derivatives: regenerated on demand; purge with source or on consent withdrawal.
  - Auth/session logs: 90 days.
  - Sync engine `syncQueue` dead-letter: 30 days then purged.
  - Breach register entries: 5 years (pseudonymised references to affected users).
  - Invoices: 10 years (tax law ceiling, jurisdiction-dependent; document actual number in plan phase).
  - Exports delivered to users: 7-day signed URL TTL; no server-side archive beyond that.
- **E3.** Enforcement: scheduled job (pg_cron on Supabase or Edge Function cron) that applies TTLs table-by-table. Job is idempotent, logged, and alerting on failure.
- **E4.** Soft-deleted / tombstoned rows have their own hard-delete TTL so tombstones don't accumulate indefinitely.
- **E5.** Retention policy is linked from privacy notice (summary there, full matrix in `docs/compliance/retention.md`).

### 4.6 Workstream F — Operator Artifacts (Arts 28, 30, 32, 33, 34)

- **F1. ROPA (Art 30)** in `docs/compliance/ropa.md`: for each processing activity — purpose, lawful basis, data categories, data subjects, recipients/sub-processors, retention, security measures, transfer mechanism (n/a-EU). Maintained as markdown; reviewed annually.
- **F2. DPA (Art 28)** in `docs/compliance/dpa-supabase.md`: controller-processor contract between Pedro-the-controller and Pedro-the-infra-operator (the person operating the Unraid Supabase instance). Covers instructions, confidentiality, security measures, sub-processor list, breach notification timing, return/deletion on termination, audit rights. Feels absurd as a self-contract but is the compliant artefact if Pedro-operator is ever separated from Pedro-controller (e.g., if infra is outsourced). Use a recognised DPA template (EDPB or Supabase's template as a base).
- **F3. Sub-processor addenda** for Cloudflare, Stripe, OpenAI, Anthropic: either accept their published DPAs or document why not-needed. Linked from main DPA.
- **F4. Breach runbook (Art 33/34)** in `docs/compliance/breach-runbook.md`: detection signals, triage steps, severity classification, 72h DPA notification template, user notification template for high-risk breaches, internal register format. Tabletop-rehearsed once before epic close.
- **F5. Breach register** at `docs/compliance/breach-register.md` — empty template with schema. Entries are pseudonymised; linked detailed case files can live in private storage if ever needed.
- **F6. Annual review checklist** in `docs/compliance/annual-review.md`: one-page list of what to re-read, re-verify, and refresh each year.

## 5. Non-Functional Requirements

- **NFR1 — Statutory deadlines.** DSAR and erasure responses ≤ 1 month (extendable +2 months per Art 12(3) with justification). Breach notification ≤ 72h.
- **NFR2 — Latency.** Self-service export for typical user (< 500MB) completes in ≤ 30s inline; larger exports delivered via signed link within 24h.
- **NFR3 — Correctness over cleverness.** Prefer boring, auditable implementations (SQL + markdown) over clever ones (sync-engine hooks, agent-driven DSAR bots).
- **NFR4 — Internationalisation.** Privacy notice + UX strings in English only at launch. Add locale support later only when the user base demands it (YAGNI).
- **NFR5 — Accessibility.** All Privacy UI meets the existing WCAG 2.1 AA+ bar from `styling.md`.
- **NFR6 — Observability.** Every DSAR/export/delete operation emits a structured log entry (pseudonymised user id, operation, timestamp, outcome). Retention on logs matches E2.
- **NFR7 — Defence in depth on RLS.** All queries in export/delete paths are RLS-enforced AND explicitly filtered by user id, so a single-layer failure doesn't leak data.

## 6. Success Criteria

- **SC1.** A user can, from signup to final deletion, complete the full lifecycle (read notice → accept → use → export → withdraw consent → delete → receive confirmation) without emailing Pedro. Demonstrated by an end-to-end test.
- **SC2.** Pedro can, given any user email + a simulated DSAR, produce a compliant response (export ZIP + narrative letter) within 1 hour. Demonstrated in a tabletop.
- **SC3.** `docs/compliance/` contains: `privacy-notice.md` (source of truth), `ropa.md`, `dpa-supabase.md`, `retention.md`, `breach-runbook.md`, `breach-register.md`, `annual-review.md`, `consent-inventory.md`. All dated and cross-linked.
- **SC4.** Retention TTL job runs successfully on a schedule in production, logs results, and an alerting hook fires on failure.
- **SC5.** Automated tests cover: export completeness (every sync table + bucket represented), deletion verifiability (post-delete probe returns zero rows), consent withdrawal effects (derived data purged/frozen per policy), cascade tombstones honoured.
- **SC6.** External review: run the notice + ROPA past one GDPR checklist (e.g., ICO SME checklist or CNIL equivalent) and resolve any blocking gaps before closing the epic.
- **SC7.** Beta users are notified of the new privacy notice + settings via in-app banner, and asked to re-acknowledge. ≥ 95% acknowledgement within 30 days.

## 7. Open Questions for `/ce:plan`

These are planning-level decisions deliberately left for `/ce:plan` to resolve:

1. **Story split.** Is this ~12-16 stories? Likely one story per workstream deliverable (A1+A2 notice prose, A3 sub-processor list, A4-A5 signup+notification flow, B1-B6 export flow, B5+B7 async + grace, C1-C3 delete completion + verification, C6-C7 email + grace period, D1-D2 consent inventory + UI, D3-D4 consent records + withdrawal, E1-E2 retention policy doc, E3-E4 TTL job, F1 ROPA, F2+F3 DPAs, F4+F5 breach runbook + register, F6 annual review).
2. **Implementation order.** Suggested: Transparency (A) + Erasure-completion (C) first — these are user-facing and unblock beta-user trust. Then Export (B) + Consent (D). Retention (E) + Operator artifacts (F) close the loop. But `/ce:plan` should validate.
3. **Export backend.** Edge Function streaming ZIP vs. async job + signed URL — choose based on typical user size at beta scale (likely inline Edge Function is fine today).
4. **Cron mechanism.** pg_cron inside Supabase Postgres vs. external Edge Function on a Cloudflare cron trigger vs. a tiny Unraid cron job hitting an admin endpoint. Pick one in plan phase.
5. **Notice versioning scheme.** Semver on the notice itself, linked to a `notice_acknowledgements` table.
6. **Which GDPR checklist to use for SC6.** ICO SME checklist is the most pragmatic; CNIL is more formal. Pedro to pick.
7. **Jurisdictional specifics.** Which EU member-state's invoice-retention number applies (depends on Pedro's tax residency) — needed to finalise E2 invoice row.
8. **Stripe handling on delete.** Full customer deletion vs. anonymisation — confirm Stripe's API capabilities and tax-law requirements.
9. **Consent withdrawal semantics for embeddings.** Delete-and-regenerate-on-demand vs. freeze-and-mark — choose based on cost of regen.
10. **Whether to include a `/legal` route set in the bundled app** or host on a separate subdomain. Current bundled deployment argues for in-app routes.

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Export misses a sync table added after the epic | Med | High (legal) | Export is registry-driven: iterates the sync-engine table registry, not a hardcoded list. New tables auto-included; test guards against drift. |
| Delete leaves orphans in an unforeseen table | Med | High | Same registry-driven approach for delete; post-delete probe test. |
| Retention job fails silently | Med | Med | Structured logs + alerting on non-zero exit / missed run. |
| Privacy notice drifts from code reality | High over time | Med | Annual review checklist; ROPA + retention matrix generated or validated from code where feasible. |
| DPA self-contract feels silly, gets skipped | High | Low-Med | Do it anyway. It's cheap and makes the separation real the day infra ops is delegated. |
| Beta users ignore re-acknowledgement prompt | Med | Low | Non-blocking banner for 30 days, then soft-block (read-only until acked) — design in plan phase. |
| Consent toggle causes data loss surprise | Low | High (UX + legal) | Confirmation dialog states exactly what gets deleted/frozen before commit. |
| AI provider switch skipped re-consent | Med | Med | Provider identity is part of consent record; automated check on route change. |

## 9. Dependencies & Prerequisites

- Epic 92-95 sync engine (shipped). Table registry is the backbone of export/delete iteration.
- Beta deployment is live (shipped 2026-04-18).
- `deleteAccount.ts` + `delete-account` Edge Function (shipped 2026-04-22) — extend, don't re-do.
- Supabase RLS policies already in place per sync-engine work — verify coverage, don't re-architect.
- Existing Settings UI shell — Privacy section slots into it.

## 10. References

- Beta launch plan: `docs/plans/2026-04-18-011-feat-knowlune-online-beta-launch-plan.md`
- Existing erasure code: `src/lib/account/deleteAccount.ts`, `supabase/functions/delete-account/index.ts`
- Sync engine public API (drives registry-driven export/delete): see sprint/epic artifacts for E92-95
- GDPR full text: Regulation (EU) 2016/679
- ICO SME checklist (suggested SC6 artifact): https://ico.org.uk/for-organisations/sme-web-hub/checklists/
- EDPB DPA template references (for F2)

---

**Handoff:** Pass this document to `/ce:plan` to decompose into E119 stories. Planning should resolve the Section 7 open questions and produce a story-by-story implementation plan.
