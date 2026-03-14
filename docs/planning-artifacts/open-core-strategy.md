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

## 3. Core Guarantee

This is a public commitment to the community:

1. **No feature downgrades.** Features currently in the core tier will never be moved to premium. Once free, always free.
2. **Data export is permanently core.** FR85 (JSON, CSV, Markdown export) will never be gated behind premium. Users own their data unconditionally.
3. **Community PRs evaluated fairly.** Pull requests that implement functionality overlapping with premium features will be evaluated on merit, not rejected to protect revenue. If a community contribution improves the core experience, it is welcome — even if it partially overlaps with a premium feature's scope.
4. **Core works standalone.** The AGPL-licensed core must build, run, and pass all tests without `src/premium/` present. Premium is an addition, never a dependency.
5. **Transparent tier decisions.** Any future tier changes will be discussed publicly in a GitHub issue before implementation. The community gets a voice.

**Why this matters:** The #1 failure mode of open-core projects is "crippling the core" — gradually moving useful features behind the paywall until the free version is unusable. This guarantee prevents that erosion and maintains community trust.

## 4. Licensing

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

### Developer Certificate of Origin (DCO)

External contributors must sign off their commits using the DCO (`Signed-off-by` line in commit messages). This certifies that the contributor has the right to submit the code under AGPL-3.0.

**Why DCO over CLA:**
- **Lower friction:** A CLA requires a formal legal agreement before the first contribution — the #1 cited barrier to open-source participation. DCO is just a `git commit -s` flag.
- **Sufficient for our model:** Since premium code lives in a separate `src/premium/` directory (not derived from community contributions), we don't need relicensing rights over community code. Community contributions go into AGPL core only.
- **Community trust:** CLAs are often interpreted as a signal that the project owner will eventually relicense everything proprietary. DCO avoids this perception.
- **Proven at scale:** Linux kernel, GitLab, and many AGPL projects use DCO successfully.

**How it works:**
1. Contributor adds `Signed-off-by: Name <email>` to commit messages (`git commit -s`)
2. This certifies compliance with the [Developer Certificate of Origin v1.1](https://developercertificate.org/)
3. A GitHub Action (e.g., `probot/dco`) automatically checks all PR commits

**Migration trigger:** If LevelUp ever needs to relicense community contributions (e.g., offering an enterprise non-AGPL license that includes core), a CLA would be required. This is not currently planned.

## 5. Pricing Sketch

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

## 6. Premium Entitlement Architecture (High-Level)

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

## 7. Community Guidelines

### Contributions Welcome
- Core platform contributions accepted under DCO
- Bug reports, feature requests, and documentation improvements encouraged
- Issue labels: `core`, `premium`, `community`, `good-first-issue`

### Contribution Scope

**Accepted:**
- Bug fixes to core features
- Core feature improvements (accessibility, performance, UX)
- Documentation improvements
- New core features that don't overlap with premium (discuss first)
- Test coverage improvements

**Discuss first (open a GitHub issue):**
- New features — to confirm tier placement and alignment with roadmap
- Architectural changes — to ensure compatibility with premium boundary
- Dependency additions — to keep the core lean
- Features that partially overlap with premium scope (see below)

**Premium overlap policy:**
When a community PR implements functionality that partially overlaps with a premium feature:
1. The PR is evaluated on its **merit to the core experience**, not its impact on premium revenue
2. If it improves the core learning workflow, it is welcome
3. If it fully replicates a premium feature, the maintainer will discuss scope with the contributor — the goal is finding a solution that improves core without eliminating the premium value proposition
4. Example: A community PR adding basic flashcard review (core) is welcome, even though premium includes the full spaced-review system with ts-fsrs scheduling

**Not accepted:**
- Direct implementations of premium features listed in the tier matrix
- PRs that add proprietary dependencies or cloud-only requirements to core
- Breaking changes without prior discussion

### Code of Conduct
Standard Contributor Covenant v2.1.

## 8. Competitive Positioning

| Competitor | LevelUp Advantage |
|---|---|
| **Anki** | LevelUp handles full courses (video + PDF + notes), not just flashcards |
| **Notion / Obsidian** | LevelUp is purpose-built for course completion, not general knowledge management |
| **Udemy / Coursera** | LevelUp works with content you already own locally — no platform lock-in |
| **Habitica / Forest** | LevelUp tracks learning-specific progress, not generic habits |

**Unique positioning:** Local-first + AI-augmented + completion-focused. No other tool combines all three for self-directed learners with local course libraries.
