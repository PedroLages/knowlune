# Open-Core Strategy

**Author:** Pedro
**Date:** 2026-03-14
**Status:** Draft

## 1. Overview

LevelUp adopts an **open-core model**: a free, open-source core platform with a paid premium tier for AI-powered features and advanced capabilities.

**Goals:**
- Sustainable solo development through subscription revenue
- Community contributions to the open-source core
- Competitive protection via AGPL licensing

**Core value preserved:** Local-first architecture is maintained in both tiers. Premium does not mean "cloud required" — premium features work offline once activated.

## 2. Feature Tier Matrix

### Core (Free, Open Source)

All foundational learning features are free and open source:

| Feature Area | FRs | Epic |
|---|---|---|
| Course import & library management | FR1-FR6, FR89 | Epic 1 |
| Content playback (video/PDF/captions) | FR7-FR13, FR45, FR88 | Epic 2 |
| Smart note system (Markdown, tags, search) | FR20-FR27, FR76-FR77 | Epic 3 |
| Progress tracking & session history | FR14-FR19, FR95 | Epic 4 |
| Study streaks & daily goals | FR28-FR31, FR90-FR91, FR98, FR101 | Epic 5 |
| Learning challenges & gamification | FR32-FR35 | Epic 6 |
| Course momentum & learning intelligence | FR36-FR42, FR79 | Epic 7 |
| Basic analytics (time, completion, velocity) | FR43-FR44, FR46-FR47, FR78, FR93 | Epic 8 |
| Onboarding & first-use experience | FR96 | Epic 10 |
| Data export (JSON, CSV, Markdown) | FR85 | Epic 11 |
| Per-course reminders | FR100 | Epic 11 |
| Quizzes (all quiz features) | Quiz FRs | Epics 12-18 |

### Premium (Paid, Proprietary)

AI-powered and advanced features require a subscription:

| Feature Area | FRs | Epic |
|---|---|---|
| AI video summaries | FR48 | Epic 9 |
| AI Q&A from notes (RAG) | FR49 | Epic 9 |
| AI learning path generation | FR50 | Epic 9 |
| Knowledge gap detection | FR51 | Epic 9 |
| AI note enhancement & linking | FR52, FR97 | Epic 9 |
| Related concepts panel | FR53 | Epic 9 |
| Auto AI analysis on import | FR99 | Epic 9 |
| AI feature usage stats | FR94 | Epic 9 |
| Spaced review system (ts-fsrs) | FR80-FR84 | Epic 11 |
| xAPI activity logging | FR86 | Epic 11 |
| Open Badges export | FR87 | Epic 11 |
| Interleaved review mode | FR92 | Epic 11 |
| Account creation & auth | FR102 | Epic 19 |
| Stripe subscription | FR103 | Epic 19 |
| Entitlement validation | FR104 | Epic 19 |
| Subscription management | FR105 | Epic 19 |
| Upgrade CTA for free users | FR106 | Epic 19 |
| Cloud sync (future) | — | Future |

### Design Principle: Core Must Stand Alone

The free tier must be a complete, useful learning platform on its own. Premium enhances but never gates core workflows. A user who never upgrades should still be able to:
- Import and complete courses
- Track progress and maintain streaks
- Take notes and search them
- View analytics and momentum scores
- Export their data (FR85 stays CORE — user freedom)

## 3. Licensing

### Open-Source Core: AGPL-3.0

**License:** GNU Affero General Public License v3.0

**Why AGPL over GPL:**
AGPL closes the "SaaS loophole." If someone takes the LevelUp core and hosts it as a network service, they must release their modifications. GPL only requires this when distributing binaries.

**Why AGPL over Elastic License / BSL:**
Elastic License 2.0 and Business Source License are not OSI-approved. For a solo dev seeking community contributions, OSI-approved licensing provides credibility and trust.

### Premium Code: Proprietary

Premium features live in `src/premium/` with proprietary license headers. This directory is:
- Excluded from the AGPL license
- Not included in the open-source distribution
- Tree-shaken from the AGPL core build

### Contributor License Agreement (CLA)

External contributors must sign a simple CLA granting the right to relicense their contributions under the commercial license. This enables dual-licensing: AGPL for community, commercial license for enterprise customers who cannot comply with copyleft.

## 4. Pricing Sketch

> **Note:** This pricing is aspirational and will be validated before launch.

| | Free | Premium |
|---|---|---|
| **Price** | $0 | $12/month or $99/year |
| **Core features** | All | All |
| **AI features** | — | Unlimited |
| **Spaced review** | — | Full system |
| **Advanced export** | — | xAPI, Open Badges |
| **Cloud sync** | — | Future |
| **Trial** | — | 14 days free |

**Why this price point:**
- Covers AI API costs per user (~$2-5/month at moderate usage)
- Competitive with learning tools (Anki add-ons, Notion AI, etc.)
- Accessible for individual learners (not enterprise pricing)

## 5. Premium Entitlement Architecture (High-Level)

This section outlines the technical approach. Full implementation details will be designed in Epic 19.

### Payment Flow
1. User clicks "Upgrade to Premium" in Settings
2. Redirected to Stripe Checkout (hosted — no card data touches LevelUp)
3. Stripe webhook triggers entitlement update
4. License key or signed JWT stored locally in IndexedDB

### Entitlement Check
- `isPremium()` guard function wrapping premium feature entry points
- Cached in IndexedDB with expiry timestamp
- Refreshed on app launch if online and cache expired
- **Offline support:** Cached entitlement honored for up to 7 days

### Graceful Degradation
- Premium features show "Upgrade to Premium" CTA with feature preview when not entitled
- No broken UI — premium components lazy-loaded only when entitled
- Feature flags pattern: `src/premium/index.ts` exports gates and lazy components

### Minimal Backend
- Single serverless function (Cloudflare Worker or Vercel Edge Function) for Stripe webhook
- No user database — entitlement derived from Stripe subscription status
- Auth via Supabase Auth or Firebase Auth (managed, zero backend maintenance)

## 6. Community Guidelines

### Contributions Welcome
- Core platform contributions accepted under CLA
- Bug reports, feature requests, and documentation improvements encouraged
- Issue labels: `core`, `premium`, `community`, `good-first-issue`

### Contribution Scope
- **Accepted:** Bug fixes, core feature improvements, accessibility, performance, documentation
- **Not accepted:** Premium feature implementations (proprietary), breaking changes without discussion
- **Discuss first:** New features, architectural changes, dependency additions

### Code of Conduct
Standard Contributor Covenant v2.1.

## 7. Competitive Positioning

| Competitor | LevelUp Advantage |
|---|---|
| **Anki** | LevelUp handles full courses (video + PDF + notes), not just flashcards |
| **Notion / Obsidian** | LevelUp is purpose-built for course completion, not general knowledge management |
| **Udemy / Coursera** | LevelUp works with content you already own locally — no platform lock-in |
| **Habitica / Forest** | LevelUp tracks learning-specific progress, not generic habits |

**Unique positioning:** Local-first + AI-augmented + completion-focused. No other tool combines all three for self-directed learners with local course libraries.
