# Sub-processor Register

**Last updated:** 2026-04-23
**Owner:** Pedro Lages (Controller / Operator)
**Story:** E119-S12
**Review cycle:** On any material change to third-party service usage or annually as part of the
annual compliance review (`docs/compliance/annual-review.md`).

---

## What counts as a sub-processor?

A sub-processor is any third party to whom the controller (Pedro Lages / Knowlune) delegates
personal data processing. This includes SaaS providers that store or process user data on behalf
of Knowlune, but excludes:

- **Self-hosted first-party infrastructure**: Services running on hardware owned and operated by
  the controller, where personal data never leaves the controller's systems.
- **Pure client-side runtimes**: Libraries that execute entirely within the user's browser,
  without transmitting personal data to any external server.

---

## Active Sub-processors

| # | Name | Role | Data Transferred | Data Location | DPA / ToS URL | Version / Date Accepted | Notes |
|---|------|------|-----------------|--------------|--------------|------------------------|-------|
| 1 | **Supabase** (Supabase Ireland Ltd / Supabase, Inc.) | Authentication, cloud database, object storage, real-time sync | Email, password hash, session tokens, all learning data (progress, notes, bookmarks, flashcards, embeddings, exports) | AWS `eu-west-1` (Ireland) | https://supabase.com/privacy#dpa | DPA v3 — accepted 2026-04-23 via Dashboard | Primary data processor; DPA formalised in `docs/compliance/dpa-supabase.md` |
| 2 | **Cloudflare** | CDN, edge routing, DDoS protection for knowlune.pedrolages.net | IP addresses, HTTP request metadata (no body content stored) | Global edge network (EU POPs used) | https://www.cloudflare.com/privacypolicy/ | Cloudflare Pages / Workers — ToS accepted at account creation; DPA at https://www.cloudflare.com/cloudflare-customer-dpa/ — **[operator to verify current version date]** | No personal data is stored by Cloudflare beyond standard CDN logs (30d retention) |
| 3 | **Stripe, Inc.** | Payment processing, subscription management | Billing email, Stripe customer ID, subscription status (card details held exclusively by Stripe; never reach Knowlune servers) | United States (Stripe infrastructure) | https://stripe.com/privacy | Stripe Data Processing Agreement — accepted via Stripe Dashboard; **[operator to verify current version date]** | Stripe is PCI DSS Level 1 certified; no raw card data transmitted to Knowlune |
| 4 | **Anthropic, PBC** | AI language model API (claude-3.x / claude-sonnet) — consent-gated | AI query content (course text, notes, question text) — only when user has granted `ai_tutor` consent | United States | https://www.anthropic.com/privacy | Anthropic API ToS + Data Processing Agreement — **[operator to verify accepted DPA version and date]** | Data is not used for model training per Anthropic commercial API policy; no retention by Anthropic per DPA |
| 5 | **OpenAI, LLC** | AI language model API (gpt-4o / gpt-4o-mini) — consent-gated | AI query content — only when user has granted `ai_tutor` consent and selected OpenAI as provider | United States | https://openai.com/enterprise-privacy | OpenAI API Data Processing Addendum — **[operator to verify accepted DPA version and date]** | Zero data retention option should be confirmed with OpenAI; not retained for training per API ToS |
| 6 | **Google (Google LLC)** | Gemini AI API + optional Google OAuth sign-in — consent-gated for AI | AI query content (Gemini API); Google account identifier, email (OAuth only) | United States / EU | https://policies.google.com/privacy | Google API ToS + Google Cloud DPA — **[operator to verify accepted version and date]** | Gemini API: data not used for training per API ToS; OAuth scopes limited to email + profile |
| 7 | **Groq, Inc.** | AI inference API (Llama / Mistral models) — consent-gated | AI query content — only when user has granted `ai_tutor` consent | United States | https://groq.com/privacy-policy/ | Groq API ToS — **[operator to verify DPA status and date]** | Review whether Groq offers a formal DPA for commercial API usage |
| 8 | **Sentry (Functional Software, Inc.)** | Error tracking and performance monitoring | Anonymised stack traces, browser/OS metadata, error event metadata (no personal data in error payloads by policy) | United States (Sentry Cloud) | https://sentry.io/privacy/ | Sentry DPA — **[operator to verify accepted version and date]** | PII scrubbing configured in Sentry SDK; `beforeSend` hook strips user IDs from error events |
| 9 | **Resend, Inc.** | Transactional email delivery (marketing_email consent-gated) | Email address, first name | United States | https://resend.com/legal/privacy-policy | Resend DPA — **[operator to verify accepted version and date]** | Only activated when user has granted `marketing_email` consent |

---

## First-Party Infrastructure (Not Sub-processors)

The following services process data within the controller's own infrastructure. Personal data
does not leave the operator's systems; no sub-processor relationship exists.

| Service | Role | Hosting | Notes |
|---------|------|---------|-------|
| **Ollama** | Local AI model inference (Llama, Mistral, and other open-weight models) | Unraid server (controller's hardware) | No data transmitted externally; models run entirely on local hardware |
| **Speaches / Whisper** | Voice transcription (voice_transcription consent-gated) | Unraid server (controller's hardware); OpenAI-compatible API on `ai-internal` network | `small.en` model; no external transmission; first-party self-hosted |

---

## Client-Side Runtimes (Not Sub-processors)

The following run entirely within the user's browser without transmitting personal data to any
external server.

| Package | Role | Notes |
|---------|------|-------|
| `@mlc-ai/web-llm` | In-browser AI inference via WebAssembly (WebLLM) | Runs WASM models locally in browser; no external API calls; model weights downloaded from CDN but no user data transmitted |

---

## DPA Maintenance Notes

- DPA URLs marked `[operator to verify current version date]` must be confirmed and dated before
  the annual review (`docs/compliance/annual-review.md`).
- Any new npm dependency or service that transmits personal data must be registered here and in
  `src/lib/compliance/subprocessorRegistry.ts` before being shipped to production.
- The `scripts/compliance/verify-subprocessors.ts` CI script enforces this: it will fail the
  build if a new package matching an external-service pattern is not registered.

---

## Related Documents

- `docs/compliance/dpa-supabase.md` — Full Supabase DPA
- `src/lib/compliance/subprocessorRegistry.ts` — Machine-readable sub-processor registry
- `scripts/compliance/verify-subprocessors.ts` — CI drift-check script
- `docs/compliance/ropa.md` — Record of Processing Activities (sub-processors referenced per activity)
