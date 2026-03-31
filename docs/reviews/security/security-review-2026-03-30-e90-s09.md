# Security Review — E90-S09: Add OpenRouter as Optional Single-Gateway Provider

**Date:** 2026-03-30
**Branch:** `feature/e90-s09-openrouter-provider`
**Commit:** 66be3178
**Scope:** New provider integration, API key handling, CSP changes, server routes

## STRIDE Analysis

### Spoofing
- **API key handling:** Key passed via `X-API-Key` header per-request, never stored server-side. Follows existing pattern. **No issue.**
- **OpenRouter headers:** `HTTP-Referer` and `X-Title` are static attribution headers, not security controls. **No issue.**

### Tampering
- **Request validation:** Provider enum extended in Zod schema (`server/index.ts:346`). Input validated before reaching provider handler. **No issue.**

### Repudiation
- **Server-side logging:** Errors logged via `console.error` with route prefix. Consistent with existing routes. **No issue.**

### Information Disclosure
- **MEDIUM:** Error text from OpenRouter API forwarded to client (`server/routes/models.ts:122`). Could expose internal API error details. Same pattern as OpenAI/Groq routes (pre-existing).
- **API key regex in client code** (`aiConfiguration.ts:199`): Reveals key format `sk-or-v1-*`. This is public knowledge from OpenRouter docs. **Non-issue.**

### Denial of Service
- **Timeout:** 15-second `AbortSignal.timeout` on both proxy route and client discovery. Prevents hanging requests. **Good.**
- **Model list size:** `.slice(0, 50)` limits response payload. **Good.**

### Elevation of Privilege
- **No new auth surfaces.** Key is user-provided, never server-stored. Proxy routes don't grant additional capabilities beyond what the user's own key allows. **No issue.**

## CSP Changes

- `index.html`: Added `https://openrouter.ai` to `connect-src`. Correctly scoped to exact domain.
- `vite.config.ts`: Same addition for dev server CSP. Consistent.
- **No wildcard additions.** Domain is specific. **PASS.**

## Secrets Scan

- No API keys, tokens, or credentials in committed code.
- Test files use obvious fake keys (`sk-or-v1-testkey1234567890...`). **PASS.**

## Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| BLOCKER  | 0     |             |
| HIGH     | 0     |             |
| MEDIUM   | 1     | Error text forwarded to client (PRE-EXISTING pattern) |
| LOW      | 0     |             |
| INFO     | 0     |             |

## Verdict

**PASS** — No new security issues introduced. The one MEDIUM finding is a pre-existing pattern shared across all provider proxy routes.
