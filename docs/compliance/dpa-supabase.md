# Data Processing Agreement — Knowlune / Supabase

**Article 28 GDPR**

**Version:** 1.0
**Effective date:** 2026-04-23
**Controller:** Pedro Lages, operating Knowlune
**Processor:** Supabase, Inc. (and its EU subsidiary Supabase Ireland Ltd)
**Story:** E119-S12

---

> **Purpose of this document.** GDPR Art 28 requires a written contract between a controller and
> any processor acting on its behalf. Supabase publishes its own DPA at
> <https://supabase.com/privacy#dpa> which is accepted by reference in Section 8 below. This
> document supplements that agreement to cover Knowlune-specific processing instructions, security
> commitments, and breach notification obligations.
>
> **Note on controller / processor overlap.** Pedro Lages is both the Data Controller of Knowlune
> user data and the individual who administers the Supabase project. This document formalises the
> separation — the moment infrastructure operations are delegated to a third party or a co-founder
> joins, the contractual framework is already in place.

---

## 1. Parties

**Data Controller (the "Controller"):**

- Name: Pedro Lages
- Operating as: Knowlune
- Address: [Operator address on file]
- Contact: privacy@knowlune.com

**Data Processor (the "Processor"):**

- Name: Supabase, Inc.
- Registered address: 970 Toa Payoh North, #07-04, Singapore 318992
- EU representative: Supabase Ireland Ltd
- DPA contact: privacy@supabase.com
- Supabase DPA URL: https://supabase.com/privacy#dpa

---

## 2. Subject Matter, Duration, and Nature of Processing

**Subject matter:** The Processor provides cloud database, authentication, object storage,
and real-time subscription services that underpin the Knowlune learning platform.

**Duration:** This agreement is in force for the duration of the Controller's use of Supabase
services, and terminates upon cessation of the Supabase subscription or upon written notice by
either party.

**Nature of processing:** Storage, retrieval, replication, and deletion of personal data in
PostgreSQL databases and S3-compatible object storage. Authentication token generation and
validation. Real-time change data capture for sync operations.

**Purpose of processing:** As documented in `docs/compliance/ropa.md` activities 1, 2, 4, 8 —
authentication, learning content storage, billing integration, and GDPR data export.

---

## 3. Types of Personal Data and Categories of Data Subjects

**Categories of data subjects:** Registered users of the Knowlune platform (learners).

**Types of personal data processed by the Processor:**

| Data Type | Table / Bucket | Purpose |
|-----------|---------------|---------|
| Email address, password hash, session tokens | `auth.users`, Supabase Auth | Authentication |
| Learning progress records | `content_progress`, `study_sessions`, `video_progress` | Core service |
| User-authored content (UGC) | `notes`, `bookmarks`, `flashcards`, `book_highlights` | Core service |
| Vector embeddings | `embeddings` | AI features (consent-gated) |
| AI conversation history | `chat_conversations` | AI tutor (consent-gated) |
| Subscription / billing identifiers | `user_entitlements` (Stripe customer ID) | Billing |
| GDPR data export archives | `storage:exports` bucket | Legal obligation |
| Cover images, audio files | `storage:covers`, `storage:audio` buckets | Core service |

---

## 4. Instructions for Processing

4.1 The Controller instructs the Processor to process personal data solely for the purposes
described in Section 2 and no other purpose.

4.2 The Processor shall not process personal data for its own purposes, for marketing, or for
any purpose not expressly authorised by the Controller.

4.3 Processing shall be carried out within the European Economic Area (EEA) or jurisdictions
covered by an EU adequacy decision or appropriate safeguards. Supabase uses AWS `eu-west-1`
(Ireland) as the primary region for Knowlune's project.

4.4 The Processor shall follow the Controller's documented retention schedule
(`docs/compliance/retention.md`) when processing deletion instructions triggered by the
`hardDeleteUser` cascade or the retention-tick job.

---

## 5. Security Measures (Article 32 GDPR)

The Processor has committed to the following technical and organisational security measures via
its published security policy at <https://supabase.com/security>:

| Measure | Detail |
|---------|--------|
| **Encryption at rest** | AES-256 for PostgreSQL data volumes and S3 buckets (AWS standard) |
| **Encryption in transit** | TLS 1.2+ enforced for all API endpoints; HTTPS-only |
| **Access control** | Row-Level Security (RLS) enforced at the database layer; JWT-scoped access; Supabase project keys stored in Vault |
| **Audit logging** | Supabase provides project-level audit logs for auth events; available to the Controller via the Dashboard |
| **Vulnerability management** | Supabase participates in a public bug-bounty program; security patches applied within SLA |
| **Data isolation** | Each Supabase project is isolated at the PostgreSQL schema level; no cross-tenant data access |
| **Backup** | Automated daily backups with point-in-time recovery (PITR) on paid plans |
| **Physical security** | AWS data-centre physical controls (SOC 2 Type II certified) |

