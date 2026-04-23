> **DRAFT — pending legal review before publication**

# Privacy Notice

**Version:** 2026-04-23.1
**Effective date:** 2026-04-23
**Controller:** Knowlune / Pedro Lages

---

## 1. Controller Identity & Contact

**Data controller:** Pedro Lages, operating Knowlune
**Contact:** privacy@knowlune.com

For all privacy-related inquiries, requests to exercise data subject rights, or complaints, contact the controller at the email address above.

---

## 2. Purposes of Processing & Lawful Basis

| Purpose | Categories of data | Lawful basis (GDPR Art 6) |
|---|---|---|
| Provide and maintain the learning platform | Account info, learning progress, study session data | Art 6(1)(b) — performance of a contract |
| Track progress, streaks, and achievements | Learning events, quiz results, completion rates | Art 6(1)(b) — performance of a contract |
| Process subscription payments | Name, email, payment reference (not card details) | Art 6(1)(b) — performance of a contract |
| Send study reminders and course update notifications (optional) | Email address | Art 6(1)(a) — consent (withdrawable at any time in Settings) |
| Improve the platform via aggregated analytics | Anonymised usage patterns | Art 6(1)(f) — legitimate interests (platform improvement; no individual profiling) |
| Provide customer support | Email, account info, correspondence | Art 6(1)(b) — performance of a contract |
| AI-assisted features (learning paths, knowledge gaps) | Query text, learning context | Art 6(1)(b) — performance of a contract; processing is on-device or via self-hosted proxy with no third-party AI storage |

---

## 3. Categories of Personal Data

- **Identity data:** name, email address, profile photo
- **Authentication credentials:** managed securely via Supabase (hashed; never stored in plaintext)
- **Payment reference data:** subscription status, Stripe customer ID (card details are held exclusively by Stripe)
- **Learning data:** course progress, quiz results, study session duration, completion rates, notes, bookmarks, flashcards
- **Device & usage data:** browser type, device type, usage patterns (for platform improvement only)
- **AI query context:** text submitted to AI-assisted features (processed on-device via WebLLM or via self-hosted Ollama proxy; not forwarded to external AI providers)

---

## 4. Sub-Processors

| Sub-processor | Purpose | Data location |
|---|---|---|
| **Supabase** (hosted on AWS) | Authentication, cloud data storage, real-time sync | AWS eu-west-1 (Ireland) |
| **Stripe** | Payment processing for premium subscriptions | United States (Stripe Inc.) |
| **Google OAuth** | Optional sign-in via Google account | Google servers (EU/US) |

We do not sell personal data to any third party. Sub-processors are bound by data processing agreements.

---

## 5. Data Storage & Processing

Knowlune uses a hybrid storage model:

- **Local storage (IndexedDB):** Study progress, notes, bookmarks, and preferences are stored locally in your browser. This data stays on your device and is not transmitted unless you enable sync.
- **Cloud storage (Supabase/AWS):** Account data, subscription information, and sync data are stored securely on Supabase, hosted in AWS eu-west-1.
- **AI processing:** AI-assisted features use on-device models (WebLLM) or a self-hosted Ollama proxy server. No AI conversation data or query content is sent to external AI providers or stored on third-party servers.

---

## 6. Retention Summary

| Data category | Retention period |
|---|---|
| Account & profile data | Retained while account is active; deleted within 30 days of account deletion request |
| Learning progress & analytics | Retained while account is active; deleted within 30 days of account deletion request |
| Payment references | Retained as required by applicable financial regulations (typically 7 years) |
| Local IndexedDB data | Retained on your device until you clear browser storage or delete your account |
| Anonymised usage analytics | Retained indefinitely in aggregated form (no individual re-identification possible) |

---

## 7. Your Rights

Under the GDPR (and applicable national law), you have the following rights:

- **Right of access (Art 15):** Request a copy of the personal data we hold about you.
- **Right to rectification (Art 16):** Correct inaccurate or incomplete personal data.
- **Right to erasure / right to be forgotten (Art 17):** Request deletion of your personal data where no legal obligation to retain exists.
- **Right to restriction (Art 18):** Request that we limit processing of your data in certain circumstances.
- **Right to data portability (Art 20):** Receive your learning data in a structured, machine-readable format.
- **Right to object (Art 21):** Object to processing based on legitimate interests (see Section 2).
- **Right to withdraw consent (Art 7(3)):** Withdraw consent for optional processing (e.g., notifications) at any time via Settings → Notifications.

**How to exercise your rights:** Contact privacy@knowlune.com. We will respond within 30 days. Identity verification may be required.

---

## 8. Complaint Path to Supervisory Authority

If you believe your data protection rights have been violated, you have the right to lodge a complaint with your local data protection supervisory authority.

In Portugal (controller's country): **Comissão Nacional de Proteção de Dados (CNPD)** — https://www.cnpd.pt

You may also lodge a complaint with the supervisory authority of your EU member state of habitual residence.

---

## 9. Security

We implement industry-standard security measures:
- Encryption in transit (TLS 1.2+/HTTPS for all data transmission)
- Secure authentication via Supabase (hashed credentials, JWTs)
- PCI-compliant payment processing via Stripe (we never store card details)
- Access controls limiting data access to necessary personnel

No method of internet transmission is 100% secure. We cannot guarantee absolute security.

---

## 10. Children's Privacy

Knowlune is not directed to children under the age of 13 (or 16 where applicable under national law). We do not knowingly collect personal data from children. If you believe we have collected data from a child, contact privacy@knowlune.com and we will promptly delete it.

---

## 11. Changes to This Notice

When we make material changes to this Privacy Notice, we will update the version number and effective date at the top of this document, and display a banner notification on the Privacy Policy page. We encourage you to review this notice periodically.

---

## 12. AI Processing Disclosure

Knowlune offers optional AI-assisted features (learning path suggestions, knowledge gap analysis):

- **On-device AI (WebLLM):** Runs entirely in your browser. No data leaves your device.
- **Self-hosted Ollama proxy:** Queries may be routed to a self-hosted Ollama server operated by the controller. No AI conversation data is stored on that server beyond the active session.
- **No external AI providers:** We do not send your learning data or AI queries to OpenAI, Anthropic, Google, or any other third-party AI provider.

AI features are opt-in. You can disable them in Settings → AI Features.
