# E119-S09: AI Provider Change Re-consent — Requirements

## Problem Statement

Knowlune routes AI processing to different providers (OpenAI, Anthropic, Ollama/self-hosted, Speaches). Under GDPR Art. 13/14 and the sub-processor transparency obligation, a user who consented to data being processed by provider A must give fresh consent before their data flows to provider B. Currently, there is no enforcement layer that detects a provider identity change and blocks the request pending re-consent.

`consentService.isGrantedForProvider()` was stubbed in E119-S07 (the function exists and is exported) and `consent-inventory.md` already contains the AI Provider Registry section. E119-S09 wires everything together: the route-selection guard, the re-consent modal, the combined notice+provider flow, and the decline path.

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-1 | AI route selection code calls `consentService.isGrantedForProvider(userId, purpose, providerId)` before sending data; blocked requests surface `ProviderReconsentModal` |
| AC-2 | `ProviderReconsentModal` displays: new provider name, data categories flowing there, link to updated privacy notice. User can Accept (writes new consent row with `evidence.provider_id`) or Decline (feature disabled gracefully) |
| AC-3 | Consent grant captures `provider_id` in the `evidence` JSONB field of `user_consents` |
| AC-4 | Provider version bump (e.g. GPT-4 → GPT-5) does NOT trigger re-consent; only provider identity change does. This rule documented in `consent-inventory.md` (already present) |
| AC-5 | If notice update + provider change happen simultaneously, a single combined reconsent flow is shown (not two modals) |
| AC-6 | Decline path: AI feature shows inline message "AI features require consent for [provider]"; no other features affected |
| AC-7 | E2E test: simulate provider change; verify reconsent modal appears; accept path proceeds; decline path blocks cleanly |

## Out of Scope

- Retention enforcement (E119-S11)
- Operator compliance documents (E119-S12)
- Annual review cycle (E119-S13)

## Technical Context

- `consentService.isGrantedForProvider()` already implemented in `src/lib/compliance/consentService.ts` (E119-S07 stub)
- No AI router file exists yet — create `src/lib/ai/router.ts` as a minimal facade
- Modal uses `src/app/components/ui/dialog.tsx` pattern (shadcn/ui)
- Provider registry already in `docs/compliance/consent-inventory.md`
- `user_consents` table has `evidence JSONB` column (established in earlier E119 stories)
- `consentService.isGrantedForProvider` fails closed: missing provider_id in evidence → re-consent required
- Dexie `userConsents` store holds the local copy; sync engine keeps it current with Supabase

## Open Questions

- Q1: Is there an existing AI call site (e.g. in Settings or a chat page) that should use the router, or is the router purely forward-looking infrastructure? → Assume forward-looking; create the router + guard as a standalone module that future AI features will call.
- Q2: Combined notice+provider flow (AC-5): reuse the existing `ConsentModal` from E119-S08 or create a new combined component? → Extend/compose existing components; avoid duplication.