The Controller's complementary measures (client-side):

- Supabase `anon` key restricted to minimal RLS-scoped operations
- `service_role` key never exposed client-side; stored in server-side environment variables only
- All API keys rotated on any suspected exposure event
- Supabase Vault used for sensitive sub-processor credentials (Stripe keys, ABS API keys)

---

## 6. Confidentiality

6.1 The Processor shall ensure that all personnel authorised to process the personal data have
committed themselves to confidentiality or are under an appropriate statutory obligation of
confidentiality.

6.2 The Processor shall not disclose the Controller's personal data to any third party without
the Controller's prior written consent, except as required by applicable law.

---

## 7. Sub-processors

7.1 The Controller authorises the Processor to engage the following sub-processors:

| Sub-processor | Role | Location | DPA |
|--------------|------|----------|-----|
| Amazon Web Services (AWS) | Database hosting, object storage (`eu-west-1`) | Ireland (EU) | Covered by AWS DPA; incorporated into Supabase's sub-processor commitments |
| Fly.io (where applicable) | Edge routing for Supabase Realtime | US / EU | Covered by Supabase sub-processor list |

7.2 The Processor shall notify the Controller of any changes to its sub-processor list. The
Controller may object to a new sub-processor within 30 days of notification; if the parties
cannot agree, the Controller may terminate the agreement.

7.3 The Processor remains fully liable to the Controller for the performance of sub-processors.

---

## 8. Acceptance of Supabase Standard DPA

The Controller accepts Supabase's standard Data Processing Addendum, available at
<https://supabase.com/privacy#dpa>, which incorporates:

- EU Standard Contractual Clauses (SCCs — Implementing Decision (EU) 2021/914, Module Two)
  for any transfers outside the EEA
- UK International Data Transfer Addendum (IDTA)
- GDPR Art 28 standard clauses

In the event of any conflict between this document and the Supabase standard DPA, the Supabase
standard DPA shall prevail for matters covered by that document; this document shall prevail for
Knowlune-specific processing instructions.

---

## 9. Breach Notification (Article 33 / 28(3)(f))

9.1 The Processor shall notify the Controller **without undue delay and within 24 hours** of
becoming aware of a personal data breach affecting the Controller's data.

9.2 Notification shall be sent to: **privacy@knowlune.com**

9.3 The notification shall include, to the extent available at the time:
- A description of the nature of the breach (categories and approximate number of data subjects and records)
- The likely consequences of the breach
- Measures taken or proposed to address the breach
- Contact details for the Processor's DPO or privacy contact

9.4 Where complete information is not available at the time of initial notification, the Processor
shall provide available information promptly and supplement it in subsequent communications.

9.5 Upon receiving a breach notification from the Processor, the Controller shall follow the
breach response runbook at `docs/compliance/breach-runbook.md` to assess Art 33 (72h ICO
notification) and Art 34 (user notification) obligations.

---

## 10. Assistance with Data Subject Rights

10.1 The Processor shall assist the Controller in fulfilling its obligations under Chapter III
GDPR (data subject rights) by providing:
- The ability to export all personal data for a given user ID on request
- The ability to delete all personal data for a given user ID on request (cascade delete)
- Access to audit logs relevant to a specific user's data

10.2 The `hardDeleteUser` stored procedure and the GDPR export bundle (`src/lib/compliance/exportBundle.ts`)
implement these technical measures.

---

## 11. Return and Deletion of Data on Termination

11.1 Upon termination of the Supabase subscription or written request by the Controller, the
Processor shall either:
- Return all personal data to the Controller in a machine-readable format within 30 days, or
- Securely delete all personal data within 30 days and provide written confirmation

11.2 The Controller shall use the Supabase backup export facility to retrieve a full database
dump before initiating termination.

11.3 Copies retained in backups shall be deleted in accordance with Supabase's backup retention
policy (typically 7–30 days post-termination depending on plan).

---

## 12. Audit and Inspection

12.1 The Processor shall make available to the Controller all information necessary to demonstrate
compliance with this agreement, and shall allow for and contribute to audits and inspections
conducted by the Controller or an auditor mandated by the Controller.

12.2 Supabase's SOC 2 Type II reports and security certifications are accepted as satisfying
the Processor's obligation to demonstrate compliance with Art 32 measures without requiring
a separate on-site audit.

---

## 13. Governing Law

This agreement is governed by the laws of the European Union and applicable national data
protection laws of the Controller's member state.

---

## 14. Signatures

**Data Controller:**

Signed: Pedro Lages
Date: 2026-04-23
Role: Controller / Operator, Knowlune
Email: privacy@knowlune.com

**Data Processor:**

Supabase DPA accepted electronically via Supabase Dashboard on: 2026-04-23
Reference: Supabase standard DPA v3 (see <https://supabase.com/privacy#dpa>)

---

*[SIGNED: 2026-04-23 — Pedro Lages]*
