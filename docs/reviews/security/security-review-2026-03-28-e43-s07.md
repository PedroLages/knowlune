# Security Review: E43-S07 — Notifications Triggers & Wiring

**Date:** 2026-03-28
**Reviewer:** Security Review Agent (Opus)
**Stack:** React 19, TypeScript, Vite 6, Dexie.js (IndexedDB), Zustand

## Phases Executed: 5/7

### 1. Secrets Scan
- No hardcoded secrets, API keys, or tokens found
- **Status:** PASS

### 2. Input Validation
- Event payloads are typed via TypeScript union types (`AppEvent`)
- `courseName` and `achievementName` from stores are inserted into notification messages — no sanitization
- These are rendered as text content in React (safe against XSS by default)
- **Status:** PASS

### 3. OWASP Top 10 Assessment
- No direct user input flows into the event bus — all events are emitted from internal store logic
- Dexie queries in `hasReviewDueToday()` use typed Dexie API (not raw SQL)
- No external API calls introduced
- **Status:** PASS

### 4. STRIDE Analysis
- **Spoofing:** Event bus is in-process only, no external access
- **Tampering:** Module-level singleton — only in-app code can emit events
- **Repudiation:** Notifications are persisted to IndexedDB with timestamps
- **Information Disclosure:** No sensitive data in notification payloads
- **Denial of Service:** No rate limiting on event emission — rapid events could create many notifications. LOW risk (local app only)
- **Elevation of Privilege:** N/A — no auth boundaries affected
- **Status:** PASS (1 LOW finding)

### 5. Attack Surface
- New files: `eventBus.ts` (in-memory only), `NotificationService.ts` (reads/writes IndexedDB)
- No new network surface
- No new localStorage keys
- **Status:** PASS

## Findings

### LOW Priority

**1. No rate limiting on notification creation**
- Rapid event emission (e.g., importing 100 courses quickly) could create 100 notifications
- Low risk since this is a local-only app
- Consider adding rate limiting in future if notifications become more prominent

## Verdict

**PASS** — No security concerns. All data flows are internal, typed, and rendered safely by React.
