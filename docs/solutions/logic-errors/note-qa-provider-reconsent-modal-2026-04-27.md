---
title: "Note Q&A: AI Tutor on but stale provider consent (E119-S09)"
date: "2026-04-27"
category: "logic-errors"
module: "AI Q&A from Notes (lesson player + standalone chat)"
problem_type: "logic_error"
component: "assistant"
severity: "medium"
symptoms:
  - "Privacy & Consent shows AI Tutor enabled, but Q&A still fails with a message about the provider or consent"
  - "Consent row exists without evidence.provider_id matching the noteQA-resolved provider (e.g. gemini)"
  - "Granting AI Tutor from Privacy alone does not set provider_id, so isGrantedForProvider stays false"
root_cause: "consent_evidence_mismatch"
resolution_type: "code_fix"
related_components:
  - "documentation"
tags:
  - "note-qa"
  - "consent"
  - "provider-reconsent"
  - "e119-s09"
  - "gemini"
  - "react-hooks"
---

# Note Q&A: AI Tutor on but stale provider consent (E119-S09)

## Problem

Consent is evaluated in two layers in `assertAIFeatureConsent` (`src/ai/llm/factory.ts`): purpose granted (`isGranted`), then **provider-aligned** grant (`isGrantedForProvider`), which requires `evidence.provider_id` on the consent row to match the provider used for the feature (for Q&A, from `resolveFeatureModel('noteQA')`).

**Privacy & Consent** can show **AI Tutor** on because `isGranted` is true, while **`isGrantedForProvider`** is false if the row predates E119-S09 or was granted for another provider. A generic `grantConsent(userId, purpose)` from Privacy does not supply `{ provider_id }`, so it does not fix the mismatch.

## Resolution

1. **In-app re-consent:** `useProviderReconsent` + `ProviderReconsentModal` are wired into **`QAChatPanel`**, **`useChatQA`**, and **`ChatQA`**. On `ProviderReconsentError`, the modal writes `grantConsent(..., { provider_id })` and retries the send.
2. **Fallback copy:** `formatNoteQAError` in `src/lib/noteQAErrors.ts` describes the dialog-first flow and points to **Settings → Privacy & Consent** if the dialog is not visible, aligned with decline-path copy on `AIConsentDeclinedBanner` / `ProviderReconsentModal`.

## Related code

| Area | Path |
|------|------|
| Consent assert + throw | `src/ai/llm/factory.ts` |
| Provider mismatch error | `src/ai/lib/ProviderReconsentError.ts` |
| Re-consent hook | `src/ai/hooks/useProviderReconsent.ts` |
| Modal UI | `src/app/components/compliance/ProviderReconsentModal.tsx` |
| Q&A surfaces | `src/app/components/figma/QAChatPanel.tsx`, `src/ai/hooks/useChatQA.ts`, `src/app/pages/ChatQA.tsx` |
| User-facing error strings | `src/lib/noteQAErrors.ts` |

## Verification

- With an outdated consent row (no or wrong `provider_id`), sending a Q&A message opens **AI Provider Update — New Consent Required**; **Accept & Continue** persists evidence and completes the answer.
- Declining shows the inline declined banner; `formatNoteQAError` for the same error class remains sensible where only inline text is shown.
